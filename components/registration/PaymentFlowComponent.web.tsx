import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

interface PaymentFlowProps {
  entryId: string;
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function PaymentFlowComponent({ onSuccess, onCancel }: PaymentFlowProps) {
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
        Payment on Web
      </Text>
      <Text style={{ color: '#374151', marginBottom: 16 }}>
        Mobile Stripe SDK is not available on web. Please use the mobile app or
        contact the organizer to complete payment.
      </Text>
      <Pressable
        onPress={() =>
          Linking.openURL(
            'mailto:info@better.at?subject=Web%20Payment%20Support&body=I%20need%20help%20completing%20registration%20payment%20on%20web.'
          )
        }
        style={{ borderWidth: 1, borderColor: '#d1d5db', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
      >
        <Text style={{ color: '#111827', fontWeight: '600' }}>Contact Support</Text>
      </Pressable>
      <Pressable
        onPress={onSuccess}
        style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>Continue</Text>
      </Pressable>
      {onCancel && (
        <Pressable onPress={onCancel} style={{ padding: 12, alignItems: 'center' }}>
          <Text>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}
