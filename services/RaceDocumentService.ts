/**
 * Race Document Service
 * Manages race-specific documents (sailing instructions, NOTAMs, amendments, etc.)
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import { isUuid } from '@/utils/uuid';
import { documentStorageService, StoredDocument } from './storage/DocumentStorageService';
import { clubDocumentService } from './ClubDocumentService';
import type { RaceDisplayDocument, ClubDocumentWithDetails } from '@/types/documents';

const logger = createLogger('RaceDocumentService');

export type RaceDocumentType =
  | 'sailing_instructions'
  | 'nor'
  | 'course_diagram'
  | 'amendment'
  | 'notam'
  | 'other';

export interface RaceDocument {
  id: string;
  regattaId: string;
  documentId: string;
  userId: string;
  documentType: RaceDocumentType;
  sharedWithFleet: boolean;
  fleetId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface RaceDocumentWithDetails extends RaceDocument {
  document?: StoredDocument;
}

class RaceDocumentService {
  /**
   * Upload document for a race
   */
  async uploadRaceDocument(params: {
    regattaId: string;
    userId: string;
    file: File | Blob;
    documentType: RaceDocumentType;
    filename?: string;
    shareWithFleet?: boolean;
    fleetId?: string;
  }): Promise<RaceDocument | null> {
    try {
      // First, upload the document using DocumentStorageService
      const uploadResult = await documentStorageService.uploadDocument(
        params.userId,
        params.file as any // Cast to handle File/Blob to DocumentPickerAsset conversion
      );

      if (!uploadResult.success || !uploadResult.document) {
        logger.error('Failed to upload document');
        return null;
      }

      // Then, link it to the race
      const { data, error } = await supabase
        .from('race_documents')
        .insert({
          regatta_id: params.regattaId,
          document_id: uploadResult.document.id,
          user_id: params.userId,
          document_type: params.documentType,
          shared_with_fleet: params.shareWithFleet || false,
          fleet_id: params.fleetId,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error linking document to race:', error);
        throw error;
      }

      return this.mapRaceDocument(data);
    } catch (error) {
      logger.error('Exception in uploadRaceDocument:', error);
      return null;
    }
  }

  /**
   * Link existing document to a race
   * Note: The ID can be either a regatta_id or a race_event_id - we'll resolve appropriately
   */
  async linkDocumentToRace(params: {
    regattaId: string;
    documentId: string;
    userId: string;
    documentType: RaceDocumentType;
    shareWithFleet?: boolean;
    fleetId?: string;
  }): Promise<RaceDocument | null> {
    try {
      // Resolve the race reference - could be regatta_id or race_event_id
      const raceRef = await this.resolveRaceReference(params.regattaId);

      if (!raceRef) {
        logger.error('Could not resolve race reference for:', params.regattaId);
        return null;
      }

      const { data, error } = await supabase
        .from('race_documents')
        .insert({
          regatta_id: raceRef.regattaId || null,
          race_event_id: raceRef.raceEventId || null,
          document_id: params.documentId,
          user_id: params.userId,
          document_type: params.documentType,
          shared_with_fleet: params.shareWithFleet || false,
          fleet_id: params.fleetId,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error linking document to race:', error);
        throw error;
      }

      return this.mapRaceDocument(data);
    } catch (error) {
      logger.error('Exception in linkDocumentToRace:', error);
      return null;
    }
  }

  /**
   * Resolve race reference from either a direct regatta_id or a race_event_id
   * Returns either { regattaId } or { raceEventId } depending on what we find
   */
  private async resolveRaceReference(id: string): Promise<{ regattaId?: string; raceEventId?: string } | null> {
    // Skip demo race IDs and invalid UUIDs - DB expects valid UUIDs
    if (!id || !isUuid(id)) {
      return null;
    }

    // First, check if it's a valid regatta ID
    const { data: regatta } = await supabase
      .from('regattas')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (regatta) {
      return { regattaId: regatta.id };
    }

    // Not a regatta - check if it's a race_event
    const { data: raceEvent } = await supabase
      .from('race_events')
      .select('id, regatta_id')
      .eq('id', id)
      .maybeSingle();

    if (raceEvent) {
      // If race_event has a regatta_id, use that; otherwise link directly to race_event
      if (raceEvent.regatta_id) {
        return { regattaId: raceEvent.regatta_id };
      }
      return { raceEventId: raceEvent.id };
    }

    // Could not resolve
    logger.warn('Could not resolve race reference - not found in regattas or race_events:', id);
    return null;
  }

  /**
   * Get all documents for a race
   * Note: The ID can be either a regatta_id or a race_event_id - we'll query appropriately
   */
  async getRaceDocuments(regattaId: string): Promise<RaceDocumentWithDetails[]> {
    try {
      // Resolve the race reference - could be regatta_id or race_event_id
      const raceRef = await this.resolveRaceReference(regattaId);

      if (!raceRef) {
        return [];
      }

      // Query by either regatta_id or race_event_id depending on what we resolved
      let query = supabase
        .from('race_documents')
        .select('*');

      if (raceRef.regattaId) {
        query = query.eq('regatta_id', raceRef.regattaId);
      } else if (raceRef.raceEventId) {
        query = query.eq('race_event_id', raceRef.raceEventId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching race documents:', error);
        throw error;
      }

      // Fetch document details for each race document
      const documentsWithDetails = await Promise.all(
        (data || []).map(async (raceDoc) => {
          try {
            const { data: docData, error: docError } = await supabase
              .from('documents')
              .select('*')
              .eq('id', raceDoc.document_id)
              .single();

            if (docError) {
              logger.warn('Could not fetch document details:', docError);
              return this.mapRaceDocument(raceDoc);
            }

            // Construct public URL from storage path
            let publicUrl = docData.file_path;
            if (docData.file_path && !docData.file_path.startsWith('http')) {
              // Get public URL from Supabase storage
              const { data: urlData } = supabase.storage
                .from('documents')
                .getPublicUrl(docData.file_path);
              publicUrl = urlData?.publicUrl || docData.file_path;
            }

            return {
              ...this.mapRaceDocument(raceDoc),
              document: {
                id: docData.id,
                user_id: docData.user_id,
                filename: docData.filename,
                name: docData.filename,  // Alias for display
                file_type: docData.mime_type,  // DB column is mime_type
                file_size: docData.file_size,
                storage_path: docData.file_path,  // DB column is file_path
                url: publicUrl,  // Constructed public URL
                public_url: publicUrl,  // For compatibility
                created_at: docData.created_at,
                updated_at: docData.updated_at,
                metadata: docData.metadata,
              } as StoredDocument,
            };
          } catch (err) {
            logger.warn('Exception fetching document details:', err);
            return this.mapRaceDocument(raceDoc);
          }
        })
      );

      return documentsWithDetails;
    } catch (error) {
      logger.error('Exception in getRaceDocuments:', error);
      return [];
    }
  }

  /**
   * Get all documents for a race including inherited club documents
   * Returns a unified list with source indicators
   */
  async getRaceDocumentsWithInheritance(
    raceId: string,
    options?: {
      includeClubDocs?: boolean;
    }
  ): Promise<{
    raceDocuments: RaceDisplayDocument[];
    clubDocuments: RaceDisplayDocument[];
    allDocuments: RaceDisplayDocument[];
  }> {
    try {
      const includeClubDocs = options?.includeClubDocs ?? true;

      // Get race-specific documents
      const raceDocumentsRaw = await this.getRaceDocuments(raceId);

      // Map race documents to unified display format
      const raceDocuments: RaceDisplayDocument[] = raceDocumentsRaw.map((doc) => ({
        id: doc.id,
        source: 'race' as const,
        documentType: doc.documentType,
        title: doc.document?.name || doc.document?.filename || 'Document',
        url: doc.document?.url || doc.document?.public_url,
        filename: doc.document?.filename,
        fileType: doc.document?.file_type,
        fileSize: doc.document?.file_size,
        uploadedAt: doc.createdAt,
      }));

      // Get inherited club documents if requested
      let clubDocuments: RaceDisplayDocument[] = [];

      if (includeClubDocs) {
        // Resolve club ID for this race
        const clubId = await clubDocumentService.getClubIdForRace(raceId);

        if (clubId) {
          // Check if race has inherit_club_documents enabled
          const shouldInherit = await this.checkInheritClubDocuments(raceId);

          if (shouldInherit) {
            const clubDocs = await clubDocumentService.getClubDocuments(clubId);
            clubDocuments = this.mapClubDocumentsToDisplay(clubDocs);
          }
        }
      }

      // Combine all documents
      const allDocuments = [...raceDocuments, ...clubDocuments];

      return {
        raceDocuments,
        clubDocuments,
        allDocuments,
      };
    } catch (error) {
      logger.error('Exception in getRaceDocumentsWithInheritance:', error);
      return {
        raceDocuments: [],
        clubDocuments: [],
        allDocuments: [],
      };
    }
  }

  /**
   * Check if a race has inherit_club_documents enabled
   */
  private async checkInheritClubDocuments(raceId: string): Promise<boolean> {
    // Skip query for invalid UUIDs - default to true
    if (!raceId || !isUuid(raceId)) {
      return true;
    }

    try {
      // First check if we have any race_documents records that specify inherit_club_documents
      const { data } = await supabase
        .from('race_documents')
        .select('inherit_club_documents')
        .or(`regatta_id.eq.${raceId},race_event_id.eq.${raceId}`)
        .limit(1)
        .maybeSingle();

      // Default to true (inherit) if no record found or column is true
      return data?.inherit_club_documents !== false;
    } catch (error) {
      // Default to true on error
      return true;
    }
  }

  /**
   * Set whether a race should inherit club documents
   */
  async setInheritClubDocuments(raceId: string, inherit: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('race_documents')
        .update({ inherit_club_documents: inherit })
        .or(`regatta_id.eq.${raceId},race_event_id.eq.${raceId}`);

      if (error) {
        logger.error('Error setting inherit_club_documents:', error);
        return false;
      }
      return true;
    } catch (error) {
      logger.error('Exception in setInheritClubDocuments:', error);
      return false;
    }
  }

  /**
   * Map club documents to unified display format
   */
  private mapClubDocumentsToDisplay(docs: ClubDocumentWithDetails[]): RaceDisplayDocument[] {
    return docs.map((doc) => ({
      id: doc.id,
      source: 'club' as const,
      clubDocumentCategory: doc.documentCategory,
      clubDocumentSubtype: doc.documentSubtype,
      title: doc.title,
      description: doc.description,
      url: doc.document?.url || doc.document?.publicUrl,
      externalUrl: doc.externalUrl,
      filename: doc.document?.filename,
      fileType: doc.document?.fileType,
      fileSize: doc.document?.fileSize,
      uploadedAt: doc.createdAt,
      version: doc.version,
      displayOrder: doc.displayOrder,
      hasAIExtraction: !!doc.aiExtraction,
      aiExtraction: doc.aiExtraction,
    }));
  }

  /**
   * Get documents by type
   */
  async getRaceDocumentsByType(
    regattaId: string,
    documentType: RaceDocumentType
  ): Promise<RaceDocumentWithDetails[]> {
    try {
      const allDocuments = await this.getRaceDocuments(regattaId);
      return allDocuments.filter((doc) => doc.documentType === documentType);
    } catch (error) {
      logger.error('Exception in getRaceDocumentsByType:', error);
      return [];
    }
  }

  /**
   * Share document with fleet
   */
  async shareDocumentWithFleet(raceDocumentId: string, fleetId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('race_documents')
        .update({
          shared_with_fleet: true,
          fleet_id: fleetId,
        })
        .eq('id', raceDocumentId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Error sharing document with fleet:', error);
        throw error;
      }
      if (!data) throw new Error('Race document not found.');

      return true;
    } catch (error) {
      logger.error('Exception in shareDocumentWithFleet:', error);
      return false;
    }
  }

  /**
   * Unshare document from fleet
   */
  async unshareDocumentFromFleet(raceDocumentId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('race_documents')
        .update({
          shared_with_fleet: false,
          fleet_id: null,
        })
        .eq('id', raceDocumentId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Error unsharing document from fleet:', error);
        throw error;
      }
      if (!data) throw new Error('Race document not found.');

      return true;
    } catch (error) {
      logger.error('Exception in unshareDocumentFromFleet:', error);
      return false;
    }
  }

  /**
   * Get fleet shared documents for a race
   */
  async getFleetSharedDocuments(regattaId: string, fleetId: string): Promise<RaceDocumentWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('race_documents')
        .select('*')
        .eq('regatta_id', regattaId)
        .eq('fleet_id', fleetId)
        .eq('shared_with_fleet', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching fleet shared documents:', error);
        throw error;
      }

      // Map to full details
      return Promise.all(
        (data || []).map(async (raceDoc) => {
          const doc = await this.getRaceDocumentDetails(raceDoc.document_id);
          return {
            ...this.mapRaceDocument(raceDoc),
            document: doc || undefined,
          };
        })
      );
    } catch (error) {
      logger.error('Exception in getFleetSharedDocuments:', error);
      return [];
    }
  }

  /**
   * Delete race document link (does not delete the actual document)
   */
  async unlinkDocumentFromRace(raceDocumentId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('race_documents')
        .delete()
        .eq('id', raceDocumentId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Error unlinking document from race:', error);
        throw error;
      }
      if (!data) throw new Error('Race document not found.');

      return true;
    } catch (error) {
      logger.error('Exception in unlinkDocumentFromRace:', error);
      return false;
    }
  }

  /**
   * Get race document statistics
   */
  async getRaceDocumentStats(regattaId: string): Promise<{
    total: number;
    byType: Record<RaceDocumentType, number>;
    sharedWithFleet: number;
  }> {
    try {
      const documents = await this.getRaceDocuments(regattaId);

      const stats = {
        total: documents.length,
        byType: {} as Record<RaceDocumentType, number>,
        sharedWithFleet: documents.filter((d) => d.sharedWithFleet).length,
      };

      // Count by type
      documents.forEach((doc) => {
        stats.byType[doc.documentType] = (stats.byType[doc.documentType] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Exception in getRaceDocumentStats:', error);
      return {
        total: 0,
        byType: {} as Record<RaceDocumentType, number>,
        sharedWithFleet: 0,
      };
    }
  }

  /**
   * Helper: Get document details from documents table
   */
  private async getRaceDocumentDetails(documentId: string): Promise<StoredDocument | null> {
    try {
      const { data, error } = await supabase.from('documents').select('*').eq('id', documentId).single();

      if (error) {
        logger.error('Error fetching document details:', error);
        return null;
      }

      return {
        id: data.id,
        user_id: data.user_id,
        filename: data.filename,
        file_type: data.file_type,
        file_size: data.file_size,
        storage_path: data.storage_path,
        created_at: data.created_at,
        updated_at: data.updated_at,
        metadata: data.metadata,
      } as StoredDocument;
    } catch (error) {
      logger.error('Exception in getRaceDocumentDetails:', error);
      return null;
    }
  }

  /**
   * Helper method to map database row to RaceDocument
   */
  private mapRaceDocument(data: any): RaceDocument {
    return {
      id: data.id,
      regattaId: data.regatta_id,
      documentId: data.document_id,
      userId: data.user_id,
      documentType: data.document_type as RaceDocumentType,
      sharedWithFleet: data.shared_with_fleet || false,
      fleetId: data.fleet_id,
      createdAt: data.created_at,
      metadata: data.metadata,
    };
  }
}

export const raceDocumentService = new RaceDocumentService();
