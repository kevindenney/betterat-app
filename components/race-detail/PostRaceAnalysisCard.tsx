// @ts-nocheck

/**
 * Post-Race Analysis Card
 *
 * Appears in race detail scrollable view after race completion.
 * - Shows "Complete Analysis" prompt if not done
 * - Shows BetterAt Playbook coaching if analysis complete
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StrategyCard } from './StrategyCard';
import { ExecutionEvaluationCard } from './ExecutionEvaluationCard';
import { PostRaceAnalysisForm, RegattaFlowPlaybookCoaching } from '@/components/races';
import { supabase } from '@/services/supabase';
import { coachingService } from '@/services/CoachingService';
import { useAuth } from '@/providers/AuthProvider';
import type { RaceAnalysis, CoachingFeedback, FrameworkScores } from '@/types/raceAnalysis';
import { createLogger } from '@/lib/utils/logger';
import { UnifiedSharingSheet, CoachSharePrompt } from '@/components/sharing';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

interface PostRaceAnalysisCardProps {
  raceId: string;
  raceName: string;
  raceStartTime?: string;
}

const logger = createLogger('PostRaceAnalysisCard');
export function PostRaceAnalysisCard({
  raceId,
  raceName,
  raceStartTime,
}: PostRaceAnalysisCardProps) {
  const { user } = useAuth();
  const [existingAnalysis, setExistingAnalysis] = useState<RaceAnalysis | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sailorId, setSailorId] = useState<string | null>(null);
  const [coachingData, setCoachingData] = useState<{
    coaching_feedback: CoachingFeedback[];
    framework_scores: FrameworkScores;
    overall_assessment: string;
    next_race_priorities: string[];
  } | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showCoachPrompt, setShowCoachPrompt] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  // Check if race is completed (start time in past)
  const isRaceCompleted = raceStartTime ? new Date(raceStartTime) < new Date() : false;

  const loadExistingAnalysis = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setLoadErrorMessage(null);

      // Fetch sailor_profile to get the correct ID
      const { data: sailorProfile, error: profileError } = await supabase
        .from('sailor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[PostRaceAnalysisCard] Error fetching sailor profile:', profileError);
        setLoadErrorMessage(profileError.message || 'Could not load your sailor profile.');
        setLoading(false);
        return;
      }

      if (!sailorProfile) {
        logger.debug('[PostRaceAnalysisCard] No sailor profile found - user needs to complete onboarding');
        setLoadErrorMessage('Complete sailor onboarding to unlock post-race analysis.');
        setLoading(false);
        return;
      }

      // Store sailor ID for ExecutionEvaluationCard
      setSailorId(sailorProfile.id);

      let data: any = null;
      let error: any = null;

      const primary = await supabase
        .from('race_analysis')
        .select('*')
        .eq('race_id', raceId)
        .eq('sailor_id', sailorProfile.id)
        .maybeSingle();

      data = primary.data;
      error = primary.error;

      if (isMissingIdColumn(error, 'race_analysis', 'race_id')) {
        const fallback = await supabase
          .from('race_analysis')
          .select('*')
          .eq('regatta_id', raceId)
          .eq('sailor_id', sailorProfile.id)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('[PostRaceAnalysisCard] Error loading analysis:', error);
        setLoadErrorMessage(error.message || 'Unable to load post-race analysis right now.');
        return;
      }

      if (data) {
        setExistingAnalysis(data as RaceAnalysis);

        // If analysis has coaching feedback, show it
        if (data.ai_coaching_feedback) {
          setCoachingData({
            coaching_feedback: data.ai_coaching_feedback,
            framework_scores: data.framework_scores || {},
            overall_assessment: '', // Can be regenerated if needed
            next_race_priorities: [],
          });
        }
      }
    } catch (error) {
      console.error('[PostRaceAnalysisCard] Error:', error);
      setLoadErrorMessage((error as Error)?.message || 'Unable to load post-race analysis right now.');
    } finally {
      setLoading(false);
    }
  }, [user, raceId]);

  useEffect(() => {
    if (isRaceCompleted) {
      void loadExistingAnalysis();
    } else {
      setLoading(false);
    }
  }, [isRaceCompleted, loadExistingAnalysis]);

  const handleStartAnalysis = () => {
    setShowForm(true);
  };

  const handleAnalysisComplete = async (analysis: Partial<RaceAnalysis>) => {
    if (!user) return;

    try {
      setSubmitting(true);

      // Fetch sailor_profile to get the correct ID
      const { data: sailorProfile, error: profileError } = await supabase
        .from('sailor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[PostRaceAnalysisCard] Error fetching sailor profile:', profileError);
        showAlert('Error', 'Could not find your sailor profile. Please complete onboarding first.');
        return;
      }

      if (!sailorProfile) {
        console.error('[PostRaceAnalysisCard] No sailor profile found for user:', user.id);
        showAlert('Profile Required', 'Please complete your sailor profile in onboarding before submitting race analysis.');
        return;
      }

      // Save analysis to database using sailor_profile.id
      const analysisData = {
        race_id: raceId,
        sailor_id: sailorProfile.id,
        ...analysis,
      };

      let savedAnalysis: any = null;
      let saveError: any = null;
      const primarySave = await supabase
        .from('race_analysis')
        .upsert(analysisData, {
          onConflict: 'race_id,sailor_id',
        })
        .select()
        .single();
      savedAnalysis = primarySave.data;
      saveError = primarySave.error;

      if (isMissingIdColumn(saveError, 'race_analysis', 'race_id')) {
        const fallbackSave = await supabase
          .from('race_analysis')
          .upsert(
            {
              regatta_id: raceId,
              sailor_id: sailorProfile.id,
              ...analysis,
            },
            {
              onConflict: 'regatta_id,sailor_id',
            }
          )
          .select()
          .single();
        savedAnalysis = fallbackSave.data;
        saveError = fallbackSave.error;
      }

      if (saveError) {
        console.error('[PostRaceAnalysisCard] Error saving analysis:', saveError);
        console.error('[PostRaceAnalysisCard] Error details:', {
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint,
          code: saveError.code,
        });
        console.error('[PostRaceAnalysisCard] Analysis data:', analysisData);
        showAlert('Error', `Failed to save analysis: ${saveError.message}`);
        return;
      }

      // Generate coaching feedback using BetterAt Playbook frameworks (via Edge Function)
      logger.debug('[PostRaceAnalysisCard] Calling generate-race-coaching edge function...');

      const { data: coaching, error: coachingError } = await supabase.functions.invoke(
        'generate-race-coaching',
        {
          body: {
            analysis: savedAnalysis,
            race: {
              id: raceId,
              name: raceName,
            },
          },
        }
      );

      if (coachingError) {
        console.error('[PostRaceAnalysisCard] Coaching generation failed:', coachingError);
        throw new Error(`Coaching generation failed: ${coachingError.message}`);
      }

      if (!coaching) {
        console.error('[PostRaceAnalysisCard] No coaching data returned');
        throw new Error('No coaching data returned from edge function');
      }

      // Save coaching feedback back to database
      const { error: updateError } = await supabase
        .from('race_analysis')
        .update({
          ai_coaching_feedback: coaching.coaching_feedback,
          framework_scores: coaching.framework_scores,
        })
        .eq('id', savedAnalysis.id);

      if (updateError) {
        console.error('[PostRaceAnalysisCard] Error updating coaching:', updateError);
      }

      // Update local state
      setExistingAnalysis(savedAnalysis as RaceAnalysis);
      setCoachingData(coaching);

      // Show coach share prompt after analysis is complete
      setShowCoachPrompt(true);

      const highlightNotes = Array.isArray(coaching.coaching_feedback)
        ? (coaching.coaching_feedback as CoachingFeedback[])
            .map(
              feedback =>
                feedback.playbook_recommendation ||
                feedback.next_race_focus ||
                feedback.execution_feedback ||
                ''
            )
            .filter(Boolean)
            .slice(0, 3)
        : [];

      await coachingService.notifyCoachesOfRaceAnalysis({
        sailorUserId: user.id,
        sailorName: user.user_metadata?.full_name || (user.email ?? undefined),
        raceId,
        raceName,
        analysisSummary: coaching.overall_assessment || undefined,
        highlights: highlightNotes.length > 0 ? highlightNotes : undefined,
      });

      setShowForm(false);
      setShowCoaching(true);
    } catch (error) {
      console.error('[PostRaceAnalysisCard] Error:', error);
      showAlert('Error', 'Failed to generate coaching. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewCoaching = async () => {
    // If no coaching data exists, generate it first
    if (!coachingData && existingAnalysis) {
      try {
        setSubmitting(true);

        logger.debug('[PostRaceAnalysisCard] Generating missing coaching data...');

        const { data: coaching, error: coachingError } = await supabase.functions.invoke(
          'generate-race-coaching',
          {
            body: {
              analysis: existingAnalysis,
              race: {
                id: raceId,
                name: raceName,
              },
            },
          }
        );

        if (coachingError) {
          console.error('[PostRaceAnalysisCard] Coaching generation failed:', coachingError);
          showAlert('Error', `Failed to generate coaching: ${coachingError.message}`);
          return;
        }

        if (!coaching) {
          console.error('[PostRaceAnalysisCard] No coaching data returned');
          showAlert('Error', 'No coaching data returned. Please try again.');
          return;
        }

        // Save coaching feedback to database
        const { error: updateError } = await supabase
          .from('race_analysis')
          .update({
            ai_coaching_feedback: coaching.coaching_feedback,
            framework_scores: coaching.framework_scores,
          })
          .eq('id', existingAnalysis.id);

        if (updateError) {
          console.error('[PostRaceAnalysisCard] Error updating coaching:', updateError);
        }

        // Update local state
        setCoachingData(coaching);
        setShowCoaching(true);
      } catch (error) {
        console.error('[PostRaceAnalysisCard] Error generating coaching:', error);
        showAlert('Error', 'Failed to generate coaching. Please try again.');
      } finally {
        setSubmitting(false);
      }
    } else {
      setShowCoaching(true);
    }
  };

  const handleEditAnalysis = () => {
    setShowForm(true);
  };

  /**
   * Handle BetterAt Playbook framework demo clicks
   */
  const handleDemoClick = (demoNumber: number) => {
    const demoContent: Record<number, { title: string; description: string; url?: string }> = {
      1: {
        title: 'Puff Response Framework',
        description: 'Kevin teaches: "This is a TRIM response, not a HELM response!"\n\nWhen a puff hits:\n✅ DO: Ease traveler down to reduce heel\n❌ DON\'T: Feather (turn boat into wind)\n\nWhy? Traveler maintains speed and pointing while managing heel. Feathering loses boatspeed.',
        url: 'https://regattaflowplaybook.com',
      },
      2: {
        title: 'Wind Shift Mathematics',
        description: 'Kevin\'s Formula: "10° shift = 25% of boat separation"\n\nExample: You\'re 4 boat lengths ahead\n• 10° shift = 1 boat length gained/lost\n• 20° shift = 2 boat lengths!\n\nThis is why shift awareness is THE most important upwind skill.',
        url: 'https://regattaflowplaybook.com',
      },
      3: {
        title: 'Delayed Tack (Signature Move)',
        description: 'Kevin\'s 1-on-1 Winning Move:\n\n1. Cross ahead of opponent\n2. DON\'T tack immediately\n3. Sail SHORT (2-3 boat lengths)\n4. THEN tack\n\nWhy? Forces them to overstand or sail in your bad air. They can\'t tack without losing.',
        url: 'https://regattaflowplaybook.com',
      },
      4: {
        title: 'Shift Frequency Formula',
        description: 'Kevin teaches closing speed on shifts:\n\nClosing Speed = Wind Speed ± VMG difference\n\nOn a lift: You gain 2× VMG difference\nOn a header: Opponent gains 2× VMG difference\n\nThis is why you MUST tack on headers!',
        url: 'https://regattaflowplaybook.com',
      },
      5: {
        title: 'Getting In Phase',
        description: 'Kevin: "Round the windward mark on the LIFTED tack"\n\nWhy?\n✅ Sets you up IN PHASE for downwind\n✅ First jibe takes you TOWARD next shift\n✅ You\'re on the inside of oscillations\n\n❌ Round on headed = OUT OF PHASE = Catch-up mode',
        url: 'https://regattaflowplaybook.com',
      },
      6: {
        title: 'Downwind Shift Detection',
        description: 'Kevin: "Apparent wind moves AFT WITHOUT getting STRONGER = you\'re being LIFTED → JIBE!"\n\nFeel the apparent wind on your body:\n• Moves forward = Header (don\'t jibe yet)\n• Moves aft + stronger = More wind (don\'t jibe)\n• Moves aft + NO stronger = LIFT = JIBE NOW!',
        url: 'https://regattaflowplaybook.com',
      },
      7: {
        title: 'Performance Pyramid',
        description: 'Kevin\'s Learning Order:\n\n1. BOAT HANDLING (must be second nature)\n2. BOAT SPEED (must be second to none)\n3. TACTICS (then tactics will win races)\n\nYou can\'t think tactically if you\'re fighting the boat. Master handling and speed FIRST.',
        url: 'https://regattaflowplaybook.com',
      },
    };

    const demo = demoContent[demoNumber];
    if (!demo) {
      showConfirm(
        'Framework Demo',
        'Open the BetterAt Playbook for the full framework library?',
        () => Linking.openURL('https://regattaflowplaybook.com')
      );
      return;
    }

    if (demo.url) {
      showAlertWithButtons(
        demo.title,
        demo.description,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Learn More at BetterAt Playbook',
            onPress: () => Linking.openURL(demo.url!),
          },
        ]
      );
    } else {
      showAlert(demo.title, demo.description);
    }
  };

  // Don't show if race hasn't happened yet
  if (!isRaceCompleted) {
    return null;
  }

  if (loading) {
    return (
      <StrategyCard
        icon="clipboard-text"
        title="Post-Race Analysis"
        expandable={false}
      >
        <ActivityIndicator size="small" color="#007AFF" />
      </StrategyCard>
    );
  }

  // No analysis yet - show prompt
  if (!existingAnalysis) {
    return (
      <>
        <StrategyCard
          icon="clipboard-text"
          title="Post-Race Analysis"
          badge="🏆 BetterAt Playbook"
          expandable={false}
        >
          <View style={styles.promptContainer}>
            {loadErrorMessage && (
              <View style={styles.errorState}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B91C1C" />
                <Text style={styles.errorStateText}>{loadErrorMessage}</Text>
              </View>
            )}
            <View style={styles.promptIcon}>
              <MaterialCommunityIcons
                name="clipboard-check-outline"
                size={48}
                color="#007AFF"
              />
            </View>
            <Text style={styles.promptTitle}>Complete Your Post-Race Analysis</Text>
            <Text style={styles.promptDescription}>
              Get championship-level coaching from the BetterAt Playbook frameworks.
              Learn exactly what to improve for your next race.
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartAnalysis}
              disabled={!!loadErrorMessage}
            >
              <MaterialCommunityIcons name="rocket-launch" size={20} color="#fff" />
              <Text style={styles.startButtonText}>Start Analysis (12 min)</Text>
            </TouchableOpacity>
            {loadErrorMessage && (
              <TouchableOpacity style={styles.retryButton} onPress={loadExistingAnalysis}>
                <Text style={styles.retryButtonText}>Retry loading analysis</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.playbookNote}>
              💡 Powered by the BetterAt Playbook's 40+ years of championship coaching
            </Text>
          </View>
        </StrategyCard>

        {/* Analysis Form Modal */}
        <Modal
          visible={showForm}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowForm(false)}
        >
          <View style={styles.modalContainer}>
            <PostRaceAnalysisForm
              raceId={raceId}
              existingAnalysis={existingAnalysis || undefined}
              onComplete={handleAnalysisComplete}
              onCancel={() => setShowForm(false)}
            />
            {submitting && (
              <View style={styles.submittingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.submittingText}>
                  Generating Kevin's coaching...
                </Text>
              </View>
            )}
          </View>
        </Modal>
      </>
    );
  }

  // Analysis complete - show summary with option to view coaching
  return (
    <>
      <StrategyCard
        icon="trophy"
        title="Post-Race Analysis"
        badge="✅ Complete"
        expandable={true}
        defaultExpanded={false}
      >
        <View style={styles.completeContainer}>
          {/* Overall Score */}
          {existingAnalysis.framework_scores?.overall_framework_adoption !== undefined && (
            <View style={styles.scoreSection}>
              <Text style={styles.scoreLabel}>Framework Adoption</Text>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreValue}>
                  {existingAnalysis.framework_scores.overall_framework_adoption}
                </Text>
                <Text style={styles.scoreOutOf}>/100</Text>
              </View>
            </View>
          )}

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            {existingAnalysis.overall_satisfaction && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Overall</Text>
                <Text style={styles.statValue}>
                  {'⭐'.repeat(existingAnalysis.overall_satisfaction)}
                </Text>
              </View>
            )}
            {existingAnalysis.upwind_puff_handling && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Puff Response</Text>
                <Text style={styles.statValue}>
                  {existingAnalysis.upwind_puff_handling === 'traveler' ? '✅' : '⚡'}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.viewCoachingButton}
            onPress={handleViewCoaching}
          >
            <MaterialCommunityIcons name="school" size={20} color="#fff" />
            <Text style={styles.viewCoachingButtonText}>
              View Kevin's Coaching
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setShowShareSheet(true)}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color="#10B981" />
            <Text style={styles.shareButtonText}>Share Analysis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditAnalysis}
          >
            <MaterialCommunityIcons name="pencil" size={18} color="#007AFF" />
            <Text style={styles.editButtonText}>Edit Analysis</Text>
          </TouchableOpacity>
        </View>
      </StrategyCard>

      {/* Execution Evaluation - Compare plan vs actual */}
      {sailorId && (
        <ExecutionEvaluationCard
          raceId={raceId}
          sailorId={sailorId}
          onEvaluationUpdated={() => {
            // Optionally reload analysis to get updated execution data
            loadExistingAnalysis();
          }}
        />
      )}

      {/* Coaching Modal */}
      {coachingData && (
        <Modal
          visible={showCoaching}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowCoaching(false)}
        >
          <View style={styles.coachingModalContainer}>
            <View style={styles.coachingHeader}>
              <TouchableOpacity onPress={() => setShowCoaching(false)}>
                <MaterialCommunityIcons name="close" size={28} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.coachingHeaderTitle}>Kevin's Coaching</Text>
              <View style={{ width: 28 }} />
            </View>
            <RegattaFlowPlaybookCoaching
              analysis={existingAnalysis}
              coachingFeedback={coachingData.coaching_feedback}
              frameworkScores={coachingData.framework_scores}
              onDemoClick={handleDemoClick}
            />
          </View>
        </Modal>
      )}

      {/* Analysis Form Modal (for editing) */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalContainer}>
          <PostRaceAnalysisForm
            raceId={raceId}
            existingAnalysis={existingAnalysis}
            onComplete={handleAnalysisComplete}
            onCancel={() => setShowForm(false)}
          />
          {submitting && (
            <View style={styles.submittingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.submittingText}>
                Generating Kevin's coaching...
              </Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Coach Share Prompt - One-tap sharing after analysis */}
      <CoachSharePrompt
        visible={showCoachPrompt}
        onDismiss={() => setShowCoachPrompt(false)}
        sailorId={sailorId || ''}
        raceId={raceId}
        raceName={raceName}
        shareType="post_race"
        onShareComplete={(result) => {
          logger.info('Coach share completed:', result);
        }}
      />

      {/* Sharing Sheet */}
      {existingAnalysis && (
        <UnifiedSharingSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          context="post-race"
          content={{
            context: 'post-race',
            raceId,
            raceName,
            raceDate: raceStartTime || new Date().toISOString(),
            postRace: {
              raceInfo: {
                id: raceId,
                name: raceName,
                date: raceStartTime || new Date().toISOString(),
              },
              result: existingAnalysis.position ? {
                position: existingAnalysis.position,
                fleetSize: existingAnalysis.fleet_size || 0,
              } : undefined,
              analysis: existingAnalysis,
              coachingFeedback: coachingData?.coaching_feedback,
              frameworkScores: coachingData?.framework_scores || existingAnalysis.framework_scores,
              keyLearning: existingAnalysis.key_learnings?.[0],
            },
          }}
          sailorId={sailorId || ''}
          onShareComplete={(result) => {
            logger.info('Share completed:', result);
            if (result.success) {
              setShowShareSheet(false);
            }
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  promptContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  promptIcon: {
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  promptDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  playbookNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 16,
    textAlign: 'center',
  },
  completeContainer: {
    paddingVertical: 16,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  scoreCircle: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  scoreOutOf: {
    fontSize: 14,
    color: '#64748B',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  viewCoachingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  viewCoachingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginBottom: 8,
  },
  shareButtonText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  submittingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  coachingModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  coachingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  coachingHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  errorState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorStateText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '500',
  },
  retryButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#F8FAFF',
  },
  retryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
