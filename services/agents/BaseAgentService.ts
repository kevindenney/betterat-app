/**
 * Base Agent Service
 * Foundation for autonomous AI agents using Anthropic's SDK
 * Provides tool execution framework, error handling, and configuration
 *
 * IMPORTANT: This service should ONLY be used server-side (Edge Functions, Node.js).
 * For browser usage, create Supabase Edge Functions that call these agents.
 *
 * Example:
 * - ❌ Browser → Agent.run() (exposes API keys)
 * - ✅ Browser → Supabase Edge Function → Agent.run() (secure)
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('BaseAgentService');

// Tool definition using Zod schemas for type safety
export interface AgentTool {
  name: string;
  description: string;
  input_schema: z.ZodTypeAny;
  execute: (input: any) => Promise<any>;
}

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AgentRunOptions {
  userMessage: string;
  context?: Record<string, any>;
  maxIterations?: number;
}

export interface AgentRunResult {
  success: boolean;
  result: any;
  iterations: number;
  toolsUsed: string[];
  toolResults?: Record<string, any>; // Map of tool name to its last result
  error?: string;
}

/**
 * Detect if code is running in a browser environment
 */
function isBrowserEnvironment(): boolean {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return true;
  }
  return false;
}

function normalizeApiKey(rawKey: string | undefined): string | null {
  if (typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed === 'placeholder') return null;
  return trimmed;
}

export class BaseAgentService {
  protected client: Anthropic | null = null;
  protected tools: Map<string, AgentTool> = new Map();
  protected config: Required<AgentConfig>;
  private isServerSide: boolean;
  private hasApiKey: boolean = false;
  private static anthropicCtor: (new (config: { apiKey: string }) => Anthropic) | null = null;

  private async tryInitializeClient(): Promise<void> {
    if (!this.isServerSide || this.client) {
      return;
    }

    const apiKey = normalizeApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) {
      this.hasApiKey = false;
      return;
    }

    if (!BaseAgentService.anthropicCtor) {
      const module = await import('@anthropic-ai/sdk');
      BaseAgentService.anthropicCtor = module.default as new (config: { apiKey: string }) => Anthropic;
    }

    this.client = new BaseAgentService.anthropicCtor({ apiKey });
    this.hasApiKey = true;
  }

  protected async ensureClientReady(): Promise<boolean> {
    await this.tryInitializeClient();
    return Boolean(this.client && this.hasApiKey);
  }

  constructor(config: AgentConfig = {}) {
    // Detect environment
    this.isServerSide = !isBrowserEnvironment();

    if (!this.isServerSide) {

      // Don't throw immediately - allow imports and instantiation
      // Only fail when run() is actually called
      this.config = {
        model: config.model || 'claude-3-5-haiku-20241022',
        maxTokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
        systemPrompt: config.systemPrompt || 'You are a helpful AI assistant for BetterAt, a sailing race strategy platform.',
      };
      return; // Skip Anthropic client creation
    }

    void this.tryInitializeClient().catch((error) => {
      logger.error('Failed to initialize BaseAgentService Anthropic client', error);
    });

    this.config = {
      model: config.model || 'claude-3-5-haiku-20241022',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      systemPrompt: config.systemPrompt || 'You are a helpful AI assistant for BetterAt, a sailing race strategy platform.',
    };

  }

  /**
   * Register a custom tool for the agent to use
   */
  protected registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Convert Zod schema to Anthropic tool input schema format
   */
  private zodToAnthropicSchema(zodSchema: z.ZodTypeAny): any {
    // Convert Zod schema to JSON Schema format expected by Anthropic
    // This is a simplified conversion - extend as needed for complex schemas

    if (zodSchema instanceof z.ZodObject) {
      const shape = this.getObjectShape(zodSchema);
      const properties: Record<string, any> = {};
      const required: string[] = [];

      Object.entries(shape).forEach(([key, value]) => {
        properties[key] = this.zodSchemaToJsonSchema(value as z.ZodTypeAny);
        if (!(value as z.ZodTypeAny).isOptional()) {
          required.push(key);
        }
      });

      return {
        type: 'object',
        properties,
        required,
      };
    }

    return this.zodSchemaToJsonSchema(zodSchema);
  }

  /**
   * Convert individual Zod schema types to JSON Schema
   */
  private zodSchemaToJsonSchema(schema: z.ZodTypeAny): any {
    if (schema instanceof z.ZodString) {
      return { type: 'string', description: schema.description || '' };
    }
    if (schema instanceof z.ZodNumber) {
      return { type: 'number', description: schema.description || '' };
    }
    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean', description: schema.description || '' };
    }
    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodSchemaToJsonSchema(schema._def.type as any),
        description: schema.description || '',
      };
    }
    if (schema instanceof z.ZodObject) {
      const shape = this.getObjectShape(schema);
      const properties: Record<string, any> = {};
      const required: string[] = [];

      Object.entries(shape).forEach(([key, value]) => {
        properties[key] = this.zodSchemaToJsonSchema(value as z.ZodTypeAny);
        if (!(value as z.ZodTypeAny).isOptional()) {
          required.push(key);
        }
      });

      return {
        type: 'object',
        properties,
        required,
      };
    }
    if (schema instanceof z.ZodOptional) {
      return this.zodSchemaToJsonSchema(schema._def.innerType as any);
    }

    // Default fallback
    return { type: 'string', description: schema.description || '' };
  }

  /**
   * Zod object shape compatibility helper.
   * Some builds expose _def.shape as a function, others as a plain object.
   */
  private getObjectShape(schema: z.ZodObject<any>): Record<string, z.ZodTypeAny> {
    const shapeDef = (schema as any)?._def?.shape;
    if (typeof shapeDef === 'function') {
      return shapeDef();
    }
    return shapeDef || {};
  }

  /**
   * Execute a tool by name with validated input
   */
  private async executeTool(toolName: string, input: any): Promise<any> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      // Validate input against schema
      const validatedInput = tool.input_schema.parse(input);

      // Execute the tool
      const result = await tool.execute(validatedInput);

      return result;
    } catch (error: any) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  /**
   * Run the agent with user message and context
   * Agent will autonomously decide which tools to call and in what order
   */
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    // Check if running in browser
    if (!this.isServerSide) {
      const errorMessage = `
🚨 SECURITY ERROR: Cannot run agent in the browser!

This would expose your Anthropic API key to attackers.

SOLUTION:
1. Create a Supabase Edge Function for this agent
2. Call the Edge Function from your browser code instead

Example:
  // ❌ DON'T DO THIS (browser)
  const agent = new MyAgent();
  await agent.run({ userMessage: "..." });

  // ✅ DO THIS INSTEAD (browser → Edge Function)
  const { data } = await supabase.functions.invoke('my-agent-function', {
    body: { message: "..." }
  });

See: supabase/functions/extract-race-details/index.ts for an example
`;
      logger.error(errorMessage);
      return {
        success: false,
        result: null,
        iterations: 0,
        toolsUsed: [],
        error: 'BaseAgentService cannot run in the browser. Use Supabase Edge Functions instead.',
      };
    }

    // Re-attempt initialization at call time to handle environments
    // where secrets are loaded after service construction.
    if (!(await this.ensureClientReady())) {
      logger.error('Missing ANTHROPIC_API_KEY in server environment for BaseAgentService');
      return {
        success: false,
        result: null,
        iterations: 0,
        toolsUsed: [],
        error: 'ANTHROPIC_API_KEY is missing in server environment.',
      };
    }
    const client = this.client;
    if (!client) {
      return {
        success: false,
        result: null,
        iterations: 0,
        toolsUsed: [],
        error: 'Failed to initialize Anthropic client.',
      };
    }

    const { userMessage, context = {}, maxIterations = 10 } = options;
    const trimmedMessage = userMessage?.trim();
    if (!trimmedMessage) {
      return {
        success: false,
        result: null,
        iterations: 0,
        toolsUsed: [],
        error: 'userMessage is required',
      };
    }
    const safeMaxIterations = Math.max(1, Math.min(25, Math.floor(maxIterations)));

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: this.buildUserPrompt(trimmedMessage, context),
      },
    ];

    let iterations = 0;
    const toolsUsed: string[] = [];
    const toolResults: Record<string, any> = {}; // Track tool results

    try {
      while (iterations < safeMaxIterations) {
        iterations++;

        // Convert tools to Anthropic format
        const anthropicTools = Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: this.zodToAnthropicSchema(tool.input_schema),
        }));

        // Call Claude with tools
        const requestPayload: any = {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: this.config.systemPrompt,
          messages,
        };
        if (anthropicTools.length > 0) {
          requestPayload.tools = anthropicTools;
        }

        const response = await client.messages.create(requestPayload);

        // Check if agent wants to use a tool
        if (response.stop_reason === 'tool_use') {
          const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
          );

          if (toolUseBlocks.length === 0) {
            throw new Error('Agent requested tool use but no tools were specified');
          }

          // Execute all requested tools
          const toolResultMessages: Anthropic.MessageParam[] = [];

          for (const toolUse of toolUseBlocks) {
            toolsUsed.push(toolUse.name);

            try {
              const result = await this.executeTool(toolUse.name, toolUse.input);

              // Store the tool result for later access
              toolResults[toolUse.name] = result;

              toolResultMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result),
                  },
                ],
              });
            } catch (error: any) {
              // Return error to agent so it can decide how to proceed
              toolResultMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify({
                      error: error.message,
                      tool: toolUse.name,
                    }),
                    is_error: true,
                  },
                ],
              });
            }
          }

          // Add assistant response and tool results to conversation
          messages.push({
            role: 'assistant',
            content: response.content,
          });
          messages.push(...toolResultMessages);

          // Continue the loop - agent will decide what to do next
          continue;
        }

        // Agent finished without requesting tools - extract final response
        if (response.stop_reason === 'end_turn') {
          const textContent = response.content.find(
            (block): block is Anthropic.TextBlock => block.type === 'text'
          );

          return {
            success: true,
            result: textContent?.text || 'Agent completed without text response',
            iterations,
            toolsUsed,
            toolResults, // Include tool results
          };
        }

        // Unexpected stop reason
        throw new Error(`Unexpected stop reason: ${response.stop_reason}`);
      }

      // Max iterations reached
      return {
        success: false,
        result: null,
        iterations,
        toolsUsed,
        toolResults, // Include tool results even on failure
        error: 'Maximum iterations reached without completion',
      };
    } catch (error: any) {

      return {
        success: false,
        result: null,
        iterations,
        toolsUsed,
        toolResults, // Include tool results even on error
        error: error.message,
      };
    }
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(userMessage: string, context: Record<string, any>): string {
    if (Object.keys(context).length === 0) {
      return userMessage;
    }

    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    return `${userMessage}\n\nContext:\n${contextStr}`;
  }

  /**
   * Get statistics about registered tools
   */
  getToolStats() {
    return {
      totalTools: this.tools.size,
      toolNames: Array.from(this.tools.keys()),
    };
  }
}

export default BaseAgentService;
