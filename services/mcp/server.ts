import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerStudentProgressTools } from './tools/student-progress';
import { registerCompetencyTools } from './tools/competencies';
import { registerBlueprintTools } from './tools/blueprints';
import { registerOrganizationTools } from './tools/organization';
import { registerStepManagementTools } from './tools/step-management';
import { registerCompetencyCatalogResource } from './resources/competency-catalog';
import { registerAacnDomainsResource } from './resources/aacn-domains';
import type { SailorTier } from '../../lib/subscriptions/sailorTiers';

export type AuthContext = {
  userId: string;
  email: string | null;
  clubId: string | null;
  tier: SailorTier;
  /** Modality of the inbound message that triggered this turn. Bot channels
   * (Telegram/WhatsApp) set this so logged observations record voice vs typed.
   * Unset for MCP callers. */
  inputSource?: 'voice' | 'text';
};

export function createMcpServer(
  supabase: SupabaseClient,
  auth: AuthContext,
): McpServer {
  const server = new McpServer({
    name: 'betterat',
    version: '0.1.0',
  });

  // Register tools
  registerStudentProgressTools(server, supabase, auth);
  registerCompetencyTools(server, supabase, auth);
  registerBlueprintTools(server, supabase, auth);
  registerOrganizationTools(server, supabase, auth);
  registerStepManagementTools(server, supabase, auth);

  // Register resources
  registerCompetencyCatalogResource(server);
  registerAacnDomainsResource(server);

  return server;
}
