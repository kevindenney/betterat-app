/**
 * Document Types
 *
 * Type definitions for club-level and race-level documents.
 * Supports document inheritance where races inherit SSI from their club.
 */

import type { RaceDocumentType } from '@/services/RaceDocumentService';

// =============================================================================
// CLUB DOCUMENT TYPES
// =============================================================================

/**
 * Club document categories
 * - ssi: Standard Sailing Instructions (main SSI documents)
 * - appendix: SSI Appendices (VHF policy, protest procedures, etc.)
 * - attachment: SSI Attachments (course diagrams, mark positions)
 * - policy: Club policies (safety, insurance, etc.)
 * - reference: Reference documents (tide tables, local notices)
 * - other: Other club documents
 */
export type ClubDocumentCategory =
  | 'ssi'
  | 'appendix'
  | 'attachment'
  | 'policy'
  | 'reference'
  | 'other';

/**
 * SSI subtypes for granular classification
 * Allows organizing SSI documents by their specific part/section
 */
export type SSISubtype =
  | 'introduction'
  | 'part_1'
  | 'part_2'
  | 'part_3'
  | 'attachment_a'
  | 'attachment_b'
  | 'attachment_c'
  | 'appendix_a'
  | 'appendix_b'
  | 'appendix_c'
  | 'emergency_contacts'
  | 'other';

/**
 * AI extraction results from club documents (SSI)
 * Contains structured data extracted from sailing instructions
 */
export interface ClubDocumentAIExtraction {
  /** VHF channels mentioned in the document */
  vhfChannels?: {
    channel: string;
    purpose?: string;  // e.g., "Race Committee", "Safety"
  }[];

  /** Course marks and their positions */
  marks?: {
    name: string;
    type?: string;  // e.g., "inflatable", "permanent", "virtual"
    position?: {
      lat: number;
      lng: number;
    };
    description?: string;
  }[];

  /** Emergency contacts */
  emergencyContacts?: {
    name: string;
    phone?: string;
    vhfChannel?: string;
    role?: string;  // e.g., "Marine Rescue", "Coast Guard"
  }[];

  /** Course information */
  courseInfo?: {
    windwardLeewardAvailable?: boolean;
    trapezoidAvailable?: boolean;
    triangleAvailable?: boolean;
    defaultCourseType?: string;
    courseDiagramUrl?: string;
  };

  /** Racing area boundaries */
  racingArea?: {
    name?: string;
    boundaries?: { lat: number; lng: number }[];
  };

  /** Extraction metadata */
  extractedAt?: string;
  confidence?: number;
  modelVersion?: string;
}

/**
 * Club document record from the database
 */
export interface ClubDocument {
  id: string;
  clubId: string;

  /** Reference to uploaded document (optional if using external URL) */
  documentId?: string;
  /** External URL reference (optional if using uploaded document) */
  externalUrl?: string;

  /** Classification */
  documentCategory: ClubDocumentCategory;
  documentSubtype?: SSISubtype;

  /** Display information */
  title: string;
  description?: string;

  /** Versioning */
  version?: string;
  effectiveDate?: string;

  /** Lifecycle */
  isActive: boolean;
  displayOrder: number;

  /** AI extraction results */
  aiExtraction?: ClubDocumentAIExtraction;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Club document with additional display fields
 * Includes resolved document details when available
 */
export interface ClubDocumentWithDetails extends ClubDocument {
  /** Resolved document details (when documentId is set) */
  document?: {
    id: string;
    filename: string;
    fileType?: string;
    fileSize?: number;
    url?: string;
    publicUrl?: string;
  };
}

// =============================================================================
// RACE DOCUMENT DISPLAY TYPES
// =============================================================================

/**
 * Document source indicator
 * Identifies whether a document comes from the race or is inherited from the club
 */
export type DocumentSource = 'race' | 'club';

/**
 * Combined document for display
 * Unified type that includes source information for race card display
 */
export interface RaceDisplayDocument {
  id: string;
  /** Source of the document (race-specific or inherited from club) */
  source: DocumentSource;

  /** Document type (for race documents) */
  documentType?: RaceDocumentType;
  /** Document category (for club documents) */
  clubDocumentCategory?: ClubDocumentCategory;
  /** Document subtype (for club SSI documents) */
  clubDocumentSubtype?: SSISubtype;

  /** Display information */
  title: string;
  description?: string;
  url?: string;
  externalUrl?: string;

  /** File information (when available) */
  filename?: string;
  fileType?: string;
  fileSize?: number;

  /** Metadata */
  uploadedAt?: string;
  version?: string;
  displayOrder?: number;

  /** AI extraction status */
  hasAIExtraction?: boolean;
  aiExtraction?: ClubDocumentAIExtraction;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get display label for club document category
 */
export function getClubDocumentCategoryLabel(category: ClubDocumentCategory): string {
  const labels: Record<ClubDocumentCategory, string> = {
    ssi: 'Sailing Instructions',
    appendix: 'Appendix',
    attachment: 'Attachment',
    policy: 'Club Policy',
    reference: 'Reference',
    other: 'Document',
  };
  return labels[category] || 'Document';
}

/**
 * Get display label for SSI subtype
 */
export function getSSISubtypeLabel(subtype: SSISubtype): string {
  const labels: Record<SSISubtype, string> = {
    introduction: 'Introduction',
    part_1: 'Part 1',
    part_2: 'Part 2',
    part_3: 'Part 3',
    attachment_a: 'Attachment A',
    attachment_b: 'Attachment B',
    attachment_c: 'Attachment C',
    appendix_a: 'Appendix A',
    appendix_b: 'Appendix B',
    appendix_c: 'Appendix C',
    emergency_contacts: 'Emergency Contacts',
    other: 'Other',
  };
  return labels[subtype] || subtype;
}

/**
 * Get icon name for document category (MaterialCommunityIcons)
 */
export function getDocumentCategoryIcon(
  category: ClubDocumentCategory | RaceDocumentType
): string {
  const icons: Record<string, string> = {
    // Club document categories
    ssi: 'file-document-outline',
    appendix: 'file-document-multiple-outline',
    attachment: 'paperclip',
    policy: 'shield-outline',
    reference: 'book-outline',
    // Race document types
    sailing_instructions: 'file-document-outline',
    nor: 'clipboard-text-outline',
    course_diagram: 'map-outline',
    amendment: 'file-edit-outline',
    notam: 'alert-circle-outline',
    other: 'file-outline',
  };
  return icons[category] || 'file-outline';
}

/**
 * Sort club documents by category and display order
 */
export function sortClubDocuments(documents: ClubDocument[]): ClubDocument[] {
  const categoryOrder: Record<ClubDocumentCategory, number> = {
    ssi: 0,
    attachment: 1,
    appendix: 2,
    policy: 3,
    reference: 4,
    other: 5,
  };

  return [...documents].sort((a, b) => {
    // First sort by category
    const catDiff = categoryOrder[a.documentCategory] - categoryOrder[b.documentCategory];
    if (catDiff !== 0) return catDiff;

    // Then by display order
    return a.displayOrder - b.displayOrder;
  });
}

/**
 * Group club documents by category
 */
export function groupClubDocumentsByCategory(
  documents: ClubDocument[]
): Map<ClubDocumentCategory, ClubDocument[]> {
  const grouped = new Map<ClubDocumentCategory, ClubDocument[]>();

  for (const doc of documents) {
    const existing = grouped.get(doc.documentCategory) || [];
    existing.push(doc);
    grouped.set(doc.documentCategory, existing);
  }

  // Sort documents within each group
  for (const [category, docs] of grouped) {
    grouped.set(category, docs.sort((a, b) => a.displayOrder - b.displayOrder));
  }

  return grouped;
}
