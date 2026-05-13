/**
 * AI Services Type Definitions
 * Shared types for Claude Skills integration
 */

// ============================================================================
// Database Types (matching schema)
// ============================================================================

export interface AIActivityLog {
  id: string;
  club_id: string;
  user_id: string | null;
  skill: string;
  action: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  request_payload: Record<string, any> | null;
  response_payload: Record<string, any> | null;
  error_message: string | null;
  model: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AIGeneratedDocument {
  id: string;
  club_id: string;
  event_id: string | null;
  race_id: string | null;
  activity_log_id: string | null;
  document_type: 'nor' | 'si' | 'amendment' | 'summary' | 'communication' | 'analysis' | 'report' | 'other';
  title: string;
  status: 'draft' | 'reviewed' | 'published' | 'archived' | 'rejected';
  draft_text: string;
  final_text: string | null;
  metadata: Record<string, any> | null;
  created_by: string;
  reviewed_by: string | null;
  published_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface AINotification {
  id: string;
  club_id: string;
  race_id: string | null;
  event_id: string | null;
  activity_log_id: string | null;
  notification_type: 'race_update' | 'event_reminder' | 'weather_alert' | 'schedule_change' | 'general';
  audience: 'all' | 'participants' | 'skippers' | 'race_committee' | 'admins' | 'custom';
  audience_filter: Record<string, any> | null;
  subject: string;
  draft_body: string;
  final_body: string | null;
  draft_channels: string[];
  status: 'draft' | 'approved' | 'sent' | 'failed' | 'cancelled';
  created_by: string;
  approved_by: string | null;
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
  updated_at: string;
}

export interface AIConversation {
  id: string;
  club_id: string;
  user_id: string;
  title: string | null;
  status: 'active' | 'resolved' | 'escalated' | 'archived';
  messages: ConversationMessage[];
  context_snapshot: Record<string, any> | null;
  escalated_to: string | null;
  escalation_notes: string | null;
  created_at: string;
  last_message_at: string;
  resolved_at: string | null;
  updated_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AIUsageMonthly {
  id: string;
  club_id: string;
  month: string; // YYYY-MM-DD
  total_requests: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_duration_ms: number;
  requests_by_skill: Record<string, number>;
  tokens_by_skill: Record<string, { in: number; out: number }>;
  estimated_cost_usd: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ClaudeAPIRequest {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: {
    role: 'user' | 'assistant';
    content: string | any[];
  }[];
  system?: string;
  metadata?: Record<string, any>;
}

export interface ClaudeAPIResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: {
    type: 'text' | 'thinking';
    text: string;
  }[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Context Types (for ContextResolvers)
// ============================================================================

export interface EventContext {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
  venue_id: string | null;
  venue_name: string | null;
  location_name: string | null;
  max_participants: number | null;
  registration_fee: number | null;
  currency: string;
  boat_classes: string[] | null;
  requirements: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
}

export interface ClubContext {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  website_url: string | null;
  contact_email: string | null;
  logo_url: string | null;
  brand_colors: Record<string, string> | null;
  communication_style: string | null; // 'formal' | 'casual' | 'professional'
  timezone: string | null;
}

export interface RaceContext {
  id: string;
  race_name: string;
  race_series: string | null;
  boat_class: string | null;
  start_time: string;
  venue_id: string | null;
  racing_area_name: string | null;
  marks: {
    id: string;
    mark_name: string | null;
    mark_type: string | null;
    latitude: number;
    longitude: number;
    rounding: string | null;
  }[];
  weather_forecast: WeatherForecast | null;
  race_status: string | null;
}

export interface WeatherForecast {
  wind_speed: number;
  wind_direction: number;
  wind_gust: number | null;
  temperature: number;
  pressure: number | null;
  wave_height: number | null;
  wave_period: number | null;
  tide_state: string | null;
  conditions_summary: string;
}

export interface UserContext {
  id: string;
  full_name: string | null;
  email: string;
  club_role: string | null; // 'admin' | 'member' | etc.
  membership_status: string | null;
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface PromptTemplate {
  system: string;
  user: string;
  variables: string[]; // List of required variables
}

export interface PromptContext {
  event?: EventContext;
  club?: ClubContext;
  race?: RaceContext;
  user?: UserContext;
  weather?: WeatherForecast;
  additionalContext?: Record<string, any>;
}

// ============================================================================
// Skill-Specific Request Types
// ============================================================================

export interface EventDocumentDraftRequest {
  event_id: string;
  document_type: 'nor' | 'si' | 'amendment';
  club_id: string;
  user_id: string;
  preferences?: {
    tone?: 'formal' | 'professional' | 'casual';
    include_sections?: string[];
    branding?: {
      logo_url?: string;
      colors?: Record<string, string>;
    };
  };
}

export interface RaceDayCommsRequest {
  race_id: string;
  club_id: string;
  user_id: string;
  message_type: 'race_update' | 'weather_alert' | 'schedule_change' | 'course_update';
  audience: 'all' | 'participants' | 'skippers' | 'race_committee';
  channels: ('push' | 'email' | 'sms')[];
  custom_context?: string; // Additional notes from race officer
}

export interface SupportChatRequest {
  club_id: string;
  user_id: string;
  conversation_id?: string; // If continuing existing conversation
  message: string;
}

export interface DailySummaryRequest {
  club_id: string;
  date: string; // YYYY-MM-DD
  recipient_emails: string[];
}

// ============================================================================
// Skill-Specific Response Types
// ============================================================================

export interface EventDocumentDraftResponse {
  document_id: string;
  title: string;
  document_type: 'nor' | 'si' | 'amendment';
  sections: {
    heading: string;
    content: string;
    order: number;
  }[];
  draft_text: string; // Full formatted text
  metadata: {
    word_count: number;
    includes_required_sections: boolean;
    suggested_edits: string[];
  };
  confidence_score: number;
}

export interface RaceDayCommsResponse {
  notification_id: string;
  subject: string;
  body: string;
  channels: string[];
  audience: string;
  metadata: {
    weather_included: boolean;
    urgency_level: 'low' | 'medium' | 'high';
    suggested_send_time?: string;
  };
}

export interface SupportChatResponse {
  conversation_id: string;
  message: string;
  suggested_actions: {
    label: string;
    action: 'navigate' | 'open_document' | 'contact_staff';
    parameters: Record<string, any>;
  }[];
  confidence_score: number;
  escalation_needed: boolean;
}

export interface DailySummaryResponse {
  summary_id: string;
  date: string;
  sections: {
    new_registrations: {
      count: number;
      details: string[];
    };
    payments: {
      total_received: number;
      currency: string;
      pending_count: number;
    };
    documents_uploaded: {
      count: number;
      types: string[];
    };
    incidents_or_flags: {
      count: number;
      details: string[];
    };
    upcoming_events: {
      title: string;
      date: string;
      participants_count: number;
    }[];
    action_items: string[];
  };
  summary_text: string; // Formatted summary
}

// ============================================================================
// Utility Types
// ============================================================================

export interface PIIRedactionConfig {
  redact_emails: boolean;
  redact_phone_numbers: boolean;
  redact_payment_info: boolean;
  redact_addresses: boolean;
}

export interface RateLimitConfig {
  max_requests_per_minute: number;
  max_requests_per_hour: number;
  max_tokens_per_day: number;
}

export interface RetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class RateLimitError extends AIServiceError {
  constructor(message: string, public retryAfter: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends AIServiceError {
  constructor(message: string, public validationErrors: string[]) {
    super(message, 'VALIDATION_ERROR', { validationErrors });
    this.name = 'ValidationError';
  }
}
