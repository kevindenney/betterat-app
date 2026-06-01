/**
 * Create Fleet — reachable entry from the /fleet hub.
 *
 * A fleet is the lightweight social group primitive (sailing vernacular).
 * The creator becomes the 'owner' member; from the roster they can invite
 * sailors and promote a co-leader to 'captain' (the admin-equivalent role).
 *
 * Kept deliberately minimal: name is the only required field. Region,
 * visibility, and a WhatsApp link are optional niceties most fleets fill
 * in later.
 */

import React, { useCallback, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { FleetDiscoveryService } from '@/services/FleetDiscoveryService';
import { TUFTE_BACKGROUND } from '@/components/cards/constants';

type Visibility = 'public' | 'private' | 'club';

const COLORS = {
  background: TUFTE_BACKGROUND,
  surface: '#FFFFFF',
  text: '#1C1C1E',
  secondaryText: '#6B7280',
  tertiaryText: '#9CA3AF',
  hairline: '#E5E7EB',
  accent: '#007AFF',
  accentSoft: 'rgba(0, 122, 255, 0.10)',
  placeholder: '#9CA3AF',
};

const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone can find and join' },
  { value: 'private', label: 'Private', hint: 'Invite only' },
  { value: 'club', label: 'Club', hint: 'Members of your club' },
];

export default function CreateFleetScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [creating, setCreating] = useState(false);

  const canSubmit = name.trim().length > 0 && !creating;

  const handleCreate = useCallback(async () => {
    if (!user?.id) {
      showAlert('Sign in required', 'Please sign in to create a fleet.');
      return;
    }
    if (!name.trim()) {
      showAlert('Name required', 'Give your fleet a name.');
      return;
    }

    setCreating(true);
    try {
      const fleet = await FleetDiscoveryService.createFleet(user.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        region: region.trim() || undefined,
        whatsapp_link: whatsappLink.trim() || undefined,
        visibility,
      });

      if (!fleet) {
        showAlert('Could not create', 'Something went wrong. Please try again.');
        return;
      }

      // Land on the new fleet's roster so the next step (inviting) is
      // one tap away.
      router.replace({
        pathname: '/(tabs)/fleet/members',
        params: { fleetId: fleet.id, fleetName: fleet.name },
      });
    } catch {
      showAlert('Could not create', 'Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [user?.id, name, description, region, whatsappLink, visibility, router]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
          <Text style={styles.headerLink}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New fleet</Text>
        <Pressable
          onPress={handleCreate}
          hitSlop={8}
          disabled={!canSubmit}
          style={styles.headerSide}
        >
          {creating ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Text style={[styles.headerLink, styles.headerLinkRight, !canSubmit && styles.headerLinkDisabled]}>
              Create
            </Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Hong Kong Impala Fleet"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's this fleet for?"
            placeholderTextColor={COLORS.placeholder}
            style={[styles.input, styles.inputMultiline]}
            multiline
          />

          <Text style={styles.fieldLabel}>REGION</Text>
          <TextInput
            value={region}
            onChangeText={setRegion}
            placeholder="Hong Kong"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>WHATSAPP LINK (OPTIONAL)</Text>
          <TextInput
            value={whatsappLink}
            onChangeText={setWhatsappLink}
            placeholder="https://chat.whatsapp.com/…"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.fieldLabel}>VISIBILITY</Text>
          <View style={styles.visibilityGroup}>
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = visibility === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setVisibility(opt.value)}
                  style={[styles.visibilityRow, active && styles.visibilityRowActive]}
                >
                  <View style={styles.visibilityText}>
                    <Text style={[styles.visibilityLabel, active && styles.visibilityLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.visibilityHint}>{opt.hint}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.footnote}>
            You'll be the owner. Invite sailors and promote a co-captain once the fleet exists.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
    backgroundColor: COLORS.background,
  },
  headerSide: { minWidth: 60 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  headerLink: { fontSize: 16, color: COLORS.accent },
  headerLinkRight: { textAlign: 'right', fontWeight: '600' },
  headerLinkDisabled: { color: COLORS.tertiaryText },
  content: { padding: 16, paddingBottom: 48 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondaryText,
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  visibilityGroup: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
    overflow: 'hidden',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  visibilityRowActive: { backgroundColor: COLORS.accentSoft },
  visibilityText: { flex: 1 },
  visibilityLabel: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  visibilityLabelActive: { color: COLORS.accent },
  visibilityHint: { fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.tertiaryText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  footnote: {
    fontSize: 13,
    color: COLORS.secondaryText,
    lineHeight: 19,
    marginTop: 24,
    paddingHorizontal: 4,
  },
});
