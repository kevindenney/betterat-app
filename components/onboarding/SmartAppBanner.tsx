import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { trackRedeemEvent } from '@/services/RedeemTelemetry';

const STORAGE_KEY = 'betterat.sab.dismissedAt';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface SmartAppBannerProps {
  appName: string;
  description: string;
  installUrl: string;
  page: string;
}

function readDismissedAt(): number | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? Number.parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(ts: number): void {
  if (Platform.OS !== 'web') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    // ignore
  }
}

export function SmartAppBanner({ appName, description, installUrl, page }: SmartAppBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const dismissedAt = readDismissedAt();
    const isFresh = !dismissedAt || Date.now() - dismissedAt > SEVEN_DAYS_MS;
    setVisible(isFresh);
    if (isFresh) {
      trackRedeemEvent({ name: 'install_banner_shown', page });
    }
  }, [page]);

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => {
          writeDismissedAt(Date.now());
          setVisible(false);
          trackRedeemEvent({ name: 'install_deferred', page });
        }}
        hitSlop={8}
        accessibilityLabel="Dismiss install banner"
        style={styles.close}
      >
        <X size={14} color="#6B7280" />
      </Pressable>
      <View style={styles.icon}>
        <Text style={styles.iconText}>BA</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.appName}>{appName}</Text>
        <Text style={styles.desc}>{description}</Text>
      </View>
      <Pressable
        style={styles.cta}
        onPress={() => {
          trackRedeemEvent({ name: 'install_clicked', page });
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.open(installUrl, '_blank');
          }
        }}
      >
        <Text style={styles.ctaText}>Install</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  close: {
    padding: 4,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  copy: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  desc: {
    fontSize: 11,
    color: '#6B7280',
  },
  cta: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
