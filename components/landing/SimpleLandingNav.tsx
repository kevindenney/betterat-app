import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { BetterAtLogo } from '@/components/BetterAtLogo';
import { InterestDropdown } from './InterestDropdown';
import { SAMPLE_INTERESTS, INTEREST_DOMAINS } from '@/lib/landing/sampleData';
import { useAuth } from '@/providers/AuthProvider';
import { getDashboardRoute } from '@/lib/utils/userTypeRouting';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';

interface SimpleLandingNavProps {
  currentInterestSlug?: string;
}

export function SimpleLandingNav({ currentInterestSlug }: SimpleLandingNavProps = {}) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingMenuOpen, setPricingMenuOpen] = useState(false);
  const { user, userProfile, isGuest } = useAuth();
  const isLoggedIn = !!user && !isGuest;
  const pathname = usePathname();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDesktop = mounted && width > 768;


  const goToDashboard = () => {
    setMobileMenuOpen(false);
    const dest = getDashboardRoute(userProfile?.user_type ?? null);
    router.push(dest as any);
  };

  return (
    <>
      <View
        style={[
          styles.nav,
          Platform.OS === 'web' && (styles.navWeb as any),
        ]}
      >
        <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
          {/* Back button (native only, when there's history) */}
          {Platform.OS !== 'web' && router.canGoBack() && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Logo */}
          <TouchableOpacity
            style={styles.logoRow}
            onPress={() => router.push('/?view=landing')}
            accessibilityLabel="BetterAt home"
          >
            <BetterAtLogo size={32} variant="white" />
            <Text style={styles.logoText}>BetterAt</Text>
          </TouchableOpacity>

          {/* Desktop links */}
          {isDesktop ? (
            <View style={styles.desktopLinks}>
              <InterestDropdown currentSlug={currentInterestSlug} />
              <TouchableOpacity onPress={() => router.push('/how-it-works' as any)}>
                <Text style={styles.navLink}>How It Works</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/marketplace' as any)}>
                <Text style={styles.navLink}>Marketplace</Text>
              </TouchableOpacity>
              <View style={styles.pricingContainer}>
                <TouchableOpacity
                  onPress={() => setPricingMenuOpen(!pricingMenuOpen)}
                >
                  <View style={styles.pricingTrigger}>
                    <Text style={styles.navLink}>Pricing</Text>
                    <Ionicons
                      name={pricingMenuOpen ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color="rgba(255, 255, 255, 0.85)"
                    />
                  </View>
                </TouchableOpacity>
                {pricingMenuOpen && (
                  <>
                    <Pressable
                      style={styles.pricingBackdrop}
                      onPress={() => setPricingMenuOpen(false)}
                    />
                    <Pressable
                      style={styles.pricingDropdown}
                      onPress={(e) => e.stopPropagation?.()}
                    >
                      <TouchableOpacity
                        style={styles.profileMenuItem}
                        onPress={() => { setPricingMenuOpen(false); router.push('/pricing'); }}
                      >
                        <Ionicons name="person-outline" size={16} color="#374151" />
                        <Text style={styles.profileMenuText}>Individual Pricing</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.profileMenuItem}
                        onPress={() => { setPricingMenuOpen(false); router.push('/institutions/pricing' as any); }}
                      >
                        <Ionicons name="business-outline" size={16} color="#374151" />
                        <Text style={styles.profileMenuText}>Institutional Plans</Text>
                      </TouchableOpacity>
                    </Pressable>
                  </>
                )}
              </View>

              <View style={styles.divider} />

              <ProfileDropdown
                variant="dark"
                size={36}
                currentInterestSlug={currentInterestSlug}
              />
            </View>
          ) : (
            /* Mobile hamburger */
            <TouchableOpacity
              onPress={() => setMobileMenuOpen(true)}
              style={styles.hamburger}
              accessibilityLabel="Open navigation menu"
            >
              <Ionicons name="menu" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mobile menu modal */}
      {!isDesktop && (
        <Modal
          visible={mobileMenuOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setMobileMenuOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setMobileMenuOpen(false)}
          >
            <Pressable style={styles.mobileMenu} onPress={() => {}}>
              {/* Close button */}
              <View style={styles.mobileMenuHeader}>
                <View style={styles.logoRow}>
                  <BetterAtLogo size={28} variant="white" />
                  <Text style={styles.logoText}>BetterAt</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMobileMenuOpen(false)}
                  accessibilityLabel="Close menu"
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Menu items — grouped by domain */}
              <ScrollView style={styles.mobileMenuItems} showsVerticalScrollIndicator={false}>
                {INTEREST_DOMAINS.map((domain) => {
                  const domainInterests = domain.slugs
                    .map((slug) => SAMPLE_INTERESTS.find((i) => i.slug === slug))
                    .filter(Boolean) as typeof SAMPLE_INTERESTS;
                  if (domainInterests.length === 0) return null;
                  return (
                    <View key={domain.name}>
                      <View style={styles.mobileDomainHeader}>
                        <View style={[styles.mobileDomainAccent, { backgroundColor: domain.color }]} />
                        <Text style={styles.mobileDomainLabel}>{domain.name}</Text>
                      </View>
                      {domainInterests.map((interest) => (
                        <TouchableOpacity
                          key={interest.slug}
                          style={styles.mobileMenuItem}
                          onPress={() => {
                            setMobileMenuOpen(false);
                            router.push(`/${interest.slug}` as any);
                          }}
                        >
                          <Ionicons
                            name={(interest.icon + '-outline') as any}
                            size={22}
                            color={interest.color}
                          />
                          <Text style={styles.mobileMenuText}>{interest.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={styles.mobileMenuItem}
                  onPress={() => {
                    setMobileMenuOpen(false);
                    router.push('/how-it-works' as any);
                  }}
                >
                  <Ionicons
                    name="bulb-outline"
                    size={22}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                  <Text style={styles.mobileMenuText}>How It Works</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mobileMenuItem}
                  onPress={() => {
                    setMobileMenuOpen(false);
                    router.push('/marketplace' as any);
                  }}
                >
                  <Ionicons
                    name="storefront-outline"
                    size={22}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                  <Text style={styles.mobileMenuText}>Marketplace</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mobileMenuItem}
                  onPress={() => {
                    setMobileMenuOpen(false);
                    router.push('/pricing');
                  }}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={22}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                  <Text style={styles.mobileMenuText}>Individual Pricing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mobileMenuItem}
                  onPress={() => {
                    setMobileMenuOpen(false);
                    router.push('/institutions/pricing' as any);
                  }}
                >
                  <Ionicons
                    name="business-outline"
                    size={22}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                  <Text style={styles.mobileMenuText}>Institutional Plans</Text>
                </TouchableOpacity>

                <View style={styles.mobileMenuDivider} />

                {isLoggedIn ? (
                  <>
                    <TouchableOpacity
                      style={styles.mobileMenuItem}
                      onPress={goToDashboard}
                    >
                      <Ionicons
                        name="grid-outline"
                        size={22}
                        color="rgba(255, 255, 255, 0.7)"
                      />
                      <Text style={styles.mobileMenuText}>Dashboard</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mobileMenuItem}
                      onPress={() => {
                        setMobileMenuOpen(false);
                        router.push(`/person/${user?.id}` as any);
                      }}
                    >
                      <Ionicons
                        name="person-outline"
                        size={22}
                        color="rgba(255, 255, 255, 0.7)"
                      />
                      <Text style={styles.mobileMenuText}>My Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mobileMenuItem}
                      onPress={() => {
                        setMobileMenuOpen(false);
                        router.push('/account' as any);
                      }}
                    >
                      <Ionicons
                        name="settings-outline"
                        size={22}
                        color="rgba(255, 255, 255, 0.7)"
                      />
                      <Text style={styles.mobileMenuText}>Settings</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.mobileMenuItem}
                      onPress={() => {
                        setMobileMenuOpen(false);
                        router.push({ pathname: '/(auth)/login', params: { returnTo: pathname } } as any);
                      }}
                    >
                      <Ionicons
                        name="log-in-outline"
                        size={22}
                        color="rgba(255, 255, 255, 0.7)"
                      />
                      <Text style={styles.mobileMenuText}>Log In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mobileGetStarted}
                      onPress={() => {
                        setMobileMenuOpen(false);
                        router.push(
                          currentInterestSlug
                            ? { pathname: '/(auth)/signup', params: { interest: currentInterestSlug } } as any
                            : '/(auth)/signup'
                        );
                      }}
                    >
                      <Text style={styles.mobileGetStartedText}>
                        Get Started Free
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  navWeb: {
    position: 'fixed',
    backdropFilter: 'blur(8px)',
  } as any,

  inner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  innerDesktop: {},

  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  desktopLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  navLink: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'color 0.2s' },
    }),
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  getStartedBtn: {
    backgroundColor: '#3E92CC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  getStartedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  pricingContainer: {
    position: 'relative',
  },
  pricingTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  pricingBackdrop: {
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
      } as any,
    }),
  },
  pricingDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 200,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      } as any,
    }),
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  profileMenuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },

  hamburger: {
    padding: 4,
  },

  // Mobile menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mobileMenu: {
    backgroundColor: '#1A1A1A',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  mobileMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  mobileMenuItems: {
    flex: 1,
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  mobileMenuText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mobileDomainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 4,
  },
  mobileDomainAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  mobileDomainLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mobileMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
  },
  mobileGetStarted: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  mobileGetStartedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});
