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
        <X size={16} color="#7C7C82" />
      </Pressable>
      <View style={styles.glyph}>
        <Text style={styles.glyphB}>b</Text>
        <View style={styles.glyphUnderline} />
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
    backgroundColor: 'rgba(247,247,250,0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.10)',
  },
  close: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1F2D44',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0B1525',
  },
  glyphB: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -1.2,
    marginBottom: -2,
  },
  glyphUnderline: {
    width: 13,
    height: 1.2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginTop: 2,
    borderRadius: 1,
  },
  copy: {
    flex: 1,
  },
  appName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.1,
  },
  desc: {
    fontSize: 10.5,
    color: '#7C7C82',
    marginTop: 1,
    letterSpacing: -0.05,
  },
  cta: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: -0.05,
  },
});
