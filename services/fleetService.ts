import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import type { StoredDocument } from './storage/DocumentStorageService';

const logger = createLogger('FleetService');

export interface Fleet {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  classId?: string | null;
  clubId?: string | null;
  region?: string | null;
  whatsappLink?: string | null;
  visibility: 'public' | 'private' | 'club';
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FleetMembership {
  fleet: Fleet;
  role: 'member' | 'owner' | 'captain' | 'coach' | 'support';
  status: 'active' | 'pending' | 'invited' | 'inactive';
  joinedAt?: string | null;
}

export interface FleetMetrics {
  members: number;
  followers: number;
  documents: number;
}

export interface FleetOverview {
  fleet: Fleet;
  metrics: FleetMetrics;
}

export interface FleetResource {
  id: string;
  fleetId: string;
  documentId: string;
  tags: string[];
  sharedBy?: string | null;
  createdAt: string;
  notifyFollowers?: boolean;
  document?: StoredDocument;
  ownerProfile?: {
    id: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  };
}

export interface FleetCourseSummary {
  id: string;
  name: string;
  courseType?: string | null;
  lastUsedDate?: string | null;
  description?: string | null;
  venueId?: string | null;
}

export interface FleetRaceSummary {
  id: string;
  raceName: string;
  startTime?: string | null;
  boatClass?: string | null;
  raceSeries?: string | null;
  venueId?: string | null;
  racingAreaName?: string | null;
  venueName?: string | null;
}

export type FleetActivityType =
  | 'document_uploaded'
  | 'announcement'
  | 'event_created'
  | 'status_update'
  | 'member_joined'
  | 'member_left'
  | 'resource_shared';

export interface FleetActivityEntry {
  id: string;
  fleetId: string;
  actorId?: string | null;
  activityType: FleetActivityType;
  payload: Record<string, unknown>;
  visibility: 'fleet' | 'followers' | 'public';
  createdAt: string;
}

export interface FleetMember {
  id: string;
  fleetId: string;
  userId: string;
  role: FleetMembership['role'];
  status: FleetMembership['status'];
  joinedAt?: string | null;
  invitedBy?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Hydrated roster row: a fleet member OR a pending email invite. */
export interface FleetRosterEntry {
  rowId: string;
  userId: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: FleetMembership['role'];
  status: FleetMembership['status'] | 'pending';
  joinedAt?: string | null;
  invitedBy?: string | null;
  isEmailInvite: boolean;
}

export type EmailInviteResult =
  | 'invited_user'
  | 'invited_email'
  | 'already_member';

class FleetService {
  private boatClassNameCache = new Map<string, string | null>();

  private async resolveBoatClassName(classId?: string | null): Promise<string | null> {
    if (!classId) {
      return null;
    }

    if (this.boatClassNameCache.has(classId)) {
      return this.boatClassNameCache.get(classId) ?? null;
    }

    const { data, error } = await supabase
      .from('boat_classes')
      .select('name')
      .eq('id', classId)
      .maybeSingle();

    if (error) {
      logger.warn('[FleetService] Unable to resolve boat class name', { classId, error });
      this.boatClassNameCache.set(classId, null);
      return null;
    }

    const name = data?.name ?? null;
    this.boatClassNameCache.set(classId, name);
    return name;
  }

  private mapFleet(row: any): Fleet {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      classId: row.class_id,
      clubId: row.club_id,
      region: row.region,
      whatsappLink: row.whatsapp_link,
      visibility: (row.visibility ?? 'private') as Fleet['visibility'],
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getFleetsForUser(userId: string): Promise<FleetMembership[]> {
    const queryStartTime = Date.now();
    logger.debug(`[FleetService] ========== GET FLEETS FOR USER STARTED at ${new Date().toISOString()} ==========`);
    logger.debug('[FleetService] Query start timestamp:', queryStartTime);
    logger.debug('[FleetService] User ID:', userId);

    const { data, error } = await supabase
      .from('fleet_members')
      .select(
        `
        role,
        status,
        joined_at,
        fleet:fleet_id (
          *
        )
        `,
      )
      .eq('user_id', userId)
      .eq('status', 'active');

    const queryEndTime = Date.now();
    const queryDuration = queryEndTime - queryStartTime;

    logger.debug('[FleetService] ========== DATABASE QUERY COMPLETED ==========');
    logger.debug('[FleetService] Query end timestamp:', queryEndTime);
    logger.debug('[FleetService] Query duration:', queryDuration, 'ms');
    logger.debug('[FleetService] Raw data from database:', data);
    logger.debug('[FleetService] Error:', error);
    logger.debug('[FleetService] Raw data count:', data?.length || 0);

    if (error) {
      logger.error('[FleetService] ========== QUERY FAILED ==========');
      logger.error('[FleetService] Error fetching fleets for user:', error);
      throw error;
    }

    const filtered = (data || []).filter(item => item.fleet);
    logger.debug('[FleetService] After filtering (items with fleet):', filtered.length);
    logger.debug('[FleetService] Filtered items:', filtered);

    const mapped = filtered.map(item => ({
      fleet: this.mapFleet(item.fleet),
      role: (item.role ?? 'member') as FleetMembership['role'],
      status: (item.status ?? 'active') as FleetMembership['status'],
      joinedAt: item.joined_at,
    }));

    logger.debug('[FleetService] ========== MAPPING COMPLETED ==========');
    logger.debug('[FleetService] Mapped memberships count:', mapped.length);
    logger.debug('[FleetService] Mapped fleet IDs:', mapped.map(m => m.fleet.id));
    logger.debug('[FleetService] Mapped fleet names:', mapped.map(m => m.fleet.name));
    logger.debug('[FleetService] Final result:', mapped);

    const totalDuration = Date.now() - queryStartTime;
    logger.debug('[FleetService] ========== GET FLEETS FOR USER COMPLETED ==========');
    logger.debug('[FleetService] Total duration:', totalDuration, 'ms');

    return mapped;
  }

  async getFleetOverview(fleetId: string): Promise<FleetOverview> {
    const { data, error } = await supabase
      .from('fleets')
      .select('*')
      .eq('id', fleetId)
      .single();

    if (error || !data) {
      logger.error('Error fetching fleet overview:', error);
      throw error;
    }

    const metrics = await Promise.all([
      this.countMembers(fleetId),
      this.countFollowers(fleetId),
      this.countDocuments(fleetId),
    ]);

    return {
      fleet: this.mapFleet(data),
      metrics: {
        members: metrics[0],
        followers: metrics[1],
        documents: metrics[2],
      },
    };
  }

  async getFleetActivity(fleetId: string, options?: { limit?: number }): Promise<FleetActivityEntry[]> {
    const { data, error } = await supabase
      .from('fleet_activity')
      .select('*')
      .eq('fleet_id', fleetId)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 25);

    if (error) {
      logger.error('Error fetching fleet activity:', error);
      throw error;
    }

    return (data || []).map(entry => ({
      id: entry.id,
      fleetId: entry.fleet_id,
      actorId: entry.actor_id,
      activityType: entry.activity_type as FleetActivityType,
      payload: entry.payload ?? {},
      visibility: (entry.visibility ?? 'fleet') as FleetActivityEntry['visibility'],
      createdAt: entry.created_at,
    }));
  }

  async getFleetMembers(fleetId: string): Promise<FleetMember[]> {
    const { data, error } = await supabase
      .from('fleet_members')
      .select('*')
      .eq('fleet_id', fleetId)
      .order('joined_at', { ascending: false });

    if (error) {
      logger.error('Error fetching fleet members:', error);
      throw error;
    }

    return (data || []).map(member => ({
      id: member.id,
      fleetId: member.fleet_id,
      userId: member.user_id,
      role: (member.role ?? 'member') as FleetMembership['role'],
      status: (member.status ?? 'active') as FleetMembership['status'],
      joinedAt: member.joined_at,
      invitedBy: member.invited_by,
      metadata: member.metadata,
    }));
  }

  /**
   * Full roster (active + invited members and pending email invites),
   * hydrated with profile name/avatar. Goes through a SECURITY DEFINER
   * RPC because fleet_members.user_id → auth.users (not public) blocks a
   * direct profile embed, and member-of gating lives server-side.
   */
  async getFleetRoster(fleetId: string): Promise<FleetRosterEntry[]> {
    const { data, error } = await supabase.rpc('get_fleet_roster', {
      p_fleet_id: fleetId,
    });

    if (error) {
      logger.error('Error fetching fleet roster:', error);
      throw error;
    }

    return ((data ?? []) as any[]).map(row => ({
      rowId: row.row_id,
      userId: row.member_user_id ?? null,
      email: row.member_email ?? null,
      displayName: row.display_name ?? 'Sailor',
      avatarUrl: row.avatar_url ?? null,
      role: (row.member_role ?? 'member') as FleetMembership['role'],
      status: (row.member_status ?? 'active') as FleetRosterEntry['status'],
      joinedAt: row.joined_at,
      invitedBy: row.invited_by,
      isEmailInvite: !!row.is_email_invite,
    }));
  }

  /** Owner-only: change a member's role (e.g. promote to captain). */
  async setFleetMemberRole(
    fleetId: string,
    userId: string,
    role: FleetMembership['role'],
  ): Promise<void> {
    const { error } = await supabase.rpc('set_fleet_member_role', {
      p_fleet_id: fleetId,
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      logger.error('Error setting fleet member role:', error);
      throw error;
    }
  }

  /** Owner/captain: remove a member from the fleet. */
  async removeFleetMember(fleetId: string, userId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_fleet_member', {
      p_fleet_id: fleetId,
      p_user_id: userId,
    });
    if (error) {
      logger.error('Error removing fleet member:', error);
      throw error;
    }
  }

  /**
   * Invite by email. If the address already has an account they get an
   * 'invited' membership immediately; otherwise a pending fleet_invite is
   * stored and claimed when they sign up.
   */
  async inviteMemberByEmail(
    fleetId: string,
    email: string,
    role: FleetMembership['role'] = 'member',
  ): Promise<EmailInviteResult> {
    const { data, error } = await supabase.rpc('invite_fleet_member_by_email', {
      p_fleet_id: fleetId,
      p_email: email,
      p_role: role,
    });
    if (error) {
      logger.error('Error inviting fleet member by email:', error);
      throw error;
    }
    return data as EmailInviteResult;
  }

  /** Owner/captain: cancel a pending email invite. */
  async revokeFleetInvite(inviteId: string): Promise<void> {
    const { error } = await supabase.rpc('revoke_fleet_invite', {
      p_invite_id: inviteId,
    });
    if (error) {
      logger.error('Error revoking fleet invite:', error);
      throw error;
    }
  }

  /** Convert any pending email invites matching the caller's email. */
  async claimFleetInvites(): Promise<number> {
    const { data, error } = await supabase.rpc('claim_fleet_invites');
    if (error) {
      logger.error('Error claiming fleet invites:', error);
      throw error;
    }
    return (data as number) ?? 0;
  }

  async followFleet(userId: string, fleetId: string, preferences?: {
    notifyOnDocuments?: boolean;
    notifyOnAnnouncements?: boolean;
    notifyOnEvents?: boolean;
  }): Promise<void> {
    const payload = {
      follower_id: userId,
      fleet_id: fleetId,
      notify_on_documents: preferences?.notifyOnDocuments ?? true,
      notify_on_announcements: preferences?.notifyOnAnnouncements ?? true,
      notify_on_events: preferences?.notifyOnEvents ?? true,
    };

    const { error } = await supabase
      .from('fleet_followers')
      .upsert(payload, { onConflict: 'fleet_id,follower_id' });

    if (error) {
      logger.error('Error following fleet:', error);
      throw error;
    }
  }

  async unfollowFleet(userId: string, fleetId: string): Promise<void> {
    const { error } = await supabase
      .from('fleet_followers')
      .delete()
      .eq('fleet_id', fleetId)
      .eq('follower_id', userId);

    if (error) {
      logger.error('Error unfollowing fleet:', error);
      throw error;
    }
  }

  async joinFleet(userId: string, fleetId: string, role: FleetMembership['role'] = 'member'): Promise<void> {
    const { error } = await supabase
      .from('fleet_members')
      .upsert(
        {
          fleet_id: fleetId,
          user_id: userId,
          role,
          status: 'active',
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'fleet_id,user_id' }
      );

    if (error) {
      logger.error('Error joining fleet:', error);
      throw error;
    }
  }

  async leaveFleet(userId: string, fleetId: string): Promise<void> {
    const { error } = await supabase
      .from('fleet_members')
      .delete()
      .eq('fleet_id', fleetId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error leaving fleet:', error);
      throw error;
    }
  }

  async getFleetResources(
    fleetId: string,
    options?: { limit?: number }
  ): Promise<FleetResource[]> {
    const { data, error } = await supabase
      .from('fleet_documents')
      .select('*')
      .eq('fleet_id', fleetId)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 12);

    if (error) {
      logger.error('Error fetching fleet resources:', error);
      throw error;
    }

    if (!data?.length) {
      return [];
    }

    const documentIds = data
      .map(entry => entry.document_id)
      .filter((id): id is string => Boolean(id));

    const ownerIds = data
      .map(entry => entry.shared_by)
      .filter((id): id is string => Boolean(id));

    let documentsById: Record<string, StoredDocument> = {};
    if (documentIds.length) {
      const { data: documents, error: docError } = await supabase
        .from('documents')
        .select('*')
        .in('id', documentIds);

      if (docError) {
        logger.warn('Unable to load documents for fleet resources:', docError);
      } else {
        documentsById = Object.fromEntries(
          (documents || []).map(doc => [
            doc.id,
            {
              id: doc.id,
              user_id: doc.user_id,
              filename: doc.filename,
              file_type: doc.file_type,
              file_size: doc.file_size,
              storage_path: doc.storage_path,
              public_url: doc.public_url,
              metadata: doc.metadata,
              created_at: doc.created_at,
              updated_at: doc.updated_at,
            } satisfies StoredDocument,
          ])
        );
      }
    }

    let ownersById: Record<string, { id: string; full_name?: string | null; avatar_url?: string | null }> = {};
    if (ownerIds.length) {
      const { data: owners, error: ownerError } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', ownerIds);

      if (ownerError) {
        logger.warn('Unable to load owners for fleet resources:', ownerError);
      } else {
        ownersById = Object.fromEntries((owners || []).map(owner => [owner.id, owner]));
      }
    }

    return data.map(entry => ({
      id: entry.id,
      fleetId: entry.fleet_id,
      documentId: entry.document_id,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      sharedBy: entry.shared_by,
      notifyFollowers: entry.notify_followers ?? false,
      createdAt: entry.created_at,
      document: entry.document_id ? documentsById[entry.document_id] : undefined,
      ownerProfile: entry.shared_by
        ? {
            id: entry.shared_by,
            fullName: ownersById[entry.shared_by]?.full_name,
            avatarUrl: ownersById[entry.shared_by]?.avatar_url,
          }
        : undefined,
    }));
  }

  async getFleetCourses(params: { clubId?: string | null; limit?: number }): Promise<FleetCourseSummary[]> {
    if (!params.clubId) {
      return [];
    }

    try {
      let query = supabase
        .from('race_courses')
        .select('id, name, course_type, last_used_date, description, venue_id')
        .eq('club_id', params.clubId)
        .order('last_used_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching fleet courses:', error);
        throw error;
      }

      return (data || []).map(course => ({
        id: course.id,
        name: course.name,
        courseType: course.course_type,
        lastUsedDate: course.last_used_date,
        description: course.description,
        venueId: course.venue_id,
      }));
    } catch (error) {
      logger.warn('Unable to load fleet courses - returning empty set', error);
      return [];
    }
  }

  async getFleetUpcomingRaces(params: { classId?: string | null; limit?: number }): Promise<FleetRaceSummary[]> {
    if (!params.classId) {
      logger.debug('[FleetService] No classId provided for getFleetUpcomingRaces, returning empty list');
      return [];
    }

    try {
      const resolvedClassName = await this.resolveBoatClassName(params.classId);
      if (!resolvedClassName) {
        logger.warn('[FleetService] Could not resolve boat class name for display', {
          classId: params.classId,
        });
      }

      const nowIso = new Date().toISOString();

      // Build query with columns that actually exist in race_events table
      let query = supabase
        .from('race_events')
        .select('id, name, start_time, boat_class, boat_classes, race_series, location, racing_area_name')
        .gte('start_time', nowIso)
        .order('start_time', { ascending: true });

      // Build OR filter for multiple matching strategies (handles both schema formats)
      const filterConditions: string[] = [];

      // Match JSONB array containing the classId (format: [{id: "...", name: "..."}])
      filterConditions.push(`boat_classes.cs.[{"id":"${params.classId}"}]`);

      // Match TEXT field with classId directly
      filterConditions.push(`boat_class.eq.${params.classId}`);

      // Match TEXT field with class name (case-insensitive)
      if (resolvedClassName) {
        filterConditions.push(`boat_class.ilike.%${resolvedClassName}%`);
      }

      query = query.or(filterConditions.join(','));

      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching fleet upcoming races:', error);
        throw error;
      }

      return (data || []).map(event => ({
        id: event.id,
        raceName: event.name || 'Untitled Race',
        startTime: event.start_time,
        boatClass: this.extractBoatClassName(event, resolvedClassName),
        raceSeries: event.race_series,
        venueId: null,
        racingAreaName: event.racing_area_name ?? null,
        venueName: event.location ?? event.racing_area_name ?? null,
      }));
    } catch (error) {
      logger.warn('Unable to load upcoming fleet races - returning empty list', error);
      return [];
    }
  }

  /**
   * Extract boat class name from race event data, handling both schema formats
   */
  private extractBoatClassName(
    event: { boat_class?: string | null; boat_classes?: unknown },
    resolvedClassName: string | null
  ): string | null {
    // Priority 1: boat_classes JSONB array (newer format)
    if (
      event.boat_classes &&
      Array.isArray(event.boat_classes) &&
      event.boat_classes.length > 0
    ) {
      const firstClass = event.boat_classes[0];
      return typeof firstClass === 'object' && firstClass !== null
        ? (firstClass as { name?: string }).name || null
        : String(firstClass);
    }

    // Priority 2: boat_class TEXT field
    if (event.boat_class) {
      return event.boat_class;
    }

    // Priority 3: Resolved class name from classId
    return resolvedClassName;
  }

  private async countMembers(fleetId: string): Promise<number> {
    const { count, error } = await supabase
      .from('fleet_members')
      .select('*', { count: 'exact', head: true })
      .eq('fleet_id', fleetId)
      .eq('status', 'active');

    if (error) {
      logger.error('Error counting fleet members:', error);
      return 0;
    }

    return count ?? 0;
  }

  private async countFollowers(fleetId: string): Promise<number> {
    const { count, error } = await supabase
      .from('fleet_followers')
      .select('*', { count: 'exact', head: true })
      .eq('fleet_id', fleetId);

    if (error) {
      logger.error('Error counting fleet followers:', error);
      return 0;
    }

    return count ?? 0;
  }

  private async countDocuments(fleetId: string): Promise<number> {
    const { count, error } = await supabase
      .from('fleet_documents')
      .select('*', { count: 'exact', head: true })
      .eq('fleet_id', fleetId);

    if (error) {
      logger.error('Error counting fleet documents:', error);
      return 0;
    }

    return count ?? 0;
  }

  /**
   * Share a document with a fleet
   */
  async shareDocumentWithFleet(params: {
    fleetId: string;
    documentId: string;
    sharedBy: string;
    tags?: string[];
    notifyFollowers?: boolean;
  }): Promise<void> {
    const { error } = await supabase
      .from('fleet_documents')
      .insert({
        fleet_id: params.fleetId,
        document_id: params.documentId,
        shared_by: params.sharedBy,
        tags: params.tags || [],
        notify_followers: params.notifyFollowers ?? false,
      });

    if (error) {
      logger.error('Error sharing document with fleet:', error);
      throw error;
    }

    if (!params.notifyFollowers) {
      return;
    }

    try {
      const { data: fleet } = await supabase
        .from('fleets')
        .select('name')
        .eq('id', params.fleetId)
        .maybeSingle();

      const { data: followers, error: followersError } = await supabase
        .from('fleet_followers')
        .select('follower_id, notify_on_documents')
        .eq('fleet_id', params.fleetId)
        .eq('notify_on_documents', true);

      if (followersError) {
        logger.warn('Unable to load fleet followers for notifications', followersError);
        return;
      }

      const recipientIds = Array.from(
        new Set(
          (followers || [])
            .map((row: any) => row?.follower_id)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        )
      ).filter((id) => id !== params.sharedBy);

      if (recipientIds.length === 0) {
        return;
      }

      const message = `A new fleet document was shared${fleet?.name ? ` in ${fleet.name}` : ''}.`;
      const payload = recipientIds.map((userId) => ({
        user_id: userId,
        fleet_id: params.fleetId,
        notification_type: 'tuning_guide_posted' as const,
        actor_id: params.sharedBy,
        message,
        is_read: false,
      }));

      const { error: notificationError } = await supabase
        .from('fleet_notifications')
        .insert(payload);

      if (notificationError) {
        logger.warn('Failed to notify fleet followers about shared document', {
          fleetId: params.fleetId,
          documentId: params.documentId,
          error: notificationError,
        });
        return;
      }

      logger.debug('Notified fleet followers for shared document', {
        fleetId: params.fleetId,
        documentId: params.documentId,
        recipients: recipientIds.length,
      });
    } catch (notifyError) {
      // Best effort: document sharing should not fail if notification write fails.
      logger.warn('Unexpected error while notifying fleet followers', {
        fleetId: params.fleetId,
        documentId: params.documentId,
        error: notifyError,
      });
    }
  }
}

export const fleetService = new FleetService();
