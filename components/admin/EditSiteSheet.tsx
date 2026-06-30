/**
 * Edit Site sheet — the primary "how do I modify a site?" surface.
 *
 * Launched from the Sites list "…" menu and the site detail header. Edits the
 * curated fields actually surfaced today (name, kind, healthcare flag, city /
 * role / curated label) plus the pin coordinates. Writes through
 * useAdminSiteMutations.update → admin_update_site (SECURITY DEFINER, gated by
 * is_org_admin_member), which whitelists columns and enforces the healthcare
 * site-level precision rule server-side.
 *
 * Two load-bearing guardrails:
 *  - Healthcare sites snap to site-level precision; the coordinate editor says
 *    so and the server rounds regardless.
 *  - Moving the pin drags every located step with it, so when coords change we
 *    surface the located-step count before the admin confirms.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudioButton } from '@/components/studio/StudioShell';
import { useAdminSiteMutations, SitePatch } from '@/hooks/useAdminSiteMutations';
import type { AdminOrgSite } from '@/hooks/useAdminOrgSites';

const KIND_OPTIONS = [
  { value: 'club', label: 'Club' },
  { value: 'racing_area', label: 'Racing area' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'sim_lab', label: 'Sim lab' },
  { value: 'course', label: 'Course' },
  { value: 'market', label: 'Market' },
  { value: 'place', label: 'Place' },
];

export interface EditSiteSheetProps {
  visible: boolean;
  orgId: string;
  site: AdminOrgSite | null;
  /** Located steps that move with the pin — drives the coord-change guardrail. */
  locatedStepCount?: number;
  onClose: () => void;
  onSaved?: (poiId: string) => void;
}

function metaStr(site: AdminOrgSite | null, key: string): string {
  const v = site?.metadata?.[key];
  return typeof v === 'string' ? v : '';
}

export function EditSiteSheet({
  visible,
  orgId,
  site,
  locatedStepCount = 0,
  onClose,
  onSaved,
}: EditSiteSheetProps) {
  const { update } = useAdminSiteMutations(orgId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('place');
  const [isHealthcare, setIsHealthcare] = useState(false);
  const [city, setCity] = useState('');
  const [role, setRole] = useState('');
  const [curatedLabel, setCuratedLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Hydrate when the target site changes (sheet is reused across rows).
  const hydrateKey = site?.id ?? null;
  React.useEffect(() => {
    if (!site) return;
    setName(site.name);
    setKind(site.kind || 'place');
    setIsHealthcare(site.is_healthcare_site);
    setCity(metaStr(site, 'city'));
    setRole(metaStr(site, 'partner_role') || metaStr(site, 'role'));
    setCuratedLabel(metaStr(site, 'curated_label'));
    setLat(String(site.lat));
    setLng(String(site.lng));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateKey]);

  const coordsChanged = useMemo(() => {
    if (!site) return false;
    const pLat = parseFloat(lat);
    const pLng = parseFloat(lng);
    return (
      (Number.isFinite(pLat) && pLat !== site.lat) ||
      (Number.isFinite(pLng) && pLng !== site.lng)
    );
  }, [site, lat, lng]);

  function handleClose() {
    if (update.isPending) return;
    onClose();
  }

  function handleSubmit() {
    if (!site) return;
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the site a name');
      return;
    }
    const pLat = parseFloat(lat);
    const pLng = parseFloat(lng);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) {
      setError('Coordinates must be valid numbers');
      return;
    }

    const patch: SitePatch = {
      name: trimmed,
      kind,
      is_healthcare_site: isHealthcare,
      city: city.trim(),
      partner_role: role.trim(),
      curated_label: curatedLabel.trim(),
      lat: pLat,
      lng: pLng,
    };

    update.mutate(
      { poiId: site.id, patch },
      {
        onSuccess: (poiId) => {
          onSaved?.(poiId);
          onClose();
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Could not save the site'),
      },
    );
  }

  if (!visible || !site) return null;

  return (
    <View style={s.scrim} pointerEvents="auto">
      <Pressable style={s.scrimPress} onPress={handleClose} />
      <View style={s.sheet}>
        <View style={s.head}>
          <View style={s.headText}>
            <Text style={s.title}>Edit site</Text>
            <Text style={s.note}>Changes update the Atlas pin and every step located here</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          <Field label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Site name"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.input}
            />
          </Field>

          <Field label="Kind">
            <View style={s.kindWrap}>
              {KIND_OPTIONS.map((k) => {
                const on = kind === k.value;
                return (
                  <Pressable
                    key={k.value}
                    onPress={() => setKind(k.value)}
                    style={[s.kindChip, on && s.kindChipOn]}
                  >
                    <Text style={[s.kindChipText, on && s.kindChipTextOn]}>{k.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <View style={s.twoColRow}>
            <Field label="City" flex={1}>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Baltimore"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                style={s.input}
              />
            </Field>
            <Field label="Role / partner role" flex={1}>
              <TextInput
                value={role}
                onChangeText={setRole}
                placeholder="e.g. clinical partner"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                style={s.input}
              />
            </Field>
          </View>

          <Field label="Curated label (optional)">
            <TextInput
              value={curatedLabel}
              onChangeText={setCuratedLabel}
              placeholder="Display label shown above the kind"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.input}
            />
          </Field>

          <Pressable style={s.toggleRow} onPress={() => setIsHealthcare((v) => !v)}>
            <View style={[s.toggle, isHealthcare ? s.toggleOn : s.toggleOff]}>
              <View style={[s.toggleKnob, isHealthcare ? s.toggleKnobOn : s.toggleKnobOff]} />
            </View>
            <View style={s.toggleText}>
              <Text style={s.toggleTitle}>Healthcare site</Text>
              <Text style={s.toggleBody}>
                {isHealthcare
                  ? 'Coordinates snap to site-level precision — exact coords are never stored.'
                  : 'Off for open-precision places sailors can pin to exact coordinates.'}
              </Text>
            </View>
          </Pressable>

          <View style={s.twoColRow}>
            <Field label="Latitude" flex={1}>
              <TextInput
                value={lat}
                onChangeText={setLat}
                placeholder="0.0000"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                keyboardType="numbers-and-punctuation"
                style={s.input}
              />
            </Field>
            <Field label="Longitude" flex={1}>
              <TextInput
                value={lng}
                onChangeText={setLng}
                placeholder="0.0000"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                keyboardType="numbers-and-punctuation"
                style={s.input}
              />
            </Field>
          </View>
          {isHealthcare ? (
            <Text style={s.helper}>
              Healthcare coordinates are rounded to site-level granularity on save.
            </Text>
          ) : null}

          {coordsChanged && locatedStepCount > 0 ? (
            <View style={s.guardrail}>
              <Ionicons name="warning-outline" size={15} color="#B8855A" />
              <Text style={s.guardrailText}>
                {locatedStepCount} located {locatedStepCount === 1 ? 'step' : 'steps'} will move with
                this pin on the Atlas.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={s.footer}>
          {error ? (
            <Text style={s.error} numberOfLines={2}>
              {error}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={s.footerActions}>
            <StudioButton variant="ghost" label="Cancel" onPress={handleClose} />
            <StudioButton
              variant="primary"
              accent="navy"
              icon="checkmark"
              label={update.isPending ? 'Saving…' : 'Save changes'}
              onPress={handleSubmit}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: number;
}) {
  return (
    <View style={[s.field, flex !== undefined && { flex }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  scrimPress: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  sheet: {
    width: 560,
    maxWidth: '92%',
    maxHeight: 720,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...({ boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)' } as any),
  },
  head: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  note: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 22, paddingVertical: 18, gap: 16 },

  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    fontSize: 13.5,
    color: '#1C1C1E',
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  helper: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16, marginTop: -4 },

  twoColRow: { flexDirection: 'row', gap: 14 },

  kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  kindChipOn: { backgroundColor: 'rgba(40, 64, 107, 0.10)', borderColor: 'rgba(40, 64, 107, 0.30)' },
  kindChipText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  kindChipTextOn: { color: '#28406B', fontWeight: '600' },

  toggleRow: {
    padding: 14,
    backgroundColor: '#EFEFF4',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  toggleText: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  toggleBody: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16, marginTop: 3 },
  toggle: { width: 36, height: 22, borderRadius: 12, padding: 2, marginTop: 2 },
  toggleOn: { backgroundColor: '#B85A66' },
  toggleOff: { backgroundColor: '#D1D1D6' },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    ...({ boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } as any),
  },
  toggleKnobOn: { marginLeft: 14 },
  toggleKnobOff: { marginLeft: 0 },

  guardrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(184, 133, 90, 0.12)',
  },
  guardrailText: { flex: 1, fontSize: 12, color: '#8A5A2B', lineHeight: 17 },

  footer: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  error: { flex: 1, fontSize: 11.5, color: '#FF3B30', fontWeight: '500' },
});
