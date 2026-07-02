/**
 * Club Verification Service
 * Handles DNS and meta tag verification for club onboarding
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ClubVerificationService');

export interface VerificationResult {
  success: boolean;
  method?: 'dns' | 'meta_tag';
  error?: string;
  verificationToken?: string;
}

export interface ClubExtractedData {
  clubName?: string;
  established?: number;
  fleets?: { name: string; boats: number }[];
  races?: { name: string; frequency: string }[];
  regattas?: string[];
  adminUsers?: string[];
  memberCount?: number;
}

export class ClubVerificationService {
  private static VERIFICATION_TOKEN_META = 'regattaflow-verification';
  private static VERIFICATION_TXT_PREFIX = 'regattaflow-verify=';

  private static normalizeWebsiteUrl(rawUrl: string): string {
    return rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `https://${rawUrl}`;
  }

  /**
   * Generate a unique verification token for a club
   */
  static async generateVerificationToken(userId: string): Promise<string> {
    const token = `rf_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store token in club_profiles
    const { error } = await supabase
      .from('club_profiles')
      .upsert({
        user_id: userId,
        verification_token: token,
        verification_status: 'pending',
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      });

    if (error) {
      logger.error('Error storing verification token:', error);
      throw new Error('Failed to generate verification token');
    }

    return token;
  }

  /**
   * Verify website using meta tag method
   * Checks for <meta name="regattaflow-verification" content="token">
   */
  static async verifyMetaTag(
    websiteUrl: string,
    userId: string
  ): Promise<VerificationResult> {
    try {
      // Get the stored verification token
      const { data: profile, error: profileError } = await supabase
        .from('club_profiles')
        .select('verification_token')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile?.verification_token) {
        return {
          success: false,
          error: 'No verification token found. Please generate one first.',
        };
      }

      const expectedToken = profile.verification_token;

      const normalizedUrl = this.normalizeWebsiteUrl(websiteUrl);

      // Fetch the website HTML
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'BetterAt-Verifier/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status}`);
      }

      const html = await response.text();

      // Check for meta tag
      const metaRegex = new RegExp(
        `<meta[^>]*name=["']${this.VERIFICATION_TOKEN_META}["'][^>]*content=["']${expectedToken}["'][^>]*>`,
        'i'
      );
      const metaRegexReverse = new RegExp(
        `<meta[^>]*content=["']${expectedToken}["'][^>]*name=["']${this.VERIFICATION_TOKEN_META}["'][^>]*>`,
        'i'
      );

      const isVerified = metaRegex.test(html) || metaRegexReverse.test(html);

      // Log the verification attempt
      await this.logVerificationAttempt(
        userId,
        'meta_tag',
        normalizedUrl,
        isVerified,
        isVerified ? undefined : 'Meta tag not found or token mismatch'
      );

      if (isVerified) {
        // Update club profile
        await this.updateVerificationStatus(userId, 'verified', 'meta_tag');

        return {
          success: true,
          method: 'meta_tag',
          verificationToken: expectedToken,
        };
      }

      return {
        success: false,
        error: 'Meta tag not found. Please add the verification meta tag to your website.',
      };
    } catch (error: any) {
      logger.error('Meta tag verification error:', error);

      // Log the failed attempt
      await this.logVerificationAttempt(
        userId,
        'meta_tag',
        this.normalizeWebsiteUrl(websiteUrl),
        false,
        error.message
      );

      return {
        success: false,
        error: error.message || 'Failed to verify website',
      };
    }
  }

  /**
   * Verify website using DNS TXT record method
   * Checks for TXT record: regattaflow-verify=token
   */
  static async verifyDNS(
    websiteUrl: string,
    userId: string
  ): Promise<VerificationResult> {
    try {
      // Get the stored verification token
      const { data: profile, error: profileError } = await supabase
        .from('club_profiles')
        .select('verification_token')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile?.verification_token) {
        return {
          success: false,
          error: 'No verification token found. Please generate one first.',
        };
      }

      const expectedToken = profile.verification_token;
      const normalizedUrl = this.normalizeWebsiteUrl(websiteUrl);
      const hostname = new URL(normalizedUrl).hostname.replace(/^www\./i, '');
      const expectedTxt = `${this.VERIFICATION_TXT_PREFIX}${expectedToken}`;

      // Query TXT records through DNS-over-HTTPS (Google resolver).
      const lookupNames = [hostname, `_regattaflow.${hostname}`];
      let found = false;

      for (const name of lookupNames) {
        const dnsResponse = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`,
          {
            headers: {
              Accept: 'application/dns-json',
            },
          }
        );

        if (!dnsResponse.ok) {
          continue;
        }

        const dnsPayload = await dnsResponse.json();
        const answers: string[] = Array.isArray(dnsPayload?.Answer)
          ? dnsPayload.Answer.map((answer: any) => String(answer?.data || ''))
          : [];

        // TXT values often come wrapped in quotes and split across chunks.
        const normalizedAnswers = answers
          .map((value) => value.replace(/"/g, '').trim())
          .filter(Boolean);

        if (normalizedAnswers.some((value) => value.includes(expectedTxt))) {
          found = true;
          break;
        }
      }

      await this.logVerificationAttempt(
        userId,
        'dns',
        websiteUrl,
        found,
        found ? undefined : `TXT record not found. Expected value: ${expectedTxt}`
      );

      if (!found) {
        return {
          success: false,
          error: `DNS TXT record not found. Add "${expectedTxt}" to your domain and try again.`,
        };
      }

      await this.updateVerificationStatus(userId, 'verified', 'dns');
      return {
        success: true,
        method: 'dns',
        verificationToken: expectedToken,
      };
    } catch (error: any) {
      logger.error('DNS verification error:', error);

      await this.logVerificationAttempt(
        userId,
        'dns',
        websiteUrl,
        false,
        error.message
      );

      return {
        success: false,
        error: error.message || 'Failed to verify DNS',
      };
    }
  }

  /**
   * Extract club data from website using AI
   */
  static async extractClubData(
    websiteUrl: string
  ): Promise<ClubExtractedData | null> {
    try {
      const normalizedUrl = this.normalizeWebsiteUrl(websiteUrl);
      const { data, error } = await supabase.functions.invoke('club-scrape', {
        body: { url: normalizedUrl },
      });

      if (error) {
        throw new Error(error.message || 'Club scrape failed');
      }
      if (!data?.success || !data?.data) {
        throw new Error(data?.error || 'Club scrape returned no data');
      }

      const extracted = data.data;
      const classes = Array.isArray(extracted.classes) ? extracted.classes : [];
      const events = Array.isArray(extracted.events) ? extracted.events : [];
      const contacts = Array.isArray(extracted.contacts) ? extracted.contacts : [];

      const races = events
        .filter((event: any) => event?.name)
        .slice(0, 20)
        .map((event: any) => ({
          name: String(event.name),
          frequency: event.date ? String(event.date) : (event.notes ? String(event.notes) : 'Scheduled'),
        }));

      const adminUsers = contacts
        .map((contact: any) => contact?.email)
        .filter((email: unknown): email is string => typeof email === 'string' && email.length > 0);

      return {
        clubName: extracted.club_name || undefined,
        memberCount: undefined,
        established: undefined,
        fleets: classes
          .filter((item: any) => item?.name)
          .slice(0, 20)
          .map((item: any) => ({
            name: String(item.name),
            boats: 0,
          })),
        races,
        regattas: events
          .filter((event: any) => event?.name)
          .slice(0, 20)
          .map((event: any) => String(event.name)),
        adminUsers,
      };
    } catch (error: any) {
      logger.error('Error extracting club data:', error);
      return null;
    }
  }

  /**
   * Check if website URL exists in yacht_clubs database
   */
  static async findMatchingYachtClub(websiteUrl: string): Promise<string | null> {
    try {
      const normalizedUrl = this.normalizeWebsiteUrl(websiteUrl);
      const { data, error } = await supabase
        .from('yacht_clubs')
        .select('id, website')
        .ilike('website', `%${new URL(normalizedUrl).hostname}%`)
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error finding matching yacht club:', error);
      return null;
    }
  }

  /**
   * Update verification status in database
   */
  private static async updateVerificationStatus(
    userId: string,
    status: 'pending' | 'verified' | 'rejected',
    method?: 'dns' | 'meta_tag'
  ): Promise<void> {
    const updateData: any = {
      verification_status: status,
    };

    if (method) {
      updateData.verification_method = method;
    }

    if (status === 'verified') {
      updateData.verified_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('club_profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error updating verification status:', error);
      throw new Error('Failed to update verification status');
    }
  }

  /**
   * Log verification attempt for audit trail
   */
  private static async logVerificationAttempt(
    userId: string,
    method: 'dns' | 'meta_tag',
    websiteUrl: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      // First, get the club profile id
      const { data: profile } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        logger.error('No club profile found for user');
        return;
      }

      await supabase.from('club_verification_attempts').insert({
        club_profile_id: profile.id,
        method,
        website_url: websiteUrl,
        success,
        error_message: errorMessage,
      });
    } catch (error) {
      logger.error('Error logging verification attempt:', error);
      // Don't throw - logging failures shouldn't break verification flow
    }
  }

  /**
   * Get verification instructions for users
   */
  static getVerificationInstructions(token: string): {
    metaTag: string;
    dnsRecord: string;
  } {
    return {
      metaTag: `<meta name="${this.VERIFICATION_TOKEN_META}" content="${token}">`,
      dnsRecord: `${this.VERIFICATION_TXT_PREFIX}${token}`,
    };
  }
}
