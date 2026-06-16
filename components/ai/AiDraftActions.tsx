import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

interface AiDraftActionsProps {
  isGenerating: boolean;
  onGenerate: () => void;
  onApprove?: () => void;
  onDiscard?: () => void;
  onCopy?: () => void;
  disabled?: boolean;
  lastGeneratedAt?: Date | null;
  containerStyle?: ViewStyle;
  variant?: 'horizontal' | 'vertical';
}

export function AiDraftActions({
  isGenerating,
  onGenerate,
  onApprove,
  onDiscard,
  onCopy,
  disabled = false,
  lastGeneratedAt,
  containerStyle,
  variant = 'horizontal',
}: AiDraftActionsProps) {
  const layoutStyle = variant === 'vertical' ? styles.vertical : styles.horizontal;

  return (
    <View style={[styles.container, layoutStyle, containerStyle]}>
      <TouchableOpacity
        style={[styles.primaryButton, (disabled || isGenerating) && styles.buttonDisabled]}
        onPress={onGenerate}
        disabled={disabled || isGenerating}
        accessibilityRole="button"
      >
        {isGenerating ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons name="sparkles" size={18} color="#FFFFFF" style={styles.buttonIcon} />
        )}
        <Text style={styles.primaryButtonText}>
          {isGenerating ? 'Generating…' : 'Generate draft'}
        </Text>
      </TouchableOpacity>

      {onApprove && (
        <TouchableOpacity
          style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
          onPress={onApprove}
          disabled={disabled}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>Approve</Text>
        </TouchableOpacity>
      )}

      {onCopy && (
        <TouchableOpacity
          style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
          onPress={onCopy}
          disabled={disabled}
        >
          <Ionicons name="copy-outline" size={18} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>Copy</Text>
        </TouchableOpacity>
      )}

      {onDiscard && (
        <TouchableOpacity
          style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
          onPress={onDiscard}
          disabled={disabled}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" style={styles.buttonIcon} />
          <Text style={[styles.secondaryButtonText, { color: '#EF4444' }]}>Discard</Text>
        </TouchableOpacity>
      )}

      {lastGeneratedAt && (
        <Text style={styles.helperText}>
          Updated {formatDistanceToNow(lastGeneratedAt, { addSuffix: true })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    width: '100%',
  },
  horizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  vertical: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 150,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 120,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
  },
});
