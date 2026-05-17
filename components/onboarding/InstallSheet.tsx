import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Mic, WifiOff } from 'lucide-react-native';
import { trackRedeemEvent } from '@/services/RedeemTelemetry';

export interface InstallSheetProps {
  visible: boolean;
  appName: string;
  page: string;
  onInstall: () => void;
  onNotNow: () => void;
}

export function InstallSheet({ visible, appName, page, onInstall, onNotNow }: InstallSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <Pressable style={styles.scrim} onPress={onNotNow}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Capture live in the {appName} app</Text>
          <Text style={styles.sub}>
            Voice notes, camera captures, and offline capture all require the native app. The web works
            for planning and reflection — but the live moment lives in the app.
          </Text>

          <View style={styles.feats}>
            <Feature icon={<Mic size={18} color="#2563EB" />} label="Voice capture" />
            <Feature icon={<Camera size={18} color="#16A34A" />} label="Camera + photo" />
            <Feature icon={<WifiOff size={18} color="#6D28D9" />} label="Offline capture" />
          </View>

          <Pressable
            style={styles.primary}
            onPress={() => {
              trackRedeemEvent({ name: 'install_clicked', page });
              onInstall();
            }}
          >
            <Text style={styles.primaryText}>Install free</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              trackRedeemEvent({ name: 'install_deferred', page });
              onNotNow();
            }}
          >
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.feat}>
      {icon}
      <Text style={styles.featLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  feats: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  feat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  featLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  primary: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
