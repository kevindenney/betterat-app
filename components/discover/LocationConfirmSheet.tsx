/**
 * LocationConfirmSheet — map-first confirmation before moving the user's
 * location focus. Shows the candidate spot as a pin on a mini-map so the
 * user can see *where* they're about to anchor Nearby/Atlas, instead of
 * trusting a text label (which may be raw coords when geocoding fails).
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { OrgLocationsMap } from '@/components/organizations/OrgLocationsMap';
import { useSetLocationFocus } from '@/hooks/useLocationFocus';

export interface LocationConfirmTarget {
  lat: number;
  lng: number;
  label: string;
  /** sailing_venues.id when the target is a sailing venue. */
  venueId?: string;
}

interface LocationConfirmSheetProps {
  /** The candidate location; null hides the sheet. */
  target: LocationConfirmTarget | null;
  onCancel: () => void;
  /** Fired after the focus is saved successfully. */
  onConfirmed?: () => void;
}

export function LocationConfirmSheet({
  target,
  onCancel,
  onConfirmed,
}: LocationConfirmSheetProps) {
  const setFocus = useSetLocationFocus();

  const handleConfirm = () => {
    if (!target) return;
    setFocus.mutate(
      {
        lat: target.lat,
        lng: target.lng,
        label: target.label,
        venueId: target.venueId,
      },
      { onSuccess: () => onConfirmed?.() },
    );
  };

  return (
    <Modal
      visible={target != null}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onCancel} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Set your location?</Text>
                <Text style={styles.subtitle}>
                  Nearby and Atlas will center here
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={onCancel} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </Pressable>
            </View>

            {target ? (
              <View style={styles.body}>
                <OrgLocationsMap
                  locations={[{ name: target.label, lat: target.lat, lng: target.lng }]}
                  height={210}
                />
                <View style={styles.labelRow}>
                  <Ionicons name="location" size={16} color="#0A84FF" />
                  <Text style={styles.labelText} numberOfLines={1}>
                    {target.label}
                  </Text>
                  <Text style={styles.coordsText}>
                    {target.lat.toFixed(3)}, {target.lng.toFixed(3)}
                  </Text>
                </View>
                <Pressable
                  style={[styles.confirmBtn, setFocus.isPending && styles.confirmBtnBusy]}
                  onPress={handleConfirm}
                  disabled={setFocus.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`Set location to ${target.label}`}
                >
                  {setFocus.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmText}>Use this location</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTap: { flex: 1 },
  sheetWrap: { backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  title: {
    fontSize: 18,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  coordsText: {
    marginLeft: 'auto',
    fontSize: 12,
    fontFamily: fontFamily.mono,
    color: IOS_REGISTER.labelTertiary,
  },
  confirmBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnBusy: { opacity: 0.7 },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

export default LocationConfirmSheet;
