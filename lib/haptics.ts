/**
 * Haptic Feedback Utilities
 * Apple HIG compliant haptic feedback for iOS
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticType =
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError';

/**
 * Trigger haptic feedback
 * Only works on iOS devices
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  // Native haptics only — expo-haptics throws on web.
  if (Platform.OS === 'web') {
    return;
  }

  try {
    switch (type) {
      case 'selection':
        await Haptics.selectionAsync();
        break;
      case 'impactLight':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'impactMedium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'impactHeavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'notificationSuccess':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'notificationWarning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'notificationError':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      default:
        break;
    }
  } catch {
    // Silently fail if haptics aren't available on this device.
  }
}

/**
 * Selection feedback - use for toggles, segment controls, picker changes
 * This is the lightest haptic feedback
 */
export const hapticSelection = () => triggerHaptic('selection');

/**
 * Light impact - use for subtle UI interactions
 * Button taps, menu items
 */
export const hapticImpactLight = () => triggerHaptic('impactLight');

/**
 * Medium impact - use for moderate UI interactions
 * Completion of actions, swipe actions
 */
export const hapticImpactMedium = () => triggerHaptic('impactMedium');

/**
 * Heavy impact - use for significant UI interactions
 * Pull to refresh release, major transitions
 */
export const hapticImpactHeavy = () => triggerHaptic('impactHeavy');

/**
 * Success notification - use for successful completion of tasks
 */
export const hapticSuccess = () => triggerHaptic('notificationSuccess');

/**
 * Warning notification - use for warnings that require attention
 */
export const hapticWarning = () => triggerHaptic('notificationWarning');

/**
 * Error notification - use for errors that require attention
 */
export const hapticError = () => triggerHaptic('notificationError');

/**
 * Hook-style wrapper for common haptic patterns
 */
export const haptics = {
  selection: hapticSelection,
  impactLight: hapticImpactLight,
  impactMedium: hapticImpactMedium,
  impactHeavy: hapticImpactHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
} as const;

export default haptics;
