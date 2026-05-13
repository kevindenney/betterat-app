/**
 * AIQuickEntry Component
 *
 * Hero section for AI-powered race entry
 * Supports paste, upload, and manual input
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Typography, Spacing, colors, BorderRadius, Shadows } from '@/constants/designSystem';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('AIQuickEntry');

export type InputMethod = 'paste' | 'upload' | 'url' | 'manual';

interface AIQuickEntryProps {
  onExtract: (method: InputMethod, content: string | File) => Promise<void>;
  onManualEntry: () => void;
  loading?: boolean;
}

export const AIQuickEntry: React.FC<AIQuickEntryProps> = ({
  onExtract,
  onManualEntry,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState<InputMethod>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [urlContent, setUrlContent] = useState('');

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await onExtract('upload', result.assets[0].uri);
      }
    } catch (error) {
      logger.error('Document picker error', error);
    }
  };

  const handleSubmit = async () => {
    if (activeTab === 'paste' && pasteContent.trim()) {
      await onExtract('paste', pasteContent.trim());
    } else if (activeTab === 'url' && urlContent.trim()) {
      await onExtract('url', urlContent.trim());
    }
  };

  const canSubmit =
    (activeTab === 'paste' && pasteContent.trim().length > 0) ||
    (activeTab === 'url' && urlContent.trim().length > 0);

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <View style={styles.hero}>
        <View style={styles.aiIconContainer}>
          <Ionicons name="sparkles" size={32} color={colors.ai[600]} />
        </View>
        <Text style={styles.heroTitle}>Quick Add</Text>
        <Text style={styles.heroSubtitle}>
          Paste race details, upload a PDF, or enter a URL — we'll extract all the information
        </Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'paste' && styles.tabActive]}
          onPress={() => setActiveTab('paste')}
        >
          <Ionicons
            name="clipboard-outline"
            size={20}
            color={activeTab === 'paste' ? colors.ai[600] : colors.text.secondary}
          />
          <Text
            style={[styles.tabText, activeTab === 'paste' && styles.tabTextActive]}
          >
            Paste Text
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'upload' && styles.tabActive]}
          onPress={() => setActiveTab('upload')}
        >
          <Ionicons
            name="document-outline"
            size={20}
            color={activeTab === 'upload' ? colors.ai[600] : colors.text.secondary}
          />
          <Text
            style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}
          >
            Upload PDF
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'url' && styles.tabActive]}
          onPress={() => setActiveTab('url')}
        >
          <Ionicons
            name="link-outline"
            size={20}
            color={activeTab === 'url' ? colors.ai[600] : colors.text.secondary}
          />
          <Text
            style={[styles.tabText, activeTab === 'url' && styles.tabTextActive]}
          >
            From URL
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'paste' && (
          <View>
            <TextInput
              style={styles.textArea}
              value={pasteContent}
              onChangeText={setPasteContent}
              placeholder="Paste race details here... e.g., Notice of Race, email, or event description"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              editable={!loading}
            />
            <Text style={styles.hint}>
              💡 Paste anything: emails, NOIs, race descriptions, or copied text
            </Text>
          </View>
        )}

        {activeTab === 'upload' && (
          <View style={styles.uploadArea}>
            <Ionicons name="cloud-upload-outline" size={48} color={colors.ai[400]} />
            <Text style={styles.uploadTitle}>Upload Race Document</Text>
            <Text style={styles.uploadSubtitle}>
              PDF files: Notice of Race, Sailing Instructions, or Course Maps
            </Text>
            <Pressable
              style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
              onPress={handleUpload}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="folder-open-outline" size={20} color="white" />
                  <Text style={styles.uploadButtonText}>Choose File</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {activeTab === 'url' && (
          <View>
            <TextInput
              style={styles.urlInput}
              value={urlContent}
              onChangeText={setUrlContent}
              placeholder="https://www.example.com/race-notice.pdf"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!loading}
            />
            <Text style={styles.hint}>
              💡 Enter a URL to a PDF, webpage, or online race notice
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {(activeTab === 'paste' || activeTab === 'url') && (
          <Pressable
            style={[
              styles.extractButton,
              (!canSubmit || loading) && styles.extractButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.extractButtonText}>Extracting...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="white" />
                <Text style={styles.extractButtonText}>Extract</Text>
              </>
            )}
          </Pressable>
        )}

        <Pressable
          style={styles.manualButton}
          onPress={onManualEntry}
          disabled={loading}
        >
          <Ionicons name="create-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.manualButtonText}>Enter Manually Instead</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: colors.ai[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.ai[100],
  },
  aiIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.ai[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    ...Typography.h2,
    color: colors.text.primary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...Typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.medium,
    backgroundColor: colors.background.secondary,
  },
  tabActive: {
    backgroundColor: colors.ai[50],
    borderWidth: 1,
    borderColor: colors.ai[600],
  },
  tabText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.ai[700],
    fontWeight: '600',
  },
  tabContent: {
    padding: Spacing.lg,
  },
  textArea: {
    ...Typography.body,
    backgroundColor: colors.background.secondary,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: Spacing.md,
    minHeight: 160,
    color: colors.text.primary,
  },
  hint: {
    ...Typography.caption,
    color: colors.text.tertiary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  uploadArea: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: colors.background.secondary,
    borderRadius: BorderRadius.medium,
    borderWidth: 2,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  uploadTitle: {
    ...Typography.h3,
    color: colors.text.primary,
    marginTop: Spacing.md,
  },
  uploadSubtitle: {
    ...Typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
    maxWidth: 280,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.ai[600],
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.medium,
  },
  uploadButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  uploadButtonText: {
    ...Typography.bodyBold,
    color: 'white',
  },
  urlInput: {
    ...Typography.body,
    backgroundColor: colors.background.secondary,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: Spacing.md,
    color: colors.text.primary,
  },
  actionButtons: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.ai[600],
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.medium,
    ...Shadows.medium,
  },
  extractButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  extractButtonText: {
    ...Typography.bodyBold,
    color: 'white',
    fontSize: 16,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.primary,
  },
  manualButtonText: {
    ...Typography.bodyBold,
    color: colors.primary[600],
  },
});
