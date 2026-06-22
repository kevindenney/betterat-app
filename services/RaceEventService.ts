// @ts-nocheck

/**
 * Race Event Service
 *
 * Core service for managing race events and course intelligence
 * Powers the race strategy data gathering UX
 *
 * See: plans/race-strategy-data-gathering-ux.md
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import {
  RaceEvent,
  RaceEventInsert,
  RaceEventUpdate,
  RaceEventWithDetails,
  RaceEventSummary,
  CourseMark,
  CourseMarkInsert,
  CreateRaceEventParams,
  ProcessDocumentsParams,
  ExtractionStatus,
  ExtractionMethod,
  CourseGeoJSON
} from '../types/raceEvents';

const logger = createLogger('RaceEventService');

export class RaceEventService {
  /**
   * Create a new race event
   * This is typically called when user provides race details or uploads documents
   */
  static async createRaceEvent(params: CreateRaceEventParams): Promise<{ data: RaceEvent | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const eventData: RaceEventInsert = {
        user_id: user.id,
        name: params.race_name,
        race_series: params.race_series,
        boat_class: params.boat_class,
        start_time: params.start_time,
        venue_id: params.venue_id,
        racing_area_name: params.racing_area_name,
        source_documents: params.source_documents || [],
        extraction_method: params.source_url ? ExtractionMethod.AI_AUTO : ExtractionMethod.MANUAL,
        extraction_status: params.source_url ? ExtractionStatus.PENDING : ExtractionStatus.COMPLETED,

        // Race type
        race_type: params.race_type || 'fleet',

        // Common fields
        location: params.location,
        latitude: params.latitude,
        longitude: params.longitude,
        vhf_channel: params.vhf_channel,
        notes: params.notes,

        // Boat and club references
        boat_id: params.boat_id,
        club_id: params.club_id,

        // Fleet racing fields
        course_type: params.course_type,
        number_of_laps: params.number_of_laps,
        expected_fleet_size: params.expected_fleet_size,

        // Distance racing fields
        route_waypoints: params.route_waypoints,
        total_distance_nm: params.total_distance_nm,
        time_limit_hours: params.time_limit_hours,
        start_finish_same_location: params.start_finish_same_location,
        route_description: params.route_description,

        // Match racing fields
        opponent_name: params.opponent_name,
        match_round: params.match_round,
        total_rounds: params.total_rounds,
        series_format: params.series_format,
        has_umpire: params.has_umpire,

        // Team racing fields
        your_team_name: params.your_team_name,
        opponent_team_name: params.opponent_team_name,
        heat_number: params.heat_number,
        team_size: params.team_size,
        team_members: params.team_members,
      };

      const { data, error } = await supabase
        .from('race_events')
        .insert(eventData)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      logger.error('Error creating race event:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get race event by ID with all related data
   */
  static async getRaceEvent(raceEventId: string): Promise<{ data: RaceEventWithDetails | null; error: Error | null }> {
    try {
      // Get race event
      const { data: raceEvent, error: raceError } = await supabase
        .from('race_events')
        .select('*')
        .eq('id', raceEventId)
        .single();

      if (raceError) throw raceError;
      if (!raceEvent) throw new Error('Race event not found');

      // Get venue details
      let venue = null;
      if (raceEvent.venue_id) {
        const { data: venueData } = await supabase
          .from('sailing_venues')
          .select('id, name, coordinates_lat, coordinates_lng, country, region')
          .eq('id', raceEvent.venue_id)
          .single();
        venue = venueData;
      }

      // Get course marks from race_marks table
      const { data: marks } = await supabase
        .from('race_marks')
        .select('*')
        .eq('race_id', raceEventId)
        .order('created_at', { ascending: true });

      // Get environmental forecasts
      const { data: forecasts } = await supabase
        .from('environmental_forecasts')
        .select('*')
        .eq('race_event_id', raceEventId)
        .order('forecast_time', { ascending: true });

      // Get document processing jobs
      const { data: processing_jobs } = await supabase
        .from('document_processing_jobs')
        .select('*')
        .eq('race_event_id', raceEventId)
        .order('created_at', { ascending: false });

      const result: RaceEventWithDetails = {
        ...raceEvent,
        venue: venue || undefined,
        marks: marks || [],
        forecasts: forecasts || [],
        processing_jobs: processing_jobs || []
      };

      return { data: result, error: null };
    } catch (error) {
      logger.error('Error fetching race event:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get upcoming races for current user
   */
  static async getUpcomingRaces(daysAhead: number = 30): Promise<{ data: RaceEventSummary[]; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('get_upcoming_races', {
        p_user_id: user.id,
        p_days_ahead: daysAhead
      });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      logger.error('Error fetching upcoming races:', error);
      return { data: [], error: error as Error };
    }
  }

  /**
   * Get all races for current user (with filtering)
   */
  static async getUserRaces(filters?: {
    status?: string;
    venue_id?: string;
    boat_class?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<{ data: RaceEvent[]; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('race_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.venue_id) {
        query = query.eq('venue_id', filters.venue_id);
      }
      if (filters?.boat_class) {
        query = query.eq('boat_class', filters.boat_class);
      }
      if (filters?.from_date) {
        query = query.gte('start_time', filters.from_date);
      }
      if (filters?.to_date) {
        query = query.lte('start_time', filters.to_date);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      logger.error('Error fetching user races:', error);
      return { data: [], error: error as Error };
    }
  }

  /**
   * Update race event
   */
  static async updateRaceEvent(
    raceEventId: string,
    updates: RaceEventUpdate
  ): Promise<{ data: RaceEvent | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('race_events')
        .update(updates)
        .eq('id', raceEventId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      logger.error('Error updating race event:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Delete race event (cascades to marks, forecasts, jobs)
   */
  static async deleteRaceEvent(raceEventId: string): Promise<{ error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('race_events')
        .delete()
        .eq('id', raceEventId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Race event not found.');

      return { error: null };
    } catch (error) {
      logger.error('Error deleting race event:', error);
      return { error: error as Error };
    }
  }

  /**
   * Add course marks to race event
   */
  static async addCourseMarks(
    raceEventId: string,
    marks: CourseMarkInsert[]
  ): Promise<{ data: CourseMark[] | null; error: Error | null }> {
    try {
      const marksWithRaceId = marks.map(mark => ({
        ...mark,
        race_id: raceEventId
      }));

      const { data, error } = await supabase
        .from('race_marks')
        .insert(marksWithRaceId)
        .select();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      logger.error('Error adding course marks:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Update course marks
   */
  static async updateCourseMarks(
    raceEventId: string,
    marks: CourseMark[]
  ): Promise<{ data: CourseMark[] | null; error: Error | null }> {
    try {
      // Delete existing marks
      await supabase
        .from('race_marks')
        .delete()
        .eq('race_id', raceEventId);

      // Insert new marks
      const marksToInsert = marks.map(({ id: _id, created_at: _createdAt, updated_at: _updatedAt, ...mark }) => ({
        ...mark,
        race_id: raceEventId
      }));

      const { data, error } = await supabase
        .from('race_marks')
        .insert(marksToInsert)
        .select();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      logger.error('Error updating course marks:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get course marks as GeoJSON (for MapLibre)
   */
  static async getCourseMarksGeoJSON(raceEventId: string): Promise<{ data: CourseGeoJSON | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('get_course_marks_geojson', {
        p_race_event_id: raceEventId
      });

      if (error) throw error;

      return { data: data as CourseGeoJSON, error: null };
    } catch (error) {
      logger.error('Error fetching course marks GeoJSON:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Start document processing for race event
   * This triggers the DocumentProcessingAgent
   */
  static async processDocuments(params: ProcessDocumentsParams): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create document processing jobs
      const jobs = params.documents.map(doc => ({
        race_event_id: params.race_event_id,
        user_id: user.id,
        document_type: doc.type,
        document_url: doc.url,
        document_filename: doc.filename,
        document_content: doc.content,
        status: 'pending'
      }));

      const { data: insertedJobs, error: jobsError } = await supabase
        .from('document_processing_jobs')
        .insert(jobs)
        .select('id, document_url, document_content, document_type');

      if (jobsError) throw jobsError;

      // Update race event status
      await this.updateRaceEvent(params.race_event_id, {
        extraction_status: ExtractionStatus.PROCESSING
      });

      // Process each job immediately via edge-function extraction.
      // This replaces the old TODO placeholder and keeps job/race status in sync.
      let completedCount = 0;
      let failedCount = 0;

      const typedJobs = Array.isArray(insertedJobs) ? insertedJobs : jobs;

      for (let i = 0; i < typedJobs.length; i += 1) {
        const job = typedJobs[i] as any;
        const jobId = job?.id;
        const payload = (job?.document_content && String(job.document_content).trim().length > 0)
          ? { text: String(job.document_content).trim() }
          : (job?.document_url ? { url: job.document_url } : null);

        if (jobId) {
          await supabase
            .from('document_processing_jobs')
            .update({
              status: 'processing',
              progress_percentage: 20,
              metadata: {
                startedAt: new Date().toISOString(),
                processor: 'extract-race-details',
              },
            })
            .eq('id', jobId);
        }

        if (!payload) {
          failedCount += 1;
          if (jobId) {
            await supabase
              .from('document_processing_jobs')
              .update({
                status: 'failed',
                progress_percentage: 100,
                metadata: {
                  error: 'Document job missing both document_url and document_content',
                  finishedAt: new Date().toISOString(),
                },
              })
              .eq('id', jobId);
          }
          continue;
        }

        try {
          const { data: extractionData, error: extractionError } = await supabase.functions.invoke(
            'extract-race-details',
            { body: payload }
          );

          if (extractionError) {
            throw extractionError;
          }

          const extractedRace =
            extractionData?.races?.[0] ||
            extractionData?.data ||
            null;

          completedCount += 1;

          if (jobId) {
            await supabase
              .from('document_processing_jobs')
              .update({
                status: 'completed',
                progress_percentage: 100,
                metadata: {
                  finishedAt: new Date().toISOString(),
                  overallConfidence: extractionData?.overallConfidence ?? null,
                  extractedFields: extractedRace ? Object.keys(extractedRace) : [],
                },
              })
              .eq('id', jobId);
          }
        } catch (jobError: any) {
          failedCount += 1;

          if (jobId) {
            await supabase
              .from('document_processing_jobs')
              .update({
                status: 'failed',
                progress_percentage: 100,
                metadata: {
                  error: jobError?.message || 'Document extraction failed',
                  finishedAt: new Date().toISOString(),
                },
              })
              .eq('id', jobId);
          }
        }
      }

      await this.updateRaceEvent(params.race_event_id, {
        extraction_status: completedCount > 0 ? ExtractionStatus.COMPLETED : ExtractionStatus.FAILED
      });

      if (completedCount === 0 && failedCount > 0) {
        return { success: false, error: new Error('All document processing jobs failed') };
      }

      return { success: true, error: null };
    } catch (error) {
      logger.error('Error processing documents:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Get saved course template for venue
   * Returns previously used course configuration at this venue
   */
  static async getVenueCourseTemplate(venueId: string, racingAreaName?: string): Promise<{ data: CourseMark[] | null; error: Error | null }> {
    try {
      // Get the most recent race at this venue with completed extraction
      let query = supabase
        .from('race_events')
        .select('id, course_geojson')
        .eq('venue_id', venueId)
        .eq('extraction_status', ExtractionStatus.COMPLETED)
        .order('start_time', { ascending: false })
        .limit(1);

      if (racingAreaName) {
        query = query.eq('racing_area_name', racingAreaName);
      }

      const { data: recentRace, error: raceError } = await query.single();

      if (raceError || !recentRace) {
        return { data: null, error: raceError as Error };
      }

      // Get marks from that race
      const { data: marks, error: marksError } = await supabase
        .from('race_marks')
        .select('*')
        .eq('race_id', recentRace.id)
        .order('created_at', { ascending: true });

      if (marksError) throw marksError;

      return { data: marks, error: null };
    } catch (error) {
      logger.error('Error fetching venue course template:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get races by series
   * Useful for series tracking (e.g., all Croucher Series races)
   */
  static async getRaceSeries(seriesName: string): Promise<{ data: RaceEvent[]; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('race_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('race_series', seriesName)
        .order('start_time', { ascending: true });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      logger.error('Error fetching race series:', error);
      return { data: [], error: error as Error };
    }
  }

  /**
   * Update race status (scheduled → active → completed)
   */
  static async updateRaceStatus(
    raceEventId: string,
    status: string,
    actualStartTime?: string,
    actualFinishTime?: string
  ): Promise<{ error: Error | null }> {
    try {
      const updates: RaceEventUpdate = {
        race_status: status
      };

      if (actualStartTime) {
        updates.actual_start_time = actualStartTime;
      }

      if (actualFinishTime) {
        updates.actual_finish_time = actualFinishTime;
      }

      const { data, error } = await supabase
        .from('race_events')
        .update(updates)
        .eq('id', raceEventId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Race event not found.');

      return { error: null };
    } catch (error) {
      logger.error('Error updating race status:', error);
      return { error: error as Error };
    }
  }

  /**
   * Search races by name or series
   */
  static async searchRaces(searchTerm: string): Promise<{ data: RaceEvent[]; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('race_events')
        .select('*')
        .eq('user_id', user.id)
        .or(`name.ilike.%${searchTerm}%,race_series.ilike.%${searchTerm}%`)
        .order('start_time', { ascending: false })
        .limit(20);

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      logger.error('Error searching races:', error);
      return { data: [], error: error as Error };
    }
  }
}

export default RaceEventService;
