/**
 * BlueprintCoAuthorSheet
 *
 * Adds an existing org member as a co-author credit on a Studio blueprint.
 * Co-authors are cover credits and author collaborators; inviting new people
 * to the org stays in the admin People invite flow.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAddBlueprintCoAuthor } from '@/hooks/useBlueprintEditor';
import { supabase } from '@/services/supabase';
import { useAdminPeople, type AdminPersonRow } from '@/hooks/useAdminPeople';
import type { BlueprintAuthor } from '@/hooks/useStudioBlueprint';

export interface BlueprintCoAuthorSheetProps {
  visible: boolean;
  blueprintId: string;
  orgId: string | null;
  existingAuthors: BlueprintAuthor[];
  onClose: () => void;
}

const GLOBAL_GRADIENTS: [string, string][] = [
  ['#5A8DB8', '#4E6A85'],
  ['#28406B', '#4E6A85'],
  ['#7A6A8E', '#4E6A85'],
  ['#6E8B5A', '#5A8B8B'],
];

function initialsFor(nameOrEmail: string): string {
  const name = nameOrEmail.trim();
  if (!name) return '?';
  const tokens = (name.includes('@') ? name.split('@')[0].replace(/[._-]+/g, ' ') : name)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return '?';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

function gradientFor(seedKey: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  return GLOBAL_GRADIENTS[hash % GLOBAL_GRADIENTS.length];
}

function coAuthorErrorMessage(err: unknown): string {
  const record = err && typeof err === 'object' ? (err as Record<string, unknown>) : null;
  const message =
    err instanceof Error
      ? err.message
      : typeof record?.message === 'string'
      ? record.message
      : 'Could not add co-author.';
  const code = typeof record?.code === 'string' ? record.code : '';
  const details = typeof record?.details === 'string' ? record.details : '';
  const combined = `${code} ${message} ${details}`.toLowerCase();
  if (
    combined.includes('blueprint_authors') ||
    combined.includes('42p01') ||
    combined.includes('schema cache')
  ) {
    return 'Co-author storage is not migrated yet. Apply the latest Supabase migration, then try again.';
  }
  if (combined.includes('foreign key') || combined.includes('23503')) {
    return 'That user profile is not eligible for co-author credit yet.';
  }
  if (combined.includes('row-level security') || combined.includes('42501')) {
    return 'You do not have permission to add a co-author to this blueprint.';
  }
  return message;
}

export function BlueprintCoAuthorSheet({
  visible,
  blueprintId,
  orgId,
  existingAuthors,
  onClose,
}: BlueprintCoAuthorSheetProps) {
  const { rows, loading } = useAdminPeople(orgId ?? '');
  const addCoAuthor = useAddBlueprintCoAuthor(blueprintId, orgId);

  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const trimmedSearch = search.trim();
  const globalSearchEnabled = !orgId && trimmedSearch.length >= 2;

  const { data: globalRows = [], isLoading: globalLoading } = useQuery({
    queryKey: ['blueprint-co-author-user-search', trimmedSearch],
    enabled: globalSearchEnabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AdminPersonRow[]> => {
      const q = trimmedSearch.replace(/[%(),]/g, ' ').trim();
      if (q.length < 2) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as { id: string; full_name: string | null; email: string | null }[])
        .map((user) => {
          const name = user.full_name?.trim() || user.email || 'Unknown';
          return {
            id: user.id,
            userId: user.id,
            name,
            email: user.email ?? '',
            initials: initialsFor(name),
            gradient: gradientFor(user.id),
            roles: ['co-author'],
            cohortLabel: null,
            lastActiveLabel: '',
            status: 'active',
            source: null,
            isYou: false,
          };
        });
    },
  });

  const existing = useMemo(
    () => new Set(existingAuthors.map((author) => author.user_id)),
    [existingAuthors],
  );

  const candidates = useMemo(() => {
    const sourceRows = orgId ? rows : globalRows;
    const pool = sourceRows.filter((row) => row.status === 'active' && !existing.has(row.userId));
    if (!search.trim()) return pool;
    const q = search.toLowerCase();
    return pool.filter(
      (row) => row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q),
    );
  }, [existing, globalRows, orgId, rows, search]);

  const handleAdd = async (userId: string) => {
    setError(null);
    try {
      await addCoAuthor.mutateAsync(userId);
      setSearch('');
      onClose();
    } catch (err) {
      setError(coAuthorErrorMessage(err));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.scrim}>
        <Pressable style={s.scrimPress} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.title}>Add co-author</Text>
              <Text style={s.sub} numberOfLines={1}>
                {orgId
                  ? 'Credit an existing workspace member on this blueprint.'
                  : 'Credit an existing BetterAt user on this blueprint.'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={s.xBtn}>
              <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.45)" />
            </Pressable>
          </View>

          <View style={s.controls}>
            <View style={s.searchInput}>
              <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or email"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                style={s.searchField}
              />
            </View>
          </View>

          {error ? (
            <View style={s.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#FF3B30" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
            {!orgId && trimmedSearch.length < 2 ? (
              <View style={s.empty}>
                <Ionicons name="search-outline" size={28} color="rgba(60, 60, 67, 0.45)" />
                <Text style={s.emptyTitle}>Search users</Text>
                <Text style={s.emptyBody}>
                  Type at least two characters to find an existing BetterAt user.
                </Text>
              </View>
            ) : loading || globalLoading ? (
              <Text style={s.muted}>Loading people...</Text>
            ) : candidates.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="person-add-outline" size={28} color="rgba(60, 60, 67, 0.45)" />
                <Text style={s.emptyTitle}>{search ? 'No matches' : 'No co-authors to add'}</Text>
                <Text style={s.emptyBody}>
                  {search
                    ? `Nothing matches "${search}".`
                    : 'Everyone available is already credited, or there are no active workspace members yet.'}
                </Text>
              </View>
            ) : (
              candidates.map((person) => (
                <Pressable
                  key={person.userId}
                  onPress={() => handleAdd(person.userId)}
                  disabled={addCoAuthor.isPending}
                  style={s.row}
                >
                  <View style={[s.avatar, { backgroundColor: person.gradient[0] }]}>
                    <Text style={s.avatarText}>{person.initials}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowName} numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {person.email || person.roles.join(', ')}
                    </Text>
                  </View>
                  <View style={s.addPill}>
                    <Ionicons name="add" size={13} color="#6B5BBF" />
                    <Text style={s.addText}>
                      {addCoAuthor.isPending ? 'Adding' : 'Add'}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 120,
  },
  scrimPress: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  sheet: {
    width: 520,
    maxWidth: '94%',
    maxHeight: 680,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...({ boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)' } as any),
  },
  head: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  sub: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },
  xBtn: { padding: 4 },
  controls: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
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
    fontSize: 13,
    color: '#1C1C1E',
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  errorRow: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: { flex: 1, fontSize: 12, color: '#FF3B30', fontWeight: '600' },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyInner: { paddingHorizontal: 20, paddingVertical: 16, gap: 6 },
  muted: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', paddingVertical: 24, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  rowName: { fontSize: 13.5, fontWeight: '700', color: '#1C1C1E' },
  rowMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(107, 91, 191, 0.12)',
  },
  addText: { fontSize: 12, fontWeight: '700', color: '#6B5BBF' },
  empty: { alignItems: 'center', paddingVertical: 38, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginTop: 4 },
  emptyBody: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 320,
  },
});
