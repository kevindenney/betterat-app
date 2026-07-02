/**
 * Race Extraction Agent
 * Autonomous AI agent for extracting race details from unstructured text
 * Uses Anthropic Agent SDK to intelligently parse sailing instructions, notices of race, etc.
 */

import { z } from 'zod';
import { BaseAgentService, AgentTool } from './BaseAgentService';

export interface ExtractedRaceData {
  name: string;
  venue: string;
  date: string;
  startTime: string;
  wind?: {
    direction: string;
    speedMin: number;
    speedMax: number;
  };
  tide?: {
    state: 'flooding' | 'ebbing' | 'slack';
    height: number;
  };
  strategy?: string;
  critical_details?: {
    vhf_channel?: string;
    warning_signal?: string;
    first_start?: string;
    race_committee?: string;
    race_area?: string;
    courses?: string[];
  };
}

export class RaceExtractionAgent extends BaseAgentService {
  constructor() {
    super({
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 4096,
      temperature: 0.1, // Low temperature for precise extraction
      systemPrompt: `You are an expert sailing race document parser for BetterAt. Your role is to extract structured race information from unstructured text such as:

- Sailing Instructions (SIs)
- Notice of Race (NOR)
- Race announcements
- Social media posts about races
- Calendar entries
- Email notifications

You should extract:
1. **Race Name** - The official name of the regatta, series, or championship
2. **Venue** - The sailing club, harbor, or geographic location
3. **Date** - Race date in YYYY-MM-DD format
4. **Start Time** - First start time in HH:MM format (24-hour)
5. **Critical Details** - VHF channel, warning signal time, race committee, race area, courses
6. **Optional** - Wind/tide conditions if mentioned, initial strategy notes

Be intelligent about inferring missing information:
- If only a series name is given (e.g., "Croucher Series"), that's the race name
- If a yacht club is mentioned, use it as the venue
- Look for dates in various formats (Oct 15, 10/15/2025, etc.) and convert to YYYY-MM-DD
- Extract times like "First start 10:00" or "Warning signal 09:55"

Return structured JSON data. If critical fields (name, venue, date) cannot be found, explain what's missing and ask for clarification.`,
    });

    // Register extraction tool
    this.registerTool(this.createExtractRaceDataTool());
  }

  /**
   * Main extraction method - analyzes text and extracts race data
   */
  async extractRaceData(text: string): Promise<{
    success: boolean;
    data?: ExtractedRaceData;
    error?: string;
    missingFields?: string[];
  }> {
    try {
      const response = await this.run({
        userMessage: `Extract race details from the following text. Be thorough and intelligent about finding race information:

${text}

Use the extract_race_data tool to return the extracted information. If you cannot find required fields (name, venue, or date), set them as null and list what's missing in the missing_fields array.`,
        maxIterations: 2, // Should only need 1 iteration for extraction
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      // Get the result from the extract_race_data tool
      const toolResult = response.toolResults?.['extract_race_data'];

      if (!toolResult) {
        return {
          success: false,
          error: 'Agent did not call the extraction tool',
        };
      }

      // If tool returned an error (missing fields), return that
      if (!toolResult.success) {
        return {
          success: false,
          error: toolResult.message,
          missingFields: toolResult.missingFields,
        };
      }

      return {
        success: true,
        data: toolResult.data as ExtractedRaceData,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tool: Extract race data from text
   */
  private createExtractRaceDataTool(): AgentTool {
    return {
      name: 'extract_race_data',
      description: 'Extract structured race information from unstructured text. Use this tool to parse sailing instructions, race notices, or any race-related text.',
      input_schema: z.object({
        name: z.string().nullable().describe('Race or regatta name (e.g., "Hong Kong Dragon Championship 2025")'),
        venue: z.string().nullable().describe('Venue name or location (e.g., "Royal Hong Kong Yacht Club" or "Victoria Harbour, Hong Kong")'),
        date: z.string().nullable().describe('Race date in YYYY-MM-DD format'),
        startTime: z.string().nullable().describe('First start time in HH:MM format (24-hour)'),
        wind: z.object({
          direction: z.string().describe('Wind direction (e.g., "NE", "Southwest", "Variable")'),
          speedMin: z.coerce.number().describe('Minimum wind speed in knots'),
          speedMax: z.coerce.number().describe('Maximum wind speed in knots'),
        }).optional().describe('Wind conditions if mentioned in the text'),
        tide: z.object({
          state: z.enum(['flooding', 'ebbing', 'slack']).describe('Tide state'),
          height: z.coerce.number().describe('Tide height in meters'),
        }).optional().describe('Tide conditions if mentioned in the text'),
        strategy: z.string().optional().describe('Any tactical or strategic notes mentioned in the text'),
        critical_details: z.object({
          vhf_channel: z.string().optional().describe('VHF radio channel (e.g., "72", "Channel 72")'),
          warning_signal: z.string().optional().describe('Warning signal time (e.g., "09:55")'),
          first_start: z.string().optional().describe('First start time (e.g., "10:00")'),
          race_committee: z.string().optional().describe('Race committee contact or boat name'),
          race_area: z.string().optional().describe('Designated race area (e.g., "Area C", "Inner Harbour")'),
          courses: z.array(z.string()).optional().describe('Course names or numbers mentioned'),
        }).optional().describe('Critical race details for sailors'),
        missing_fields: z.array(z.string()).optional().describe('List of required fields that could not be extracted'),
      }),
      execute: async (input) => {
        // Validate required fields
        const missingFields: string[] = [];
        if (!input.name) missingFields.push('race name');
        if (!input.venue) missingFields.push('venue');
        if (!input.date) missingFields.push('date');

        if (missingFields.length > 0) {
          return {
            success: false,
            missingFields,
            message: `Could not extract: ${missingFields.join(', ')}. Please provide text with race name, venue, and date.`,
          };
        }

        // Return extracted data
        return {
          success: true,
          data: {
            name: input.name!,
            venue: input.venue!,
            date: input.date!,
            startTime: input.startTime || '10:00',
            wind: input.wind,
            tide: input.tide,
            strategy: input.strategy,
            critical_details: input.critical_details,
          },
        };
      },
    };
  }
}
