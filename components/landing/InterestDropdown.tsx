import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SAMPLE_INTERESTS, INTEREST_DOMAINS, type SampleInterest } from '@/lib/landing/sampleData';

interface DomainGroup {
  name: string;
  color: string;
  slugs: string[];
}

const DOMAIN_GROUPS: DomainGroup[] = INTEREST_DOMAINS;

function getGroupedInterests(): { domain: DomainGroup; interests: SampleInterest[] }[] {
  const grouped = new Set<string>();
  const groups: { domain: DomainGroup; interests: SampleInterest[] }[] = [];

  for (const domain of DOMAIN_GROUPS) {
    const matching = domain.slugs
      .map((slug) => SAMPLE_INTERESTS.find((i) => i.slug === slug))
      .filter((i): i is SampleInterest => !!i);
    if (matching.length > 0) {
      groups.push({ domain, interests: matching });
      matching.forEach((i) => grouped.add(i.slug));
    }
  }

  // Ungrouped interests
  const ungrouped = SAMPLE_INTERESTS.filter((i) => !grouped.has(i.slug));
  if (ungrouped.length > 0) {
    groups.push({ domain: { name: 'Other', color: '#6B7280', slugs: [] }, interests: ungrouped });
  }

  return groups;
}

interface InterestDropdownProps {
  currentSlug?: string;
}

export function InterestDropdown({ currentSlug }: InterestDropdownProps) {
  const [open, setOpen] = useState(false);
  const current = SAMPLE_INTERESTS.find((i) => i.slug === currentSlug);
  const groups = getGroupedInterests();

  const handleSelect = (slug: string) => {
    setOpen(false);
    router.push(`/${slug}` as any);
  };

  const renderInterestItem = (interest: SampleInterest, itemStyle: any, textStyle: any) => (
    <TouchableOpacity
      key={interest.slug}
      style={[itemStyle, interest.slug === currentSlug && styles.dropdownItemActive]}
      onPress={() => handleSelect(interest.slug)}
    >
      <Ionicons name={(interest.icon + '-outline') as any} size={18} color={interest.color} />
      <Text style={textStyle}>{interest.name}</Text>
    </TouchableOpacity>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity style={styles.trigger} onPress={() => setOpen(!open)}>
          {current && (
            <Ionicons name={(current.icon + '-outline') as any} size={16} color={current.color} />
          )}
          <Text style={styles.triggerText}>{current?.name ?? 'Interests'}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {open && (
          <>
            <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
            <ScrollView style={styles.dropdown} showsVerticalScrollIndicator={false}>
              {groups.map((group, idx) => (
                <View key={group.domain.name}>
                  {idx > 0 && <View style={styles.domainDivider} />}
                  <View style={styles.domainHeaderRow}>
                    <View style={[styles.domainAccent, { backgroundColor: group.domain.color }]} />
                    <Text style={styles.domainLabel}>{group.domain.name}</Text>
                  </View>
                  {group.interests.map((interest) =>
                    renderInterestItem(interest, styles.dropdownItem, styles.dropdownText)
                  )}
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    );
  }

  // Native: use Modal
  return (
    <View>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>{current?.name ?? 'Interests'}</Text>
        <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Interest</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {groups.map((group, idx) => (
                <View key={group.domain.name}>
                  {idx > 0 && <View style={styles.modalDomainDivider} />}
                  <View style={styles.domainHeaderRow}>
                    <View style={[styles.domainAccent, { backgroundColor: group.domain.color }]} />
                    <Text style={styles.domainLabel}>{group.domain.name}</Text>
                  </View>
                  {group.interests.map((interest) => (
                    <TouchableOpacity
                      key={interest.slug}
                      style={styles.modalItem}
                      onPress={() => handleSelect(interest.slug)}
                    >
                      <Ionicons name={(interest.icon + '-outline') as any} size={22} color={interest.color} />
                      <Text style={styles.modalItemText}>{interest.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 200,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backdrop: {
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      } as any,
    }),
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 220,
    maxHeight: 420,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      } as any,
    }),
  },

  // Domain header
  domainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  domainAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  domainLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  domainDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 12,
    marginVertical: 2,
  },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  dropdownItemActive: {
    backgroundColor: '#F3F4F6',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },

  // Native modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: 280,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalDomainDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
});
