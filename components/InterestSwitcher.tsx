/**
 * InterestSwitcher — dropdown/bottom-sheet for switching the active interest.
 *
 * Shows in the NavigationHeader. Each interest renders its accent color dot,
 * name, and a checkmark for the currently selected interest.
 * Rows switch the active interest. Relationship management lives in Library.
 */

import { useInterest } from '@/providers/InterestProvider'
import type { Interest, DomainWithInterests } from '@/providers/InterestProvider'
import { useAuth } from '@/providers/AuthProvider'
import { useIsFocused } from '@react-navigation/native'
import { router } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { fontFamily } from '@/lib/design-tokens-editorial'

// Imperative opener so other parts of the app (e.g. the guest sample banner)
// can pop the same sheet without prop-drilling. Multiple InterestSwitcher
// instances can be mounted at once — a persistent headless host in the tabs
// layout plus per-surface headless hosts (Atlas, Golf). A single shared slot
// broke when a surface-level host unmounted and cleared the slot, leaving the
// persistent host's opener un-restored (it only registers once). So keep a
// stack: each instance pushes on mount and removes itself on unmount.
//
// "Topmost wins" alone is wrong: React Navigation keeps inactive tab screens
// mounted, so after you visit Atlas/Golf their host stays atop the stack even
// once you're back on another tab. Tapping the interest pill there fired a
// *backgrounded* host's setOpen — its Modal subtree isn't rendered, so nothing
// appeared. So each entry carries its host's focus state and the opener prefers
// the topmost focused host (the one on the visible surface), falling back to
// the topmost so a single always-mounted host still works.
interface OpenerEntry {
  open: () => void
  focused: boolean
}
const openerStack: OpenerEntry[] = []
export function openInterestSwitcher() {
  for (let i = openerStack.length - 1; i >= 0; i--) {
    const entry = openerStack[i]
    if (entry?.focused) {
      entry.open()
      return
    }
  }
  const fallback = openerStack[openerStack.length - 1]
  fallback?.open()
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
  const { currentInterest, userInterests, groupedInterests, switchInterest, loading } = useInterest()
  const { signedIn } = useAuth()
  const [open, setOpen] = useState(false)
  const isFocused = useIsFocused()

  // Register the imperative opener so callers anywhere in the tree can pop the
  // sheet. Push onto the shared stack on mount, splice out on unmount — this
  // keeps the persistent host's opener live after a surface-level host unmounts.
  // The entry carries this host's focus state so openInterestSwitcher can skip
  // backgrounded-but-mounted surface hosts (see the stack comment above).
  const entryRef = useRef<OpenerEntry>({ open: () => setOpen(true), focused: false })
  useEffect(() => {
    const entry = entryRef.current
    openerStack.push(entry)
    return () => {
      const idx = openerStack.indexOf(entry)
      if (idx !== -1) openerStack.splice(idx, 1)
    }
  }, [])
  useEffect(() => {
    entryRef.current.focused = isFocused
  }, [isFocused])

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

  const handleManageInterests = () => {
    setOpen(false)
    router.push({ pathname: '/(tabs)/library', params: { zone: 'interests' } })
  }

  const renderInterestRow = (interest: Interest) => {
    const isActive = interest.slug === currentInterest?.slug
    return (
      <TouchableOpacity
        key={interest.id}
        testID={`interest-switcher-row-${interest.slug}`}
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${interest.name}`}
        style={[styles.row, isActive && styles.rowActive]}
        onPress={() => handleSelect(interest)}
        activeOpacity={0.7}
      >
        <View style={[styles.rowDot, { backgroundColor: interest.accent_color }]} />
        <Text style={[styles.rowLabel, isActive && styles.rowLabelActive]} numberOfLines={1}>
          {interest.name}
        </Text>
        {isActive ? (
          <Ionicons name="checkmark" size={18} color="#1F2937" />
        ) : null}
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
          {currentInterest ? (
            <View style={styles.pillDotWrap}>
              <View style={[styles.pillDotRing, { backgroundColor: currentInterest.accent_color }]} />
              <View style={[styles.pillDot, { backgroundColor: currentInterest.accent_color }]} />
            </View>
          ) : null}
          <Text style={styles.pillText} numberOfLines={1}>
            {currentInterest?.name ?? 'Interest'}
          </Text>
          <Ionicons name="chevron-down" size={13} color="rgba(60, 60, 67, 0.32)" />
        </TouchableOpacity>
      ) : null}

      {/* Dropdown / Bottom Sheet */}
      <Modal
        visible={open}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable accessible={false} style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            testID="interest-switcher-sheet"
            accessible={false}
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
          >
            {!signedIn ? (
              <ScrollView showsVerticalScrollIndicator={false}>
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
                            testID={`interest-switcher-row-${interest.slug}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Switch to ${interest.name}`}
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
              </ScrollView>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Switch Interest</Text>
                <ScrollView
                  style={styles.interestList}
                  contentContainerStyle={styles.interestListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {userGroups.map((group) => (
                    <View key={group.domain?.slug ?? 'ungrouped'}>
                      {showDomainHeaders && group.domain && (
                        <Text style={styles.domainHeader}>{group.domain.name}</Text>
                      )}
                      {group.interests.map((interest) => renderInterestRow(interest))}
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.exploreAllBtn}
                  onPress={handleManageInterests}
                >
                  <Ionicons name="settings-outline" size={18} color="#4338CA" />
                  <Text style={styles.exploreAllText}>Manage interests</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setOpen(false)}
                >
                  <Text style={styles.closeBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
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
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.14)',
  },
  pillDotWrap: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDotRing: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    opacity: 0.2,
  },
  pillDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  pillText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1F2937',
    maxWidth: 140,
    letterSpacing: -0.2,
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
    fontFamily: fontFamily.serif,
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -0.4,
    color: '#1F2937',
    marginBottom: 14,
  },
  interestList: {
    maxHeight: 440,
  },
  interestListContent: {
    paddingBottom: 4,
  },

  // Interest row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  rowActive: {
    backgroundColor: '#F9FAFB',
  },
  rowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    letterSpacing: -0.1,
  },
  rowLabelActive: {
    fontWeight: '700',
    color: '#1F2937',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },

  // Domain header
  domainHeader: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    fontWeight: '500',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
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
    borderColor: 'rgba(0, 122, 255, 0.15)',
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
