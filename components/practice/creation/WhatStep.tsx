/**
 * WhatStep Component
 *
 * Step 1 of the 4Q wizard: What are you going to practice?
 * - Select skill areas to focus on
 * - Choose a template OR select individual drills
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Target,
  Clock,
  ChevronRight,
  CheckCircle2,
  Layers,
  Plus,
  GripVertical,
} from 'lucide-react-native';
import { IOS_COLORS } from '@/components/cards/constants';
import {
  SkillArea,
  SKILL_AREA_CONFIG,
  PracticeTemplate,
  Drill,
  WhatStepDrill,
  DRILL_CATEGORY_META,
} from '@/types/practice';
import { useFeaturedTemplates } from '@/hooks/usePracticeTemplates';

interface WhatStepProps {
  focusAreas: SkillArea[];
  drills: WhatStepDrill[];
  selectedTemplate?: PracticeTemplate;
  availableDrills: Drill[];
  estimatedDuration: number;
  onFocusAreasChange: (areas: SkillArea[]) => void;
  onSelectTemplate: (template: PracticeTemplate) => Promise<void>;
  onClearTemplate: () => void;
  onAddDrill: (drill: Drill) => void;
  onRemoveDrill: (drillId: string) => void;
  onOpenCatalog: () => void;
}

const ALL_SKILL_AREAS: SkillArea[] = [
  'start-execution',
  'upwind-execution',
  'downwind-speed',
  'windward-rounding',
  'leeward-rounding',
  'crew-coordination',
  'shift-awareness',
  'prestart-sequence',
  'pre-race-planning',
  'equipment-prep',
  'finish-execution',
];

function SkillAreaChip({
  area,
  isSelected,
  onPress,
}: {
  area: SkillArea;
  isSelected: boolean;
  onPress: () => void;
}) {
  const config = SKILL_AREA_CONFIG[area];
  return (
    <TouchableOpacity
      style={[styles.chip, isSelected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isSelected && <CheckCircle2 size={14} color={'#FFFFFF'} />}
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {config?.label || area}
      </Text>
    </TouchableOpacity>
  );
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: PracticeTemplate;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const categoryMeta = DRILL_CATEGORY_META[template.category];

  return (
    <TouchableOpacity
      style={[styles.templateCard, isSelected && styles.templateCardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.templateHeader}>
        <Layers size={18} color={isSelected ? IOS_COLORS.indigo : IOS_COLORS.gray} />
        <View style={styles.templateInfo}>
          <Text
            style={[styles.templateName, isSelected && styles.templateNameSelected]}
            numberOfLines={1}
          >
            {template.name}
          </Text>
          <Text style={styles.templateMeta}>
            {categoryMeta?.label} · {template.estimatedDurationMinutes} min ·{' '}
            {template.difficulty}
          </Text>
        </View>
        {isSelected && <CheckCircle2 size={20} color={IOS_COLORS.indigo} />}
      </View>
      {template.description && (
        <Text style={styles.templateDescription} numberOfLines={2}>
          {template.description}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function DrillRow({
  drill,
  onRemove,
}: {
  drill: Drill;
  onRemove: () => void;
}) {
  const categoryMeta = DRILL_CATEGORY_META[drill.category];

  return (
    <View style={styles.drillRow}>
      <GripVertical size={16} color={IOS_COLORS.gray4} />
      <View style={styles.drillInfo}>
        <Text style={styles.drillName}>{drill.name}</Text>
        <Text style={styles.drillMeta}>
          {categoryMeta?.label} · {drill.durationMinutes} min
        </Text>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

export function WhatStep({
  focusAreas,
  drills,
  selectedTemplate,
  availableDrills,
  estimatedDuration,
  onFocusAreasChange,
  onSelectTemplate,
  onClearTemplate,
  onRemoveDrill,
  onOpenCatalog,
}: WhatStepProps) {
  const { data: featuredTemplates, isLoading: templatesLoading } = useFeaturedTemplates();
  const [expandedSection, setExpandedSection] = useState<'areas' | 'templates' | 'drills'>(
    'areas'
  );

  const toggleFocusArea = (area: SkillArea) => {
    if (focusAreas.includes(area)) {
      onFocusAreasChange(focusAreas.filter((a) => a !== area));
    } else {
      onFocusAreasChange([...focusAreas, area]);
    }
  };

  const handleSelectTemplate = async (template: PracticeTemplate) => {
    if (selectedTemplate?.id === template.id) {
      onClearTemplate();
    } else {
      await onSelectTemplate(template);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Duration Summary */}
      <View style={styles.durationBar}>
        <Clock size={16} color={IOS_COLORS.indigo} />
        <Text style={styles.durationText}>
          {estimatedDuration > 0
            ? `${estimatedDuration} min total`
            : 'Select drills to estimate duration'}
        </Text>
      </View>

      {/* Focus Areas Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(expandedSection === 'areas' ? 'drills' : 'areas')}
        >
          <Target size={18} color={IOS_COLORS.indigo} />
          <Text style={styles.sectionTitle}>Focus Areas</Text>
          <Text style={styles.sectionCount}>{focusAreas.length} selected</Text>
        </TouchableOpacity>

        <Text style={styles.sectionSubtext}>
          What skill areas do you want to improve?
        </Text>

        <View style={styles.chipsContainer}>
          {ALL_SKILL_AREAS.map((area) => (
            <SkillAreaChip
              key={area}
              area={area}
              isSelected={focusAreas.includes(area)}
              onPress={() => toggleFocusArea(area)}
            />
          ))}
        </View>
      </View>

      {/* Templates Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() =>
            setExpandedSection(expandedSection === 'templates' ? 'drills' : 'templates')
          }
        >
          <Layers size={18} color={IOS_COLORS.indigo} />
          <Text style={styles.sectionTitle}>Practice Templates</Text>
          {selectedTemplate && (
            <Text style={styles.sectionSelected}>1 selected</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionSubtext}>
          Choose a pre-built practice plan, or browse the catalog
        </Text>

        {templatesLoading ? (
          <Text style={styles.loadingText}>Loading templates...</Text>
        ) : (
          <>
            {featuredTemplates?.slice(0, 4).map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplate?.id === template.id}
                onSelect={() => handleSelectTemplate(template)}
              />
            ))}
            <TouchableOpacity style={styles.browseButton} onPress={onOpenCatalog}>
              <Text style={styles.browseText}>Browse full catalog</Text>
              <ChevronRight size={16} color={IOS_COLORS.indigo} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Selected Drills Section */}
      {drills.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Selected Drills</Text>
            <Text style={styles.sectionCount}>{drills.length} drills</Text>
          </View>

          {drills.map((drill) => {
            const fullDrill = availableDrills.find((d) => d.id === drill.drillId);
            if (!fullDrill) return null;
            return (
              <DrillRow
                key={drill.drillId}
                drill={fullDrill}
                onRemove={() => onRemoveDrill(drill.drillId)}
              />
            );
          })}

          <TouchableOpacity style={styles.addDrillButton} onPress={onOpenCatalog}>
            <Plus size={16} color={IOS_COLORS.indigo} />
            <Text style={styles.addDrillText}>Add more drills</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Spacer */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  durationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${IOS_COLORS.indigo}10`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.indigo,
  },
  section: {
    backgroundColor: IOS_COLORS.systemBackground,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  sectionSelected: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.indigo,
  },
  sectionSubtext: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    marginTop: 4,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: IOS_COLORS.gray6,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  chipSelected: {
    backgroundColor: IOS_COLORS.indigo,
    borderColor: IOS_COLORS.indigo,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  templateCard: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  templateCardSelected: {
    backgroundColor: `${IOS_COLORS.indigo}10`,
    borderColor: IOS_COLORS.indigo,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  templateNameSelected: {
    color: IOS_COLORS.indigo,
  },
  templateMeta: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  templateDescription: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 8,
    lineHeight: 18,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 8,
  },
  browseText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.indigo,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  drillInfo: {
    flex: 1,
  },
  drillName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  drillMeta: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  removeText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.red,
  },
  addDrillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  addDrillText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.indigo,
  },
  loadingText: {
    fontSize: 14,
    color: IOS_COLORS.gray,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default WhatStep;
