export type LibraryFormat = 'pdf' | 'video' | 'book' | 'link' | 'audio' | 'article' | 'note' | 'image';

export interface LibraryItemRow {
  id: string;
  format: LibraryFormat;
  source: string;
  title: string;
  /** Subtitle/meta: "8 pages" / "12 min" / "3 marks" */
  meta?: string;
  /** Glowing live-dot if active in a current step. */
  active?: boolean;
  capturedFrom?: string;
  capturedAt?: string;
  topicTag?: string;
}

export interface CollectionCard {
  id: string;
  name: string;
  itemCount: number;
  formatStrip: LibraryFormat[];
}

export interface BackRefRow {
  id: string;
  role: 'origin' | 'cited' | 'in_step';
  title: string;
  subtitle: string;
}

export interface MarkedExcerpt {
  id: string;
  quote: string;
  prov: string;
}

export interface ResourceItemFull {
  id: string;
  format: LibraryFormat;
  formatLabel: string;
  meta: string;
  title: string;
  sourceLine: string;
  backRefs: BackRefRow[];
  marks: MarkedExcerpt[];
}
