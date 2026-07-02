import { skillManagementService } from './SkillManagementService';
import { createLogger } from '@/lib/utils/logger';
import { cachedAICall } from '@/lib/utils/aiCache';
import {
  generateMockRigTuning,
  isAIInFallbackMode,
  isAPIOverloadError,
  shouldTriggerFallback,
  activateFallbackMode
} from '@/lib/utils/aiFallback';
import { BOAT_TUNING_SKILL_CONTENT } from '@/skills/tuning-guides/boatTuningSkill';
import type {
  RaceTuningRequest,
  RaceTuningRecommendation,
  RaceTuningSetting
} from '@/services/RaceTuningService';
import type { ExtractedSection } from '@/services/TuningGuideExtractionService';
import { supabase, SUPABASE_CONFIG_ERROR } from '@/services/supabase';

const logger = createLogger('RaceTuningEngine');

interface CandidateGuideInfo {
  id: string;
  title: string;
  source: string;
  year?: number | null;
  tags?: string[];
  rig?: string | null;
  mast?: string | null;
  sailmaker?: string | null;
  hull?: string | null;
}

export interface RaceTuningCandidate {
  guide: CandidateGuideInfo;
  section: Pick<ExtractedSection, 'title' | 'content' | 'conditions'> & {
    settings: Record<string, string>;
  };
  score: number;
}

interface GenerateParams extends RaceTuningRequest {
  candidates: RaceTuningCandidate[];
}

interface SkillSetting {
  key?: string;
  rawKey?: string;
  label?: string;
  value?: string;
}

interface SkillRecommendation {
  guideId?: string;
  guideTitle?: string;
  guideSource?: string;
  sectionTitle?: string;
  conditionSummary?: string;
  notes?: string | string[];
  settings?: SkillSetting[];
  tags?: string[];
  confidence?: number;
  matchScore?: number;
  caveats?: string[];
}

class RaceTuningEngine {
  private customSkillId: string | null = null;
  private skillInitialized = false;
  private skillInitializationPromise: Promise<void> | null = null;
  private skillInitializationError: string | null = null;

  constructor() {
    if (this.isAvailable()) {
      logger.debug('Boat tuning engine ready with secure edge-function AI');
      void this.ensureSkillInitialized();
    } else {
      logger.debug('Boat tuning engine running in fallback mode (Supabase configuration missing)');
    }
  }

  private createTaggedError(code: string, message: string, cause?: unknown): Error {
    const tagged = new Error(`[${code}] ${message}`);
    (tagged as any).code = code;
    if (cause !== undefined) {
      (tagged as any).cause = cause;
    }
    return tagged;
  }

  private async invokeTuningChat(
    prompt: string,
    maxTokens: number,
    temperature: number,
    system?: string
  ): Promise<string> {
    const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
      body: {
        prompt,
        max_tokens: maxTokens,
        temperature,
        system
      }
    });

    if (error) {
      throw this.createTaggedError(
        'AI_TUNING_CHAT_FAILED',
        error.message || 'race-coaching-chat invocation failed',
        error
      );
    }

    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) {
      throw this.createTaggedError('AI_TUNING_EMPTY_RESPONSE', 'race-coaching-chat returned no text');
    }

    return text;
  }

  isAvailable(): boolean {
    return !SUPABASE_CONFIG_ERROR;
  }

  isSkillReady(): boolean {
    return this.skillInitialized;
  }

  getSkillInitializationError(): string | null {
    return this.skillInitializationError;
  }

  /**
   * Generate AI-only recommendations without any tuning guides
   * Uses skill content as system prompt to reduce tokens (~60% savings)
   * Includes caching (10 min) and fallback when credits exhausted
   */
  async generateAIOnlyRecommendations(request: RaceTuningRequest): Promise<RaceTuningRecommendation[]> {
    logger.debug('generateAIOnlyRecommendations invoked', {
      available: this.isAvailable(),
    });

    // Check if we're in fallback mode due to credit exhaustion
    if (isAIInFallbackMode()) {
      logger.info('Using fallback mode for rig tuning (credits exhausted)');
      const mockRec = generateMockRigTuning({
        className: request.className || request.classId || undefined,
        windSpeed: request.averageWindSpeed ?? undefined,
      });
      return [this.transformAIOnlyRecommendation(mockRec)];
    }

    if (!this.isAvailable()) {
      throw this.createTaggedError(
        'AI_TUNING_UNAVAILABLE',
        SUPABASE_CONFIG_ERROR
          ? `AI rig tuning unavailable: ${SUPABASE_CONFIG_ERROR}`
          : 'AI rig tuning unavailable: Supabase configuration is missing'
      );
    }

    await this.ensureSkillInitialized();

    const {
      classId,
      className,
      averageWindSpeed,
      windMin,
      windMax,
      windDirection,
      gusts,
      waveHeight,
      currentSpeed,
      currentDirection,
      pointsOfSail = 'all'
    } = request;

    const weatherContext = {
      windSpeed: averageWindSpeed,
      windMin,
      windMax,
      windDirection,
      gusts,
      waveHeight,
      currentSpeed,
      currentDirection
    };

    // Cache key for this specific request (10 min TTL)
    const cacheKey = {
      type: 'rig-tuning',
      classId: classId || className,
      windSpeed: Math.round(averageWindSpeed || 0),
      pointsOfSail,
    };

    logger.debug('AI-only tuning request', {
      boatClass: className || classId,
      pointsOfSail,
      windSpeed: averageWindSpeed,
    });

    // Use cached response if available (saves ~$0.01-0.02 per request)
    return cachedAICall(
      cacheKey,
      async () => this.callAIForTuning(className || classId || 'Unknown', pointsOfSail, weatherContext),
      10 * 60 * 1000 // 10 minute cache
    );
  }

  /**
   * Internal method to call AI for tuning recommendations
   * Uses skill content as system prompt to reduce tokens
   */
  private async callAIForTuning(
    boatClass: string,
    pointsOfSail: string,
    weatherContext: Record<string, any>
  ): Promise<RaceTuningRecommendation[]> {
    // Minimal user prompt - skill content handles the context (saves ~60% tokens)
    const userPrompt = `Generate rig tuning for:
- Boat: ${boatClass}
- Point of Sail: ${pointsOfSail}
- Conditions: ${JSON.stringify(weatherContext)}

Return JSON array with ONE recommendation. No guides uploaded - use physics-based reasoning.`;

    try {
      const combinedText = await this.invokeTuningChat(
        userPrompt,
        2000,
        0.5,
        BOAT_TUNING_SKILL_CONTENT
      );

      logger.debug('AI response text', {
        combinedTextLength: combinedText.length,
        combinedTextPreview: combinedText.substring(0, 500),
        hasOpenBracket: combinedText.includes('['),
        hasOpenBrace: combinedText.includes('{'),
      });

      if (!combinedText) {
        throw new Error('AI rig tuning returned no content');
      }

      // Try to extract JSON from response (can be array or single object)
      // First, try to find JSON in markdown code blocks
      let jsonText = combinedText;
      let isWrappedObject = false;

      // Remove markdown code blocks if present
      const codeBlockMatch = combinedText.match(/```(?:json)?\s*([\[{][\s\S]*?[\]}])\s*```/);

      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
        isWrappedObject = jsonText.trim().startsWith('{');
      } else {
        // Find the first [ or { to determine JSON type
        const firstBracket = combinedText.indexOf('[');
        const firstBrace = combinedText.indexOf('{');

        if (firstBracket === -1 && firstBrace === -1) {
          // AI may decline to generate - this is expected when no tuning guides exist
          logger.debug('No JSON found in AI response (AI may have declined)', {
            responsePreview: combinedText.substring(0, 200),
            responseLength: combinedText.length,
          });
          // Check if it's an error response or refusal (expanded patterns)
          const lowerResponse = combinedText.toLowerCase();
          if (lowerResponse.includes('sorry') ||
              lowerResponse.includes('cannot') ||
              lowerResponse.includes('unable') ||
              lowerResponse.includes("can't") ||
              lowerResponse.includes('not able') ||
              lowerResponse.includes('don\'t have') ||
              lowerResponse.includes('no data') ||
              lowerResponse.includes('not available') ||
              lowerResponse.includes('unfortunately')) {
            throw this.createTaggedError(
              'AI_TUNING_DECLINED',
              `AI declined to generate tuning: ${combinedText.substring(0, 300)}`
            );
          }
          throw this.createTaggedError('AI_TUNING_INVALID_RESPONSE', 'Unable to find JSON in AI rig tuning response');
        }

        // Use whichever comes first (or the one that exists)
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
          // Object comes first
          isWrappedObject = true;
          jsonText = combinedText.substring(firstBrace);
        } else {
          // Array comes first
          jsonText = combinedText.substring(firstBracket);
        }
      }

      // Clean up the JSON text - find the matching bracket
      const openBracket = isWrappedObject ? '{' : '[';
      const closeBracket = isWrappedObject ? '}' : ']';
      let bracketCount = 0;
      let lastValidIndex = -1;

      for (let i = 0; i < jsonText.length; i++) {
        if (jsonText[i] === openBracket) bracketCount++;
        if (jsonText[i] === closeBracket) {
          bracketCount--;
          if (bracketCount === 0) {
            lastValidIndex = i;
            break;
          }
        }
      }

      if (lastValidIndex === -1) {
        throw this.createTaggedError('AI_TUNING_INVALID_RESPONSE', 'Unable to find valid JSON structure in AI response');
      }

      const cleanedJson = jsonText.substring(0, lastValidIndex + 1);

      let parsed;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch (parseError: any) {
        logger.error('JSON parse error', {
          error: parseError.message,
          jsonLength: cleanedJson.length,
          jsonPreview: cleanedJson.substring(0, 200),
          fullResponse: combinedText.substring(0, 500),
        });
        throw this.createTaggedError('AI_TUNING_PARSE_ERROR', `Failed to parse JSON: ${parseError.message}`, parseError);
      }

      // Wrap single object in array for consistent processing
      if (!Array.isArray(parsed)) {
        if (typeof parsed === 'object' && parsed !== null) {
          parsed = [parsed];
        } else {
          throw this.createTaggedError('AI_TUNING_INVALID_RESPONSE', 'AI rig tuning response was not a valid JSON object or array');
        }
      }

      return parsed.map(item => this.transformAIOnlyRecommendation(item));
    } catch (error: any) {
      // Handle credit exhaustion OR API overload gracefully
      if (shouldTriggerFallback(error)) {
        const reason = isAPIOverloadError(error)
          ? 'Anthropic API overloaded (529)'
          : 'Anthropic API credit balance too low';
        activateFallbackMode(reason);
        logger.warn('Activating fallback mode', { reason, errorStatus: error?.status || error?.statusCode });
        const mockRec = generateMockRigTuning({
          className: boatClass,
          windSpeed: weatherContext.windSpeed,
        });
        return [this.transformAIOnlyRecommendation(mockRec)];
      }

      // AI declining is expected when no tuning guides exist - not an error
      logger.debug('AI rig tuning generation did not produce results', { message: (error as Error)?.message?.substring(0, 100) });
      const message = (error as Error)?.message || 'Unknown rig tuning generation error';
      if (message.includes('[AI_TUNING_')) {
        throw error;
      }
      throw this.createTaggedError('AI_TUNING_GENERATION_FAILED', message, error);
    }
  }

  async generateRecommendations(params: GenerateParams): Promise<RaceTuningRecommendation[]> {
    const { candidates, limit = 1, classId, className, averageWindSpeed, pointsOfSail } = params;

    // Check if we're in fallback mode due to credit exhaustion or API overload
    if (isAIInFallbackMode()) {
      logger.info('Using fallback mode for rig tuning (API unavailable)');
      const mockRec = generateMockRigTuning({
        className: className || classId || undefined,
        windSpeed: averageWindSpeed ?? undefined,
      });
      return [this.transformAIOnlyRecommendation(mockRec)];
    }

    if (!this.isAvailable()) {
      throw new Error(
        SUPABASE_CONFIG_ERROR
          ? `Boat tuning recommendations unavailable: ${SUPABASE_CONFIG_ERROR}`
          : 'Boat tuning recommendations unavailable: Supabase configuration is missing'
      );
    }

    await this.ensureSkillInitialized();
    if (!candidates || candidates.length === 0) {
      logger.debug('No tuning guide candidates available; falling back to AI-only recommendation');
      return this.generateAIOnlyRecommendations({
        classId,
        className,
        averageWindSpeed,
        pointsOfSail,
        limit,
      });
    }

    const trimmedCandidates = candidates.slice(0, Math.max(limit, 3));
    const payload = {
      request: {
        classId: classId ?? null,
        className: className ?? null,
        averageWindSpeed: averageWindSpeed ?? null,
        pointsOfSail: pointsOfSail ?? 'all',
        limit
      },
      candidates: trimmedCandidates
    };

    const instruction = `You are the Boat Tuning Analyst skill. Use the provided candidate tuning sections to build championship-ready rig settings.

Return a JSON array where each element matches:
{
  "guideId": "string (use provided candidate guide id)",
  "guideTitle": "string",
  "guideSource": "string",
  "sectionTitle": "string",
  "conditionSummary": "string",
  "notes": ["optional array of strings"],
  "settings": [
    {
      "key": "snake_case identifier",
      "rawKey": "original setting name",
      "label": "human readable label",
      "value": "exact trim value"
    }
  ],
  "tags": ["optional tags"],
  "confidence": 0-1 (optional),
  "matchScore": 0-1 (optional),
  "caveats": ["optional strings"]
}

Rules:
- Only recommend from the provided candidate sections or clearly state if no match fits.
- Preserve the units and precision from the source.
- If no suitable candidate exists, return an empty array.
- Respond with raw JSON only (no markdown, no prose).

Context:
${JSON.stringify(payload, null, 2)}`;

    try {
      const combinedText = await this.invokeTuningChat(instruction, 2000, 0.5);
      if (!combinedText) {
        throw new Error('Boat tuning skill returned no text content');
      }

      // Try to extract JSON from response (can be array or single object)
      let jsonText = combinedText;
      let isWrappedObject = false;

      // Remove markdown code blocks if present
      const codeBlockMatch = combinedText.match(/```(?:json)?\s*([\[{][\s\S]*?[\]}])\s*```/);

      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
        isWrappedObject = jsonText.trim().startsWith('{');
      } else {
        // Find the first [ or { to determine JSON type
        const firstBracket = combinedText.indexOf('[');
        const firstBrace = combinedText.indexOf('{');

        if (firstBracket === -1 && firstBrace === -1) {
          logger.debug('No JSON found in boat tuning skill response', {
            responsePreview: combinedText.substring(0, 500),
          });
          throw new Error('Unable to find JSON in boat tuning skill response');
        }

        // Use whichever comes first (or the one that exists)
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
          // Object comes first
          isWrappedObject = true;
          jsonText = combinedText.substring(firstBrace);
        } else {
          // Array comes first
          jsonText = combinedText.substring(firstBracket);
        }
      }

      // Clean up the JSON text - find the matching bracket
      const openBracket = isWrappedObject ? '{' : '[';
      const closeBracket = isWrappedObject ? '}' : ']';
      let bracketCount = 0;
      let lastValidIndex = -1;

      for (let i = 0; i < jsonText.length; i++) {
        if (jsonText[i] === openBracket) bracketCount++;
        if (jsonText[i] === closeBracket) {
          bracketCount--;
          if (bracketCount === 0) {
            lastValidIndex = i;
            break;
          }
        }
      }

      if (lastValidIndex === -1) {
        throw new Error('Unable to find valid JSON structure in boat tuning skill response');
      }

      const cleanedJson = jsonText.substring(0, lastValidIndex + 1);

      let parsed;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch (parseError: any) {
        logger.debug('JSON parse error in boat tuning skill', {
          error: parseError.message,
          jsonLength: cleanedJson.length,
          jsonPreview: cleanedJson.substring(0, 200),
          fullResponse: combinedText.substring(0, 500),
        });
        throw new Error(`Failed to parse JSON from boat tuning skill: ${parseError.message}`);
      }

      // Wrap single object in array for consistent processing
      if (!Array.isArray(parsed)) {
        if (typeof parsed === 'object' && parsed !== null) {
          parsed = [parsed];
        } else {
          throw new Error('Boat tuning skill response was not a valid JSON object or array');
        }
      }

      return parsed
        .map(item => this.transformSkillRecommendation(item))
        .filter(rec => rec.settings.length > 0);
    } catch (error: any) {
      // Handle credit exhaustion OR API overload gracefully
      if (shouldTriggerFallback(error)) {
        const reason = isAPIOverloadError(error)
          ? 'Anthropic API overloaded (529)'
          : 'Anthropic API credit balance too low';
        activateFallbackMode(reason);
        logger.warn('Activating fallback mode in generateRecommendations', { reason, errorStatus: error?.status || error?.statusCode });
        const mockRec = generateMockRigTuning({
          className: className || classId || undefined,
          windSpeed: averageWindSpeed ?? undefined,
        });
        return [this.transformAIOnlyRecommendation(mockRec)];
      }

      const message = (error as Error)?.message || 'Unknown guide-based tuning generation error';
      const shouldDegradeToGuideOnly =
        message.includes('Unable to find JSON in boat tuning skill response') ||
        message.includes('Unable to find valid JSON structure in boat tuning skill response') ||
        message.includes('Failed to parse JSON from boat tuning skill') ||
        message.includes('Boat tuning skill response was not a valid JSON object or array');
      if (shouldDegradeToGuideOnly) {
        logger.debug('Boat tuning skill response invalid; degrading to guide-only recommendations', {
          message: message.substring(0, 240),
        });
        throw this.createTaggedError('AI_TUNING_INVALID_RESPONSE', message, error);
      }
      if (message.includes('[AI_TUNING_')) {
        logger.debug('Boat tuning skill fallback triggered', {
          message: message.substring(0, 240),
        });
        throw error;
      }
      logger.error('Boat tuning skill generation failed', error);
      throw this.createTaggedError('AI_TUNING_GUIDE_GENERATION_FAILED', message, error);
    }
  }

  private async ensureSkillInitialized(): Promise<void> {
    if (this.skillInitialized || !this.isAvailable()) {
      return;
    }

    if (this.skillInitializationPromise) {
      await this.skillInitializationPromise;
      return;
    }

    this.skillInitializationPromise = this.initializeSkill();
    try {
      await this.skillInitializationPromise;
    } finally {
      this.skillInitializationPromise = null;
    }
  }

  private async initializeSkill(): Promise<void> {
    try {
      const skillId = await skillManagementService.initializeBoatTuningSkill();
      if (skillId) {
        this.customSkillId = skillId;
        this.skillInitialized = true;
        this.skillInitializationError = null;
        logger.debug(`Boat tuning skill initialized: ${skillId}`);
      } else {
        this.skillInitializationError = 'Boat tuning skill unavailable; using fallback prompt mode';
        logger.debug('Boat tuning skill not available, continuing without custom skill container');
      }
    } catch (error) {
      this.skillInitializationError =
        error instanceof Error ? error.message : 'Unknown skill initialization error';
      logger.error('Failed to initialize boat tuning skill', error);
    }
  }

  /**
   * NEW: Transform AI-only recommendation (includes isAIGenerated flag and extra fields)
   */
  private transformAIOnlyRecommendation(item: any): RaceTuningRecommendation {
    const guideTitle = item.guideTitle?.trim() || 'AI Rig Tuning Analysis';
    const guideSource = item.guideSource?.trim() || 'BetterAt AI Rig Tuning Analyst';
    const guideId = item.guideId?.trim() || 'ai-generated-tuning';

    const settings = Array.isArray(item.settings)
      ? item.settings
          .map((setting: any) => this.transformSettingWithReasoning(setting))
          .filter((setting: any): setting is RaceTuningSetting => Boolean(setting))
      : [];

    const notesArray = Array.isArray(item.notes) ? item.notes : (item.notes ? [item.notes] : []);
    const weatherNotes = Array.isArray(item.weatherSpecificNotes) ? item.weatherSpecificNotes : [];
    const caveats = Array.isArray(item.caveats) ? item.caveats : [];

    return {
      guideId,
      guideTitle,
      guideSource,
      sectionTitle: item.sectionTitle?.trim() || undefined,
      conditionSummary: item.conditionSummary?.trim() || undefined,
      notes: notesArray.length > 0 ? notesArray.join('\n') : undefined,
      settings,
      isAIGenerated: true,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.75,
      weatherSpecificNotes: weatherNotes,
      caveats
    };
  }

  private transformSkillRecommendation(item: SkillRecommendation): RaceTuningRecommendation {
    const guideTitle = item.guideTitle?.trim() || 'Boat Tuning Recommendation';
    const guideSource = item.guideSource?.trim() || 'AI Boat Tuning Analyst';
    const guideId = item.guideId?.trim() || this.buildGuideId(guideTitle);

    const settings = Array.isArray(item.settings)
      ? item.settings
          .map(setting => this.transformSetting(setting))
          .filter((setting): setting is RaceTuningSetting => Boolean(setting))
      : [];

    const notesArray = Array.isArray(item.notes) ? item.notes : (item.notes ? [item.notes] : []);

    return {
      guideId,
      guideTitle,
      guideSource,
      sectionTitle: item.sectionTitle?.trim() || undefined,
      conditionSummary: item.conditionSummary?.trim() || undefined,
      notes: notesArray.length > 0 ? notesArray.join('\n') : undefined,
      settings
    };
  }

  /**
   * NEW: Transform setting with reasoning field for AI-only recommendations
   */
  private transformSettingWithReasoning(setting: any): RaceTuningSetting | null {
    if (!setting) return null;
    const value = typeof setting.value === 'string' ? setting.value.trim() : '';
    if (!value) return null;

    const rawKey = setting.rawKey?.trim() || setting.key?.trim() || '';
    const key = (setting.key ?? rawKey).replace(/\s+/g, '_').toLowerCase();
    const label = setting.label?.trim() || this.toTitleCase(rawKey || key);
    const reasoning = setting.reasoning?.trim() || undefined;

    if (!key) {
      return null;
    }

    return {
      key,
      rawKey: rawKey || undefined,
      label,
      value,
      reasoning
    };
  }

  private transformSetting(setting: SkillSetting): RaceTuningSetting | null {
    if (!setting) return null;
    const value = typeof setting.value === 'string' ? setting.value.trim() : '';
    if (!value) return null;

    const rawKey = setting.rawKey?.trim() || setting.key?.trim() || '';
    const key = (setting.key ?? rawKey).replace(/\s+/g, '_').toLowerCase();
    const label = setting.label?.trim() || this.toTitleCase(rawKey || key);

    if (!key) {
      return null;
    }

    return {
      key,
      rawKey: rawKey || undefined,
      label,
      value
    };
  }

  private buildGuideId(title: string): string {
    return `ai-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-');
  }

  private toTitleCase(value: string): string {
    return value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}

export const raceTuningEngine = new RaceTuningEngine();
