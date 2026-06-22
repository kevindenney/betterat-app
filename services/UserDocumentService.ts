import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import { isUuid } from '@/utils/uuid';
import type {
  UserClubDocument,
  UserClubDocumentRow,
  SSIUploadOptions,
  SSIUploadResult,
  SSIExtraction,
  ExtractionStatus,
} from '@/types/ssi';

const logger = createLogger('UserDocumentService');

/**
 * Service for managing user-uploaded club documents (SSI, NOR, etc.)
 */
class UserDocumentService {
  /**
   * Upload an SSI document
   */
  async uploadSSI(
    file: File | Blob,
    filename: string,
    options: SSIUploadOptions = {}
  ): Promise<SSIUploadResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${timestamp}_${sanitizedFilename}`;

      logger.info('Uploading SSI document:', { filename, filePath });

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        logger.error('Failed to upload file:', uploadError);
        return { success: false, error: `Upload failed: ${uploadError.message}` };
      }

      // Create document record
      const { data: document, error: insertError } = await supabase
        .from('user_club_documents')
        .insert({
          user_id: user.id,
          club_id: options.clubId || null,
          race_id: options.raceId || null,
          document_type: 'ssi',
          title: options.title || filename.replace(/\.[^/.]+$/, ''),
          file_path: filePath,
          file_size: file.size,
          is_shared: options.isShared ?? false,
          extraction_status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Failed to create document record:', insertError);
        // Try to clean up the uploaded file
        await supabase.storage.from('user-documents').remove([filePath]);
        return { success: false, error: `Database error: ${insertError.message}` };
      }

      logger.info('SSI document uploaded successfully:', { documentId: document.id });
      return { success: true, documentId: document.id };
    } catch (error) {
      logger.error('Error uploading SSI:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Trigger AI extraction for a document
   */
  async triggerExtraction(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Triggering extraction for document:', documentId);

      const { data, error } = await supabase.functions.invoke('extract-ssi-details', {
        body: { documentId },
      });

      if (error) {
        logger.error('Extraction function error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Extraction failed' };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error triggering extraction:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Upload SSI and immediately trigger extraction
   */
  async uploadAndExtract(
    file: File | Blob,
    filename: string,
    options: SSIUploadOptions = {}
  ): Promise<SSIUploadResult & { extractionTriggered?: boolean }> {
    const uploadResult = await this.uploadSSI(file, filename, options);

    if (!uploadResult.success || !uploadResult.documentId) {
      return uploadResult;
    }

    // Trigger extraction asynchronously (don't wait for it)
    this.triggerExtraction(uploadResult.documentId).catch((err) => {
      logger.error('Background extraction failed:', err);
    });

    return {
      ...uploadResult,
      extractionTriggered: true,
    };
  }

  /**
   * Get extraction status for a document
   */
  async getExtractionStatus(
    documentId: string
  ): Promise<{ status: ExtractionStatus; data?: SSIExtraction; error?: string } | null> {
    try {
      const { data, error } = await supabase
        .from('user_club_documents')
        .select('extraction_status, extracted_data, extraction_error')
        .eq('id', documentId)
        .single();

      if (error) {
        logger.error('Error fetching extraction status:', error);
        return null;
      }

      return {
        status: data.extraction_status as ExtractionStatus,
        data: data.extracted_data || undefined,
        error: data.extraction_error || undefined,
      };
    } catch (error) {
      logger.error('Error getting extraction status:', error);
      return null;
    }
  }

  /**
   * Get all documents for the current user
   */
  async getUserDocuments(): Promise<UserClubDocument[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_club_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user documents:', error);
        return [];
      }

      return (data || []).map(this.rowToDocument);
    } catch (error) {
      logger.error('Error getting user documents:', error);
      return [];
    }
  }

  /**
   * Get user's documents for a specific race
   */
  async getDocumentsForRace(raceId: string): Promise<UserClubDocument[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_club_documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('race_id', raceId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching race documents:', error);
        return [];
      }

      return (data || []).map(this.rowToDocument);
    } catch (error) {
      logger.error('Error getting race documents:', error);
      return [];
    }
  }

  /**
   * Get shared documents for a club
   */
  async getSharedClubDocuments(clubId: string): Promise<UserClubDocument[]> {
    try {
      const { data, error } = await supabase
        .from('user_club_documents')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_shared', true)
        .eq('extraction_status', 'completed')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching shared club documents:', error);
        return [];
      }

      return (data || []).map(this.rowToDocument);
    } catch (error) {
      logger.error('Error getting shared club documents:', error);
      return [];
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocument(documentId: string): Promise<UserClubDocument | null> {
    try {
      const { data, error } = await supabase
        .from('user_club_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        logger.error('Error fetching document:', error);
        return null;
      }

      return this.rowToDocument(data);
    } catch (error) {
      logger.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * Update document sharing setting
   */
  async updateSharing(documentId: string, isShared: boolean): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_club_documents')
        .update({ is_shared: isShared })
        .eq('id', documentId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Error updating sharing:', error);
        return false;
      }
      if (!data) {
        logger.warn('Document sharing update matched no rows:', { documentId });
        return false;
      }

      logger.info('Document sharing updated:', { documentId, isShared });
      return true;
    } catch (error) {
      logger.error('Error updating sharing:', error);
      return false;
    }
  }

  /**
   * Update document title
   */
  async updateTitle(documentId: string, title: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_club_documents')
        .update({ title })
        .eq('id', documentId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Error updating title:', error);
        return false;
      }
      if (!data) {
        logger.warn('Document title update matched no rows:', { documentId });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error updating title:', error);
      return false;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      // First get the document to get the file path
      const { data: document, error: fetchError } = await supabase
        .from('user_club_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError) {
        logger.error('Error fetching document for deletion:', fetchError);
        return false;
      }

      // Delete the file from storage
      if (document?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('user-documents')
          .remove([document.file_path]);

        if (storageError) {
          logger.warn('Failed to delete file from storage:', storageError);
          // Continue with record deletion even if file deletion fails
        }
      }

      // Delete the database record
      const { data: deletedDocument, error: deleteError } = await supabase
        .from('user_club_documents')
        .delete()
        .eq('id', documentId)
        .select('id')
        .maybeSingle();

      if (deleteError) {
        logger.error('Error deleting document record:', deleteError);
        return false;
      }
      if (!deletedDocument) {
        logger.warn('Document delete matched no rows:', { documentId });
        return false;
      }

      logger.info('Document deleted successfully:', documentId);
      return true;
    } catch (error) {
      logger.error('Error deleting document:', error);
      return false;
    }
  }

  /**
   * Get the download URL for a document
   */
  async getDocumentUrl(documentId: string): Promise<string | null> {
    try {
      const document = await this.getDocument(documentId);
      if (!document?.filePath) return null;

      const { data, error } = await supabase.storage
        .from('user-documents')
        .createSignedUrl(document.filePath, 3600); // 1 hour expiry

      if (error) {
        logger.error('Error creating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      logger.error('Error getting document URL:', error);
      return null;
    }
  }

  /**
   * Get SSI extraction data for a race
   * Priority: user's own document for race → shared club SSI → null
   */
  async getSSIForRace(
    raceId: string,
    clubId?: string
  ): Promise<{ document: UserClubDocument; extraction: SSIExtraction } | null> {
    // Skip query for invalid UUIDs to prevent 400 errors
    if (!raceId || !isUuid(raceId)) {
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // First try: user's own SSI for this specific race
      if (user) {
        const { data: userDoc } = await supabase
          .from('user_club_documents')
          .select('*')
          .eq('user_id', user.id)
          .eq('race_id', raceId)
          .eq('document_type', 'ssi')
          .eq('extraction_status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (userDoc?.extracted_data) {
          return {
            document: this.rowToDocument(userDoc),
            extraction: userDoc.extracted_data as SSIExtraction,
          };
        }
      }

      // Second try: shared club SSI
      if (clubId) {
        const { data: sharedDoc } = await supabase
          .from('user_club_documents')
          .select('*')
          .eq('club_id', clubId)
          .eq('is_shared', true)
          .eq('document_type', 'ssi')
          .eq('extraction_status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sharedDoc?.extracted_data) {
          return {
            document: this.rowToDocument(sharedDoc),
            extraction: sharedDoc.extracted_data as SSIExtraction,
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting SSI for race:', error);
      return null;
    }
  }

  /**
   * Convert database row to UserClubDocument
   */
  private rowToDocument(row: UserClubDocumentRow): UserClubDocument {
    return {
      id: row.id,
      userId: row.user_id,
      clubId: row.club_id || undefined,
      raceId: row.race_id || undefined,
      documentType: row.document_type as UserClubDocument['documentType'],
      title: row.title,
      filePath: row.file_path,
      fileSize: row.file_size || undefined,
      isShared: row.is_shared,
      extractionStatus: row.extraction_status as ExtractionStatus,
      extractedData: row.extracted_data || undefined,
      extractionError: row.extraction_error || undefined,
      extractedAt: row.extracted_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const userDocumentService = new UserDocumentService();
