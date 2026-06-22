/**
 * Equipment Service
 * Manages boat equipment inventory, templates, and maintenance tracking
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('EquipmentService');

// ============================================================================
// Types
// ============================================================================

export interface BoatEquipment {
  id: string;
  sailor_id: string;
  class_id?: string;
  boat_id: string;
  
  // Identity
  custom_name: string;
  category: string;
  subcategory?: string;
  
  // Manufacturer info
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  
  // Purchase info
  purchase_date?: string;
  purchase_price?: number;
  purchase_location?: string;
  vendor?: string;
  vendor_contact?: string;
  warranty_expiry?: string;
  
  // Lifecycle
  installed_date?: string;
  retired_date?: string;
  retirement_reason?: string;
  expected_lifespan_years?: number;
  expected_lifespan_hours?: number;
  current_hours?: number;
  
  // Status
  status: 'active' | 'backup' | 'retired' | 'sold';
  condition?: string;
  condition_rating?: number;
  replacement_priority?: 'low' | 'medium' | 'high' | 'critical';
  
  // Usage tracking
  total_races_used?: number;
  last_used_date?: string;
  
  // Maintenance
  maintenance_interval_days?: number;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  lubrication_type?: string;
  care_instructions?: string;
  
  // Documentation
  manufacturer_doc_url?: string;
  ai_care_guide?: AICareGuide;
  photos?: string[];
  specifications?: Record<string, any>;
  notes?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined data
  boat?: {
    id: string;
    name: string;
    sail_number?: string;
  };
  boat_class?: {
    id: string;
    name: string;
  };
}

export interface AICareGuide {
  generated_at: string;
  equipment_type: string;
  manufacturer?: string;
  model?: string;
  lubrication_schedule?: LubricationSchedule[];
  inspection_checklist?: string[];
  cleaning_instructions?: string;
  storage_recommendations?: string;
  warning_signs?: string[];
  performance_tips?: string[];
  common_issues?: string[];
}

export interface LubricationSchedule {
  interval: string;
  type: string;
  instructions: string;
  parts?: string[];
}

export interface EquipmentMaintenanceLog {
  id: string;
  equipment_id: string;
  boat_id: string;
  sailor_id: string;
  
  maintenance_date: string;
  maintenance_type: 'inspection' | 'cleaning' | 'lubrication' | 'adjustment' | 'repair' | 'replacement' | 'service' | 'certification' | 'other';
  
  description: string;
  work_performed?: string[];
  parts_replaced?: string[];
  
  performed_by?: string;
  service_provider?: string;
  service_provider_contact?: string;
  
  labor_cost?: number;
  parts_cost?: number;
  total_cost?: number;
  
  notes?: string;
  before_condition?: number;
  after_condition?: number;
  photos?: string[];
  receipts?: string[];
  
  hours_at_service?: number;
  
  next_service_date?: string;
  next_service_notes?: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined
  equipment?: BoatEquipment;
}

export interface EquipmentCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  parent_category?: string;
  sort_order: number;
}

export interface EquipmentTemplate {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  class_id?: string;
  default_manufacturer?: string;
  default_model?: string;
  default_expected_lifespan_years?: number;
  default_expected_lifespan_hours?: number;
  default_maintenance_interval_days?: number;
  default_lubrication_type?: string;
  default_care_instructions?: string;
  ai_care_guide_template?: AICareGuide;
  is_standard: boolean;
  popularity_score: number;
}

export interface EquipmentHealthScore {
  total_equipment: number;
  overdue_maintenance: number;
  due_soon: number;
  poor_condition: number;
  critical_items: number;
  health_score: number;
  race_ready: boolean;
}

export interface CreateEquipmentInput {
  boat_id: string;
  custom_name: string;
  category: string;
  subcategory?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_price?: number;
  vendor?: string;
  warranty_expiry?: string;
  installed_date?: string;
  expected_lifespan_years?: number;
  expected_lifespan_hours?: number;
  maintenance_interval_days?: number;
  lubrication_type?: string;
  care_instructions?: string;
  manufacturer_doc_url?: string;
  condition_rating?: number;
  notes?: string;
  specifications?: Record<string, any>;
}

export interface UpdateEquipmentInput {
  custom_name?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  status?: 'active' | 'backup' | 'retired' | 'sold';
  condition?: string;
  condition_rating?: number;
  replacement_priority?: 'low' | 'medium' | 'high' | 'critical';
  maintenance_interval_days?: number;
  next_maintenance_date?: string;
  lubrication_type?: string;
  care_instructions?: string;
  manufacturer_doc_url?: string;
  ai_care_guide?: AICareGuide;
  current_hours?: number;
  retired_date?: string;
  retirement_reason?: string;
  notes?: string;
  specifications?: Record<string, any>;
  photos?: string[];
}

export interface CreateMaintenanceLogInput {
  equipment_id: string;
  boat_id: string;
  maintenance_date: string;
  maintenance_type: EquipmentMaintenanceLog['maintenance_type'];
  description: string;
  work_performed?: string[];
  parts_replaced?: string[];
  performed_by?: string;
  service_provider?: string;
  labor_cost?: number;
  parts_cost?: number;
  total_cost?: number;
  before_condition?: number;
  after_condition?: number;
  hours_at_service?: number;
  next_service_date?: string;
  next_service_notes?: string;
  notes?: string;
  photos?: string[];
  receipts?: string[];
}

// ============================================================================
// Service Class
// ============================================================================

class EquipmentService {
  // ==========================================================================
  // Equipment CRUD
  // ==========================================================================

  /**
   * Get all equipment for a boat
   */
  async getEquipmentForBoat(boatId: string): Promise<BoatEquipment[]> {
    logger.debug('Getting equipment for boat', { boatId });

    const { data, error } = await supabase
      .from('boat_equipment')
      .select('*')
      .eq('boat_id', boatId)
      .order('category')
      .order('custom_name');

    if (error) {
      // Equipment data may not be available - this is expected for new boats
      logger.debug('Boat equipment not available', { boatId, code: error.code });
      return [];
    }

    return data || [];
  }

  /**
   * Get equipment by category for a boat
   */
  async getEquipmentByCategory(boatId: string, category: string): Promise<BoatEquipment[]> {
    logger.debug('Getting equipment by category', { boatId, category });

    const { data, error } = await supabase
      .from('boat_equipment')
      .select('*')
      .eq('boat_id', boatId)
      .eq('category', category)
      .eq('status', 'active')
      .order('custom_name');

    if (error) {
      logger.error('Error fetching equipment by category', { boatId, category, error });
      throw error;
    }

    return data || [];
  }

  /**
   * Get a single equipment item
   */
  async getEquipment(equipmentId: string): Promise<BoatEquipment | null> {
    const { data, error } = await supabase
      .from('boat_equipment')
      .select(`
        *,
        boat:sailor_boats(id, name, sail_number),
        boat_class:boat_classes(id, name)
      `)
      .eq('id', equipmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Error fetching equipment', { equipmentId, error });
      throw error;
    }

    return data;
  }

  /**
   * Create new equipment
   */
  async createEquipment(input: CreateEquipmentInput): Promise<BoatEquipment> {
    logger.debug('Creating equipment', { input });

    // Get the boat to get sailor_id and class_id
    const { data: boat, error: boatError } = await supabase
      .from('sailor_boats')
      .select('sailor_id, class_id')
      .eq('id', input.boat_id)
      .single();

    if (boatError || !boat) {
      throw new Error('Boat not found');
    }

    // Calculate next maintenance date if interval is set
    let nextMaintenanceDate: string | undefined;
    if (input.maintenance_interval_days) {
      const startDate = input.installed_date ? new Date(input.installed_date) : new Date();
      const nextDate = new Date(startDate);
      nextDate.setDate(nextDate.getDate() + input.maintenance_interval_days);
      nextMaintenanceDate = nextDate.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('boat_equipment')
      .insert({
        ...input,
        sailor_id: boat.sailor_id,
        class_id: boat.class_id,
        status: 'active',
        next_maintenance_date: nextMaintenanceDate,
        current_hours: 0,
      })
      .select(`
        *,
        boat:sailor_boats(id, name, sail_number),
        boat_class:boat_classes(id, name)
      `)
      .single();

    if (error) {
      logger.error('Error creating equipment', { error });
      throw error;
    }

    return data;
  }

  /**
   * Update equipment
   */
  async updateEquipment(equipmentId: string, input: UpdateEquipmentInput): Promise<BoatEquipment> {
    logger.debug('Updating equipment', { equipmentId, input });

    const { data, error } = await supabase
      .from('boat_equipment')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', equipmentId)
      .select(`
        *,
        boat:sailor_boats(id, name, sail_number),
        boat_class:boat_classes(id, name)
      `)
      .single();

    if (error) {
      logger.error('Error updating equipment', { equipmentId, error });
      throw error;
    }

    return data;
  }

  /**
   * Delete equipment
   */
  async deleteEquipment(equipmentId: string): Promise<void> {
    logger.debug('Deleting equipment', { equipmentId });

    const { data, error } = await supabase
      .from('boat_equipment')
      .delete()
      .eq('id', equipmentId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Error deleting equipment', { equipmentId, error });
      throw error;
    }
    if (!data) {
      throw new Error('Equipment not found');
    }
  }

  /**
   * Retire equipment (soft delete)
   */
  async retireEquipment(equipmentId: string, reason?: string): Promise<BoatEquipment> {
    return this.updateEquipment(equipmentId, {
      status: 'retired',
      retired_date: new Date().toISOString().split('T')[0],
      retirement_reason: reason,
    });
  }

  // ==========================================================================
  // Maintenance Logs
  // ==========================================================================

  /**
   * Get maintenance history for equipment
   */
  async getMaintenanceHistory(equipmentId: string): Promise<EquipmentMaintenanceLog[]> {
    const { data, error } = await supabase
      .from('equipment_maintenance_logs')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('maintenance_date', { ascending: false });

    if (error) {
      logger.error('Error fetching maintenance history', { equipmentId, error });
      throw error;
    }

    return data || [];
  }

  /**
   * Get all maintenance logs for a boat
   */
  async getBoatMaintenanceHistory(boatId: string, limit = 50): Promise<EquipmentMaintenanceLog[]> {
    const { data, error } = await supabase
      .from('equipment_maintenance_logs')
      .select(`
        *,
        equipment:boat_equipment(id, custom_name, category, manufacturer, model)
      `)
      .eq('boat_id', boatId)
      .order('maintenance_date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching boat maintenance history', { boatId, error });
      throw error;
    }

    return data || [];
  }

  /**
   * Log maintenance performed on equipment
   */
  async logMaintenance(input: CreateMaintenanceLogInput): Promise<EquipmentMaintenanceLog> {
    logger.debug('Logging maintenance', { input });

    // Get sailor_id from the equipment
    const { data: equipment, error: eqError } = await supabase
      .from('boat_equipment')
      .select('sailor_id')
      .eq('id', input.equipment_id)
      .single();

    if (eqError || !equipment) {
      throw new Error('Equipment not found');
    }

    const { data, error } = await supabase
      .from('equipment_maintenance_logs')
      .insert({
        ...input,
        sailor_id: equipment.sailor_id,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Error logging maintenance', { error });
      throw error;
    }

    // Note: The database trigger will update the equipment's maintenance dates automatically

    return data;
  }

  // ==========================================================================
  // Categories & Templates
  // ==========================================================================

  /**
   * Get all equipment categories
   */
  async getCategories(): Promise<EquipmentCategory[]> {
    const { data, error } = await supabase
      .from('equipment_categories')
      .select('*')
      .order('sort_order');

    if (error) {
      logger.error('Error fetching categories', { error });
      throw error;
    }

    return data || [];
  }

  /**
   * Get equipment templates, optionally filtered by category or class
   */
  async getTemplates(options?: { category?: string; classId?: string }): Promise<EquipmentTemplate[]> {
    let query = supabase
      .from('equipment_templates')
      .select('*')
      .order('popularity_score', { ascending: false })
      .order('name');

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.classId) {
      query = query.or(`class_id.eq.${options.classId},class_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching templates', { options, error });
      throw error;
    }

    return data || [];
  }

  /**
   * Create equipment from a template
   */
  async createFromTemplate(
    templateId: string,
    boatId: string,
    overrides?: Partial<CreateEquipmentInput>
  ): Promise<BoatEquipment> {
    // Get the template
    const { data: template, error: tplError } = await supabase
      .from('equipment_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (tplError || !template) {
      throw new Error('Template not found');
    }

    // Create equipment with template defaults
    return this.createEquipment({
      boat_id: boatId,
      custom_name: overrides?.custom_name || template.name,
      category: template.category,
      subcategory: template.subcategory,
      manufacturer: overrides?.manufacturer || template.default_manufacturer,
      model: overrides?.model || template.default_model,
      expected_lifespan_years: overrides?.expected_lifespan_years || template.default_expected_lifespan_years,
      expected_lifespan_hours: overrides?.expected_lifespan_hours || template.default_expected_lifespan_hours,
      maintenance_interval_days: overrides?.maintenance_interval_days || template.default_maintenance_interval_days,
      lubrication_type: overrides?.lubrication_type || template.default_lubrication_type,
      care_instructions: overrides?.care_instructions || template.default_care_instructions,
      ...overrides,
    });
  }

  // ==========================================================================
  // Health & Analytics
  // ==========================================================================

  /**
   * Get equipment health score for a boat
   */
  async getBoatEquipmentHealth(boatId: string): Promise<EquipmentHealthScore> {
    const { data, error } = await supabase
      .rpc('get_boat_equipment_health', { p_boat_id: boatId })
      .single();

    if (error) {
      // RPC function may not exist yet - return defaults silently
      logger.debug('Equipment health RPC not available', { boatId });
      return {
        total_equipment: 0,
        overdue_maintenance: 0,
        due_soon: 0,
        poor_condition: 0,
        critical_items: 0,
        health_score: 100,
        race_ready: true,
      };
    }

    return data as EquipmentHealthScore;
  }

  /**
   * Get equipment requiring attention for a boat
   */
  async getEquipmentRequiringAttention(boatId: string): Promise<BoatEquipment[]> {
    const { data, error } = await supabase
      .from('equipment_requiring_attention')
      .select('*')
      .eq('boat_id', boatId)
      .order('attention_level');

    if (error) {
      // View may not exist - this is expected, use fallback silently
      logger.debug('equipment_requiring_attention view not available, using fallback', { boatId });
      return this.getEquipmentWithMaintenanceDue(boatId);
    }

    return data || [];
  }

  /**
   * Fallback method for getting equipment with maintenance due
   */
  private async getEquipmentWithMaintenanceDue(boatId: string): Promise<BoatEquipment[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data, error } = await supabase
      .from('boat_equipment')
      .select('*')
      .eq('boat_id', boatId)
      .eq('status', 'active')
      .or(`next_maintenance_date.lte.${thirtyDaysFromNow.toISOString().split('T')[0]},condition_rating.lt.60,replacement_priority.in.(critical,high)`)
      .order('next_maintenance_date');

    if (error) {
      logger.error('Error in fallback maintenance query', { boatId, error });
      return [];
    }

    return data || [];
  }

  /**
   * Get equipment summary by category for a boat
   */
  async getEquipmentSummaryByCategory(boatId: string): Promise<Record<string, { count: number; avgCondition: number }>> {
    const equipment = await this.getEquipmentForBoat(boatId);
    
    const summary: Record<string, { count: number; totalCondition: number; conditionCount: number }> = {};
    
    for (const item of equipment) {
      if (item.status !== 'active') continue;
      
      if (!summary[item.category]) {
        summary[item.category] = { count: 0, totalCondition: 0, conditionCount: 0 };
      }
      
      summary[item.category].count++;
      if (item.condition_rating !== undefined && item.condition_rating !== null) {
        summary[item.category].totalCondition += item.condition_rating;
        summary[item.category].conditionCount++;
      }
    }
    
    // Calculate averages
    const result: Record<string, { count: number; avgCondition: number }> = {};
    for (const [category, data] of Object.entries(summary)) {
      result[category] = {
        count: data.count,
        avgCondition: data.conditionCount > 0 ? Math.round(data.totalCondition / data.conditionCount) : 100,
      };
    }
    
    return result;
  }

  // ==========================================================================
  // AI Care Guide Storage
  // ==========================================================================

  /**
   * Store AI-generated care guide for equipment
   */
  async storeAICareGuide(equipmentId: string, guide: AICareGuide): Promise<BoatEquipment> {
    return this.updateEquipment(equipmentId, {
      ai_care_guide: {
        ...guide,
        generated_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Get equipment context for rig tuning (used by RaceTuningService)
   */
  async getEquipmentContextForTuning(boatId: string): Promise<{
    mast?: BoatEquipment;
    shrouds?: BoatEquipment;
    forestay?: BoatEquipment;
    backstay?: BoatEquipment;
    sails: BoatEquipment[];
    allEquipment: BoatEquipment[];
  }> {
    const equipment = await this.getEquipmentForBoat(boatId);
    const active = equipment.filter(e => e.status === 'active');
    
    return {
      mast: active.find(e => e.category === 'mast'),
      shrouds: active.find(e => e.category === 'shrouds'),
      forestay: active.find(e => e.category === 'forestay'),
      backstay: active.find(e => e.category === 'backstay'),
      sails: active.filter(e => ['mainsail', 'jib', 'genoa', 'spinnaker', 'code_zero'].includes(e.category)),
      allEquipment: active,
    };
  }
}

// Export singleton instance
export const equipmentService = new EquipmentService();
export default equipmentService;
