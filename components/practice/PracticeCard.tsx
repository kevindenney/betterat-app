/**
 * PracticeCard Component
 *
 * Apple Human Interface Guidelines (HIG) compliant practice card:
 * - iOS system colors with purple theme for practice
 * - Mobile phone-sized card showing session details
 * - Countdown timer with urgency colors
 * - Focus areas with skill level indicators
 * - Crew coordination display
 *
 * Status Colors:
 * - Green: >24h away
 * - Orange: <24h away
 * - Blue: in_progress
 * - Gray: completed
 * - Teal: logged (ad-hoc)
 */

import { CardMenu, type CardMenuItem } from '@/components/shared/CardMenu';
import {
  IOS_COLORS,
  CARD_SHADOW_DRAMATIC,
  CARD_SHADOW_DRAMATIC_WEB,
} from '@/components/cards/constants';
import { createLogger } from '@/lib/utils/logger';
import { useRouter } from 'expo-router';
import {
  Brain,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Target,
  Users,
  Dumbbell,
  ChevronRight,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions as _useWindowDimensions,
} from 'react-native';
import {
  PracticeSession as _PracticeSession,
  PracticeStatus,
  PracticeFocusArea,
  PracticeSessionDrill,
  PracticeSessionMember,
  SkillArea as _SkillArea,
  SKILL_AREA_CONFIG,
} from '@/types/practice';

const _logger = createLogger('PracticeCard');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Practice-specific colors
const PRACTICE_COLORS = {
  primary: IOS_COLORS.purple, // Purple theme for practice
  primaryBg: `${IOS_COLORS.purple}15`,
  ai: IOS_COLORS.cyan, // Cyan for AI suggestions
  aiBg: `${IOS_COLORS.cyan}15`,
  logged: IOS_COLORS.teal, // Teal for logged sessions
  loggedBg: `${IOS_COLORS.teal}15`,
  focus: IOS_COLORS.indigo, // Indigo for focus areas
  focusBg: `${IOS_COLORS.indigo}15`,
} as const;

export interface PracticeCardProps {
  id: string;
  name?: string;
  venue?: string;
  venueName?: string;
  scheduledDate: string; // ISO date
  scheduledStartTime?: string;
  durationMinutes?: number;
  status: PracticeStatus;
  sessionType: 'scheduled' | 'logged';

  // Focus areas
  focusAreas?: PracticeFocusArea[];

  // Drills
  drills?: PracticeSessionDrill[];

  // Crew
  members?: PracticeSessionMember[];
  maxCrewSize?: number;

  // AI / WHY section
  isAISuggested?: boolean;
  aiSuggestionReason?: string;
  aiReasoning?: string;
  userRationale?: string;

  // HOW section
  hasCustomInstructions?: boolean;
  hasSuccessCriteria?: boolean;

  // 4Q Summary
  show4QSummary?: boolean;

  // Session reflection (for completed)
  overallRating?: number;
  reflectionNotes?: string;

  // Card state
  isPrimary?: boolean;
  isSelected?: boolean;
  isDimmed?: boolean;

  // Callbacks
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onJoin?: () => void;
  onStart?: () => void;

  // Layout
  cardWidth?: number;
  cardHeight?: number;
}

/**
 * Calculate countdown from now to scheduled date/time
 */
function calculatePracticeCountdown(date: string, time?: string): {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
} {
  const now = new Date();
  const targetDate = new Date(date);

  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);
  } else {
    targetDate.setHours(12, 0, 0, 0); // Default to noon
  }

  const diff = targetDate.getTime() - now.getTime();
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, isPast };
}

/**
 * Skill level indicator (5 dots)
 */
function SkillLevelDots({
  level,
  size = 6,
  color = IOS_COLORS.purple,
}: {
  level: number; // 1-5
  size?: number;
  color?: string;
}) {
  const dots = [];
  for (let i = 1; i <= 5; i++) {
    dots.push(
      <View
        key={i}
        style={[
          styles.skillDot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i <= level ? color : `${color}30`,
          },
        ]}
      />
    );
  }
  return <View style={styles.skillDots}>{dots}</View>;
}

/**
 * Crew avatar display
 */
function CrewAvatars({
  members = [],
  maxDisplay = 3,
}: {
  members: PracticeSessionMember[];
  maxDisplay?: number;
}) {
  const confirmedMembers = members.filter((m) => m.rsvpStatus === 'accepted');
  const displayMembers = confirmedMembers.slice(0, maxDisplay);
  const overflow = confirmedMembers.length - maxDisplay;

  return (
    <View style={styles.crewAvatars}>
      {displayMembers.map((member, index) => (
        <View
          key={member.id}
          style={[
            styles.crewAvatar,
            { marginLeft: index > 0 ? -8 : 0, zIndex: maxDisplay - index },
          ]}
        >
          <Text style={styles.crewAvatarText}>
            {(member.displayName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.crewAvatar, styles.crewAvatarOverflow, { marginLeft: -8 }]}>
          <Text style={styles.crewAvatarOverflowText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * 4Q Summary Strip
 * Shows a compact visual of the 4 framework quadrants: WHAT, WHO, WHY, HOW
 */
function FourQSummary({
  focusCount,
  drillCount,
  crewCount,
  hasAI,
  hasRationale,
  hasInstructions,
  hasCriteria,
}: {
  focusCount: number;
  drillCount: number;
  crewCount: number;
  hasAI: boolean;
  hasRationale: boolean;
  hasInstructions: boolean;
  hasCriteria: boolean;
}) {
  const quadrants = [
    {
      key: 'what',
      label: 'WHAT',
      value: `${focusCount} focus${focusCount !== 1 ? 'es' : ''} · ${drillCount} drill${drillCount !== 1 ? 's' : ''}`,
      isSet: focusCount > 0 || drillCount > 0,
      color: PRACTICE_COLORS.focus,
    },
    {
      key: 'who',
      label: 'WHO',
      value: `${crewCount} crew`,
      isSet: crewCount > 0,
      color: PRACTICE_COLORS.primary,
    },
    {
      key: 'why',
      label: 'WHY',
      value: hasAI ? 'Suggested' : hasRationale ? 'Has rationale' : 'Not set',
      isSet: hasAI || hasRationale,
      color: PRACTICE_COLORS.ai,
    },
    {
      key: 'how',
      label: 'HOW',
      value: hasInstructions && hasCriteria ? 'Ready' : hasInstructions ? 'Instructions' : hasCriteria ? 'Criteria' : 'Not set',
      isSet: hasInstructions || hasCriteria,
      color: IOS_COLORS.green,
    },
  ];

  return (
    <View style={styles.fourQSummary}>
      {quadrants.map((q, idx) => (
        <View
          key={q.key}
          style={[
            styles.fourQItem,
            idx < quadrants.length - 1 && styles.fourQItemBorder,
          ]}
        >
          <Text
            style={[
              styles.fourQLabel,
              { color: q.isSet ? q.color : IOS_COLORS.gray3 },
            ]}
          >
            {q.label}
          </Text>
          <View
            style={[
              styles.fourQDot,
              {
                backgroundColor: q.isSet ? q.color : IOS_COLORS.gray4,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export function PracticeCard({
  id,
  name,
  venue,
  venueName,
  scheduledDate,
  scheduledStartTime,
  durationMinutes = 60,
  status,
  sessionType,
  focusAreas = [],
  drills = [],
  members = [],
  maxCrewSize = 4,
  isAISuggested = false,
  aiSuggestionReason: _aiSuggestionReason,
  aiReasoning,
  userRationale,
  hasCustomInstructions = false,
  hasSuccessCriteria = false,
  show4QSummary = true,
  overallRating,
  reflectionNotes: _reflectionNotes,
  isPrimary = false,
  isSelected = false,
  isDimmed = false,
  onSelect,
  onEdit,
  onDelete,
  onJoin,
  onStart,
  cardWidth: propCardWidth,
  cardHeight: propCardHeight,
}: PracticeCardProps) {
  const router = useRouter();

  // Build menu items
  const menuItems = useMemo<CardMenuItem[]>(() => {
    const items: CardMenuItem[] = [];
    if (onEdit && status !== 'completed' && status !== 'cancelled') {
      items.push({
        label: 'Edit Session',
        icon: 'create-outline',
        onPress: onEdit,
      });
    }
    if (onDelete) {
      items.push({
        label: 'Delete Session',
        icon: 'trash-outline',
        onPress: onDelete,
        variant: 'destructive',
      });
    }
    return items;
  }, [onEdit, onDelete, status]);

  // Calculate countdown
  const [minuteTick, setMinuteTick] = useState(Math.floor(Date.now() / 60000));
  const countdown = useMemo(
    () => calculatePracticeCountdown(scheduledDate, scheduledStartTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduledDate, scheduledStartTime, minuteTick]
  );

  // Update countdown every minute
  useEffect(() => {
    if (status === 'completed' || status === 'cancelled' || sessionType === 'logged') return;
    const interval = setInterval(() => {
      setMinuteTick(Math.floor(Date.now() / 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, [status, sessionType]);

  // Handle card press
  const handlePress = () => {
    if (onSelect) {
      onSelect();
      return;
    }
    // Navigate to practice detail (to be created)
    router.push(`/practice/${id}`);
  };

  // Card dimensions
  const cardWidth = propCardWidth ?? Math.min(SCREEN_WIDTH - 32, 375);
  const cardHeight = propCardHeight ?? 280;

  // Primary focus area
  const primaryFocus = focusAreas.find((fa) => fa.priority === 1) || focusAreas[0];
  const focusConfig = primaryFocus ? SKILL_AREA_CONFIG[primaryFocus.skillArea] : null;

  // Primary drill
  const primaryDrill = drills.find((d) => d.orderIndex === 0) || drills[0];

  // Countdown urgency color
  const getCountdownColor = () => {
    if (status === 'completed') return { bg: IOS_COLORS.gray6, text: IOS_COLORS.gray };
    if (status === 'in_progress') return { bg: `${IOS_COLORS.blue}20`, text: IOS_COLORS.blue };
    if (sessionType === 'logged') return { bg: PRACTICE_COLORS.loggedBg, text: PRACTICE_COLORS.logged };
    if (countdown.days > 1) return { bg: `${IOS_COLORS.green}20`, text: IOS_COLORS.green };
    if (countdown.days >= 1) return { bg: `${IOS_COLORS.yellow}25`, text: IOS_COLORS.orange };
    return { bg: `${IOS_COLORS.orange}20`, text: IOS_COLORS.orange };
  };
  const countdownColors = getCountdownColor();

  // Accent color based on status
  const getAccentColor = () => {
    if (status === 'completed') return IOS_COLORS.gray;
    if (status === 'in_progress') return IOS_COLORS.blue;
    if (status === 'cancelled') return IOS_COLORS.red;
    if (sessionType === 'logged') return PRACTICE_COLORS.logged;
    if (countdown.days <= 1) return IOS_COLORS.orange;
    return IOS_COLORS.green;
  };
  const accentColor = getAccentColor();

  // Crew stats
  const confirmedCount = members.filter((m) => m.rsvpStatus === 'accepted').length;

  // Display name
  const displayVenue = venueName || venue || 'Location TBD';
  const displayName = name || (primaryFocus ? `${focusConfig?.label} Practice` : 'Practice Session');

  return (
    <View style={styles.cardWrapper}>
      <Pressable
        style={({ pressed }) => {
          const baseOpacity = status === 'completed' ? 0.85 : 1;
          const selectionOpacity = isDimmed ? 0.65 : baseOpacity;
          const computedOpacity = pressed ? Math.max(selectionOpacity - 0.05, 0.7) : selectionOpacity;
          return [
            styles.card,
            {
              width: cardWidth,
              height: cardHeight,
              opacity: computedOpacity,
              transform: pressed
                ? [{ scale: 0.98 }]
                : isSelected
                  ? [{ translateY: -4 }, { scale: 1.02 }]
                  : [],
            },
            isPrimary && styles.primaryCard,
            status === 'completed' && styles.completedCard,
            status === 'in_progress' && styles.inProgressCard,
            sessionType === 'logged' && styles.loggedCard,
            isSelected && styles.selectedCard,
          ];
        }}
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`View details for ${displayName}`}
        accessibilityState={{ selected: isSelected }}
        testID={`practice-card-${id}`}
      >
        {/* Status Accent Line */}
        <View style={[styles.accentLine, { backgroundColor: accentColor }]} />

        {/* Menu */}
        {menuItems.length > 0 && (
          <View style={styles.menuContainer} pointerEvents="box-none">
            <CardMenu items={menuItems} />
          </View>
        )}

        {/* Top Badges Row */}
        <View style={styles.topBadgesRow}>
          {/* Practice Type Badge */}
          <View style={[styles.typeBadge, { backgroundColor: PRACTICE_COLORS.primaryBg }]}>
            <Dumbbell size={10} color={PRACTICE_COLORS.primary} />
            <Text style={[styles.typeBadgeText, { color: PRACTICE_COLORS.primary }]}>
              {sessionType === 'logged' ? 'LOGGED' : 'PRACTICE'}
            </Text>
          </View>

          {/* AI Suggested Badge */}
          {isAISuggested && (
            <View style={[styles.aiBadge, { backgroundColor: PRACTICE_COLORS.aiBg }]}>
              <Sparkles size={10} color={PRACTICE_COLORS.ai} />
            </View>
          )}

          {/* Duration Badge */}
          {durationMinutes > 0 && (
            <View style={styles.durationBadge}>
              <Clock size={10} color={IOS_COLORS.gray} />
              <Text style={styles.durationBadgeText}>{durationMinutes}min</Text>
            </View>
          )}
        </View>

        {/* Header Zone - Countdown left, Details right */}
        <View style={styles.headerZone}>
          {/* Countdown Box */}
          <View
            style={[styles.countdownBox, { backgroundColor: countdownColors.bg }]}
          >
            {status === 'completed' ? (
              <>
                <CheckCircle2 size={28} color={countdownColors.text} />
                <Text style={[styles.countdownLabel, { color: countdownColors.text }]}>
                  DONE
                </Text>
              </>
            ) : status === 'in_progress' ? (
              <>
                <Target size={28} color={countdownColors.text} />
                <Text style={[styles.countdownLabel, { color: countdownColors.text }]}>
                  LIVE
                </Text>
              </>
            ) : sessionType === 'logged' ? (
              <>
                <CheckCircle2 size={28} color={countdownColors.text} />
                <Text style={[styles.countdownLabel, { color: countdownColors.text }]}>
                  LOG
                </Text>
              </>
            ) : (
              <Text style={[styles.countdownCompact, { color: countdownColors.text }]}>
                {countdown.days > 0
                  ? `${countdown.days}d ${countdown.hours}h`
                  : `${countdown.hours}h ${countdown.minutes}m`}
              </Text>
            )}
          </View>

          {/* Session Details */}
          <View style={styles.headerDetails}>
            <Text style={styles.sessionName} numberOfLines={2}>
              {displayName}
            </Text>
            <View style={styles.metaRow}>
              <MapPin size={11} color={IOS_COLORS.gray} />
              <Text style={styles.metaText} numberOfLines={1}>
                {displayVenue}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {new Date(scheduledDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
                {scheduledStartTime && ` at ${scheduledStartTime}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Focus Area Section */}
        {primaryFocus && focusConfig && (
          <View style={styles.focusSection}>
            <View style={styles.focusHeader}>
              <Text style={styles.focusLabel}>FOCUS</Text>
              <SkillLevelDots
                level={primaryFocus.preSessionConfidence || 3}
                color={PRACTICE_COLORS.focus}
              />
            </View>
            <View style={styles.focusContent}>
              <Brain size={16} color={PRACTICE_COLORS.focus} />
              <Text style={styles.focusName}>{focusConfig.label}</Text>
              {focusAreas.length > 1 && (
                <Text style={styles.focusMore}>+{focusAreas.length - 1}</Text>
              )}
            </View>
          </View>
        )}

        {/* Drill Section */}
        {primaryDrill && (
          <View style={styles.drillSection}>
            <Text style={styles.drillLabel}>DRILL</Text>
            <Text style={styles.drillName} numberOfLines={1}>
              {primaryDrill.drill?.name || 'Practice Drill'}
            </Text>
            {drills.length > 1 && (
              <Text style={styles.drillMore}>+{drills.length - 1} more</Text>
            )}
          </View>
        )}

        {/* Crew Section */}
        <View style={styles.crewSection}>
          <View style={styles.crewInfo}>
            <Users size={14} color={IOS_COLORS.gray} />
            <CrewAvatars members={members} maxDisplay={3} />
            <Text style={styles.crewCount}>
              {confirmedCount}/{maxCrewSize} confirmed
            </Text>
          </View>
          {onJoin && status === 'planned' && (
            <Pressable style={styles.joinButton} onPress={onJoin}>
              <Text style={styles.joinButtonText}>Join</Text>
            </Pressable>
          )}
          {onStart && status === 'planned' && !countdown.isPast && (
            <Pressable style={styles.startButton} onPress={onStart}>
              <Text style={styles.startButtonText}>Start</Text>
              <ChevronRight size={14} color={IOS_COLORS.systemBackground} />
            </Pressable>
          )}
        </View>

        {/* Rating for completed sessions */}
        {status === 'completed' && overallRating && (
          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Session Rating</Text>
            <SkillLevelDots level={overallRating} size={8} color={IOS_COLORS.orange} />
          </View>
        )}

        {/* 4Q Summary Strip */}
        {show4QSummary && (
          <FourQSummary
            focusCount={focusAreas.length}
            drillCount={drills.length}
            crewCount={confirmedCount}
            hasAI={isAISuggested || !!aiReasoning}
            hasRationale={!!userRationale}
            hasInstructions={hasCustomInstructions}
            hasCriteria={hasSuccessCriteria}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 8,
    marginVertical: 8,
  },
  card: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
    overflow: 'visible',
    ...Platform.select({
      web: {
        boxShadow: CARD_SHADOW_DRAMATIC_WEB,
        cursor: 'pointer',
        userSelect: 'none',
      },
      default: {
        ...CARD_SHADOW_DRAMATIC,
      },
    }),
  },
  primaryCard: {
    backgroundColor: `${PRACTICE_COLORS.primary}08`,
    ...Platform.select({
      web: {
        boxShadow: `0 4px 8px ${PRACTICE_COLORS.primary}14, 0 12px 28px ${PRACTICE_COLORS.primary}22, 0 24px 48px rgba(0, 0, 0, 0.1)`,
      },
      default: {
        shadowColor: PRACTICE_COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 22,
        elevation: 16,
      },
    }),
  },
  completedCard: {
    backgroundColor: IOS_COLORS.gray6,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03), 0 2px 6px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  inProgressCard: {
    backgroundColor: `${IOS_COLORS.blue}08`,
    ...Platform.select({
      web: {
        boxShadow: `0 4px 8px ${IOS_COLORS.blue}14, 0 12px 28px ${IOS_COLORS.blue}22`,
      },
      default: {
        shadowColor: IOS_COLORS.blue,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 22,
        elevation: 16,
      },
    }),
  },
  loggedCard: {
    backgroundColor: `${PRACTICE_COLORS.logged}08`,
  },
  selectedCard: {
    backgroundColor: `${PRACTICE_COLORS.primary}10`,
    ...Platform.select({
      web: {
        boxShadow: `0 6px 12px ${PRACTICE_COLORS.primary}18, 0 16px 36px ${PRACTICE_COLORS.primary}28`,
      },
      default: {
        shadowColor: PRACTICE_COLORS.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 28,
        elevation: 20,
      },
    }),
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 10,
  },
  menuContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
  },
  topBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: IOS_COLORS.gray6,
  },
  durationBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: IOS_COLORS.gray,
  },
  headerZone: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  countdownBox: {
    width: 70,
    height: 70,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  countdownCompact: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  countdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  headerDetails: {
    flex: 1,
    paddingRight: 24,
  },
  sessionName: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 22,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    fontWeight: '500',
  },
  focusSection: {
    backgroundColor: PRACTICE_COLORS.focusBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  focusLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: PRACTICE_COLORS.focus,
    letterSpacing: 0.5,
  },
  focusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  focusName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    flex: 1,
  },
  focusMore: {
    fontSize: 11,
    fontWeight: '600',
    color: PRACTICE_COLORS.focus,
  },
  skillDots: {
    flexDirection: 'row',
    gap: 3,
  },
  skillDot: {
    // Size set dynamically
  },
  drillSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray5,
    marginBottom: 8,
  },
  drillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: IOS_COLORS.gray,
    letterSpacing: 0.5,
  },
  drillName: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    flex: 1,
  },
  drillMore: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  crewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray5,
  },
  crewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crewAvatars: {
    flexDirection: 'row',
  },
  crewAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRACTICE_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: IOS_COLORS.systemBackground,
  },
  crewAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_COLORS.systemBackground,
  },
  crewAvatarOverflow: {
    backgroundColor: IOS_COLORS.gray,
  },
  crewAvatarOverflowText: {
    fontSize: 9,
    fontWeight: '700',
    color: IOS_COLORS.systemBackground,
  },
  crewCount: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  joinButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRACTICE_COLORS.primary,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRACTICE_COLORS.primary,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.green,
  },
  startButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBackground,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray5,
    marginTop: 8,
  },
  ratingLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  // 4Q Summary styles
  fourQSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray5,
  },
  fourQItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  fourQItemBorder: {
    borderRightWidth: 1,
    borderRightColor: IOS_COLORS.gray5,
  },
  fourQLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fourQDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default PracticeCard;
