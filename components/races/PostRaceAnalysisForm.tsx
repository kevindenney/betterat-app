/**
 * Post-Race Analysis Form
 *
 * Multi-step form for structured post-race analysis with BetterAt Playbook framework integration.
 * Works on iOS, Android, and Web (React Native Universal).
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import type {
  RaceAnalysis,
  AnalysisStep,
  AnalysisQuestion,
  PostRaceAnalysisFormProps,
} from '@/types/raceAnalysis';
import type { LearnableEventType, PersonalizedNudge } from '@/types/adaptiveLearning';
import { usePersonalizedNudges } from '@/hooks/useAdaptiveLearning';
import { NudgeList } from '@/components/checklist-tools/NudgeBanner';

// Step to nudge category mapping
// Maps wizard steps to relevant learnable event types
const STEP_NUDGE_MAPPING: Record<string, LearnableEventType[]> = {
  'equipment_planning': ['equipment_issue', 'forgotten_item'],
  'start': ['successful_strategy', 'performance_issue'],
  'upwind': ['venue_learning', 'weather_adaptation', 'performance_issue'],
  'windward_mark': ['venue_learning'],
  'downwind': ['venue_learning', 'successful_strategy', 'weather_adaptation'],
  'rules_protests': [],
  'finish_overall': ['decision_outcome', 'successful_strategy'],
};

// Step definitions with playbook framework hints
const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: 'equipment_planning',
    title: 'Equipment & Planning',
    description: 'How prepared were you for this race?',
    playbook_context:
      '💡 BetterAt Playbook: "Boat handling must be second nature, boat speed second to none, THEN tactics will win races."',
    questions: [
      {
        id: 'equipment_rating',
        type: 'rating',
        label: 'Equipment Setup',
        hint: 'How well was your boat set up for the conditions?',
        required: true,
      },
      {
        id: 'equipment_notes',
        type: 'textarea',
        label: 'Equipment Notes',
        hint: 'What worked? What needs adjustment?',
      },
      {
        id: 'planning_rating',
        type: 'rating',
        label: 'Pre-Race Planning',
        hint: 'How well did you research conditions and strategy?',
        required: true,
      },
      {
        id: 'planning_notes',
        type: 'textarea',
        label: 'Planning Notes',
        hint: 'What would you do differently next time?',
      },
    ],
  },
  {
    id: 'start',
    title: 'Pre-Start & Start',
    description: 'How was your start line execution?',
    questions: [
      {
        id: 'prestart_rating',
        type: 'rating',
        label: 'Pre-Start Execution',
        hint: 'Timing, positioning, clear air assessment',
        required: true,
      },
      {
        id: 'start_position',
        type: 'select',
        label: 'Where did you start?',
        required: true,
        options: [
          { value: 'pin_end', label: 'Pin End' },
          { value: 'middle', label: 'Middle' },
          { value: 'boat_end', label: 'Boat End' },
        ],
      },
      {
        id: 'start_speed',
        type: 'select',
        label: 'Start line speed',
        required: true,
        options: [
          { value: 'full_speed', label: 'Full Speed', playbook_framework_note: '✅ Ideal' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'slow', label: 'Slow' },
        ],
      },
      {
        id: 'start_line_bias',
        type: 'select',
        label: 'Start Line Bias',
        hint: 'Which end was favored?',
        options: [
          { value: 'pin_favored', label: 'Pin Favored' },
          { value: 'square', label: 'Square Line' },
          { value: 'boat_favored', label: 'Boat Favored' },
          { value: 'not_sure', label: 'Not Sure' },
        ],
      },
      {
        id: 'start_strategy',
        type: 'multi-select',
        label: 'Starting Strategy Used',
        options: [
          { value: 'port_tack_approach', label: 'Port Tack Approach' },
          { value: 'barging', label: 'Barging (risky!)' },
          { value: 'mid_line_sag', label: 'Mid-Line Sag' },
          { value: 'time_on_distance', label: 'Time on Distance' },
          { value: 'dip_start', label: 'Dip Start' },
          { value: 'conservative', label: 'Conservative/Safe Start' },
        ],
      },
      {
        id: 'start_notes',
        type: 'textarea',
        label: 'Start Notes',
        hint: 'What happened? Any issues or successes?',
      },
    ],
  },
  {
    id: 'upwind',
    title: 'Upwind Leg',
    description: 'How did you perform sailing to windward?',
    playbook_context:
      '💡 Playbook insight: "10° shift = 25% of boat separation. Small shifts have massive impact!"',
    questions: [
      {
        id: 'upwind_rating',
        type: 'rating',
        label: 'Overall Upwind Performance',
        required: true,
      },
      {
        id: 'upwind_puff_handling',
        type: 'select',
        label: 'How did you handle puffs?',
        hint: '💡 The playbook teaches: "TRIM response, not HELM response"',
        required: true,
        playbook_framework_reference: 'Puff Response Framework',
        options: [
          {
            value: 'traveler',
            label: 'Traveler down/up',
            playbook_framework_note: '✅ Playbook\'s recommendation for moderate keelboats',
          },
          {
            value: 'mainsheet',
            label: 'Mainsheet ease/trim',
            playbook_framework_note: '⚡ Better for hot boats with tall rigs',
          },
          { value: 'feathered', label: 'Feathered (turned toward wind)' },
          { value: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'upwind_shift_awareness',
        type: 'rating',
        label: 'Wind Shift Awareness',
        hint: 'How well did you track and respond to wind shifts?',
        required: true,
        playbook_framework_reference: 'Wind Shift Mathematics',
      },
      {
        id: 'upwind_tactics_used',
        type: 'multi-select',
        label: 'Tactics used in 1-on-1 situations',
        playbook_framework_reference: 'Delayed Tack',
        options: [
          {
            value: 'delayed_tack',
            label: 'Delayed Tack',
            playbook_framework_note: '🏆 Playbook\'s signature move!',
          },
          { value: 'cross_and_cover', label: 'Cross & Cover' },
          { value: 'slam_dunk', label: 'Slam Dunk' },
          { value: 'lee_bow', label: 'Lee Bow' },
          { value: 'tack_on_header', label: 'Tack on Header' },
          { value: 'loose_cover', label: 'Loose Cover' },
        ],
      },
      {
        id: 'upwind_notes',
        type: 'textarea',
        label: 'Upwind Notes',
        hint: 'Key moments, what worked, what didn\'t',
      },
    ],
  },
  {
    id: 'windward_mark',
    title: 'Windward Mark',
    description: 'How was your windward mark rounding?',
    playbook_context: '💡 Playbook insight: "Round on the LIFTED tack to set up downwind leg"',
    questions: [
      {
        id: 'windward_mark_rating',
        type: 'rating',
        label: 'Mark Rounding Quality',
        required: true,
      },
      {
        id: 'windward_mark_approach_tack',
        type: 'select',
        label: 'Which tack did you round on?',
        hint: '💡 The playbook recommends rounding on the LIFTED tack',
        required: true,
        playbook_framework_reference: 'Getting In Phase',
        options: [
          {
            value: 'starboard_lifted',
            label: 'Starboard (Lifted)',
            playbook_framework_note: '✅ Sets up downwind leg',
          },
          { value: 'starboard_headed', label: 'Starboard (Headed)' },
          {
            value: 'port_lifted',
            label: 'Port (Lifted)',
            playbook_framework_note: '✅ Sets up downwind leg',
          },
          { value: 'port_headed', label: 'Port (Headed)' },
          { value: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'windward_mark_notes',
        type: 'textarea',
        label: 'Windward Mark Notes',
      },
    ],
  },
  {
    id: 'downwind',
    title: 'Downwind Leg',
    description: 'How did you sail the run?',
    playbook_context:
      '💡 Playbook insight: "Apparent wind aft WITHOUT stronger = lift → JIBE immediately"',
    questions: [
      {
        id: 'downwind_rating',
        type: 'rating',
        label: 'Overall Downwind Performance',
        required: true,
      },
      {
        id: 'downwind_shift_detection',
        type: 'select',
        label: 'How did you detect shifts downwind?',
        hint: '💡 The playbook teaches apparent wind feel method',
        required: true,
        playbook_framework_reference: 'Downwind Shift Detection',
        options: [
          {
            value: 'apparent_wind',
            label: 'Apparent wind feel',
            playbook_framework_note: '✅ Playbook\'s method!',
          },
          { value: 'compass', label: 'Compass' },
          { value: 'schooled_upwind_boats', label: 'Watched upwind boats' },
          { value: 'didnt_track', label: 'Didn\'t track shifts' },
        ],
      },
      {
        id: 'downwind_jibe_count',
        type: 'number',
        label: 'How many jibes?',
        hint: 'Count all jibes on this leg',
      },
      {
        id: 'downwind_in_phase',
        type: 'boolean',
        label: 'Did you feel "in phase" with shifts?',
        hint: 'Jibing at the right times, gaining on shifts',
      },
      {
        id: 'downwind_notes',
        type: 'textarea',
        label: 'Downwind Notes',
      },
    ],
  },
  {
    id: 'rules_protests',
    title: 'Rules & Protests',
    description: 'Any racing rules incidents?',
    questions: [
      {
        id: 'rules_incidents',
        type: 'boolean',
        label: 'Were you involved in any rules incidents?',
      },
      {
        id: 'rules_incident_types',
        type: 'multi-select',
        label: 'Types of Incidents',
        hint: 'Select all that apply',
        options: [
          { value: 'port_starboard', label: 'Port/Starboard (Rule 10)' },
          { value: 'windward_leeward', label: 'Windward/Leeward (Rule 11)' },
          { value: 'tacking_too_close', label: 'Tacking Too Close (Rule 13)' },
          { value: 'mark_room', label: 'Mark Room (Rule 18)' },
          { value: 'room_to_tack', label: 'Room to Tack (Rule 19/20)' },
          { value: 'obstruction', label: 'Obstruction (Rule 19)' },
          { value: 'ocs', label: 'OCS (On Course Side)' },
          { value: 'propulsion', label: 'Propulsion (Rule 42)' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        id: 'protests_filed',
        type: 'boolean',
        label: 'Did you file a protest?',
      },
      {
        id: 'protests_received',
        type: 'boolean',
        label: 'Was a protest filed against you?',
      },
      {
        id: 'penalty_taken',
        type: 'boolean',
        label: 'Did you take a penalty turn?',
      },
      {
        id: 'rules_questions',
        type: 'textarea',
        label: 'Rules Questions',
        hint: 'Any situations you\'d like to understand better?',
      },
      {
        id: 'rules_notes',
        type: 'textarea',
        label: 'Rules & Protest Notes',
        hint: 'Details about what happened',
      },
    ],
  },
  {
    id: 'finish_overall',
    title: 'Finish & Overall',
    description: 'How did you close out the race?',
    questions: [
      {
        id: 'finish_rating',
        type: 'rating',
        label: 'Finish Execution',
        required: true,
      },
      {
        id: 'finish_notes',
        type: 'textarea',
        label: 'Finish Notes',
      },
      {
        id: 'overall_satisfaction',
        type: 'rating',
        label: 'Overall Performance Satisfaction',
        required: true,
      },
      {
        id: 'key_learnings',
        type: 'text-array',
        label: 'Key Takeaways',
        hint: 'What are your top 3 learnings from this race?',
      },
    ],
  },
];

export function PostRaceAnalysisForm({
  raceId,
  existingAnalysis,
  onComplete,
  onCancel,
  raceEventId,
  venueId,
  conditions,
}: PostRaceAnalysisFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<RaceAnalysis>>(
    existingAnalysis || { race_id: raceId }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch personalized nudges for contextual display
  const { allNudges, isLoading: nudgesLoading, recordDelivery } = usePersonalizedNudges(
    raceEventId || raceId,
    {
      venueId,
      forecast: conditions?.windSpeed && conditions?.windDirection
        ? { windSpeed: conditions.windSpeed, windDirection: conditions.windDirection }
        : undefined,
    }
  );

  const currentStepData = ANALYSIS_STEPS[currentStep];
  const isLastStep = currentStep === ANALYSIS_STEPS.length - 1;
  const progress = ((currentStep + 1) / ANALYSIS_STEPS.length) * 100;

  // Get nudges relevant to current step
  const currentStepNudges = useMemo(() => {
    const relevantCategories = STEP_NUDGE_MAPPING[currentStepData.id] || [];
    if (relevantCategories.length === 0) return [];

    return allNudges
      .filter((n: PersonalizedNudge) => relevantCategories.includes(n.category as LearnableEventType))
      .slice(0, 2); // Max 2 nudges per step to avoid overwhelming
  }, [allNudges, currentStepData.id]);

  /**
   * Validate current step
   */
  const validateStep = (): boolean => {
    const stepErrors: Record<string, string> = {};

    currentStepData.questions.forEach((q) => {
      if (q.required && !formData[q.id]) {
        stepErrors[q.id] = 'This field is required';
      }
    });

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  /**
   * Handle next/submit
   */
  const handleNext = () => {
    if (!validateStep()) return;

    if (isLastStep) {
      // Submit form
      onComplete(formData as RaceAnalysis);
    } else {
      // Go to next step
      setCurrentStep(currentStep + 1);
    }
  };

  /**
   * Handle previous
   */
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Update field value
   */
  const updateField = (key: keyof RaceAnalysis, value: any) => {
    setFormData({ ...formData, [key]: value });
    // Clear error for this field
    if (errors[key]) {
      const { [key]: _, ...rest } = errors;
      setErrors(rest);
    }
  };

  /**
   * Fill with test data (development only)
   * Fills realistic data that triggers Playbook's coaching scenarios
   */
  const fillTestData = () => {
    const testData: Partial<RaceAnalysis> = {
      race_id: raceId,

      // Equipment & Planning
      equipment_rating: 4,
      equipment_notes: 'Boat was fast but traveler was sticky. Need to service before next race.',
      planning_rating: 3,
      planning_notes: 'Should have checked wind forecast more carefully. Surprised by shift pattern.',

      // Pre-Start & Start
      prestart_rating: 4,
      start_position: 'pin_end',
      start_speed: 'full_speed',
      start_line_bias: 'pin_favored',
      start_strategy: ['time_on_distance', 'conservative'],
      start_notes: 'Good start at pin, clear air, accelerated well.',

      // Upwind - Mix of good and needs-improvement responses
      upwind_rating: 3,
      upwind_puff_handling: 'feathered', // ❌ Will trigger Playbook's coaching!
      upwind_shift_awareness: 2, // ❌ Low - high priority coaching
      upwind_tactics_used: ['cross_and_cover', 'tack_on_header'], // ❌ Missing delayed_tack
      upwind_notes: 'Lost distance to fleet on right side. Didn\'t see the shift coming.',

      // Windward Mark
      windward_mark_rating: 3,
      windward_mark_approach_tack: 'starboard_headed', // ❌ Out of phase!
      windward_mark_notes: 'Rounded wide, needed better inside position.',

      // Downwind
      downwind_rating: 3,
      downwind_shift_detection: 'compass', // 🎯 Good but not playbook method
      downwind_jibe_count: 8,
      downwind_in_phase: false, // ❌ Because rounded on headed tack
      downwind_notes: 'Felt like I was jibing reactively instead of proactively.',

      // Rules & Protests
      rules_incidents: false,
      rules_incident_types: [],
      protests_filed: false,
      protests_received: false,
      penalty_taken: false,
      rules_questions: '',
      rules_notes: 'Clean race, no incidents.',

      // Finish & Overall
      finish_rating: 4,
      finish_notes: 'Strong finish, passed two boats in final 100m.',
      overall_satisfaction: 3,
      key_learnings: [
        'Need to use traveler instead of feathering in puffs',
        'Must improve shift awareness - cost me big time',
        'Round windward mark on lifted tack to set up downwind',
      ],
    };

    setFormData(testData);
    setErrors({});
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      {/* Step Info */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.stepNumber}>
            Step {currentStep + 1} of {ANALYSIS_STEPS.length}
          </Text>
          {/* Test Data Button (Development) */}
          {currentStep === 0 && (
            <TouchableOpacity style={styles.testDataButton} onPress={fillTestData}>
              <Text style={styles.testDataButtonText}>🧪 Fill Test Data</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.title}>{currentStepData.title}</Text>
        {currentStepData.description && (
          <Text style={styles.description}>{currentStepData.description}</Text>
        )}
        {currentStepData.playbook_context && (
          <View style={styles.playbookContext}>
            <Text style={styles.playbookContextText}>{currentStepData.playbook_context}</Text>
          </View>
        )}
      </View>

      {/* Questions */}
      <ScrollView style={styles.questionsContainer}>
        {/* Contextual nudges from past races */}
        {currentStepNudges.length > 0 && (
          <View style={styles.nudgeContainer}>
            <NudgeList
              nudges={currentStepNudges}
              title="From Your Past Races"
              channel="checklist"
              onRecordDelivery={async (learnableEventId, channel) => {
                const result = await recordDelivery(learnableEventId, channel);
                return result?.id ?? '';
              }}
              maxVisible={2}
              compact={false}
              showMatchReasons
            />
          </View>
        )}

        {currentStepData.questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            value={formData[question.id]}
            error={errors[question.id]}
            onChange={(value) => updateField(question.id, value)}
          />
        ))}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.secondaryButton} onPress={handlePrevious}>
            <Text style={styles.secondaryButtonText}>Previous</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
          <Text style={styles.primaryButtonText}>
            {isLastStep ? 'Submit & Get Coaching' : 'Next'}
          </Text>
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Question Field Component
 * Renders different input types based on question configuration
 */
function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: AnalysisQuestion;
  value: any;
  error?: string;
  onChange: (value: any) => void;
}) {
  const renderInput = () => {
    switch (question.type) {
      case 'rating':
        return <RatingInput value={value} onChange={onChange} />;

      case 'text':
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={onChange}
            placeholder={question.hint}
          />
        );

      case 'textarea':
        return (
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={value || ''}
            onChangeText={onChange}
            placeholder={question.hint}
            multiline
            numberOfLines={4}
          />
        );

      case 'number':
        return (
          <TextInput
            style={styles.textInput}
            value={value?.toString() || ''}
            onChangeText={(text) => onChange(parseInt(text, 10) || 0)}
            placeholder={question.hint}
            keyboardType="number-pad"
          />
        );

      case 'select':
        return (
          <SelectInput
            options={question.options || []}
            value={value}
            onChange={onChange}
          />
        );

      case 'multi-select':
        return (
          <MultiSelectInput
            options={question.options || []}
            value={value || []}
            onChange={onChange}
          />
        );

      case 'boolean':
        return (
          <BooleanInput
            label={question.label}
            value={value}
            onChange={onChange}
          />
        );

      case 'text-array':
        return (
          <TextArrayInput
            value={value || []}
            onChange={onChange}
            placeholder={question.hint}
            maxItems={3}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.questionContainer}>
      <Text style={styles.questionLabel}>
        {question.label}
        {question.required && <Text style={styles.required}> *</Text>}
      </Text>

      {question.hint && <Text style={styles.hint}>{question.hint}</Text>}

      {question.playbook_framework_reference && (
        <Text style={styles.frameworkBadge}>
          📚 {question.playbook_framework_reference}
        </Text>
      )}

      {renderInput()}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/**
 * Rating Input (1-5 stars)
 */
function RatingInput({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.ratingContainer}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <TouchableOpacity
          key={rating}
          onPress={() => onChange(rating)}
          style={styles.starButton}
        >
          <Text style={styles.star}>{rating <= (value || 0) ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Select Input (single choice)
 */
function SelectInput({
  options,
  value,
  onChange,
}: {
  options: any[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.selectContainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.selectOption,
            value === option.value && styles.selectOptionActive,
          ]}
          onPress={() => onChange(option.value)}
        >
          <Text
            style={[
              styles.selectOptionText,
              value === option.value && styles.selectOptionTextActive,
            ]}
          >
            {option.label}
          </Text>
          {option.playbook_framework_note && (
            <Text style={styles.frameworkNote}>{option.playbook_framework_note}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Multi-Select Input (multiple choices)
 */
function MultiSelectInput({
  options,
  value,
  onChange,
}: {
  options: any[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <View style={styles.selectContainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.selectOption,
            value.includes(option.value) && styles.selectOptionActive,
          ]}
          onPress={() => toggleOption(option.value)}
        >
          <Text
            style={[
              styles.selectOptionText,
              value.includes(option.value) && styles.selectOptionTextActive,
            ]}
          >
            {option.label}
          </Text>
          {option.playbook_framework_note && (
            <Text style={styles.frameworkNote}>{option.playbook_framework_note}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Boolean Input (Yes/No)
 */
function BooleanInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.booleanContainer}>
      <TouchableOpacity
        style={[styles.booleanButton, value === true && styles.booleanButtonActive]}
        onPress={() => onChange(true)}
      >
        <Text
          style={[
            styles.booleanButtonText,
            value === true && styles.booleanButtonTextActive,
          ]}
        >
          Yes
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.booleanButton, value === false && styles.booleanButtonActive]}
        onPress={() => onChange(false)}
      >
        <Text
          style={[
            styles.booleanButtonText,
            value === false && styles.booleanButtonTextActive,
          ]}
        >
          No
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Text Array Input
 * Allows entry of multiple text items (e.g., top 3 learnings)
 */
function TextArrayInput({
  value = [],
  onChange,
  placeholder,
  maxItems = 3,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}) {
  const handleItemChange = (index: number, text: string) => {
    const newValue = [...value];
    newValue[index] = text;
    onChange(newValue);
  };

  const handleAddItem = () => {
    if (value.length < maxItems) {
      onChange([...value, '']);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  // Ensure we always have at least one empty input
  const items = value.length === 0 ? [''] : value;

  return (
    <View style={styles.textArrayContainer}>
      {items.map((item, index) => (
        <View key={index} style={styles.textArrayItem}>
          <TextInput
            style={[styles.textInput, styles.textArrayInput]}
            value={item}
            onChangeText={(text) => handleItemChange(index, text)}
            placeholder={`Learning ${index + 1}${placeholder ? ': ' + placeholder : ''}`}
          />
          {items.length > 1 && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveItem(index)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {value.length < maxItems && (
        <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
          <Text style={styles.addButtonText}>+ Add Learning</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#e0e0e0',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#007AFF',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    color: '#666',
  },
  testDataButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  testDataButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  playbookContext: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  playbookContextText: {
    fontSize: 14,
    color: '#856404',
  },
  questionsContainer: {
    flex: 1,
    padding: 20,
  },
  nudgeContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  frameworkBadge: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 32,
  },
  selectContainer: {
    gap: 8,
  },
  selectOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  selectOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  selectOptionText: {
    fontSize: 16,
    color: '#000',
  },
  selectOptionTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  frameworkNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  booleanContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  booleanButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  booleanButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  booleanButtonText: {
    fontSize: 16,
    color: '#000',
  },
  booleanButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  textArrayContainer: {
    gap: 12,
  },
  textArrayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textArrayInput: {
    flex: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
