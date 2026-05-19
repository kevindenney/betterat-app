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
  /** Raw fields carried for action handlers (accept / save / dismiss). */
  raw: {
    /** Interest the new timeline step or deck row will live under. */
    interestId: string | null;
    /** Source step id (the step being suggested or saved). */
    sourceStepId: string;
    /** User who suggested the step (null for on_deck rows). */
    sourceUserId: string | null;
    /** Source step's description, used as the body when forking. */
    sourceDescription: string | null;
  };
}
