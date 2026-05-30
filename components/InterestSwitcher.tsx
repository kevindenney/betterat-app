/**
 * InterestSwitcher — dropdown/bottom-sheet for switching the active interest.
 *
 * Shows in the NavigationHeader. Each interest renders its accent color dot,
 * name, and a checkmark for the currently selected interest.
 * Users can browse an interest's catalog page or switch their active interest.
 */

import { useInterest } from '@/providers/InterestProvider'
import type { Interest, DomainWithInterests } from '@/providers/InterestProvider'
import { useAuth } from '@/providers/AuthProvider'
import { router } from 'expo-router'
import { showConfirm } from '@/lib/utils/crossPlatformAlert'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// Imperative opener so other parts of the app (e.g. the guest sample banner)
// can pop the same sheet without prop-drilling. The mounted InterestSwitcher
// registers its setOpen on mount and clears it on unmount.
let externalOpener: (() => void) | null = null
export function openInterestSwitcher() {
  externalOpener?.()
}

/** Group a list of interests by their parent domain, preserving domain order. */
function groupByDomain(
  interests: Interest[],
  groupedInterests: DomainWithInterests[],
): { domain: Interest | null; interests: Interest[] }[] {
  const slugSet = new Set(interests.map((i) => i.slug))
  const groups: { domain: Interest | null; interests: Interest[] }[] = []

  for (const group of groupedInterests) {
    const matching = group.interests.filter((i) => slugSet.has(i.slug))
    if (matching.length > 0) {
      groups.push({ domain: group.domain, interests: matching })
    }
  }

  // Any interests not matched to a domain group
  const grouped = new Set(groups.flatMap((g) => g.interests.map((i) => i.slug)))
  const ungrouped = interests.filter((i) => !grouped.has(i.slug))
  if (ungrouped.length > 0) {
    groups.push({ domain: null, interests: ungrouped })
  }

  return groups
}

export function InterestSwitcher({ headless = false }: { headless?: boolean } = {}) {
  const { currentInterest, userInterests, groupedInterests, switchInterest, removeInterest, loading } = useInterest()
  const { signedIn } = useAuth()
  const [open, setOpen] = useState(false)

  // Register the imperative opener so callers anywhere in the tree can pop the sheet
  useEffect(() => {
    const opener = () => setOpen(true)
    externalOpener = opener
    return () => {
      if (externalOpener === opener) externalOpener = null
    }
  }, [])

  // Group user interests by domain
  const userGroups = useMemo(
    () => groupByDomain(userInterests, groupedInterests),
    [userInterests, groupedInterests],
  )


  if (loading || userInterests.length === 0) return null

  const handleSelect = async (interest: Interest) => {
    if (interest.slug !== currentInterest?.slug) {
      await switchInterest(interest.slug)
    }
    setOpen(false)
  }

  const handleBrowse = (interest: Interest) => {
    setOpen(false)
    router.push(`/${interest.slug}` as any)
  }

  const handleRemove = (interest: Interest) => {
    showConfirm(
      'Remove Interest',
      `Remove ${interest.name} from your interests? You can add it back anytime.`,
      async () => {
        await removeInterest(interest.slug)
      },
    )
  }


  const renderInterestRow = (interest: Interest, isUserSection: boolean) => {
    const isActive = interest.slug === currentInterest?.slug
    if (isUserSection) {
      return (
        <View key={interest.id} style={[styles.row, isActive && styles.rowActive]}>
          <TouchableOpacity
            style={styles.rowMain}
            onPress={() => handleSelect(interest)}
            activeOpacity={0.7}
          >
            <View style={[styles.rowDot, { backgroundColor: interest.accent_color }]} />
            <Text style={[styles.rowLabel, isActive && styles.rowLabelActive]} numberOfLines={1}>
              {interest.name}
            </Text>
            {isActive && <Ionicons name="checkmark" size={18} color="#1F2937" />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => handleBrowse(interest)}
            activeOpacity={0.7}
            accessibilityLabel={`Browse ${interest.name} organizations`}
          >
            <Ionicons name="compass-outline" size={18} color="#6B7280" />
          </TouchableOpacity>
          {!isActive && userInterests.length > 1 && (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemove(interest)}
              activeOpacity={0.7}
              accessibilityLabel={`Remove ${interest.name} from interests`}
            >
              <Ionicons name="close-circle-outline" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        </View>
      )
    }

    return (
      <TouchableOpacity
        key={interest.id}
        style={styles.exploreRow}
        onPress={() => handleBrowse(interest)}
        activeOpacity={0.7}
      >
        <View style={[styles.rowDot, { backgroundColor: interest.accent_color, opacity: 0.6 }]} />
        <Text style={styles.exploreLabel} numberOfLines={1}>{interest.name}</Text>
        <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />
      </TouchableOpacity>
    )
  }

  // Only show domain headers when there are multiple domains
  const showDomainHeaders = userGroups.length > 1

  return (
    <>
      {/* Trigger pill — omitted in headless mode so a globally-mounted
          instance can serve openInterestSwitcher() callers from anywhere
          (e.g. CanvasTopBar on the Practice tab, where the global
          NavigationHeader is hidden). */}
      {!headless ? (
        <TouchableOpacity
          style={styles.pill}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Current interest: ${currentInterest?.name ?? 'None'}. Tap to switch.`}
        >
          <Text style={styles.pillText} numberOfLines={1}>
            {currentInterest?.name ?? 'Interest'}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#6B7280" />
        </TouchableOpacity>
      ) : null}

      {/* Dropdown / Bottom Sheet */}
      <Modal
        visible={open}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {!signedIn ? (
                <>
                  <Text style={styles.sheetTitle}>Switch Interest</Text>
                  <Text style={styles.guestDescription}>
                    Pick a different interest to explore. You can add more after signing up.
                  </Text>

                  {/* Current interest — highlighted at top */}
                  {currentInterest && (
                    <View style={styles.guestCurrentRow}>
                      <View style={[styles.rowDot, { backgroundColor: currentInterest.accent_color }]} />
                      <Text style={styles.guestCurrentLabel} numberOfLines={1}>
                        {currentInterest.name}
                      </Text>
                      <View style={styles.guestCurrentBadge}>
                        <Text style={styles.guestCurrentBadgeText}>Current</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.divider} />

                  {/* All interests grouped by domain */}
                  {userGroups.map((group) => (
                    <View key={group.domain?.slug ?? 'ungrouped'}>
                      {group.domain && (
                        <Text style={styles.domainHeader}>{group.domain.name}</Text>
                      )}
                      {group.interests
                        .filter((i) => i.slug !== currentInterest?.slug)
                        .map((interest) => (
                          <TouchableOpacity
                            key={interest.id}
                            style={styles.guestSwitchRow}
                            onPress={() => handleSelect(interest)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.rowDot, { backgroundColor: interest.accent_color }]} />
                            <Text style={styles.rowLabel} numberOfLines={1}>
                              {interest.name}
                            </Text>
                            <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        ))}
                    </View>
                  ))}

                  <View style={styles.divider} />

                  <TouchableOpacity
                    style={styles.signUpBtn}
                    onPress={() => {
                      setOpen(false)
                      router.push('/(auth)/signup')
                    }}
                  >
                    <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.signUpBtnText}>Sign up to customize</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setOpen(false)}
                  >
                    <Text style={styles.closeBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle}>Your Interests</Text>

                  {userGroups.map((group) => (
                    <View key={group.domain?.slug ?? 'ungrouped'}>
                      {showDomainHeaders && group.domain && (
                        <Text style={styles.domainHeader}>{group.domain.name}</Text>
                      )}
                      {group.interests.map((interest) => renderInterestRow(interest, true))}
                    </View>
                  ))}

                  {/* Add interest button */}
                  <View style={styles.divider} />

                  <TouchableOpacity
                    style={styles.exploreAllBtn}
                    onPress={() => {
                      setOpen(false)
                      router.push({ pathname: '/(tabs)/library', params: { zone: 'interests' } })
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#4338CA" />
                    <Text style={styles.exploreAllText}>Add Interest</Text>
                  </TouchableOpacity>


                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setOpen(false)}
                  >
                    <Text style={styles.closeBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  // Trigger pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    maxWidth: 120,
  },

  // Backdrop + sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },

  // Interest row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
  },
  rowActive: {
    backgroundColor: '#F9FAFB',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  rowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  rowLabelActive: {
    fontWeight: '700',
    color: '#1F2937',
  },
  browseBtn: {
    padding: 10,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  removeBtn: {
    padding: 6,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },

  // Domain header
  domainHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
  },

  // Explore section
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  exploreLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },

  // Explore all button
  exploreAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  exploreAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338CA',
  },

  // Guest state
  guestDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  guestCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F0F4FF',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.15)',
  },
  guestCurrentLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  guestCurrentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  guestCurrentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  guestSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  signUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  signUpBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },


  // Close
  closeBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
})
