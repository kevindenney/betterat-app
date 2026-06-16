import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DashboardSection } from '@/components/dashboard/shared';

export default function FleetSettingsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DashboardSection
        title="Your Fleets"
        subtitle="Manage which fleets you participate in"
        showBorder={false}
      >
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(tabs)/fleet/select')}
        >
          <View style={styles.actionIcon}>
            <MaterialCommunityIcons name="sail-boat" size={24} color="#007AFF" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Select Your Fleets</Text>
            <Text style={styles.actionDescription}>
              Choose the Hong Kong sailing classes you participate in
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </DashboardSection>

      <DashboardSection
        title="Fleet Administration"
        subtitle="Manage fleet profile, WhatsApp link, and membership approvals"
      >
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(tabs)/fleet/resources')}
        >
          <View style={styles.actionIcon}>
            <MaterialCommunityIcons name="file-document-edit-outline" size={24} color="#007AFF" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Manage Fleet Resources</Text>
            <Text style={styles.actionDescription}>
              Update fleet docs, links, and shared resources for members.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(tabs)/members')}
        >
          <View style={styles.actionIcon}>
            <MaterialCommunityIcons name="account-key-outline" size={24} color="#007AFF" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Membership & Approvals</Text>
            <Text style={styles.actionDescription}>
              Open the club member workspace to handle roles and pending requests.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </DashboardSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0px 2px',
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  actionDescription: {
    fontSize: 13,
    color: '#64748B',
  },
});
