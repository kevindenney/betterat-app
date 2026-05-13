/**
 * Club Document Service
 * Manages club-level documents (SSI, policies, attachments, etc.)
 * that can be inherited by races at the club.
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import { isUuid } from '@/utils/uuid';
import type {
  ClubDocument,
  ClubDocumentWithDetails,
  ClubDocumentCategory,
  SSISubtype,
  ClubDocumentAIExtraction,
} from '@/types/documents';

const logger = createLogger('ClubDocumentService');

// =============================================================================
// DATABASE MAPPING
// =============================================================================

/**
 * Map database row to ClubDocument
 */
function mapClubDocument(row: any): ClubDocument {
  return {
    id: row.id,
    clubId: row.club_id,
    documentId: row.document_id,
    externalUrl: row.external_url,
    documentCategory: row.document_category as ClubDocumentCategory,
    documentSubtype: row.document_subtype as SSISubtype | undefined,
    title: row.title,
    description: row.description,
    version: row.version,
    effectiveDate: row.effective_date,
    isActive: row.is_active,
    displayOrder: row.display_order,
    aiExtraction: row.ai_extraction,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ClubDocumentService {
  /**
   * Get all club documents for a club
   */
  async getClubDocuments(clubId: string): Promise<ClubDocumentWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('club_documents')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('document_category')
        .order('display_order');

      if (error) {
        logger.error('Error fetching club documents:', error);
        throw error;
      }

      // Fetch document details for documents with document_id
      const documentsWithDetails = await Promise.all(
        (data || []).map(async (row) => {
          const clubDoc = mapClubDocument(row);

          if (!row.document_id) {
            return clubDoc as ClubDocumentWithDetails;
          }

          try {
            const { data: docData, error: docError } = await supabase
              .from('documents')
              .select('*')
              .eq('id', row.document_id)
              .single();

            if (docError || !docData) {
              return clubDoc as ClubDocumentWithDetails;
            }

            // Construct public URL from storage path
            let publicUrl = docData.file_path;
            if (docData.file_path && !docData.file_path.startsWith('http')) {
              const { data: urlData } = supabase.storage
                .from('documents')
                .getPublicUrl(docData.file_path);
              publicUrl = urlData?.publicUrl || docData.file_path;
            }

            return {
              ...clubDoc,
              document: {
                id: docData.id,
                filename: docData.filename,
                fileType: docData.mime_type,
                fileSize: docData.file_size,
                url: publicUrl,
                publicUrl: publicUrl,
              },
            } as ClubDocumentWithDetails;
          } catch (err) {
            logger.warn('Error fetching document details:', err);
            return clubDoc as ClubDocumentWithDetails;
          }
        })
      );

      return documentsWithDetails;
    } catch (error) {
      logger.error('Exception in getClubDocuments:', error);
      return [];
    }
  }

  /**
   * Get SSI documents for a club (main SSI, attachments, appendices)
   * Returns structured result grouped by category
   */
  async getSSIDocuments(clubId: string): Promise<{
    mainSSI: ClubDocumentWithDetails[];
    attachments: ClubDocumentWithDetails[];
    appendices: ClubDocumentWithDetails[];
  }> {
    try {
      const allDocs = await this.getClubDocuments(clubId);

      return {
        mainSSI: allDocs.filter((d) => d.documentCategory === 'ssi'),
        attachments: allDocs.filter((d) => d.documentCategory === 'attachment'),
        appendices: allDocs.filter((d) => d.documentCategory === 'appendix'),
      };
    } catch (error) {
      logger.error('Exception in getSSIDocuments:', error);
      return { mainSSI: [], attachments: [], appendices: [] };
    }
  }

  /**
   * Get a single club document by ID
   */
  async getClubDocument(documentId: string): Promise<ClubDocumentWithDetails | null> {
    try {
      const { data, error } = await supabase
        .from('club_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !data) {
        logger.error('Error fetching club document:', error);
        return null;
      }

      const clubDoc = mapClubDocument(data);

      // Fetch document details if available
      if (data.document_id) {
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', data.document_id)
          .single();

        if (!docError && docData) {
          let publicUrl = docData.file_path;
          if (docData.file_path && !docData.file_path.startsWith('http')) {
            const { data: urlData } = supabase.storage
              .from('documents')
              .getPublicUrl(docData.file_path);
            publicUrl = urlData?.publicUrl || docData.file_path;
          }

          return {
            ...clubDoc,
            document: {
              id: docData.id,
              filename: docData.filename,
              fileType: docData.mime_type,
              fileSize: docData.file_size,
              url: publicUrl,
              publicUrl: publicUrl,
            },
          };
        }
      }

      return clubDoc as ClubDocumentWithDetails;
    } catch (error) {
      logger.error('Exception in getClubDocument:', error);
      return null;
    }
  }

  /**
   * Add a club document from external URL
   * Used for linking to club website documents without downloading
   */
  async addClubDocumentFromUrl(params: {
    clubId: string;
    externalUrl: string;
    title: string;
    documentCategory: ClubDocumentCategory;
    documentSubtype?: SSISubtype;
    description?: string;
    version?: string;
    effectiveDate?: string;
    displayOrder?: number;
    createdBy?: string;
  }): Promise<ClubDocument | null> {
    try {
      const { data, error } = await supabase
        .from('club_documents')
        .insert({
          club_id: params.clubId,
          external_url: params.externalUrl,
          title: params.title,
          document_category: params.documentCategory,
          document_subtype: params.documentSubtype,
          description: params.description,
          version: params.version,
          effective_date: params.effectiveDate,
          display_order: params.displayOrder ?? 0,
          created_by: params.createdBy,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding club document from URL:', error);
        throw error;
      }

      return mapClubDocument(data);
    } catch (error) {
      logger.error('Exception in addClubDocumentFromUrl:', error);
      return null;
    }
  }

  /**
   * Link an uploaded document to a club
   */
  async linkDocumentToClub(params: {
    clubId: string;
    documentId: string;
    title: string;
    documentCategory: ClubDocumentCategory;
    documentSubtype?: SSISubtype;
    description?: string;
    version?: string;
    effectiveDate?: string;
    displayOrder?: number;
    createdBy?: string;
  }): Promise<ClubDocument | null> {
    try {
      const { data, error } = await supabase
        .from('club_documents')
        .insert({
          club_id: params.clubId,
          document_id: params.documentId,
          title: params.title,
          document_category: params.documentCategory,
          document_subtype: params.documentSubtype,
          description: params.description,
          version: params.version,
          effective_date: params.effectiveDate,
          display_order: params.displayOrder ?? 0,
          created_by: params.createdBy,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error linking document to club:', error);
        throw error;
      }

      return mapClubDocument(data);
    } catch (error) {
      logger.error('Exception in linkDocumentToClub:', error);
      return null;
    }
  }

  /**
   * Update a club document
   */
  async updateClubDocument(
    documentId: string,
    updates: Partial<{
      title: string;
      description: string;
      documentCategory: ClubDocumentCategory;
      documentSubtype: SSISubtype;
      version: string;
      effectiveDate: string;
      displayOrder: number;
      externalUrl: string;
      aiExtraction: ClubDocumentAIExtraction;
    }>
  ): Promise<ClubDocument | null> {
    try {
      const dbUpdates: Record<string, any> = {};

      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.documentCategory !== undefined) dbUpdates.document_category = updates.documentCategory;
      if (updates.documentSubtype !== undefined) dbUpdates.document_subtype = updates.documentSubtype;
      if (updates.version !== undefined) dbUpdates.version = updates.version;
      if (updates.effectiveDate !== undefined) dbUpdates.effective_date = updates.effectiveDate;
      if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
      if (updates.externalUrl !== undefined) dbUpdates.external_url = updates.externalUrl;
      if (updates.aiExtraction !== undefined) dbUpdates.ai_extraction = updates.aiExtraction;

      const { data, error } = await supabase
        .from('club_documents')
        .update(dbUpdates)
        .eq('id', documentId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating club document:', error);
        throw error;
      }

      return mapClubDocument(data);
    } catch (error) {
      logger.error('Exception in updateClubDocument:', error);
      return null;
    }
  }

  /**
   * Store AI extraction results for a club document
   */
  async storeAIExtraction(
    documentId: string,
    extraction: ClubDocumentAIExtraction
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('club_documents')
        .update({
          ai_extraction: {
            ...extraction,
            extractedAt: new Date().toISOString(),
          },
        })
        .eq('id', documentId);

      if (error) {
        logger.error('Error storing AI extraction:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception in storeAIExtraction:', error);
      return false;
    }
  }

  /**
   * Deactivate a club document (soft delete)
   */
  async deactivateClubDocument(documentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('club_documents')
        .update({ is_active: false })
        .eq('id', documentId);

      if (error) {
        logger.error('Error deactivating club document:', error);
        throw error;
      }

      return true;
    } catch (error) {
      logger.error('Exception in deactivateClubDocument:', error);
      return false;
    }
  }

  /**
   * Permanently delete a club document
   */
  async deleteClubDocument(documentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('club_documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        logger.error('Error deleting club document:', error);
        throw error;
      }

      return true;
    } catch (error) {
      logger.error('Exception in deleteClubDocument:', error);
      return false;
    }
  }

  /**
   * Reorder club documents
   */
  async reorderClubDocuments(
    clubId: string,
    documentOrders: { id: string; displayOrder: number }[]
  ): Promise<boolean> {
    try {
      // Update each document's display order
      const updates = documentOrders.map(({ id, displayOrder }) =>
        supabase
          .from('club_documents')
          .update({ display_order: displayOrder })
          .eq('id', id)
          .eq('club_id', clubId)
      );

      await Promise.all(updates);
      return true;
    } catch (error) {
      logger.error('Exception in reorderClubDocuments:', error);
      return false;
    }
  }

  /**
   * Get club ID for a race (from regatta or race_event)
   * Used to resolve which club's documents should be inherited
   */
  async getClubIdForRace(raceId: string): Promise<string | null> {
    // Skip query for demo races or invalid UUIDs to prevent 400 errors
    if (!raceId || !isUuid(raceId)) {
      return null;
    }

    try {
      // First check regattas table
      const { data: regatta } = await supabase
        .from('regattas')
        .select('club_id')
        .eq('id', raceId)
        .maybeSingle();

      if (regatta?.club_id) {
        return regatta.club_id;
      }

      // Check race_events table (may have regatta_id that references a regatta with club_id)
      const { data: raceEvent } = await supabase
        .from('race_events')
        .select('regatta_id')
        .eq('id', raceId)
        .maybeSingle();

      if (raceEvent?.regatta_id) {
        const { data: regattaFromEvent } = await supabase
          .from('regattas')
          .select('club_id')
          .eq('id', raceEvent.regatta_id)
          .maybeSingle();

        if (regattaFromEvent?.club_id) {
          return regattaFromEvent.club_id;
        }
      }

      return null;
    } catch (error) {
      logger.error('Exception in getClubIdForRace:', error);
      return null;
    }
  }
}

export const clubDocumentService = new ClubDocumentService();
