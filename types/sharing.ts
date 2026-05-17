export type ShareStepMode = 'direct' | 'group' | 'link';
export type ShareStepGroupKind = 'fleet' | 'organization' | 'cohort';
export type CaptureVisibility = 'private' | 'crew' | 'fleet';

export interface SharedStepRecord {
  id: string;
  sender_user_id: string;
  step_id: string;
  recipient_user_id: string | null;
  group_kind: ShareStepGroupKind | null;
  group_id: string | null;
  shared_at: string;
  read_at: string | null;
  forked_to_step_id: string | null;
}

export interface ShareTokenRecord {
  id: string;
  token: string;
  step_id: string;
  created_by_user_id: string;
  created_at: string;
  expires_at: string;
  used_count: number;
}

export interface SharedStepCommentRecord {
  id: string;
  shared_step_id: string;
  commenter_user_id: string;
  body: string;
  created_at: string;
}

export interface SharedInboxItem {
  id: string;
  kind: 'step';
  shared_step_id: string;
  step_id: string;
  sender_user_id: string;
  sender_name: string;
  sender_initials: string;
  step_title: string;
  step_body: string;
  shared_at: string;
  read_at: string | null;
  forked_to_step_id: string | null;
}
