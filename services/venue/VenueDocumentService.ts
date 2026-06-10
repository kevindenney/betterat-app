/**
 * VenueDocumentService - Document upload and AI extraction
 * Handles PDFs, videos, and knowledge extraction
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('VenueDocumentService');

export interface VenueKnowledgeDocument {
  id: string;
  venue_id: string;
  uploader_id: string | null;
  title: string;
  author_name: string | null;
  document_url: string | null;
  document_type: DocumentType;
  original_source_url: string | null;
  published_date: string | null;
  description: string | null;
  is_public: boolean;
  fleet_id: string | null;
  race_route_id: string | null;
  upvotes: number;
  view_count: number;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  uploader?: {
    id: string;
    full_name: string | null;
  };
  race_route?: {
    id: string;
    name: string;
  };
  insights_count?: number;
  freshness?: ContentFreshness[];
}

export interface VenueKnowledgeInsight {
  id: string;
  document_id: string | null;
  venue_id: string;
  author_id: string | null;
  category: InsightCategory;
  title: string | null;
  content: string;
  conditions_context: ConditionsContext | null;
  location_coords: { lat: number; lng: number } | null;
  location_name: string | null;
  ai_extracted: boolean;
  confidence_score: number | null;
  source_page_numbers: string | null;
  community_verified: boolean;
  verified_count: number;
  disputed_count: number;
  upvotes: number;
  comment_count: number;
  is_public: boolean;
  fleet_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentFreshness {
  id: string;
  content_type: 'document' | 'insight' | 'tip';
  content_id: string;
  user_id: string;
  status: 'still_accurate' | 'needs_update' | 'outdated';
  notes: string | null;
  created_at: string;
}

export type DocumentType = 'pdf' | 'video_link' | 'external_url' | 'presentation';
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type InsightCategory =
  | 'wind_pattern'
  | 'tide_strategy'
  | 'current_pattern'
  | 'mark_tactic'
  | 'start_line'
  | 'hazard'
  | 'shore_effect'
  | 'seasonal'
  | 'general';

export interface ConditionsContext {
  wind_direction?: string;
  wind_speed_range?: [number, number];
  tide_phase?: 'flood' | 'ebb' | 'slack_high' | 'slack_low';
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
}

export interface UploadDocumentParams {
  venue_id: string;
  title: string;
  author_name?: string;
  document_type: DocumentType;
  original_source_url?: string;
  published_date?: string;
  description?: string;
  is_public?: boolean;
  fleet_id?: string;
  race_route_id?: string;
  file?: File; // For PDF uploads
  external_url?: string; // For video links or external URLs
}

export interface CreateInsightParams {
  venue_id: string;
  document_id?: string;
  category: InsightCategory;
  title?: string;
  content: string;
  conditions_context?: ConditionsContext;
  location_coords?: { lat: number; lng: number };
  location_name?: string;
  is_public?: boolean;
  fleet_id?: string;
}

class VenueDocumentServiceClass {
  private buildInsightsFromExtraction(
    raceData: any,
    confidenceScore: number | null
  ): {
    category: InsightCategory;
    title: string;
    content: string;
    confidence_score: number | null;
  }[] {
    const insights: {
      category: InsightCategory;
      title: string;
      content: string;
      confidence_score: number | null;
    }[] = [];

    const venue = raceData?.venue || raceData?.location;
    const raceName = raceData?.raceName || raceData?.name || 'Race document';
    const wind = raceData?.expectedConditions;
    const vhf = raceData?.vhfChannel
      || (Array.isArray(raceData?.vhfChannels) ? raceData.vhfChannels.map((v: any) => v?.channel).filter(Boolean).join(', ') : undefined);
    const areaNotes = raceData?.racingAreaDescription || raceData?.venueSpecificNotes;
    const marks = Array.isArray(raceData?.marks) ? raceData.marks : [];

    if (wind) {
      insights.push({
        category: 'wind_pattern',
        title: `${raceName}: wind guidance`,
        content: String(wind),
        confidence_score: confidenceScore,
      });
    }

    if (vhf) {
      insights.push({
        category: 'general',
        title: `${raceName}: VHF communication`,
        content: `Primary communications channel(s): ${vhf}.`,
        confidence_score: confidenceScore,
      });
    }

    if (areaNotes) {
      insights.push({
        category: 'shore_effect',
        title: `${raceName}: venue and area notes`,
        content: String(areaNotes),
        confidence_score: confidenceScore,
      });
    }

    if (marks.length > 0) {
      const describedMarks = marks
        .slice(0, 6)
        .map((mark: any) => {
          const name = mark?.name || mark?.label || 'Unnamed mark';
          const note = mark?.notes ? ` (${mark.notes})` : '';
          return `${name}${note}`;
        })
        .join(', ');

      insights.push({
        category: 'mark_tactic',
        title: `${raceName}: course marks`,
        content: `Extracted mark/course references${venue ? ` for ${venue}` : ''}: ${describedMarks}.`,
        confidence_score: confidenceScore,
      });
    }

    if (insights.length === 0) {
      const summaryParts = [
        raceName ? `Race: ${raceName}` : null,
        venue ? `Venue: ${venue}` : null,
        raceData?.raceDate ? `Date: ${raceData.raceDate}` : null,
      ].filter(Boolean);

      insights.push({
        category: 'general',
        title: `${raceName}: extracted summary`,
        content: summaryParts.length > 0
          ? `${summaryParts.join(' | ')}.`
          : 'Race information was extracted from this document.',
        confidence_score: confidenceScore,
      });
    }

    return insights.slice(0, 5);
  }

  /**
   * Get documents for a venue
   */
  async getDocuments(
    venueId: string,
    options: {
      raceRouteId?: string | null;
      includeGeneral?: boolean;
      limit?: number;
      offset?: number;
      sortBy?: 'recent' | 'popular';
    } = {}
  ): Promise<{ data: VenueKnowledgeDocument[]; count: number }> {
    const {
      raceRouteId,
      includeGeneral = true,
      limit = 20,
      offset = 0,
      sortBy = 'recent'
    } = options;

    let query = supabase
      .from('venue_knowledge_documents')
      .select(`
        *,
        race_route:race_routes!race_route_id (
          id,
          name
        )
      `, { count: 'exact' })
      .eq('venue_id', venueId);

    // Filter by race route - include route-specific AND general documents
    if (raceRouteId) {
      if (includeGeneral) {
        query = query.or(`race_route_id.eq.${raceRouteId},race_route_id.is.null`);
      } else {
        query = query.eq('race_route_id', raceRouteId);
      }
    }

    if (sortBy === 'popular') {
      query = query.order('upvotes', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[VenueDocumentService] Error fetching documents:', error);
      throw error;
    }

    return { data: data || [], count: count || 0 };
  }

  /**
   * Get a single document with its insights
   */
  async getDocument(documentId: string): Promise<VenueKnowledgeDocument | null> {
    const { data, error } = await supabase
      .from('venue_knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      logger.error('[VenueDocumentService] Error fetching document:', error);
      return null;
    }

    // Increment view count
    await supabase
      .from('venue_knowledge_documents')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', documentId);

    return data;
  }

  /**
   * Upload a document
   */
  async uploadDocument(params: UploadDocumentParams): Promise<VenueKnowledgeDocument> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to upload documents');

    let documentUrl = params.external_url || null;

    // Upload file to storage if provided
    if (params.file && params.document_type === 'pdf') {
      const fileName = `${params.venue_id}/${Date.now()}-${params.file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('venue-documents')
        .upload(fileName, params.file, {
          contentType: params.file.type,
          upsert: false,
        });

      if (uploadError) {
        logger.error('[VenueDocumentService] Error uploading file:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('venue-documents')
        .getPublicUrl(uploadData.path);

      documentUrl = urlData.publicUrl;
    }

    // Create document record
    const { data, error } = await supabase
      .from('venue_knowledge_documents')
      .insert({
        venue_id: params.venue_id,
        uploader_id: user.id,
        title: params.title,
        author_name: params.author_name || null,
        document_url: documentUrl,
        document_type: params.document_type,
        original_source_url: params.original_source_url || null,
        published_date: params.published_date || null,
        description: params.description || null,
        is_public: params.is_public ?? true,
        fleet_id: params.fleet_id || null,
        race_route_id: params.race_route_id || null,
        extraction_status: params.document_type === 'pdf' ? 'pending' : 'completed',
      })
      .select()
      .single();

    if (error) {
      logger.error('[VenueDocumentService] Error creating document:', error);
      throw error;
    }

    // If PDF, trigger AI extraction asynchronously
    if (params.document_type === 'pdf' && documentUrl) {
      this.triggerExtraction(data.id, documentUrl).catch(err => {
        logger.error('[VenueDocumentService] Background extraction failed:', err);
      });
    }

    return data;
  }

  /**
   * Trigger AI extraction for a document
   */
  async triggerExtraction(documentId: string, _documentUrl: string): Promise<void> {
    try {
      // Update status to processing
      await supabase
        .from('venue_knowledge_documents')
        .update({ extraction_status: 'processing' })
        .eq('id', documentId);

      const { data: documentRow, error: documentError } = await supabase
        .from('venue_knowledge_documents')
        .select('id, venue_id, fleet_id, document_url, title')
        .eq('id', documentId)
        .single();

      if (documentError || !documentRow) {
        throw new Error(documentError?.message || 'Document not found for extraction');
      }

      const extractionUrl = documentRow.document_url || _documentUrl;
      if (!extractionUrl) {
        throw new Error('Document URL is missing for extraction');
      }

      const { data: extractionData, error: extractionError } = await supabase.functions.invoke(
        'extract-race-details',
        { body: { url: extractionUrl } }
      );

      if (extractionError) {
        throw new Error(extractionError.message || 'Document extraction failed');
      }

      const raceData = extractionData?.races?.[0] || extractionData?.data;
      if (!raceData) {
        throw new Error('No extractable race data was returned');
      }

      const rawConfidence = extractionData?.overallConfidence ?? extractionData?.confidence;
      const confidenceScore = typeof rawConfidence === 'number'
        ? Math.max(0, Math.min(1, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence))
        : null;

      const insightsToInsert = this.buildInsightsFromExtraction(raceData, confidenceScore)
        .map((insight) => ({
          document_id: documentId,
          venue_id: documentRow.venue_id,
          author_id: null,
          category: insight.category,
          title: insight.title,
          content: insight.content,
          ai_extracted: true,
          confidence_score: insight.confidence_score,
          source_page_numbers: null,
          is_public: true,
          fleet_id: documentRow.fleet_id || null,
        }));

      if (insightsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('venue_knowledge_insights')
          .insert(insightsToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      await supabase
        .from('venue_knowledge_documents')
        .update({
          extraction_status: 'completed',
          extraction_error: null,
        })
        .eq('id', documentId);

    } catch (error) {
      logger.error('[VenueDocumentService] Extraction error:', error);
      await supabase
        .from('venue_knowledge_documents')
        .update({
          extraction_status: 'failed',
          extraction_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', documentId);
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Get document to find storage path
    const { data: doc } = await supabase
      .from('venue_knowledge_documents')
      .select('document_url')
      .eq('id', documentId)
      .single();

    // Delete from storage if exists
    if (doc?.document_url && doc.document_url.includes('venue-documents')) {
      const path = doc.document_url.split('venue-documents/')[1];
      if (path) {
        await supabase.storage.from('venue-documents').remove([path]);
      }
    }

    // Delete document record (cascade will delete insights)
    const { error } = await supabase
      .from('venue_knowledge_documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      logger.error('[VenueDocumentService] Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get insights for a venue
   */
  async getInsights(
    venueId: string,
    options: {
      documentId?: string;
      category?: InsightCategory;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: VenueKnowledgeInsight[]; count: number }> {
    const { documentId, category, limit = 50, offset = 0 } = options;

    let query = supabase
      .from('venue_knowledge_insights')
      .select('*', { count: 'exact' })
      .eq('venue_id', venueId);

    if (documentId) {
      query = query.eq('document_id', documentId);
    }

    if (category) {
      query = query.eq('category', category);
    }

    query = query
      .order('upvotes', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[VenueDocumentService] Error fetching insights:', error);
      throw error;
    }

    return { data: data || [], count: count || 0 };
  }

  /**
   * Create a manual insight (not AI-extracted)
   */
  async createInsight(params: CreateInsightParams): Promise<VenueKnowledgeInsight> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to create insights');

    const { data, error } = await supabase
      .from('venue_knowledge_insights')
      .insert({
        venue_id: params.venue_id,
        document_id: params.document_id || null,
        author_id: user.id,
        category: params.category,
        title: params.title || null,
        content: params.content,
        conditions_context: params.conditions_context || null,
        location_coords: params.location_coords || null,
        location_name: params.location_name || null,
        ai_extracted: false,
        is_public: params.is_public ?? true,
        fleet_id: params.fleet_id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('[VenueDocumentService] Error creating insight:', error);
      throw error;
    }

    return data;
  }

  /**
   * Verify/dispute an insight
   */
  async verifyInsight(insightId: string, verified: boolean): Promise<void> {
    const { data: insight } = await supabase
      .from('venue_knowledge_insights')
      .select('verified_count, disputed_count')
      .eq('id', insightId)
      .single();

    if (!insight) throw new Error('Insight not found');

    const updates = verified
      ? { verified_count: (insight.verified_count || 0) + 1 }
      : { disputed_count: (insight.disputed_count || 0) + 1 };

    // Auto-verify if enough verifications
    if (verified && updates.verified_count >= 3) {
      Object.assign(updates, { community_verified: true });
    }

    const { error } = await supabase
      .from('venue_knowledge_insights')
      .update(updates)
      .eq('id', insightId);

    if (error) {
      logger.error('[VenueDocumentService] Error verifying insight:', error);
      throw error;
    }
  }

  /**
   * Mark content freshness
   */
  async markFreshness(
    contentType: 'document' | 'insight' | 'tip',
    contentId: string,
    status: 'still_accurate' | 'needs_update' | 'outdated',
    notes?: string
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to mark freshness');

    const { error } = await supabase
      .from('venue_content_freshness')
      .upsert({
        content_type: contentType,
        content_id: contentId,
        user_id: user.id,
        status,
        notes: notes || null,
      }, {
        onConflict: 'content_type,content_id,user_id',
      });

    if (error) {
      logger.error('[VenueDocumentService] Error marking freshness:', error);
      throw error;
    }
  }

  /**
   * Get freshness status for content
   */
  async getFreshness(
    contentType: 'document' | 'insight' | 'tip',
    contentId: string
  ): Promise<{ still_accurate: number; needs_update: number; outdated: number }> {
    const { data, error } = await supabase
      .from('venue_content_freshness')
      .select('status')
      .eq('content_type', contentType)
      .eq('content_id', contentId);

    if (error) {
      logger.error('[VenueDocumentService] Error fetching freshness:', error);
      return { still_accurate: 0, needs_update: 0, outdated: 0 };
    }

    const counts = {
      still_accurate: 0,
      needs_update: 0,
      outdated: 0,
    };

    data?.forEach(f => {
      if (f.status in counts) {
        counts[f.status as keyof typeof counts]++;
      }
    });

    return counts;
  }

  /**
   * Get insight categories
   */
  getInsightCategories(): { value: InsightCategory; label: string; icon: string }[] {
    return [
      { value: 'wind_pattern', label: 'Wind Pattern', icon: 'sunny-outline' },
      { value: 'tide_strategy', label: 'Tide Strategy', icon: 'water-outline' },
      { value: 'current_pattern', label: 'Current Pattern', icon: 'swap-horizontal-outline' },
      { value: 'mark_tactic', label: 'Mark Tactic', icon: 'flag-outline' },
      { value: 'start_line', label: 'Start Line', icon: 'play-outline' },
      { value: 'hazard', label: 'Hazard', icon: 'warning-outline' },
      { value: 'shore_effect', label: 'Shore Effect', icon: 'earth-outline' },
      { value: 'seasonal', label: 'Seasonal', icon: 'calendar-outline' },
      { value: 'general', label: 'General', icon: 'information-circle-outline' },
    ];
  }
}

export const VenueDocumentService = new VenueDocumentServiceClass();
