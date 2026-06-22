/**
 * Enhanced AI Client with MCP and Skills Support
 *
 * This client extends the base AI client to support:
 * 1. Claude Skills API integration
 * 2. MCP (Model Context Protocol) integration
 * 3. Combined Skills + MCP workflows
 */

import { AIClient, AIModelId, AIMessage } from './AIClient';
import { skillManagementService } from './SkillManagementService';

export interface SkillConfig {
  skillId: string;
  version?: string;
}

export interface MCPResource {
  uri: string;
  mimeType?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  input_schema?: any;
}

export interface EnhancedAIRequest {
  model: AIModelId;
  system?: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;

  // Skills integration
  skills?: SkillConfig[];

  // MCP integration
  mcpResources?: MCPResource[];
  mcpTools?: MCPTool[];

  // Code execution (required for Skills)
  enableCodeExecution?: boolean;
}

export interface EnhancedAIResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  raw: any;
  skillsUsed?: string[];
  toolsUsed?: string[];
}

/**
 * Enhanced AI client with Skills and MCP support
 */
export class EnhancedAIClient extends AIClient {
  /**
   * Create a message with Skills and/or MCP support
   */
  async createEnhancedMessage(
    request: EnhancedAIRequest
  ): Promise<EnhancedAIResponse> {
    const systemSections: string[] = [];
    if (request.system) {
      systemSections.push(request.system);
    }
    if (request.skills && request.skills.length > 0) {
      systemSections.push(
        `Requested skills: ${request.skills.map((s) => `${s.skillId}@${s.version || 'latest'}`).join(', ')}`
      );
    }
    if (request.mcpResources && request.mcpResources.length > 0) {
      const resourceContext = this.formatMCPResources(request.mcpResources);
      if (resourceContext) {
        systemSections.push(resourceContext);
      }
    }
    if (request.mcpTools && request.mcpTools.length > 0) {
      systemSections.push(
        `Available MCP tools:\n${request.mcpTools.map((t) => `- ${t.name}: ${t.description || ''}`).join('\n')}`
      );
    }
    if (request.enableCodeExecution) {
      systemSections.push('Code execution was requested; provide explicit reasoning in natural language output.');
    }

    const baseResponse = await super.createMessage({
      model: request.model,
      system: systemSections.length > 0 ? systemSections.join('\n\n') : undefined,
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
    });

    return {
      text: baseResponse.text,
      tokensIn: baseResponse.tokensIn,
      tokensOut: baseResponse.tokensOut,
      raw: baseResponse.raw,
      skillsUsed: request.skills?.map((s) => s.skillId),
      toolsUsed: request.mcpTools?.map((t) => t.name),
    };
  }

  /**
   * Helper to create a request with race strategy skills
   */
  async createRaceStrategyRequest(
    message: string,
    context?: {
      raceData?: any;
      weatherData?: any;
      tidalData?: any;
      bathymetryData?: any;
    }
  ): Promise<EnhancedAIResponse> {
    // Initialize skills
    const raceStrategySkillId = await skillManagementService.initializeRaceStrategySkill();
    const tidalSkillId = await skillManagementService.initializeTidalOpportunismSkill();
    const slackWindowSkillId = await skillManagementService.initializeSlackWindowSkill();

    const skills: SkillConfig[] = [];

    if (raceStrategySkillId) {
      skills.push({ skillId: raceStrategySkillId });
    }
    if (tidalSkillId) {
      skills.push({ skillId: tidalSkillId });
    }
    if (slackWindowSkillId) {
      skills.push({ skillId: slackWindowSkillId });
    }

    // Build system prompt with context
    let systemPrompt = 'You are an expert sailing race strategist with access to specialized skills.';

    if (context) {
      systemPrompt += '\n\nContext available:';
      if (context.raceData) {
        systemPrompt += `\n- Race Data: ${JSON.stringify(context.raceData)}`;
      }
      if (context.weatherData) {
        systemPrompt += `\n- Weather Data: ${JSON.stringify(context.weatherData)}`;
      }
      if (context.tidalData) {
        systemPrompt += `\n- Tidal Data: ${JSON.stringify(context.tidalData)}`;
      }
      if (context.bathymetryData) {
        systemPrompt += `\n- Bathymetry Data: ${JSON.stringify(context.bathymetryData)}`;
      }
    }

    return this.createEnhancedMessage({
      model: 'claude-3-5-haiku-20241022',
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      skills,
      enableCodeExecution: true,
      maxTokens: 4096,
    });
  }

  /**
   * Format MCP resources for system context
   */
  private formatMCPResources(resources: MCPResource[]): string {
    if (resources.length === 0) return '';

    let context = '# Available Resources\n\n';
    context += 'The following data sources are available:\n\n';

    resources.forEach(resource => {
      context += `- ${resource.uri}`;
      if (resource.mimeType) {
        context += ` (${resource.mimeType})`;
      }
      context += '\n';
    });

    return context;
  }
}

// Export singleton instance
export const enhancedAIClient = new EnhancedAIClient();

// Backward-compatible aliases
/** @deprecated Use EnhancedAIClient */
export const EnhancedClaudeClient = EnhancedAIClient;
/** @deprecated Use EnhancedAIRequest */
export type EnhancedClaudeRequest = EnhancedAIRequest;
/** @deprecated Use EnhancedAIResponse */
export type EnhancedClaudeResponse = EnhancedAIResponse;
/** @deprecated Use enhancedAIClient */
export const enhancedClaudeClient = enhancedAIClient;
