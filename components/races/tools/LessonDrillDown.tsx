/**
 * LessonDrillDown — Multi-depth lesson viewer for drillable items
 *
 * Each item (e.g., CBC, BMP, PT/INR) can expand into a lesson with:
 *   Level 1: Quick Reference — key facts, normal ranges, at-a-glance
 *   Level 2: Deep Dive — pathophysiology, clinical significance, case examples
 *   Level 3: Interrogate — ask questions, AI-assisted exploration
 *
 * External AI integration: ChatGPT, Claude, NotebookLM deep links
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import * as LucideIcons from 'lucide-react-native';

// =============================================================================
// TYPES
// =============================================================================

export interface LessonLevel {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  /** Structured content blocks for this depth level */
  blocks: LessonBlock[];
}

export interface LessonBlock {
  type: 'heading' | 'text' | 'table' | 'callout' | 'list';
  content: string;
  /** For tables: pipe-separated header row */
  header?: string;
  /** For tables: pipe-separated rows */
  rows?: string[];
  /** For lists: bullet items */
  items?: string[];
  /** For callouts: alert | tip | info */
  variant?: 'alert' | 'tip' | 'info';
}

export interface LessonItem {
  id: string;
  label: string;
  detail: string;
  status?: 'alert' | 'ok' | 'info';
  /** Lesson content at multiple depth levels */
  lesson: {
    levels: LessonLevel[];
    /** Pre-formed question for AI tools */
    aiPrompt: string;
  };
}

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
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
};

// =============================================================================
// AI TOOL INTEGRATION
// =============================================================================

interface AITool {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  getUrl: (prompt: string) => string;
}

const AI_TOOLS: AITool[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: LucideIcons.MessageSquare,
    color: '#10A37F',
    bgColor: '#E6F7F2',
    getUrl: (prompt) => `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: LucideIcons.Sparkles,
    color: '#D97706',
    bgColor: '#FEF3C7',
    getUrl: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: 'notebooklm',
    name: 'NotebookLM',
    icon: LucideIcons.BookOpen,
    color: '#4285F4',
    bgColor: '#E8F0FE',
    getUrl: (_prompt) => `https://notebooklm.google.com/`,
  },
];

// =============================================================================
// LESSON DRILL DOWN COMPONENT
// =============================================================================

interface LessonDrillDownProps {
  item: LessonItem;
  accent: string;
  onBack: () => void;
}

export function LessonDrillDown({ item, accent, onBack }: LessonDrillDownProps) {
  const [activeLevel, setActiveLevel] = useState(0);
  const levels = item.lesson.levels;
  const currentLevel = levels[activeLevel];

  return (
    <View style={ls.container}>
      {/* Back button + title */}
      <Pressable onPress={onBack} style={ls.backRow}>
        <LucideIcons.ChevronLeft size={20} color={accent} />
        <Text style={[ls.backText, { color: accent }]}>Back</Text>
      </Pressable>

      <Text style={ls.title}>{item.label}</Text>
      <Text style={ls.subtitle}>{item.detail}</Text>

      {/* Depth level tabs */}
      <View style={ls.levelTabs}>
        {levels.map((level, i) => {
          const isActive = i === activeLevel;
          const LevelIcon = level.icon;
          return (
            <Pressable
              key={level.id}
              style={[
                ls.levelTab,
                isActive && { backgroundColor: level.color, borderColor: level.color },
              ]}
              onPress={() => setActiveLevel(i)}
            >
              <LevelIcon size={14} color={isActive ? '#FFF' : level.color} />
              <Text
                style={[
                  ls.levelTabText,
                  isActive ? { color: '#FFF' } : { color: level.color },
                ]}
              >
                {level.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Depth indicator */}
      <View style={ls.depthIndicator}>
        {levels.map((_, i) => (
          <View
            key={i}
            style={[
              ls.depthDot,
              {
                backgroundColor: i <= activeLevel ? currentLevel.color : C.gray5,
                width: i === activeLevel ? 20 : 8,
              },
            ]}
          />
        ))}
        <Text style={ls.depthLabel}>
          Depth {activeLevel + 1} of {levels.length}
        </Text>
      </View>

      {/* Content blocks */}
      <View style={ls.content}>
        {currentLevel.blocks.map((block, i) => (
          <LessonBlockRenderer key={`${currentLevel.id}-${i}`} block={block} accent={currentLevel.color} />
        ))}
      </View>

      {/* Navigate deeper / shallower */}
      <View style={ls.navRow}>
        {activeLevel > 0 && (
          <Pressable
            style={[ls.navButton, { borderColor: C.gray3 }]}
            onPress={() => setActiveLevel(activeLevel - 1)}
          >
            <LucideIcons.ChevronUp size={16} color={C.gray} />
            <Text style={[ls.navButtonText, { color: C.gray }]}>
              {levels[activeLevel - 1].title}
            </Text>
          </Pressable>
        )}
        {activeLevel < levels.length - 1 && (
          <Pressable
            style={[ls.navButton, { borderColor: levels[activeLevel + 1].color, backgroundColor: `${levels[activeLevel + 1].color}10` }]}
            onPress={() => setActiveLevel(activeLevel + 1)}
          >
            <LucideIcons.ChevronDown size={16} color={levels[activeLevel + 1].color} />
            <Text style={[ls.navButtonText, { color: levels[activeLevel + 1].color }]}>
              Go Deeper: {levels[activeLevel + 1].title}
            </Text>
          </Pressable>
        )}
      </View>

      {/* AI Integration */}
      <View style={ls.aiSection}>
        <View style={ls.aiHeader}>
          <LucideIcons.Zap size={15} color={C.orange} />
          <Text style={ls.aiTitle}>Explore further</Text>
        </View>
        <Text style={ls.aiDescription}>
          Take this topic deeper with an assistant
        </Text>
        <View style={ls.aiTools}>
          {AI_TOOLS.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <Pressable
                key={tool.id}
                style={[ls.aiToolButton, { backgroundColor: tool.bgColor, borderColor: `${tool.color}30` }]}
                onPress={() => {
                  const url = tool.getUrl(item.lesson.aiPrompt);
                  Linking.openURL(url).catch(() => {});
                }}
              >
                <ToolIcon size={18} color={tool.color} />
                <Text style={[ls.aiToolText, { color: tool.color }]}>
                  {tool.name}
                </Text>
                <LucideIcons.ExternalLink size={12} color={tool.color} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// DRILLABLE ITEMS LIST
// =============================================================================

interface DrillableItemsSectionProps {
  items: LessonItem[];
  accent: string;
}

export function DrillableItemsSection({ items, accent }: DrillableItemsSectionProps) {
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const activeItem = activeLessonId ? items.find((it) => it.id === activeLessonId) : null;

  if (activeItem) {
    return (
      <LessonDrillDown
        item={activeItem}
        accent={accent}
        onBack={() => setActiveLessonId(null)}
      />
    );
  }

  return (
    <View style={ls.itemsList}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={ls.itemRow}
          onPress={() => setActiveLessonId(item.id)}
        >
          <View
            style={[
              ls.itemDot,
              {
                backgroundColor:
                  item.status === 'alert' ? C.orange :
                  item.status === 'ok' ? C.green : accent,
              },
            ]}
          />
          <View style={ls.itemContent}>
            <Text style={ls.itemLabel}>{item.label}</Text>
            <Text style={ls.itemDetail}>{item.detail}</Text>
          </View>
          {item.status === 'alert' && (
            <LucideIcons.AlertCircle size={16} color={C.orange} />
          )}
          {item.status === 'ok' && (
            <LucideIcons.CheckCircle size={16} color={C.green} />
          )}
          <LucideIcons.ChevronRight size={16} color={C.gray3} />
        </Pressable>
      ))}
      <View style={ls.drillHint}>
        <LucideIcons.GraduationCap size={13} color={C.gray} />
        <Text style={ls.drillHintText}>Tap any item to explore the lesson</Text>
      </View>
    </View>
  );
}

// =============================================================================
// BLOCK RENDERERS
// =============================================================================

function LessonBlockRenderer({ block, accent }: { block: LessonBlock; accent: string }) {
  switch (block.type) {
    case 'heading':
      return <Text style={ls.blockHeading}>{block.content}</Text>;

    case 'text':
      return <Text style={ls.blockText}>{block.content}</Text>;

    case 'list':
      return (
        <View style={ls.blockList}>
          {(block.items || []).map((item, i) => (
            <View key={i} style={ls.blockListItem}>
              <View style={[ls.blockBullet, { backgroundColor: accent }]} />
              <Text style={ls.blockListText}>{item}</Text>
            </View>
          ))}
        </View>
      );

    case 'table':
      return (
        <View style={ls.blockTable}>
          {block.header && (
            <View style={[ls.blockTableRow, ls.blockTableHeader]}>
              {block.header.split('|').map((cell, i) => (
                <Text key={i} style={[ls.blockTableCell, ls.blockTableHeaderCell, { flex: 1 }]}>
                  {cell.trim()}
                </Text>
              ))}
            </View>
          )}
          {(block.rows || []).map((row, i) => (
            <View key={i} style={[ls.blockTableRow, i % 2 === 1 && ls.blockTableRowAlt]}>
              {row.split('|').map((cell, j) => (
                <Text key={j} style={[ls.blockTableCell, { flex: 1 }]}>
                  {cell.trim()}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );

    case 'callout': {
      const variants = {
        alert: { bg: '#FEF2F2', border: '#FECACA', icon: LucideIcons.AlertTriangle, color: C.red },
        tip: { bg: '#F0FDF4', border: '#BBF7D0', icon: LucideIcons.Lightbulb, color: C.green },
        info: { bg: '#EFF6FF', border: '#BFDBFE', icon: LucideIcons.Info, color: C.blue },
      };
      const v = variants[block.variant || 'info'];
      const CalloutIcon = v.icon;
      return (
        <View style={[ls.blockCallout, { backgroundColor: v.bg, borderColor: v.border }]}>
          <CalloutIcon size={16} color={v.color} />
          <Text style={[ls.blockCalloutText, { color: v.color }]}>{block.content}</Text>
        </View>
      );
    }

    default:
      return null;
  }
}

// =============================================================================
// LAB LESSON DATA
// =============================================================================

export const LAB_LESSON_ITEMS: LessonItem[] = [
  {
    id: 'bmp',
    label: 'BMP (Basic Metabolic Panel)',
    detail: 'Na, K, Cl, CO2, BUN, Cr, Glucose',
    status: 'info',
    lesson: {
      aiPrompt: 'I\'m a nursing student studying the Basic Metabolic Panel (BMP). Help me understand the clinical significance of each component (Na, K, Cl, CO2, BUN, Creatinine, Glucose), normal ranges, critical values, and common clinical scenarios where BMP abnormalities guide nursing interventions.',
      levels: [
        {
          id: 'bmp-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'Normal Ranges' },
            {
              type: 'table',
              content: '',
              header: 'Component | Normal Range | Critical Low | Critical High',
              rows: [
                'Sodium (Na) | 136–145 mEq/L | <120 | >160',
                'Potassium (K) | 3.5–5.0 mEq/L | <2.5 | >6.5',
                'Chloride (Cl) | 98–106 mEq/L | <80 | >120',
                'CO₂ | 23–29 mEq/L | <15 | >40',
                'BUN | 7–20 mg/dL | — | >100',
                'Creatinine | 0.7–1.3 mg/dL | — | >10',
                'Glucose | 70–100 mg/dL | <40 | >500',
              ],
            },
            { type: 'callout', content: 'Potassium is the most immediately dangerous critical value — can cause fatal arrhythmias. Always verify critical K+ and notify the provider immediately.', variant: 'alert' },
            { type: 'heading', content: 'What It Tells You' },
            {
              type: 'list',
              content: '',
              items: [
                'Electrolyte balance (Na, K, Cl, CO₂)',
                'Kidney function (BUN, Creatinine)',
                'Blood sugar regulation (Glucose)',
                'Acid-base status (CO₂)',
              ],
            },
          ],
        },
        {
          id: 'bmp-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'Sodium (Na)' },
            { type: 'text', content: 'Sodium is the primary determinant of extracellular fluid volume. Hyponatremia (<136) is the most common electrolyte disorder in hospitalized patients.' },
            {
              type: 'list',
              content: '',
              items: [
                'Hyponatremia: confusion, seizures, nausea. Common in CHF, SIADH, cirrhosis.',
                'Hypernatremia: thirst, restlessness, lethargy. Often dehydration or diabetes insipidus.',
                'Correction rate matters — too-rapid correction of hyponatremia risks osmotic demyelination syndrome.',
              ],
            },
            { type: 'heading', content: 'Potassium (K)' },
            { type: 'text', content: 'Potassium governs cardiac and neuromuscular excitability. Even small deviations are dangerous.' },
            {
              type: 'list',
              content: '',
              items: [
                'Hypokalemia (<3.5): muscle weakness, EKG changes (flattened T-waves, U-waves). Common with diuretics, vomiting, NG suction.',
                'Hyperkalemia (>5.0): peaked T-waves, widened QRS, risk of V-fib. Common in renal failure, ACE inhibitors, K+ supplements.',
                'NEVER push IV potassium — always infuse. Max rate typically 10 mEq/hr on floor.',
              ],
            },
            { type: 'heading', content: 'BUN/Creatinine Ratio' },
            { type: 'text', content: 'The BUN:Cr ratio helps differentiate pre-renal (>20:1) from intrinsic renal disease (~10:1). A rising creatinine is the clearest sign of declining kidney function.' },
            { type: 'callout', content: 'If BUN is rising but creatinine is stable, think dehydration or GI bleed — not necessarily kidney failure.', variant: 'tip' },
            { type: 'heading', content: 'Glucose' },
            { type: 'text', content: 'Glucose <70 mg/dL requires immediate intervention (15g fast-acting carb, recheck in 15 min). Glucose >300 with symptoms may indicate DKA or HHS — check for ketones, anion gap.' },
          ],
        },
        {
          id: 'bmp-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Case: CHF Patient Post-Diuresis' },
            { type: 'text', content: 'Your patient received Furosemide 40mg IV. Labs drawn 4 hours later show: K+ 3.1, Na 132, BUN 28, Cr 1.1, Glucose 145.' },
            { type: 'callout', content: 'What do you do first? What do you report? What labs do you recheck and when?', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'K+ 3.1 is below normal — assess for symptoms (weakness, irregular pulse), notify provider, anticipate K+ replacement order.',
                'Na 132 is mildly low — related to fluid shifts with diuresis. Monitor trend.',
                'BUN:Cr ratio is 25:1 — suggests pre-renal component (dehydration from diuresis). Check I&O, daily weight.',
                'Glucose 145 — mildly elevated, may need monitoring if patient is diabetic.',
              ],
            },
            { type: 'heading', content: 'Nursing Interventions to Consider' },
            {
              type: 'list',
              content: '',
              items: [
                'Hold next diuretic dose until discussing with provider',
                'Assess orthostatic vitals — patient may be volume-depleted',
                'Document I&O accurately — trending output vs intake',
                'Recheck K+ after replacement per protocol',
                'Monitor EKG rhythm if available — watch for U-waves',
              ],
            },
            { type: 'callout', content: 'The best nurses don\'t just report numbers — they report numbers with context. "K is 3.1, down from 3.8 pre-diuresis, patient is having muscle cramps" gets faster action than "K is 3.1."', variant: 'tip' },
          ],
        },
      ],
    },
  },
  {
    id: 'cbc',
    label: 'CBC (Complete Blood Count)',
    detail: 'WBC, Hgb, Hct, Platelets',
    status: 'info',
    lesson: {
      aiPrompt: 'I\'m a nursing student studying the Complete Blood Count (CBC). Help me understand WBC, hemoglobin, hematocrit, and platelets — normal ranges, critical values, what abnormalities indicate, and nursing interventions for common CBC derangements.',
      levels: [
        {
          id: 'cbc-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'Normal Ranges' },
            {
              type: 'table',
              content: '',
              header: 'Component | Normal Range | Critical Low | Critical High',
              rows: [
                'WBC | 4,500–11,000/μL | <2,000 | >30,000',
                'Hemoglobin | 12–17.5 g/dL | <7 | >20',
                'Hematocrit | 36–52% | <21% | >60%',
                'Platelets | 150,000–400,000/μL | <50,000 | >1,000,000',
              ],
            },
            { type: 'callout', content: 'A WBC <2,000 (neutropenia) means high infection risk — implement neutropenic precautions immediately. No fresh flowers, no raw food, strict hand hygiene.', variant: 'alert' },
            {
              type: 'list',
              content: '',
              items: [
                'WBC tells you about infection and immune status',
                'Hemoglobin/Hematocrit reflect oxygen-carrying capacity',
                'Platelets assess bleeding and clotting risk',
              ],
            },
          ],
        },
        {
          id: 'cbc-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'WBC Differential' },
            { type: 'text', content: 'The WBC count alone is useful, but the differential tells you the story:' },
            {
              type: 'list',
              content: '',
              items: [
                'Neutrophils (55–70%): First responders. Elevated = bacterial infection. "Left shift" (↑bands) = acute infection.',
                'Lymphocytes (20–40%): Elevated in viral infections, CLL. Decreased in HIV, immunosuppression.',
                'Monocytes (2–8%): Elevated in chronic inflammation, TB.',
                'Eosinophils (1–4%): Elevated in allergies, parasitic infections, asthma.',
                'Basophils (0.5–1%): Rarely elevated. Associated with hypersensitivity reactions.',
              ],
            },
            { type: 'heading', content: 'Hemoglobin vs. Hematocrit' },
            { type: 'text', content: 'Hematocrit is roughly 3× hemoglobin. In acute bleeding, both drop — but beware: in early hemorrhage, Hgb/Hct may appear normal because plasma and cells are lost proportionally. The true drop shows hours later as the body compensates with fluid shifts.' },
            { type: 'callout', content: 'A tachycardic patient with normal Hgb after trauma may still be actively bleeding — Hgb hasn\'t equilibrated yet. Trend vitals and reassess.', variant: 'alert' },
            { type: 'heading', content: 'Platelets' },
            { type: 'text', content: 'Thrombocytopenia (<150K) increases bleeding risk. Below 50K — hold invasive procedures. Below 20K — spontaneous bleeding risk, may need platelet transfusion.' },
            {
              type: 'list',
              content: '',
              items: [
                'Common causes of low platelets: HIT (heparin), DIC, ITP, chemo, liver disease',
                'Elevated platelets: reactive (infection, inflammation) vs. primary (myeloproliferative)',
                'If on heparin and platelets drop >50% — think HIT, stop heparin, notify provider urgently',
              ],
            },
          ],
        },
        {
          id: 'cbc-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Case: Post-Op Day 2, Hip Replacement' },
            { type: 'text', content: 'Your patient is POD2 after total hip replacement. On prophylactic enoxaparin. Labs: WBC 14.2, Hgb 9.1 (pre-op was 12.3), Hct 27%, Platelets 98K (pre-op 220K).' },
            { type: 'callout', content: 'What concerns you most? What do you assess? What do you report?', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'Hgb dropped from 12.3 → 9.1 — expected post-surgical decline, but monitor for ongoing bleeding (check drain output, surgical site)',
                'WBC 14.2 — mild elevation can be normal post-op stress response. Assess for fever, wound redness, urinary symptoms.',
                'Platelets dropped from 220K → 98K — this is a >50% drop on a patient receiving heparin. THINK HIT (Heparin-Induced Thrombocytopenia).',
                'Priority: Report the platelet trend to the provider. Calculate the 4T score. Anticipate holding enoxaparin and drawing HIT antibodies.',
              ],
            },
            { type: 'callout', content: 'HIT is a clinical emergency that\'s easy to miss. The classic pattern: platelet drop 5–10 days after starting heparin (including LMWH). Don\'t wait for the lab confirmation to stop the drug.', variant: 'alert' },
          ],
        },
      ],
    },
  },
  {
    id: 'pt_inr',
    label: 'PT/INR',
    detail: 'Check if patient on anticoagulants',
    status: 'alert',
    lesson: {
      aiPrompt: 'I\'m a nursing student learning about PT/INR. Help me understand prothrombin time, INR, therapeutic ranges for warfarin, nursing considerations for anticoagulation monitoring, and what to do when INR is critically high or low.',
      levels: [
        {
          id: 'ptinr-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'Normal Ranges' },
            {
              type: 'table',
              content: '',
              header: 'Test | Normal | Therapeutic (Warfarin) | Critical',
              rows: [
                'PT | 11–13.5 sec | — | >30 sec',
                'INR | 0.8–1.1 | 2.0–3.0 | >5.0',
                'INR (mech. valve) | — | 2.5–3.5 | >5.0',
              ],
            },
            { type: 'callout', content: 'INR >5 = high bleeding risk. INR >9 = consider Vitamin K administration. Always check for bleeding signs: dark stool, blood in urine, bruising, gum bleeding.', variant: 'alert' },
            {
              type: 'list',
              content: '',
              items: [
                'PT measures extrinsic clotting pathway (affected by warfarin)',
                'INR standardizes PT across labs — the universal comparison',
                'PTT/aPTT measures intrinsic pathway (affected by heparin)',
              ],
            },
          ],
        },
        {
          id: 'ptinr-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'Warfarin Pharmacology' },
            { type: 'text', content: 'Warfarin inhibits Vitamin K-dependent clotting factors (II, VII, IX, X). It takes 3–5 days for full therapeutic effect because existing clotting factors must be depleted. That\'s why patients are "bridged" with heparin initially.' },
            { type: 'heading', content: 'Drug & Food Interactions' },
            {
              type: 'list',
              content: '',
              items: [
                'Vitamin K-rich foods (dark greens, broccoli) DECREASE INR — counsel consistency, not avoidance',
                'NSAIDs, aspirin, fish oil INCREASE bleeding risk without changing INR',
                'Antibiotics (especially fluoroquinolones, metronidazole) can dramatically INCREASE INR',
                'Acetaminophen in high doses (>2g/day for days) can increase INR',
                'Cranberry juice, grapefruit — variable interaction, monitor closely',
              ],
            },
            { type: 'heading', content: 'INR Management' },
            {
              type: 'table',
              content: '',
              header: 'INR | Action',
              rows: [
                '<2.0 | Subtherapeutic — increase dose or give bridge anticoagulation',
                '2.0–3.0 | Therapeutic for most indications — maintain',
                '3.1–5.0 | Hold 1–2 doses, recheck, reduce maintenance dose',
                '5.0–9.0 | Hold warfarin, consider low-dose Vitamin K (1–2.5mg PO)',
                '>9.0 | Hold warfarin, give Vitamin K, consider FFP if bleeding',
              ],
            },
            { type: 'callout', content: 'Patient education is a critical nursing role: take warfarin at the same time daily, wear a medical alert bracelet, avoid contact sports, use electric razor, use soft toothbrush.', variant: 'tip' },
          ],
        },
        {
          id: 'ptinr-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Case: A-Fib Patient on Warfarin' },
            { type: 'text', content: 'Your patient has atrial fibrillation on warfarin 5mg daily. Today\'s INR is 6.2. Patient reports starting an antibiotic (ciprofloxacin) 3 days ago for UTI. Denies bleeding but mentions a large bruise on their arm.' },
            { type: 'callout', content: 'What is your priority assessment? What interventions do you anticipate?', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'Assess for active bleeding: guaiac stool, check urine, inspect skin, check neuro status (intracranial bleed)',
                'Cause identified: Cipro inhibits warfarin metabolism → INR spike. This is a known interaction.',
                'Hold today\'s warfarin dose — do NOT give.',
                'Notify provider with context: "INR 6.2, up from 2.4 last week, started cipro 3 days ago, has new bruising, no active bleeding found."',
                'Anticipate orders: hold warfarin, possible Vitamin K 2.5mg PO, recheck INR tomorrow, consider alternative antibiotic.',
                'Fall precautions — high bleed risk means any fall is now potentially life-threatening.',
              ],
            },
            { type: 'callout', content: 'The bruise is a sign of over-anticoagulation, but it\'s the hidden bleeds you worry about — GI and intracranial. A thorough head-to-toe with focus on neuro and GI assessment is essential.', variant: 'alert' },
          ],
        },
      ],
    },
  },
  {
    id: 'bnp',
    label: 'BNP',
    detail: 'Heart failure marker — check trend',
    status: 'info',
    lesson: {
      aiPrompt: 'I\'m a nursing student studying BNP (B-type Natriuretic Peptide). Help me understand what BNP measures, normal vs elevated values, how it\'s used to assess heart failure severity, and nursing implications for patients with elevated BNP.',
      levels: [
        {
          id: 'bnp-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'Normal Ranges' },
            {
              type: 'table',
              content: '',
              header: 'Test | Normal | Suggestive of HF | Severe HF',
              rows: [
                'BNP | <100 pg/mL | 100–400 | >400',
                'NT-proBNP | <300 pg/mL | 300–900 | >900',
              ],
            },
            { type: 'text', content: 'BNP is released by the ventricles when they\'re stretched by volume overload. Higher BNP = more stretch = worse heart failure.' },
            { type: 'callout', content: 'BNP is a trend marker — the absolute number matters less than the direction. A BNP dropping from 800 → 400 after diuresis = good response to treatment.', variant: 'tip' },
            {
              type: 'list',
              content: '',
              items: [
                'Quick screen: Is this dyspnea from heart failure or lungs?',
                'BNP <100 makes heart failure very unlikely',
                'BNP >400 strongly suggests acute heart failure',
                'Gray zone (100–400): clinical judgment needed',
              ],
            },
          ],
        },
        {
          id: 'bnp-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'Physiology' },
            { type: 'text', content: 'BNP (B-type Natriuretic Peptide) is a hormone secreted by ventricular cardiomyocytes in response to wall stress from volume overload or pressure overload. Its physiologic effects are compensatory: vasodilation, diuresis, and natriuresis — essentially, the heart asking the body to reduce its workload.' },
            { type: 'heading', content: 'BNP vs NT-proBNP' },
            {
              type: 'list',
              content: '',
              items: [
                'Both are released when proBNP is cleaved. BNP is the active hormone; NT-proBNP is the inactive fragment.',
                'NT-proBNP has a longer half-life (120 min vs 20 min) — more stable for trending',
                'NT-proBNP is cleared by kidneys — falsely elevated in renal failure',
                'BNP is metabolized by neprilysin — affected by sacubitril (Entresto lowers BNP but NOT NT-proBNP)',
              ],
            },
            { type: 'heading', content: 'False Positives & Negifiers' },
            {
              type: 'list',
              content: '',
              items: [
                'Elevated without HF: renal failure, PE, sepsis, A-fib, advanced age',
                'Falsely LOW in obesity (adipose tissue clears BNP faster)',
                'Flash pulmonary edema may have normal BNP initially (not enough time for release)',
                'Always correlate with clinical presentation — BNP is a piece of the puzzle, not the diagnosis.',
              ],
            },
            { type: 'callout', content: 'In patients on Entresto (sacubitril/valsartan), use NT-proBNP to monitor HF — sacubitril inhibits BNP breakdown, making BNP levels unreliable.', variant: 'tip' },
          ],
        },
        {
          id: 'bnp-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Case: Dyspneic Patient in the ED' },
            { type: 'text', content: 'A 68-year-old presents with worsening dyspnea over 3 days, bilateral leg edema, 4-lb weight gain. History of CHF (EF 35%), COPD, and CKD stage 3. BNP is 890 pg/mL (baseline 3 months ago was 250). Creatinine 1.8 (baseline 1.4).' },
            { type: 'callout', content: 'Is this HF exacerbation, COPD exacerbation, or both? What does the BNP trend tell you?', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'BNP jumped from 250 → 890 — significant rise strongly supports acute decompensated HF',
                'Weight gain + edema + rising BNP = volume overload. Anticipate IV diuretic orders.',
                'Creatinine also rose — cardiorenal syndrome? Kidneys struggling because cardiac output is poor.',
                'COPD could coexist — listen for wheezing vs crackles. BNP helps differentiate: this rise makes HF the primary driver.',
              ],
            },
            { type: 'heading', content: 'Your Nursing Priorities' },
            {
              type: 'list',
              content: '',
              items: [
                'Strict I&O, daily weights (same time, same scale, same clothing)',
                'Elevate HOB, apply O₂ per order, continuous SpO₂',
                'Monitor for diuretic response (urine output should increase within 30 min of IV furosemide)',
                'Trend BNP — recheck in 24–48 hours to assess response',
                'Watch creatinine closely — aggressive diuresis can worsen renal function',
                'Fluid restriction likely ordered — educate patient, track intake carefully',
              ],
            },
            { type: 'callout', content: 'The goal isn\'t a "normal" BNP — many chronic HF patients have a stable elevated baseline. The goal is getting back to THEIR baseline. Know your patient\'s trajectory.', variant: 'tip' },
          ],
        },
      ],
    },
  },
];

// =============================================================================
// UNIT PROTOCOL LESSON DATA
// =============================================================================

export const PROTOCOL_LESSON_ITEMS: LessonItem[] = [
  {
    id: 'isolation',
    label: 'Isolation Precautions',
    detail: 'Contact, droplet, airborne, protective',
    status: 'alert',
    lesson: {
      aiPrompt: 'I\'m a nursing student reviewing isolation precautions. Help me understand the differences between contact, droplet, airborne, and protective isolation — when each is used, required PPE, patient placement, and common mistakes nursing students make.',
      levels: [
        {
          id: 'iso-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'Isolation Types at a Glance' },
            {
              type: 'table',
              content: '',
              header: 'Type | PPE Required | Examples',
              rows: [
                'Contact | Gown + gloves | MRSA, VRE, C. diff, scabies',
                'Droplet | Surgical mask + gown + gloves | Flu, pertussis, meningitis',
                'Airborne | N95 + gown + gloves, negative pressure room | TB, measles, varicella, COVID',
                'Protective (reverse) | Gown + mask + gloves (protect the patient) | Neutropenic, transplant, chemo',
              ],
            },
            { type: 'callout', content: 'C. diff requires SOAP AND WATER handwashing — alcohol-based sanitizer does NOT kill C. diff spores. This is the #1 mistake.', variant: 'alert' },
            {
              type: 'list',
              content: '',
              items: [
                'Don PPE BEFORE entering the room',
                'Remove PPE BEFORE leaving (except N95 — remove outside)',
                'Gloves come off first, then gown, then hand hygiene, then mask/N95',
                'Dedicated equipment stays in the room (stethoscope, BP cuff)',
              ],
            },
          ],
        },
        {
          id: 'iso-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'Contact Precautions' },
            { type: 'text', content: 'Contact transmission occurs via direct touch or indirect contact with contaminated surfaces. These organisms can survive on surfaces for hours to days.' },
            {
              type: 'list',
              content: '',
              items: [
                'MRSA: Can colonize without infection. Survives on surfaces for weeks. Screen high-risk patients on admission.',
                'C. difficile: Spore-forming. Survives alcohol sanitizer. Must use soap + water. Can persist on surfaces for months.',
                'VRE: Often colonizes GI tract. Major concern in ICU patients with prolonged antibiotic courses.',
                'Scabies/lice: Direct skin-to-skin contact. Gown + gloves essential. Laundry handled separately.',
              ],
            },
            { type: 'heading', content: 'Airborne Precautions' },
            { type: 'text', content: 'Airborne pathogens travel via small droplet nuclei (<5 μm) that remain suspended in air and can travel long distances. These require N95 respirators and negative-pressure rooms.' },
            {
              type: 'list',
              content: '',
              items: [
                'TB: Patient must be in negative pressure room. Door must stay CLOSED. N95 fit-tested annually.',
                'Measles/Varicella: Extremely contagious. Check your own immunity status before entering.',
                'COVID-19: Airborne + contact. N95 or PAPR for aerosol-generating procedures.',
                'Negative pressure rooms pull air IN — contaminated air is filtered before exhausting. Verify the room is actually running (check pressure monitor).',
              ],
            },
            { type: 'callout', content: 'Know your N95 fit test date. An unfitted N95 gives a false sense of security. If you haven\'t been fit-tested, you should NOT enter an airborne isolation room.', variant: 'alert' },
            { type: 'heading', content: 'Protective (Reverse) Isolation' },
            { type: 'text', content: 'Here the goal is protecting the patient, not you. Used for immunocompromised patients — their immune system can\'t fight what you might carry in.' },
            {
              type: 'list',
              content: '',
              items: [
                'No fresh flowers or plants (harbor bacteria and fungi)',
                'No fresh fruits or raw vegetables (potential pathogens)',
                'Limit visitors, screen for illness',
                'Strict hand hygiene — you are the vector',
              ],
            },
          ],
        },
        {
          id: 'iso-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Scenario: Multiple Isolation Patients' },
            { type: 'text', content: 'You\'re assigned 3 patients: Room 412 — MRSA wound infection (contact). Room 415 — Influenza, elderly (droplet). Room 418 — Active TB, awaiting sputum cultures (airborne). You also need to draw labs on all three.' },
            { type: 'callout', content: 'In what order do you see these patients? What PPE changes between each? What mistakes would be easy to make?', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'See the influenza (droplet) patient first — least complex PPE and lowest cross-contamination risk to others.',
                'Then MRSA (contact) — dedicated stethoscope in room. Full gown/gloves. Soap + water hand hygiene because you\'ll see C. diff-level organisms next.',
                'TB patient LAST — requires N95 and negative pressure room. Minimize door openings. You can\'t reuse that N95 for your other patients.',
                'Common mistake: Rushing between rooms without changing gloves. Even "quick" room entries require full PPE cycle.',
                'Draw labs with isolation-appropriate PPE. Label specimens with isolation status for the lab.',
              ],
            },
            { type: 'callout', content: 'Time management tip: Cluster care for isolation patients. Each entry/exit requires full PPE change — plan ahead so you\'re not gowning up 6 times for 3 tasks you could do in 2 visits.', variant: 'tip' },
          ],
        },
      ],
    },
  },
  {
    id: 'fall_risk',
    label: 'Fall Risk Protocol',
    detail: 'Assessment, prevention, post-fall procedure',
    status: 'info',
    lesson: {
      aiPrompt: 'I\'m a nursing student studying fall risk protocols. Help me understand the Morse Fall Scale, fall prevention interventions, post-fall assessment procedures, and nursing documentation requirements for falls.',
      levels: [
        {
          id: 'fall-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'Morse Fall Scale' },
            {
              type: 'table',
              content: '',
              header: 'Risk Factor | Points',
              rows: [
                'History of falling (within 3 months) | 25',
                'Secondary diagnosis | 15',
                'Ambulatory aid (furniture, cane, walker, crutches) | 15–30',
                'IV therapy or heparin lock | 20',
                'Gait (impaired, weak) | 10–20',
                'Mental status (forgets limitations) | 15',
              ],
            },
            {
              type: 'table',
              content: '',
              header: 'Score | Risk Level | Action',
              rows: [
                '0–24 | Low risk | Basic fall precautions',
                '25–50 | Moderate risk | Standard fall protocol',
                '51+ | High risk | High-risk fall interventions',
              ],
            },
            { type: 'callout', content: 'Fall risk is reassessed: on admission, every shift, after any fall, after procedure/sedation, and with any change in condition or medications.', variant: 'tip' },
          ],
        },
        {
          id: 'fall-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'Prevention Interventions by Risk Level' },
            { type: 'text', content: 'Every patient gets basic precautions. As risk increases, so do interventions:' },
            {
              type: 'list',
              content: '',
              items: [
                'ALL patients: Bed in lowest position, brakes locked, call light within reach, non-skid footwear, clear pathway to bathroom.',
                'Moderate risk: Yellow fall risk bracelet, "Fall Risk" signage, scheduled toileting, medication review (sedatives, diuretics, antihypertensives).',
                'High risk: Bed alarm, 1:1 sitter consideration, move closer to nurses\' station, hourly rounding with purposeful checks (4 P\'s: pain, potty, position, possessions).',
              ],
            },
            { type: 'heading', content: 'Medication-Related Fall Risk' },
            {
              type: 'list',
              content: '',
              items: [
                'Opioids & benzodiazepines: Sedation, impaired balance, delayed reaction time',
                'Antihypertensives: Orthostatic hypotension — teach patients to sit before standing',
                'Diuretics: Frequent urination → rushing to bathroom. Electrolyte imbalances → weakness',
                'Anticoagulants: Don\'t increase fall risk, but make falls MORE DANGEROUS (bleeding risk)',
                'Polypharmacy (5+ meds): Each additional medication increases fall risk. Review with pharmacist.',
              ],
            },
            { type: 'heading', content: 'Post-Fall Protocol' },
            {
              type: 'list',
              content: '',
              items: [
                '1. Don\'t move the patient until you assess for injury (especially head, hip, spine)',
                '2. Call for help — you need a second person',
                '3. Vitals including neuro checks — LOC, pupils, orientation',
                '4. Notify provider — include: mechanism, injuries found, vitals, neuro status',
                '5. Notify family per policy',
                '6. Incident report — factual, objective, no blame language',
                '7. Reassess fall risk score — likely changed',
                '8. Increase prevention measures',
              ],
            },
            { type: 'callout', content: 'If the patient hit their head or is on anticoagulants, a CT scan is likely indicated. Subdural hematomas can present hours later — neuro checks q1h × 24h may be ordered.', variant: 'alert' },
          ],
        },
        {
          id: 'fall-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Scenario: Patient Found on Floor' },
            { type: 'text', content: 'You respond to a bed alarm. Your 78-year-old patient (Morse score 55, on warfarin and metoprolol) is on the floor next to the bed. He says he was trying to get to the bathroom. He\'s oriented but complaining of right hip pain. Small laceration on his forehead.' },
            { type: 'callout', content: 'Walk through your response step by step. What makes this particularly high-risk?', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'DON\'T move him — assess first. Check LOC (alert, oriented ×4?), pupils, pain location and severity.',
                'Call for help — you need someone to assist and someone to get vitals equipment.',
                'High-risk factors: Age 78 + warfarin (bleeding risk) + forehead laceration (possible head injury). This combination requires urgent provider notification.',
                'Assess right hip: Can he move it? Any shortening/external rotation? (Classic hip fracture signs)',
                'Head laceration + warfarin = need CT head to rule out intracranial bleed. Don\'t wait for symptoms.',
                'Vitals + neuro checks. Anticipate: CT head, hip X-ray, INR check, neuro checks q1h.',
                'Document: Time found, position, patient statement, assessment findings, notifications, interventions.',
                'Incident report: Factual only. "Patient found on floor at 0345, bed alarm activated, states was attempting to ambulate to bathroom independently."',
              ],
            },
            { type: 'callout', content: 'Never write "patient fell" — you didn\'t witness it. Write "patient found on floor." This is both more accurate and legally important.', variant: 'tip' },
          ],
        },
      ],
    },
  },
  {
    id: 'rapid_response',
    label: 'Rapid Response',
    detail: 'When and how to activate the team',
    status: 'alert',
    lesson: {
      aiPrompt: 'I\'m a nursing student learning about rapid response teams (RRT). Help me understand when to call a rapid response, how to communicate using SBAR, what happens when the team arrives, and the nursing student\'s role during a rapid response event.',
      levels: [
        {
          id: 'rrt-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'When to Call Rapid Response' },
            {
              type: 'list',
              content: '',
              items: [
                'Heart rate <40 or >130',
                'Systolic BP <90 or >200',
                'Respiratory rate <8 or >28',
                'SpO₂ <90% despite O₂',
                'Acute change in mental status',
                'New-onset chest pain',
                'Seizure activity',
                'Urine output <0.5 mL/kg/hr for 2+ hours',
                'Staff member is worried — this is a VALID reason',
              ],
            },
            { type: 'callout', content: '"If something feels wrong, it probably is." You do NOT need to diagnose the problem to call a rapid response. Calling early saves lives. No one has ever been reprimanded for calling an RRT that wasn\'t needed.', variant: 'alert' },
            { type: 'heading', content: 'SBAR Communication' },
            {
              type: 'table',
              content: '',
              header: 'Letter | Meaning | Example',
              rows: [
                'S | Situation | "I\'m calling about Mr. Jones in 412. He\'s acutely short of breath."',
                'B | Background | "72-year-old, admitted for CHF exacerbation, was stable on 2L NC."',
                'A | Assessment | "RR 32, SpO₂ 88% on 4L, crackles bilateral, new confusion."',
                'R | Recommendation | "I think he needs BiPAP and a chest X-ray. Can you come evaluate?"',
              ],
            },
          ],
        },
        {
          id: 'rrt-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'What Happens During a Rapid Response' },
            {
              type: 'list',
              content: '',
              items: [
                'RRT typically includes: ICU nurse, respiratory therapist, and a provider (resident, NP, or PA). Some include a pharmacist.',
                'Primary nurse stays at bedside and gives SBAR report to the RRT leader.',
                'RRT assesses the patient, orders diagnostics (labs, ECG, imaging), and initiates treatment.',
                'Outcome options: stabilize and continue current care, transfer to higher level of care (ICU), or call a Code Blue if patient deteriorates.',
              ],
            },
            { type: 'heading', content: 'The Nursing Student\'s Role' },
            { type: 'text', content: 'As a student, you won\'t lead the RRT response, but you can be incredibly valuable:' },
            {
              type: 'list',
              content: '',
              items: [
                'Know where the code cart / RRT supplies are BEFORE you need them.',
                'Help get vital signs — you can run the monitor while others assess.',
                'Document — grab the code sheet and write down times, vitals, interventions as they happen. Real-time documentation during a crisis is invaluable.',
                'Be a runner — get supplies, bring the chart, call the lab, find the attending.',
                'Know the patient — you may know details about the patient\'s history that the RRT team doesn\'t.',
                'Stay out of the way if the room is full. Too many people = chaos.',
              ],
            },
            { type: 'heading', content: 'Early Warning Signs You Should Know' },
            { type: 'text', content: 'Most patients who code show warning signs 6–8 hours beforehand. The Modified Early Warning Score (MEWS) quantifies this:' },
            {
              type: 'list',
              content: '',
              items: [
                'Subtle tachycardia that doesn\'t resolve with rest',
                'Increasing oxygen requirements (2L → 4L → 6L)',
                'New restlessness or anxiety ("I don\'t feel right")',
                'Decreasing urine output — kidneys are telling you cardiac output is dropping',
                'Rising lactate — tissues aren\'t getting enough oxygen',
              ],
            },
            { type: 'callout', content: 'Trust the patient who says "something is wrong." They often know before the monitors do. A sudden sense of "impending doom" is a recognized clinical sign.', variant: 'tip' },
          ],
        },
        {
          id: 'rrt-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Scenario: Deteriorating Patient' },
            { type: 'text', content: 'Your patient (68F, post-op day 1 from colectomy) was stable at your 0800 assessment. At 1030, you notice: HR went from 78 → 112, BP from 128/76 → 98/62, RR 24 (was 16), new diaphoresis, patient says "I don\'t feel right." SpO₂ is 94% on room air.' },
            { type: 'callout', content: 'Do you call rapid response now? Or do you reassess and wait? Build your SBAR.', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'YES, call rapid response. This is a clear deterioration pattern: tachycardia + hypotension + tachypnea in a post-op patient = concerning for hemorrhage, PE, or sepsis.',
                'While waiting (they arrive in minutes): Head of bed up, apply O₂ (nasal cannula 2L), establish/verify IV access, draw STAT labs if you can.',
                'Your SBAR: "This is [name] on 4 South, calling about Mrs. Davis in 428. She\'s post-op day 1 from colectomy and is acutely deteriorating. HR jumped from 78 to 112, BP dropped to 98/62, she\'s tachypneic at 24 and diaphoretic. She says she doesn\'t feel right. I\'m concerned about possible hemorrhage or PE. She needs immediate evaluation."',
                'What the RRT will likely do: STAT CBC (Hgb to assess for bleeding), lactate, ABG, chest X-ray, possibly CT angiogram if PE suspected.',
              ],
            },
            { type: 'callout', content: 'Post-surgical tachycardia + hypotension = bleeding until proven otherwise. Check the surgical site, check the drain output, and ask about the last Hgb. These are the first data points the RRT will want.', variant: 'alert' },
          ],
        },
      ],
    },
  },
  {
    id: 'code_blue',
    label: 'Code Blue Protocol',
    detail: 'Cardiac arrest response and your role',
    status: 'alert',
    lesson: {
      aiPrompt: 'I\'m a nursing student learning about Code Blue response. Help me understand what happens during a code, the nursing student\'s role, BLS/ACLS algorithms, and how to process the experience afterward.',
      levels: [
        {
          id: 'code-quick',
          title: 'Quick Reference',
          icon: LucideIcons.Zap,
          color: C.blue,
          blocks: [
            { type: 'heading', content: 'Code Blue — First 2 Minutes' },
            {
              type: 'list',
              content: '',
              items: [
                '1. Confirm unresponsiveness — shake and shout, check pulse (carotid, max 10 seconds)',
                '2. Call for help — pull the code button / call the operator',
                '3. Start CPR — 30:2 ratio, push hard (≥2 inches), push fast (100–120/min), full recoil',
                '4. Get the AED/defibrillator — apply pads as soon as available',
                '5. Continue until code team arrives',
              ],
            },
            {
              type: 'table',
              content: '',
              header: 'Rhythm | Shockable? | First Action',
              rows: [
                'V-Fib / Pulseless V-Tach | YES | Defibrillate immediately',
                'Asystole | NO | CPR + epinephrine',
                'PEA (Pulseless Electrical Activity) | NO | CPR + epinephrine + find cause',
              ],
            },
            { type: 'callout', content: 'Good CPR is the single most important intervention. Everything else is secondary. Minimize interruptions — the heart needs continuous perfusion to have any chance of regaining rhythm.', variant: 'alert' },
          ],
        },
        {
          id: 'code-deep',
          title: 'Deep Dive',
          icon: LucideIcons.Microscope,
          color: C.purple,
          blocks: [
            { type: 'heading', content: 'H\'s and T\'s — Reversible Causes' },
            { type: 'text', content: 'The code team will be trying to identify and treat the cause. Know the H\'s and T\'s:' },
            {
              type: 'table',
              content: '',
              header: 'H\'s | T\'s',
              rows: [
                'Hypovolemia | Tension pneumothorax',
                'Hypoxia | Tamponade (cardiac)',
                'Hydrogen ion (acidosis) | Toxins / drug overdose',
                'Hypo/Hyperkalemia | Thrombosis (PE or MI)',
                'Hypothermia | —',
              ],
            },
            { type: 'heading', content: 'Code Team Roles' },
            {
              type: 'list',
              content: '',
              items: [
                'Team leader (physician): Directs all actions, makes medication and shock decisions.',
                'Airway manager: Bag-valve-mask, then advanced airway (intubation).',
                'Compressors: Rotate every 2 minutes to prevent fatigue. Quality CPR requires effort.',
                'IV/IO access + medications: Pushes epi every 3–5 min, amiodarone for shockable rhythms.',
                'Monitor/defibrillator: Rhythm checks every 2 min, charges and delivers shocks.',
                'Recorder/documenter: Times everything — compressions, shocks, meds. CRITICAL role.',
              ],
            },
            { type: 'heading', content: 'What Nursing Students Can Do' },
            {
              type: 'list',
              content: '',
              items: [
                'COMPRESSIONS — You are trained in BLS. You can take a turn on the chest. This is the most valuable thing you can do.',
                'DOCUMENT — If you\'re not compressing, grab the code sheet. Write the time for every intervention.',
                'RUN — Get the code cart if it\'s not there. Get blood from the blood bank. Get the patient\'s chart.',
                'BAG — You can bag the patient (ventilate) while the airway team prepares.',
                'STAY BACK — If you\'re not in a role, observe from the doorway. Too many bodies = chaos.',
              ],
            },
            { type: 'callout', content: 'It\'s okay to feel scared. It\'s okay to cry after. Codes are intense even for experienced nurses. What matters is that you act despite the fear.', variant: 'tip' },
          ],
        },
        {
          id: 'code-clinical',
          title: 'Clinical Application',
          icon: LucideIcons.Stethoscope,
          color: C.teal,
          blocks: [
            { type: 'heading', content: 'Scenario: You Find Your Patient Unresponsive' },
            { type: 'text', content: 'You enter Room 406 to give 0900 meds. Your patient (72M, admitted for pneumonia, on telemetry) is slumped in bed, eyes closed, not responding to your voice. The telemetry monitor shows a rhythm but you\'re not sure what it is.' },
            { type: 'callout', content: 'What do you do in the first 30 seconds? Be specific about your actions in sequence.', variant: 'info' },
            {
              type: 'list',
              content: '',
              items: [
                'Sternal rub or shoulder shake + shout his name. No response.',
                'Check carotid pulse — you have 10 seconds max. You feel nothing.',
                'Pull the code alarm / shout for help / hit the call light code button. Do NOT leave to find someone — activate from the bedside.',
                'Lower the head of bed flat. Start compressions immediately. Hard and fast: center of chest, 2+ inches deep, 100-120/min.',
                'When help arrives: Ask someone to bring the crash cart and AED. Keep compressing.',
                'The monitor shows a rhythm but there\'s no pulse — this is PEA (Pulseless Electrical Activity). NOT shockable. Continue CPR.',
                'When the code team arrives: Give a brief SBAR. "72-year-old, pneumonia, found unresponsive and pulseless at 0900, CPR in progress, PEA on the monitor."',
                'Step back and let the team take over, or continue compressions if they need you.',
              ],
            },
            { type: 'heading', content: 'After the Code' },
            {
              type: 'list',
              content: '',
              items: [
                'Debrief — most units hold a brief debrief immediately after. Attend it.',
                'Process your emotions — this may be your first code. Talk to your preceptor, classmates, or clinical instructor.',
                'Reflect — What went well? What would you do differently? Write it down while it\'s fresh.',
                'Self-care — A code is a traumatic event. It\'s okay to need a few minutes before resuming your other patients.',
              ],
            },
            { type: 'callout', content: 'Remember: The patient was already in cardiac arrest before you walked in. You didn\'t cause it. You responded to it. Starting CPR, even imperfectly, gave that patient their best chance.', variant: 'tip' },
          ],
        },
      ],
    },
  },
];

// =============================================================================
// STYLES
// =============================================================================

const ls = StyleSheet.create({
  // Items list
  itemsList: {
    gap: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
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
    color: '#000',
  },
  itemDetail: {
    fontSize: 12,
    color: '#3C3C43',
    marginTop: 1,
  },
  drillHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  drillHintText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },

  // Lesson container
  container: {
    gap: 12,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#3C3C43',
    marginTop: -4,
  },

  // Level tabs
  levelTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  levelTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFF',
  },
  levelTabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Depth indicator
  depthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  depthDot: {
    height: 4,
    borderRadius: 2,
  },
  depthLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginLeft: 6,
  },

  // Content blocks
  content: {
    gap: 10,
  },
  blockHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 4,
  },
  blockText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#3C3C43',
  },
  blockList: {
    gap: 6,
  },
  blockListItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  blockBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  blockListText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#3C3C43',
  },

  // Table
  blockTable: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  blockTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  blockTableRowAlt: {
    backgroundColor: '#F9F9FB',
  },
  blockTableHeader: {
    backgroundColor: '#F2F2F7',
  },
  blockTableCell: {
    fontSize: 12,
    color: '#3C3C43',
    lineHeight: 17,
  },
  blockTableHeaderCell: {
    fontWeight: '700',
    color: '#000',
  },

  // Callout
  blockCallout: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  blockCalloutText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  // Navigation
  navRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 4,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // AI section
  aiSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
    marginTop: 4,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  aiDescription: {
    fontSize: 13,
    color: '#A16207',
    lineHeight: 18,
  },
  aiTools: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  aiToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  aiToolText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
