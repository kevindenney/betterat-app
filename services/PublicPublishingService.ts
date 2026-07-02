/**
 * Public Publishing Service
 * Manages microsites, widgets, and public access for clubs
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PublicPublishingService');

// ============================================================================
// TYPES
// ============================================================================

export interface MicrositeConfig {
  id: string;
  clubId: string;
  regattaId: string | null;
  subdomain: string | null;
  customDomain: string | null;
  slug: string;
  theme: MicrositeTheme;
  logoUrl: string | null;
  bannerUrl: string | null;
  enabledSections: string[];
  defaultSection: string;
  showEntryList: boolean;
  showWeather: boolean;
  showVenueMap: boolean;
  public: boolean;
  passwordProtected: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MicrositeTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: number;
}

export interface WidgetConfig {
  id: string;
  clubId: string;
  regattaId: string | null;
  widgetType: WidgetType;
  name: string;
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  width: string;
  height: string;
  borderRadius: number;
  showBranding: boolean;
  customCSS: string | null;
  filters: Record<string, any>;
  embedToken: string;
  allowedDomains: string[];
  embedCount: number;
  impressions: number;
  active: boolean;
  createdAt: string;
}

export type WidgetType = 
  | 'calendar'
  | 'results'
  | 'standings'
  | 'notices'
  | 'schedule'
  | 'entry_list'
  | 'countdown'
  | 'weather';

export interface CreateWidgetInput {
  clubId: string;
  regattaId?: string;
  widgetType: WidgetType;
  name: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  showBranding?: boolean;
  filters?: Record<string, any>;
  allowedDomains?: string[];
}

export interface CreateMicrositeInput {
  clubId: string;
  regattaId?: string;
  subdomain?: string;
  customDomain?: string;
  theme?: Partial<MicrositeTheme>;
  enabledSections?: string[];
  showEntryList?: boolean;
  showWeather?: boolean;
  showVenueMap?: boolean;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class PublicPublishingService {
  // -------------------------------------------------------------------------
  // MICROSITE METHODS
  // -------------------------------------------------------------------------

  /**
   * Create a new microsite for a club/regatta
   */
  static async createMicrosite(input: CreateMicrositeInput): Promise<MicrositeConfig | null> {
    try {
      const { data, error } = await supabase
        .from('club_microsites')
        .insert({
          club_id: input.clubId,
          regatta_id: input.regattaId || null,
          subdomain: input.subdomain || null,
          custom_domain: input.customDomain || null,
          theme: input.theme || {},
          enabled_sections: input.enabledSections || ['schedule', 'results', 'notices'],
          show_entry_list: input.showEntryList ?? true,
          show_weather: input.showWeather ?? true,
          show_venue_map: input.showVenueMap ?? true,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating microsite:', error);
        return null;
      }

      return this.mapMicrositeRecord(data);
    } catch (error) {
      logger.error('Error creating microsite:', error);
      return null;
    }
  }

  /**
   * Get microsite configuration
   */
  static async getMicrosite(micrositeId: string): Promise<MicrositeConfig | null> {
    try {
      const { data, error } = await supabase
        .from('club_microsites')
        .select('*')
        .eq('id', micrositeId)
        .single();

      if (error || !data) return null;

      return this.mapMicrositeRecord(data);
    } catch (error) {
      logger.error('Error fetching microsite:', error);
      return null;
    }
  }

  /**
   * Get microsite by subdomain or custom domain
   */
  static async getMicrositeByDomain(domain: string): Promise<MicrositeConfig | null> {
    try {
      const { data, error } = await supabase
        .from('club_microsites')
        .select('*')
        .or(`subdomain.eq.${domain},custom_domain.eq.${domain}`)
        .eq('public', true)
        .single();

      if (error || !data) return null;

      return this.mapMicrositeRecord(data);
    } catch (error) {
      logger.error('Error fetching microsite by domain:', error);
      return null;
    }
  }

  /**
   * Get all microsites for a club
   */
  static async getClubMicrosites(clubId: string): Promise<MicrositeConfig[]> {
    try {
      const { data, error } = await supabase
        .from('club_microsites')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map(this.mapMicrositeRecord);
    } catch (error) {
      logger.error('Error fetching club microsites:', error);
      return [];
    }
  }

  /**
   * Update microsite configuration
   */
  static async updateMicrosite(
    micrositeId: string,
    updates: Partial<CreateMicrositeInput>
  ): Promise<MicrositeConfig | null> {
    try {
      const updatePayload: any = {};
      
      if (updates.subdomain !== undefined) updatePayload.subdomain = updates.subdomain;
      if (updates.customDomain !== undefined) updatePayload.custom_domain = updates.customDomain;
      if (updates.theme !== undefined) updatePayload.theme = updates.theme;
      if (updates.enabledSections !== undefined) updatePayload.enabled_sections = updates.enabledSections;
      if (updates.showEntryList !== undefined) updatePayload.show_entry_list = updates.showEntryList;
      if (updates.showWeather !== undefined) updatePayload.show_weather = updates.showWeather;
      if (updates.showVenueMap !== undefined) updatePayload.show_venue_map = updates.showVenueMap;

      const { data, error } = await supabase
        .from('club_microsites')
        .update(updatePayload)
        .eq('id', micrositeId)
        .select()
        .single();

      if (error || !data) return null;

      return this.mapMicrositeRecord(data);
    } catch (error) {
      logger.error('Error updating microsite:', error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // WIDGET METHODS
  // -------------------------------------------------------------------------

  /**
   * Create a new embeddable widget
   */
  static async createWidget(input: CreateWidgetInput): Promise<WidgetConfig | null> {
    try {
      const { data, error } = await supabase
        .from('club_widgets')
        .insert({
          club_id: input.clubId,
          regatta_id: input.regattaId || null,
          widget_type: input.widgetType,
          name: input.name,
          theme: input.theme || 'light',
          accent_color: input.accentColor || '#0EA5E9',
          show_branding: input.showBranding ?? true,
          filters: input.filters || {},
          allowed_domains: input.allowedDomains || [],
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating widget:', error);
        return null;
      }

      return this.mapWidgetRecord(data);
    } catch (error) {
      logger.error('Error creating widget:', error);
      return null;
    }
  }

  /**
   * Get widget by embed token
   */
  static async getWidgetByToken(token: string): Promise<WidgetConfig | null> {
    try {
      const { data, error } = await supabase
        .from('club_widgets')
        .select('*')
        .eq('embed_token', token)
        .eq('active', true)
        .single();

      if (error || !data) return null;

      return this.mapWidgetRecord(data);
    } catch (error) {
      logger.error('Error fetching widget:', error);
      return null;
    }
  }

  /**
   * Get all widgets for a club
   */
  static async getClubWidgets(clubId: string): Promise<WidgetConfig[]> {
    try {
      const { data, error } = await supabase
        .from('club_widgets')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map(this.mapWidgetRecord);
    } catch (error) {
      logger.error('Error fetching club widgets:', error);
      return [];
    }
  }

  /**
   * Update widget configuration
   */
  static async updateWidget(
    widgetId: string,
    updates: Partial<CreateWidgetInput> & { active?: boolean }
  ): Promise<WidgetConfig | null> {
    try {
      const updatePayload: any = {};
      
      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.theme !== undefined) updatePayload.theme = updates.theme;
      if (updates.accentColor !== undefined) updatePayload.accent_color = updates.accentColor;
      if (updates.showBranding !== undefined) updatePayload.show_branding = updates.showBranding;
      if (updates.filters !== undefined) updatePayload.filters = updates.filters;
      if (updates.allowedDomains !== undefined) updatePayload.allowed_domains = updates.allowedDomains;
      if (updates.active !== undefined) updatePayload.active = updates.active;

      const { data, error } = await supabase
        .from('club_widgets')
        .update(updatePayload)
        .eq('id', widgetId)
        .select()
        .single();

      if (error || !data) return null;

      return this.mapWidgetRecord(data);
    } catch (error) {
      logger.error('Error updating widget:', error);
      return null;
    }
  }

  /**
   * Delete a widget
   */
  static async deleteWidget(widgetId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('club_widgets')
        .delete()
        .eq('id', widgetId);

      return !error;
    } catch (error) {
      logger.error('Error deleting widget:', error);
      return false;
    }
  }

  /**
   * Generate embed code for a widget
   */
  static generateEmbedCode(widget: WidgetConfig, options?: {
    baseUrl?: string;
    includeScript?: boolean;
  }): string {
    const baseUrl = options?.baseUrl || 'https://better.at';
    const includeScript = options?.includeScript ?? true;

    let code = `<div 
  class="regattaflow-widget"
  data-type="${widget.widgetType}"
  data-club-id="${widget.clubId}"
  ${widget.regattaId ? `data-regatta-id="${widget.regattaId}"` : ''}
  data-theme="${widget.theme}"
  data-accent="${widget.accentColor}"
  ${!widget.showBranding ? 'data-branding="false"' : ''}>
</div>`;

    if (includeScript) {
      code += `\n<script src="${baseUrl}/widgets/embed.js" async></script>`;
    }

    return code;
  }

  // -------------------------------------------------------------------------
  // ANALYTICS
  // -------------------------------------------------------------------------

  /**
   * Get public access analytics for a club
   */
  static async getAccessAnalytics(clubId: string, options?: {
    startDate?: string;
    endDate?: string;
    resourceType?: string;
  }): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    topPages: { resource_type: string; count: number }[];
    byDate: { date: string; count: number }[];
  }> {
    try {
      let query = supabase
        .from('public_access_log')
        .select('*')
        .eq('club_id', clubId);

      if (options?.startDate) {
        query = query.gte('accessed_at', options.startDate);
      }
      if (options?.endDate) {
        query = query.lte('accessed_at', options.endDate);
      }
      if (options?.resourceType) {
        query = query.eq('resource_type', options.resourceType);
      }

      const { data, error } = await query;

      if (error || !data) {
        return { totalViews: 0, uniqueVisitors: 0, topPages: [], byDate: [] };
      }

      // Calculate metrics
      const uniqueIPs = new Set(data.map(d => d.ip_address)).size;
      
      // Group by resource type
      const byType: Record<string, number> = {};
      data.forEach(d => {
        byType[d.resource_type] = (byType[d.resource_type] || 0) + 1;
      });
      const topPages = Object.entries(byType)
        .map(([resource_type, count]) => ({ resource_type, count }))
        .sort((a, b) => b.count - a.count);

      // Group by date
      const byDateMap: Record<string, number> = {};
      data.forEach(d => {
        const date = d.accessed_at.split('T')[0];
        byDateMap[date] = (byDateMap[date] || 0) + 1;
      });
      const byDate = Object.entries(byDateMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalViews: data.length,
        uniqueVisitors: uniqueIPs,
        topPages,
        byDate,
      };
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      return { totalViews: 0, uniqueVisitors: 0, topPages: [], byDate: [] };
    }
  }

  // -------------------------------------------------------------------------
  // HELPER METHODS
  // -------------------------------------------------------------------------

  private static mapMicrositeRecord(record: any): MicrositeConfig {
    return {
      id: record.id,
      clubId: record.club_id,
      regattaId: record.regatta_id,
      subdomain: record.subdomain,
      customDomain: record.custom_domain,
      slug: record.slug,
      theme: record.theme || {},
      logoUrl: record.logo_url,
      bannerUrl: record.banner_url,
      enabledSections: record.enabled_sections || [],
      defaultSection: record.default_section,
      showEntryList: record.show_entry_list,
      showWeather: record.show_weather,
      showVenueMap: record.show_venue_map,
      public: record.public,
      passwordProtected: record.password_protected,
      viewCount: record.view_count,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private static mapWidgetRecord(record: any): WidgetConfig {
    return {
      id: record.id,
      clubId: record.club_id,
      regattaId: record.regatta_id,
      widgetType: record.widget_type,
      name: record.name,
      theme: record.theme,
      accentColor: record.accent_color,
      width: record.width,
      height: record.height,
      borderRadius: record.border_radius,
      showBranding: record.show_branding,
      customCSS: record.custom_css,
      filters: record.filters || {},
      embedToken: record.embed_token,
      allowedDomains: record.allowed_domains || [],
      embedCount: record.embed_count,
      impressions: record.impressions,
      active: record.active,
      createdAt: record.created_at,
    };
  }
}

export default PublicPublishingService;
