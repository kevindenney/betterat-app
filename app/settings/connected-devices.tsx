import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useInterest } from '@/hooks/useInterest';

interface DeviceTypeProps {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  description: string;
  comingSoon?: boolean;
}

const DeviceType: React.FC<DeviceTypeProps> = ({
  icon,
  name,
  description,
  comingSoon = true,
}) => (
  <View style={styles.deviceItem}>
    <View style={styles.deviceIcon}>
      <Ionicons name={icon} size={24} color="#3B82F6" />
    </View>
    <View style={styles.deviceContent}>
      <View style={styles.deviceHeader}>
        <Text style={styles.deviceName}>{name}</Text>
        {comingSoon && (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Planned</Text>
          </View>
        )}
      </View>
      <Text style={styles.deviceDescription}>{description}</Text>
    </View>
  </View>
);

// Devices that make sense for any interest — kept persona-neutral.
const UNIVERSAL_DEVICES: DeviceTypeProps[] = [
  {
    icon: 'navigate-outline',
    name: 'GPS Devices',
    description: 'Connect GPS units for precise location and route tracking.',
  },
  {
    icon: 'heart-outline',
    name: 'Heart Rate Monitors',
    description: 'Track physical exertion for performance analysis.',
  },
  {
    icon: 'watch-outline',
    name: 'Smart Watches',
    description: 'Apple Watch, Garmin, and other wearables for activity tracking.',
  },
];

// Sailing-specific instruments — only shown for the sail-racing interest so a
// nurse or entrepreneur isn't offered "Boat speed and VMG".
const SAILING_DEVICES: DeviceTypeProps[] = [
  {
    icon: 'speedometer-outline',
    name: 'Speed Sensors',
    description: 'Boat speed and VMG data from onboard instruments.',
  },
  {
    icon: 'compass-outline',
    name: 'Wind Instruments',
    description: 'Real-time wind speed and direction from masthead sensors.',
  },
  {
    icon: 'cellular-outline',
    name: 'AIS Transponders',
    description: 'Automatic Identification System data for fleet tracking.',
  },
];

export default function ConnectedDevicesScreen() {
  const router = useRouter();
  const { currentInterest } = useInterest();
  const isSailing = currentInterest?.slug === 'sail-racing';
  const devices = isSailing
    ? [...UNIVERSAL_DEVICES, ...SAILING_DEVICES]
    : UNIVERSAL_DEVICES;
  const heroDescription = isSailing
    ? 'Connect external sensors and devices to enhance your sailing data. Track performance metrics, record race data, and gain deeper insights.'
    : 'Connect external sensors and wearables to enrich your data. Track performance metrics and gain deeper insights.';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Connected Devices',
          headerShown: true,
          headerBackTitle: 'Settings',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="chevron-back" size={26} color={IOS_COLORS.systemBlue} />
              <Text style={{ color: IOS_COLORS.systemBlue, fontSize: 17 }}>Settings</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <Ionicons name="bluetooth" size={48} color="#3B82F6" />
          </View>
          <Text style={styles.heroTitle}>Device Integrations</Text>
          <Text style={styles.heroDescription}>{heroDescription}</Text>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>SUPPORTED DEVICES</Text>
        </View>

        {/* Device Types */}
        <View style={styles.devicesContainer}>
          {devices.map((device, index) => (
            <DeviceType key={index} {...device} />
          ))}
        </View>

        {/* Interest CTA */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaTitle}>Interested in device integrations?</Text>
          <Text style={styles.ctaDescription}>
            We're actively developing sensor integrations. Let us know which devices
            matter most to you.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() =>
              Linking.openURL(
                'mailto:support@regattaflow.com?subject=Device%20Integration%20Feedback&body=I%27d%20like%20to%20request%20support%20for%20these%20devices%3A%20'
              )
            }
          >
            <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
            <Text style={styles.ctaButtonText}>Share Feedback</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  heroIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  sectionHeader: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  devicesContainer: {
    backgroundColor: '#FFFFFF',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceContent: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  comingSoonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  deviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  ctaBox: {
    backgroundColor: '#EBF5FF',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 14,
    color: '#3B82F6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
