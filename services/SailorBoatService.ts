/**
 * Sailor Boat Service
 * Manages individual boats (vessels) - separate from class membership and fleets
 *
 * KEY DISTINCTION:
 * - Boats: Individual vessels (e.g., "Dragonfly" - a specific Dragon)
 * - Classes: Types of boats (e.g., Dragon, Etchells, J/70)
 * - Fleets: Groups of sailors in a class (e.g., "Hong Kong Dragon Fleet")
 */

import { supabase } from './supabase';
import MutationQueueService from './MutationQueueService';
import { createLogger } from '@/lib/utils/logger';

export interface SailorBoat {
  id: string;
  sailor_id: string;
  class_id: string;

  // Boat Identity
  name: string; // "Dragonfly", "My Dragon", etc.
  sail_number?: string;
  hull_number?: string;

  // Boat Details
  manufacturer?: string;
  year_built?: number;
  hull_material?: string;

  // Status
  is_primary: boolean;
  status: 'active' | 'stored' | 'sold' | 'retired';

  // Location
  home_club_id?: string;
  storage_location?: string;

  // Ownership
  ownership_type?: 'owned' | 'co_owned' | 'chartered' | 'club_boat' | 'crew';
  purchase_date?: string;
  purchase_price?: number;

  // Notes
  notes?: string;
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;

  // Joined data
  boat_class?: {
    id: string;
    name: string;
    class_association?: string;
  };
  home_club?: {
    id: string;
    name: string;
  };
  queuedForSync?: boolean;
  offlineOperation?: string;
}

export interface CreateBoatInput {
  sailor_id: string;
  class_id: string;
  name: string;
  sail_number?: string;
  hull_number?: string;
  manufacturer?: string;
  year_built?: number;
  hull_material?: string;
  is_primary?: boolean;
  home_club_id?: string;
  storage_location?: string;
  ownership_type?: 'owned' | 'co_owned' | 'chartered' | 'club_boat' | 'crew';
  purchase_date?: string;
  purchase_price?: number;
  notes?: string;
}

export interface UpdateBoatInput {
  name?: string;
  sail_number?: string;
  hull_number?: string;
  manufacturer?: string;
  year_built?: number;
  hull_material?: string;
  is_primary?: boolean;
  status?: 'active' | 'stored' | 'sold' | 'retired';
  home_club_id?: string;
  storage_location?: string;
  ownership_type?: 'owned' | 'co_owned' | 'chartered' | 'club_boat' | 'crew';
  purchase_date?: string;
  purchase_price?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

const logger = createLogger('SailorBoatService');
const BOATS_COLLECTION = 'sailor_boats';
export class SailorBoatService {
  /**
   * Get all boats for a sailor
   */
  async listBoatsForSailor(sailorId: string): Promise<SailorBoat[]> {

    const { data, error } = await supabase
      .from('sailor_boats')
      .select(`
        *,
        boat_class:boat_classes(id, name, class_association)
      `)
      .eq('sailor_id', sailorId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {

      throw error;
    }

    return data || [];
  }

  /**
   * Get boats for a sailor filtered by class
   */
  async listBoatsForSailorClass(sailorId: string, classId: string): Promise<SailorBoat[]> {

    const { data, error } = await supabase
      .from('sailor_boats')
      .select(`
        *,
        boat_class:boat_classes(id, name, class_association)
      `)
      .eq('sailor_id', sailorId)
      .eq('class_id', classId)
      .order('is_primary', { ascending: false });

    if (error) {

      throw error;
    }

    return data || [];
  }

  /**
   * Get a specific boat by ID
   */
  async getBoat(boatId: string): Promise<SailorBoat | null> {
    logger.debug('[SailorBoatService.getBoat] Fetching boat:', boatId);

    const { data, error } = await supabase
      .from('sailor_boats')
      .select(`
        *,
        boat_class:boat_classes(id, name, class_association)
      `)
      .eq('id', boatId)
      .single();

    if (error) {
      logger.error('[SailorBoatService.getBoat] Error fetching boat:', {
        boatId,
        error,
        errorCode: error.code,
        errorMessage: error.message
      });
      return null;
    }

    logger.debug('[SailorBoatService.getBoat] Boat fetched successfully:', {
      boatId: data?.id,
      boatName: data?.name,
      classId: data?.class_id,
      boatClassExists: !!data?.boat_class,
      boatClassId: data?.boat_class?.id,
      boatClassName: data?.boat_class?.name,
      boatClassIsArray: Array.isArray(data?.boat_class)
    });

    return data;
  }

  /**
   * Get the primary boat for a sailor in a specific class
   */
  async getPrimaryBoat(sailorId: string, classId: string): Promise<SailorBoat | null> {

    const { data, error } = await supabase
      .from('sailor_boats')
      .select(`
        *,
        boat_class:boat_classes(id, name, class_association)
      `)
      .eq('sailor_id', sailorId)
      .eq('class_id', classId)
      .eq('is_primary', true)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK

    }

    return data || null;
  }

  /**
   * Create a new boat
   */
  async createBoat(input: CreateBoatInput): Promise<SailorBoat> {
    try {
      return await this.createBoatDirect(input);
    } catch (error: any) {
      logger.warn('Error creating boat, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(BOATS_COLLECTION, 'upsert', {
        action: 'create',
        input,
      });

      const nowIso = new Date().toISOString();
      const fallback: SailorBoat = {
        id: `local_boat_${Date.now()}`,
        sailor_id: input.sailor_id,
        class_id: input.class_id,
        name: input.name,
        sail_number: input.sail_number,
        hull_number: input.hull_number,
        manufacturer: input.manufacturer,
        year_built: input.year_built,
        hull_material: input.hull_material,
        is_primary: Boolean(input.is_primary),
        status: 'active',
        home_club_id: input.home_club_id,
        storage_location: input.storage_location,
        ownership_type: input.ownership_type,
        purchase_date: input.purchase_date,
        purchase_price: input.purchase_price,
        notes: input.notes,
        metadata: undefined,
        created_at: nowIso,
        updated_at: nowIso,
        boat_class: undefined,
        home_club: undefined,
        queuedForSync: true,
        offlineOperation: 'create',
      };

      const offlineError: any = new Error('Boat creation queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = fallback;
      offlineError.originalError = error;
      offlineError.operation = 'createBoat';
      throw offlineError;
    }
  }

  async createBoatDirect(input: CreateBoatInput): Promise<SailorBoat> {
    // Use upsert with conflict handling on (sailor_id, class_id, sail_number)
    // This prevents duplicate key errors when offline mutations are replayed
    const { data, error } = await supabase
      .from('sailor_boats')
      .upsert({
        ...input,
        status: 'active',
      }, {
        // Handle conflicts on the unique constraint
        onConflict: 'sailor_id,class_id,sail_number',
        // Don't ignore - we want to update if there's a conflict
        ignoreDuplicates: false,
      })
      .select(`
        *,
        boat_class:boat_classes(id, name, class_association)
      `)
      .single();

    if (error) {
      logger.error('[SailorBoatService.createBoatDirect] Error creating boat:', {
        error,
        errorCode: error.code,
        input: { ...input, sailor_id: input.sailor_id?.slice(0, 8) + '...' },
      });
      throw error;
    }

    // Also register the class with the sailor in sailor_classes table
    // This ensures the class appears in the Crew tab and other class-based features
    try {
      const { error: classError } = await supabase
        .from('sailor_classes')
        .upsert({
          sailor_id: input.sailor_id,
          class_id: input.class_id,
          is_primary: input.is_primary ?? false,
          boat_name: input.name,
          sail_number: input.sail_number,
        }, {
          onConflict: 'sailor_id,class_id',
          // Don't override if already exists
          ignoreDuplicates: false,
        });

      if (classError) {
        logger.warn('[SailorBoatService.createBoatDirect] Failed to register class, but boat was created:', classError);
        // Don't throw here - boat was created successfully, class registration is secondary
      } else {
        logger.debug('[SailorBoatService.createBoatDirect] Successfully registered class for sailor');
      }
    } catch (classRegistrationError) {
      logger.warn('[SailorBoatService.createBoatDirect] Error registering class:', classRegistrationError);
      // Continue - boat creation succeeded
    }

    return data;
  }

  /**
   * Update a boat
   */
  async updateBoat(boatId: string, input: UpdateBoatInput): Promise<SailorBoat> {
    try {
      return await this.updateBoatDirect(boatId, input);
    } catch (error: any) {
      logger.warn('Error updating boat, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(BOATS_COLLECTION, 'upsert', {
        action: 'update',
        boatId,
        input,
      });

      const offlineError: any = new Error('Boat update queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = {
        id: boatId,
        updates: input,
        queuedForSync: true,
        offlineOperation: 'update',
      };
      offlineError.originalError = error;
      offlineError.operation = 'updateBoat';
      throw offlineError;
    }
  }

  async updateBoatDirect(boatId: string, input: UpdateBoatInput): Promise<SailorBoat> {

    const { data, error } = await supabase
      .from('sailor_boats')
      .update(input)
      .eq('id', boatId)
      .select(`
        *,
        boat_class:boat_classes(id, name, class_association)
      `)
      .single();

    if (error) {

      throw error;
    }

    // Update sailor_classes if relevant fields changed
    if (data && (input.name || input.sail_number !== undefined || input.is_primary !== undefined)) {
      try {
        const updateData: any = {};
        if (input.name) updateData.boat_name = input.name;
        if (input.sail_number !== undefined) updateData.sail_number = input.sail_number;
        if (input.is_primary !== undefined) updateData.is_primary = input.is_primary;

        const { error: classError } = await supabase
          .from('sailor_classes')
          .update(updateData)
          .eq('sailor_id', data.sailor_id)
          .eq('class_id', data.class_id);

        if (classError) {
          logger.warn('[SailorBoatService.updateBoatDirect] Failed to update sailor_classes:', classError);
        }
      } catch (updateError) {
        logger.warn('[SailorBoatService.updateBoatDirect] Error updating sailor_classes:', updateError);
      }
    }

    return data;
  }

  /**
   * Set a boat as primary for its class
   */
  async setPrimaryBoat(boatId: string): Promise<void> {

    // First, get the boat to know which sailor and class we're working with
    const { data: boat, error: fetchError } = await supabase
      .from('sailor_boats')
      .select('sailor_id, class_id')
      .eq('id', boatId)
      .single();

    if (fetchError) {

      throw fetchError;
    }

    // Unset all primary boats for this sailor/class

    logger.debug('⭐ [SailorBoatService] Loaded boat for primary toggle', boat);

    const { data: previousPrimaries, error: unsetError } = await supabase
      .from('sailor_boats')
      .update({ is_primary: false })
      .eq('sailor_id', boat.sailor_id)
      .neq('id', boatId)
      .select('id, name');
    logger.debug('⭐ [SailorBoatService] Clearing existing primaries for sailor', {
      sailorId: boat.sailor_id,
      targetBoatId: boatId,
      cleared: previousPrimaries?.map((p: any) => p.id) ?? [],
    });

    if (unsetError) {

      throw unsetError;
    }
    logger.debug('⭐ [SailorBoatService] Cleared previous primary boats');

    // Set the selected boat as primary
    logger.debug('⭐ [SailorBoatService] Setting boat as primary...');
    const { data: updatedBoat, error: setError } = await supabase
      .from('sailor_boats')
      .update({ is_primary: true })
      .eq('id', boatId)
      .select('id')
      .maybeSingle();

    if (setError) {

      throw setError;
    }
    if (!updatedBoat) {
      throw new Error('Boat not found');
    }
    logger.debug('⭐ [SailorBoatService] Primary boat updated successfully');

    // Also update sailor_classes to sync primary status
    try {
      // Unset primary for all other boats in this class
      await supabase
        .from('sailor_classes')
        .update({ is_primary: false })
        .eq('sailor_id', boat.sailor_id)
        .eq('class_id', boat.class_id);

      // Set this boat's class as primary
      const { error: classError } = await supabase
        .from('sailor_classes')
        .update({ is_primary: true })
        .eq('sailor_id', boat.sailor_id)
        .eq('class_id', boat.class_id);

      if (classError) {
        logger.warn('[SailorBoatService.setPrimaryBoat] Failed to update primary in sailor_classes:', classError);
      }
    } catch (classUpdateError) {
      logger.warn('[SailorBoatService.setPrimaryBoat] Error updating sailor_classes:', classUpdateError);
    }

  }

  /**
   * Delete a boat
   */
  async deleteBoat(boatId: string): Promise<void> {
    try {
      await this.deleteBoatDirect(boatId);
    } catch (error: any) {
      logger.warn('Error deleting boat, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(BOATS_COLLECTION, 'delete', {
        action: 'delete',
        boatId,
      });

      const offlineError: any = new Error('Boat deletion queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = { id: boatId };
      offlineError.originalError = error;
      offlineError.operation = 'deleteBoat';
      throw offlineError;
    }
  }

  async deleteBoatDirect(boatId: string): Promise<void> {
    // First, get the boat info before deleting
    const { data: boat, error: fetchError } = await supabase
      .from('sailor_boats')
      .select('sailor_id, class_id')
      .eq('id', boatId)
      .single();

    if (fetchError) {
      logger.error('Error fetching boat before delete:', fetchError);
      throw fetchError;
    }

    const { data: deletedBoat, error } = await supabase
      .from('sailor_boats')
      .delete()
      .eq('id', boatId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Error deleting boat:', error);
      throw error;
    }
    if (!deletedBoat) {
      throw new Error('Boat not found');
    }

    // Check if there are any other boats for this sailor in this class
    if (boat) {
      try {
        const { data: remainingBoats, error: countError } = await supabase
          .from('sailor_boats')
          .select('id')
          .eq('sailor_id', boat.sailor_id)
          .eq('class_id', boat.class_id)
          .limit(1);

        // If no boats remain in this class, remove the sailor_classes entry
        if (!countError && (!remainingBoats || remainingBoats.length === 0)) {
          const { error: deleteClassError } = await supabase
            .from('sailor_classes')
            .delete()
            .eq('sailor_id', boat.sailor_id)
            .eq('class_id', boat.class_id);

          if (deleteClassError) {
            logger.warn('[SailorBoatService.deleteBoatDirect] Failed to remove class registration:', deleteClassError);
          } else {
            logger.debug('[SailorBoatService.deleteBoatDirect] Removed class registration (no boats left in class)');
          }
        }
      } catch (cleanupError) {
        logger.warn('[SailorBoatService.deleteBoatDirect] Error cleaning up sailor_classes:', cleanupError);
      }
    }
  }

  /**
   * Get equipment for a specific boat
   */
  async getBoatEquipment(boatId: string) {
    const { data, error } = await supabase
      .from('boat_equipment')
      .select('*')
      .eq('boat_id', boatId)
      .order('category');

    if (error) {
      logger.error('Error fetching boat equipment:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get crew for a specific boat
   */
  async getBoatCrew(boatId: string) {
    const { data, error } = await supabase
      .from('crew_members')
      .select('*')
      .eq('boat_id', boatId)
      .order('role');

    if (error) {
      logger.error('Error fetching boat crew:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get tuning settings for a specific boat
   */
  async getBoatTuningSettings(boatId: string) {
    const { data, error } = await supabase
      .from('boat_tuning_settings')
      .select('*')
      .eq('boat_id', boatId)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching boat tuning settings:', error);
      throw error;
    }

    return data || [];
  }
}

export const sailorBoatService = new SailorBoatService();

export function initializeBoatMutationHandlers() {
  MutationQueueService.registerHandler(BOATS_COLLECTION, {
    upsert: async (payload: any) => {
      switch (payload?.action) {
        case 'create':
          await sailorBoatService.createBoatDirect(payload.input);
          break;
        case 'update':
          await sailorBoatService.updateBoatDirect(payload.boatId, payload.input || {});
          break;
        default:
          logger.warn('Unhandled boat upsert action', payload?.action);
      }
    },
    delete: async (payload: any) => {
      if (payload?.action === 'delete' && payload.boatId) {
        await sailorBoatService.deleteBoatDirect(payload.boatId);
      } else {
        logger.warn('Unhandled boat delete action', payload?.action);
      }
    },
  });
}
