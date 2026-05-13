/**
 * AI Strategy Chat Interface
 * Interactive chat for sailing race strategy with document-trained AI
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { ThemedText } from '@/components/themed-text';
// import { BottomSheet } from '@gorhom/bottom-sheet'; // TODO: Re-enable with animation support
import { DocumentProcessingService } from '@/services/ai/DocumentProcessingService';
import type {
  StrategyChatMessage,
  StrategyInsight,
  DocumentUpload,
} from '@/lib/types/ai-knowledge';

interface StrategyChatInterfaceProps {
  visible: boolean;
  onClose: () => void;
  context?: {
    venue?: string;
    conditions?: any;
    race?: any;
  };
  onInsightGenerated?: (insights: StrategyInsight[]) => void;
}

export function StrategyChatInterface({
  visible,
  onClose,
  context,
  onInsightGenerated
}: StrategyChatInterfaceProps) {
  const [messages, setMessages] = useState<StrategyChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Upload sailing documents or ask about race tactics, rules, or strategy.',
      timestamp: new Date(),
      context
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [documentService] = useState(() => new DocumentProcessingService());

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      // Add context message if available
      if (context?.venue || context?.conditions) {
        addMessage({
          role: 'assistant',
          content: `I see you're working with:\n${context.venue ? `📍 Venue: ${context.venue}\n` : ''}${context.conditions ? `🌤️ Conditions: Wind ${context.conditions.wind?.speed}kts @ ${context.conditions.wind?.direction}°` : ''}\n\nWhat would you like to know about racing strategy for these conditions?`
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, context]);

  const addMessage = (message: Partial<StrategyChatMessage>) => {
    const newMessage: StrategyChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      context,
      ...message
    } as StrategyChatMessage;

    setMessages(prev => [...prev, newMessage]);

    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Add user message
    addMessage({
      role: 'user',
      content: userMessage
    });

    setIsTyping(true);

    try {
      // Query AI knowledge base
      const insights = await documentService.queryKnowledgeBase(userMessage, {
        venue: context?.venue,
        conditions: context?.conditions ? JSON.stringify(context.conditions) : undefined,
        raceType: context?.race?.type
      });

      // Generate response based on insights
      const response = generateResponseFromInsights(userMessage, insights);

      addMessage({
        role: 'assistant',
        content: response,
        insights: insights
      });

      // Notify parent of insights
      if (onInsightGenerated && insights.length > 0) {
        onInsightGenerated(insights);
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      addMessage({
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message}\n\nPlease try rephrasing your question or upload relevant sailing documents to improve my knowledge base.`
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleDocumentUpload = async () => {
    showAlertWithButtons(
      'Upload Sailing Document',
      'Upload sailing instructions, strategy guides, or tactical documents to enhance AI analysis.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Select PDF', onPress: () => uploadDocument('pdf') },
        { text: 'Select Image', onPress: () => uploadDocument('image') }
      ]
    );
  };

  const uploadDocument = async (type: 'pdf' | 'image') => {
    try {
      // Mock document upload - in production use document picker
      const mockUpload: DocumentUpload = {
        filename: `sample_${type}_document.${type}`,
        type,
        data: new ArrayBuffer(1024), // Mock data
        metadata: {
          venue: context?.venue,
          raceType: context?.race?.type
        }
      };

      addMessage({
        role: 'user',
        content: `📄 Uploading ${mockUpload.filename}...`
      });

      const analysis = await documentService.uploadDocument(mockUpload);

      addMessage({
        role: 'assistant',
        content: `✅ Document processed successfully!\n\n**Analysis Summary:**\n${analysis.summary}\n\n**Key Insights Found:** ${analysis.insights.length}\n\nYou can now ask me specific questions about this document or request tactical advice based on its content.`,
        insights: analysis.insights
      });

    } catch (error: any) {
      showAlert('Upload Failed', error.message);
    }
  };

  const generateResponseFromInsights = (query: string, insights: StrategyInsight[]): string => {
    if (insights.length === 0) {
      return "I don't have specific information about that in my current knowledge base. Try uploading relevant sailing documents or ask about general sailing tactics, rules, or strategy principles.";
    }

    let response = `Based on my analysis of your sailing documents, here's what I found:\n\n`;

    insights.forEach((insight, _index) => {
      const emojiMap: Record<StrategyInsight['type'], string> = {
        tactical: '🎯',
        strategic: '🧭',
        rules: '📋',
        conditions: '🌤️',
        safety: '🛟',
        cultural: '🤝',
        general: '💡'
      };

      const emoji = emojiMap[insight.type] ?? '💡';

      response += `${emoji} **${insight.title}**\n`;
      response += `${insight.description}\n`;

      if (insight.tacticalAdvice) {
        response += `💭 *Tactical Advice: ${insight.tacticalAdvice}*\n`;
      }

      if (insight.confidence > 0.8) {
        response += `✅ High confidence (${Math.round(insight.confidence * 100)}%)\n`;
      }

      response += '\n';
    });

    response += `Would you like me to elaborate on any of these points or analyze a specific racing scenario?`;

    return response;
  };

  const renderMessage = ({ item }: { item: StrategyChatMessage }) => (
    <View style={[
      styles.messageContainer,
      item.role === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <View style={[
        styles.messageBubble,
        item.role === 'user' ? styles.userBubble : styles.assistantBubble
      ]}>
        <ThemedText style={[
          styles.messageText,
          item.role === 'user' ? styles.userText : styles.assistantText
        ]}>
          {item.content}
        </ThemedText>

        {/* Display insights if available */}
        {item.insights && item.insights.length > 0 && (
          <View style={styles.insightsContainer}>
            {item.insights.slice(0, 2).map((insight, index) => (
              <TouchableOpacity
                key={index}
                style={styles.insightChip}
                onPress={() => {
                  showAlert(insight.title, `${insight.description}\n\nTactical Advice: ${insight.tacticalAdvice}`);
                }}
              >
                <ThemedText style={styles.insightText}>
                  💡 {insight.title}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ThemedText style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </ThemedText>
    </View>
  );

  const suggestedQuestions = [
    "What's the best start line strategy for these conditions?",
    "How should I approach the first mark in this wind?",
    "What are the key tactical decisions on the downwind leg?",
    "How do tidal currents affect race strategy?",
    "What are the most common rule violations to avoid?"
  ];

  if (!visible) return null;

  return (
    <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
      <TouchableOpacity style={styles.modalContainer} activeOpacity={1}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText style={styles.headerTitle}>🧠 Strategy Assistant</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              Powered by sailing knowledge base
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.uploadButton} onPress={handleDocumentUpload}>
            <ThemedText style={styles.uploadButtonText}>📄 Upload</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Context Display */}
        {context && (
          <View style={styles.contextBar}>
            {context.venue && (
              <View style={styles.contextChip}>
                <ThemedText style={styles.contextText}>📍 {context.venue}</ThemedText>
              </View>
            )}
            {context.conditions?.wind && (
              <View style={styles.contextChip}>
                <ThemedText style={styles.contextText}>
                  🌬️ {context.conditions.wind.speed}kts @ {context.conditions.wind.direction}°
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
              <ThemedText style={styles.typingText}>Thinking...</ThemedText>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}

        {/* Suggested Questions */}
        {messages.length <= 2 && (
          <View style={styles.suggestionsContainer}>
            <ThemedText style={styles.suggestionsTitle}>Suggested Questions:</ThemedText>
            <View style={styles.suggestions}>
              {suggestedQuestions.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => setInputText(question)}
                >
                  <ThemedText style={styles.suggestionText}>{question}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about sailing strategy, tactics, or rules..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            <ThemedText style={styles.sendButtonText}>Send</ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    minHeight: '50%',
  },
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  uploadButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  contextBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#2A2A2A',
  },
  contextChip: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  contextText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  assistantMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#0066CC',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#333333',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    marginHorizontal: 4,
  },
  insightsContainer: {
    marginTop: 8,
    gap: 4,
  },
  insightChip: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  insightText: {
    color: '#00FF88',
    fontSize: 11,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '60%',
  },
  typingText: {
    color: '#888',
    fontSize: 12,
    marginRight: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  dot1: {
    animationDelay: '0ms',
  },
  dot2: {
    animationDelay: '200ms',
  },
  dot3: {
    animationDelay: '400ms',
  },
  suggestionsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  suggestions: {
    gap: 6,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  suggestionText: {
    color: '#CCC',
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StrategyChatInterface;
