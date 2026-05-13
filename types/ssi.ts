/**
 * SSI (Sailing Instructions) Types
 *
 * Type definitions for user-uploaded SSI documents and AI extraction.
 */

// =============================================================================
// SSI EXTRACTION TYPES
// =============================================================================

/**
 * VHF channel information extracted from SSI
 */
export interface SSIVHFChannel {
  channel: string;
  name?: string;
  purpose?: string;
}

/**
 * VHF channels grouped by purpose
 */
export interface SSIVHFChannels {
  /** Race committee primary channel */
  raceCommittee?: SSIVHFChannel;
  /** Safety/distress channel */
  safety?: SSIVHFChannel;
  /** Start line specific channels */
  startLines?: {
    channel: string;
    lineName: string;
  }[];
  /** Other channels (e.g., finish, protest) */
  other?: {
    channel: string;
    purpose: string;
  }[];
}

/**
 * Course mark information extracted from SSI
 */
export interface SSIMark {
  name: string;
  type: 'permanent' | 'temporary' | 'government' | 'inflatable' | 'virtual';
  position?: {
    lat: number;
    lng: number;
  };
  description?: string;
  color?: string;
  rounding?: 'port' | 'starboard' | 'either';
}

/**
 * Emergency contact extracted from SSI
 */
export interface SSIEmergencyContact {
  name: string;
  phone?: string;
  vhfChannel?: string;
  role: string;  // e.g., "Race Committee", "Marine Rescue", "Coast Guard"
}

/**
 * Racing area information
 */
export interface SSIRacingArea {
  name?: string;
  description?: string;
  boundaries?: { lat: number; lng: number }[];
  prohibitedZones?: {
    name: string;
    reason: string;
    boundaries?: { lat: number; lng: number }[];
  }[];
}

/**
 * Course configuration options
 */
export interface SSICourseConfiguration {
  name: string;
  type: 'windward-leeward' | 'triangle' | 'trapezoid' | 'distance' | 'other';
  description?: string;
  marks?: string[];  // Mark names in order
  approximateDistanceNm?: number;
}

/**
 * Racing procedures extracted from SSI
 */
export interface SSIProcedures {
  /** Start sequence description (e.g., "5-4-1-0") */
  startSequence?: string;
  /** Penalty system in use */
  penaltySystem?: string;
  /** Protest deadline */
  protestDeadline?: string;
  /** Sign-on requirements */
  signOnRequirements?: string;
  /** Time limit details */
  timeLimit?: string;
}

/**
 * Full SSI extraction result
 */
export interface SSIExtraction {
  /** VHF channels grouped by purpose */
  vhfChannels?: SSIVHFChannels;

  /** Course marks with positions */
  marks?: SSIMark[];

  /** Emergency contacts */
  emergencyContacts?: SSIEmergencyContact[];

  /** Racing area information */
  racingArea?: SSIRacingArea;

  /** Available course configurations */
  courseConfigurations?: SSICourseConfiguration[];

  /** Racing procedures */
  procedures?: SSIProcedures;

  /** AI confidence score (0-1) */
  confidence: number;

  /** Sections that were successfully extracted */
  extractedSections: string[];

  /** Extraction timestamp */
  extractedAt?: string;

  /** Model version used for extraction */
  modelVersion?: string;
}

// =============================================================================
// USER DOCUMENT TYPES
// =============================================================================

/**
 * Document type categories
 */
export type UserDocumentType = 'ssi' | 'nor' | 'amendment' | 'other';

/**
 * Extraction status
 */
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * User-uploaded club document record
 */
export interface UserClubDocument {
  id: string;
  userId: string;
  clubId?: string;
  raceId?: string;

  /** Document classification */
  documentType: UserDocumentType;
  title: string;
  filePath: string;
  fileSize?: number;

  /** Sharing settings */
  isShared: boolean;

  /** Extraction status and results */
  extractionStatus: ExtractionStatus;
  extractedData?: SSIExtraction;
  extractionError?: string;
  extractedAt?: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * Database row format (snake_case)
 */
export interface UserClubDocumentRow {
  id: string;
  user_id: string;
  club_id: string | null;
  race_id: string | null;
  document_type: string;
  title: string;
  file_path: string;
  file_size: number | null;
  is_shared: boolean;
  extraction_status: string;
  extracted_data: SSIExtraction | null;
  extraction_error: string | null;
  extracted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Options for uploading an SSI document
 */
export interface SSIUploadOptions {
  clubId?: string;
  raceId?: string;
  title?: string;
  isShared?: boolean;
}

/**
 * Upload result
 */
export interface SSIUploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to UserClubDocument
 */
export function rowToUserClubDocument(row: UserClubDocumentRow): UserClubDocument {
  return {
    id: row.id,
    userId: row.user_id,
    clubId: row.club_id || undefined,
    raceId: row.race_id || undefined,
    documentType: row.document_type as UserDocumentType,
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

/**
 * Get a formatted display string for VHF channel
 */
export function formatVHFChannel(channel: SSIVHFChannel): string {
  if (channel.name) {
    return `Ch ${channel.channel} - ${channel.name}`;
  }
  if (channel.purpose) {
    return `Ch ${channel.channel} (${channel.purpose})`;
  }
  return `Ch ${channel.channel}`;
}

/**
 * Get extraction status label
 */
export function getExtractionStatusLabel(status: ExtractionStatus): string {
  const labels: Record<ExtractionStatus, string> = {
    pending: 'Pending',
    processing: 'Processing...',
    completed: 'Complete',
    failed: 'Failed',
  };
  return labels[status];
}

/**
 * Get extraction status color (for badges/indicators)
 */
export function getExtractionStatusColor(status: ExtractionStatus): string {
  const colors: Record<ExtractionStatus, string> = {
    pending: 'gray',
    processing: 'blue',
    completed: 'green',
    failed: 'red',
  };
  return colors[status];
}
