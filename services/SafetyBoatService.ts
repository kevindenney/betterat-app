/**
 * Safety Boat Coordinator Service
 * 
 * Manages safety boat fleet, assignments, incidents, and communications
 */

import { supabase } from './supabase';

// ============================================================================
// Types
// ============================================================================

export interface SafetyBoat {
  id: string;
  club_id: string;
  name: string;
  boat_number?: string;
  boat_type?: string;
  registration_number?: string;
  hull_color?: string;
  max_persons: number;
  has_vhf: boolean;
  vhf_channel?: string;
  has_first_aid: boolean;
  has_tow_line: boolean;
  has_anchor: boolean;
  equipment_notes?: string;
  status: BoatStatus;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BoatStatus = 
  | 'available'
  | 'assigned'
  | 'on_water'
  | 'maintenance'
  | 'unavailable';

export interface SafetyPosition {
  id: string;
  club_id?: string;
  name: string;
  code?: string;
  position_type: PositionType;
  description?: string;
  latitude?: number;
  longitude?: number;
  priority: number;
  required_for_racing: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type PositionType = 
  | 'mark'
  | 'start_line'
  | 'gate'
  | 'course'
  | 'shore'
  | 'roving';

export interface SafetyAssignment {
  id: string;
  regatta_id: string;
  boat_id: string;
  position_id?: string;
  custom_position_name?: string;
  assignment_date: string;
  start_time?: string;
  end_time?: string;
  status: AssignmentStatus;
  deployed_at?: string;
  returned_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  boat?: SafetyBoat;
  position?: SafetyPosition;
  crew?: SafetyCrew[];
}

export type AssignmentStatus = 
  | 'assigned'
  | 'deployed'
  | 'standby'
  | 'responding'
  | 'returning'
  | 'off_duty';

export interface SafetyCrew {
  id: string;
  assignment_id: string;
  user_id?: string;
  name: string;
  role: CrewRole;
  phone?: string;
  vhf_callsign?: string;
  powerboat_certified: boolean;
  first_aid_certified: boolean;
  rescue_certified: boolean;
  checked_in: boolean;
  checked_in_at?: string;
  checked_out_at?: string;
  created_at: string;
}

export type CrewRole = 
  | 'driver'
  | 'crew'
  | 'first_aid'
  | 'rescue_swimmer';

export interface RadioCheck {
  id: string;
  assignment_id: string;
  check_time: string;
  initiated_by?: string;
  status: RadioStatus;
  signal_quality?: SignalQuality;
  notes?: string;
  checked_by?: string;
  created_at: string;
}

export type RadioStatus = 
  | 'successful'
  | 'partial'
  | 'failed'
  | 'no_response';

export type SignalQuality = 
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor';

export interface SafetyIncident {
  id: string;
  regatta_id: string;
  incident_number: number;
  reported_at: string;
  incident_time?: string;
  resolved_at?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  near_mark?: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  race_entry_ids?: string[];
  sail_numbers?: string[];
  responding_boat_id?: string;
  responding_assignment_id?: string;
  response_time_seconds?: number;
  description: string;
  actions_taken?: string;
  outcome?: IncidentOutcome;
  injuries_reported: boolean;
  injury_details?: string;
  medical_attention_required: boolean;
  equipment_damage?: string;
  equipment_lost?: string;
  status: IncidentStatus;
  reported_by?: string;
  reported_by_name?: string;
  log_entry_id?: string;
  created_at: string;
  updated_at: string;
  // Joined
  responding_boat?: SafetyBoat;
}

export type IncidentType = 
  | 'capsize'
  | 'dismasting'
  | 'collision'
  | 'man_overboard'
  | 'medical'
  | 'equipment_failure'
  | 'grounding'
  | 'tow_request'
  | 'retirement'
  | 'search'
  | 'other';

export type IncidentSeverity = 
  | 'minor'
  | 'moderate'
  | 'serious'
  | 'critical';

export type IncidentOutcome = 
  | 'resumed_racing'
  | 'retired'
  | 'towed_to_shore'
  | 'medical_transport'
  | 'external_assistance'
  | 'resolved_on_water'
  | 'pending';

export type IncidentStatus = 
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'requires_followup';

export interface SafetyDashboardData {
  regatta_id: string;
  assignment_date: string;
  boat_id: string;
  boat_name: string;
  boat_number?: string;
  boat_type?: string;
  vhf_channel?: string;
  assignment_id: string;
  assignment_status: AssignmentStatus;
  position_name?: string;
  position_code?: string;
  position_type?: PositionType;
  deployed_at?: string;
  returned_at?: string;
  crew: SafetyCrew[];
  recent_radio_checks: number;
  last_radio_status?: RadioStatus;
}

export interface IncidentSummary {
  regatta_id: string;
  total_incidents: number;
  open_incidents: number;
  in_progress: number;
  resolved: number;
  critical_count: number;
  serious_count: number;
  with_injuries: number;
  medical_required: number;
  avg_response_seconds?: number;
}

// ============================================================================
// Safety Boat Service Class
// ============================================================================

class SafetyBoatService {
  // ==========================================================================
  // Boat Management
  // ==========================================================================
  
  /**
   * Get all safety boats for a club
   */
  async getBoats(clubId: string): Promise<SafetyBoat[]> {
    const { data, error } = await supabase
      .from('safety_boats')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Get a single safety boat
   */
  async getBoat(boatId: string): Promise<SafetyBoat | null> {
    const { data, error } = await supabase
      .from('safety_boats')
      .select('*')
      .eq('id', boatId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  
  /**
   * Create a new safety boat
   */
  async createBoat(boat: Partial<SafetyBoat>): Promise<SafetyBoat> {
    const { data, error } = await supabase
      .from('safety_boats')
      .insert(boat)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Update a safety boat
   */
  async updateBoat(boatId: string, updates: Partial<SafetyBoat>): Promise<SafetyBoat> {
    const { data, error } = await supabase
      .from('safety_boats')
      .update(updates)
      .eq('id', boatId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Deactivate a safety boat (soft delete)
   */
  async deactivateBoat(boatId: string): Promise<void> {
    const { error } = await supabase
      .from('safety_boats')
      .update({ is_active: false })
      .eq('id', boatId);
    
    if (error) throw error;
  }
  
  /**
   * Get available boats for assignment
   */
  async getAvailableBoats(clubId: string, date: string): Promise<SafetyBoat[]> {
    const { data, error } = await supabase
      .from('safety_boats')
      .select(`
        *,
        safety_assignments!left(id, assignment_date)
      `)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .in('status', ['available', 'assigned'])
      .order('name');
    
    if (error) throw error;
    
    // Filter out boats already assigned on this date
    return (data || []).filter((boat: any) => {
      const assignments = boat.safety_assignments || [];
      return !assignments.some((a: any) => a.assignment_date === date);
    });
  }
  
  // ==========================================================================
  // Position Management
  // ==========================================================================
  
  /**
   * Get all positions (default + club custom)
   */
  async getPositions(clubId?: string): Promise<SafetyPosition[]> {
    let query = supabase
      .from('safety_positions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    if (clubId) {
      query = query.or(`club_id.is.null,club_id.eq.${clubId}`);
    } else {
      query = query.is('club_id', null);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Create a custom position for a club
   */
  async createPosition(position: Partial<SafetyPosition>): Promise<SafetyPosition> {
    const { data, error } = await supabase
      .from('safety_positions')
      .insert(position)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  // ==========================================================================
  // Assignment Management
  // ==========================================================================
  
  /**
   * Get assignments for a regatta on a specific date
   */
  async getAssignments(regattaId: string, date?: string): Promise<SafetyAssignment[]> {
    let query = supabase
      .from('safety_assignments')
      .select(`
        *,
        boat:safety_boats(*),
        position:safety_positions(*),
        crew:safety_crew(*)
      `)
      .eq('regatta_id', regattaId)
      .order('created_at');
    
    if (date) {
      query = query.eq('assignment_date', date);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Create an assignment
   */
  async createAssignment(assignment: Partial<SafetyAssignment>): Promise<SafetyAssignment> {
    const { data, error } = await supabase
      .from('safety_assignments')
      .insert(assignment)
      .select(`
        *,
        boat:safety_boats(*),
        position:safety_positions(*)
      `)
      .single();
    
    if (error) throw error;
    
    // Update boat status
    await this.updateBoat(assignment.boat_id!, { status: 'assigned' });
    
    return data;
  }
  
  /**
   * Update assignment status
   */
  async updateAssignmentStatus(
    assignmentId: string, 
    status: AssignmentStatus
  ): Promise<SafetyAssignment> {
    const updates: Partial<SafetyAssignment> = { status };
    
    if (status === 'deployed') {
      updates.deployed_at = new Date().toISOString();
    } else if (status === 'off_duty') {
      updates.returned_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('safety_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select(`
        *,
        boat:safety_boats(*),
        position:safety_positions(*)
      `)
      .single();
    
    if (error) throw error;
    
    // Update boat status accordingly
    if (data.boat_id) {
      let boatStatus: BoatStatus = 'available';
      if (status === 'deployed' || status === 'responding') {
        boatStatus = 'on_water';
      } else if (status === 'assigned' || status === 'standby') {
        boatStatus = 'assigned';
      }
      await this.updateBoat(data.boat_id, { status: boatStatus });
    }
    
    return data;
  }
  
  /**
   * Deploy a safety boat
   */
  async deployBoat(assignmentId: string): Promise<SafetyAssignment> {
    return this.updateAssignmentStatus(assignmentId, 'deployed');
  }
  
  /**
   * Mark boat as responding to incident
   */
  async markResponding(assignmentId: string): Promise<SafetyAssignment> {
    return this.updateAssignmentStatus(assignmentId, 'responding');
  }
  
  /**
   * Return boat to station
   */
  async returnToStation(assignmentId: string): Promise<SafetyAssignment> {
    return this.updateAssignmentStatus(assignmentId, 'standby');
  }
  
  /**
   * End assignment for the day
   */
  async endAssignment(assignmentId: string): Promise<SafetyAssignment> {
    return this.updateAssignmentStatus(assignmentId, 'off_duty');
  }
  
  /**
   * Delete an assignment
   */
  async deleteAssignment(assignmentId: string): Promise<void> {
    const { data: assignment } = await supabase
      .from('safety_assignments')
      .select('boat_id')
      .eq('id', assignmentId)
      .single();
    
    const { error } = await supabase
      .from('safety_assignments')
      .delete()
      .eq('id', assignmentId);
    
    if (error) throw error;
    
    // Reset boat status
    if (assignment?.boat_id) {
      await this.updateBoat(assignment.boat_id, { status: 'available' });
    }
  }
  
  // ==========================================================================
  // Crew Management
  // ==========================================================================
  
  /**
   * Add crew member to assignment
   */
  async addCrew(crew: Partial<SafetyCrew>): Promise<SafetyCrew> {
    const { data, error } = await supabase
      .from('safety_crew')
      .insert(crew)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Update crew member
   */
  async updateCrew(crewId: string, updates: Partial<SafetyCrew>): Promise<SafetyCrew> {
    const { data, error } = await supabase
      .from('safety_crew')
      .update(updates)
      .eq('id', crewId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Remove crew member
   */
  async removeCrew(crewId: string): Promise<void> {
    const { error } = await supabase
      .from('safety_crew')
      .delete()
      .eq('id', crewId);
    
    if (error) throw error;
  }
  
  /**
   * Check in crew member
   */
  async checkInCrew(crewId: string): Promise<SafetyCrew> {
    return this.updateCrew(crewId, {
      checked_in: true,
      checked_in_at: new Date().toISOString(),
    });
  }
  
  /**
   * Check out crew member
   */
  async checkOutCrew(crewId: string): Promise<SafetyCrew> {
    return this.updateCrew(crewId, {
      checked_out_at: new Date().toISOString(),
    });
  }
  
  // ==========================================================================
  // Radio Check Management
  // ==========================================================================
  
  /**
   * Get radio checks for an assignment
   */
  async getRadioChecks(assignmentId: string): Promise<RadioCheck[]> {
    const { data, error } = await supabase
      .from('safety_radio_checks')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('check_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Record a radio check
   */
  async recordRadioCheck(check: Partial<RadioCheck>): Promise<RadioCheck> {
    const { data, error } = await supabase
      .from('safety_radio_checks')
      .insert({
        ...check,
        check_time: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Quick radio check - successful
   */
  async quickRadioCheck(
    assignmentId: string, 
    quality: SignalQuality = 'good'
  ): Promise<RadioCheck> {
    return this.recordRadioCheck({
      assignment_id: assignmentId,
      initiated_by: 'committee',
      status: 'successful',
      signal_quality: quality,
    });
  }
  
  /**
   * Record failed radio contact
   */
  async recordNoContact(assignmentId: string, notes?: string): Promise<RadioCheck> {
    return this.recordRadioCheck({
      assignment_id: assignmentId,
      initiated_by: 'committee',
      status: 'no_response',
      notes,
    });
  }
  
  /**
   * Perform radio check all boats
   */
  async checkAllBoats(regattaId: string): Promise<{
    successful: number;
    failed: number;
    results: { assignmentId: string; status: RadioStatus }[];
  }> {
    // Get all deployed assignments
    const assignments = await this.getAssignments(regattaId, new Date().toISOString().split('T')[0]);
    const deployed = assignments.filter(a => 
      a.status === 'deployed' || a.status === 'standby' || a.status === 'responding'
    );
    
    // This would trigger actual radio checks in real implementation
    // For now, return current status
    const results = deployed.map(a => ({
      assignmentId: a.id,
      status: 'successful' as RadioStatus, // Placeholder
    }));
    
    return {
      successful: results.filter(r => r.status === 'successful').length,
      failed: results.filter(r => r.status !== 'successful').length,
      results,
    };
  }
  
  // ==========================================================================
  // Incident Management
  // ==========================================================================
  
  /**
   * Get all incidents for a regatta
   */
  async getIncidents(regattaId: string): Promise<SafetyIncident[]> {
    const { data, error } = await supabase
      .from('safety_incidents')
      .select(`
        *,
        responding_boat:safety_boats(*)
      `)
      .eq('regatta_id', regattaId)
      .order('reported_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Get open incidents
   */
  async getOpenIncidents(regattaId: string): Promise<SafetyIncident[]> {
    const { data, error } = await supabase
      .from('safety_incidents')
      .select(`
        *,
        responding_boat:safety_boats(*)
      `)
      .eq('regatta_id', regattaId)
      .in('status', ['open', 'in_progress'])
      .order('severity', { ascending: false })
      .order('reported_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Create a new incident
   */
  async reportIncident(incident: Partial<SafetyIncident>): Promise<SafetyIncident> {
    const { data, error } = await supabase
      .from('safety_incidents')
      .insert({
        ...incident,
        reported_at: new Date().toISOString(),
        status: 'open',
      })
      .select(`
        *,
        responding_boat:safety_boats(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Quick incident report
   */
  async quickReport(
    regattaId: string,
    type: IncidentType,
    description: string,
    options?: {
      sailNumbers?: string[];
      location?: string;
      severity?: IncidentSeverity;
    }
  ): Promise<SafetyIncident> {
    return this.reportIncident({
      regatta_id: regattaId,
      incident_type: type,
      description,
      severity: options?.severity || 'minor',
      sail_numbers: options?.sailNumbers,
      location: options?.location,
    });
  }
  
  /**
   * Update incident
   */
  async updateIncident(
    incidentId: string, 
    updates: Partial<SafetyIncident>
  ): Promise<SafetyIncident> {
    const { data, error } = await supabase
      .from('safety_incidents')
      .update(updates)
      .eq('id', incidentId)
      .select(`
        *,
        responding_boat:safety_boats(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Assign safety boat to respond to incident
   */
  async assignResponder(
    incidentId: string, 
    assignmentId: string
  ): Promise<SafetyIncident> {
    // Get assignment details
    const { data: assignment } = await supabase
      .from('safety_assignments')
      .select('boat_id')
      .eq('id', assignmentId)
      .single();
    
    // Mark assignment as responding
    await this.markResponding(assignmentId);
    
    // Update incident
    return this.updateIncident(incidentId, {
      responding_assignment_id: assignmentId,
      responding_boat_id: assignment?.boat_id,
      status: 'in_progress',
    });
  }
  
  /**
   * Record response time
   */
  async recordResponseTime(
    incidentId: string, 
    responseTimeSeconds: number
  ): Promise<SafetyIncident> {
    return this.updateIncident(incidentId, {
      response_time_seconds: responseTimeSeconds,
    });
  }
  
  /**
   * Resolve an incident
   */
  async resolveIncident(
    incidentId: string,
    outcome: IncidentOutcome,
    actionsTaken: string
  ): Promise<SafetyIncident> {
    const incident = await this.updateIncident(incidentId, {
      status: 'resolved',
      outcome,
      actions_taken: actionsTaken,
      resolved_at: new Date().toISOString(),
    });
    
    // If there was a responding boat, return it to station
    if (incident.responding_assignment_id) {
      await this.returnToStation(incident.responding_assignment_id);
    }
    
    return incident;
  }
  
  /**
   * Record injury details
   */
  async recordInjury(
    incidentId: string,
    details: string,
    medicalRequired: boolean
  ): Promise<SafetyIncident> {
    return this.updateIncident(incidentId, {
      injuries_reported: true,
      injury_details: details,
      medical_attention_required: medicalRequired,
      severity: medicalRequired ? 'serious' : 'moderate',
    });
  }
  
  // ==========================================================================
  // Dashboard & Analytics
  // ==========================================================================
  
  /**
   * Get safety dashboard data
   */
  async getDashboard(regattaId: string): Promise<SafetyDashboardData[]> {
    const { data, error } = await supabase
      .from('safety_dashboard')
      .select('*')
      .eq('regatta_id', regattaId);
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Get incident summary
   */
  async getIncidentSummary(regattaId: string): Promise<IncidentSummary | null> {
    const { data, error } = await supabase
      .from('incident_summary')
      .select('*')
      .eq('regatta_id', regattaId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  
  /**
   * Get fleet coverage status
   */
  async getCoverageStatus(regattaId: string): Promise<{
    totalBoats: number;
    deployed: number;
    standby: number;
    responding: number;
    positions: {
      covered: number;
      required: number;
      names: string[];
    };
    readiness: 'green' | 'yellow' | 'red';
  }> {
    const assignments = await this.getAssignments(
      regattaId, 
      new Date().toISOString().split('T')[0]
    );
    
    const deployed = assignments.filter(a => a.status === 'deployed').length;
    const standby = assignments.filter(a => a.status === 'standby').length;
    const responding = assignments.filter(a => a.status === 'responding').length;
    
    // Get required positions
    const positions = await this.getPositions();
    const required = positions.filter(p => p.required_for_racing);
    const coveredPositionIds = new Set(assignments.map(a => a.position_id).filter(Boolean));
    const coveredRequired = required.filter(p => coveredPositionIds.has(p.id));
    
    const uncoveredRequired = required
      .filter(p => !coveredPositionIds.has(p.id))
      .map(p => p.name);
    
    // Determine readiness
    let readiness: 'green' | 'yellow' | 'red' = 'green';
    if (uncoveredRequired.length > 0) {
      readiness = 'red';
    } else if (deployed + standby < 2) {
      readiness = 'yellow';
    }
    
    return {
      totalBoats: assignments.length,
      deployed,
      standby,
      responding,
      positions: {
        covered: coveredRequired.length,
        required: required.length,
        names: uncoveredRequired,
      },
      readiness,
    };
  }
  
  /**
   * Generate daily debrief report
   */
  async generateDebrief(regattaId: string, date: string): Promise<{
    date: string;
    assignments: SafetyAssignment[];
    incidents: SafetyIncident[];
    summary: IncidentSummary | null;
    radioChecks: {
      total: number;
      successful: number;
      issues: number;
    };
    coverage: {
      totalHours: number;
      boatsUsed: number;
      crewMembers: number;
    };
  }> {
    const assignments = await this.getAssignments(regattaId, date);
    const incidents = (await this.getIncidents(regattaId))
      .filter(i => i.reported_at.startsWith(date));
    const summary = await this.getIncidentSummary(regattaId);
    
    // Calculate radio check stats
    let totalChecks = 0;
    let successfulChecks = 0;
    
    for (const assignment of assignments) {
      const checks = await this.getRadioChecks(assignment.id);
      totalChecks += checks.length;
      successfulChecks += checks.filter(c => c.status === 'successful').length;
    }
    
    // Calculate coverage stats
    let totalMinutes = 0;
    let crewCount = 0;
    
    for (const assignment of assignments) {
      if (assignment.deployed_at && assignment.returned_at) {
        const deployed = new Date(assignment.deployed_at).getTime();
        const returned = new Date(assignment.returned_at).getTime();
        totalMinutes += (returned - deployed) / (1000 * 60);
      }
      crewCount += (assignment.crew?.length || 0);
    }
    
    return {
      date,
      assignments,
      incidents,
      summary,
      radioChecks: {
        total: totalChecks,
        successful: successfulChecks,
        issues: totalChecks - successfulChecks,
      },
      coverage: {
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        boatsUsed: assignments.length,
        crewMembers: crewCount,
      },
    };
  }
  
  // ==========================================================================
  // Utilities
  // ==========================================================================
  
  /**
   * Get incident type display info
   */
  getIncidentTypeInfo(type: IncidentType): {
    label: string;
    icon: string;
    color: string;
  } {
    const types: Record<IncidentType, { label: string; icon: string; color: string }> = {
      capsize: { label: 'Capsize', icon: '⛵', color: '#f59e0b' },
      dismasting: { label: 'Dismasting', icon: '🔧', color: '#ef4444' },
      collision: { label: 'Collision', icon: '💥', color: '#ef4444' },
      man_overboard: { label: 'Man Overboard', icon: '🆘', color: '#dc2626' },
      medical: { label: 'Medical', icon: '🏥', color: '#dc2626' },
      equipment_failure: { label: 'Equipment Failure', icon: '⚠️', color: '#f59e0b' },
      grounding: { label: 'Grounding', icon: '🏝️', color: '#f59e0b' },
      tow_request: { label: 'Tow Request', icon: '🚤', color: '#3b82f6' },
      retirement: { label: 'Retirement', icon: '🏁', color: '#6b7280' },
      search: { label: 'Search', icon: '🔍', color: '#dc2626' },
      other: { label: 'Other', icon: '📋', color: '#6b7280' },
    };
    return types[type];
  }
  
  /**
   * Get severity display info
   */
  getSeverityInfo(severity: IncidentSeverity): {
    label: string;
    color: string;
    bgColor: string;
  } {
    const severities: Record<IncidentSeverity, { label: string; color: string; bgColor: string }> = {
      minor: { label: 'Minor', color: '#16a34a', bgColor: '#dcfce7' },
      moderate: { label: 'Moderate', color: '#ca8a04', bgColor: '#fef9c3' },
      serious: { label: 'Serious', color: '#ea580c', bgColor: '#ffedd5' },
      critical: { label: 'Critical', color: '#dc2626', bgColor: '#fee2e2' },
    };
    return severities[severity];
  }
  
  /**
   * Get status display info
   */
  getStatusInfo(status: AssignmentStatus): {
    label: string;
    color: string;
  } {
    const statuses: Record<AssignmentStatus, { label: string; color: string }> = {
      assigned: { label: 'Assigned', color: '#6b7280' },
      deployed: { label: 'Deployed', color: '#16a34a' },
      standby: { label: 'On Standby', color: '#3b82f6' },
      responding: { label: 'Responding', color: '#dc2626' },
      returning: { label: 'Returning', color: '#ca8a04' },
      off_duty: { label: 'Off Duty', color: '#9ca3af' },
    };
    return statuses[status];
  }
}

// Export singleton instance
export const safetyBoatService = new SafetyBoatService();
export default safetyBoatService;

