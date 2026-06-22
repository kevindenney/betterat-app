// @ts-nocheck

/**
 * Race Registration Service
 * Handles race entry creation, payment processing, and crew management
 */

import { supabase } from './supabase';
import MutationQueueService from './MutationQueueService';
import { createLogger } from '@/lib/utils/logger';

const RACE_ENTRY_COLLECTION = 'race_entries';
const logger = createLogger('RaceRegistrationService');

export interface RaceEntry {
  id: string;
  regatta_id: string;
  sailor_id: string;
  boat_id: string;
  entry_class: string;
  division?: string;
  sail_number: string;
  status: 'draft' | 'pending_payment' | 'confirmed' | 'waitlist' | 'withdrawn' | 'rejected' | 'pending_sync';
  entry_number?: string;
  entry_fee_amount: number;
  entry_fee_currency: string;
  payment_status: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'waived';
  payment_intent_id?: string;
  special_requests?: string;
  dietary_requirements?: string;
  equipment_notes?: string;
  crew_member_ids: string[];
  documents_required: DocumentRequirement[];
  documents_submitted: SubmittedDocument[];
  documents_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequirement {
  type: string;
  display_name: string;
  required: boolean;
  deadline?: string;
  description?: string;
}

export interface SubmittedDocument {
  type: string;
  url: string;
  filename: string;
  submitted_at: string;
}

export interface CrewAssignment {
  id: string;
  entry_id: string;
  crew_member_id: string;
  position: string;
  is_skipper: boolean;
  confirmed: boolean;
  available_races?: number[];
  notes?: string;
}

export interface EntryFormData {
  regatta_id: string;
  boat_id: string;
  entry_class: string;
  division?: string;
  sail_number: string;
  crew_member_ids: string[];
  special_requests?: string;
  dietary_requirements?: string;
  equipment_notes?: string;
}

export class RaceRegistrationService {
  async createEntryDirect(
    userId: string,
    formData: EntryFormData
  ): Promise<RaceEntry> {
    // Get regatta details for entry fee and club info
    const { data: regatta, error: regattaError } = await supabase
      .from('club_race_calendar')
      .select(`
          entry_fee,
          currency,
          event_name,
          club_id
        `)
      .eq('id', formData.regatta_id)
      .single();

    if (regattaError) throw regattaError;

    let clubName: string | undefined;
    let clubEmail: string | undefined;
    if (regatta?.club_id) {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('id, name, email')
        .eq('id', regatta.club_id)
        .single();

      clubName = clubData?.name;
      clubEmail = clubData?.email;

      if (!clubName) {
        const { data: yachtClubData } = await supabase
          .from('yacht_clubs')
          .select('id, name')
          .eq('id', regatta.club_id)
          .single();

        clubName = clubName || yachtClubData?.name;
      }
    }

    // Get document requirements
    const { data: docRequirements } = await supabase
      .from('regatta_document_requirements')
      .select('*')
      .eq('regatta_id', formData.regatta_id);

    // Create entry
    const { data: entry, error: entryError } = await supabase
      .from('race_entries')
      .insert({
        regatta_id: formData.regatta_id,
        sailor_id: userId,
        boat_id: formData.boat_id,
        entry_class: formData.entry_class,
        division: formData.division,
        sail_number: formData.sail_number,
        entry_fee_amount: regatta?.entry_fee || 0,
        entry_fee_currency: regatta?.currency || 'USD',
        status: 'draft',
        payment_status: 'unpaid',
        crew_member_ids: formData.crew_member_ids,
        special_requests: formData.special_requests,
        dietary_requirements: formData.dietary_requirements,
        equipment_notes: formData.equipment_notes,
        documents_required: docRequirements || [],
        registration_source: 'mobile',
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create crew assignments
    if (formData.crew_member_ids.length > 0) {
      await this.assignCrewMembers(entry.id, formData.crew_member_ids);
    }

    // Get sailor details for notification
    const { data: sailor } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    // Send new registration notification to club
    if (clubEmail) {
      const { emailService } = await import('./EmailService');
      await emailService.sendClubNotification({
        club_name: clubName || 'Club',
        club_email: clubEmail,
        notification_type: 'new_registration',
        sailor_name: sailor?.full_name || 'Sailor',
        regatta_name: regatta.event_name || 'Event',
        entry_number: entry.entry_number || 'TBD',
      });
    }

    return entry as RaceEntry;
  }

  /**
   * Create a new race entry (draft state)
   */
  async createEntry(
    userId: string,
    formData: EntryFormData
  ): Promise<{ success: boolean; entry?: RaceEntry; error?: string; queued?: boolean }> {
    try {
      const entry = await this.createEntryDirect(userId, formData);
      return { success: true, entry };
    } catch (error: any) {
      logger.error('Failed to create race entry:', error);
      await MutationQueueService.enqueueMutation(RACE_ENTRY_COLLECTION, 'upsert', {
        action: 'create',
        userId,
        formData,
      });

      const tempId = `local_entry_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const fallbackEntry: RaceEntry = {
        id: tempId,
        regatta_id: formData.regatta_id,
        sailor_id: userId,
        boat_id: formData.boat_id,
        entry_class: formData.entry_class,
        division: formData.division,
        sail_number: formData.sail_number,
        status: 'pending_sync',
        entry_number: undefined,
        entry_fee_amount: 0,
        entry_fee_currency: 'USD',
        payment_status: 'unpaid',
        payment_intent_id: undefined,
        special_requests: formData.special_requests,
        dietary_requirements: formData.dietary_requirements,
        equipment_notes: formData.equipment_notes,
        crew_member_ids: formData.crew_member_ids,
        documents_required: [],
        documents_submitted: [],
        documents_complete: false,
        created_at: nowIso,
        updated_at: nowIso,
      };

      return {
        success: true,
        entry: fallbackEntry,
        queued: true,
        error: error?.message,
      };
    }
  }

  /**
   * Assign crew members to an entry
   */
  async assignCrewMembers(
    entryId: string,
    crewMemberIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get crew member details
      const { data: crewMembers } = await supabase
        .from('crew_members')
        .select('id, role')
        .in('id', crewMemberIds);

      if (!crewMembers) throw new Error('Crew members not found');

      // Create assignments
      const assignments = crewMembers.map((crew, index) => ({
        entry_id: entryId,
        crew_member_id: crew.id,
        position: crew.role,
        is_skipper: index === 0, // First crew member is skipper by default
        confirmed: false,
      }));

      const { error } = await supabase
        .from('entry_crew_assignments')
        .insert(assignments);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      logger.error('Failed to assign crew members:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check crew availability for specific races
   */
  async checkCrewAvailability(
    crewMemberIds: string[],
    regattaId: string
  ): Promise<{ available: boolean; conflicts: any[] }> {
    try {
      // Check if crew members have conflicting entries
      const { data: conflicts } = await supabase
        .from('entry_crew_assignments')
        .select(`
          *,
          race_entries!inner (
            regatta_id,
            regattas (
              name,
              start_date,
              end_date
            )
          )
        `)
        .in('crew_member_id', crewMemberIds)
        .neq('race_entries.regatta_id', regattaId)
        .eq('confirmed', true);

      return {
        available: !conflicts || conflicts.length === 0,
        conflicts: conflicts || [],
      };
    } catch (error) {
      logger.error('Failed to check crew availability:', error);
      return { available: true, conflicts: [] };
    }
  }

  /**
   * Create payment intent for race entry
   */
  async createPaymentIntent(
    entryId: string
  ): Promise<{
    success: boolean;
    clientSecret?: string;
    paymentIntentId?: string;
    amount?: number;
    currency?: string;
    error?: string
  }> {
    try {
      // Get entry details
      const { data: entry, error: entryError } = await supabase
        .from('race_entries')
        .select(`
          *,
          club_race_calendar!regatta_id (
            event_name
          )
        `)
        .eq('id', entryId)
        .single();

      if (entryError) throw entryError;
      if (!entry) throw new Error('Entry not found');

      // Check if already paid
      if (entry.payment_status === 'paid') {
        return { success: false, error: 'Entry already paid' };
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      // Call Supabase Edge Function to create payment intent
      const { data, error: functionError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          entryId,
          amount: Math.round(entry.entry_fee_amount * 100), // Convert to cents
          currency: entry.entry_fee_currency.toLowerCase(),
          description: `Race Entry: ${entry.club_race_calendar?.event_name || 'Regatta'} - ${entry.sail_number}`
        },
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to create payment intent');
      }

      if (!data || !data.clientSecret || !data.paymentIntentId) {
        throw new Error('Invalid response from payment service');
      }

      // Update entry to pending payment
      const { data: pendingEntry, error: pendingError } = await supabase
        .from('race_entries')
        .update({
          status: 'pending_payment',
          payment_status: 'pending',
          payment_intent_id: data.paymentIntentId,
        })
        .eq('id', entryId)
        .select('id')
        .maybeSingle();

      if (pendingError) throw pendingError;
      if (!pendingEntry) throw new Error('Race entry not found.');

      return {
        success: true,
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
        amount: entry.entry_fee_amount,
        currency: entry.entry_fee_currency
      };
    } catch (error: any) {
      logger.error('Payment intent creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Confirm payment for race entry after Stripe payment succeeds
   */
  async confirmPayment(
    entryId: string,
    paymentIntentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get entry base details first (avoid nested FK-dependent joins).
      const { data: entry } = await supabase
        .from('race_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      let regattaName: string | undefined;
      let sailorName: string | undefined;
      let clubName: string | undefined;
      let clubEmail: string | undefined;

      if (entry?.regatta_id) {
        const { data: regatta } = await supabase
          .from('regattas')
          .select('id, name, club_id')
          .eq('id', entry.regatta_id)
          .single();
        regattaName = regatta?.name;

        const clubId = (regatta as any)?.club_id;
        if (clubId) {
          const { data: club } = await supabase
            .from('clubs')
            .select('id, name, email')
            .eq('id', clubId)
            .single();

          clubName = club?.name;
          clubEmail = club?.email;

          if (!clubName) {
            const { data: yachtClub } = await supabase
              .from('yacht_clubs')
              .select('id, name')
              .eq('id', clubId)
              .single();
            clubName = clubName || yachtClub?.name;
          }
        }
      }

      if (entry?.sailor_id) {
        const { data: sailor } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', entry.sailor_id)
          .single();
        sailorName = sailor?.full_name;
      }

      // Update entry with payment confirmation
      const { data: paidEntry, error: updateError } = await supabase
        .from('race_entries')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          payment_intent_id: paymentIntentId,
          payment_confirmed_at: new Date().toISOString(),
        })
        .eq('id', entryId)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!paidEntry) throw new Error('Race entry not found.');

      // Send confirmation email to sailor
      await this.sendConfirmationEmail(entryId);

      // Send payment notification to club
      if (clubEmail) {
        const { emailService } = await import('./EmailService');
        await emailService.sendClubNotification({
          club_name: clubName || 'Club',
          club_email: clubEmail,
          notification_type: 'payment_received',
          sailor_name: sailorName || 'Sailor',
          regatta_name: regattaName || 'Event',
          entry_number: entry.entry_number || 'TBD',
          amount: entry.entry_fee_amount,
          currency: entry.entry_fee_currency,
        });
      }

      return { success: true };
    } catch (error: any) {
      logger.error('Payment confirmation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process payment for race entry (legacy method - use createPaymentIntent + confirmPayment instead)
   */
  async processPayment(
    entryId: string,
    _userId: string
  ): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
    try {
      const result = await this.createPaymentIntent(entryId);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (error: any) {
      logger.error('Payment processing error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get entry by ID
   */
  async getEntry(entryId: string): Promise<RaceEntry | null> {
    try {
      const { data, error } = await supabase
        .from('race_entries')
        .select(`
          *,
          regattas (
            name,
            start_date,
            end_date,
            venue_id
          ),
          sailor_boats (
            name,
            sail_number
          ),
          entry_crew_assignments (
            *,
            crew_members (
              name,
              email,
              role
            )
          )
        `)
        .eq('id', entryId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Failed to get entry:', error);
      return null;
    }
  }

  /**
   * Get all entries for a sailor
   */
  async getSailorEntries(userId: string): Promise<RaceEntry[]> {
    try {
      const { data, error } = await supabase
        .from('race_entries')
        .select(`
          *,
          regattas (
            name,
            start_date,
            end_date,
            venue_id
          ),
          sailor_boats (
            name,
            sail_number
          )
        `)
        .eq('sailor_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get sailor entries:', error);
      return [];
    }
  }

  /**
   * Get all entries for a regatta
   */
  async getRegattaEntries(regattaId: string): Promise<RaceEntry[]> {
    try {
      const { data, error } = await supabase
        .from('race_entries')
        .select(`
          *,
          users!sailor_id (
            name,
            email
          ),
          sailor_boats (
            name,
            sail_number
          )
        `)
        .eq('regatta_id', regattaId)
        .order('entry_number', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get regatta entries:', error);
      return [];
    }
  }

  /**
   * Upload document for entry
   */
  async uploadDocument(
    entryId: string,
    documentType: string,
    file: File | Blob,
    filename: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Upload to Supabase Storage
      const filePath = `race-entries/${entryId}/${documentType}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Update entry with submitted document
      const { data: entry } = await supabase
        .from('race_entries')
        .select('documents_submitted')
        .eq('id', entryId)
        .single();

      const submittedDocs = entry?.documents_submitted || [];
      submittedDocs.push({
        type: documentType,
        url: urlData.publicUrl,
        filename,
        submitted_at: new Date().toISOString(),
      });

      const { data: updatedEntry, error: updateError } = await supabase
        .from('race_entries')
        .update({ documents_submitted: submittedDocs })
        .eq('id', entryId)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedEntry) throw new Error('Race entry not found.');

      return { success: true, url: urlData.publicUrl };
    } catch (error: any) {
      logger.error('Document upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Withdraw entry
   */
  async withdrawEntry(
    entryId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('race_entries')
        .update({
          status: 'withdrawn',
          withdrawn_at: new Date().toISOString(),
          withdrawal_reason: reason,
        })
        .eq('id', entryId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Race entry not found.');

      return { success: true };
    } catch (error: any) {
      logger.error('Failed to withdraw entry:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send confirmation email
   */
  async sendConfirmationEmail(
    entryId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get full entry details with related data
      const { data: entry, error } = await supabase
        .from('race_entries')
        .select(`
          *,
          regattas (
            event_name,
            start_date,
            sailing_venues (
              name
            )
          ),
          sailor_boats (
            name
          ),
          users!sailor_id (
            name,
            email
          ),
          entry_crew_assignments (
            crew_members (
              name,
              role
            )
          )
        `)
        .eq('id', entryId)
        .single();

      if (error || !entry) throw new Error('Entry not found');

      // Import email service dynamically to avoid circular dependencies
      const { emailService } = await import('./EmailService');

      // Prepare email data
      const emailData = {
        sailor_name: entry.users?.name || 'Sailor',
        sailor_email: entry.users?.email || '',
        regatta_name: entry.regattas?.event_name || 'Regatta',
        entry_number: entry.entry_number || 'TBD',
        boat_name: entry.sailor_boats?.name || 'Boat',
        sail_number: entry.sail_number,
        entry_class: entry.entry_class,
        start_date: entry.regattas?.start_date || new Date().toISOString(),
        venue_name: entry.regattas?.sailing_venues?.name || 'Venue',
        entry_fee_amount: entry.entry_fee_amount,
        entry_fee_currency: entry.entry_fee_currency,
        payment_status: entry.payment_status,
        crew_members: entry.entry_crew_assignments?.map((assignment: any) => ({
          name: assignment.crew_members?.name || '',
          role: assignment.crew_members?.role || '',
        })) || [],
        documents_complete: entry.documents_complete,
      };

      // Send confirmation email
      return await emailService.sendRaceEntryConfirmation(emailData);
    } catch (error: any) {
      logger.error('Failed to send confirmation email:', error);
      return { success: false, error: error.message };
    }
  }
}

export const raceRegistrationService = new RaceRegistrationService();

export function initializeRaceRegistrationMutationHandlers() {
  MutationQueueService.registerHandler(RACE_ENTRY_COLLECTION, {
    upsert: async (payload: any) => {
      if (payload?.action === 'create') {
        await raceRegistrationService.createEntryDirect(payload.userId, payload.formData);
      } else {
        logger.warn('Unhandled race entry action', payload?.action);
      }
    },
  });
}
