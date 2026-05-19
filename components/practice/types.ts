export type InboxItemKind = 'suggestion' | 'plan_push' | 'on_deck';
export type InboxFilter = 'all' | 'people' | 'plans' | 'deck';

export interface InboxItem {
  id: string;
  kind: InboxItemKind;
  /** "Suggested" / "New plan step" / "On deck" chip label. */
  chipLabel: string;
  /** Avatar initials (only for suggestion kind). */
  fromInitials?: string;
  fromTint?: string;
  /** "Sam Cooke · mentor" / "Kevin Ho · HKDW prep" / "Saved by you · from Phyl's Step 4". */
  fromContext: string;
  when: string;
  title: string;
  blurb?: string;
  fromLine?: string;
}
