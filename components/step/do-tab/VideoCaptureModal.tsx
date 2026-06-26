/**
 * VideoCaptureModal — in-app video recording for the Do tab.
 *
 * Full-screen camera with a record/stop control. On stop, resolves the local
 * file uri and hands it to the controller, which uploads it to the step-media
 * bucket as a video media_upload. expo-camera is loaded via a guarded require
 * so web / missing-native-module environments fall back gracefully.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
let useMicrophonePermissions: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded dynamic load; expo-camera native module may be absent
  const ExpoCamera = require('expo-camera');
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
  useMicrophonePermissions = ExpoCamera.useMicrophonePermissions;
} catch {
  // Camera module not available
}

const MAX_DURATION_SEC = 60;

export interface VideoCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onCaptured: (uri: string) => void;
}

export function VideoCaptureModal({ visible, onClose, onCaptured }: VideoCaptureModalProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const [recording, setRecording] = useState(false);
  const cameraAvailable = CameraView !== null && useCameraPermissions !== null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [camPerm, requestCamPerm] = cameraAvailable ? useCameraPermissions() : [null, () => {}];
  const micHook = cameraAvailable && useMicrophonePermissions;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [micPerm, requestMicPerm] = micHook ? useMicrophonePermissions() : [null, () => {}];

  useEffect(() => {
    if (visible) setRecording(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !cameraAvailable) return;
    if (!camPerm?.granted && camPerm?.canAskAgain !== false) requestCamPerm();
    if (micPerm && !micPerm.granted && micPerm.canAskAgain !== false) requestMicPerm();
  }, [visible, cameraAvailable, camPerm, micPerm, requestCamPerm, requestMicPerm]);

  const handleStart = useCallback(async () => {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: MAX_DURATION_SEC });
      setRecording(false);
      if (result?.uri) onCaptured(result.uri);
    } catch {
      setRecording(false);
    }
  }, [recording, onCaptured]);

  const handleStop = useCallback(() => {
    if (!cameraRef.current || !recording) return;
    // Resolves the pending recordAsync promise → onCaptured fires there.
    cameraRef.current.stopRecording();
  }, [recording]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12} disabled={recording}>
        <Ionicons name="close" size={26} color={recording ? 'rgba(255,255,255,0.3)' : '#FFFFFF'} />
      </Pressable>
      <Text style={styles.headerTitle}>Record video</Text>
      <View style={styles.closeButton} />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!cameraAvailable ? (
          <View style={styles.centered}>
            <Ionicons name="videocam-outline" size={48} color="#8E8E93" />
            <Text style={styles.message}>
              Video recording needs a native build with the camera module.
            </Text>
            <Pressable style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        ) : camPerm && !camPerm.granted && camPerm.canAskAgain === false ? (
          <View style={styles.centered}>
            <Text style={styles.message}>
              Camera access is off. Enable it in Settings to record video.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        ) : !camPerm ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" mode="video" />
            <View style={[styles.footer, { paddingBottom: insets.bottom + 36 }]}>
              <Pressable
                onPress={recording ? handleStop : handleStart}
                style={styles.recordOuter}
                accessibilityRole="button"
                accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
              >
                <View style={recording ? styles.recordInnerStop : styles.recordInner} />
              </Pressable>
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF3B30',
  },
  recordInnerStop: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
});

export default VideoCaptureModal;
