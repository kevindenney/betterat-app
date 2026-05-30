/**
 * NewChatSheet - Action sheet for creating new conversations
 *
 * Provides options for:
 * - New Message (1-on-1 direct message)
 * - New Group (group chat)
 * - Your Fleets (fleet-based chat)
 * - Your Crews (crew-based chat)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, User, Users, Sailboat, Trophy } from 'lucide-react-native';
import { ContactPicker } from './ContactPicker';
import { GroupCreationFlow } from './GroupCreationFlow';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

// =============================================================================
// TYPES
// =============================================================================

interface NewChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onThreadCreated: (threadId: string) => void;
  initialGroupName?: string;
  initialGroupEmoji?: string;
}

type SheetMode = 'menu' | 'direct' | 'group';

// =============================================================================
// MENU OPTION
// =============================================================================

interface MenuOptionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
}

function MenuOption({ icon, label, description, onPress, disabled }: MenuOptionProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuOption,
        pressed && styles.menuOptionPressed,
        disabled && styles.menuOptionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.menuOptionIcon}>{icon}</View>
      <View style={styles.menuOptionContent}>
        <Text style={[styles.menuOptionLabel, disabled && styles.menuOptionLabelDisabled]}>
          {label}
        </Text>
        <Text style={[styles.menuOptionDescription, disabled && styles.menuOptionDescriptionDisabled]}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NewChatSheet({
  isOpen,
  onClose,
  onThreadCreated,
  initialGroupName,
  initialGroupEmoji,
}: NewChatSheetProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SheetMode>('menu');

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(400)).current;

  // Animations
  React.useEffect(() => {
    if (isOpen) {
      setMode('menu'); // Reset to menu when opening
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 28,
          stiffness: 400,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, fadeAnim, slideAnim]);

  const handleClose = useCallback(() => {
    setMode('menu');
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    setMode('menu');
  }, []);

  const handleDirectCreated = useCallback((threadId: string) => {
    setMode('menu');
    onThreadCreated(threadId);
  }, [onThreadCreated]);

  const handleGroupCreated = useCallback((threadId: string) => {
    setMode('menu');
    onThreadCreated(threadId);
  }, [onThreadCreated]);

  // Render content based on mode
  const renderContent = () => {
    switch (mode) {
      case 'direct':
        return (
          <ContactPicker
            mode="single"
            title="New Message"
            onSelect={handleDirectCreated}
            onBack={handleBack}
            onClose={handleClose}
          />
        );
      case 'group':
        return (
          <GroupCreationFlow
            onCreated={handleGroupCreated}
            onBack={handleBack}
            onClose={handleClose}
            initialName={initialGroupName}
            initialEmoji={initialGroupEmoji}
          />
        );
      default:
        return (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.dragIndicator} />
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>New Conversation</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.closeButtonPressed,
                  ]}
                  onPress={handleClose}
                >
                  <X size={18} color={IOS_COLORS.secondaryLabel} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Options */}
            <View style={styles.menuOptions}>
              <MenuOption
                icon={<User size={22} color={IOS_COLORS.secondaryLabel} strokeWidth={1.5} />}
                label="New Message"
                description="Start a 1-on-1 conversation"
                onPress={() => setMode('direct')}
              />
              <MenuOption
                icon={<Users size={22} color={IOS_COLORS.secondaryLabel} strokeWidth={1.5} />}
                label="New Group"
                description="Create a group with multiple people"
                onPress={() => setMode('group')}
              />
              <MenuOption
                icon={<Sailboat size={22} color={IOS_COLORS.secondaryLabel} strokeWidth={1.5} />}
                label="Your Fleets"
                description="Message your fleet members"
                onPress={() => {
                  handleClose();
                  router.push('/(tabs)/fleet');
                }}
              />
              <MenuOption
                icon={<Trophy size={22} color={IOS_COLORS.secondaryLabel} strokeWidth={1.5} />}
                label="Your Crews"
                description="Message your racing crews"
                onPress={() => {
                  handleClose();
                  router.push('/(tabs)/crew');
                }}
              />
            </View>
          </>
        );
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            paddingBottom: insets.bottom || 16,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>{renderContent()}</View>
      </Animated.View>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdropPressable: {
    flex: 1,
  },

  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 200,
    overflow: 'hidden',
  },

  // Header
  header: {
    paddingTop: 8,
    paddingHorizontal: IOS_SPACING.lg,
  },
  dragIndicator: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: '#D1D1D6',
  },

  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: IOS_SPACING.lg,
  },

  // Menu options
  menuOptions: {
    paddingVertical: IOS_SPACING.sm,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 14,
    gap: 14,
  },
  menuOptionPressed: {
    backgroundColor: '#F2F2F7',
  },
  menuOptionDisabled: {
    opacity: 0.5,
  },
  menuOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionContent: {
    flex: 1,
    gap: 2,
  },
  menuOptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
  },
  menuOptionLabelDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },
  menuOptionDescription: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  menuOptionDescriptionDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },

  // Coming soon
  comingSoon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: IOS_SPACING.xxl,
    gap: IOS_SPACING.sm,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  comingSoonSubtext: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  comingSoonButton: {
    marginTop: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.xl,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: IOS_RADIUS.lg,
  },
  comingSoonButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default NewChatSheet;
