/**
 * ScanCaptureModal — barcode / QR scanner for the Do tab.
 *
 * Full-screen camera that decodes a single barcode/QR and hands the raw value
 * back to the controller, which persists it (URL → media_link, else a note).
 * expo-camera is loaded via a guarded require so web / missing-native-module
 * environments fall back gracefully (mirrors app/scan-qr.tsx).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

export interface ScanCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

export function ScanCaptureModal({ visible, onClose, onScanned }: ScanCaptureModalProps) {
  const insets = useSafeAreaInsets();
  const [scanned, setScanned] = useState(false);
  const cameraAvailable = CameraView !== null && useCameraPermissions !== null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [permission, requestPermission] = cameraAvailable ? useCameraPermissions() : [null, () => {}];

  // Reset the one-shot guard each time the modal opens.
  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !cameraAvailable) return;
    if (!permission?.granted && permission?.canAskAgain !== false) requestPermission();
  }, [visible, cameraAvailable, permission, requestPermission]);

  const handleScanned = useCallback(
    (result: { data: string }) => {
      if (scanned) return;
      setScanned(true);
      onScanned(result.data);
    },
    [scanned, onScanned],
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={26} color="#FFFFFF" />
      </Pressable>
      <Text style={styles.headerTitle}>Scan code</Text>
      <View style={styles.closeButton} />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!cameraAvailable ? (
          <View style={styles.centered}>
            <Ionicons name="scan-outline" size={48} color="#8E8E93" />
            <Text style={styles.message}>Scanning needs a native build with the camera module.</Text>
            <Pressable style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        ) : permission && !permission.granted && permission.canAskAgain === false ? (
          <View style={styles.centered}>
            <Text style={styles.message}>
              Camera access is off. Enable it in Settings to scan codes.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        ) : !permission ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
              }}
              onBarcodeScanned={scanned ? undefined : handleScanned}
            />
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={styles.frame} />
            </View>
            <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
              <Text style={styles.footerText}>Point the camera at a barcode or QR code</Text>
            </View>
          </>
        )}
        {header}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#007AFF',
  },
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
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default ScanCaptureModal;
