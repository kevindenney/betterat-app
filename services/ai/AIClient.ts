import { getAICircuitBreaker } from '@/lib/utils/aiCircuitBreaker';
import { shouldTriggerFallback, activateFallbackMode } from '@/lib/utils/aiFallback';

/** Must match the constant in invokeAIEdgeFunction.ts */
const AI_EDGE_FUNCTION_TIMEOUT_MS = 60_000;

/**
 * Provider-agnostic model identifier.
 * The actual model used is determined by the edge function's AI provider config.
 * These values are kept for backward compatibility with existing callers.
 */
export type AIModelId = 'claude-3-5-sonnet-20240620' | 'claude-3-5-haiku-20241022';

export interface AIRequest {
  model: AIModelId;
  system?: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIRawResponse {
  provider: string;
  modelRequested: string;
  durationMs: number;
  response: unknown;
}

export interface AIResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  raw: AIRawResponse;
}

export class AIClient {
  protected readonly apiUrl = 'supabase.functions.race-coaching-chat';

  private isNodeRuntime(): boolean {
    return typeof process !== 'undefined' && Boolean(process.versions?.node);
  }

  private async invokeEdgeFunction(
    functionName: string,
    body: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string; detail?: unknown } | null }> {
    if (!this.isNodeRuntime()) {
      // Dynamic import to avoid pulling in React Native / Expo dependencies
      // (services/supabase.ts) when running in a Vercel serverless function.
      const { invokeAIEdgeFunction } = await import('./invokeAIEdgeFunction');
      return invokeAIEdgeFunction(functionName, { body });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        data: null,
        error: {
          message:
            'Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server AI invocation',
        },
      };
    }

    const edgeUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), AI_EDGE_FUNCTION_TIMEOUT_MS);

    try {
      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      const rawText = await response.text();
      let parsed: unknown = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
      }

      if (!response.ok) {
        return {
          data: null,
          error: {
            message: `Edge function ${functionName} failed (${response.status})`,
            detail: parsed,
          },
        };
      }

      return { data: parsed, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Edge function ${functionName} invocation failed`;
      return {
        data: null,
        error: { message },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createMessage(request: AIRequest): Promise<AIResponse> {
    const breaker = getAICircuitBreaker();

    return breaker.execute(async () => {
      const start = Date.now();
      const promptSections: string[] = [];

      if (request.system) {
        promptSections.push(request.system);
      }
      for (const msg of request.messages) {
        promptSections.push(`[${msg.role}] ${msg.content}`);
      }
      const prompt = promptSections.join('\n\n').trim();

      const { data, error } = await this.invokeEdgeFunction('race-coaching-chat', {
        prompt,
        max_tokens: request.maxTokens ?? 1024,
      });
      if (error) {
        const apiError = new Error(`AI API error: ${error.message}`);
        // Sync circuit breaker state with global fallback mode
        if (shouldTriggerFallback(apiError)) {
          activateFallbackMode(error.message);
        }
        throw apiError;
      }

      const dataObj = data !== null && typeof data === 'object' ? data as Record<string, unknown> : {};
      const text = typeof dataObj.text === 'string' ? dataObj.text.trim() : '';

      const durationMs = Date.now() - start;
      return {
        text,
        tokensIn: 0,
        tokensOut: 0,
        raw: { provider: 'race-coaching-chat', modelRequested: request.model, durationMs, response: data },
      };
    });
  }
}

// Backward-compatible aliases
/** @deprecated Use AIModelId */
export type ClaudeModel = AIModelId;
/** @deprecated Use AIMessage */
export type ClaudeMessage = AIMessage;
/** @deprecated Use AIRequest */
export type ClaudeRequest = AIRequest;
/** @deprecated Use AIResponse */
export type ClaudeResponse = AIResponse;
/** @deprecated Use AIRawResponse */
export type ClaudeRawResponse = AIRawResponse;
/** @deprecated Use AIClient */
export const ClaudeClient = AIClient;
