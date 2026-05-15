import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface AddStepFabProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function AddStepFab({ onPress, style, disabled = false }: AddStepFabProps) {
  return React.createElement(
    TouchableOpacity,
    {
      accessibilityRole: 'button',
      accessibilityLabel: 'Add a practice step',
      accessibilityHint: 'Opens options to build with AI Coach or start from a blueprint.',
      activeOpacity: 0.82,
      disabled,
      onPress,
      style: [styles.fab, disabled && styles.disabled, style],
    },
    React.createElement(Ionicons, { name: 'add', size: 32, color: '#FFFFFF' }),
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  disabled: {
    opacity: 0.45,
  },
});
