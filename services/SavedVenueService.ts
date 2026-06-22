/**
 * Saved Venue Service
 * Manages user's saved/favorite sailing venues
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('SavedVenueService');

export interface SavedVenue {
  id: string;
  user_id: string;
  venue_id: string;
  notes: string | null;
  is_home_venue: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedVenueWithDetails {
  id: string;
  name: string;
  coordinates: [number, number];
  saved_venue_id: string;
  notes: string | null;
  is_home_venue: boolean;
  saved_at: string;
  country?: string;
  region?: string;
  venueType?: string;
  timeZone?: string;
}

export class SavedVenueService {
  /**
   * Get all saved venues for the current user
   */
  static async getSavedVenues(): Promise<SavedVenueWithDetails[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    // Try the view first
    const { data, error } = await supabase
      .from('saved_venues_with_details')
      .select('*')
      .eq('user_id', user.id)
      .order('is_home_venue', { ascending: false })
      .order('saved_at', { ascending: false });

    // If view doesn't exist, fall back to direct table query
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      logger.warn('[SavedVenueService] View not found, using fallback query');
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('saved_venues')
        .select('*')
        .eq('user_id', user.id)
        .order('is_home_venue', { ascending: false })
        .order('created_at', { ascending: false });

      if (fallbackError) {
        // If table doesn't exist either, return empty array
        if (fallbackError.code === '42P01' || fallbackError.message?.includes('does not exist')) {
          logger.warn('[SavedVenueService] saved_venues table not found');
          return [];
        }
        throw fallbackError;
      }

      // Map fallback data to SavedVenueWithDetails format
      return (fallbackData || []).map((item: any) => ({
        id: item.venue_id || item.id,
        name: item.location_name || 'Saved Venue',
        coordinates: [0, 0] as [number, number],
        saved_venue_id: item.id,
        notes: item.notes,
        is_home_venue: item.is_home_venue,
        saved_at: item.created_at,
        country: item.location_region,
        region: item.location_region,
      }));
    }

    if (error) throw error;
    return data || [];
  }

  /**
   * Get saved venue IDs for efficient filtering
   */
  static async getSavedVenueIds(): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('saved_venues')
      .select('venue_id')
      .eq('user_id', user.id);

    if (error) throw error;
    return (data || []).map(sv => sv.venue_id);
  }

  /**
   * Save a venue to the user's favorites
   */
  static async saveVenue(
    venueId: string,
    options?: {
      notes?: string;
      isHomeVenue?: boolean;
    }
  ): Promise<SavedVenue> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // If setting as home venue, unset any existing home venue
    if (options?.isHomeVenue) {
      await supabase
        .from('saved_venues')
        .update({ is_home_venue: false })
        .eq('user_id', user.id)
        .eq('is_home_venue', true);
    }

    const { data, error } = await supabase
      .from('saved_venues')
      .insert({
        user_id: user.id,
        venue_id: venueId,
        notes: options?.notes || null,
        is_home_venue: options?.isHomeVenue || false,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (venue already saved)
      if (error.code === '23505') {
        throw new Error('This venue is already saved');
      }
      throw error;
    }

    return data;
  }

  /**
   * Remove a venue from saved venues
   */
  static async unsaveVenue(venueId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('saved_venues')
      .delete()
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Saved venue not found.');
  }

  /**
   * Update saved venue details (notes, home venue status)
   */
  static async updateSavedVenue(
    venueId: string,
    updates: {
      notes?: string;
      isHomeVenue?: boolean;
    }
  ): Promise<SavedVenue> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // If setting as home venue, unset any existing home venue
    if (updates.isHomeVenue) {
      await supabase
        .from('saved_venues')
        .update({ is_home_venue: false })
        .eq('user_id', user.id)
        .eq('is_home_venue', true);
    }

    const { data, error } = await supabase
      .from('saved_venues')
      .update({
        notes: updates.notes !== undefined ? updates.notes : undefined,
        is_home_venue: updates.isHomeVenue !== undefined ? updates.isHomeVenue : undefined,
      })
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Check if a venue is saved
   */
  static async isVenueSaved(venueId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('saved_venues')
      .select('id')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  /**
   * Get the user's home venue
   */
  static async getHomeVenue(): Promise<SavedVenueWithDetails | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Try the view first
    const { data, error } = await supabase
      .from('saved_venues_with_details')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_home_venue', true)
      .maybeSingle();

    // If view doesn't exist, fall back to direct table query
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('saved_venues')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_home_venue', true)
        .maybeSingle();

      if (fallbackError) {
        if (fallbackError.code === '42P01' || fallbackError.message?.includes('does not exist')) {
          return null;
        }
        throw fallbackError;
      }

      if (!fallbackData) return null;

      // Map to SavedVenueWithDetails
      return {
        id: fallbackData.venue_id || fallbackData.id,
        name: fallbackData.location_name || 'Home Venue',
        coordinates: [0, 0] as [number, number],
        saved_venue_id: fallbackData.id,
        notes: fallbackData.notes,
        is_home_venue: fallbackData.is_home_venue,
        saved_at: fallbackData.created_at,
        country: fallbackData.location_region,
        region: fallbackData.location_region,
      };
    }

    if (error) throw error;
    return data;
  }

  /**
   * Get saved venues count
   */
  static async getSavedVenuesCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('saved_venues')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (error) throw error;
    return count || 0;
  }
}
