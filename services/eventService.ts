// @ts-nocheck

/**
 * Event Management Service
 * Handles CRUD operations for club events, registrations, and documents
 */

import { supabase } from './supabase';

// =====================================================
// Types
// =====================================================

export type EventType = 'regatta' | 'race_series' | 'training' | 'social' | 'meeting' | 'maintenance';
export type EventStatus = 'draft' | 'published' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
export type EventVisibility = 'public' | 'club' | 'private';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'waitlist' | 'withdrawn' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'waived';
export type DocumentType = 'nor' | 'si' | 'results' | 'amendment' | 'notice' | 'course_map' | 'other';

export interface ClubEvent {
  id: string;
  club_id: string;
  title: string;
  description?: string;
  event_type: EventType;
  start_date: string;
  end_date: string;
  registration_opens?: string;
  registration_closes?: string;
  venue_id?: string;
  location_name?: string;
  location_coordinates?: {
    type: 'Point';
    coordinates: [number, number];
  };
  max_participants?: number;
  min_participants?: number;
  allow_waitlist: boolean;
  registration_fee?: number;
  currency: string;
  payment_required?: boolean;
  refund_policy?: 'full' | 'partial' | 'none';
  status: EventStatus;
  visibility: EventVisibility;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  requirements?: string[];
  boat_classes?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  registration_type?: string;
  participant_name: string;
  participant_email: string;
  participant_phone?: string;
  boat_id?: string;
  boat_class?: string;
  boat_name?: string;
  sail_number?: string;
  crew_count: number;
  crew_names?: string[];
  payment_status: PaymentStatus;
  amount_paid?: number;
  payment_date?: string;
  payment_method?: string;
  stripe_payment_intent_id?: string;
  platform_fee?: number;
  club_payout?: number;
  dietary_requirements?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  special_requirements?: string;
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  registered_at: string;
  updated_at: string;
}

export interface EventDocument {
  id: string;
  event_id: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  version: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  is_public: boolean;
  requires_registration: boolean;
  published_at?: string;
  published_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEventInput {
  club_id: string;
  title: string;
  description?: string;
  event_type: EventType;
  start_date: string;
  end_date: string;
  registration_opens?: string;
  registration_closes?: string;
  venue_id?: string;
  location_name?: string;
  max_participants?: number;
  min_participants?: number;
  registration_fee?: number;
  currency?: string;
  payment_required?: boolean;
  refund_policy?: 'full' | 'partial' | 'none';
  visibility?: EventVisibility;
  contact_email?: string;
  contact_phone?: string;
  requirements?: string[];
  boat_classes?: string[];
}

export interface CreateRegistrationInput {
  event_id: string;
  participant_name: string;
  participant_email: string;
  participant_phone?: string;
  boat_id?: string;
  boat_class?: string;
  boat_name?: string;
  sail_number?: string;
  crew_count?: number;
  crew_names?: string[];
  dietary_requirements?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  special_requirements?: string;
}

export interface EventRegistrationStats {
  total_registrations: number;
  approved_count: number;
  pending_count: number;
  waitlist_count: number;
  total_paid: number;
}

// =====================================================
// Event CRUD Operations
// =====================================================

export class EventService {
  /**
   * Get all events for a club
   */
  static async getClubEvents(clubId: string): Promise<ClubEvent[]> {
    const { data, error } = await supabase
      .from('club_events')
      .select('*')
      .eq('club_id', clubId)
      .order('start_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get public events (for discovery)
   */
  static async getPublicEvents(): Promise<ClubEvent[]> {
    const { data, error } = await supabase
      .from('club_events')
      .select('*')
      .eq('visibility', 'public')
      .in('status', ['published', 'registration_open', 'registration_closed'])
      .order('start_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a single event by ID
   */
  static async getEvent(eventId: string): Promise<ClubEvent | null> {
    const { data, error } = await supabase
      .from('club_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new event
   */
  static async createEvent(input: CreateEventInput): Promise<ClubEvent> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('club_events')
      .insert({
        ...input,
        created_by: userData?.user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an event
   */
  static async updateEvent(eventId: string, updates: Partial<ClubEvent>): Promise<ClubEvent> {
    const { data, error } = await supabase
      .from('club_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete an event
   */
  static async deleteEvent(eventId: string): Promise<void> {
    const { data, error } = await supabase
      .from('club_events')
      .delete()
      .eq('id', eventId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Event not found.');
  }

  /**
   * Publish an event (change status from draft to published)
   */
  static async publishEvent(eventId: string): Promise<ClubEvent> {
    return this.updateEvent(eventId, { status: 'published' });
  }

  /**
   * Cancel an event
   */
  static async cancelEvent(eventId: string): Promise<ClubEvent> {
    return this.updateEvent(eventId, { status: 'cancelled' });
  }

  // =====================================================
  // Registration Operations
  // =====================================================

  /**
   * Get registrations for an event
   */
  static async getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('registered_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's registrations
   */
  static async getUserRegistrations(userId: string): Promise<EventRegistration[]> {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*, club_events(*)')
      .eq('user_id', userId)
      .order('registered_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create a registration
   */
  static async createRegistration(input: CreateRegistrationInput): Promise<EventRegistration> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('event_registrations')
      .insert({
        ...input,
        user_id: userData?.user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update registration status (for admins)
   */
  static async updateRegistrationStatus(
    registrationId: string,
    status: RegistrationStatus,
    rejectionReason?: string
  ): Promise<EventRegistration> {
    const { data: userData } = await supabase.auth.getUser();

    const updates: any = { status };

    if (status === 'approved') {
      updates.approved_by = userData?.user?.id;
      updates.approved_at = new Date().toISOString();
    }

    if (status === 'rejected' && rejectionReason) {
      updates.rejection_reason = rejectionReason;
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .update(updates)
      .eq('id', registrationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Withdraw registration
   */
  static async withdrawRegistration(registrationId: string): Promise<EventRegistration> {
    return this.updateRegistrationStatus(registrationId, 'withdrawn');
  }

  /**
   * Get registration statistics for an event
   */
  static async getRegistrationStats(eventId: string): Promise<EventRegistrationStats> {
    const { data, error } = await supabase
      .rpc('get_event_registration_stats', { event_uuid: eventId })
      .single();

    if (error) throw error;
    return data;
  }

  // =====================================================
  // Document Operations
  // =====================================================

  /**
   * Get documents for an event
   */
  static async getEventDocuments(eventId: string): Promise<EventDocument[]> {
    const { data, error } = await supabase
      .from('event_documents')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Upload event document
   */
  static async uploadDocument(
    eventId: string,
    file: File,
    documentType: DocumentType,
    title: string,
    description?: string,
    isPublic: boolean = false
  ): Promise<EventDocument> {
    const { data: userData } = await supabase.auth.getUser();

    // Upload file to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${eventId}/${documentType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('event-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('event-documents')
      .getPublicUrl(fileName);

    // Create document record
    const { data, error } = await supabase
      .from('event_documents')
      .insert({
        event_id: eventId,
        document_type: documentType,
        title,
        description,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        is_public: isPublic,
        created_by: userData?.user?.id,
        published_at: isPublic ? new Date().toISOString() : null,
        published_by: isPublic ? userData?.user?.id : null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Publish a document (make it visible)
   */
  static async publishDocument(documentId: string): Promise<EventDocument> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('event_documents')
      .update({
        is_public: true,
        published_at: new Date().toISOString(),
        published_by: userData?.user?.id,
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a document
   */
  static async deleteDocument(documentId: string): Promise<void> {
    // Get document to get file path
    const { data: doc } = await supabase
      .from('event_documents')
      .select('file_url')
      .eq('id', documentId)
      .single();

    if (doc?.file_url) {
      // Extract file path from URL
      const filePath = doc.file_url.split('/event-documents/')[1];

      // Delete from storage
      await supabase.storage
        .from('event-documents')
        .remove([filePath]);
    }

    // Delete record
    const { data, error } = await supabase
      .from('event_documents')
      .delete()
      .eq('id', documentId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Event document not found.');
  }

  // =====================================================
  // Helper Functions
  // =====================================================

  /**
   * Check if user can register for event
   */
  static async canRegister(eventId: string, userId: string): Promise<{
    canRegister: boolean;
    reason?: string;
  }> {
    // Get event
    const event = await this.getEvent(eventId);
    if (!event) {
      return { canRegister: false, reason: 'Event not found' };
    }

    // Check if registration is open
    if (event.status !== 'registration_open' && event.status !== 'published') {
      return { canRegister: false, reason: 'Registration is not open' };
    }

    // Check if already registered
    const { data: existingReg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (existingReg) {
      return { canRegister: false, reason: 'Already registered' };
    }

    // Check if event is full
    if (event.max_participants) {
      const stats = await this.getRegistrationStats(eventId);
      if (stats.approved_count >= event.max_participants && !event.allow_waitlist) {
        return { canRegister: false, reason: 'Event is full' };
      }
    }

    return { canRegister: true };
  }

  /**
   * Get upcoming events
   */
  static async getUpcomingEvents(limit: number = 10): Promise<ClubEvent[]> {
    const { data, error } = await supabase
      .from('club_events')
      .select('*')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Search events
   */
  static async searchEvents(query: string): Promise<ClubEvent[]> {
    const { data, error } = await supabase
      .from('club_events')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('start_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // =====================================================
  // Payment Operations
  // =====================================================

  /**
   * Mark registration as manually paid (for cash/check)
   */
  static async markRegistrationPaid(
    registrationId: string,
    amount: number,
    paymentMethod: string = 'cash'
  ): Promise<EventRegistration> {
    const { data, error } = await supabase
      .from('event_registrations')
      .update({
        payment_status: 'paid',
        amount_paid: amount,
        payment_date: new Date().toISOString(),
        payment_method: paymentMethod,
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get club earnings for all events
   */
  static async getClubEarnings(clubId: string) {
    const { data, error } = await supabase
      .from('club_event_earnings')
      .select('*')
      .eq('club_id', clubId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get earnings for a specific event
   */
  static async getEventEarnings(eventId: string) {
    const { data, error } = await supabase
      .from('club_event_earnings')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (error) throw error;
    return data;
  }
}

export default EventService;
