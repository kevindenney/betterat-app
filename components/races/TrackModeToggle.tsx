/**
 * Track Mode Toggle Component
 * Switches between Live tracking and Full track view modes
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Radio, Eye } from 'lucide-react-native';

export type TrackMode = 'live' | 'full';

interface TrackModeToggleProps {
  mode: TrackMode;
  onModeChange: (mode: TrackMode) => void;
  isTracking?: boolean; // Whether GPS tracking is currently active
}

export function TrackModeToggle({
  mode,
  onModeChange,
  isTracking = false,
}: TrackModeToggleProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.button,
          mode === 'live' && styles.activeButton,
          !isTracking && styles.disabledButton,
        ]}
        onPress={() => onModeChange('live')}
        disabled={!isTracking}
      >
        <Radio
          size={16}
          color={mode === 'live' ? 'white' : '#64748B'}
          style={styles.icon}
        />
        <Text
          style={[
            styles.buttonText,
            mode === 'live' && styles.activeButtonText,
          ]}
        >
          Live
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.button,
          mode === 'full' && styles.activeButton,
        ]}
        onPress={() => onModeChange('full')}
      >
        <Eye
          size={16}
          color={mode === 'full' ? 'white' : '#64748B'}
          style={styles.icon}
        />
        <Text
          style={[
            styles.buttonText,
            mode === 'full' && styles.activeButtonText,
          ]}
        >
          Full Track
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    opacity: 0.4,
  },
  icon: {
    marginRight: 6,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  activeButtonText: {
    color: 'white',
  },
});
