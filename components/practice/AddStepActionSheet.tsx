import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface AddStepActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onBuildWithCoach: () => void;
  onChooseBlueprint: () => void;
}

type ActionRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
};

function ActionRow({ icon, title, subtitle, onPress, testID }: ActionRowProps) {
  return React.createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      accessibilityLabel: title,
      accessibilityHint: subtitle,
      onPress,
      style: styles.actionRow,
      testID,
    },
    React.createElement(
      View,
      { style: styles.iconBubble },
      React.createElement(Ionicons, { name: icon, size: 22, color: '#007AFF' }),
    ),
    React.createElement(
      View,
      { style: styles.actionText },
      React.createElement(Text, { style: styles.actionTitle }, title),
      React.createElement(Text, { style: styles.actionSubtitle }, subtitle),
    ),
    React.createElement(Ionicons, { name: 'chevron-forward', size: 19, color: '#C7C7CC' }),
  );
}

export function AddStepActionSheet({
  visible,
  onClose,
  onBuildWithCoach,
  onChooseBlueprint,
}: AddStepActionSheetProps) {
  return React.createElement(
    Modal,
    {
      visible,
      transparent: true,
      animationType: 'slide',
      onRequestClose: onClose,
    },
    React.createElement(
      Pressable,
      {
        accessibilityLabel: 'Close add step options',
        onPress: onClose,
        style: styles.backdrop,
        testID: 'add-step-backdrop',
      },
      React.createElement(
        Pressable,
        {
          onPress: (event: { stopPropagation?: () => void }) => event.stopPropagation?.(),
          style: styles.sheet,
          testID: 'add-step-action-sheet',
        },
        React.createElement(View, { style: styles.handle }),
        React.createElement(Text, { style: styles.title }, 'Add a step'),
        React.createElement(ActionRow, {
          icon: 'sparkles-outline',
          title: 'Build with AI Coach',
          subtitle: 'Describe what you want to practice. BetterAt drafts the plan.',
          onPress: onBuildWithCoach,
          testID: 'add-step-build-with-coach',
        }),
        React.createElement(ActionRow, {
          icon: 'book-outline',
          title: 'From a Blueprint',
          subtitle: 'Start from a step in a blueprint you follow.',
          onPress: onChooseBlueprint,
          testID: 'add-step-from-blueprint',
        }),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Cancel',
            onPress: onClose,
            style: styles.cancelButton,
            testID: 'add-step-cancel',
          },
          React.createElement(Text, { style: styles.cancelText }, 'Cancel'),
        ),
      ),
    ),
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    marginHorizontal: 10,
    marginBottom: 10,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
    backgroundColor: '#C7C7CC',
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
  },
  actionRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  actionSubtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  cancelButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
});
