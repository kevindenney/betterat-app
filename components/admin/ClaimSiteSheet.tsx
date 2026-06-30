/**
 * Claim Site sheet — bring a place under the org's curation.
 *
 * Two modes share one sheet:
 *  - Claim existing · search unclaimed atlas_pois (public read) by name/city/
 *    kind, preview, and Claim → admin_claim_site sets claimed_by_org_id.
 *  - Add new · name + kind + coordinates + healthcare toggle →
 *    admin_create_site inserts an org-owned POI (source 'org_admin'). A coarse
 *    near-coincident check warns before creating a duplicate pin.
 *
 * Both writes go through useAdminSiteMutations (SECURITY DEFINER RPCs gated by
 * is_org_admin_member); atlas_pois RLS won't let a member mutate shared rows.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudioButton } from '@/components/studio/StudioShell';
import { supabase } from '@/services/supabase';
import { useAdminSiteMutations } from '@/hooks/useAdminSiteMutations';

const KIND_OPTIONS = [
  { value: 'club', label: 'Club' },
  { value: 'racing_area', label: 'Racing area' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'sim_lab', label: 'Sim lab' },
  { value: 'course', label: 'Course' },
  { value: 'market', label: 'Market' },
  { value: 'place', label: 'Place' },
];

interface UnclaimedPoi {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  metadata: Record<string, unknown> | null;
}

export interface ClaimSiteSheetProps {
  visible: boolean;
  orgId: string;
  onClose: () => void;
  onDone?: (poiId: string) => void;
}

type Mode = 'claim' | 'create';

export function ClaimSiteSheet({ visible, orgId, onClose, onDone }: ClaimSiteSheetProps) {
  const { claim, create } = useAdminSiteMutations(orgId);
  const [mode, setMode] = useState<Mode>('claim');
  const [error, setError] = useState<string | null>(null);

  // claim-mode search
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UnclaimedPoi[]>([]);
  const [searching, setSearching] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // create-mode form
  const [name, setName] = useState('');
  const [kind, setKind] = useState('place');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isHealthcare, setIsHealthcare] = useState(false);
  const [nearbyCount, setNearbyCount] = useState(0);

  function resetAll() {
    setMode('claim');
    setError(null);
    setSearch('');
    setResults([]);
    setSearching(false);
    setClaimingId(null);
    setName('');
    setKind('place');
    setLat('');
    setLng('');
    setIsHealthcare(false);
    setNearbyCount(0);
  }

  function handleClose() {
    if (claim.isPending || create.isPending) return;
    resetAll();
    onClose();
  }

  // Debounced unclaimed-POI search.
  useEffect(() => {
    if (!visible || mode !== 'claim') return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase
        .from('atlas_pois')
        .select('id, name, kind, lat, lng, metadata')
        .is('claimed_by_org_id', null)
        .eq('is_active', true)
        .ilike('name', `%${q}%`)
        .order('name', { ascending: true })
        .limit(20);
      if (cancelled) return;
      setSearching(false);
      if (err) {
        setError('Could not search places');
        return;
      }
      setResults((data ?? []) as UnclaimedPoi[]);
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, mode, search]);

  // Coarse near-coincident check for create mode (~0.005° ≈ 550m box).
  const pLat = parseFloat(lat);
  const pLng = parseFloat(lng);
  const coordsValid = Number.isFinite(pLat) && Number.isFinite(pLng);
  useEffect(() => {
    if (!visible || mode !== 'create' || !coordsValid) {
      setNearbyCount(0);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const d = 0.005;
      const { count } = await supabase
        .from('atlas_pois')
        .select('id', { count: 'exact', head: true })
        .gte('lat', pLat - d)
        .lte('lat', pLat + d)
        .gte('lng', pLng - d)
        .lte('lng', pLng + d);
      if (!cancelled) setNearbyCount(count ?? 0);
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, mode, coordsValid, pLat, pLng]);

  function handleClaim(poi: UnclaimedPoi) {
    setError(null);
    setClaimingId(poi.id);
    claim.mutate(poi.id, {
      onSuccess: (poiId) => {
        setClaimingId(null);
        onDone?.(poiId);
        resetAll();
        onClose();
      },
      onError: (e) => {
        setClaimingId(null);
        setError(e instanceof Error ? e.message : 'Could not claim this place');
      },
    });
  }

  function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the place a name');
      return;
    }
    if (!coordsValid) {
      setError('Enter valid coordinates for the pin');
      return;
    }
    create.mutate(
      { name: trimmed, kind, lat: pLat, lng: pLng, isHealthcare },
      {
        onSuccess: (poiId) => {
          onDone?.(poiId);
          resetAll();
          onClose();
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Could not create the place'),
      },
    );
  }

  const emptyHint = useMemo(() => {
    if (search.trim().length < 2) return 'Type at least 2 characters to search unclaimed places.';
    if (searching) return null;
    return `No unclaimed places match "${search.trim()}". Try "Add a new place".`;
  }, [search, searching]);

  if (!visible) return null;

  return (
    <View style={s.scrim} pointerEvents="auto">
      <Pressable style={s.scrimPress} onPress={handleClose} />
      <View style={s.sheet}>
        <View style={s.head}>
          <View style={s.headText}>
            <Text style={s.title}>Claim a place</Text>
            <Text style={s.note}>Bring a place under your organization’s curation</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <View style={s.modeRow}>
          <ModeTab label="Claim existing" active={mode === 'claim'} onPress={() => setMode('claim')} />
          <ModeTab label="Add a new place" active={mode === 'create'} onPress={() => setMode('create')} />
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          {mode === 'claim' ? (
            <>
              <View style={s.searchInput}>
                <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search unclaimed places by name…"
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  style={s.searchField}
                  autoFocus
                />
                {searching ? <ActivityIndicator size="small" color="rgba(60, 60, 67, 0.4)" /> : null}
              </View>

              {results.length === 0 ? (
                emptyHint ? <Text style={s.emptyHint}>{emptyHint}</Text> : null
              ) : (
                results.map((poi) => {
                  const city = typeof poi.metadata?.city === 'string' ? poi.metadata.city : null;
                  return (
                    <View key={poi.id} style={s.resultRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.resultName}>{poi.name}</Text>
                        <Text style={s.resultMeta}>
                          {prettyKind(poi.kind)}
                          {city ? ` · ${city}` : ''}
                          {' · '}
                          {poi.lat.toFixed(3)}°, {poi.lng.toFixed(3)}°
                        </Text>
                      </View>
                      <StudioButton
                        variant="primary"
                        accent="navy"
                        label={claimingId === poi.id ? 'Claiming…' : 'Claim'}
                        onPress={() => handleClaim(poi)}
                      />
                    </View>
                  );
                })
              )}
            </>
          ) : (
            <>
              <Field label="Name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Pinkard Sim Suite"
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  style={s.input}
                  autoFocus
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

              <Pressable style={s.toggleRow} onPress={() => setIsHealthcare((v) => !v)}>
                <View style={[s.toggle, isHealthcare ? s.toggleOn : s.toggleOff]}>
                  <View style={[s.toggleKnob, isHealthcare ? s.toggleKnobOn : s.toggleKnobOff]} />
                </View>
                <View style={s.toggleText}>
                  <Text style={s.toggleTitle}>Healthcare site</Text>
                  <Text style={s.toggleBody}>
                    Snaps coordinates to site-level precision — exact coords are never stored.
                  </Text>
                </View>
              </Pressable>

              {coordsValid && nearbyCount > 0 ? (
                <View style={s.guardrail}>
                  <Ionicons name="warning-outline" size={15} color="#B8855A" />
                  <Text style={s.guardrailText}>
                    {nearbyCount} existing {nearbyCount === 1 ? 'place is' : 'places are'} near these
                    coordinates — check you’re not duplicating a pin.
                  </Text>
                </View>
              ) : null}
            </>
          )}
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
            {mode === 'create' ? (
              <StudioButton
                variant="primary"
                accent="navy"
                icon="add"
                label={create.isPending ? 'Creating…' : 'Create & claim'}
                onPress={handleCreate}
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.modeTab, active && s.modeTabOn]}>
      <Text style={[s.modeTabText, active && s.modeTabTextOn]}>{label}</Text>
    </Pressable>
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

function prettyKind(kind: string): string {
  switch (kind) {
    case 'sim_lab':
      return 'Sim lab';
    case 'racing_area':
      return 'Racing area';
    default:
      return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
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

  modeRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
  },
  modeTabOn: { backgroundColor: 'rgba(40, 64, 107, 0.10)' },
  modeTabText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  modeTabTextOn: { color: '#28406B', fontWeight: '600' },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 22, paddingVertical: 18, gap: 14 },

  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 1,
    fontSize: 13.5,
    color: '#1C1C1E',
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  emptyHint: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 18, paddingVertical: 6 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
  },
  resultName: { fontSize: 13.5, fontWeight: '600', color: '#1C1C1E' },
  resultMeta: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

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
