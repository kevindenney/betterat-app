/**
 * Public Step Page
 * Accessible without authentication - shareable link for step content
 *
 * URL: /p/step/[token]
 */

import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { getReviewSections, getReviewSectionContent } from '@/lib/step/getReviewSections';
import type { StepMetadata } from '@/types/step-detail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepData {
  title: string;
  status: string;
  category: string;
  starts_at: string | null;
  ends_at: string | null;
  creator: { display_name: string } | null;
  interest: { name: string } | null;
  plan: {
    what: string | null;
    how_sub_steps: { text: string; completed: boolean }[];
    why: string | null;
    capability_goals: string[];
    collaborator_names: string[];
  };
  act: {
    notes: string | null;
    media_uploads: { uri: string; type: string; caption?: string }[];
    media_links: { url: string; platform: string; caption?: string }[];
  };
  review: {
    overall_rating: number | null;
    what_learned: string | null;
    capability_progress: Record<string, number>;
  };
  created_at: string;
  shared_at: string | null;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location?.hostname === 'localhost' ||
      window.location?.hostname === '127.0.0.1' ||
      window.location?.hostname === '';

    if (isLocalhost) {
      return 'http://localhost:3000';
    }
  }
  return process.env.EXPO_PUBLIC_API_URL || 'https://better.at';
};

const API_BASE = getApiBase();

/** Fetch step data directly from Supabase (fallback when API isn't available) */
async function fetchStepFromSupabase(shareToken: string): Promise<StepData | null> {
  // Read through a token-keyed SECURITY DEFINER RPC. A direct table read used to
  // rely on an RLS policy that exposed every shared step (enumeration) and shipped
  // raw metadata; the RPC returns only the sanitized fields for this one token.
  const { data: step, error } = await supabase.rpc('get_shared_step', {
    p_token: shareToken,
  });

  if (error || !step) return null;

  const creator: { display_name: string } | null = step.creator_name
    ? { display_name: step.creator_name || 'Anonymous' }
    : null;
  const interest: { name: string } | null = step.interest_name
    ? { name: step.interest_name }
    : null;

  const metadata = (step.metadata || {}) as Record<string, any>;
  const planData = metadata.plan || {};
  const actData = metadata.act || {};
  const reviewData = metadata.review || {};
  const normalizedReview = getReviewSections(metadata as StepMetadata, step.completed_at ?? null);
  const learnedFromSections = getReviewSectionContent(normalizedReview.sections, 'what_did_you_learn');

  const collaborators: { display_name?: string }[] = planData.collaborators || [];
  const legacyNames: string[] = planData.who_collaborators || [];
  const collaboratorNames = collaborators.length > 0
    ? collaborators.map((c: any) => c.display_name || 'Someone').filter(Boolean)
    : legacyNames;

  return {
    title: step.title,
    status: step.status,
    category: step.category,
    starts_at: step.starts_at,
    ends_at: step.ends_at,
    creator,
    interest,
    plan: {
      what: planData.what_will_you_do || null,
      how_sub_steps: (planData.how_sub_steps || []).map((ss: any) => ({
        text: ss.text || '',
        completed: !!ss.completed,
      })),
      why: planData.why_reasoning || null,
      capability_goals: planData.capability_goals || [],
      collaborator_names: collaboratorNames,
    },
    act: {
      notes: actData.notes || null,
      media_uploads: (actData.media_uploads || []).map((m: any) => ({
        uri: m.uri || '',
        type: m.type || 'photo',
        ...(m.caption ? { caption: m.caption } : {}),
      })),
      media_links: (actData.media_links || []).map((m: any) => ({
        url: m.url || '',
        platform: m.platform || 'other',
        ...(m.caption ? { caption: m.caption } : {}),
      })),
    },
    review: {
      overall_rating: reviewData.overall_rating ?? null,
      what_learned: learnedFromSections || reviewData.what_learned || null,
      capability_progress: reviewData.capability_progress || {},
    },
    created_at: step.created_at,
    shared_at: step.shared_at,
  };
}

// ---------------------------------------------------------------------------
// Design tokens (matches Step design language)
// ---------------------------------------------------------------------------

const C = {
  bg: '#F5F4F1',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  accent: '#3D8A5A',
  accentBg: 'rgba(61,138,90,0.08)',
  coral: '#D89575',
  gold: '#D4A64A',
  dotInactive: '#EDECEA',
  badgeBg: '#EDECEA',
} as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'completed'
      ? C.accent
      : status === 'in_progress'
        ? C.gold
        : C.labelMid;
  const label =
    status === 'completed'
      ? 'Completed'
      : status === 'in_progress'
        ? 'In Progress'
        : status === 'skipped'
          ? 'Skipped'
          : 'Planned';

  return (
    <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
      <Ionicons
        name={status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={color}
      />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name="star"
          size={20}
          color={i <= rating ? C.gold : C.dotInactive}
        />
      ))}
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={18} color={C.accent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PublicStepPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<StepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);

      // Try API endpoint first (works in production)
      const endpoints =
        typeof window !== 'undefined' &&
        (window.location?.hostname === 'localhost' ||
          window.location?.hostname === '127.0.0.1')
          ? [
              `http://localhost:3000/api/public/steps/${token}`,
              `https://better.at/api/public/steps/${token}`,
            ]
          : [`${API_BASE}/api/public/steps/${token}`];

      for (const url of endpoints) {
        try {
          const res = await Promise.race([
            fetch(url),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 5000)
            ),
          ]);
          if (res.ok) {
            setData(await res.json());
            return;
          }
          if (res.status === 404) {
            setError('Step not found or sharing is disabled');
            return;
          }
        } catch {
          // try next endpoint
        }
      }

      // Fallback: fetch directly from Supabase (works in local dev without Vercel)
      try {
        const directData = await fetchStepFromSupabase(token);
        if (directData) {
          setData(directData);
          return;
        }
      } catch {
        // fall through to error
      }

      setError('Could not load step. Please try again later.');
    };

    fetchData().finally(() => setLoading(false));
  }, [token]);

  const handleShare = async () => {
    const baseUrl =
      typeof window !== 'undefined' ? window.location.origin : API_BASE;
    const url = `${baseUrl}/p/step/${token}`;
    const title = data?.title ? `Practice Step - ${data.title}` : 'Practice Step';

    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } else {
      await Share.share({ message: `Check out this practice step: ${url}`, url });
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  // Loading
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading step...</Text>
      </View>
    );
  }

  // Error
  if (error || !data) {
    return (
      <View style={styles.center}>
        <Ionicons name="document-outline" size={64} color={C.dotInactive} />
        <Text style={styles.errorTitle}>Step Not Found</Text>
        <Text style={styles.errorText}>
          {error || 'This step may have been removed or sharing has been disabled.'}
        </Text>
      </View>
    );
  }

  const hasPlan = data.plan.what || data.plan.how_sub_steps.length > 0 || data.plan.why;
  const hasAct = data.act.notes || data.act.media_uploads.length > 0 || data.act.media_links.length > 0;
  const hasReview = data.review.overall_rating || data.review.what_learned;

  return (
    <ScrollView style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {data.creator && (
              <View style={styles.creatorBadge}>
                <Ionicons name="person-outline" size={14} color={C.accent} />
                <Text style={styles.creatorName}>{data.creator.display_name}</Text>
              </View>
            )}
            {data.interest && (
              <View style={styles.interestBadge}>
                <Text style={styles.interestText}>{data.interest.name}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={20} color={C.labelMid} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{data.title}</Text>

        <View style={styles.headerMeta}>
          <StatusBadge status={data.status} />
          {data.starts_at && (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={C.labelMid} />
              <Text style={styles.metaText}>{formatDate(data.starts_at)}</Text>
            </View>
          )}
        </View>

        {data.plan.collaborator_names.length > 0 && (
          <View style={styles.collabRow}>
            <Ionicons name="people-outline" size={14} color={C.labelMid} />
            <Text style={styles.collabText}>
              With {data.plan.collaborator_names.join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* ── PLAN ── */}
      {hasPlan && (
        <View style={styles.section}>
          <SectionHeader icon="bulb-outline" title="Plan" />

          {data.plan.what && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>WHAT</Text>
              <Text style={styles.fieldValue}>{data.plan.what}</Text>
            </View>
          )}

          {data.plan.how_sub_steps.length > 0 && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>HOW</Text>
              {data.plan.how_sub_steps.map((ss, i) => (
                <View key={i} style={styles.subStepRow}>
                  <Ionicons
                    name={ss.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={ss.completed ? C.accent : C.dotInactive}
                  />
                  <Text
                    style={[
                      styles.subStepText,
                      ss.completed && styles.subStepCompleted,
                    ]}
                  >
                    {ss.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {data.plan.why && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>WHY</Text>
              <Text style={styles.fieldValue}>{data.plan.why}</Text>
            </View>
          )}

          {data.plan.capability_goals.length > 0 && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>SKILLS</Text>
              <View style={styles.skillTags}>
                {data.plan.capability_goals.map((goal, i) => (
                  <View key={i} style={styles.skillTag}>
                    <Text style={styles.skillTagText}>{goal}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── SESSION ── */}
      {hasAct && (
        <View style={styles.section}>
          <SectionHeader icon="play-circle-outline" title="Session" />

          {data.act.notes && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>NOTES</Text>
              <Text style={styles.fieldValue}>{data.act.notes}</Text>
            </View>
          )}

          {data.act.media_uploads.length > 0 && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>MEDIA</Text>
              <View style={styles.mediaGrid}>
                {data.act.media_uploads.map((m, i) => (
                  <View key={i} style={styles.mediaThumb}>
                    <Ionicons
                      name={m.type === 'video' ? 'videocam' : 'image'}
                      size={24}
                      color={C.labelMid}
                    />
                    {m.caption && (
                      <Text style={styles.mediaCaption} numberOfLines={1}>
                        {m.caption}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {data.act.media_links.length > 0 && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>LINKS</Text>
              {data.act.media_links.map((link, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(link.url)}
                  style={styles.mediaLinkRow}
                >
                  <Ionicons name="link-outline" size={16} color={C.accent} />
                  <Text style={styles.mediaLinkText} numberOfLines={1}>
                    {link.caption || link.url}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── REVIEW ── */}
      {hasReview && (
        <View style={styles.section}>
          <SectionHeader icon="star-outline" title="Review" />

          {data.review.overall_rating != null && data.review.overall_rating > 0 && (
            <View style={styles.ratingCenter}>
              <StarDisplay rating={data.review.overall_rating} />
            </View>
          )}

          {data.review.what_learned && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>WHAT I LEARNED</Text>
              <Text style={styles.fieldValue}>{data.review.what_learned}</Text>
            </View>
          )}

          {Object.keys(data.review.capability_progress).length > 0 && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>SKILL RATINGS</Text>
              {Object.entries(data.review.capability_progress).map(([skill, rating]) => (
                <View key={skill} style={styles.skillRatingRow}>
                  <Text style={styles.skillRatingName} numberOfLines={1}>
                    {skill}
                  </Text>
                  <View style={styles.dotRow}>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <View
                        key={d}
                        style={[
                          styles.dot,
                          { backgroundColor: d <= rating ? C.accent : C.dotInactive },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── FOOTER ── */}
      <View style={styles.footer}>
        <Text style={styles.footerPowered}>Powered by BetterAt</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://better.at')}>
          <Text style={styles.footerCta}>Start planning your practice →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: C.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: C.labelMid,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: C.labelDark,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: C.labelMid,
    textAlign: 'center',
    marginTop: 8,
  },

  // Header
  header: {
    backgroundColor: C.cardBg,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorName: {
    fontSize: 13,
    fontWeight: '500',
    color: C.accent,
  },
  interestBadge: {
    backgroundColor: C.badgeBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  interestText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.labelMid,
  },
  shareBtn: {
    padding: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.labelDark,
    marginBottom: 12,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: C.labelMid,
  },
  collabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  collabText: {
    fontSize: 13,
    color: C.labelMid,
  },

  // Section
  section: {
    backgroundColor: C.cardBg,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.labelDark,
  },

  // Fields
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.labelLight,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 14,
    color: C.labelDark,
    lineHeight: 21,
  },

  // Sub-steps
  subStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  subStepText: {
    flex: 1,
    fontSize: 14,
    color: C.labelDark,
    lineHeight: 20,
  },
  subStepCompleted: {
    color: C.labelMid,
    textDecorationLine: 'line-through',
  },

  // Skill tags
  skillTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillTag: {
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  skillTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.accent,
  },

  // Media
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaThumb: {
    width: 72,
    height: 72,
    backgroundColor: C.badgeBg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaCaption: {
    fontSize: 10,
    color: C.labelMid,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  mediaLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  mediaLinkText: {
    flex: 1,
    fontSize: 14,
    color: C.accent,
  },

  // Review
  ratingCenter: {
    alignItems: 'center',
    marginBottom: 14,
  },
  starRow: {
    flexDirection: 'row',
    gap: 4,
  },
  skillRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  skillRatingName: {
    flex: 1,
    fontSize: 14,
    color: C.labelDark,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Footer
  footer: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  footerPowered: {
    fontSize: 12,
    color: C.labelLight,
  },
  footerCta: {
    fontSize: 14,
    fontWeight: '500',
    color: C.accent,
    marginTop: 4,
  },
});
