/**
 * Generate Race Coaching Edge Function
 *
 * Analyzes post-race responses using the BetterAt Playbook frameworks
 * and provides personalized coaching feedback.
 *
 * Security: Runs server-side to protect Anthropic API key
 * Performance: Uses Claude 3.5 Haiku for cost-effective coaching
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const { analysis, race } = await req.json();

    if (!analysis || !race) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: analysis and race' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Analyze each framework
    const feedback = [];
    const scores = {};

    // 1. Puff Response Framework
    if (analysis.upwind_puff_handling) {
      const puffScore = calculatePuffResponseScore(analysis.upwind_puff_handling);
      scores.puff_response = puffScore;

      feedback.push({
        phase: 'upwind',
        playbook_framework: 'Puff Response Framework',
        your_approach: getPuffApproachDescription(analysis.upwind_puff_handling),
        playbook_recommendation: getPlaybookPuffRecommendation(analysis.upwind_puff_handling),
        confidence: puffScore,
        impact: puffScore < 50 ? 'high' : puffScore < 80 ? 'medium' : 'low',
        next_race_focus: getPuffNextFocus(analysis.upwind_puff_handling),
        demo_reference: './demo 1',
      });
    }

    // 2. Delayed Tack Usage
    if (analysis.upwind_tactics_used && analysis.upwind_tactics_used.length > 0) {
      const usesDelayedTack = analysis.upwind_tactics_used.includes('delayed_tack');
      const tacticsScore = usesDelayedTack ? 95 : 40;
      scores.delayed_tack_usage = tacticsScore;

      feedback.push({
        phase: 'upwind',
        playbook_framework: 'Delayed Tack (Signature Move)',
        your_approach: usesDelayedTack
          ? 'You used the delayed tack in 1-on-1 situations'
          : 'You did not use the delayed tack',
        playbook_recommendation: usesDelayedTack
          ? "✅ Excellent! This is one of Kevin's signature moves. Keep using it: Cross → Sail SHORT → THEN tack."
          : "🎯 Try Kevin's delayed tack: When you cross ahead, DON'T tack immediately. Sail SHORT first (2-3 boat lengths), THEN tack. This forces them to overstand or take bad air.",
        confidence: tacticsScore,
        impact: usesDelayedTack ? 'medium' : 'high',
        next_race_focus: usesDelayedTack
          ? 'Perfect your timing - sail just far enough short'
          : 'Practice delayed tack in 1-on-1 situations',
        demo_reference: './demo 3',
      });
    }

    // 3. Shift Awareness
    if (analysis.upwind_shift_awareness) {
      const shiftScore = analysis.upwind_shift_awareness * 20;
      scores.shift_awareness = shiftScore;

      feedback.push({
        phase: 'upwind',
        playbook_framework: 'Wind Shift Mathematics',
        your_approach: `You rated your shift awareness as ${analysis.upwind_shift_awareness}/5`,
        playbook_recommendation: getShiftRecommendation(analysis.upwind_shift_awareness),
        confidence: shiftScore,
        impact: shiftScore < 60 ? 'high' : 'medium',
        next_race_focus: getShiftNextFocus(analysis.upwind_shift_awareness),
        demo_reference: './demo 4',
      });
    }

    // 4. Downwind Shift Detection
    if (analysis.downwind_shift_detection) {
      const detectionScore = calculateDownwindDetectionScore(
        analysis.downwind_shift_detection
      );
      scores.downwind_detection = detectionScore;

      feedback.push({
        phase: 'downwind',
        playbook_framework: 'Downwind Shift Detection',
        your_approach: getDownwindApproachDescription(analysis.downwind_shift_detection),
        playbook_recommendation: getDownwindRecommendation(analysis.downwind_shift_detection),
        confidence: detectionScore,
        impact: detectionScore < 60 ? 'high' : 'medium',
        next_race_focus: getDownwindNextFocus(analysis.downwind_shift_detection),
        demo_reference: './demo 6',
      });
    }

    // 5. Getting In Phase (Windward Mark)
    if (analysis.windward_mark_approach_tack) {
      const inPhaseScore = calculateInPhaseScore(analysis.windward_mark_approach_tack);
      scores.getting_in_phase = inPhaseScore;

      feedback.push({
        phase: 'windward_mark',
        playbook_framework: 'Getting In Phase',
        your_approach: getMarkApproachDescription(analysis.windward_mark_approach_tack),
        playbook_recommendation: getMarkRecommendation(analysis.windward_mark_approach_tack),
        confidence: inPhaseScore,
        impact: inPhaseScore < 70 ? 'high' : 'medium',
        next_race_focus: getMarkNextFocus(analysis.windward_mark_approach_tack),
        demo_reference: './demo 5',
      });
    }

    // Calculate overall framework adoption
    const scoreValues = Object.values(scores).filter((s) => typeof s === 'number');
    const overallScore =
      scoreValues.length > 0
        ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
        : 50;

    scores.overall_framework_adoption = overallScore;

    return new Response(
      JSON.stringify({
        coaching_feedback: feedback,
        framework_scores: scores,
        overall_assessment: getOverallAssessment(overallScore),
        next_race_priorities: getNextRacePriorities(feedback),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[generate-race-coaching] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to generate race coaching',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

// Helper functions

function calculatePuffResponseScore(handling: string): number {
  const scores: Record<string, number> = {
    traveler: 95,
    mainsheet: 70,
    feathered: 30,
    not_sure: 20,
  };
  return scores[handling] || 50;
}

function getPuffApproachDescription(handling: string): string {
  const descriptions: Record<string, string> = {
    traveler: 'You eased the traveler when puffs hit',
    mainsheet: 'You eased the mainsheet when puffs hit',
    feathered: 'You feathered the boat (turned up into wind) when puffs hit',
    not_sure: "You're not sure how you handled puffs",
  };
  return descriptions[handling] || 'Unknown puff handling method';
}

function getPlaybookPuffRecommendation(handling: string): string {
  if (handling === 'traveler') {
    return '✅ Perfect! This is EXACTLY what Kevin teaches: "Puff response is a TRIM decision, not a HELM decision." Traveler down maintains speed and pointing.';
  }
  if (handling === 'mainsheet') {
    return '🎯 Good, but traveler is better! Kevin says: "Traveler down is more efficient than mainsheet because it maintains twist while reducing heel."';
  }
  if (handling === 'feathered') {
    return '❌ Kevin teaches: "TRIM response, not HELM response!" Feathering loses boatspeed. Use traveler down instead to maintain speed while managing heel.';
  }
  return "🎯 Learn Kevin's puff response framework: Use the TRAVELER, not the helm. This is one of the most important skills in sailboat racing.";
}

function getPuffNextFocus(handling: string): string {
  if (handling === 'traveler') return 'Perfect your traveler timing - ease just before puff hits';
  if (handling === 'mainsheet') return 'Switch from mainsheet to traveler for puff response';
  if (handling === 'feathered') return 'Stop feathering - use traveler instead';
  return 'Practice traveler puff response on every beat';
}

function getShiftRecommendation(awareness: number): string {
  if (awareness >= 4) {
    return '✅ Excellent shift awareness! Kevin says: "A 10° shift creates 25% of the boat separation between you and your competitors." Keep this quantitative mindset.';
  }
  if (awareness >= 3) {
    return '🎯 Good awareness, but work on quantifying shifts. Kevin teaches: "10° = 25% separation." Start calling out shift degrees to your crew.';
  }
  return '❌ Shift awareness is THE most important upwind skill. Kevin teaches: "If you can\'t read shifts, you can\'t win races." Focus on this before anything else.';
}

function getShiftNextFocus(awareness: number): string {
  if (awareness >= 4) return 'Quantify shifts in degrees during races';
  if (awareness >= 3) return 'Track shift patterns pre-race';
  return 'Learn to feel 5° shifts in your body';
}

function calculateDownwindDetectionScore(method: string): number {
  const scores: Record<string, number> = {
    apparent_wind: 95,
    compass: 75,
    schooled_upwind_boats: 60,
    didnt_track: 20,
  };
  return scores[method] || 50;
}

function getDownwindApproachDescription(method: string): string {
  const descriptions: Record<string, string> = {
    apparent_wind: 'You tracked shifts using apparent wind direction',
    compass: 'You tracked shifts using a compass',
    schooled_upwind_boats: 'You learned from boats sailing upwind',
    didnt_track: "You didn't actively track shifts downwind",
  };
  return descriptions[method] || 'Unknown shift detection method';
}

function getDownwindRecommendation(method: string): string {
  if (method === 'apparent_wind') {
    return '✅ Perfect! Kevin teaches: "Apparent wind moving AFT WITHOUT getting STRONGER means you\'re being LIFTED → JIBE!" This is the fastest method.';
  }
  if (method === 'compass') {
    return '🎯 Compass works but is slower than apparent wind. Kevin teaches: Watch for apparent wind moving aft without strengthening - that\'s your jibe signal.';
  }
  return '❌ You need a systematic shift detection method. Kevin teaches: "Apparent wind aft + NO stronger = LIFT = JIBE!" This is the key to downwind speed.';
}

function getDownwindNextFocus(method: string): string {
  if (method === 'apparent_wind') return 'Call out shifts to crew immediately';
  if (method === 'compass') return 'Switch to apparent wind method';
  return 'Practice feeling apparent wind shifts';
}

function calculateInPhaseScore(approach: string): number {
  if (approach.includes('lifted')) return 95;
  if (approach.includes('headed')) return 40;
  return 60;
}

function getMarkApproachDescription(approach: string): string {
  const tack = approach.includes('starboard') ? 'starboard' : 'port';
  const phase = approach.includes('lifted') ? 'lifted' : 'headed';
  return `You rounded on ${tack} tack while ${phase}`;
}

function getMarkRecommendation(approach: string): string {
  if (approach.includes('lifted')) {
    return '✅ Excellent! Kevin teaches: "Round the windward mark on the LIFTED tack so you\'re IN PHASE for the downwind leg." This sets up your first jibe perfectly.';
  }
  return '❌ Kevin teaches: "Never round on the HEADED tack!" You want to be LIFTED (in phase) going downwind so your first jibe takes you toward the next shift.';
}

function getMarkNextFocus(approach: string): string {
  if (approach.includes('lifted')) return 'Time your final tack to round lifted';
  return 'Plan final approach to round on lifted tack';
}

function getOverallAssessment(score: number): string {
  if (score >= 85) return 'Outstanding framework adoption! You\'re racing like a champion.';
  if (score >= 70) return 'Solid framework usage! Keep building these habits.';
  if (score >= 50) return 'Good start! Focus on your weakest frameworks for biggest gains.';
  return 'Huge opportunity! Master just ONE framework and you\'ll see immediate improvement.';
}

function getNextRacePriorities(feedback: any[]): string[] {
  return feedback
    .filter((f) => f.impact === 'high')
    .slice(0, 3)
    .map((f) => f.next_race_focus);
}
