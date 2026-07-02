/**
 * Enhanced AI Integration Service
 * Orchestrates the integration of yacht club educational content with BetterAt's AI systems
 * Demonstrates how RHKYC seminars and sailing.org.hk content enhance strategic recommendations
 */

import { DocumentProcessingService } from './DocumentProcessingService';
import { sailingEducationService } from './SailingEducationService';
import { regionalIntelligenceService } from '../venue/RegionalIntelligenceService';
import type {
  DocumentUpload,
  DocumentAnalysis,
  StrategyInsight,
  SafetyProtocol,
  CulturalProtocol,
  EquipmentRecommendation,
  CompetitiveIntelligence
} from '@/lib/types/ai-knowledge';

export interface EnhancedAIResponse {
  originalAnalysis: DocumentAnalysis;
  educationalEnhancements: {
    safetyProtocols: SafetyProtocol[];
    culturalProtocols: CulturalProtocol[];
    equipmentRecommendations: EquipmentRecommendation[];
    competitiveIntelligence: CompetitiveIntelligence[];
    educationalInsights: StrategyInsight[];
  };
  venueSpecificIntelligence: any;
  integrationMetadata: {
    enhancementSources: string[];
    confidenceBoost: number;
    educationalFramework: string[];
    applicabilityScore: number;
  };
  recommendations: {
    immediate: string[];
    preparation: string[];
    longTerm: string[];
  };
}

export interface AIProcessingContext {
  venueId?: string;
  raceType?: 'fleet_racing' | 'match_racing' | 'team_racing';
  conditions?: {
    wind?: { speed: number; direction: number };
    weather?: string;
    season?: 'monsoon' | 'winter' | 'summer';
  };
  sailorProfile?: {
    experience: 'novice' | 'intermediate' | 'expert';
    international: boolean;
    boatClass?: string;
  };
}

export class EnhancedAIIntegrationService {
  private documentProcessor: DocumentProcessingService;

  constructor() {
    this.documentProcessor = new DocumentProcessingService();
  }

  /**
   * Process document with full educational enhancement
   * This is where the magic happens - combining AI analysis with yacht club training standards
   */
  async processDocumentWithEducationalEnhancement(
    upload: DocumentUpload,
    context: AIProcessingContext = {}
  ): Promise<EnhancedAIResponse> {

    try {
      // Step 1: Standard AI document analysis
      const originalAnalysis = await this.documentProcessor.uploadDocument(upload);

      // Step 2: Get educational strategy for the query context
      const educationalStrategy = await sailingEducationService.getEducationallyEnhancedStrategy(
        `Analyze sailing document: ${upload.filename}`,
        context.venueId,
        context
      );

      // Step 3: Get venue-specific intelligence if venue provided
      let venueIntelligence = null;
      if (context.venueId) {
        venueIntelligence = await regionalIntelligenceService.loadVenueIntelligence({
          id: context.venueId,
          name: this.getVenueName(context.venueId),
        } as any);
      }

      // Step 4: Create educational insights specific to the document
      const educationalInsights = await this.generateEducationalInsights(
        originalAnalysis,
        context
      );

      // Step 5: Calculate confidence boost from educational framework
      const confidenceBoost = this.calculateEducationalConfidenceBoost(
        originalAnalysis,
        educationalStrategy,
        context
      );

      // Step 6: Generate specific recommendations
      const recommendations = await this.generateEnhancedRecommendations(
        originalAnalysis,
        educationalStrategy,
        venueIntelligence,
        context
      );

      const enhancedResponse: EnhancedAIResponse = {
        originalAnalysis,
        educationalEnhancements: {
          safetyProtocols: educationalStrategy.safetyConsiderations,
          culturalProtocols: educationalStrategy.culturalProtocols,
          equipmentRecommendations: educationalStrategy.equipmentRecommendations,
          competitiveIntelligence: educationalStrategy.competitiveAdvantages,
          educationalInsights,
        },
        venueSpecificIntelligence: venueIntelligence,
        integrationMetadata: {
          enhancementSources: [
            'Professional sailing education standards',
            'Yacht club training programs',
            'Regional sailing intelligence',
            'Cultural adaptation protocols'
          ],
          confidenceBoost,
          educationalFramework: [
            'Safety-first approach from yacht club training',
            'Tactical analysis using professional sailing standards',
            'Cultural awareness from international racing education',
            'Equipment recommendations from sailing organization guidelines'
          ],
          applicabilityScore: this.calculateApplicabilityScore(context),
        },
        recommendations,
      };

      return enhancedResponse;

    } catch (error: any) {

      throw new Error(`Enhanced AI processing failed: ${error.message}`);
    }
  }

  /**
   * Generate educational insights specific to the document content
   */
  private async generateEducationalInsights(
    analysis: DocumentAnalysis,
    context: AIProcessingContext
  ): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Safety-focused insights based on yacht club standards
    if (analysis.documentClass === 'sailing_instructions' || analysis.documentClass === 'safety_guide') {
      insights.push({
        type: 'safety',
        title: 'Professional Safety Standards Application',
        description: 'This document should be reviewed against yacht club safety training standards',
        confidence: 0.9,
        tacticalAdvice: 'Cross-reference safety requirements with professional sailing education protocols',
        applicableConditions: ['All racing conditions'],
        safetyConsiderations: 'Apply yacht club safety briefing standards',
        educationalValue: 'Reinforces professional sailing safety education principles',
      });
    }

    // Cultural insights for international racing
    if (context.sailorProfile?.international && context.venueId) {
      insights.push({
        type: 'cultural',
        title: 'International Racing Cultural Preparation',
        description: 'Cultural adaptation recommended based on venue and sailing education standards',
        confidence: 0.8,
        tacticalAdvice: 'Review local sailing customs and yacht club protocols before competition',
        applicableConditions: ['International racing venues'],
        culturalContext: 'Informed by professional sailing education cultural training',
        educationalValue: 'Develops cultural competency for international sailing competition',
      });
    }

    // Tactical insights enhanced with educational framework
    if (analysis.insights.length > 0) {
      insights.push({
        type: 'tactical',
        title: 'Educationally Enhanced Tactical Analysis',
        description: 'Original tactical insights enhanced with yacht club training principles',
        confidence: 0.85,
        tacticalAdvice: 'Apply professional sailing education tactical framework to racing decisions',
        applicableConditions: analysis.insights[0]?.applicableConditions || ['Racing conditions'],
        educationalValue: 'Integrates yacht club tactical training with document-specific insights',
      });
    }

    return insights;
  }

  /**
   * Calculate confidence boost from educational framework
   */
  private calculateEducationalConfidenceBoost(
    analysis: DocumentAnalysis,
    educationalStrategy: any,
    context: AIProcessingContext
  ): number {
    let boost = 0;

    // Base boost for educational framework
    boost += 0.1;

    // Additional boost for venue-specific content
    if (context.venueId) {
      boost += 0.05;
    }

    // Boost for safety protocols
    if (educationalStrategy.safetyConsiderations?.length > 0) {
      boost += 0.1;
    }

    // Boost for cultural protocols
    if (educationalStrategy.culturalProtocols?.length > 0) {
      boost += 0.05;
    }

    // Boost for experience matching
    if (context.sailorProfile) {
      boost += 0.05;
    }

    return Math.min(boost, 0.3); // Cap at 30% boost
  }

  /**
   * Calculate applicability score based on context
   */
  private calculateApplicabilityScore(context: AIProcessingContext): number {
    let score = 0.5; // Base score

    if (context.venueId) score += 0.2;
    if (context.raceType) score += 0.1;
    if (context.conditions) score += 0.1;
    if (context.sailorProfile) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Generate enhanced recommendations based on all available intelligence
   */
  private async generateEnhancedRecommendations(
    analysis: DocumentAnalysis,
    educationalStrategy: any,
    venueIntelligence: any,
    context: AIProcessingContext
  ): Promise<EnhancedAIResponse['recommendations']> {
    const immediate: string[] = [];
    const preparation: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions
    immediate.push('Review document content against professional sailing education standards');
    if (analysis.safetyProtocols?.length) {
      immediate.push('Verify safety equipment and procedures meet yacht club training requirements');
    }
    if (context.venueId) {
      immediate.push(`Study ${context.venueId} specific sailing conditions and protocols`);
    }

    // Preparation recommendations
    preparation.push('Complete relevant yacht club educational seminars or briefings');
    if (context.sailorProfile?.international) {
      preparation.push('Attend cultural briefing and protocol orientation for international racing');
    }
    if (educationalStrategy.equipmentRecommendations?.length) {
      preparation.push('Verify equipment compliance with professional sailing standards');
    }

    // Long-term development
    longTerm.push('Develop comprehensive sailing education plan based on professional yacht club standards');
    longTerm.push('Build venue-specific expertise through continued education and experience');
    if (context.sailorProfile?.experience !== 'expert') {
      longTerm.push('Progress through structured sailing education program with yacht club or sailing organization');
    }

    return { immediate, preparation, longTerm };
  }

  /**
   * Simulate processing yacht club educational resources (like RHKYC content)
   */
  async processYachtClubEducationalContent(
    clubName: string,
    contentUrls: string[],
    venueId: string
  ): Promise<{
    resourcesProcessed: number;
    insightsExtracted: number;
    applicableVenues: string[];
    educationalValue: string[];
  }> {

    // Simulate content analysis (in production, this would fetch and process actual content)
    const simulatedContent = {
      safetyTraining: [
        'Offshore Racing Safety Preparation',
        'Emergency Procedures and Protocols',
        'Weather Assessment and Risk Management',
        'Crew Briefing Standards',
      ],
      tacticalSeminars: [
        'Local Harbor Navigation and Racing',
        'Monsoon Season Sailing Strategies',
        'Dragon Class Racing Techniques',
        'Commercial Traffic Management',
        'Cultural Racing Protocols',
      ],
      rulesEducation: [
        'International Racing Rules Application',
        'Protest Procedures and Arbitration',
        'ORC Rating System Optimization',
        'Results Officer Training Standards',
      ],
      culturalGuidance: [
        'International Crew Integration',
        'Yacht Club Protocol and Etiquette',
        'Regional Racing Customs',
        'Cross-cultural Communication in Racing',
      ],
    };

    // Process the content through our educational service
    const resource = await sailingEducationService.processYachtClubEducation(
      clubName,
      simulatedContent,
      [venueId]
    );

    const totalInsights = resource.content.safetyProtocols.length +
                         resource.content.tacticalInsights.length +
                         resource.content.culturalGuidance.length +
                         resource.content.equipmentAdvice.length +
                         resource.content.competitiveIntelligence.length;

    return {
      resourcesProcessed: contentUrls.length,
      insightsExtracted: totalInsights,
      applicableVenues: resource.applicableVenues,
      educationalValue: [
        'Professional sailing safety standards integrated',
        'Cultural awareness and protocol education enhanced',
        'Tactical knowledge base expanded with local expertise',
        'Equipment recommendations aligned with professional standards',
        'Competitive intelligence enriched with yacht club training',
      ],
    };
  }

  /**
   * Demonstrate the full integration with a complete example
   */
  async demonstrateFullIntegration(venueId: string = 'hong-kong'): Promise<{
    educationalProcessing: any;
    enhancedDocumentAnalysis: EnhancedAIResponse;
    venueIntelligence: any;
    systemStatus: any;
  }> {

    // 1. Process yacht club educational content
    const educationalProcessing = await this.processYachtClubEducationalContent(
      'Royal Hong Kong Yacht Club',
      [
        'https://www.rhkyc.org.hk/storage/app/media/Sailing/Seminars/RHKYC%20Offshore%20Racing%20Safety%20Preparation_V2.0.pdf',
        'https://www.rhkyc.org.hk/storage/app/media/Sailing/Seminars/Harbour%20Secrets%202025.pdf',
        'https://www.rhkyc.org.hk/storage/app/media/Sailing/Seminars/ORC-Presentation-by-Zoran-Grubisa.pdf',
      ],
      venueId
    );

    // 2. Process a sample sailing document with full enhancement
    const sampleDocument: DocumentUpload = {
      filename: 'dragon_class_sailing_instructions_hong_kong.pdf',
      type: 'pdf',
      data: new ArrayBuffer(1024), // Mock data
      metadata: {
        venue: venueId,
        raceType: 'fleet_racing',
      },
    };

    const context: AIProcessingContext = {
      venueId,
      raceType: 'fleet_racing',
      conditions: {
        wind: { speed: 15, direction: 270 },
        weather: 'monsoon',
        season: 'monsoon',
      },
      sailorProfile: {
        experience: 'intermediate',
        international: true,
        boatClass: 'Dragon',
      },
    };

    const enhancedAnalysis = await this.processDocumentWithEducationalEnhancement(
      sampleDocument,
      context
    );

    // 3. Load venue intelligence
    const venueIntelligence = await regionalIntelligenceService.loadVenueIntelligence({
      id: venueId,
      name: 'Hong Kong',
    } as any);

    // 4. Get system status
    const systemStatus = {
      educationalService: sailingEducationService.getKnowledgeBaseStats(),
      documentProcessor: this.documentProcessor.getKnowledgeBaseStats(),
      integration: {
        status: 'active',
        enhancementActive: true,
        confidenceBoostRange: '10-30%',
        supportedVenues: ['hong-kong', 'san-francisco-bay', 'newport-rhode-island'],
      },
    };

    return {
      educationalProcessing,
      enhancedDocumentAnalysis: enhancedAnalysis,
      venueIntelligence,
      systemStatus,
    };
  }

  private getVenueName(venueId: string): string {
    const venueNames: Record<string, string> = {
      'hong-kong': 'Hong Kong',
      'san-francisco-bay': 'San Francisco Bay',
      'newport-rhode-island': 'Newport, Rhode Island',
    };
    return venueNames[venueId] || venueId;
  }
}

// Export singleton instance
export const enhancedAIIntegrationService = new EnhancedAIIntegrationService();
