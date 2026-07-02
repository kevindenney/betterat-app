/**
 * QR Code Scanner Screen
 *
 * Scans QR codes to quickly follow sailors. Supports:
 * - Direct sailor IDs (UUID format)
 * - BetterAt profile URLs
 * - Legacy RegattaFlow profile URLs and deep links
 *
 * iOS HIG: Full-screen camera with minimal chrome overlay
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { X, Flashlight, FlashlightOff, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { IOS_COLORS, IOS_TYPOGRAPHY } from '@/lib/design-tokens-ios';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

// Dynamic import for expo-camera to handle cases where native module isn't available
let CameraView: any = null;
let useCameraPermissions: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded dynamic load; expo-camera native module may be absent
  const ExpoCamera = require('expo-camera');
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
} catch {
  // Camera module not available
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

// UUID regex for validating sailor IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Extract sailor ID from various QR code formats
function extractSailorId(data: string): string | null {
  // Direct UUID
  if (UUID_REGEX.test(data)) {
    return data;
  }

  // URL formats
  try {
    // Handle both http URLs and custom schemes
    let url: URL;
    if (data.startsWith('regattaflow://')) {
      // Convert custom scheme to parseable URL
      url = new URL(data.replace('regattaflow://', 'https://regattaflow.app/'));
    } else {
      url = new URL(data);
    }

    const pathParts = url.pathname.split('/').filter(Boolean);

    // /sailor/{id} or /profile/{id} or /user/{id}
    const profilePrefixes = ['sailor', 'profile', 'user', 's', 'p'];
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (profilePrefixes.includes(pathParts[i].toLowerCase())) {
        const potentialId = pathParts[i + 1];
        if (UUID_REGEX.test(potentialId)) {
          return potentialId;
        }
      }
    }

    // Check query params (?id=...)
    const idParam = url.searchParams.get('id') || url.searchParams.get('sailor');
    if (idParam && UUID_REGEX.test(idParam)) {
      return idParam;
    }
  } catch {
    // Not a valid URL, ignore
  }

  return null;
}

// Fallback component when camera module isn't available
function CameraUnavailable({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const rebuildCommand = 'npx expo run:ios';

  return (
    <View style={[styles.container, styles.unavailableContainer]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.closeButtonDark}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={22} color={IOS_COLORS.systemBlue} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitleDark}>Scan QR Code</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.unavailableContent}>
        <View style={styles.unavailableIconContainer}>
          <Camera size={48} color={IOS_COLORS.systemGray} />
        </View>
        <Text style={styles.unavailableTitle}>Camera Not Available</Text>
        <Text style={styles.unavailableMessage}>
          The camera module requires a native app rebuild. Please rebuild the app with:
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>{rebuildCommand}</Text>
        </View>
        <Pressable
          style={styles.secondaryActionButton}
          onPress={async () => {
            await Clipboard.setStringAsync(rebuildCommand);
            showAlert('Copied', 'Rebuild command copied to clipboard.');
          }}
        >
          <Text style={styles.secondaryActionText}>Copy Rebuild Command</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryActionButton}
          onPress={() =>
            Linking.openURL(
              'mailto:info@better.at?subject=QR%20Scanner%20Camera%20Setup&body=Please%20help%20me%20enable%20the%20camera%20module%20for%20QR%20scanning.'
            )
          }
        >
          <Text style={styles.secondaryActionText}>Contact Support</Text>
        </Pressable>
        <Pressable style={styles.closeButtonLarge} onPress={onClose}>
          <Text style={styles.closeButtonLargeText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ScanQRScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Check if camera module is available
  const cameraAvailable = CameraView !== null && useCameraPermissions !== null;

  // Use camera permissions hook only if available
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const permissionHook = cameraAvailable ? useCameraPermissions() : [null, () => {}];
  const [permission, requestPermission] = permissionHook;

  // Request permission on mount
  useEffect(() => {
    if (cameraAvailable && !permission?.granted && permission?.canAskAgain !== false) {
      requestPermission();
    }
  }, [cameraAvailable, permission, requestPermission]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleTorch = useCallback(() => {
    setTorch((prev) => !prev);
  }, []);

  const handleBarCodeScanned = useCallback(
    async (result: { data: string }) => {
      if (scanned || processing) return;

      const { data } = result;
      setScanned(true);
      setProcessing(true);

      // Haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const sailorId = extractSailorId(data);

      if (sailorId) {
        // Navigate to sailor's profile/journey
        router.replace(`/sailor-journey/${sailorId}/latest`);
      } else {
        // Invalid QR code
        showAlertWithButtons(
          'Invalid QR Code',
          'This QR code does not contain a valid BetterAt profile.',
          [
            {
              text: 'Try Again',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: handleClose,
            },
          ]
        );
        setProcessing(false);
      }
    },
    [scanned, processing, router, handleClose]
  );

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  // Camera module not available
  if (!cameraAvailable) {
    return <CameraUnavailable onClose={handleClose} />;
  }

  // Permission denied state
  if (permission && !permission.granted && permission.canAskAgain === false) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionMessage}>
            To scan QR codes and follow sailors, please allow camera access in your device settings.
          </Text>
          <Pressable style={styles.settingsButton} onPress={handleOpenSettings}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Loading permission state
  if (!permission) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Dark overlay with scan area cutout */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Top */}
        <View
          style={[
            styles.overlaySection,
            {
              top: 0,
              left: 0,
              right: 0,
              height: (SCREEN_HEIGHT - SCAN_AREA_SIZE) / 2,
            },
          ]}
        />
        {/* Bottom */}
        <View
          style={[
            styles.overlaySection,
            {
              bottom: 0,
              left: 0,
              right: 0,
              height: (SCREEN_HEIGHT - SCAN_AREA_SIZE) / 2,
            },
          ]}
        />
        {/* Left */}
        <View
          style={[
            styles.overlaySection,
            {
              top: (SCREEN_HEIGHT - SCAN_AREA_SIZE) / 2,
              left: 0,
              width: (SCREEN_WIDTH - SCAN_AREA_SIZE) / 2,
              height: SCAN_AREA_SIZE,
            },
          ]}
        />
        {/* Right */}
        <View
          style={[
            styles.overlaySection,
            {
              top: (SCREEN_HEIGHT - SCAN_AREA_SIZE) / 2,
              right: 0,
              width: (SCREEN_WIDTH - SCAN_AREA_SIZE) / 2,
              height: SCAN_AREA_SIZE,
            },
          ]}
        />

        {/* Scan frame corners */}
        <View
          style={[
            styles.scanFrame,
            {
              top: (SCREEN_HEIGHT - SCAN_AREA_SIZE) / 2,
              left: (SCREEN_WIDTH - SCAN_AREA_SIZE) / 2,
              width: SCAN_AREA_SIZE,
              height: SCAN_AREA_SIZE,
            },
          ]}
        >
          {/* Corner indicators */}
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
      </View>

      {/* Header with close button */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BlurView intensity={80} tint="dark" style={styles.closeButtonBlur}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </BlurView>

        <Text style={styles.headerTitle}>Scan QR Code</Text>

        <BlurView intensity={80} tint="dark" style={styles.closeButtonBlur}>
          <Pressable
            style={styles.closeButton}
            onPress={handleToggleTorch}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {torch ? (
              <FlashlightOff size={22} color="#FFFFFF" strokeWidth={2} />
            ) : (
              <Flashlight size={22} color="#FFFFFF" strokeWidth={2} />
            )}
          </Pressable>
        </BlurView>
      </View>

      {/* Instructions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
        <BlurView intensity={80} tint="dark" style={styles.instructionsBlur}>
          <Text style={styles.instructionsText}>
            Point your camera at a sailor's QR code to follow them
          </Text>
        </BlurView>
      </View>

      {/* Processing overlay */}
      {processing && (
        <View style={styles.processingOverlay}>
          <BlurView intensity={100} tint="dark" style={styles.processingBlur}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.processingText}>Processing...</Text>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  permissionTitle: {
    ...IOS_TYPOGRAPHY.title2,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionMessage: {
    ...IOS_TYPOGRAPHY.body,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  settingsButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
  },
  settingsButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  cancelButtonText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.systemBlue,
    textAlign: 'center',
  },

  // Unavailable state
  unavailableContainer: {
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  unavailableContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  unavailableIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  unavailableTitle: {
    ...IOS_TYPOGRAPHY.title2,
    color: IOS_COLORS.label,
    textAlign: 'center',
    marginBottom: 8,
  },
  unavailableMessage: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  codeBlock: {
    backgroundColor: IOS_COLORS.systemGray6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 24,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: IOS_COLORS.label,
  },
  closeButtonLarge: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  closeButtonLargeText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
  secondaryActionButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemGray6,
    minWidth: 220,
  },
  secondaryActionText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.systemBlue,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerTitleDark: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  closeButtonDark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Overlay
  overlaySection: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    position: 'absolute',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  closeButtonBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  instructionsBlur: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  instructionsText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Processing
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  processingBlur: {
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  processingText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: '#FFFFFF',
    marginTop: 12,
  },
});
