/**
 * useRaceMarks Hook
 *
 * Provides handlers for race course mark CRUD operations.
 * State is managed externally and passed in via parameters.
 */

import { useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useRaceMarks');

export interface RaceMark {
  id: string;
  mark_name?: string;
  name?: string;
  mark_type: string;
  latitude: number;
  longitude: number;
  sequence_order?: number;
  coordinates_lat?: number;
  coordinates_lng?: number;
}

export interface UseRaceMarksParams {
  /** Selected race ID */
  selectedRaceId: string | null;
  /** Function to ensure/get race event ID for the selected race */
  ensureRaceEventId: () => Promise<string | null>;
  /** External state setter for marks */
  setMarks: React.Dispatch<React.SetStateAction<any[]>>;
}

export interface UseRaceMarksReturn {
  /** Add a new mark */
  handleMarkAdded: (mark: Omit<RaceMark, 'id'>) => Promise<void>;
  /** Update a mark's position */
  handleMarkUpdated: (mark: RaceMark) => Promise<void>;
  /** Delete a mark */
  handleMarkDeleted: (markId: string) => Promise<void>;
  /** Bulk update multiple marks */
  handleBulkMarksUpdate: (marks: RaceMark[]) => Promise<void>;
}

/**
 * Hook providing handlers for race course mark operations
 */
export function useRaceMarks({
  selectedRaceId,
  ensureRaceEventId,
  setMarks,
}: UseRaceMarksParams): UseRaceMarksReturn {
  /**
   * Add a new mark to the race course
   */
  const handleMarkAdded = useCallback(async (mark: Omit<RaceMark, 'id'>) => {
    if (!selectedRaceId) return;

    try {
      logger.debug('Adding new mark:', mark);

      const raceEventId = await ensureRaceEventId();
      if (!raceEventId) {
        throw new Error('Unable to resolve race event ID');
      }

      const markName = mark.name || mark.mark_name || 'Custom Mark';
      const markType = mark.mark_type || 'custom';

      // Check if mark already exists to prevent duplicates
      const { data: existingMarks } = await supabase
        .from('race_marks')
        .select('id')
        .eq('race_id', raceEventId)
        .eq('name', markName)
        .eq('mark_type', markType)
        .limit(1);

      if (existingMarks && existingMarks.length > 0) {
        logger.debug('Mark already exists, skipping insert:', markName);
        return;
      }

      // Prepare insert payload using only supported columns
      const insertPayload: Record<string, unknown> = {
        race_id: raceEventId,
        name: markName,
        mark_type: markType,
        latitude: mark.latitude,
        longitude: mark.longitude,
        sequence_order: typeof mark.sequence_order === 'number' ? mark.sequence_order : 0,
        is_custom: true,
      };

      const { data: newMark, error } = await supabase
        .from('race_marks')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        // If it's a duplicate key error, silently ignore it
        if (error.code === '23505') {
          logger.debug('Mark already exists (race condition), ignoring:', markName);
          return;
        }
        throw error;
      }

      logger.debug('Mark added successfully:', newMark);

      // Update local state
      setMarks((prev: any[]) => [
        ...prev,
        {
          id: newMark.id,
          mark_name: newMark.name,
          mark_type: newMark.mark_type,
          latitude: newMark.latitude,
          longitude: newMark.longitude,
          sequence_order: 0,
        },
      ]);
    } catch (error) {
      logger.error('Error adding mark:', error);
    }
  }, [ensureRaceEventId, selectedRaceId, setMarks]);

  /**
   * Update a mark's position
   */
  const handleMarkUpdated = useCallback(async (mark: RaceMark) => {
    try {
      logger.debug('Updating mark:', mark.id);

      const { data, error } = await supabase
        .from('race_marks')
        .update({
          latitude: mark.latitude,
          longitude: mark.longitude,
        })
        .eq('id', mark.id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Race mark not found.');

      logger.debug('Mark updated successfully');

      // Update local state
      setMarks((prev: any[]) =>
        prev.map((m: any) =>
          m.id === mark.id
            ? {
                ...m,
                latitude: mark.latitude,
                longitude: mark.longitude,
              }
            : m
        )
      );
    } catch (error) {
      logger.error('Error updating mark:', error);
    }
  }, [setMarks]);

  /**
   * Delete a mark
   */
  const handleMarkDeleted = useCallback(async (markId: string) => {
    try {
      logger.debug('Deleting mark:', markId);

      const { data, error } = await supabase
        .from('race_marks')
        .delete()
        .eq('id', markId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Race mark not found.');

      logger.debug('Mark deleted successfully');

      // Update local state
      setMarks((prev: any[]) => prev.filter((m: any) => m.id !== markId));
    } catch (error) {
      logger.error('Error deleting mark:', error);
    }
  }, [setMarks]);

  /**
   * Bulk update multiple marks
   */
  const handleBulkMarksUpdate = useCallback(async (updatedMarks: RaceMark[]) => {
    if (!updatedMarks || updatedMarks.length === 0) {
      return;
    }

    try {
      logger.debug('Bulk updating marks:', updatedMarks.length);

      const updates = updatedMarks.map((mark) => {
        const lat = mark.latitude ?? mark.coordinates_lat;
        const lng = mark.longitude ?? mark.coordinates_lng;
        return supabase
          .from('race_marks')
          .update({
            latitude: lat,
            longitude: lng,
          })
          .eq('id', mark.id);
      });

      const results = await Promise.allSettled(updates);
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length > 0) {
        throw new Error(`${rejected.length} mark updates failed`);
      }

      setMarks(
        updatedMarks.map((mark) => ({
          ...mark,
          latitude: mark.latitude ?? mark.coordinates_lat ?? 0,
          longitude: mark.longitude ?? mark.coordinates_lng ?? 0,
        }))
      );
    } catch (error) {
      logger.error('Error bulk updating marks:', error);
    }
  }, [setMarks]);

  return {
    handleMarkAdded,
    handleMarkUpdated,
    handleMarkDeleted,
    handleBulkMarksUpdate,
  };
}

export default useRaceMarks;
