/**
 * Coach Matching Agent
 * Autonomous AI agent for analyzing sailor performance, identifying skill gaps, and matching with coaches
 * Replaces manual AICoachMatchingService with self-directed multi-factor compatibility analysis
 */

import { BaseAgentService, AgentTool } from './BaseAgentService';
import { z } from 'zod';
import { supabase } from '@/services/supabase';
import type { CoachSearchResult, SailorProfile } from '@/types/coach';

export class CoachMatchingAgent extends BaseAgentService {
  constructor() {
    super({
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 2500,
      temperature: 0.5, // Balanced for personalized recommendations
      systemPrompt: `You are a sailing coach matching specialist for BetterAt's marketplace.

Your mission: Help sailors find the perfect coach by analyzing their performance, identifying skill gaps, and calculating multi-factor compatibility scores.

When a sailor requests a coach:
1. Analyze their recent race performance to identify trends and weaknesses
2. Identify specific skill gaps that need coaching attention
3. Search for coaches with relevant expertise (venue, boat class, specialty)
4. Calculate detailed compatibility scores across multiple factors
5. Generate personalized session recommendations

You have access to performance data, coach profiles, and session history.

Matching factors to consider:
- Experience match: Coach experience level vs sailor needs
- Teaching style: Does coach's approach match sailor's learning style?
- Specialty alignment: Does coach expertise match sailor's goals?
- Venue expertise: Has coach worked at sailor's target venues?
- Success rate: Coach's track record with similar sailors
- Availability: Does coach's schedule fit sailor's needs?
- Value: Price vs quality proposition

Always provide reasoning for your recommendations. Sailors trust you to find them the right coach.`,
    });

    // Register custom tools
    this.registerTool(this.createAnalyzePerformanceTool());
    this.registerTool(this.createIdentifySkillGapsTool());
    this.registerTool(this.createSearchCoachesTool());
    this.registerTool(this.createCalculateCompatibilityTool());
    this.registerTool(this.createGenerateSessionRecommendationsTool());
  }

  /**
   * Tool: Analyze sailor performance
   */
  private createAnalyzePerformanceTool(): AgentTool {
    return {
      name: 'analyze_sailor_performance',
      description: `Analyze a sailor's recent race performance to identify trends and patterns.
Use this first when matching a sailor with a coach.
Looks at race results, finishing positions, consistency, and improvement trends.
Returns performance metrics and initial weakness indicators.`,
      input_schema: z.object({
        sailorId: z.string().describe('The sailor user ID'),
        dateRange: z.object({
          start: z.string().optional(),
          end: z.string().optional(),
        }).optional().describe('Date range for analysis (defaults to last 6 months)'),
        venueId: z.string().optional().describe('Filter by specific venue'),
      }),
      execute: async (input) => {

        try {
          // Calculate date range
          const endDate = input.dateRange?.end || new Date().toISOString();
          const startDate = input.dateRange?.start || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

          // Query race results
          let query = supabase
            .from('regatta_results')
            .select('*')
            .eq('sailor_id', input.sailorId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

          if (input.venueId) {
            query = query.eq('venue_id', input.venueId);
          }

          const { data: results, error } = await query.limit(20);

          if (error) throw error;

          if (!results || results.length === 0) {
            return {
              success: false,
              message: 'No race results found for this sailor in the specified period.',
              suggestion: 'Try expanding the date range or checking if the sailor has logged race results.',
            };
          }

          // Calculate performance metrics
          const positions = results.map(r => r.finish_position);
          const totalBoats = results.map(r => r.total_boats);
          const percentiles = results.map((r, i) =>
            ((totalBoats[i] - positions[i]) / totalBoats[i]) * 100
          );

          const averagePosition = positions.reduce((a, b) => a + b, 0) / positions.length;
          const averagePercentile = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;

          // Detect trend (improving/declining)
          const recentResults = results.slice(0, 5);
          const olderResults = results.slice(5, 10);
          const recentAvg = recentResults.reduce((sum, r) =>
            sum + ((r.total_boats - r.finish_position) / r.total_boats), 0) / recentResults.length;
          const olderAvg = olderResults.length > 0
            ? olderResults.reduce((sum, r) =>
                sum + ((r.total_boats - r.finish_position) / r.total_boats), 0) / olderResults.length
            : recentAvg;

          const improving = recentAvg > olderAvg;

          // Calculate consistency (standard deviation of percentiles)
          const mean = averagePercentile;
          const variance = percentiles.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / percentiles.length;
          const stdDev = Math.sqrt(variance);
          const consistency = Math.max(0, Math.min(1, 1 - (stdDev / 50))); // Normalize to 0-1

          // Identify weak areas (simplistic - would be more sophisticated in production)
          const weakAreas: string[] = [];
          if (averagePercentile < 50) weakAreas.push('Overall results below fleet average');
          if (consistency < 0.6) weakAreas.push('Inconsistent performance - needs mental game or consistency training');
          if (!improving) weakAreas.push('Performance plateau or decline - needs new approach');

          return {
            success: true,
            recentResults: results.slice(0, 10).map(r => ({
              eventName: r.event_name,
              position: r.finish_position,
              totalBoats: r.total_boats,
              percentile: ((r.total_boats - r.finish_position) / r.total_boats * 100).toFixed(1),
              date: r.date,
            })),
            trends: {
              improving,
              averagePosition: averagePosition.toFixed(1),
              averagePercentile: averagePercentile.toFixed(1),
              consistency: consistency.toFixed(2),
              totalRaces: results.length,
            },
            weakAreas,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to analyze performance: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Identify skill gaps
   */
  private createIdentifySkillGapsTool(): AgentTool {
    return {
      name: 'identify_skill_gaps',
      description: `Identify specific skill gaps based on performance data and sailor profile.
Use this after analyzing performance to get actionable coaching focus areas.
Translates performance weaknesses into specific skills that can be coached.
Returns prioritized list of skill gaps with coaching recommendations.`,
      input_schema: z.object({
        performanceData: z.any().describe('Output from analyze_sailor_performance tool'),
        sailorProfile: z.object({
          experience: z.number(),
          boatClasses: z.array(z.string()),
          goals: z.string(),
          competitiveLevel: z.string(),
        }).describe('Sailor profile information'),
      }),
      execute: async (input) => {

        try {
          const { performanceData, sailorProfile } = input;
          const skillGaps: { skill: string; priority: string; reasoning: string }[] = [];

          // Analysis based on performance trends
          if (!performanceData.trends.improving) {
            skillGaps.push({
              skill: 'Race Strategy & Tactics',
              priority: 'high',
              reasoning: 'Performance plateau suggests need for advanced tactical training and race strategy refinement.',
            });
          }

          if (parseFloat(performanceData.trends.consistency) < 0.6) {
            skillGaps.push({
              skill: 'Mental Game & Consistency',
              priority: 'high',
              reasoning: 'Inconsistent results indicate need for mental training, pre-race routines, and pressure management.',
            });
          }

          if (parseFloat(performanceData.trends.averagePercentile) < 50) {
            if (sailorProfile.experience < 5) {
              skillGaps.push({
                skill: 'Boat Handling Fundamentals',
                priority: 'high',
                reasoning: 'Below-average results for less experienced sailor - focus on basic boat handling and speed.',
              });
            } else {
              skillGaps.push({
                skill: 'Upwind Speed & Technique',
                priority: 'high',
                reasoning: 'Experienced sailor with below-average results - likely upwind speed or tactical positioning issues.',
              });
            }
          }

          // Add goal-specific gaps
          if (sailorProfile.goals.toLowerCase().includes('championship') ||
              sailorProfile.goals.toLowerCase().includes('worlds')) {
            skillGaps.push({
              skill: 'Championship Preparation',
              priority: 'medium',
              reasoning: `Sailor has championship goals - needs specific preparation for major events.`,
            });
          }

          // Default gap if no specific issues identified
          if (skillGaps.length === 0) {
            skillGaps.push({
              skill: 'Performance Optimization',
              priority: 'medium',
              reasoning: 'Solid performance but always room for optimization and refinement.',
            });
          }

          return {
            success: true,
            skillGaps,
            summary: `Identified ${skillGaps.length} key areas for coaching focus.`,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to identify skill gaps: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Search coaches
   */
  private createSearchCoachesTool(): AgentTool {
    return {
      name: 'search_coaches_by_expertise',
      description: `Search for coaches with specific expertise matching sailor needs.
Use this after identifying skill gaps to find qualified coaches.
Filters by boat class, venue expertise, specialties, and availability.
Returns list of coaches with relevant experience.`,
      input_schema: z.object({
        boatClass: z.string().optional().describe('Boat class (e.g., "Dragon", "J/24")'),
        venueId: z.string().optional().describe('Specific venue expertise'),
        skillGaps: z.array(z.string()).optional().describe('Skills needing coaching'),
        maxResults: z.number().optional().default(10).describe('Maximum coaches to return'),
      }),
      execute: async (input) => {

        try {
          // Build query
          let query = supabase
            .from('coach_profiles')
            .select(`
              *,
              users!inner(first_name, last_name, email)
            `)
            .eq('is_active', true);

          // Filter by boat class if specified
          if (input.boatClass) {
            query = query.contains('boat_classes', [input.boatClass]);
          }

          // Filter by venue if specified
          if (input.venueId) {
            query = query.contains('venue_expertise', [input.venueId]);
          }

          const { data: coaches, error } = await query.limit(input.maxResults || 10);

          if (error) throw error;

          if (!coaches || coaches.length === 0) {
            return {
              success: false,
              message: 'No coaches found matching the specified criteria.',
              suggestion: 'Try broadening search criteria or searching without venue filter.',
            };
          }

          // Format results
          const formattedCoaches = coaches.map(coach => ({
            id: coach.id,
            name: `${coach.users.first_name} ${coach.users.last_name}`,
            yearsCoaching: coach.years_coaching,
            studentsCoached: coach.students_coached,
            boatClasses: coach.boat_classes,
            specialties: coach.specialties,
            averageRating: coach.average_rating,
            totalReviews: coach.total_reviews,
            location: coach.location,
            bio: coach.bio,
          }));

          return {
            success: true,
            coaches: formattedCoaches,
            count: formattedCoaches.length,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to search coaches: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Calculate compatibility scores
   */
  private createCalculateCompatibilityTool(): AgentTool {
    return {
      name: 'calculate_compatibility_scores',
      description: `Calculate detailed compatibility scores between sailor and coaches.
Use this after finding candidate coaches to rank them by fit.
Analyzes multiple factors: experience match, teaching style, specialty alignment, success rate, etc.
Returns scored and ranked coaches with detailed reasoning.`,
      input_schema: z.object({
        sailorProfile: z.object({
          experience: z.number(),
          boatClasses: z.array(z.string()),
          goals: z.string(),
          learningStyle: z.string().optional(),
        }).describe('Sailor profile'),
        coaches: z.array(z.any()).describe('Coach list from search_coaches_by_expertise'),
        skillGaps: z.array(z.any()).describe('Skill gaps from identify_skill_gaps'),
      }),
      execute: async (input) => {

        try {
          const scores = input.coaches.map(coach => {
            // Experience match (0-100)
            const experienceMatch = Math.min(100, (coach.yearsCoaching / 10) * 100);

            // Specialty alignment (0-100)
            const skillGapStrings = input.skillGaps.map((g: any) => g.skill.toLowerCase());
            const specialtyMatches = coach.specialties.filter((spec: string) =>
              skillGapStrings.some((skill: string) => skill.includes(spec.toLowerCase()))
            ).length;
            const specialtyAlignment = Math.min(100, (specialtyMatches / Math.max(1, skillGapStrings.length)) * 100);

            // Success rate relevance (based on rating and reviews)
            const successRateRelevance = Math.min(100, (coach.averageRating / 5) * 100);

            // Teaching style match (simplified - would use learning style analysis in production)
            const teachingStyleMatch = 75; // Default to good match

            // Availability match (simplified)
            const availabilityMatch = 80;

            // Location convenience (simplified)
            const locationConvenience = 70;

            // Value score (quality vs price)
            const valueScore = Math.min(100, (coach.averageRating / 5) * 90); // Simplified

            // Calculate overall score (weighted average)
            const overallScore = Math.round(
              experienceMatch * 0.2 +
              teachingStyleMatch * 0.15 +
              specialtyAlignment * 0.25 +
              successRateRelevance * 0.2 +
              availabilityMatch * 0.1 +
              locationConvenience * 0.05 +
              valueScore * 0.05
            );

            // Generate reasoning
            const reasoning = `${coach.name} has ${coach.yearsCoaching} years of coaching experience and specializes in ${coach.specialties.slice(0, 3).join(', ')}. With an average rating of ${coach.averageRating}/5 from ${coach.totalReviews} reviews, they have a proven track record. ${specialtyMatches > 0 ? `Their expertise directly matches ${specialtyMatches} of your skill development needs.` : 'They can provide well-rounded coaching across multiple areas.'}`;

            const recommendations = [
              specialtyAlignment > 70 ? 'Excellent specialty match for your specific needs' : 'Consider for general coaching and skill development',
              coach.totalReviews > 20 ? 'Extensive coaching track record with many satisfied students' : 'Building experience but shows strong potential',
              `Focus initial session on ${input.skillGaps[0]?.skill || 'performance assessment'}`,
            ];

            return {
              coachId: coach.id,
              coachName: coach.name,
              overallScore,
              breakdown: {
                experienceMatch: Math.round(experienceMatch),
                teachingStyleMatch: Math.round(teachingStyleMatch),
                specialtyAlignment: Math.round(specialtyAlignment),
                successRateRelevance: Math.round(successRateRelevance),
                availabilityMatch: Math.round(availabilityMatch),
                locationConvenience: Math.round(locationConvenience),
                valueScore: Math.round(valueScore),
              },
              reasoning,
              recommendations,
            };
          });

          // Sort by overall score
          scores.sort((a, b) => b.overallScore - a.overallScore);

          return {
            success: true,
            scores,
            topMatch: scores[0],
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to calculate compatibility: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Generate session recommendations
   */
  private createGenerateSessionRecommendationsTool(): AgentTool {
    return {
      name: 'generate_session_recommendations',
      description: `Generate personalized coaching session recommendations for sailor-coach pairing.
Use this after calculating compatibility scores to provide actionable session plan.
Creates detailed session structure, focus areas, expected outcomes, and preparation tips.
Returns complete session plan ready for booking.`,
      input_schema: z.object({
        sailorProfile: z.any().describe('Sailor profile'),
        matchedCoach: z.any().describe('Top matched coach from compatibility scores'),
        skillGaps: z.array(z.any()).describe('Prioritized skill gaps'),
      }),
      execute: async (input) => {

        try {
          const topSkillGap = input.skillGaps[0];

          const sessionPlan = `90-Minute Personalized Coaching Session Structure:

1. Introduction & Goal Setting (10 min)
   - Review recent race performance
   - Confirm focus areas: ${topSkillGap?.skill || 'Performance optimization'}
   - Set specific session objectives

2. On-Water Assessment (30 min)
   - Observe current technique and boat handling
   - Identify immediate improvement opportunities
   - Video analysis for post-session review

3. Focused Skill Development (40 min)
   - Targeted drills for ${topSkillGap?.skill || 'key skills'}
   - Real-time feedback and adjustment
   - Practice scenarios matching race conditions

4. Wrap-up & Action Plan (10 min)
   - Review progress and insights
   - Create practice plan for next 2 weeks
   - Schedule follow-up session if beneficial`;

          const focusAreas = input.skillGaps.slice(0, 3).map((gap: any) => gap.skill);

          const expectedOutcomes = [
            `Improved ${topSkillGap?.skill || 'racing skills'} with specific techniques`,
            'Clear understanding of current strengths and weaknesses',
            'Actionable practice plan for continued improvement',
            'Video analysis showing before/after comparisons',
            'Increased confidence in race execution',
          ];

          const preparationTips = [
            'Review recent race videos if available',
            'Prepare specific questions about challenges you\'ve faced',
            'Bring boat fully rigged and race-ready',
            'Have notebook or device for taking notes',
            `Share your goal: ${input.sailorProfile.goals}`,
          ];

          return {
            success: true,
            sessionPlan,
            focusAreas,
            expectedOutcomes,
            preparationTips,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to generate recommendations: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * High-level method: Complete coach matching workflow
   */
  async matchSailorWithCoach(
    sailorId: string,
    sailorProfile: SailorProfile,
    preferences: {
      boatClass?: string;
      venueId?: string;
      goals?: string;
    }
  ) {
    return this.run({
      userMessage: `Find the best coach for this sailor. Analyze their performance, identify what they need to work on, search for qualified coaches, calculate compatibility scores, and recommend a personalized coaching session.`,
      context: {
        sailorId,
        sailorProfile: {
          experience: sailorProfile.sailing_experience,
          boatClasses: sailorProfile.boat_classes || [],
          goals: preferences.goals || sailorProfile.goals || 'Improve racing performance',
          competitiveLevel: sailorProfile.competitive_level,
        },
        preferences,
      },
      maxIterations: 10, // Complex workflow with multiple analysis steps
    });
  }

  /**
   * High-level method: Quick coach search (skip performance analysis)
   */
  async searchCoachesQuick(criteria: {
    boatClass?: string;
    venueId?: string;
    skillGaps?: string[];
  }) {
    return this.run({
      userMessage: `Search for coaches matching these criteria and calculate compatibility scores.`,
      context: criteria,
      maxIterations: 4, // Simpler workflow
    });
  }
}

export default CoachMatchingAgent;
