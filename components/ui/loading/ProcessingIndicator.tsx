import React from 'react';
import { View, Text } from 'react-native';
import { Spinner } from '../spinner';

interface ProcessingIndicatorProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  message = 'Processing...',
  size = 'md'
}) => {
  const sizeMap = {
    sm: 'small',
    md: 'large',
    lg: 'large'
  } as const;

  const textSizeMap = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <View className="items-center justify-center py-6">
      <Spinner size={sizeMap[size]} color="#007AFF" />
      <Text className={`text-typography-600 mt-3 ${textSizeMap[size]}`}>
        {message}
      </Text>
    </View>
  );
};
