import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  CheckCircle2,
  CloudOff,
  Download,
  Mic,
  Star,
} from 'lucide-react-native';
import { trackRedeemEvent } from '@/services/RedeemTelemetry';

export interface InstallSheetProps {
  visible: boolean;
  appName: string;
  page: string;
  onInstall: () => void;
  onNotNow: () => void;
  /** Overrides the default "Your blueprint will follow you…" green resume copy. */
  resumePromise?: string;
}

const DEFAULT_RESUME =
  'Your blueprint will follow you. Open the app once installed — same Kevin, same step, no re-sign-in.';

export function InstallSheet({
  visible,
  appName,
  page,
  onInstall,
  onNotNow,
  resumePromise,
}: InstallSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onNotNow}>
      <Pressable style={styles.scrim} onPress={onNotNow}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />

          <View style={styles.topRow}>
            <View style={styles.iconSquare}>
              <Text style={styles.iconB}>b</Text>
              <View style={styles.iconUnderline} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaName}>{appName}</Text>
              <Text style={styles.metaDesc}>Get better at what matters.</Text>
              <View style={styles.stars}>
                <Star size={11} color="#F5A524" fill="#F5A524" />
                <Star size={11} color="#F5A524" fill="#F5A524" />
                <Star size={11} color="#F5A524" fill="#F5A524" />
                <Star size={11} color="#F5A524" fill="#F5A524" />
                <Star size={11} color="#F5A524" fill="rgba(245,165,36,0.5)" />
                <Text style={styles.starCount}>1.2k ratings</Text>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.getBtn}
            onPress={() => {
              trackRedeemEvent({ name: 'install_clicked', page });
              onInstall();
            }}
          >
            <Download size={15} color="#FFFFFF" />
            <Text style={styles.getText}>Get</Text>
          </Pressable>
          <Text style={styles.installLine}>
            <Text style={styles.installLineStrong}>Free</Text> · In-app purchases · 48 MB
          </Text>

          <View style={styles.whyList}>
            <WhyRow
              icon={<Mic size={16} color="#5856D6" />}
              title="Voice capture on the water"
              tail="hands-free reflections, even offline"
            />
            <WhyRow
              icon={<Camera size={16} color="#5856D6" />}
              title="Photo & video evidence"
              tail="tagged to the step you're on"
            />
            <WhyRow
              icon={<CloudOff size={16} color="#5856D6" />}
              title="Works offline"
              tail="syncs when you're back in range"
            />
          </View>

          <View style={styles.resumeLine}>
            <CheckCircle2 size={14} color="#0A6B2A" />
            <Text style={styles.resumeText}>{resumePromise ?? DEFAULT_RESUME}</Text>
          </View>

          <Pressable
            style={styles.notNow}
            onPress={() => {
              trackRedeemEvent({ name: 'install_deferred', page });
              onNotNow();
            }}
          >
            <Text style={styles.notNowText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WhyRow({
  icon,
  title,
  tail,
}: {
  icon: React.ReactNode;
  title: string;
  tail: string;
}) {
  return (
    <View style={styles.whyRow}>
      <View style={styles.whyIcon}>{icon}</View>
      <Text style={styles.whyText}>
        <Text style={styles.whyTextStrong}>{title}</Text> — {tail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.30)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: -16 },
    shadowRadius: 40,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60,60,67,0.30)',
    marginVertical: 4,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconSquare: {
    width: 60,
    height: 60,
    borderRadius: 13,
    backgroundColor: '#1F2D44',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0B1525',
  },
  iconB: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -1.6,
    marginBottom: -2,
  },
  iconUnderline: {
    width: 16,
    height: 1.4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginTop: 3,
    borderRadius: 1,
  },
  meta: {
    flex: 1,
  },
  metaName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  metaDesc: {
    fontSize: 11.5,
    color: '#7C7C82',
    marginTop: 3,
    letterSpacing: -0.05,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
  },
  starCount: {
    color: '#7C7C82',
    fontSize: 10,
    marginLeft: 4,
    letterSpacing: -0.05,
  },
  getBtn: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#007AFF',
    shadowOpacity: 0.36,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  getText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  installLine: {
    textAlign: 'center',
    color: '#7C7C82',
    fontSize: 10.5,
    marginTop: 8,
    letterSpacing: -0.05,
  },
  installLineStrong: {
    color: '#3C3C43',
    fontWeight: '500',
  },
  whyList: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    gap: 9,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  whyIcon: {
    width: 22,
    alignItems: 'center',
    marginTop: 1,
  },
  whyText: {
    flex: 1,
    color: '#3C3C43',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.05,
  },
  whyTextStrong: {
    color: '#1C1C1E',
    fontWeight: '600',
  },
  resumeLine: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#E8F8EC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#B7E8C2',
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeText: {
    flex: 1,
    fontSize: 11,
    color: '#0A6B2A',
    lineHeight: 15,
    letterSpacing: -0.05,
  },
  notNow: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  notNowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C7C82',
  },
});
