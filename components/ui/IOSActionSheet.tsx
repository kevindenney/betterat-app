/**
 * IOSActionSheet - Modern Bottom Sheet Action Menu
 *
 * Clean, modern design inspired by Strava/iOS:
 * - Drag indicator at top
 * - Title with close button
 * - Icon left, text right (same row)
 * - Clean white background
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

// =============================================================================
// TYPES
// =============================================================================

export interface ActionSheetAction {
  label: string;
  testID?: string;
  description?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface IOSActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function IOSActionSheet({
  isOpen,
  onClose,
  title,
  actions,
}: IOSActionSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(400)).current;
  // Cap the sheet so a long action list never overflows past the status bar;
  // the actions scroll within this height instead.
  const maxSheetHeight = screenHeight - insets.top - 12;

  React.useEffect(() => {
    if (isOpen) {
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

  const handleActionPress = (action: ActionSheetAction) => {
    onClose();
    setTimeout(() => action.onPress(), 150);
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          opacity: fadeAnim,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom || 16,
          transform: [{ translateY: slideAnim }],
        }}
        pointerEvents="box-none"
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: maxSheetHeight,
          }}
        >
          {/* Drag Indicator */}
          <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: '#C7C7CC',
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 20,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 17,
                fontWeight: '600',
                color: '#000000',
                letterSpacing: -0.4,
              }}
              numberOfLines={1}
            >
              {title || 'Options'}
            </Text>
            <Pressable
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: '#E5E5EA',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onClose}
              hitSlop={8}
            >
              <X size={18} color="#8E8E93" strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: '#E5E5EA',
              marginLeft: 20,
              marginRight: 20,
            }}
          />

          {/* Actions */}
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
          {actions.map((action, idx) => {
            const isLast = idx === actions.length - 1;
            const textColor = action.destructive ? '#FF3B30' : '#000000';
            const iconColor = action.destructive ? '#FF3B30' : '#8E8E93';

            return (
              <Pressable
                key={action.label}
                testID={action.testID}
                onPress={() => handleActionPress(action)}
                disabled={action.disabled}
                accessibilityLabel={action.label}
              >
                {({ pressed }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      minHeight: 60,
                      backgroundColor: pressed ? '#F2F2F7' : 'transparent',
                      opacity: action.disabled ? 0.4 : 1,
                    }}
                  >
                    {action.icon && (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#F2F2F7',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 14,
                        }}
                      >
                        {React.cloneElement(action.icon as React.ReactElement<any>, {
                          size: 22,
                          color: iconColor,
                          strokeWidth: 1.5,
                        })}
                      </View>
                    )}
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: '500',
                        color: textColor,
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={1}
                    >
                      {action.label}
                    </Text>
                    {!isLast && (
                      <View
                        style={{
                          position: 'absolute',
                          left: 74,
                          right: 20,
                          bottom: 0,
                          height: 1,
                          backgroundColor: '#E5E5EA',
                        }}
                      />
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

export default IOSActionSheet;
