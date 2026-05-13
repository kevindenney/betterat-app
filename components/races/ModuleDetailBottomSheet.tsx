/**
 * ModuleDetailBottomSheet - AI-Powered Module Learning Workspace
 *
 * Each module tile opens into an experiential learning environment where
 * students actively prepare for their shift/session/workout. Not a static
 * info page — a living workspace that:
 *
 * 1. YOUR PLAN — Student inputs their unique approach, ideas, clinical reasoning
 * 2. AI COACH — Contextual prompts that build on past experience + community knowledge
 * 3. FROM YOUR NETWORK — Insights from preceptors, peers, people they follow
 * 4. YOUR HISTORY — What they documented in past shifts for this module
 *
 * The AI Coach isn't generic advice — it references the student's actual
 * past performance, flags gaps, asks Socratic questions, and surfaces
 * what experienced practitioners in their network have shared.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  PatientOverviewTool,
  MedicationsTool,
  LabValuesTool,
  ProceduresTool,
  CarePlanTool,
  ClinicalObjectivesTool,
  EBPConnectionTool,
  UnitProtocolsTool,
} from './tools/NursingTools';
import {
  ReferenceImagesTool,
  TechniqueFocusTool,
  ColorStudyTool,
  MaterialsTool,
} from './tools/DrawingTools';
import {
  WorkoutPlanTool,
  WarmupTool,
  NutritionTool,
  BodyStatusTool,
} from './tools/FitnessTools';
import {
  ConditionsTool,
  StrategyTool,
  RigSetupTool,
  StartSequenceTool,
} from './tools/SailingTools';
import { DrillableItemsSection, LAB_LESSON_ITEMS, PROTOCOL_LESSON_ITEMS } from './tools/LessonDrillDown';
import { DRAWING_MODULE_CONTENT } from './tools/content/DrawingContent';
import { FITNESS_MODULE_CONTENT } from './tools/content/FitnessContent';
import { SAILING_MODULE_CONTENT } from './tools/content/SailingContent';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { X } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { useModuleArtifact } from '@/hooks/useModuleArtifact';
import { getModuleArtifact } from '@/services/moduleArtifactService';
import type { ModuleArtifactEventType } from '@/services/moduleArtifactService';
import { NURSING_COMPETENCY_CANDIDATES_V1 } from '@/configs/competency-candidates';
import { NURSING_CORE_V1_CAPABILITIES, type NursingCoreV1Capability } from '@/configs/competencies/nursing-core-v1';
import { logUnvalidatedArtifactAttempts } from '@/services/competencyService';
import { evaluateClinicalReasoning, type ClinicalReasoningEvaluationResult } from '@/services/ai/ClinicalReasoningEvaluationService';
import { supabase } from '@/services/supabase';
import type { InterestEventConfig } from '@/types/interestEventConfig';
import { isUuid } from '@/utils/uuid';

// =============================================================================
// COLORS
// =============================================================================

const C = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  purple: '#AF52DE',
  indigo: '#5856D6',
  teal: '#0D9488',
  pink: '#FF2D55',
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  bg: '#FFFFFF',
  coachBg: '#FFF8E1',    // warm AI coach
  coachBorder: '#FFE082',
  networkBg: '#E8F5E9',
  networkBorder: '#A5D6A7',
  historyBg: '#E3F2FD',
  historyBorder: '#90CAF9',
  warnBg: '#FFF3E0',
  warnBorder: '#FFCC80',
};

// Module accent colors
const MODULE_COLORS: Record<string, string> = {
  patient_overview: C.blue,
  medications: C.orange,
  procedures: C.indigo,
  clinical_objectives: C.pink,
  checklist: C.teal,
  lab_values: C.green,
  care_plan: C.purple,
  unit_protocols: C.red,
  preceptor_goals: C.blue,
  drug_reference: C.orange,
  share_with_preceptor: C.indigo,
  competency_log: C.pink,
  learning_notes: C.teal,
  preceptor_feedback: C.green,
  clinical_hours: C.purple,
  time_log: C.red,
  // Plan modules (What/Why/Who/How)
  plan_what: C.blue,
  plan_why: C.orange,
  plan_who: C.purple,
  plan_how: C.teal,
  // Media modules
  progress_photos: C.green,
  voice_memo: C.red,
  video_capture: C.indigo,
  text_notes: C.pink,
  // Reflection modules
  gibbs_reflection: C.purple,
  clinical_reasoning: C.blue,
  self_assessment: C.teal,
};

// Icon mapping (mirrors ConfigDrivenPhaseContent)
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'checkbox-marked-outline': LucideIcons.ListChecks,
  'lightbulb-outline': LucideIcons.Lightbulb,
  'share-variant': LucideIcons.Share2,
  'message-text': LucideIcons.MessageSquare,
  'clock-outline': LucideIcons.Clock,
  'clipboard-text': LucideIcons.ClipboardList,
  people: LucideIcons.Users,
  medkit: LucideIcons.Heart,
  bandage: LucideIcons.Activity,
  ribbon: LucideIcons.Award,
  flask: LucideIcons.FlaskConical,
  'shield-check': LucideIcons.ShieldCheck,
  school: LucideIcons.GraduationCap,
  pill: LucideIcons.Pill,
  trophy: LucideIcons.Trophy,
  timer: LucideIcons.Timer,
  time: LucideIcons.Clock,
  images: LucideIcons.Image,
  grid: LucideIcons.Grid3x3,
  'color-wand': LucideIcons.Wand2,
  construct: LucideIcons.Hammer,
  'color-palette': LucideIcons.Palette,
  contrast: LucideIcons.Contrast,
  person: LucideIcons.User,
  stopwatch: LucideIcons.Timer,
  camera: LucideIcons.Camera,
  bookmark: LucideIcons.Bookmark,
  flash: LucideIcons.Zap,
  restaurant: LucideIcons.UtensilsCrossed,
  body: LucideIcons.User,
  calendar: LucideIcons.Calendar,
  settings: LucideIcons.Settings,
  'heart-pulse': LucideIcons.HeartPulse,
  // Plan modules (What/Why/Who/How)
  'help-circle-outline': LucideIcons.HelpCircle,
  'bulb-outline': LucideIcons.Lightbulb,
  'people-outline': LucideIcons.Users,
  'map-outline': LucideIcons.Map,
  // Media modules
  mic: LucideIcons.Mic,
  videocam: LucideIcons.Video,
  create: LucideIcons.Pencil,
  // Reflection modules
  'sync-circle': LucideIcons.RefreshCw,
  'git-network': LucideIcons.GitBranch,
  library: LucideIcons.BookOpen,
  analytics: LucideIcons.BarChart3,
};

function resolveIcon(name: string): React.ComponentType<any> {
  return ICON_MAP[name] || LucideIcons.CircleDot;
}

// =============================================================================
// TOOL REGISTRY — maps tool id → component. Avoids long ternary chains.
// All tool components share ToolProps: { values, onChange, accent }
// =============================================================================

type ToolComponent = React.ComponentType<{
  values: Record<string, string>;
  onChange: (stepId: string, text: string) => void;
  accent: string;
}>;

const TOOL_REGISTRY: Record<string, ToolComponent> = {
  // Nursing (inline tools defined below)
  // These are added dynamically after their definitions — see addInlineTools()

  // Nursing (imported)
  patient_overview: PatientOverviewTool,
  medications: MedicationsTool,
  lab_values: LabValuesTool,
  procedures: ProceduresTool,
  care_plan: CarePlanTool,
  clinical_objectives: ClinicalObjectivesTool,
  ebp_connection: EBPConnectionTool,
  unit_protocols: UnitProtocolsTool,

  // Drawing
  reference_images: ReferenceImagesTool,
  technique_focus: TechniqueFocusTool,
  color_study: ColorStudyTool,
  materials: MaterialsTool,

  // Fitness
  workout_plan: WorkoutPlanTool,
  warmup: WarmupTool,
  nutrition: NutritionTool,
  body_status: BodyStatusTool,

  // Sailing
  conditions: ConditionsTool,
  strategy: StrategyTool,
  rig_setup: RigSetupTool,
  start_sequence: StartSequenceTool,
};

// =============================================================================
// MODULE-SPECIFIC CONTENT DATA
// =============================================================================

interface ModuleContent {
  /** Prompt that appears in the notes placeholder */
  notesPrompt: string;
  /** AI Coach insight — Socratic, builds on past experience */
  aiCoach: { title: string; body: string; question: string };
  /** From Your Network — what peers/preceptor have shared */
  network: { name: string; role: string; tip: string }[];
  /** Your History — past module entries summary */
  history: { summary: string; detail: string };
  /** Optional: structured items to display (checklists, med lists, etc.) */
  items?: { label: string; detail: string; status?: 'alert' | 'ok' | 'info' }[];
  /** Optional: drillable lesson items (replaces static items with interactive lessons) */
  drillableItems?: boolean;
  /** Optional: alert or safety callout */
  alert?: { title: string; body: string };
  /** Enable rich content toolbar (photos, videos, documents, links, ideas) */
  richContent?: boolean;
  /** Render as an interactive guided tool instead of a free-form text area */
  tool?: string;
}

/**
 * Demo content for each nursing module. In production, this would come from
 * the student's actual data, AI analysis of their history, and their
 * social network's shared insights.
 */
const MODULE_CONTENT: Record<string, ModuleContent> = {
  patient_overview: {
    tool: 'patient_overview',
    notesPrompt: 'What do you already know about your patients? What questions will you ask during handoff? What are you watching for today?',
    aiCoach: {
      title: 'Build Your Patient Mental Model',
      body: 'Before you walk onto the floor, picture each patient. What\'s their story? A 72-year-old admitted for CHF exacerbation is different from a 72-year-old post-op hip replacement — even if they\'re in the same room. Your last shift, you identified early fluid overload signs before the RN did. That clinical eye is developing.',
      question: 'For each patient today: What\'s the ONE thing that could go wrong, and how would you catch it early?',
    },
    network: [
      { name: 'Emma R.', role: '3rd year BSN', tip: 'I review the H&P the night before so I can ask smarter questions during handoff. It changes everything — you go from passive to driving the conversation.' },
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'Look at the patient before you look at the chart. Your eyes and gut tell you things the numbers don\'t. Then validate with data.' },
    ],
    history: {
      summary: '3 shifts documented \u2022 Avg 2.3 patients/shift',
      detail: 'Last shift: 3 patients on med-surg. You noted early tachycardia in Pt 2 that preceded a fever spike. Preceptor commended your assessment timing.',
    },
  },

  medications: {
    tool: 'medications',
    notesPrompt: 'List your patients\' key meds. Any high-alerts? Interactions you want to double-check? What\'s your administration plan and timing?',
    aiCoach: {
      title: 'Think Like a Pharmacist',
      body: 'Don\'t just memorize the med list — understand WHY each medication is ordered. If your patient is on both Metoprolol and Lisinopril, what are you monitoring? Your last shift you caught an insulin sliding scale question before administration — that\'s exactly the kind of critical thinking that prevents errors.',
      question: 'Which medication on today\'s list are you least confident about? Look it up now, before you\'re at the bedside under pressure.',
    },
    network: [
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'Always check the MAR against the patient\'s allergy band. I\'ve caught near-misses this way. It takes 3 seconds and could save a life.' },
      { name: 'Marcus T.', role: 'BSN, ICU fellow', tip: 'For IV push meds, I say the 6 Rights out loud — quietly, to myself. It sounds silly but it catches the error your brain glosses over.' },
    ],
    history: {
      summary: '12 meds administered last shift \u2022 0 errors \u2022 1 near-miss caught',
      detail: 'You flagged a warfarin-aspirin interaction question and confirmed with the pharmacist. The attending adjusted the order. Strong catch.',
    },
    alert: {
      title: 'High-Alert Medications',
      body: 'If your patients are on heparin, insulin, or opioids — these require independent double-verification before administration. Build this into your timing plan.',
    },
  },

  lab_values: {
    tool: 'lab_values',
    notesPrompt: 'What labs are you expecting today? What would abnormal values mean for your patients? What trends are you tracking?',
    aiCoach: {
      title: 'Read the Story in the Numbers',
      body: 'Labs aren\'t isolated data points — they tell a clinical story. A rising BUN with stable creatinine suggests dehydration, not renal failure. A trending WBC matters more than a single value. Last shift you correctly identified that trending hemoglobin drop as significant.',
      question: 'For your CHF patient: What\'s the BNP trend over the last 3 days? What would a rising BNP tell you alongside their daily weights?',
    },
    network: [
      { name: 'Marcus T.', role: 'BSN, ICU fellow', tip: 'I chart critical values on a simple timeline in my brain sheet. Pattern recognition beats memorizing numbers every time.' },
      { name: 'Dr. Chen', role: 'Attending', tip: 'When you call me about a lab value, tell me the trend, not just the number. "Potassium dropped from 4.1 to 3.2 over 6 hours" is actionable. "Potassium is 3.2" isn\'t.' },
    ],
    history: {
      summary: 'Tracked labs for 8 patients across 3 shifts',
      detail: 'You\'re getting stronger at correlating lab values with clinical presentation. Last shift you connected the dots between low albumin and wound healing delay.',
    },
    drillableItems: true,
  },

  procedures: {
    tool: 'procedures',
    notesPrompt: 'What procedures do you expect today? What\'s your approach for each? Where do you need help vs. where are you confident?',
    aiCoach: {
      title: 'Visualize Before You Do',
      body: 'Elite performers in every field mentally rehearse before executing. Walk through each procedure in your mind: gather supplies, verify the order, explain to the patient, position, perform, document. Your IV insertion success rate is improving — last 3 attempts were all first-stick.',
      question: 'Which procedure today pushes your comfort zone? What specific step feels uncertain? Address that gap now, not at the bedside.',
    },
    network: [
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'Talk through the procedure with the patient before you start. It calms both of you. And if you\'re not sure about something, say "Let me verify that" — never guess.' },
      { name: 'Amy K.', role: '4th year BSN', tip: 'I keep a pocket card with the critical steps for procedures I\'m still learning. No shame in checking your reference mid-task.' },
    ],
    history: {
      summary: '7 procedures performed \u2022 IV insertion: 3/4 success \u2022 Wound care: confident',
      detail: 'Your IV insertion technique has improved significantly. Preceptor noted better site selection on last attempt. Foley catheter still needs supervised practice.',
    },
  },

  clinical_objectives: {
    tool: 'clinical_objectives',
    notesPrompt: 'What are you focused on learning today? What competency are you working toward? What would make this shift a success for your development?',
    aiCoach: {
      title: 'Intentional Practice > Passive Hours',
      body: 'A shift without learning objectives is just putting in time. The students who grow fastest set one specific goal before each shift and ruthlessly pursue it. You need 5 more successful IV insertions for competency — today\'s shift has 2 patients with IV access needs.',
      question: 'What\'s your ONE stretch goal today — the thing that pushes just past your comfort zone?',
    },
    network: [
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'Tell me your goals at the start of the shift. I\'ll create opportunities for you. But if you don\'t tell me, I can\'t help you get there.' },
      { name: 'Program Director', role: 'Faculty', tip: 'Link each shift goal to your course competencies. When portfolio review comes, you\'ll have documented evidence of intentional growth.' },
    ],
    history: {
      summary: '4 shifts with documented objectives \u2022 78% goals met',
      detail: 'Pattern: You consistently meet assessment and communication goals. Time management goals are where you struggle. Consider making that today\'s focus.',
    },
  },

  checklist: {
    notesPrompt: 'Anything unusual to prepare today? Special equipment? Access badges? Clinical tools you need to bring?',
    aiCoach: {
      title: 'The Boring Stuff Matters Most',
      body: 'Forgetting your stethoscope isn\'t just inconvenient — it interrupts your clinical flow and costs you 10 minutes of learning time. The best nurses have a pre-shift ritual that\'s automatic. Build yours.',
      question: 'Do you have everything you need right now, or do you need to stop somewhere on the way in?',
    },
    network: [
      { name: 'Sarah M.', role: '2nd year BSN', tip: 'I pack my bag the night before. Stethoscope, penlight, hemostats, drug guide, brain sheet template, black pens x3, and snacks. Always snacks.' },
    ],
    history: {
      summary: 'Checklist completion: 100% last 3 shifts',
      detail: 'No missed items recently. You\'ve built a solid pre-shift routine.',
    },
    items: [
      { label: 'Stethoscope', detail: 'Functioning, clean', status: 'ok' },
      { label: 'Badge & access card', detail: 'Unit access verified', status: 'ok' },
      { label: 'Drug reference', detail: 'App or pocket guide', status: 'ok' },
      { label: 'Brain sheet', detail: 'Printed template for today', status: 'info' },
      { label: 'PPE check', detail: 'Know isolation precautions for your patients', status: 'alert' },
    ],
  },

  care_plan: {
    tool: 'care_plan',
    notesPrompt: 'Draft your nursing care plan here. What are the priority nursing diagnoses? What interventions will you implement? What outcomes are you targeting?',
    aiCoach: {
      title: 'Think in Diagnoses, Not Tasks',
      body: 'A care plan isn\'t a to-do list — it\'s your clinical reasoning made visible. Start with the patient\'s primary problem, identify the nursing diagnosis, plan your interventions, and define how you\'ll measure success. For a CHF patient: "Excess Fluid Volume r/t compromised regulatory mechanism AEB peripheral edema and weight gain."',
      question: 'For your highest-acuity patient: What\'s the priority nursing diagnosis, and what\'s your first intervention?',
    },
    network: [
      { name: 'Study Group', role: 'Peer cohort', tip: 'Use NANDA-I format and link each intervention to a measurable outcome. Faculty loves seeing evidence-based rationale.' },
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'The best care plans are living documents. Update them during the shift as you learn more about the patient.' },
    ],
    history: {
      summary: '3 care plans documented \u2022 Improving structure',
      detail: 'Last care plan received positive feedback on intervention specificity. Work on connecting outcomes to measurable criteria.',
    },
  },

  unit_protocols: {
    tool: 'unit_protocols',
    drillableItems: true,
    notesPrompt: 'What unit-specific protocols should you review? Any isolation patients? Code team responsibilities? Fall risk protocols for your patients?',
    aiCoach: {
      title: 'Know the Rules Before You Break Stride',
      body: 'Every unit has its own rhythm and rules. Knowing the protocol means you can act fast when it matters. You\'re on med-surg today — review the rapid response criteria, fall risk assessment schedule, and isolation precaution types for your patients.',
      question: 'If your patient\'s condition deteriorated right now, do you know the exact chain of communication on this unit?',
    },
    network: [
      { name: 'Charge Nurse', role: 'Unit staff', tip: 'Don\'t hesitate to ask about unit-specific protocols. I\'d rather explain it twice than manage the fallout of someone guessing.' },
    ],
    history: {
      summary: '2 units experienced \u2022 Med-surg, ICU observation',
      detail: 'You\'re familiar with med-surg flow. If assigned to a new unit, request a brief orientation from the charge nurse before taking patients.',
    },
  },

  preceptor_goals: {
    notesPrompt: 'What has your preceptor been emphasizing? What feedback themes keep coming up? What do they want you to focus on this shift?',
    aiCoach: {
      title: 'Your Preceptor Is Your Accelerator',
      body: 'The students who grow fastest are the ones who actively seek and act on preceptor feedback — not just hear it, but implement it the very next shift. Lisa has consistently praised your assessment skills but flagged time management. Today, show her you heard that.',
      question: 'What ONE piece of feedback from your last shift will you deliberately practice today?',
    },
    network: [
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'I want to see you prioritize independently today. Before you ask me what to do next, decide what YOU think should happen next, then tell me your reasoning.' },
    ],
    history: {
      summary: 'Consistent preceptor \u2022 5 shifts together',
      detail: 'Feedback pattern: Strong on assessment, communication. Growth area: Time management, prioritization under pressure.',
    },
  },

  drug_reference: {
    notesPrompt: 'Which medications are you unfamiliar with today? Look them up now — mechanism, dose range, side effects, nursing considerations.',
    aiCoach: {
      title: 'Know It Before You Give It',
      body: 'You should never administer a medication you can\'t explain to the patient in plain language. If you don\'t know what it does, how it works, and what to watch for — that\'s your signal to stop and look it up. Not a weakness. A safety behavior.',
      question: 'Which med on today\'s list would you struggle to explain to a patient? That\'s the one to research right now.',
    },
    network: [
      { name: 'Marcus T.', role: 'BSN, ICU fellow', tip: 'I use the "teach-back to myself" method. If I can explain the med, dose, route, and 3 nursing considerations from memory, I\'m ready to give it.' },
    ],
    history: {
      summary: 'Drug classes studied: cardiac, diabetic, pain management',
      detail: 'You\'re solid on cardiac meds and insulin protocols. Flagged uncertainty with anticoagulant dosing calculations last shift.',
    },
  },

  share_with_preceptor: {
    notesPrompt: 'Summarize your pre-shift preparation here. What\'s your plan? What questions do you have? What do you want to practice today?',
    aiCoach: {
      title: 'Come Prepared, Leave Impressed',
      body: 'Sharing your prep plan with your preceptor before the shift signals competence and initiative. It transforms you from "student who needs direction" to "clinician who has a plan." Lisa will adjust her teaching to match your preparation level.',
      question: 'What\'s the most important thing you want your preceptor to know about your readiness today?',
    },
    network: [
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'When a student shows up with a plan, I can teach at a higher level. I stop explaining basics and start teaching clinical judgment. That\'s where the real learning happens.' },
    ],
    history: {
      summary: 'Shared prep plan 3 of last 5 shifts',
      detail: 'When you shared your plan, preceptor feedback was more specific and advanced. The correlation is clear — preparation earns better teaching.',
    },
  },

  // ---- REVIEW PHASE modules ----

  competency_log: {
    notesPrompt: 'What skills did you perform today? How many attempts? How confident did you feel? What would you do differently?',
    aiCoach: {
      title: 'Track Your Growth, Not Just Your Hours',
      body: 'Competency isn\'t about doing a skill once — it\'s about doing it consistently, safely, and with increasing independence. Logging each attempt with honest self-assessment accelerates your growth. You\'re 3 successful IV insertions away from program competency.',
      question: 'For each skill today: Were you supervised, assisted, or independent? What level do you want to reach by next shift?',
    },
    network: [
      { name: 'Amy K.', role: '4th year BSN', tip: 'I rate myself honestly on every attempt: 1 = needed full guidance, 5 = could teach it. The jump from 3 to 4 is where real confidence lives.' },
    ],
    history: {
      summary: '23 skills logged \u2022 IV: 3/5 proficiency \u2022 Assessment: 4/5',
      detail: 'Strongest: Head-to-toe assessment, vital signs. Developing: IV insertion, foley catheter. Next milestone: Independent IV insertion.',
    },
  },

  learning_notes: {
    tool: 'learning_notes',
    notesPrompt: '',
    aiCoach: {
      title: 'Reflection Is Where Learning Solidifies',
      body: 'The shift is over, but the learning isn\'t. The students who reflect within 30 minutes of a shift retain 3x more than those who wait. Write what you felt, not just what you did. The emotional texture of a clinical moment is what makes it stick.',
      question: 'What was your strongest clinical reasoning moment today? And what was the moment you felt most uncertain?',
    },
    network: [
      { name: 'Emma R.', role: '3rd year BSN', tip: 'I write one "I was wrong about..." per shift. It\'s uncomfortable but it\'s my biggest growth tool.' },
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'Write your notes before you debrief with me. Your raw reflection is more honest than what you\'ll say after hearing my feedback.' },
    ],
    history: {
      summary: '4 reflections documented \u2022 Avg 200 words',
      detail: 'Your reflections are getting more specific. Early ones were "good shift, learned a lot." Recent ones connect specific moments to clinical reasoning development.',
    },
  },

  preceptor_feedback: {
    notesPrompt: 'Capture your preceptor\'s verbal feedback right now, while it\'s fresh. What did they say went well? What should you work on? Any specific advice?',
    aiCoach: {
      title: 'Feedback Is a Gift — Unwrap It Carefully',
      body: 'Verbal feedback disappears if you don\'t capture it. Write down what your preceptor said — their exact words if possible. Then, identify the pattern: What themes keep coming up across shifts? That\'s where your focused growth work should be.',
      question: 'Is there a theme in the feedback you\'ve received across your last 3 shifts? What is it telling you?',
    },
    network: [
      { name: 'Program Director', role: 'Faculty', tip: 'Document preceptor feedback after every shift. During your final evaluation, you\'ll have a portfolio of growth evidence that speaks for itself.' },
    ],
    history: {
      summary: '4 feedback entries \u2022 Consistent themes identified',
      detail: 'Recurring praise: Assessment thoroughness, patient rapport. Recurring growth area: Speed of task completion, delegation confidence.',
    },
  },

  clinical_hours: {
    notesPrompt: 'Log your clinical hours. Start time, end time, any breaks. Note the unit and preceptor for your records.',
    aiCoach: {
      title: 'Every Hour Counts — Literally',
      body: 'Your program requires documented clinical hours for licensure. Log them immediately — retroactive hour logging is the #1 source of portfolio stress at end of term. You\'re on track for your hour requirements this semester.',
      question: 'Are your hours logged in your program\'s official system as well as here?',
    },
    network: [
      { name: 'Sarah M.', role: '2nd year BSN', tip: 'I log hours the second I get to my car. If I wait until I get home, I forget the exact times and it becomes a headache.' },
    ],
    history: {
      summary: '48 clinical hours logged \u2022 On track for 120 required',
      detail: 'Consistent logging. You\'re 40% through your clinical hour requirement with 60% of the semester remaining. Ahead of schedule.',
    },
  },

  time_log: {
    notesPrompt: 'Track your time during the shift. What took longer than expected? Where did you lose time? What could you batch more efficiently?',
    aiCoach: {
      title: 'Time Awareness Builds Clinical Flow',
      body: 'Understanding where your time goes is the first step to managing it. Experienced nurses seem to "float" through their tasks because they\'ve internalized efficient patterns. You\'re building those patterns now.',
      question: 'What\'s taking you the longest right now? Is it the task itself, or finding supplies and navigating the system?',
    },
    network: [
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'Cluster your care. If you\'re going into a room for vitals, what else can you do while you\'re there? Meds due? Assessment? Education? Think in bundles.' },
    ],
    history: {
      summary: 'Time logged for 2 shifts \u2022 Improving efficiency',
      detail: 'Last shift: Medication passes took 45 min (down from 60 min on first shift). Documentation still a bottleneck at 20 min per patient.',
    },
  },

  // ===========================================================================
  // PLAN MODULES (What / Why / Who / How) — Rich content enabled
  // ===========================================================================

  plan_what: {
    notesPrompt: 'Describe what you\'re planning to do. What activity, task, skill, or experience are you working on? Add photos, documents, links, or anything that helps capture your plan.',
    richContent: true,
    aiCoach: {
      title: 'Define Your "What" Clearly',
      body: 'The clearer you define what you\'re doing, the more focused your preparation becomes. Think beyond just the task name \u2014 what does success look like? What are the key steps? Attach reference materials, photos of the workspace, links to protocols, or documents you\'ll need.',
      question: 'Can you describe this activity in one sentence to someone who\'s never done it? That clarity will guide everything else.',
    },
    network: [
      { name: 'Your peers', role: 'Community', tip: 'Share what you\'re working on and discover who else is tackling similar activities. Collaboration starts with visibility.' },
    ],
    history: {
      summary: 'No previous entries yet',
      detail: 'Your past activities and plans will appear here, helping you build on previous experience and track your growth.',
    },
  },

  plan_why: {
    notesPrompt: 'Why are you doing this? What are your learning objectives, goals, or motivations? Add links to standards, competency frameworks, or any resources that define the "why."',
    richContent: true,
    aiCoach: {
      title: 'Connect Purpose to Practice',
      body: 'Understanding your "why" transforms routine tasks into intentional learning. Are you building a new competency? Deepening an existing skill? Preparing for an assessment? Link to course objectives, competency frameworks, or personal goals that drive this activity.',
      question: 'If you could only achieve one thing from this activity, what would make the biggest difference in your development?',
    },
    network: [
      { name: 'Your mentors', role: 'Faculty & preceptors', tip: 'Your mentors can help align your goals with program competencies. Share your "why" and get feedback on whether your objectives are hitting the right level.' },
    ],
    history: {
      summary: 'No previous entries yet',
      detail: 'As you document your learning objectives across activities, patterns will emerge showing your growth trajectory and focus areas.',
    },
  },

  plan_who: {
    notesPrompt: 'Who is involved? Patients, clients, team members, preceptors, peers, mentors? Add photos, contact cards, or notes about the people involved.',
    richContent: true,
    aiCoach: {
      title: 'People Are the Context',
      body: 'Every activity happens within a web of relationships. Knowing who you\'re working with \u2014 their experience level, their expectations, their needs \u2014 changes how you prepare. A procedure with a nervous first-time patient is different from one with a veteran who\'s done it ten times.',
      question: 'Who is the one person whose input would most improve your plan? Have you connected with them yet?',
    },
    network: [
      { name: 'Your team', role: 'Collaborators', tip: 'Tag team members so they can see your plan and contribute their expertise. Learning is better together.' },
    ],
    history: {
      summary: 'No previous entries yet',
      detail: 'Your collaboration history will appear here \u2014 who you\'ve worked with, in what contexts, and what you learned from each person.',
    },
  },

  plan_how: {
    notesPrompt: 'How will you approach this? What resources, tools, techniques, or methods will you use? Add links to guidelines, upload reference documents, or attach photos of your setup.',
    richContent: true,
    aiCoach: {
      title: 'Your Approach Is Your Strategy',
      body: 'The "how" is where preparation meets execution. Think about the resources you\'ll need, the sequence of steps, any tools or equipment, and potential obstacles. Upload checklists, link to procedure videos, attach guidelines \u2014 build a reference kit you can review right before you begin.',
      question: 'What\'s the step you\'re least confident about? That\'s where extra preparation pays off the most.',
    },
    network: [
      { name: 'Your community', role: 'Practitioners', tip: 'Experienced practitioners often have approaches and shortcuts that aren\'t in the textbook. Follow them to see how they tackle similar activities.' },
    ],
    history: {
      summary: 'No previous entries yet',
      detail: 'Your approach history will appear here, showing how your methods evolve and improve across activities.',
    },
  },

  // ===========================================================================
  // MEDIA / CAPTURE MODULES
  // ===========================================================================

  progress_photos: {
    notesPrompt: 'Capture photos during your activity. Document your workspace, procedures, patient interactions (with consent), or anything worth reviewing later.',
    richContent: true,
    aiCoach: {
      title: 'Visual Documentation Builds Recall',
      body: 'Photos captured in the moment carry context that written notes can\'t. A photo of your setup, your wound assessment, or your team\'s whiteboard becomes a powerful study tool when you review it later.',
      question: 'What moment during this activity would be most valuable to capture visually for later reflection?',
    },
    network: [
      { name: 'Your peers', role: 'Community', tip: 'Shared photos (with appropriate consent and de-identification) help the whole cohort learn from each other\'s experiences.' },
    ],
    history: {
      summary: 'No photos yet',
      detail: 'Your photo timeline will appear here, creating a visual record of your clinical journey.',
    },
  },

  voice_memo: {
    notesPrompt: 'Record voice memos during or after your activity. Capture quick reflections, observations, or notes when you can\'t type.',
    aiCoach: {
      title: 'Speak Your Thoughts',
      body: 'Voice memos are perfect for capturing raw, unfiltered reflections in the moment. The emotion and nuance in your voice often reveals insights that get lost when you write them down later.',
      question: 'What just happened that you want to remember? Hit record and talk it through.',
    },
    network: [
      { name: 'Your peers', role: 'Community', tip: 'Some students share anonymized voice reflections as a study tool. Hearing someone else\'s clinical reasoning process is uniquely valuable.' },
    ],
    history: {
      summary: 'No voice memos yet',
      detail: 'Your voice memo timeline will appear here.',
    },
  },

  text_notes: {
    notesPrompt: 'Write notes during or after your activity. Quick observations, clinical reasoning, things to follow up on, questions that came up.',
    aiCoach: {
      title: 'Write Now, Organize Later',
      body: 'Don\'t worry about structure \u2014 just capture your thoughts in the moment. Raw notes written close to the experience are more valuable than polished reflections written hours later.',
      question: 'What\'s the most important thing that happened in the last hour that you want to remember?',
    },
    network: [
      { name: 'Your peers', role: 'Community', tip: 'Quick notes turn into rich reflections. The students who write the most, learn the most.' },
    ],
    history: {
      summary: 'No notes yet',
      detail: 'Your notes timeline will appear here.',
    },
  },

  // ===========================================================================
  // REFLECTION MODULES
  // ===========================================================================

  gibbs_reflection: {
    tool: 'gibbs_reflection',
    notesPrompt: '',
    aiCoach: {
      title: 'Structured Reflection Deepens Learning',
      body: 'Gibbs\' Reflective Cycle moves you from "what happened" to "what will I do differently." Each stage builds on the last. Don\'t skip the feelings stage \u2014 emotional awareness is clinical intelligence.',
      question: 'Start with Description: What happened, in factual terms? Then move to Feelings: How did you feel at the time and after?',
    },
    network: [
      { name: 'Study Group', role: 'Peer cohort', tip: 'Sharing reflections (appropriately) with your study group helps you see experiences through others\' eyes. Different perspectives deepen everyone\'s learning.' },
    ],
    history: {
      summary: 'No reflections yet',
      detail: 'Your Gibbs reflections will appear here, showing how your reflective practice deepens over time.',
    },
  },

  clinical_reasoning: {
    tool: 'clinical_reasoning',
    notesPrompt: '',
    aiCoach: {
      title: 'Make Your Thinking Visible',
      body: 'Clinical reasoning is the invisible skill that separates good nurses from great ones. By writing down your thought process \u2014 not just your actions \u2014 you make it available for reflection, feedback, and growth.',
      question: 'Walk through your decision chain: What cue triggered your thinking? What did you consider? Why did you choose the action you took?',
    },
    network: [
      { name: 'Preceptor', role: 'Clinical mentor', tip: 'I want to hear your reasoning, not just your actions. Tell me what you were thinking and why. That\'s how I can help you think better.' },
    ],
    history: {
      summary: 'No entries yet',
      detail: 'Your clinical reasoning entries will appear here, forming a portfolio of your developing judgment.',
    },
  },

  self_assessment: {
    tool: 'self_assessment',
    notesPrompt: '',
    aiCoach: {
      title: 'Honest Self-Assessment Accelerates Growth',
      body: 'The gap between how you think you performed and how you actually performed is where the most powerful learning lives. Be honest \u2014 rate yourself before you get external feedback.',
      question: 'On a scale of 1-5, how confident were you during this activity? And how competent do you think you actually were? Note any gap.',
    },
    network: [
      { name: 'Your peers', role: 'Community', tip: 'Self-assessment is more accurate when calibrated against peers. Share your ratings and see how others assess similar experiences.' },
    ],
    history: {
      summary: 'No self-assessments yet',
      detail: 'Your self-assessment history will appear here, showing your growing self-awareness and calibration.',
    },
  },

  ebp_connection: {
    tool: 'ebp_connection',
    notesPrompt: 'What clinical question arose from your experience? What evidence did you find?',
    aiCoach: {
      title: 'Bridge Practice and Evidence',
      body: 'Evidence-based practice isn\'t just for research papers — it\'s for every shift. When something surprises you, when a protocol seems outdated, when you wonder "why do we do it this way?" — that\'s your signal to look it up. Even a 5-minute search can change your practice.',
      question: 'What happened today that made you think "I should look that up"?',
    },
    network: [
      { name: 'Emma R.', role: '3rd year BSN', tip: 'I keep a running list of clinical questions on my phone. Even if I can\'t look them up right away, writing the question helps me remember to follow up.' },
      { name: 'Preceptor Lisa', role: 'RN, 12 years', tip: 'The best nurses I know are always asking "what does the evidence say?" It\'s not about doubting your training — it\'s about staying current.' },
    ],
    history: {
      summary: 'No EBP connections yet',
      detail: 'Your evidence-based practice connections will appear here, building a personal knowledge base over time.',
    },
  },
  // Merge in content from other interests
  ...DRAWING_MODULE_CONTENT,
  ...FITNESS_MODULE_CONTENT,
  ...SAILING_MODULE_CONTENT,
};

// Fallback for any module not explicitly defined above
/** Interest-aware default content — avoids nursing-specific language for other interests */
function getDefaultContent(eventNoun: string): ModuleContent {
  const noun = eventNoun.toLowerCase();
  return {
    notesPrompt: `What's your approach for this area? What are you planning, and what questions do you have?`,
    aiCoach: {
      title: 'Prepare With Intention',
      body: `Every module is an opportunity to think through your approach before you're in the moment. Write your plan, identify your gaps, and address them now — before the ${noun} starts.`,
      question: 'What\'s the one thing about this topic that, if you mastered it today, would make the biggest difference?',
    },
    network: [
      { name: 'Your peers', role: 'Community', tip: 'Follow experienced people in your field to see how they approach this area. Their shared insights appear here.' },
    ],
    history: {
      summary: 'No previous entries yet',
      detail: `After your first ${noun}, your history and patterns will appear here to help you prepare smarter.`,
    },
  };
}

// =============================================================================
// ATTACHMENT TYPES
// =============================================================================

interface Attachment {
  id: string;
  type: 'photo' | 'video' | 'document' | 'link' | 'idea';
  label: string;
  uri?: string;
}

const CLINICAL_REASONING_MODULE_ID = 'clinical_reasoning';
const MAX_MAPPED_COMPETENCIES = 5;
const CLINICAL_REASONING_CANDIDATES = NURSING_COMPETENCY_CANDIDATES_V1
  .find((item) => item.moduleId === CLINICAL_REASONING_MODULE_ID)
  ?.candidates || [];
const CLINICAL_REASONING_CANDIDATE_IDS = CLINICAL_REASONING_CANDIDATES.map((item) => item.id);
const NURSING_COMPETENCY_BY_ID = new Map(
  NURSING_CORE_V1_CAPABILITIES.map((item) => [item.id,item])
);

const parseCompetencyIdList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry.length > 0);
      }
    } catch {}
    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
};

function MapsToSection({
  selectedIds,
  onAdd,
  onRemove,
}: {
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const selectedItems = selectedIds
    .map((id) => NURSING_COMPETENCY_BY_ID.get(id))
    .filter((item): item is NursingCoreV1Capability => Boolean(item));
  const availableItems = CLINICAL_REASONING_CANDIDATES
    .filter((item) => !selectedIds.includes(item.id));
  const canAddMore = selectedIds.length < MAX_MAPPED_COMPETENCIES;

  return (
    <View style={s.mapsToSection}>
      <View style={s.sectionHeader}>
        <LucideIcons.Link2 size={15} color={C.blue} />
        <Text style={[s.sectionTitle, { color: C.blue }]}>Maps to</Text>
      </View>
      <Text style={s.mapsToHint}>Select up to {MAX_MAPPED_COMPETENCIES} competencies</Text>
      {selectedItems.length > 0 ? (
        <View style={s.mapsToSelectedList}>
          {selectedItems.map((item) => (
            <View key={item.id} style={s.mapsToSelectedItem}>
              <Text style={s.mapsToSelectedTitle} numberOfLines={2}>{item.title}</Text>
              <Pressable onPress={() => onRemove(item.id)} style={s.mapsToRemoveButton}>
                <Text style={s.mapsToRemoveText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.mapsToEmpty}>No competencies selected yet.</Text>
      )}
      {canAddMore && availableItems.length > 0 ? (
        <View style={s.mapsToAddList}>
          {availableItems.map((item) => (
            <Pressable
              key={item.id}
              style={s.mapsToAddItem}
              onPress={() => onAdd(item.id)}
            >
              <Text style={s.mapsToAddPrefix}>Add</Text>
              <Text style={s.mapsToAddTitle} numberOfLines={2}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ClinicalReasoningFeedbackPanel({
  result,
  isLoading,
  errorText,
}: {
  result: ClinicalReasoningEvaluationResult | null;
  isLoading: boolean;
  errorText: string;
}) {
  if (isLoading) {
    return (
      <View style={s.feedbackPanel}>
        <Text style={s.feedbackLoading}>Getting feedback…</Text>
      </View>
    );
  }
  if (errorText.length > 0) {
    return (
      <View style={s.feedbackPanel}>
        <Text style={s.feedbackError}>{errorText}</Text>
      </View>
    );
  }
  if (!result) return null;

  return (
    <View style={s.feedbackPanel}>
      <Text style={s.feedbackTitle}>Feedback</Text>
      <View style={s.feedbackScoreList}>
        {result.scores.map((score) => {
          const title = NURSING_COMPETENCY_BY_ID.get(score.competencyId)?.title || score.competencyId;
          return (
            <View key={score.competencyId} style={s.feedbackScoreItem}>
              <Text style={s.feedbackScoreHeader}>{title} · {score.level}</Text>
              {score.improvements.slice(0, 2).map((tip, idx) => (
                <Text key={`${score.competencyId}-${idx}`} style={s.feedbackBullet}>• {tip}</Text>
              ))}
            </View>
          );
        })}
      </View>
      <Text style={s.feedbackNextAction}>Next action: {result.nextAction}</Text>
    </View>
  );
}

// =============================================================================
// RICH CONTENT TOOLBAR
// =============================================================================

const TOOLBAR_ACTIONS: {
  type: Attachment['type'];
  icon: React.ComponentType<any>;
  label: string;
  color: string;
}[] = [
  { type: 'photo', icon: LucideIcons.Camera, label: 'Photo', color: '#34C759' },
  { type: 'video', icon: LucideIcons.Video, label: 'Video', color: '#FF2D55' },
  { type: 'document', icon: LucideIcons.FileText, label: 'Document', color: '#5856D6' },
  { type: 'link', icon: LucideIcons.Link, label: 'Link', color: '#007AFF' },
  { type: 'idea', icon: LucideIcons.Lightbulb, label: 'Idea', color: '#FF9500' },
];

function RichContentToolbar({
  onAdd,
}: {
  onAdd: (type: Attachment['type']) => void;
}) {
  return (
    <View style={s.toolbar}>
      {TOOLBAR_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <TouchableOpacity
            key={action.type}
            style={s.toolbarButton}
            onPress={() => onAdd(action.type)}
            activeOpacity={0.7}
          >
            <View style={[s.toolbarIconCircle, { backgroundColor: `${action.color}12` }]}>
              <Icon size={18} color={action.color} />
            </View>
            <Text style={[s.toolbarLabel, { color: action.color }]}>{action.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// =============================================================================
// ATTACHMENT PREVIEW
// =============================================================================

function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0) return null;

  const typeConfig: Record<Attachment['type'], { icon: React.ComponentType<any>; bg: string; color: string }> = {
    photo: { icon: LucideIcons.Image, bg: '#E8F5E9', color: '#34C759' },
    video: { icon: LucideIcons.Play, bg: '#FCE4EC', color: '#FF2D55' },
    document: { icon: LucideIcons.FileText, bg: '#EDE7F6', color: '#5856D6' },
    link: { icon: LucideIcons.ExternalLink, bg: '#E3F2FD', color: '#007AFF' },
    idea: { icon: LucideIcons.Lightbulb, bg: '#FFF8E1', color: '#FF9500' },
  };

  return (
    <View style={s.attachmentList}>
      {attachments.map((att) => {
        const cfg = typeConfig[att.type];
        const Icon = cfg.icon;
        return (
          <View key={att.id} style={[s.attachmentCard, { backgroundColor: cfg.bg }]}>
            {att.type === 'photo' && att.uri ? (
              <Image source={{ uri: att.uri }} style={s.attachmentThumb} />
            ) : (
              <View style={[s.attachmentIconBox, { backgroundColor: `${cfg.color}20` }]}>
                <Icon size={16} color={cfg.color} />
              </View>
            )}
            <Text style={s.attachmentLabel} numberOfLines={1}>{att.label}</Text>
            <Pressable
              style={s.attachmentRemove}
              onPress={() => onRemove(att.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LucideIcons.X size={14} color={C.gray} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// =============================================================================
// INTERACTIVE TOOL COMPONENTS
// =============================================================================

/** Gibbs Reflective Cycle steps */
const GIBBS_STEPS = [
  {
    id: 'description',
    label: 'Description',
    icon: LucideIcons.FileText,
    color: '#007AFF',
    prompt: 'What happened? Describe the situation factually — who, what, where, when.',
    hint: 'Stick to facts. Save your feelings for the next step.',
  },
  {
    id: 'feelings',
    label: 'Feelings',
    icon: LucideIcons.Heart,
    color: '#FF2D55',
    prompt: 'How did you feel at the time? How do you feel now looking back?',
    hint: 'Name specific emotions — anxious, confident, overwhelmed, proud.',
  },
  {
    id: 'evaluation',
    label: 'Evaluation',
    icon: LucideIcons.Scale,
    color: '#FF9500',
    prompt: 'What went well? What didn\'t go well?',
    hint: 'Be balanced — acknowledge both positives and negatives.',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: LucideIcons.Brain,
    color: '#5856D6',
    prompt: 'Why did things go the way they did? What sense can you make of the situation?',
    hint: 'Connect to theory, past experience, or evidence-based practice.',
  },
  {
    id: 'conclusion',
    label: 'Conclusion',
    icon: LucideIcons.Lightbulb,
    color: '#34C759',
    prompt: 'What have you learned? What could you have done differently?',
    hint: 'Be specific — vague conclusions don\'t improve practice.',
  },
  {
    id: 'action_plan',
    label: 'Action Plan',
    icon: LucideIcons.Target,
    color: '#0D9488',
    prompt: 'What will you do differently next time? What specific steps will you take?',
    hint: 'Make it SMART — specific, measurable, achievable.',
  },
] as const;

/** Gibbs Reflective Cycle — interactive step-by-step guided tool */
function GibbsReflectionTool({
  values,
  onChange,
  accent,
}: {
  values: Record<string, string>;
  onChange: (stepId: string, text: string) => void;
  accent: string;
}) {
  const [expandedStep, setExpandedStep] = React.useState<string | null>('description');
  const completedCount = GIBBS_STEPS.filter((step) => (values[step.id] || '').trim().length > 0).length;

  return (
    <View style={toolStyles.container}>
      <View style={toolStyles.header}>
        <LucideIcons.RefreshCw size={15} color={accent} />
        <Text style={[s.sectionTitle, { color: accent }]}>Gibbs Reflective Cycle</Text>
      </View>

      {/* Progress indicator */}
      <View style={toolStyles.progressRow}>
        <View style={toolStyles.progressBar}>
          <View style={[toolStyles.progressFill, { width: `${(completedCount / 6) * 100}%`, backgroundColor: accent }]} />
        </View>
        <Text style={toolStyles.progressLabel}>{completedCount}/6</Text>
      </View>

      {/* Steps */}
      {GIBBS_STEPS.map((step, index) => {
        const isExpanded = expandedStep === step.id;
        const hasContent = (values[step.id] || '').trim().length > 0;
        const Icon = step.icon;

        return (
          <View
            key={step.id}
            style={[
              toolStyles.stepCard,
              isExpanded && toolStyles.stepCardExpanded,
              hasContent && !isExpanded && toolStyles.stepCardComplete,
            ]}
          >
            {/* Step header */}
            <Pressable
              style={toolStyles.stepHeader}
              onPress={() => setExpandedStep(isExpanded ? null : step.id)}
            >
              <View style={[toolStyles.stepNumber, { backgroundColor: hasContent ? step.color : C.gray5 }]}>
                {hasContent ? (
                  <LucideIcons.Check size={12} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text style={[toolStyles.stepNumberText, { color: hasContent ? '#FFF' : C.gray }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[toolStyles.stepLabel, hasContent && { color: step.color }]}>
                  {step.label}
                </Text>
                {!isExpanded && hasContent && (
                  <Text style={toolStyles.stepPreview} numberOfLines={1}>
                    {values[step.id]}
                  </Text>
                )}
              </View>
              <Icon size={16} color={isExpanded ? step.color : C.gray3} />
            </Pressable>

            {/* Expanded content */}
            {isExpanded && (
              <View style={toolStyles.stepBody}>
                <Text style={[toolStyles.stepHint, { color: step.color }]}>{step.hint}</Text>
                <TextInput
                  style={[toolStyles.stepInput, { borderColor: `${step.color}40` }]}
                  placeholder={step.prompt}
                  placeholderTextColor={C.gray}
                  value={values[step.id] || ''}
                  onChangeText={(text) => onChange(step.id, text)}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled={false}
                />
                {index < GIBBS_STEPS.length - 1 && (
                  <Pressable
                    style={[toolStyles.nextButton, { backgroundColor: step.color }]}
                    onPress={() => setExpandedStep(GIBBS_STEPS[index + 1].id)}
                  >
                    <Text style={toolStyles.nextButtonText}>
                      Next: {GIBBS_STEPS[index + 1].label}
                    </Text>
                    <LucideIcons.ChevronRight size={16} color="#FFF" />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Clinical Reasoning steps */
const REASONING_STEPS = [
  {
    id: 'cues',
    label: 'Cue Recognition',
    icon: LucideIcons.Eye,
    color: '#007AFF',
    prompt: 'What did you notice? What cues caught your attention — vitals, patient behavior, lab values, context?',
    hint: 'What data triggered your clinical thinking?',
  },
  {
    id: 'hypothesis',
    label: 'Hypothesis Generation',
    icon: LucideIcons.Brain,
    color: '#FF9500',
    prompt: 'What did you think was happening? What were your differential considerations?',
    hint: 'List what you were considering and why.',
  },
  {
    id: 'actions',
    label: 'Actions Taken',
    icon: LucideIcons.Activity,
    color: '#5856D6',
    prompt: 'What did you do? What interventions or assessments did you prioritize and why?',
    hint: 'Connect each action to your reasoning.',
  },
  {
    id: 'outcome',
    label: 'Outcome & Evaluation',
    icon: LucideIcons.Target,
    color: '#34C759',
    prompt: 'What happened? Did the outcome confirm or challenge your hypothesis? What would you do differently?',
    hint: 'Did your reasoning hold up? What did you learn?',
  },
] as const;

/** Clinical Reasoning — interactive step-by-step decision chain tool */
function ClinicalReasoningTool({
  values,
  onChange,
  accent,
}: {
  values: Record<string, string>;
  onChange: (stepId: string, text: string) => void;
  accent: string;
}) {
  const [expandedStep, setExpandedStep] = React.useState<string | null>('cues');
  const completedCount = REASONING_STEPS.filter((step) => (values[step.id] || '').trim().length > 0).length;

  return (
    <View style={toolStyles.container}>
      <View style={toolStyles.header}>
        <LucideIcons.GitBranch size={15} color={accent} />
        <Text style={[s.sectionTitle, { color: accent }]}>Clinical Reasoning Chain</Text>
      </View>

      {/* Progress indicator */}
      <View style={toolStyles.progressRow}>
        <View style={toolStyles.progressBar}>
          <View style={[toolStyles.progressFill, { width: `${(completedCount / 4) * 100}%`, backgroundColor: accent }]} />
        </View>
        <Text style={toolStyles.progressLabel}>{completedCount}/4</Text>
      </View>

      {/* Connection line visualization */}
      {REASONING_STEPS.map((step, index) => {
        const isExpanded = expandedStep === step.id;
        const hasContent = (values[step.id] || '').trim().length > 0;
        const Icon = step.icon;
        const isLast = index === REASONING_STEPS.length - 1;

        return (
          <View key={step.id}>
            <View
              style={[
                toolStyles.stepCard,
                isExpanded && toolStyles.stepCardExpanded,
                hasContent && !isExpanded && toolStyles.stepCardComplete,
              ]}
            >
              {/* Step header */}
              <Pressable
                style={toolStyles.stepHeader}
                onPress={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <View style={[toolStyles.stepNumber, { backgroundColor: hasContent ? step.color : C.gray5 }]}>
                  {hasContent ? (
                    <LucideIcons.Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Icon size={12} color={C.gray} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[toolStyles.stepLabel, hasContent && { color: step.color }]}>
                    {step.label}
                  </Text>
                  {!isExpanded && hasContent && (
                    <Text style={toolStyles.stepPreview} numberOfLines={1}>
                      {values[step.id]}
                    </Text>
                  )}
                </View>
                {isExpanded ? (
                  <LucideIcons.ChevronDown size={16} color={step.color} />
                ) : (
                  <LucideIcons.ChevronRight size={16} color={C.gray3} />
                )}
              </Pressable>

              {/* Expanded content */}
              {isExpanded && (
                <View style={toolStyles.stepBody}>
                  <Text style={[toolStyles.stepHint, { color: step.color }]}>{step.hint}</Text>
                  <TextInput
                    style={[toolStyles.stepInput, { borderColor: `${step.color}40` }]}
                    placeholder={step.prompt}
                    placeholderTextColor={C.gray}
                    value={values[step.id] || ''}
                    onChangeText={(text) => onChange(step.id, text)}
                    multiline
                    textAlignVertical="top"
                    scrollEnabled={false}
                  />
                  {step.id === 'outcome' && (
                    <Text style={toolStyles.commitHint}>Ready to commit this draft? Tap Get feedback.</Text>
                  )}
                  {!isLast && (
                    <Pressable
                      style={[toolStyles.nextButton, { backgroundColor: step.color }]}
                      onPress={() => setExpandedStep(REASONING_STEPS[index + 1].id)}
                    >
                      <Text style={toolStyles.nextButtonText}>
                        Next: {REASONING_STEPS[index + 1].label}
                      </Text>
                      <LucideIcons.ChevronRight size={16} color="#FFF" />
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* Arrow connector between steps */}
            {!isLast && (
              <View style={toolStyles.connector}>
                <LucideIcons.ChevronDown size={14} color={hasContent ? step.color : C.gray3} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Self-Assessment dimensions */
const ASSESSMENT_DIMENSIONS = [
  {
    id: 'confidence',
    label: 'Confidence',
    icon: LucideIcons.Shield,
    color: '#007AFF',
    description: 'How confident did you feel during this activity?',
    lowLabel: 'Very unsure',
    highLabel: 'Very confident',
  },
  {
    id: 'competence',
    label: 'Competence',
    icon: LucideIcons.Award,
    color: '#34C759',
    description: 'How competent do you think you actually were?',
    lowLabel: 'Needed help',
    highLabel: 'Could teach it',
  },
  {
    id: 'independence',
    label: 'Independence',
    icon: LucideIcons.UserCheck,
    color: '#FF9500',
    description: 'How independently did you work?',
    lowLabel: 'Fully guided',
    highLabel: 'Fully independent',
  },
] as const;

const ASSESSMENT_REFLECTIONS = [
  {
    id: 'went_well',
    label: 'What Went Well',
    icon: LucideIcons.ThumbsUp,
    color: '#34C759',
    prompt: 'What are you proud of? What skills did you demonstrate effectively?',
  },
  {
    id: 'struggled',
    label: 'Where I Struggled',
    icon: LucideIcons.AlertCircle,
    color: '#FF9500',
    prompt: 'What was difficult? Where did you feel uncertain or make mistakes?',
  },
  {
    id: 'growth_areas',
    label: 'Growth Areas',
    icon: LucideIcons.TrendingUp,
    color: '#5856D6',
    prompt: 'What specific skills or knowledge do you need to develop? What\'s your plan?',
  },
] as const;

/** Self-Assessment — interactive rating + reflection tool */
function SelfAssessmentTool({
  values,
  onChange,
  accent,
}: {
  values: Record<string, string>;
  onChange: (stepId: string, text: string) => void;
  accent: string;
}) {
  const ratingsComplete = ASSESSMENT_DIMENSIONS.filter((d) => (values[d.id] || '') !== '').length;
  const reflectionsComplete = ASSESSMENT_REFLECTIONS.filter((r) => (values[r.id] || '').trim().length > 0).length;
  const totalComplete = ratingsComplete + reflectionsComplete;
  const totalSteps = ASSESSMENT_DIMENSIONS.length + ASSESSMENT_REFLECTIONS.length;

  return (
    <View style={toolStyles.container}>
      <View style={toolStyles.header}>
        <LucideIcons.BarChart3 size={15} color={accent} />
        <Text style={[s.sectionTitle, { color: accent }]}>Self-Assessment</Text>
      </View>

      <View style={toolStyles.progressRow}>
        <View style={toolStyles.progressBar}>
          <View style={[toolStyles.progressFill, { width: `${(totalComplete / totalSteps) * 100}%`, backgroundColor: accent }]} />
        </View>
        <Text style={toolStyles.progressLabel}>{totalComplete}/{totalSteps}</Text>
      </View>

      {/* Rating dimensions */}
      {ASSESSMENT_DIMENSIONS.map((dim) => {
        const Icon = dim.icon;
        const currentRating = parseInt(values[dim.id] || '0', 10);

        return (
          <View key={dim.id} style={[assessStyles.ratingCard, currentRating > 0 && assessStyles.ratingCardComplete]}>
            <View style={assessStyles.ratingHeader}>
              <Icon size={16} color={dim.color} />
              <Text style={[assessStyles.ratingLabel, { color: dim.color }]}>{dim.label}</Text>
            </View>
            <Text style={assessStyles.ratingDescription}>{dim.description}</Text>
            <View style={assessStyles.ratingRow}>
              <Text style={assessStyles.ratingEndLabel}>{dim.lowLabel}</Text>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  style={[
                    assessStyles.ratingDot,
                    { borderColor: dim.color },
                    currentRating === n && { backgroundColor: dim.color },
                  ]}
                  onPress={() => onChange(dim.id, String(n))}
                >
                  <Text style={[
                    assessStyles.ratingDotText,
                    currentRating === n && { color: '#FFFFFF' },
                  ]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
              <Text style={assessStyles.ratingEndLabel}>{dim.highLabel}</Text>
            </View>
          </View>
        );
      })}

      {/* Confidence-Competence gap indicator */}
      {values.confidence && values.competence && (
        <View style={assessStyles.gapCard}>
          <LucideIcons.ArrowLeftRight size={14} color={C.orange} />
          <Text style={assessStyles.gapText}>
            {parseInt(values.confidence, 10) === parseInt(values.competence, 10)
              ? 'Your confidence matches your competence — good calibration!'
              : parseInt(values.confidence, 10) > parseInt(values.competence, 10)
                ? `Gap detected: You felt more confident (${values.confidence}) than competent (${values.competence}). This awareness is valuable.`
                : `You rated competence (${values.competence}) higher than confidence (${values.confidence}). You may be more capable than you feel!`
            }
          </Text>
        </View>
      )}

      {/* Reflection prompts */}
      {ASSESSMENT_REFLECTIONS.map((ref) => {
        const Icon = ref.icon;
        const hasContent = (values[ref.id] || '').trim().length > 0;
        return (
          <View key={ref.id} style={[toolStyles.stepCard, hasContent && toolStyles.stepCardComplete]}>
            <View style={toolStyles.stepHeader}>
              <View style={[toolStyles.stepNumber, { backgroundColor: hasContent ? ref.color : C.gray5 }]}>
                {hasContent ? (
                  <LucideIcons.Check size={12} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Icon size={12} color={C.gray} />
                )}
              </View>
              <Text style={[toolStyles.stepLabel, hasContent && { color: ref.color }]}>{ref.label}</Text>
            </View>
            <TextInput
              style={[toolStyles.stepInput, { borderColor: `${ref.color}40`, marginTop: 8 }]}
              placeholder={ref.prompt}
              placeholderTextColor={C.gray}
              value={values[ref.id] || ''}
              onChangeText={(text) => onChange(ref.id, text)}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />
          </View>
        );
      })}
    </View>
  );
}

const assessStyles = StyleSheet.create({
  ratingCard: {
    backgroundColor: C.gray6,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.gray5,
    gap: 8,
  },
  ratingCardComplete: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  ratingDescription: {
    fontSize: 13,
    color: C.gray,
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  ratingEndLabel: {
    fontSize: 10,
    color: C.gray,
    width: 52,
    textAlign: 'center',
  },
  ratingDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  ratingDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.secondaryLabel,
  },
  gapCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  gapText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#92400E',
    lineHeight: 18,
  },
});

/** Learning Notes steps */
const LEARNING_STEPS = [
  {
    id: 'key_learning',
    label: 'Key Learning',
    icon: LucideIcons.Lightbulb,
    color: '#007AFF',
    prompt: 'What did you learn today that you didn\'t know before? What new understanding did you gain?',
    hint: 'Focus on insights, not just facts.',
  },
  {
    id: 'surprises',
    label: 'What Surprised Me',
    icon: LucideIcons.Zap,
    color: '#FF9500',
    prompt: 'What surprised you? What challenged your assumptions or expectations?',
    hint: 'Surprises reveal gaps between theory and practice.',
  },
  {
    id: 'clinical_moments',
    label: 'Clinical Reasoning Moment',
    icon: LucideIcons.Brain,
    color: '#5856D6',
    prompt: 'Describe a moment where you had to think critically. What cues did you notice? What decision did you make?',
    hint: 'These moments are where clinical judgment develops.',
  },
  {
    id: 'mistakes',
    label: 'I Was Wrong About...',
    icon: LucideIcons.AlertCircle,
    color: '#FF2D55',
    prompt: 'What did you get wrong or misunderstand? What would you do differently next time?',
    hint: 'This is the most powerful growth prompt. Be honest.',
  },
  {
    id: 'questions',
    label: 'Questions to Explore',
    icon: LucideIcons.HelpCircle,
    color: '#0D9488',
    prompt: 'What questions came up that you want to research? What do you still not understand?',
    hint: 'Good questions are as valuable as good answers.',
  },
] as const;

/** Learning Notes — structured reflection tool with guided prompts */
function LearningNotesTool({
  values,
  onChange,
  accent,
}: {
  values: Record<string, string>;
  onChange: (stepId: string, text: string) => void;
  accent: string;
}) {
  const [expandedStep, setExpandedStep] = React.useState<string | null>('key_learning');
  const completedCount = LEARNING_STEPS.filter((step) => (values[step.id] || '').trim().length > 0).length;

  return (
    <View style={toolStyles.container}>
      <View style={toolStyles.header}>
        <LucideIcons.BookOpen size={15} color={accent} />
        <Text style={[s.sectionTitle, { color: accent }]}>Learning Notes</Text>
      </View>

      <View style={toolStyles.progressRow}>
        <View style={toolStyles.progressBar}>
          <View style={[toolStyles.progressFill, { width: `${(completedCount / LEARNING_STEPS.length) * 100}%`, backgroundColor: accent }]} />
        </View>
        <Text style={toolStyles.progressLabel}>{completedCount}/{LEARNING_STEPS.length}</Text>
      </View>

      {LEARNING_STEPS.map((step, index) => {
        const isExpanded = expandedStep === step.id;
        const hasContent = (values[step.id] || '').trim().length > 0;
        const Icon = step.icon;

        return (
          <Pressable
            key={step.id}
            style={[
              toolStyles.stepCard,
              isExpanded && toolStyles.stepCardExpanded,
              hasContent && !isExpanded && toolStyles.stepCardComplete,
            ]}
            onPress={() => setExpandedStep(isExpanded ? null : step.id)}
          >
            <View style={toolStyles.stepHeader}>
              <View style={[toolStyles.stepNumber, { backgroundColor: hasContent ? step.color : C.gray5 }]}>
                {hasContent ? (
                  <LucideIcons.Check size={12} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Icon size={12} color={C.gray} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[toolStyles.stepLabel, hasContent && { color: step.color }]}>
                  {step.label}
                </Text>
                {!isExpanded && hasContent && (
                  <Text style={toolStyles.stepPreview} numberOfLines={1}>
                    {values[step.id]}
                  </Text>
                )}
              </View>
              {isExpanded ? (
                <LucideIcons.ChevronDown size={16} color={step.color} />
              ) : (
                <LucideIcons.ChevronRight size={16} color={C.gray3} />
              )}
            </View>

            {isExpanded && (
              <View style={toolStyles.stepBody}>
                <Text style={[toolStyles.stepHint, { color: step.color }]}>{step.hint}</Text>
                <TextInput
                  style={[toolStyles.stepInput, { borderColor: `${step.color}40` }]}
                  placeholder={step.prompt}
                  placeholderTextColor={C.gray}
                  value={values[step.id] || ''}
                  onChangeText={(text) => onChange(step.id, text)}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled={false}
                />
                {index < LEARNING_STEPS.length - 1 && (
                  <Pressable
                    style={[toolStyles.nextButton, { backgroundColor: step.color }]}
                    onPress={() => setExpandedStep(LEARNING_STEPS[index + 1].id)}
                  >
                    <Text style={toolStyles.nextButtonText}>
                      Next: {LEARNING_STEPS[index + 1].label}
                    </Text>
                    <LucideIcons.ChevronRight size={16} color="#FFF" />
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tool styles shared by all interactive tools */
const toolStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: C.gray5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.gray,
    minWidth: 24,
    textAlign: 'right',
  },
  stepCard: {
    backgroundColor: C.gray6,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.gray5,
  },
  stepCardExpanded: {
    backgroundColor: '#FFFFFF',
    borderColor: C.gray3,
  },
  stepCardComplete: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: C.label,
  },
  stepPreview: {
    fontSize: 13,
    color: C.gray,
    marginTop: 2,
  },
  stepBody: {
    marginTop: 12,
    gap: 8,
  },
  stepHint: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  stepInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    color: C.label,
    minHeight: 80,
    borderWidth: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  nextButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  commitHint: {
    fontSize: 12,
    color: C.gray,
    lineHeight: 16,
  },
  connector: {
    alignItems: 'center',
    paddingVertical: 2,
  },
});

// Register inline tools into the tool registry
TOOL_REGISTRY.gibbs_reflection = GibbsReflectionTool;
TOOL_REGISTRY.clinical_reasoning = ClinicalReasoningTool;
TOOL_REGISTRY.self_assessment = SelfAssessmentTool;
TOOL_REGISTRY.learning_notes = LearningNotesTool;

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

/** Your Plan — student input area with optional rich content toolbar */
function YourPlanSection({
  prompt,
  value,
  onChange,
  accent,
  richContent,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  showLinkInput,
  linkUrl,
  onLinkUrlChange,
  onLinkSubmit,
  onLinkCancel,
}: {
  prompt: string;
  value: string;
  onChange: (text: string) => void;
  accent: string;
  richContent?: boolean;
  attachments?: Attachment[];
  onAddAttachment?: (type: Attachment['type']) => void;
  onRemoveAttachment?: (id: string) => void;
  showLinkInput?: boolean;
  linkUrl?: string;
  onLinkUrlChange?: (text: string) => void;
  onLinkSubmit?: () => void;
  onLinkCancel?: () => void;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <LucideIcons.PenLine size={15} color={accent} />
        <Text style={[s.sectionTitle, { color: accent }]}>Your Plan</Text>
      </View>
      <TextInput
        style={s.notesInput}
        placeholder={prompt}
        placeholderTextColor={C.gray}
        value={value}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        scrollEnabled={false}
      />

      {/* Rich content toolbar */}
      {richContent && onAddAttachment && (
        <RichContentToolbar onAdd={onAddAttachment} />
      )}

      {/* Link URL inline input */}
      {showLinkInput && (
        <View style={s.linkInputRow}>
          <TextInput
            style={s.linkInput}
            placeholder="Paste a URL..."
            placeholderTextColor={C.gray}
            value={linkUrl}
            onChangeText={onLinkUrlChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={onLinkSubmit}
            autoFocus
          />
          <TouchableOpacity style={s.linkSubmitButton} onPress={onLinkSubmit} activeOpacity={0.7}>
            <LucideIcons.Check size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={s.linkCancelButton} onPress={onLinkCancel} activeOpacity={0.7}>
            <LucideIcons.X size={16} color={C.gray} />
          </TouchableOpacity>
        </View>
      )}

      {/* Attached items */}
      {attachments && onRemoveAttachment && (
        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
      )}
    </View>
  );
}

/** AI Coach — contextual, Socratic, builds on past experience */
function AICoachSection({
  title,
  body,
  question,
}: {
  title: string;
  body: string;
  question: string;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <LucideIcons.Sparkles size={15} color="#F59E0B" />
        <Text style={[s.sectionTitle, { color: '#D97706' }]}>Coaching</Text>
      </View>
      <View style={s.coachCard}>
        <Text style={s.coachTitle}>{title}</Text>
        <Text style={s.coachBody}>{body}</Text>
        <View style={s.coachQuestionBox}>
          <LucideIcons.HelpCircle size={14} color="#D97706" />
          <Text style={s.coachQuestion}>{question}</Text>
        </View>
      </View>
    </View>
  );
}

/** Alert / Safety callout */
function AlertSection({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.alertCard}>
      <View style={s.alertHeader}>
        <LucideIcons.AlertTriangle size={15} color={C.orange} />
        <Text style={s.alertTitle}>{title}</Text>
      </View>
      <Text style={s.alertBody}>{body}</Text>
    </View>
  );
}

/** Structured items (checklist, lab list, etc.) */
function ItemsSection({
  items,
  accent,
}: {
  items: NonNullable<ModuleContent['items']>;
  accent: string;
}) {
  return (
    <View style={s.itemsList}>
      {items.map((item, i) => (
        <View key={i} style={s.itemRow}>
          <View style={[
            s.itemDot,
            {
              backgroundColor:
                item.status === 'alert' ? C.orange :
                item.status === 'ok' ? C.green : accent,
            },
          ]} />
          <View style={s.itemContent}>
            <Text style={s.itemLabel}>{item.label}</Text>
            <Text style={s.itemDetail}>{item.detail}</Text>
          </View>
          {item.status === 'alert' && (
            <LucideIcons.AlertCircle size={16} color={C.orange} />
          )}
          {item.status === 'ok' && (
            <LucideIcons.CheckCircle size={16} color={C.green} />
          )}
        </View>
      ))}
    </View>
  );
}

/** From Your Network — social learning */
function NetworkSection({
  tips,
}: {
  tips: ModuleContent['network'];
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <LucideIcons.Users size={15} color="#16A34A" />
        <Text style={[s.sectionTitle, { color: '#16A34A' }]}>From Your Network</Text>
      </View>
      <View style={s.networkList}>
        {tips.map((tip, i) => (
          <View key={i} style={s.networkCard}>
            <View style={s.networkAvatar}>
              <Text style={s.networkAvatarText}>
                {tip.name.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={s.networkContent}>
              <View style={s.networkNameRow}>
                <Text style={s.networkName}>{tip.name}</Text>
                <Text style={s.networkRole}>{tip.role}</Text>
              </View>
              <Text style={s.networkTip}>{tip.tip}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Your History — past experience summary */
function HistorySection({
  summary,
  detail,
}: {
  summary: string;
  detail: string;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <LucideIcons.History size={15} color={C.blue} />
        <Text style={[s.sectionTitle, { color: C.blue }]}>Your History</Text>
      </View>
      <View style={s.historyCard}>
        <Text style={s.historySummary}>{summary}</Text>
        <Text style={s.historyDetail}>{detail}</Text>
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/** Summary of user-entered content for a single module */
export interface ModuleContentSummary {
  notes: string;
  attachmentCount: number;
  /** First attachment label for preview */
  firstAttachmentLabel?: string;
}

export interface ModuleDetailBottomSheetProps {
  moduleId: string | null;
  isOpen: boolean;
  onClose: () => void;
  config: InterestEventConfig;
  stepMetadata?: Record<string,unknown> | null;
  artifactContext?: {
    eventType: ModuleArtifactEventType;
    eventId: string;
    userId?: string | null;
  } | null;
  /** Called whenever module content changes (notes or attachments) */
  onContentChange?: (moduleId: string, summary: ModuleContentSummary) => void;
}

export function ModuleDetailBottomSheet({
  moduleId,
  isOpen,
  onClose,
  config,
  stepMetadata,
  artifactContext,
  onContentChange,
}: ModuleDetailBottomSheetProps) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackResultByModule, setFeedbackResultByModule] = useState<Record<string, ClinicalReasoningEvaluationResult | null>>({});
  const [isRequestingCoachReview, setIsRequestingCoachReview] = useState(false);
  const [coachReviewStatus, setCoachReviewStatus] = useState<'none' | 'requested' | 'in_review' | 'completed'>('none');
  const [coachReviewNotice, setCoachReviewNotice] = useState('');

  // Tool step values: moduleId → { stepId → text }
  const [toolValues, setToolValues] = useState<Record<string, Record<string, string>>>({});
  const [mappedCompetencyIds, setMappedCompetencyIds] = useState<Record<string, string[]>>({});

  // Refs to avoid stale closure issues in attachment handlers
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const toolValuesRef = useRef(toolValues);
  toolValuesRef.current = toolValues;
  const mappedCompetencyIdsRef = useRef(mappedCompetencyIds);
  mappedCompetencyIdsRef.current = mappedCompetencyIds;
  const hasLocalEditsByModuleRef = useRef<Record<string, boolean>>({});
  const templateMapsToPrefillAppliedRef = useRef<Record<string, boolean>>({});
  const flushPendingSaveRef = useRef<((options?: {ensureSaved?: boolean}) => Promise<{artifact_id: string} | null>) | null>(null);

  // Notify parent whenever module content changes (notes, attachments, or tool steps)
  const notifyContentChange = useCallback((modId: string, currentNotes: Record<string, string>, currentAttachments: Record<string, Attachment[]>) => {
    if (!onContentChange) return;
    const noteText = currentNotes[modId] || '';
    const atts = currentAttachments[modId] || [];
    // For tool modules, aggregate step text as the "notes" for tile preview
    const toolSteps = toolValuesRef.current[modId];
    const toolText = toolSteps
      ? Object.values(toolSteps).filter(Boolean).join(' | ')
      : '';
    const combinedNotes = toolText || noteText;
    const completedSteps = toolSteps
      ? Object.values(toolSteps).filter((v) => v.trim().length > 0).length
      : 0;
    onContentChange(modId, {
      notes: combinedNotes,
      attachmentCount: atts.length + completedSteps,
      firstAttachmentLabel: completedSteps > 0
        ? `${completedSteps} step${completedSteps > 1 ? 's' : ''} complete`
        : atts[0]?.label,
    });
  }, [onContentChange]);

  React.useEffect(() => {
    if (isOpen && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || !moduleId) return;
    hasLocalEditsByModuleRef.current[moduleId] = false;
  }, [isOpen, moduleId]);

  const markModuleDirty = useCallback((modId: string) => {
    hasLocalEditsByModuleRef.current[modId] = true;
  }, []);

  const nursingDraftModuleIds = useRef(new Set([
    'gibbs_reflection',
    'clinical_reasoning',
    'self_assessment',
    'learning_notes',
  ]));

  const isNursingDraftModule = Boolean(
    moduleId
    && config.interestSlug === 'nursing'
    && nursingDraftModuleIds.current.has(moduleId)
  );

  const handleClose = useCallback(async () => {
    if (isNursingDraftModule && flushPendingSaveRef.current) {
      await flushPendingSaveRef.current();
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowLinkInput(false);
    setLinkUrl('');
    onClose();
  }, [isNursingDraftModule, onClose]);

  // ---- Attachment handlers ----

  const addAttachment = useCallback((moduleKey: string, att: Attachment) => {
    markModuleDirty(moduleKey);
    setAttachments((prev) => {
      const updated = {
        ...prev,
        [moduleKey]: [...(prev[moduleKey] || []), att],
      };
      setTimeout(() => notifyContentChange(moduleKey, notesRef.current, updated), 0);
      return updated;
    });
  }, [markModuleDirty, notifyContentChange]);

  const removeAttachment = useCallback((moduleKey: string, attachmentId: string) => {
    markModuleDirty(moduleKey);
    setAttachments((prev) => {
      const updated = {
        ...prev,
        [moduleKey]: (prev[moduleKey] || []).filter((a) => a.id !== attachmentId),
      };
      setTimeout(() => notifyContentChange(moduleKey, notesRef.current, updated), 0);
      return updated;
    });
  }, [markModuleDirty, notifyContentChange]);

  const handleAddAttachment = useCallback(async (type: Attachment['type']) => {
    if (!moduleId) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    switch (type) {
      case 'photo': {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission needed', 'Please allow access to your photo library.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsMultipleSelection: true,
        });
        if (!result.canceled && result.assets) {
          result.assets.forEach((asset) => {
            const fileName = asset.fileName || `Photo ${new Date().toLocaleTimeString()}`;
            addAttachment(moduleId, {
              id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'photo',
              label: fileName,
              uri: asset.uri,
            });
          });
        }
        break;
      }

      case 'video': {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission needed', 'Please allow access to your photo library.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          addAttachment(moduleId, {
            id: `video-${Date.now()}`,
            type: 'video',
            label: asset.fileName || `Video ${new Date().toLocaleTimeString()}`,
            uri: asset.uri,
          });
        }
        break;
      }

      case 'document': {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
          multiple: true,
        });
        if (!result.canceled && result.assets) {
          result.assets.forEach((asset) => {
            addAttachment(moduleId, {
              id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'document',
              label: asset.name || 'Document',
              uri: asset.uri,
            });
          });
        }
        break;
      }

      case 'link': {
        setShowLinkInput(true);
        break;
      }

      case 'idea': {
        if (Platform.OS === 'ios') {
          Alert.prompt(
            'Add Idea',
            'Capture a quick thought, insight, or idea.',
            (text: string) => {
              if (text && text.trim()) {
                addAttachment(moduleId, {
                  id: `idea-${Date.now()}`,
                  type: 'idea',
                  label: text.trim(),
                });
              }
            },
            'plain-text',
            '',
            'default',
          );
        } else {
          // Android fallback — add a note attachment with placeholder
          addAttachment(moduleId, {
            id: `idea-${Date.now()}`,
            type: 'idea',
            label: 'New idea — tap to edit',
          });
        }
        break;
      }
    }
  }, [moduleId, addAttachment]);

  const handleLinkSubmit = useCallback(() => {
    if (!moduleId || !linkUrl.trim()) {
      setShowLinkInput(false);
      setLinkUrl('');
      return;
    }
    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    // Extract a display label from the URL
    let label: string;
    try {
      const parsed = new URL(url);
      label = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    } catch {
      label = url;
    }
    addAttachment(moduleId, {
      id: `link-${Date.now()}`,
      type: 'link',
      label,
      uri: url,
    });
    setShowLinkInput(false);
    setLinkUrl('');
  }, [moduleId, linkUrl, addAttachment]);

  const handleLinkCancel = useCallback(() => {
    setShowLinkInput(false);
    setLinkUrl('');
  }, []);

  // Handler for tool step changes (Gibbs / Clinical Reasoning)
  const handleToolStepChange = useCallback((stepId: string, text: string) => {
    if (!moduleId) return;
    markModuleDirty(moduleId);
    setToolValues((prev) => {
      const updated = {
        ...prev,
        [moduleId]: { ...(prev[moduleId] || {}), [stepId]: text },
      };
      toolValuesRef.current = updated;
      setTimeout(() => notifyContentChange(moduleId, notesRef.current, attachmentsRef.current), 0);
      return updated;
    });
  }, [markModuleDirty, moduleId, notifyContentChange]);

  const hydrateModuleArtifact = useCallback((content: {
    toolValues: Record<string,string>;
    notes: string;
    attachments: {id: string; type: string; label: string; uri?: string}[];
    mappedCompetencyIds?: string[];
  }) => {
    if (!moduleId) return;
    if (hasLocalEditsByModuleRef.current[moduleId]) return false;

    const safeToolValues = Object.entries(content.toolValues || {}).reduce<Record<string,string>>((acc, [stepId, value]) => {
      if (typeof value === 'string') {
        acc[stepId] = value;
      }
      return acc;
    }, {});

    const safeAttachments = (Array.isArray(content.attachments) ? content.attachments : [])
      .filter((item) => item && typeof item.id === 'string' && typeof item.type === 'string' && typeof item.label === 'string')
      .filter((item) => ['photo', 'video', 'document', 'link', 'idea'].includes(item.type))
      .map((item) => ({
        id: item.id,
        type: item.type as Attachment['type'],
        label: item.label,
        ...(item.uri ? { uri: item.uri } : {}),
      }));

    const updatedToolValues = {
      ...toolValuesRef.current,
      [moduleId]: safeToolValues,
    };
    const updatedNotes = {
      ...notesRef.current,
      [moduleId]: typeof content.notes === 'string' ? content.notes : '',
    };
    const updatedAttachments = {
      ...attachmentsRef.current,
      [moduleId]: safeAttachments,
    };
    const updatedMappedCompetencyIds = {
      ...mappedCompetencyIdsRef.current,
      [moduleId]: Array.isArray(content.mappedCompetencyIds)
        ? content.mappedCompetencyIds
          .filter((id) => typeof id === 'string' && id.trim().length > 0)
          .slice(0, MAX_MAPPED_COMPETENCIES)
        : [],
    };

    toolValuesRef.current = updatedToolValues;
    notesRef.current = updatedNotes;
    attachmentsRef.current = updatedAttachments;
    mappedCompetencyIdsRef.current = updatedMappedCompetencyIds;

    setToolValues(updatedToolValues);
    setNotes(updatedNotes);
    setAttachments(updatedAttachments);
    setMappedCompetencyIds(updatedMappedCompetencyIds);

    setTimeout(() => notifyContentChange(moduleId, updatedNotes, updatedAttachments), 0);
    return true;
  }, [moduleId, notifyContentChange]);

  const handleAddMappedCompetency = useCallback((competencyId: string) => {
    if (!moduleId) return;
    markModuleDirty(moduleId);
    setMappedCompetencyIds((prev) => {
      const existing = prev[moduleId] || [];
      if (existing.includes(competencyId) || existing.length >= MAX_MAPPED_COMPETENCIES) {
        return prev;
      }
      const updated = {
        ...prev,
        [moduleId]: [...existing, competencyId],
      };
      mappedCompetencyIdsRef.current = updated;
      return updated;
    });
  }, [markModuleDirty, moduleId]);

  const handleRemoveMappedCompetency = useCallback((competencyId: string) => {
    if (!moduleId) return;
    markModuleDirty(moduleId);
    setMappedCompetencyIds((prev) => {
      const existing = prev[moduleId] || [];
      const updated = {
        ...prev,
        [moduleId]: existing.filter((id) => id !== competencyId),
      };
      mappedCompetencyIdsRef.current = updated;
      return updated;
    });
  }, [markModuleDirty, moduleId]);

  const { saveStatus, flushPendingSave, currentArtifactId } = useModuleArtifact({
    isEnabled: Boolean(
      isNursingDraftModule
      && artifactContext?.eventType
      && artifactContext?.eventId
    ),
    isOpen,
    moduleId,
    eventType: artifactContext?.eventType || null,
    eventId: artifactContext?.eventId || null,
    userId: artifactContext?.userId || null,
    content: {
      toolValues: moduleId ? (toolValues[moduleId] || {}) : {},
      notes: moduleId ? (notes[moduleId] || '') : '',
      attachments: (moduleId ? (attachments[moduleId] || []) : []).map((item) => ({
        id: item.id,
        type: item.type,
        label: item.label,
        ...(item.uri ? { uri: item.uri } : {}),
      })),
      mappedCompetencyIds: moduleId ? (mappedCompetencyIds[moduleId] || []) : [],
    },
    onHydrate: hydrateModuleArtifact,
  });

  flushPendingSaveRef.current = flushPendingSave;

  const saveStatusLabel = saveStatus === 'saving' || saveStatus === 'loading'
    ? 'Saving…'
    : saveStatus === 'saved'
      ? 'Saved'
      : '';

  const isClinicalReasoningCommitEnabled = Boolean(
    moduleId === CLINICAL_REASONING_MODULE_ID
    && config.interestSlug === 'nursing'
    && artifactContext?.eventType
    && artifactContext?.eventId
  );

  const templateSuggestedCompetencyIds = useMemo(() => {
    if (config.interestSlug !== 'nursing') return [];
    const rawValue = (stepMetadata || {}).org_template_suggested_competency_ids;
    const parsedIds = parseCompetencyIdList(rawValue);
    return parsedIds
      .filter((id) => CLINICAL_REASONING_CANDIDATE_IDS.includes(id))
      .slice(0, MAX_MAPPED_COMPETENCIES);
  }, [config.interestSlug, stepMetadata]);

  React.useEffect(() => {
    if (!isOpen || moduleId !== CLINICAL_REASONING_MODULE_ID) return;
    if (config.interestSlug !== 'nursing') return;
    if (templateSuggestedCompetencyIds.length === 0) return;

    const existingMapped = mappedCompetencyIdsRef.current[moduleId] || [];
    if (existingMapped.length > 0) return;

    const prefillKey = currentArtifactId && isUuid(currentArtifactId)
      ? `artifact:${currentArtifactId}`
      : `pending:${artifactContext?.eventType || 'none'}:${artifactContext?.eventId || 'none'}:${moduleId}`;
    if (templateMapsToPrefillAppliedRef.current[prefillKey]) return;
    templateMapsToPrefillAppliedRef.current[prefillKey] = true;

    markModuleDirty(moduleId);
    const updated = {
      ...mappedCompetencyIdsRef.current,
      [moduleId]: templateSuggestedCompetencyIds,
    };
    mappedCompetencyIdsRef.current = updated;
    setMappedCompetencyIds(updated);
  }, [
    artifactContext?.eventId,
    artifactContext?.eventType,
    config.interestSlug,
    currentArtifactId,
    isOpen,
    markModuleDirty,
    moduleId,
    templateSuggestedCompetencyIds,
  ]);

  React.useEffect(() => {
    let isCancelled = false;

    const loadExistingCoachReviewStatus = async () => {
      if (!isClinicalReasoningCommitEnabled || !moduleId || !isOpen) {
        if (!isCancelled) {
          setCoachReviewStatus('none');
          setCoachReviewNotice('');
        }
        return;
      }

      const artifactId = currentArtifactId;
      if (!artifactId || !isUuid(artifactId)) {
        if (!isCancelled) {
          setCoachReviewStatus('none');
          setCoachReviewNotice('');
        }
        return;
      }

      let requesterUserId = artifactContext?.userId || null;
      if (!requesterUserId) {
        const { data } = await supabase.auth.getUser();
        requesterUserId = data.user?.id || null;
      }

      if (!requesterUserId) {
        if (!isCancelled) {
          setCoachReviewStatus('none');
          setCoachReviewNotice('');
        }
        return;
      }

      const { data, error } = await supabase
        .from('betterat_artifact_review_requests')
        .select('status,created_at')
        .eq('artifact_id', artifactId)
        .eq('requester_user_id', requesterUserId)
        .in('status', ['requested', 'in_review', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (isCancelled) return;

      if (error || !data) {
        setCoachReviewStatus('none');
        setCoachReviewNotice('');
        return;
      }

      const status = data.status as 'requested' | 'in_review' | 'completed';
      setCoachReviewStatus(status);
      if (status === 'requested' || status === 'in_review') {
        setCoachReviewNotice('Review requested');
      } else if (status === 'completed') {
        setCoachReviewNotice('Already reviewed');
      } else {
        setCoachReviewNotice('');
      }
    };

    loadExistingCoachReviewStatus();

    return () => {
      isCancelled = true;
    };
  }, [artifactContext?.userId, currentArtifactId, isClinicalReasoningCommitEnabled, isOpen, moduleId]);

  const handleGetFeedback = useCallback(async () => {
    if (!moduleId || !isClinicalReasoningCommitEnabled || !artifactContext) return;

    setFeedbackError('');
    setIsFeedbackLoading(true);

    try {
      const flushed = await (flushPendingSaveRef.current
        ? flushPendingSaveRef.current({ ensureSaved: true })
        : null);

      let artifactId = flushed?.artifact_id || currentArtifactId || null;

      if (!artifactId) {
        let resolvedUserId = artifactContext.userId || null;
        if (!resolvedUserId) {
          const { data } = await supabase.auth.getUser();
          resolvedUserId = data.user?.id || null;
        }
        if (resolvedUserId) {
          const existing = await getModuleArtifact({
            eventType: artifactContext.eventType,
            eventId: artifactContext.eventId,
            userId: resolvedUserId,
            moduleId,
          });
          artifactId = existing?.artifact_id || null;
        }
      }

      if (!artifactId) {
        throw new Error('Could not find a saved artifact to evaluate.');
      }

      const mappedIds = mappedCompetencyIds[moduleId] || [];
      const competencyIds = mappedIds.length > 0 ? mappedIds : CLINICAL_REASONING_CANDIDATE_IDS;

      let resolvedUserId = artifactContext.userId || null;
      if (!resolvedUserId) {
        const { data } = await supabase.auth.getUser();
        resolvedUserId = data.user?.id || null;
      }
      if (!resolvedUserId) {
        throw new Error('User session required for feedback.');
      }

      await logUnvalidatedArtifactAttempts({
        userId: resolvedUserId,
        candidateCompetencyIds: competencyIds,
        artifactId,
        eventType: artifactContext.eventType,
        eventId: artifactContext.eventId,
      });

      const evaluation = await evaluateClinicalReasoning({ artifactId, competencyIds });

      const { error: evaluationInsertError } = await supabase
        .from('betterat_module_evaluations')
        .upsert({
          artifact_id: artifactId,
          evaluator: 'claude',
          model: null,
          prompt_version: 'v1',
          rubric_version: 'v1',
          result: evaluation,
        }, { onConflict: 'artifact_id,prompt_version,rubric_version' });

      if (evaluationInsertError) {
        throw evaluationInsertError;
      }

      setFeedbackResultByModule((prev) => ({
        ...prev,
        [moduleId]: evaluation,
      }));
    } catch (error: any) {
      setFeedbackError(typeof error?.message === 'string' ? error.message : 'Could not get feedback right now.');
    } finally {
      setIsFeedbackLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    artifactContext,
    config.interestSlug,
    currentArtifactId,
    isClinicalReasoningCommitEnabled,
    mappedCompetencyIds,
    moduleId,
  ]);

  const handleRequestCoachReview = useCallback(async () => {
    if (!moduleId || !isClinicalReasoningCommitEnabled || !artifactContext) return;

    setIsRequestingCoachReview(true);
    setCoachReviewNotice('');

    try {
      const flushed = await (flushPendingSaveRef.current
        ? flushPendingSaveRef.current({ ensureSaved: true })
        : null);

      let artifactId = flushed?.artifact_id || currentArtifactId || null;

      let requesterUserId = artifactContext.userId || null;
      if (!requesterUserId) {
        const { data } = await supabase.auth.getUser();
        requesterUserId = data.user?.id || null;
      }
      if (!requesterUserId) {
        throw new Error('User session required for review request.');
      }

      if (!artifactId && artifactContext.eventType && artifactContext.eventId) {
        const existing = await getModuleArtifact({
          eventType: artifactContext.eventType,
          eventId: artifactContext.eventId,
          userId: requesterUserId,
          moduleId,
        });
        artifactId = existing?.artifact_id || null;
      }

      if (!artifactId || !isUuid(artifactId)) {
        throw new Error('Save this draft before requesting coach review.');
      }

      const { data: existingRequest, error: existingError } = await supabase
        .from('betterat_artifact_review_requests')
        .select('id,status,created_at')
        .eq('artifact_id', artifactId)
        .eq('requester_user_id', requesterUserId)
        .in('status', ['requested', 'in_review', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingRequest) {
        const existingStatus = existingRequest.status as 'requested' | 'in_review' | 'completed';
        setCoachReviewStatus(existingStatus);
        if (existingStatus === 'completed') {
          setCoachReviewNotice('Already reviewed');
        } else {
          setCoachReviewNotice('Review requested');
        }
        return;
      }

      const { error: insertError } = await supabase
        .from('betterat_artifact_review_requests')
        .insert({
          artifact_id: artifactId,
          requester_user_id: requesterUserId,
          coach_user_id: requesterUserId,
          status: 'requested',
          note: null,
        });

      if (insertError) {
        throw insertError;
      }

      setCoachReviewStatus('requested');
      setCoachReviewNotice('Review requested');
    } catch (error: any) {
      const message = typeof error?.message === 'string'
        ? error.message
        : 'Could not request coach review right now.';
      setCoachReviewNotice(message);
    } finally {
      setIsRequestingCoachReview(false);
    }
  }, [
    artifactContext,
    currentArtifactId,
    isClinicalReasoningCommitEnabled,
    moduleId,
  ]);

  if (!moduleId) return null;

  const moduleInfo = config.moduleInfo[moduleId];
  if (!moduleInfo) return null;

  const IconComponent = resolveIcon(moduleInfo.icon);
  const accent = MODULE_COLORS[moduleId] || C.blue;
  const content = MODULE_CONTENT[moduleId] || getDefaultContent(config.eventNoun);
  const currentNotes = notes[moduleId] || '';
  const currentAttachments = attachments[moduleId] || [];

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} closeOnOverlayClick={Platform.OS !== 'web'}>
      <ActionsheetBackdrop
        style={Platform.OS === 'web'
          ? { backgroundColor: 'rgba(0,0,0,0.15)', pointerEvents: 'none' as const }
          : { backgroundColor: 'rgba(0,0,0,0.15)' }
        }
      />
      <ActionsheetContent className="max-h-[90%] bg-background-0 web:select-auto" focusScope={false}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Compact Header */}
        <View style={s.header}>
          <View style={[s.headerIcon, { backgroundColor: `${accent}15` }]}>
            <IconComponent size={18} color={accent} />
          </View>
          <Text style={s.headerTitle}>{moduleInfo.label}</Text>
          {isNursingDraftModule && saveStatusLabel.length > 0 ? (
            <Text style={s.saveStatus}>{saveStatusLabel}</Text>
          ) : null}
          <Pressable
            style={s.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={C.gray} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ActionsheetScrollView
            style={{ width: '100%' }}
            contentContainerStyle={{ paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.body}>
              {/* Alert (if any) */}
              {content.alert && (
                <AlertSection title={content.alert.title} body={content.alert.body} />
              )}

              {/* Structured items — drillable or static */}
              {config.interestSlug === 'nursing' && moduleId === CLINICAL_REASONING_MODULE_ID ? (
                <MapsToSection
                  selectedIds={mappedCompetencyIds[moduleId] || []}
                  onAdd={handleAddMappedCompetency}
                  onRemove={handleRemoveMappedCompetency}
                />
              ) : null}
              {isClinicalReasoningCommitEnabled ? (
                <View style={s.feedbackCommitSection}>
                  <Pressable
                    style={[s.feedbackCommitButton, isFeedbackLoading && s.feedbackCommitButtonDisabled]}
                    onPress={handleGetFeedback}
                    disabled={isFeedbackLoading}
                  >
                    <Text style={s.feedbackCommitButtonText}>
                      {isFeedbackLoading ? 'Getting feedback…' : 'Get feedback'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      s.reviewRequestButton,
                      (isRequestingCoachReview
                        || !currentArtifactId
                        || coachReviewStatus === 'requested'
                        || coachReviewStatus === 'in_review'
                        || coachReviewStatus === 'completed')
                        && s.feedbackCommitButtonDisabled,
                    ]}
                    onPress={handleRequestCoachReview}
                    disabled={
                      isRequestingCoachReview
                      || !currentArtifactId
                      || coachReviewStatus === 'requested'
                      || coachReviewStatus === 'in_review'
                      || coachReviewStatus === 'completed'
                    }
                  >
                    <Text style={s.reviewRequestButtonText}>
                      {isRequestingCoachReview ? 'Requesting…' : 'Request coach review'}
                    </Text>
                  </Pressable>
                  {coachReviewNotice.length > 0 ? (
                    <Text style={s.reviewRequestNotice}>{coachReviewNotice}</Text>
                  ) : null}
                  <ClinicalReasoningFeedbackPanel
                    result={feedbackResultByModule[moduleId] || null}
                    isLoading={isFeedbackLoading}
                    errorText={feedbackError}
                  />
                </View>
              ) : null}
              {content.drillableItems ? (
                <DrillableItemsSection
                  items={moduleId === 'unit_protocols' ? PROTOCOL_LESSON_ITEMS : LAB_LESSON_ITEMS}
                  accent={accent}
                />
              ) : content.items ? (
                <ItemsSection items={content.items} accent={accent} />
              ) : null}

              {/* Interactive Tool OR Your Plan text area */}
              {content.tool && TOOL_REGISTRY[content.tool] ? (
                React.createElement(TOOL_REGISTRY[content.tool], {
                  values: toolValues[moduleId] || {},
                  onChange: handleToolStepChange,
                  accent,
                })
              ) : (
                <YourPlanSection
                  prompt={content.notesPrompt}
                  value={currentNotes}
                  onChange={(text) => {
                    markModuleDirty(moduleId);
                    setNotes((prev) => {
                      const updated = { ...prev, [moduleId]: text };
                      setTimeout(() => notifyContentChange(moduleId, updated, attachmentsRef.current), 0);
                      return updated;
                    });
                  }}
                  accent={accent}
                  richContent={content.richContent}
                  attachments={currentAttachments}
                  onAddAttachment={handleAddAttachment}
                  onRemoveAttachment={(id) => removeAttachment(moduleId, id)}
                  showLinkInput={showLinkInput}
                  linkUrl={linkUrl}
                  onLinkUrlChange={setLinkUrl}
                  onLinkSubmit={handleLinkSubmit}
                  onLinkCancel={handleLinkCancel}
                />
              )}

              {/* AI Coach */}
              <AICoachSection
                title={content.aiCoach.title}
                body={content.aiCoach.body}
                question={content.aiCoach.question}
              />

              {/* From Your Network */}
              <NetworkSection tips={content.network} />

              {/* Your History */}
              <HistorySection
                summary={content.history.summary}
                detail={content.history.detail}
              />
            </View>
          </ActionsheetScrollView>
        </KeyboardAvoidingView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.gray5,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.label,
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.gray5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  saveStatus: {
    fontSize: 12,
    color: C.secondaryLabel,
    marginRight: 8,
  },

  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },

  // Sections
  section: {
    gap: 8,
  },
  mapsToSection: {
    gap: 8,
    backgroundColor: C.gray6,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.gray5,
  },
  mapsToHint: {
    fontSize: 12,
    color: C.secondaryLabel,
  },
  mapsToSelectedList: {
    gap: 6,
  },
  mapsToSelectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.gray5,
  },
  mapsToSelectedTitle: {
    flex: 1,
    fontSize: 13,
    color: C.label,
    fontWeight: '500',
  },
  mapsToRemoveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  mapsToRemoveText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  mapsToAddList: {
    gap: 6,
  },
  mapsToAddItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  mapsToAddPrefix: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  mapsToAddTitle: {
    flex: 1,
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  mapsToEmpty: {
    fontSize: 13,
    color: C.secondaryLabel,
  },
  feedbackCommitSection: {
    gap: 8,
  },
  feedbackCommitButton: {
    backgroundColor: C.blue,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  feedbackCommitButtonDisabled: {
    opacity: 0.7,
  },
  feedbackCommitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewRequestButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  reviewRequestButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  reviewRequestNotice: {
    fontSize: 12,
    color: '#475467',
  },
  feedbackPanel: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 10,
    gap: 6,
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  feedbackScoreList: {
    gap: 6,
  },
  feedbackScoreItem: {
    gap: 3,
  },
  feedbackScoreHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  feedbackBullet: {
    fontSize: 12,
    color: '#1E40AF',
  },
  feedbackNextAction: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  feedbackLoading: {
    fontSize: 12,
    color: '#1E3A8A',
  },
  feedbackError: {
    fontSize: 12,
    color: '#B91C1C',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Notes input
  notesInput: {
    backgroundColor: C.gray6,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    color: C.label,
    minHeight: 100,
    borderWidth: 1,
    borderColor: C.gray5,
  },

  // AI Coach
  coachCard: {
    backgroundColor: C.coachBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.coachBorder,
    gap: 10,
  },
  coachTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
  },
  coachBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#78350F',
  },
  coachQuestionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginTop: 2,
  },
  coachQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#92400E',
    lineHeight: 20,
  },

  // Alert
  alertCard: {
    backgroundColor: C.warnBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.warnBorder,
    gap: 6,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C2410C',
  },
  alertBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9A3412',
  },

  // Items list
  itemsList: {
    gap: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.gray6,
    borderRadius: 10,
    marginBottom: 4,
    gap: 10,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.label,
  },
  itemDetail: {
    fontSize: 12,
    color: C.secondaryLabel,
    marginTop: 1,
  },

  // Network
  networkList: {
    gap: 10,
  },
  networkCard: {
    flexDirection: 'row',
    backgroundColor: C.networkBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.networkBorder,
    gap: 10,
  },
  networkAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A5D6A7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B5E20',
  },
  networkContent: {
    flex: 1,
  },
  networkNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  networkName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B5E20',
  },
  networkRole: {
    fontSize: 12,
    color: '#4CAF50',
  },
  networkTip: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2E7D32',
    fontStyle: 'italic',
  },

  // History
  historyCard: {
    backgroundColor: C.historyBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.historyBorder,
    gap: 8,
  },
  historySummary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
  },
  historyDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1976D2',
  },

  // Rich content toolbar
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: C.gray6,
    borderRadius: 12,
    marginTop: 8,
  },
  toolbarButton: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  toolbarIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Link input
  linkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  linkInput: {
    flex: 1,
    height: 40,
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.label,
    borderWidth: 1,
    borderColor: C.blue,
  },
  linkSubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.gray5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Attachment list
  attachmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 10,
    gap: 8,
    maxWidth: '100%',
  },
  attachmentThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  attachmentIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: C.label,
    flexShrink: 1,
    maxWidth: 180,
  },
  attachmentRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});

export default ModuleDetailBottomSheet;
