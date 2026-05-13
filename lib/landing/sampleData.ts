// Sample data for the explorable data browser landing pages

export interface SampleTimelineStep {
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  detail?: string;
}

export interface SamplePersonalInterest {
  interestSlug: string;
  role?: string;
  timeline: SampleTimelineStep[];
}

export interface SamplePerson {
  name: string;
  role: string;
  timeline: SampleTimelineStep[];
  userId?: string;
  personalInterests?: SamplePersonalInterest[];
}

export interface SampleGroup {
  name: string;
  groupLabel?: string;
  people: SamplePerson[];
  subgroups?: SampleGroup[];
  fleetId?: string;
}

export interface SampleCapabilityGoal {
  name: string;
  people: SamplePerson[];
}

export interface SampleCohort {
  name: string;
  people: SamplePerson[];
  isShared?: boolean;
  partnerInterests?: { interestSlug: string; orgSlug?: string; orgName?: string }[];
}

export interface SampleOrganization {
  slug: string;
  name: string;
  groupLabel: string;
  groups: SampleGroup[];
  cohorts?: SampleCohort[];
  capabilityGoals?: SampleCapabilityGoal[];
}

export interface SampleProgram {
  slug: string;
  name: string;
  type: 'degree' | 'certification' | 'course' | 'training' | 'residency' | 'fellowship' | 'retreat';
  description?: string;
  offeredBy: { orgSlug: string; role: string }[];
  coHostedWith?: { interestSlug: string; orgSlug: string; role: string }[];
  samplePeople: SamplePerson[];
}

export interface SampleAffiliation {
  name: string;
  orgSlugs: string[];
}

export interface SampleInterest {
  slug: string;
  name: string;
  color: string;
  icon: string;
  organizations: SampleOrganization[];
  programs?: SampleProgram[];
  affiliations?: SampleAffiliation[];
  independentPractitioners?: SamplePerson[];
}

// Helper to build timelines quickly
function steps(labels: string[], currentIndex: number, details?: string[]): SampleTimelineStep[] {
  return labels.map((label, i) => ({
    label,
    status: i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'upcoming',
    detail: details?.[i],
  }));
}

// ── Nursing detail sets (based on real JHU curriculum) ──────────────

// MSN Entry into Nursing — JHU's pre-licensure pathway (5 semesters, 1000+ clinical hours)
const MSN_ENTRY_DETAILS = [
  'Health assessment foundations, nursing fundamentals, patient safety, simulation lab orientation',
  'Adult health nursing, medication administration, wound care, IV therapy, clinical rotations at JH Hospital',
  'Pediatric assessment, family-centered care, developmental milestones, clinical at Kennedy Krieger Institute',
  'Maternal-newborn care, prenatal assessment, labor & delivery, postpartum — clinical at JH Bayview',
  'Critical care nursing, ventilator management, hemodynamic monitoring, code response, ICU rotations',
  'Psychiatric & behavioral health nursing, therapeutic communication — clinical at MedStar Harbor',
  'Capstone clinical immersion integrating all competencies, NCLEX preparation, 95% pass rate',
];

// DNP Family NP track
const DNP_FNP_DETAILS = [
  'Advanced pathophysiology across the lifespan, cellular mechanisms, immune response',
  'Advanced pharmacology — prescribing guidelines, drug interactions, pharmacokinetics',
  'Comprehensive health assessment, differential diagnosis, clinical reasoning',
  'Evidence-based practice, quality improvement methods, translational research',
  'Primary care clinical practicum I — 200+ hours with preceptor, common presentations',
  'Primary care clinical practicum II — complex patients, chronic disease management',
  'DNP scholarly project — practice change implementation and outcomes evaluation',
];

// DNP PMHNP track
const DNP_PMHNP_DETAILS = [
  'Advanced psychopathology, neuroscience of mental illness, diagnostic frameworks',
  'Psychopharmacology — SSRIs, mood stabilizers, antipsychotics, medication management',
  'Therapeutic modalities — CBT, DBT, motivational interviewing, crisis intervention',
  'Psychiatric assessment across the lifespan, standardized screening tools',
  'Psychiatric clinical practicum I — outpatient behavioral health settings',
  'Psychiatric clinical practicum II — inpatient & crisis settings, complex cases',
  'DNP scholarly project focused on mental health outcomes or access improvement',
];

// Healthcare Organizational Leadership MSN
const HOL_DETAILS = [
  'Healthcare systems, organizational theory, nursing leadership frameworks',
  'Financial management in healthcare — budgeting, resource allocation, cost analysis',
  'Quality & safety science, evidence-based practice, performance improvement',
  'Health policy analysis, advocacy, regulatory environment, legislative process',
  'HOL Practicum I — 112 hours with nurse executive preceptor',
  'HOL Practicum II — 168 hours leading a quality improvement initiative',
  'HOL Practicum III — 224 hours, executive leadership capstone project',
];

// JH Hospital — clinical partner detail sets
const JH_HOSPITAL_ED_DETAILS = [
  'Triage certification — ESI 5-level acuity assessment',
  'Trauma nursing certification — TNCC protocols, rapid assessment',
  'ACLS provider — advanced cardiac life support, code team protocols',
  'Charge nurse leadership, unit throughput management, staff mentoring',
  'Clinical preceptor training — teaching evidence-based practice to students',
  'Quality improvement lead — fall prevention, sepsis bundle compliance',
];

const JH_HOSPITAL_ICU_DETAILS = [
  'CCRN certification prep — critical care nursing fundamentals',
  'Mechanical ventilation management — modes, weaning protocols, ABG interpretation',
  'Hemodynamic monitoring — arterial lines, Swan-Ganz, cardiac output',
  'CRRT management — continuous renal replacement therapy for acute kidney injury',
  'Preceptor certification — mentoring new graduate nurses in critical care',
];

const JH_HOSPITAL_ONCO_DETAILS = [
  'ONS chemotherapy/biotherapy certification — safe administration protocols',
  'Symptom management — pain, nausea, fatigue, mucositis assessment and intervention',
  'Central line care — PICC, port, tunneled catheter management and troubleshooting',
  'Bone marrow transplant nursing — conditioning regimens, engraftment monitoring',
  'Palliative care integration — goals of care conversations, advance directives',
  'Clinical trial coordination — protocol adherence, adverse event reporting',
];

// AACN Essentials competency domain details
const AACN_PERSON_CENTERED_DETAILS = [
  'Holistic assessment — physical, psychological, social, spiritual dimensions',
  'Therapeutic communication — motivational interviewing, health literacy adaptation',
  'Care coordination across settings — transitions, handoffs, discharge planning',
  'Cultural humility — addressing health disparities, implicit bias awareness',
  'Shared decision-making — patient preferences, informed consent, autonomy',
];

const AACN_QUALITY_SAFETY_DETAILS = [
  'QSEN competencies — patient-centered care, teamwork, EBP, QI, safety, informatics',
  'Root cause analysis and just culture — systems thinking for error prevention',
  'Clinical decision support — using evidence at the point of care',
  'Infection prevention — hand hygiene, isolation precautions, bundle compliance',
  'Medication safety — high-alert medications, double-check protocols, BCMA',
];

const AACN_INTERPROFESSIONAL_DETAILS = [
  'SBAR communication — structured handoffs with physicians, pharmacists, therapists',
  'Interprofessional rounding — contributing nursing perspective to care teams',
  'Collaborative practice — shared goals, mutual respect, role clarity',
  'Conflict resolution — navigating disagreements in high-stakes clinical settings',
  'Team-based quality improvement — participating in multidisciplinary projects',
];
// ── IIT Institute of Design detail sets (based on real ID curriculum) ──

// MDes Core — the foundational sequence all MDes students take
const MDES_CORE_DETAILS = [
  'Observation methods, interviewing techniques, contextual inquiry, diary studies',
  'Affinity clustering, insight development, frameworks, opportunity mapping',
  'Rapid prototyping, experience prototyping, concept development, storyboarding',
  'Systems mapping, stakeholder analysis, leverage points, causal loop diagrams',
  'Service blueprinting, journey mapping, touchpoint design, value exchange modeling',
  'Project framing, design criteria, team facilitation, client presentation',
];

// MDes Concentration: Design Research & Insight
const MDES_RESEARCH_DETAILS = [
  'Ethnographic methods — participant observation, cultural probes, photo/video analysis',
  'Generative research — co-creation sessions, participatory design, stakeholder workshops',
  'Behavioral research — A/B testing frameworks, analytics interpretation, behavioral nudges',
  'Synthesis methods — grounded theory coding, pattern finding, insight articulation',
  'Research strategy — planning studies, triangulation, mixed methods, research ops',
  'Research leadership — evangelizing insights, building research culture, mentoring',
];

// MDes Concentration: Product-Service Delivery
const MDES_PRODUCT_SERVICE_DETAILS = [
  'Physical prototyping — foam core, 3D printing, laser cutting, Arduino interfaces',
  'Digital prototyping — Figma, interactive flows, usability testing, design systems',
  'Service design — blueprinting, front-stage/back-stage mapping, orchestration',
  'Business modeling — value propositions, unit economics, go-to-market strategy',
  'Implementation planning — roadmaps, MVP scoping, stakeholder alignment',
  'Capstone — end-to-end product-service system with industry partner',
];

// MDes Concentration: Innovation Strategy
const MDES_INNOVATION_DETAILS = [
  'Design planning — strategic foresight, scenario development, landscape analysis',
  'Organizational design — culture mapping, change management, innovation metrics',
  'Platform strategy — ecosystem mapping, multi-sided markets, network effects',
  'Design-led venture — lean startup methods, pitch development, investor narratives',
  'Strategic communication — data storytelling, executive presentations, design rationale',
  'Capstone — strategic design initiative for organizational transformation',
];

// MS Strategic Design Leadership (formerly MDM)
const MS_SDL_DETAILS = [
  'Design thinking foundations — problem framing, divergent/convergent methods',
  'Organizational systems — complexity theory, adaptive leadership, team dynamics',
  'Evidence-based design — metrics, impact measurement, decision frameworks',
  'Strategic planning — portfolio management, innovation pipeline, resource allocation',
  'Leadership practicum — leading cross-functional design initiative in own organization',
  'Capstone — strategic design transformation project with measurable outcomes',
];

// PhD in Design
const PHD_DESIGN_DETAILS = [
  'Design theory — epistemology of design, Schön, Simon, Buchanan, design as discipline',
  'Research methods — qualitative, quantitative, mixed methods, research design',
  'Doctoral seminar I — literature review, theoretical framework development',
  'Doctoral seminar II — methodology, pilot studies, IRB protocols',
  'Dissertation proposal — committee formation, defense, research plan approval',
  'Dissertation research — data collection, analysis, writing, peer review',
  'Dissertation defense — public defense, revisions, contribution to design knowledge',
];

// ID capability goal detail sets
const ID_HUMAN_CENTERED_DETAILS = [
  'Empathic research — deep listening, perspective-taking, cultural awareness',
  'Inclusive design — accessibility, universal design principles, co-design with communities',
  'Participatory methods — stakeholder engagement, power dynamics, democratic design',
  'Ethical practice — informed consent, data privacy, responsible innovation',
  'Impact assessment — outcomes measurement, unintended consequences, equity audit',
];

const ID_SYSTEMS_THINKING_DETAILS = [
  'System mapping — identifying actors, flows, feedback loops, boundaries',
  'Complexity navigation — emergence, nonlinearity, adaptive systems',
  'Multi-stakeholder analysis — power mapping, interest alignment, coalition building',
  'Transition design — sociotechnical transitions, pathways, vision development',
  'Systemic intervention — leverage points, prototyping at system scale',
];

const ID_MAKING_PROTOTYPING_DETAILS = [
  'Physical making — model shop skills, materials exploration, form studies',
  'Digital fabrication — 3D printing, laser cutting, CNC, parametric design',
  'Experience prototyping — bodystorming, Wizard of Oz, service staging',
  'Interactive prototyping — microcontrollers, sensors, connected objects',
  'Design communication — visual storytelling, presentation craft, portfolio development',
];

const DRAWING_FOUNDATION_DETAILS = [
  'Blind contour, cross-contour, continuous line exercises',
  '1-point, 2-point, atmospheric perspective studies',
  'Value scales, cast shadows, reflected light observation',
  'Rule of thirds, golden ratio, visual weight balance',
  'Gesture drawing, proportion, anatomical landmarks',
  'Curated body of work demonstrating all fundamentals',
];
const SAILING_SEASON_DETAILS = [
  'Light air practice races, crew coordination drills',
  'Mid-fleet positioning, mark rounding technique refinement',
  'Full regatta weekend — 6 races, varied conditions',
  'Heavy air strategy, current-aware tactical decisions',
  'Short course racing, cold-weather boat handling',
  'National championship qualifier series',
];
const SAILING_SKILLS_DETAILS = [
  'Sail trim basics, points of sail, safety procedures',
  'Tacking, gybing, spinnaker sets and douses',
  'Port/starboard approach, timing, acceleration technique',
  'Laylines, wind shifts, strategic side of the course',
  'VMG angles, wave riding, gybe timing on runs',
  'Combining all skills under match-race pressure',
  'Multi-day championship regatta performance',
];

// ── Knitting detail sets ──────────────────────────────────────────────
const KNITTING_BEGINNER_DETAILS = [
  'Cast on methods — long tail, knitted, cable cast on',
  'Knit stitch mastery — even tension, consistent gauge',
  'Purl stitch and stockinette — recognizing right/wrong side',
  'Ribbing patterns — 1x1, 2x2, broken rib',
  'Binding off — standard, stretchy, three-needle',
  'First project completion — dishcloth or simple scarf',
];

const KNITTING_COLORWORK_DETAILS = [
  'Stranded knitting fundamentals — carrying two colors, float management',
  'Fair isle chart reading — pattern repeats, color dominance',
  'Tension management — consistent gauge across colorwork sections',
  'Steeks — cutting knitting for cardigans and armholes',
  'Blocking colorwork — wet blocking, pinning, achieving even fabric',
];

// ── Fiber Arts detail sets ────────────────────────────────────────────
const SPINNING_FUNDAMENTALS_DETAILS = [
  'Fiber preparation — carding, combing, flicking locks',
  'Drafting techniques — short draw, long draw, worsted vs woolen',
  'Wheel mechanics — drive ratios, tension systems, maintenance',
  'Plying methods — two-ply, chain ply, Navajo ply',
  'Finishing yarn — setting twist, washing, skeining',
];

const WEAVING_FLOOR_LOOM_DETAILS = [
  'Warping the loom — measuring, winding, beaming, threading',
  'Threading patterns — straight draw, point twill, overshot',
  'Treadling sequences — tabby, twill, pattern treadling',
  'Plain weave and variations — balanced, warp-faced, weft-faced',
  'Twill structures — 2/2 twill, herringbone, diamond twill',
  'Finishing woven cloth — wet finishing, pressing, hemming',
];

// ── Painting & Printing detail sets ───────────────────────────────────
const OIL_PAINTING_DETAILS = [
  'Color theory — color wheel, temperature, complementary mixing, limited palettes',
  'Underpainting methods — grisaille, imprimatura, dead layer technique',
  'Glazing and layering — fat over lean, transparent color building, optical mixing',
  'Alla prima technique — direct painting, wet-into-wet, expressive brushwork',
  'Composition strategies — golden ratio, dynamic symmetry, focal point placement',
  'Plein air painting — portable setup, changing light, quick studies, value priority',
];

const PRINTMAKING_DETAILS = [
  'Relief printing — linocut, woodcut, block preparation, carving tools',
  'Intaglio methods — etching, drypoint, aquatint, plate preparation',
  'Registration techniques — key block, pin registration, jig systems',
  'Editioning — consistent inking, paper dampening, press pressure, numbering',
  'Proofing stages — artist proof, state proof, bon à tirer, edition numbering',
  'Exhibition preparation — matting, framing, portfolio presentation, edition documentation',
];

// ── Lifelong Learning detail sets ────────────────────────────────────
const MINDFULNESS_RETREAT_DETAILS = [
  'Arrival and orientation — setting intentions, getting settled on the island',
  'Morning vipassana sits, walking meditation on forest trails',
  'Guided body scan and yoga nidra — deepening somatic awareness',
  'Council practice — deep listening, speaking from the heart',
  'Integration practices — journaling, nature connection, garden work',
  'Closing circle — sharing insights, commitments for home practice',
];

const CREATIVE_WRITING_NATURE_DETAILS = [
  'Sensory awareness walks — observation exercises, field notes',
  'Free writing practice — morning pages, stream of consciousness',
  'Nature journaling — sketching and writing in the garden',
  'Memoir and personal essay — finding your voice in landscape',
  'Workshop circle — peer feedback, reading aloud, revision',
];

// ── Regenerative Agriculture detail sets ─────────────────────────────
const ORGANIC_FARMING_DETAILS = [
  'Soil preparation — bed building, composting, cover crop termination',
  'Seed starting and nursery management — propagation techniques',
  'Transplanting and direct seeding — spacing, companion planting',
  'Integrated pest management — beneficial insects, organic sprays, crop rotation',
  'Harvest techniques — timing, handling, post-harvest storage',
  'Record keeping and organic certification documentation',
];

const TRIBAL_CUISINE_DETAILS = [
  'Introduction to tribal ingredients — millets, tubers, forest produce',
  'Traditional cooking methods — clay pot, wood fire, fermentation',
  'Seasonal menus — eating with the harvest, preservation techniques',
  'Hands-on cooking — tribal recipes with farm-fresh ingredients',
  'Plating and presentation — farm-to-table dining experience',
];

/** Domain grouping for the interest catalog. Shared by landing page and nav. */
export const INTEREST_DOMAINS = [
  { name: 'Healthcare', color: '#6366F1', slugs: ['nursing', 'global-health'] },
  { name: 'Creative Arts', color: '#F59E0B', slugs: ['drawing', 'design', 'knitting', 'fiber-arts', 'painting-printing'] },
  { name: 'Sports & Outdoors', color: '#0EA5E9', slugs: ['sail-racing', 'golf', 'health-and-fitness'] },
  { name: 'Livelihoods & Enterprise', color: '#D35400', slugs: ['lac-craft-business', 'food-processing', 'textile-weaving'] },
  { name: 'Education & Learning', color: '#5C6BC0', slugs: ['lifelong-learning', 'self-mastery'] },
  { name: 'Agriculture & Environment', color: '#2E7D32', slugs: ['regenerative-agriculture'] },
];

export const SAMPLE_INTERESTS: SampleInterest[] = [
  {
    slug: 'nursing',
    name: 'Nursing',
    color: '#0097A7',
    icon: 'medkit',
    organizations: [
      {
        slug: 'johns-hopkins',
        name: 'Johns Hopkins School of Nursing',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'MSN Entry into Nursing',
            people: [
              {
                name: 'Dr. Marie Nolan',
                role: 'Executive Vice Dean',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  6, MSN_ENTRY_DETAILS,
                ),
                personalInterests: [
                  {
                    interestSlug: 'drawing',
                    role: 'Hobbyist',
                    timeline: steps(
                      ['Line & Contour', 'Perspective', 'Light & Shadow', 'Composition'],
                      2,
                      [
                        'Exploring contour drawing and basic line work in a weekly sketchbook practice',
                        'Learning one-point and two-point perspective for architectural sketching',
                        'Studying value, shading techniques, and cast shadows',
                        'Composing scenes with rule of thirds and focal points',
                      ],
                    ),
                  },
                  {
                    interestSlug: 'health-and-fitness',
                    role: 'Self-directed',
                    timeline: steps(
                      ['Baseline Assessment', 'Strength Foundations', 'Cardio Endurance', 'Flexibility & Mobility', 'Training Plan'],
                      1,
                      [
                        'Initial fitness assessment — resting heart rate, flexibility test, baseline lifts',
                        'Building fundamental strength with compound movements 3x/week',
                        'Progressive cardio program — running, rowing, cycling intervals',
                        'Yoga and mobility work for injury prevention and recovery',
                        'Structured 12-week periodized training plan',
                      ],
                    ),
                  },
                ],
              },
              {
                name: 'Aisha Williams',
                role: 'Student — Semester 4',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  3, MSN_ENTRY_DETAILS,
                ),
              },
              {
                name: 'Carlos Mendez',
                role: 'Student — Semester 2',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  1, MSN_ENTRY_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'DNP — Family NP',
            people: [
              {
                name: 'Dr. Jason Farley',
                role: 'PhD Program Director',
                timeline: steps(
                  ['Adv Pathophysiology', 'Adv Pharmacology', 'Adv Health Assessment', 'EBP & QI', 'Clinical Practicum I', 'Clinical Practicum II', 'Scholarly Project'],
                  6, DNP_FNP_DETAILS,
                ),
              },
              {
                name: 'Priya Sharma',
                role: 'DNP Student',
                timeline: steps(
                  ['Adv Pathophysiology', 'Adv Pharmacology', 'Adv Health Assessment', 'EBP & QI', 'Clinical Practicum I', 'Clinical Practicum II', 'Scholarly Project'],
                  4, DNP_FNP_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'DNP — Psych Mental Health NP',
            people: [
              {
                name: 'Dr. Deborah Gross',
                role: 'Endowed Chair, Psych Nursing',
                timeline: steps(
                  ['Adv Psychopathology', 'Psychopharmacology', 'Therapeutic Modalities', 'Psych Assessment', 'Psych Clinical I', 'Psych Clinical II', 'Scholarly Project'],
                  6, DNP_PMHNP_DETAILS,
                ),
              },
              {
                name: 'James Okafor',
                role: 'DNP Student',
                timeline: steps(
                  ['Adv Psychopathology', 'Psychopharmacology', 'Therapeutic Modalities', 'Psych Assessment', 'Psych Clinical I', 'Psych Clinical II', 'Scholarly Project'],
                  3, DNP_PMHNP_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'MSN — Healthcare Organizational Leadership',
            people: [
              {
                name: 'Dr. Sarah Szanton',
                role: 'Dean',
                timeline: steps(
                  ['Healthcare Systems', 'Financial Mgmt', 'Quality & Safety', 'Health Policy', 'HOL Practicum I', 'HOL Practicum II', 'HOL Practicum III'],
                  6, HOL_DETAILS,
                ),
              },
              {
                name: 'Maria Chen',
                role: 'MSN Student',
                timeline: steps(
                  ['Healthcare Systems', 'Financial Mgmt', 'Quality & Safety', 'Health Policy', 'HOL Practicum I', 'HOL Practicum II', 'HOL Practicum III'],
                  3, HOL_DETAILS,
                ),
              },
            ],
          },
        ],
        cohorts: [
          {
            name: 'MSN Entry — Fall 2025 Cohort (Semester 4)',
            people: [
              {
                name: 'Aisha Williams',
                role: 'Student',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  3, MSN_ENTRY_DETAILS,
                ),
              },
              {
                name: 'David Osei',
                role: 'Student',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  3, MSN_ENTRY_DETAILS,
                ),
              },
              {
                name: 'Lauren Kim',
                role: 'Student',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  3, MSN_ENTRY_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'MSN Entry — Spring 2026 Cohort (Semester 2)',
            people: [
              {
                name: 'Carlos Mendez',
                role: 'Student',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  1, MSN_ENTRY_DETAILS,
                ),
              },
              {
                name: 'Sarah Mitchell',
                role: 'Student',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  1, MSN_ENTRY_DETAILS,
                ),
              },
              {
                name: 'Rajesh Patel',
                role: 'Student',
                timeline: steps(
                  ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
                  1, MSN_ENTRY_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'DNP Family NP — 2024 Cohort',
            people: [
              {
                name: 'Priya Sharma',
                role: 'DNP Student',
                timeline: steps(
                  ['Adv Pathophysiology', 'Adv Pharmacology', 'Adv Health Assessment', 'EBP & QI', 'Clinical Practicum I', 'Clinical Practicum II', 'Scholarly Project'],
                  4, DNP_FNP_DETAILS,
                ),
              },
              {
                name: 'Michael Torres',
                role: 'DNP Student',
                timeline: steps(
                  ['Adv Pathophysiology', 'Adv Pharmacology', 'Adv Health Assessment', 'EBP & QI', 'Clinical Practicum I', 'Clinical Practicum II', 'Scholarly Project'],
                  4, DNP_FNP_DETAILS,
                ),
              },
            ],
          },
        ],
        capabilityGoals: [
          {
            name: 'Person-Centered Care (AACN Domain 2)',
            people: [
              {
                name: 'Aisha Williams',
                role: 'MSN Entry Student',
                timeline: steps(
                  ['Holistic Assessment', 'Therapeutic Comm', 'Care Coordination', 'Cultural Humility', 'Shared Decision-Making'],
                  3, AACN_PERSON_CENTERED_DETAILS,
                ),
              },
              {
                name: 'Priya Sharma',
                role: 'DNP Student',
                timeline: steps(
                  ['Holistic Assessment', 'Therapeutic Comm', 'Care Coordination', 'Cultural Humility', 'Shared Decision-Making'],
                  4, AACN_PERSON_CENTERED_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Quality & Safety (AACN Domain 5)',
            people: [
              {
                name: 'Carlos Mendez',
                role: 'MSN Entry Student',
                timeline: steps(
                  ['QSEN Competencies', 'Root Cause Analysis', 'Clinical Decision Support', 'Infection Prevention', 'Medication Safety'],
                  1, AACN_QUALITY_SAFETY_DETAILS,
                ),
              },
              {
                name: 'James Okafor',
                role: 'DNP Student',
                timeline: steps(
                  ['QSEN Competencies', 'Root Cause Analysis', 'Clinical Decision Support', 'Infection Prevention', 'Medication Safety'],
                  3, AACN_QUALITY_SAFETY_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Interprofessional Partnerships (AACN Domain 6)',
            people: [
              {
                name: 'Aisha Williams',
                role: 'MSN Entry Student',
                timeline: steps(
                  ['SBAR Communication', 'IP Rounding', 'Collaborative Practice', 'Conflict Resolution', 'Team-Based QI'],
                  2, AACN_INTERPROFESSIONAL_DETAILS,
                ),
              },
              {
                name: 'Maria Chen',
                role: 'HOL Student',
                timeline: steps(
                  ['SBAR Communication', 'IP Rounding', 'Collaborative Practice', 'Conflict Resolution', 'Team-Based QI'],
                  4, AACN_INTERPROFESSIONAL_DETAILS,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'jh-hospital',
        name: 'Johns Hopkins Hospital',
        groupLabel: 'Departments',
        groups: [
          {
            name: 'Emergency Department',
            people: [
              {
                name: 'Rachel Torres',
                role: 'Nurse Manager',
                timeline: steps(
                  ['Triage Cert (ESI)', 'Trauma Cert (TNCC)', 'ACLS Provider', 'Charge Nurse', 'Preceptor Cert', 'QI Lead'],
                  5, JH_HOSPITAL_ED_DETAILS,
                ),
              },
              {
                name: 'David Kim',
                role: 'Staff Nurse',
                timeline: steps(
                  ['Triage Cert (ESI)', 'Trauma Cert (TNCC)', 'ACLS Provider', 'Charge Nurse', 'Preceptor Cert', 'QI Lead'],
                  2, JH_HOSPITAL_ED_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Medical ICU',
            people: [
              {
                name: 'Amanda Foster',
                role: 'Charge Nurse',
                timeline: steps(
                  ['CCRN Prep', 'Ventilator Mgmt', 'Hemodynamics', 'CRRT', 'Preceptor Cert'],
                  4, JH_HOSPITAL_ICU_DETAILS,
                ),
              },
              {
                name: 'Marcus Reed',
                role: 'New Grad Resident',
                timeline: steps(
                  ['CCRN Prep', 'Ventilator Mgmt', 'Hemodynamics', 'CRRT', 'Preceptor Cert'],
                  1, JH_HOSPITAL_ICU_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Oncology / BMT',
            people: [
              {
                name: 'Linda Tran',
                role: 'Clinical Nurse Specialist',
                timeline: steps(
                  ['Chemo/Bio Cert', 'Symptom Mgmt', 'Central Line Care', 'BMT Nursing', 'Palliative Integration', 'Clinical Trials'],
                  5, JH_HOSPITAL_ONCO_DETAILS,
                ),
              },
              {
                name: 'Nathan Brooks',
                role: 'Staff Nurse',
                timeline: steps(
                  ['Chemo/Bio Cert', 'Symptom Mgmt', 'Central Line Care', 'BMT Nursing', 'Palliative Integration', 'Clinical Trials'],
                  2, JH_HOSPITAL_ONCO_DETAILS,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'jh-bayview',
        name: 'Johns Hopkins Bayview Medical Center',
        groupLabel: 'Units',
        groups: [
          {
            name: 'Labor & Delivery',
            people: [
              {
                name: 'Keisha Brown',
                role: 'Charge Nurse',
                timeline: steps(
                  ['L&D Orientation', 'Fetal Monitoring Cert', 'High-Risk OB', 'C-Section Circulator', 'Preceptor', 'Unit Educator'],
                  4,
                ),
              },
              {
                name: 'Emily Sato',
                role: 'Staff Nurse',
                timeline: steps(
                  ['L&D Orientation', 'Fetal Monitoring Cert', 'High-Risk OB', 'C-Section Circulator', 'Preceptor', 'Unit Educator'],
                  1,
                ),
              },
            ],
          },
          {
            name: 'Medicine Unit',
            people: [
              {
                name: 'Robert Williams',
                role: 'Nurse Manager',
                timeline: steps(
                  ['Med-Surg Cert', 'Telemetry', 'Charge Nurse', 'Unit Leadership', 'Magnet Champion', 'Nurse Residency Mentor'],
                  5,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'kennedy-krieger',
        name: 'Kennedy Krieger Institute',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Pediatric Rehabilitation',
            people: [
              {
                name: 'Dr. Lisa Park',
                role: 'Nursing Director',
                timeline: steps(
                  ['Peds Rehab Orientation', 'Feeding & Swallowing', 'Neurodevelopmental Care', 'Family Education', 'Discharge Planning', 'Program Evaluation'],
                  5,
                ),
              },
              {
                name: 'Jordan Ellis',
                role: 'Clinical Nurse',
                timeline: steps(
                  ['Peds Rehab Orientation', 'Feeding & Swallowing', 'Neurodevelopmental Care', 'Family Education', 'Discharge Planning', 'Program Evaluation'],
                  2,
                ),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'msn-entry',
        name: 'MSN Entry into Nursing',
        type: 'degree',
        description: 'Pre-licensure pathway for career changers — 5 semesters, 1000+ clinical hours, 95% NCLEX pass rate.',
        offeredBy: [
          { orgSlug: 'johns-hopkins', role: 'School' },
          { orgSlug: 'jh-hospital', role: 'Clinical site' },
          { orgSlug: 'jh-bayview', role: 'Clinical site' },
        ],
        samplePeople: [
          {
            name: 'Aisha Williams',
            role: 'Student — Semester 4',
            timeline: steps(
              ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
              3, MSN_ENTRY_DETAILS,
            ),
          },
          {
            name: 'Carlos Mendez',
            role: 'Student — Semester 2',
            timeline: steps(
              ['Fundamentals', 'Adult Health', 'Pediatrics', 'OB/Maternal', 'Critical Care', 'Psych/Behavioral', 'Capstone & NCLEX'],
              1, MSN_ENTRY_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'dnp-fnp',
        name: 'DNP Family Nurse Practitioner',
        type: 'degree',
        description: 'Doctoral preparation for primary care practice — advanced clinical reasoning, prescribing, and scholarly inquiry.',
        offeredBy: [
          { orgSlug: 'johns-hopkins', role: 'School' },
        ],
        samplePeople: [
          {
            name: 'Priya Sharma',
            role: 'DNP Student',
            timeline: steps(
              ['Adv Pathophysiology', 'Adv Pharmacology', 'Adv Health Assessment', 'EBP & QI', 'Clinical Practicum I', 'Clinical Practicum II', 'Scholarly Project'],
              4, DNP_FNP_DETAILS,
            ),
          },
          {
            name: 'Dr. Jason Farley',
            role: 'Faculty',
            timeline: steps(
              ['Adv Pathophysiology', 'Adv Pharmacology', 'Adv Health Assessment', 'EBP & QI', 'Clinical Practicum I', 'Clinical Practicum II', 'Scholarly Project'],
              6, DNP_FNP_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'dnp-pmhnp',
        name: 'DNP Psychiatric Mental Health NP',
        type: 'degree',
        description: 'Specialized doctoral track for psychiatric and behavioral health advanced practice.',
        offeredBy: [
          { orgSlug: 'johns-hopkins', role: 'School' },
        ],
        samplePeople: [
          {
            name: 'James Okafor',
            role: 'DNP Student',
            timeline: steps(
              ['Adv Psychopathology', 'Psychopharmacology', 'Therapeutic Modalities', 'Psych Assessment', 'Psych Clinical I', 'Psych Clinical II', 'Scholarly Project'],
              3, DNP_PMHNP_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'peds-rehab-residency',
        name: 'Pediatric Rehabilitation Nursing',
        type: 'residency',
        description: 'Specialty residency in pediatric rehabilitation — neurodevelopmental care, feeding, and family education.',
        offeredBy: [
          { orgSlug: 'kennedy-krieger', role: 'Host' },
        ],
        samplePeople: [
          {
            name: 'Jordan Ellis',
            role: 'Clinical Nurse',
            timeline: steps(
              ['Peds Rehab Orientation', 'Feeding & Swallowing', 'Neurodevelopmental Care', 'Family Education', 'Discharge Planning', 'Program Evaluation'],
              2,
            ),
          },
        ],
      },
    ],
    affiliations: [
      {
        name: 'Johns Hopkins',
        orgSlugs: ['johns-hopkins', 'jh-hospital', 'jh-bayview', 'kennedy-krieger'],
      },
    ],
    independentPractitioners: [
      {
        name: 'Tomeka Sanders',
        role: 'Family Nurse Practitioner — Independent Practice',
        timeline: steps(
          ['Board Certification', 'Practice Setup', 'Patient Panel', 'CE Requirements', 'Specialty Cert', 'Mentoring'],
          3,
          [
            'AANP board certification — Family Nurse Practitioner',
            'Establishing independent NP practice — state licensing, malpractice, EHR setup',
            'Building patient panel — 800+ patients, chronic disease management focus',
            'Annual continuing education — 25 CE hours, pharmacology requirement',
            'Diabetes management specialty certification',
            'Precepting NP students from local programs',
          ],
        ),
      },
      {
        name: 'Brian Whitfield',
        role: 'Travel Nurse — Critical Care',
        timeline: steps(
          ['CCRN Cert', 'Agency Onboarding', 'Assignment 1', 'Assignment 2', 'Perm Placement', 'Charge Nurse'],
          3,
          [
            'Critical Care Registered Nurse certification',
            'Travel agency credentialing, multi-state compact license',
            'First 13-week assignment — Level I Trauma ICU, Houston',
            'Second assignment — Cardiac ICU, Denver, rapid-response team',
            'Evaluating permanent positions at academic medical centers',
            'Goal: charge nurse leadership at a Magnet-designated hospital',
          ],
        ),
      },
      {
        name: 'Lucia Fernandez',
        role: 'School Nurse — Public Health',
        timeline: steps(
          ['RN License', 'School Nurse Cert', 'IEP Management', 'Health Ed Programs', 'District Leadership'],
          2,
          [
            'Registered Nurse license — pediatric experience in community health',
            'National Board Certification for School Nurses (NBCSN)',
            'Managing individualized education plans for students with chronic conditions',
            'Developing health education curriculum — mental health, nutrition, safety',
            'District-wide school nurse coordinator role',
          ],
        ),
      },
    ],
  },
  {
    slug: 'drawing',
    name: 'Drawing',
    color: '#E64A19',
    icon: 'color-palette',
    organizations: [
      {
        slug: 'circle-line',
        name: 'Circle Line Art School',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Foundation Drawing',
            people: [
              {
                name: 'Tom McPherson',
                role: 'Instructor',
                timeline: steps(['Line & Contour', 'Perspective', 'Light & Shadow', 'Composition', 'Figure Drawing', 'Portfolio'], 5, DRAWING_FOUNDATION_DETAILS),
              },
              {
                name: 'Anna Kowalski',
                role: 'Student',
                timeline: steps(['Line & Contour', 'Perspective', 'Light & Shadow', 'Composition', 'Figure Drawing', 'Portfolio'], 2, DRAWING_FOUNDATION_DETAILS),
              },
              {
                name: 'Jake Morrison',
                role: 'Student',
                timeline: steps(['Line & Contour', 'Perspective', 'Light & Shadow', 'Composition', 'Figure Drawing', 'Portfolio'], 3, DRAWING_FOUNDATION_DETAILS),
              },
            ],
          },
          {
            name: 'Advanced Illustration',
            people: [
              {
                name: 'Claire Dubois',
                role: 'Instructor',
                timeline: steps(['Digital Tools', 'Character Design', 'Environment Art', 'Narrative Illustration', 'Client Projects'], 4),
              },
              {
                name: 'Sam Patel',
                role: 'Student',
                timeline: steps(['Digital Tools', 'Character Design', 'Environment Art', 'Narrative Illustration', 'Client Projects'], 1),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'foundation-drawing',
        name: 'Foundation Drawing',
        type: 'course',
        description: 'Structured 6-module course covering line, perspective, light, composition, figure drawing, and portfolio development.',
        offeredBy: [{ orgSlug: 'circle-line', role: 'School' }],
        samplePeople: [
          {
            name: 'Anna Kowalski',
            role: 'Student',
            timeline: steps(['Line & Contour', 'Perspective', 'Light & Shadow', 'Composition', 'Figure Drawing', 'Portfolio'], 2, DRAWING_FOUNDATION_DETAILS),
          },
          {
            name: 'Jake Morrison',
            role: 'Student',
            timeline: steps(['Line & Contour', 'Perspective', 'Light & Shadow', 'Composition', 'Figure Drawing', 'Portfolio'], 3, DRAWING_FOUNDATION_DETAILS),
          },
        ],
      },
      {
        slug: 'advanced-illustration',
        name: 'Advanced Illustration',
        type: 'course',
        description: 'Digital illustration pipeline — tools, character design, environments, narrative work, and client projects.',
        offeredBy: [{ orgSlug: 'circle-line', role: 'School' }],
        samplePeople: [
          {
            name: 'Sam Patel',
            role: 'Student',
            timeline: steps(['Digital Tools', 'Character Design', 'Environment Art', 'Narrative Illustration', 'Client Projects'], 1),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'Maya Reeves',
        role: 'Plein Air Artist — Self-taught',
        timeline: steps(
          ['Sketchbook Practice', 'Value Studies', 'Color Mixing', 'Plein Air Outings', 'Exhibition'],
          3,
          [
            'Daily sketchbook habit — 30-min observational drawing sessions',
            'Charcoal and graphite value studies from still life and landscape',
            'Watercolor and gouache color mixing, limited palette exercises',
            'Weekly plein air painting sessions — parks, urban scenes, coastline',
            'First solo exhibition at a local gallery',
          ],
        ),
      },
      {
        name: 'Darius Cole',
        role: 'Digital Concept Artist — Freelance',
        timeline: steps(
          ['Fundamentals', 'Digital Painting', 'Concept Art', 'Portfolio', 'Client Work'],
          3,
          [
            'Traditional drawing fundamentals — anatomy, perspective, gesture',
            'Procreate and Photoshop digital painting techniques',
            'Concept art for games and film — environments, props, creatures',
            'Building professional portfolio and ArtStation presence',
            'Freelance concept art commissions for indie studios',
          ],
        ),
      },
    ],
  },
  {
    slug: 'sail-racing',
    name: 'Sail Racing',
    color: '#003DA5',
    icon: 'boat',
    organizations: [
      {
        slug: 'rhkyc',
        name: 'Royal Hong Kong Yacht Club',
        groupLabel: 'Fleets',
        groups: [
          {
            name: 'Dragons Fleet',
            people: [
              {
                name: 'Mike Stevens',
                role: 'Fleet Captain',
                timeline: steps(['Spring Series', 'Mid-Season', 'Summer Regatta', 'Autumn Cup', 'Winter Series', 'Nationals'], 3, SAILING_SEASON_DETAILS),
              },
              {
                name: 'Wei Chen',
                role: 'Sailor',
                timeline: steps(['Spring Series', 'Mid-Season', 'Summer Regatta', 'Autumn Cup', 'Winter Series', 'Nationals'], 2, SAILING_SEASON_DETAILS),
              },
              {
                name: 'Sophie Laurent',
                role: 'Sailor',
                timeline: steps(['Spring Series', 'Mid-Season', 'Summer Regatta', 'Autumn Cup', 'Winter Series', 'Nationals'], 4, SAILING_SEASON_DETAILS),
              },
            ],
          },
          {
            name: 'Etchells Fleet',
            people: [
              {
                name: 'James Thornton',
                role: 'Coach',
                timeline: steps(['Fundamentals', 'Boat Handling', 'Starts', 'Upwind Tactics', 'Downwind', 'Race Craft', 'Championship'], 5, SAILING_SKILLS_DETAILS),
              },
              {
                name: 'Kai Nakamura',
                role: 'Sailor',
                timeline: steps(['Fundamentals', 'Boat Handling', 'Starts', 'Upwind Tactics', 'Downwind', 'Race Craft', 'Championship'], 3, SAILING_SKILLS_DETAILS),
              },
            ],
          },
        ],
      },
      {
        slug: 'abc-sailing',
        name: 'Aberdeen Boat Club',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Youth Sailing',
            people: [
              {
                name: 'Helen Chow',
                role: 'Head Coach',
                timeline: steps(['Level 1', 'Level 2', 'Level 3', 'Racing Intro', 'Team Racing', 'Regatta'], 5),
              },
              {
                name: 'Tommy Lee',
                role: 'Sailor',
                timeline: steps(['Level 1', 'Level 2', 'Level 3', 'Racing Intro', 'Team Racing', 'Regatta'], 2),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'youth-learn-to-sail',
        name: 'Youth Learn to Sail',
        type: 'training',
        description: 'Progressive 6-level youth sailing program — from first tiller to regatta competition.',
        offeredBy: [{ orgSlug: 'abc-sailing', role: 'Club' }],
        samplePeople: [
          {
            name: 'Tommy Lee',
            role: 'Sailor',
            timeline: steps(['Level 1', 'Level 2', 'Level 3', 'Racing Intro', 'Team Racing', 'Regatta'], 2),
          },
        ],
      },
      {
        slug: 'keelboat-racing',
        name: 'Keelboat Racing',
        type: 'training',
        description: 'Season-long fleet racing — Dragons and Etchells classes, from spring series through nationals.',
        offeredBy: [
          { orgSlug: 'rhkyc', role: 'Host club' },
        ],
        samplePeople: [
          {
            name: 'Wei Chen',
            role: 'Sailor',
            timeline: steps(['Spring Series', 'Mid-Season', 'Summer Regatta', 'Autumn Cup', 'Winter Series', 'Nationals'], 2, SAILING_SEASON_DETAILS),
          },
          {
            name: 'Kai Nakamura',
            role: 'Sailor',
            timeline: steps(['Fundamentals', 'Boat Handling', 'Starts', 'Upwind Tactics', 'Downwind', 'Race Craft', 'Championship'], 3, SAILING_SKILLS_DETAILS),
          },
        ],
      },
      {
        slug: 'race-officer-cert',
        name: 'Race Officer Certification',
        type: 'certification',
        description: 'World Sailing–recognized certification for race management — rules, course setting, and protest procedures.',
        offeredBy: [
          { orgSlug: 'rhkyc', role: 'Training center' },
          { orgSlug: 'abc-sailing', role: 'Training center' },
        ],
        samplePeople: [
          {
            name: 'Mike Stevens',
            role: 'Fleet Captain',
            timeline: steps(
              ['Rules & Regs', 'Course Design', 'Starting Procedures', 'Scoring', 'Protest Management', 'Principal Race Officer'],
              4,
              [
                'Racing Rules of Sailing — Part 2, definitions, protest-eligible situations',
                'Course geometry, mark placement, windward-leeward and trapezoid layouts',
                'Starting sequence flags, timing, recalls, black flag procedures',
                'Low-point and high-point scoring, handicap systems, series management',
                'Protest committee procedures, redress, rule 69 hearings',
                'Principal Race Officer qualification — managing full regatta operations',
              ],
            ),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'Elena Vasquez',
        role: 'Solo Offshore Sailor',
        timeline: steps(
          ['Coastal Cruising', 'Offshore Cert', 'Solo Passages', 'Ocean Race Qualifier', 'Transatlantic'],
          2,
          [
            'Coastal cruising experience — 2,000+ nm logged, day/night sailing',
            'RYA Yachtmaster Offshore certification — celestial nav, heavy weather',
            'Solo passages — 500 nm qualifying legs, self-sufficiency systems',
            'Mini Transat qualifier series — solo offshore racing preparation',
            'Goal: complete solo transatlantic race',
          ],
        ),
      },
      {
        name: 'Tom Hayward',
        role: 'Dinghy Sailor — Club Racer',
        timeline: steps(
          ['Learn to Sail', 'Club Racing', 'Traveller Series', 'National Squad', 'Worlds'],
          3,
          [
            'RYA Level 2 dinghy sailing certification',
            'Weekly club racing in Laser class — 40+ races per season',
            'Regional traveller series — top 10 finishes, open meetings',
            'National squad selection — training camps, international regattas',
            'Goal: represent at Laser World Championships',
          ],
        ),
      },
    ],
  },
  {
    slug: 'design',
    name: 'Design',
    color: '#7B1FA2',
    icon: 'brush',
    organizations: [
      {
        slug: 'iit-id',
        name: 'IIT Institute of Design',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'MDes — Master of Design',
            groupLabel: 'Concentrations',
            subgroups: [
              {
                name: 'Core Curriculum',
                people: [
                  {
                    name: 'Tomoko Ichikawa',
                    role: 'Teaching Professor, Visual Communication',
                    timeline: steps(
                      ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                      5, MDES_CORE_DETAILS,
                    ),
                  },
                  {
                    name: 'Martin Thaler',
                    role: 'Professor, Product & Environment Design',
                    timeline: steps(
                      ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                      5, MDES_CORE_DETAILS,
                    ),
                  },
                  {
                    name: 'Noa Vardi',
                    role: 'MDes Student — Year 1',
                    timeline: steps(
                      ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                      2, MDES_CORE_DETAILS,
                    ),
                  },
                ],
              },
              {
                name: 'Design Research & Insight',
                people: [
                  {
                    name: 'Kim Erwin',
                    role: 'Assoc. Professor, Healthcare Design & Methods',
                    timeline: steps(
                      ['Ethnographic Methods', 'Generative Research', 'Behavioral Research', 'Synthesis Methods', 'Research Strategy', 'Research Leadership'],
                      5, MDES_RESEARCH_DETAILS,
                    ),
                  },
                  {
                    name: 'Ruth Schmidt',
                    role: 'Assoc. Professor, Behavioral Design',
                    timeline: steps(
                      ['Ethnographic Methods', 'Generative Research', 'Behavioral Research', 'Synthesis Methods', 'Research Strategy', 'Research Leadership'],
                      5, MDES_RESEARCH_DETAILS,
                    ),
                  },
                  {
                    name: 'Priya Kapoor',
                    role: 'MDes Student — Year 2',
                    timeline: steps(
                      ['Ethnographic Methods', 'Generative Research', 'Behavioral Research', 'Synthesis Methods', 'Research Strategy', 'Research Leadership'],
                      3, MDES_RESEARCH_DETAILS,
                    ),
                  },
                  {
                    name: 'Jordan Blake',
                    role: 'MDes Student — Year 1',
                    timeline: steps(
                      ['Ethnographic Methods', 'Generative Research', 'Behavioral Research', 'Synthesis Methods', 'Research Strategy', 'Research Leadership'],
                      1, MDES_RESEARCH_DETAILS,
                    ),
                  },
                ],
              },
              {
                name: 'Product-Service Delivery',
                people: [
                  {
                    name: 'Zach Pino',
                    role: 'Assoc. Professor, Product Design',
                    timeline: steps(
                      ['Physical Prototyping', 'Digital Prototyping', 'Service Design', 'Business Modeling', 'Implementation', 'Capstone'],
                      5, MDES_PRODUCT_SERVICE_DETAILS,
                    ),
                  },
                  {
                    name: 'Maura Shea',
                    role: 'Assoc. Industry Professor, Community Design',
                    timeline: steps(
                      ['Physical Prototyping', 'Digital Prototyping', 'Service Design', 'Business Modeling', 'Implementation', 'Capstone'],
                      5, MDES_PRODUCT_SERVICE_DETAILS,
                    ),
                  },
                  {
                    name: 'Marcus Oyelaran',
                    role: 'MDes Student — Year 2',
                    timeline: steps(
                      ['Physical Prototyping', 'Digital Prototyping', 'Service Design', 'Business Modeling', 'Implementation', 'Capstone'],
                      4, MDES_PRODUCT_SERVICE_DETAILS,
                    ),
                  },
                  {
                    name: 'Lena Torres',
                    role: 'MDes Student — Year 1',
                    timeline: steps(
                      ['Physical Prototyping', 'Digital Prototyping', 'Service Design', 'Business Modeling', 'Implementation', 'Capstone'],
                      1, MDES_PRODUCT_SERVICE_DETAILS,
                    ),
                  },
                ],
              },
              {
                name: 'Innovation Strategy',
                people: [
                  {
                    name: 'Carlos Teixeira',
                    role: 'Charles L. Owen Professor of Systems Design',
                    timeline: steps(
                      ['Design Planning', 'Organizational Design', 'Platform Strategy', 'Design-Led Venture', 'Strategic Communication', 'Capstone'],
                      5, MDES_INNOVATION_DETAILS,
                    ),
                  },
                  {
                    name: 'Alex Rivera',
                    role: 'MDes Student — Year 2',
                    timeline: steps(
                      ['Design Planning', 'Organizational Design', 'Platform Strategy', 'Design-Led Venture', 'Strategic Communication', 'Capstone'],
                      3, MDES_INNOVATION_DETAILS,
                    ),
                  },
                ],
              },
            ],
            people: [],
          },
          {
            name: 'MS Strategic Design Leadership (formerly MDM)',
            people: [
              {
                name: 'Matt Mayfield',
                role: 'Assoc. Dean of Academics, MDes/MS-SDL Director',
                timeline: steps(
                  ['Design Thinking', 'Organizational Systems', 'Evidence-Based Design', 'Strategic Planning', 'Leadership Practicum', 'Capstone'],
                  5, MS_SDL_DETAILS,
                ),
              },
              {
                name: 'Anita Velasco',
                role: 'MS-SDL Student, VP Product at Accenture',
                timeline: steps(
                  ['Design Thinking', 'Organizational Systems', 'Evidence-Based Design', 'Strategic Planning', 'Leadership Practicum', 'Capstone'],
                  3, MS_SDL_DETAILS,
                ),
              },
              {
                name: 'David Okonkwo',
                role: 'MS-SDL Student, Design Director at Deloitte',
                timeline: steps(
                  ['Design Thinking', 'Organizational Systems', 'Evidence-Based Design', 'Strategic Planning', 'Leadership Practicum', 'Capstone'],
                  2, MS_SDL_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'MDes + MBA Dual Degree',
            people: [
              {
                name: 'Anijo Mathew',
                role: 'Dean, Institute of Design',
                timeline: steps(
                  ['Design Core', 'Business Foundations', 'Design Research', 'Marketing & Finance', 'Innovation Lab', 'Integrated Capstone'],
                  5,
                ),
              },
              {
                name: 'Sophie Lindgren',
                role: 'MDes+MBA Student — Year 2',
                timeline: steps(
                  ['Design Core', 'Business Foundations', 'Design Research', 'Marketing & Finance', 'Innovation Lab', 'Integrated Capstone'],
                  3,
                ),
              },
            ],
          },
          {
            name: 'PhD in Design',
            people: [
              {
                name: 'Carlos Teixeira',
                role: 'PhD Program Director',
                timeline: steps(
                  ['Design Theory', 'Research Methods', 'Doctoral Seminar I', 'Doctoral Seminar II', 'Dissertation Proposal', 'Dissertation Research', 'Defense'],
                  6, PHD_DESIGN_DETAILS,
                ),
              },
              {
                name: 'Weslynne Ashton',
                role: 'Professor, Environmental Mgmt & Sustainability',
                timeline: steps(
                  ['Design Theory', 'Research Methods', 'Doctoral Seminar I', 'Doctoral Seminar II', 'Dissertation Proposal', 'Dissertation Research', 'Defense'],
                  6, PHD_DESIGN_DETAILS,
                ),
              },
              {
                name: 'Ji-Yeon Kim',
                role: 'PhD Candidate — Year 4',
                timeline: steps(
                  ['Design Theory', 'Research Methods', 'Doctoral Seminar I', 'Doctoral Seminar II', 'Dissertation Proposal', 'Dissertation Research', 'Defense'],
                  5, PHD_DESIGN_DETAILS,
                ),
              },
              {
                name: 'Ravi Deshmukh',
                role: 'PhD Student — Year 2',
                timeline: steps(
                  ['Design Theory', 'Research Methods', 'Doctoral Seminar I', 'Doctoral Seminar II', 'Dissertation Proposal', 'Dissertation Research', 'Defense'],
                  2, PHD_DESIGN_DETAILS,
                ),
              },
            ],
          },
        ],
        cohorts: [
          {
            name: 'MDes — Fall 2025 Cohort (Year 2)',
            people: [
              {
                name: 'Priya Kapoor',
                role: 'Design Research Concentration',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  4, MDES_CORE_DETAILS,
                ),
              },
              {
                name: 'Marcus Oyelaran',
                role: 'Product-Service Concentration',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  4, MDES_CORE_DETAILS,
                ),
              },
              {
                name: 'Alex Rivera',
                role: 'Innovation Strategy Concentration',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  4, MDES_CORE_DETAILS,
                ),
              },
              {
                name: 'Hana Takahashi',
                role: 'Design Research Concentration',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  5, MDES_CORE_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'MDes — Fall 2026 Cohort (Year 1)',
            people: [
              {
                name: 'Noa Vardi',
                role: 'Foundation Sequence',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  2, MDES_CORE_DETAILS,
                ),
              },
              {
                name: 'Jordan Blake',
                role: 'Foundation Sequence',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  1, MDES_CORE_DETAILS,
                ),
              },
              {
                name: 'Lena Torres',
                role: 'Foundation Sequence',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  1, MDES_CORE_DETAILS,
                ),
              },
              {
                name: 'Ethan Okafor',
                role: 'Foundation Sequence',
                timeline: steps(
                  ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
                  2, MDES_CORE_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'MS-SDL — 2025 Cohort',
            people: [
              {
                name: 'Anita Velasco',
                role: 'VP Product, Accenture',
                timeline: steps(
                  ['Design Thinking', 'Organizational Systems', 'Evidence-Based Design', 'Strategic Planning', 'Leadership Practicum', 'Capstone'],
                  3, MS_SDL_DETAILS,
                ),
              },
              {
                name: 'David Okonkwo',
                role: 'Design Director, Deloitte',
                timeline: steps(
                  ['Design Thinking', 'Organizational Systems', 'Evidence-Based Design', 'Strategic Planning', 'Leadership Practicum', 'Capstone'],
                  2, MS_SDL_DETAILS,
                ),
              },
              {
                name: 'Rachel Nguyen',
                role: 'Sr. UX Manager, Google',
                timeline: steps(
                  ['Design Thinking', 'Organizational Systems', 'Evidence-Based Design', 'Strategic Planning', 'Leadership Practicum', 'Capstone'],
                  4, MS_SDL_DETAILS,
                ),
              },
            ],
          },
        ],
        capabilityGoals: [
          {
            name: 'Human-Centered Design',
            people: [
              {
                name: 'Priya Kapoor',
                role: 'MDes Year 2',
                timeline: steps(
                  ['Empathic Research', 'Inclusive Design', 'Participatory Methods', 'Ethical Practice', 'Impact Assessment'],
                  3, ID_HUMAN_CENTERED_DETAILS,
                ),
              },
              {
                name: 'Jordan Blake',
                role: 'MDes Year 1',
                timeline: steps(
                  ['Empathic Research', 'Inclusive Design', 'Participatory Methods', 'Ethical Practice', 'Impact Assessment'],
                  1, ID_HUMAN_CENTERED_DETAILS,
                ),
              },
              {
                name: 'Anita Velasco',
                role: 'MS-SDL Student',
                timeline: steps(
                  ['Empathic Research', 'Inclusive Design', 'Participatory Methods', 'Ethical Practice', 'Impact Assessment'],
                  3, ID_HUMAN_CENTERED_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Systems Thinking & Complexity',
            people: [
              {
                name: 'Alex Rivera',
                role: 'MDes Year 2',
                timeline: steps(
                  ['System Mapping', 'Complexity Navigation', 'Stakeholder Analysis', 'Transition Design', 'Systemic Intervention'],
                  3, ID_SYSTEMS_THINKING_DETAILS,
                ),
              },
              {
                name: 'Ji-Yeon Kim',
                role: 'PhD Candidate',
                timeline: steps(
                  ['System Mapping', 'Complexity Navigation', 'Stakeholder Analysis', 'Transition Design', 'Systemic Intervention'],
                  4, ID_SYSTEMS_THINKING_DETAILS,
                ),
              },
              {
                name: 'Marcus Oyelaran',
                role: 'MDes Year 2',
                timeline: steps(
                  ['System Mapping', 'Complexity Navigation', 'Stakeholder Analysis', 'Transition Design', 'Systemic Intervention'],
                  2, ID_SYSTEMS_THINKING_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Making & Prototyping',
            people: [
              {
                name: 'Noa Vardi',
                role: 'MDes Year 1',
                timeline: steps(
                  ['Physical Making', 'Digital Fabrication', 'Experience Prototyping', 'Interactive Prototyping', 'Design Communication'],
                  1, ID_MAKING_PROTOTYPING_DETAILS,
                ),
              },
              {
                name: 'Lena Torres',
                role: 'MDes Year 1',
                timeline: steps(
                  ['Physical Making', 'Digital Fabrication', 'Experience Prototyping', 'Interactive Prototyping', 'Design Communication'],
                  1, ID_MAKING_PROTOTYPING_DETAILS,
                ),
              },
              {
                name: 'Marcus Oyelaran',
                role: 'MDes Year 2',
                timeline: steps(
                  ['Physical Making', 'Digital Fabrication', 'Experience Prototyping', 'Interactive Prototyping', 'Design Communication'],
                  4, ID_MAKING_PROTOTYPING_DETAILS,
                ),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'mdes',
        name: 'Master of Design (MDes)',
        type: 'degree',
        description: 'Two-year graduate program with concentrations in design research, product-service delivery, and innovation strategy.',
        offeredBy: [{ orgSlug: 'iit-id', role: 'School' }],
        samplePeople: [
          {
            name: 'Noa Vardi',
            role: 'MDes Student — Year 1',
            timeline: steps(
              ['Observation & Inquiry', 'Synthesis & Framing', 'Prototyping & Testing', 'Systems & Complexity', 'Service Design', 'Design Planning'],
              2, MDES_CORE_DETAILS,
            ),
          },
          {
            name: 'Priya Kapoor',
            role: 'MDes Student — Year 2',
            timeline: steps(
              ['Ethnographic Methods', 'Generative Research', 'Behavioral Research', 'Synthesis Methods', 'Research Strategy', 'Research Leadership'],
              3, MDES_RESEARCH_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'ms-sdl',
        name: 'MS Strategic Design Leadership',
        type: 'degree',
        description: 'Part-time graduate program for working professionals — design thinking applied to organizational leadership.',
        offeredBy: [{ orgSlug: 'iit-id', role: 'School' }],
        samplePeople: [
          {
            name: 'Anita Velasco',
            role: 'MS-SDL Student, VP Product at Accenture',
            timeline: steps(
              ['Design Thinking', 'Organizational Systems', 'Evidence-Based Design', 'Strategic Planning', 'Leadership Practicum', 'Capstone'],
              3, MS_SDL_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'phd-design',
        name: 'PhD in Design',
        type: 'degree',
        description: 'Doctoral research program advancing design theory, methods, and knowledge — 4-5 years, dissertation-based.',
        offeredBy: [{ orgSlug: 'iit-id', role: 'School' }],
        samplePeople: [
          {
            name: 'Ji-Yeon Kim',
            role: 'PhD Candidate — Year 4',
            timeline: steps(
              ['Design Theory', 'Research Methods', 'Doctoral Seminar I', 'Doctoral Seminar II', 'Dissertation Proposal', 'Dissertation Research', 'Defense'],
              5, PHD_DESIGN_DETAILS,
            ),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'Nia Okafor',
        role: 'UX Design Lead — Freelance',
        timeline: steps(
          ['Bootcamp', 'Junior Designer', 'Mid-Level IC', 'Senior / Lead', 'Independent Practice'],
          4,
          [
            'UX/UI design bootcamp — research methods, Figma, prototyping fundamentals',
            'Junior product designer at a startup — shipping features, user testing',
            'Mid-level IC at a design agency — leading projects, mentoring juniors',
            'Senior UX lead — design systems, strategy, cross-functional leadership',
            'Independent UX consulting practice — healthcare and civic tech clients',
          ],
        ),
      },
      {
        name: 'Rafael Mendes',
        role: 'Service Designer — Social Impact',
        timeline: steps(
          ['Design Foundations', 'Community Research', 'Service Blueprinting', 'Policy Design', 'Systems Change'],
          2,
          [
            'Design thinking foundations — workshops, facilitation, human-centered methods',
            'Community-based participatory research — co-design with underserved populations',
            'Service blueprinting for municipal services — permitting, transit, social services',
            'Policy design — translating research insights into actionable policy recommendations',
            'Systems change initiatives — multi-stakeholder coalitions, collective impact',
          ],
        ),
      },
    ],
  },
  {
    slug: 'golf',
    name: 'Golf',
    color: '#1B5E20',
    icon: 'golf',
    organizations: [
      {
        slug: 'pga-academy',
        name: 'PGA Tour Academy',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Junior Development',
            people: [
              {
                name: 'Coach Martinez',
                role: 'Head Pro',
                timeline: steps(['Grip & Stance', 'Short Game', 'Iron Play', 'Driving', 'Course Management', 'Tournament Prep'], 5),
              },
              {
                name: 'Ryan Park',
                role: 'Student',
                timeline: steps(['Grip & Stance', 'Short Game', 'Iron Play', 'Driving', 'Course Management', 'Tournament Prep'], 3),
              },
              {
                name: 'Mia Thompson',
                role: 'Student',
                timeline: steps(['Grip & Stance', 'Short Game', 'Iron Play', 'Driving', 'Course Management', 'Tournament Prep'], 2),
              },
            ],
          },
          {
            name: 'Adult Clinics',
            people: [
              {
                name: 'Sarah Collins',
                role: 'Instructor',
                timeline: steps(['Fundamentals', 'Putting', 'Chipping', 'Approach Shots', 'Full Swing', 'Playing Lessons'], 4),
              },
              {
                name: 'Greg Foster',
                role: 'Student',
                timeline: steps(['Fundamentals', 'Putting', 'Chipping', 'Approach Shots', 'Full Swing', 'Playing Lessons'], 1),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'junior-development',
        name: 'Junior Development Program',
        type: 'training',
        description: 'Structured junior golf pathway — grip fundamentals through tournament preparation and competitive play.',
        offeredBy: [{ orgSlug: 'pga-academy', role: 'Academy' }],
        samplePeople: [
          {
            name: 'Ryan Park',
            role: 'Student',
            timeline: steps(['Grip & Stance', 'Short Game', 'Iron Play', 'Driving', 'Course Management', 'Tournament Prep'], 3),
          },
          {
            name: 'Mia Thompson',
            role: 'Student',
            timeline: steps(['Grip & Stance', 'Short Game', 'Iron Play', 'Driving', 'Course Management', 'Tournament Prep'], 2),
          },
        ],
      },
      {
        slug: 'adult-clinics',
        name: 'Adult Group Clinics',
        type: 'course',
        description: 'Beginner-to-intermediate group instruction — fundamentals, short game, full swing, and on-course play.',
        offeredBy: [{ orgSlug: 'pga-academy', role: 'Academy' }],
        samplePeople: [
          {
            name: 'Greg Foster',
            role: 'Student',
            timeline: steps(['Fundamentals', 'Putting', 'Chipping', 'Approach Shots', 'Full Swing', 'Playing Lessons'], 1),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'James Whitaker',
        role: 'Amateur Golfer — Handicap Tracker',
        timeline: steps(
          ['First Round', 'Handicap Index', 'Breaking 100', 'Breaking 90', 'Club Championship'],
          3,
          [
            'First full 18-hole round — learning etiquette and basic rules',
            'Established GHIN handicap index — tracking rounds and progress',
            'Consistently breaking 100 — improved short game and course management',
            'Working toward breaking 90 — iron consistency and putting drills',
            'Goal: compete in annual club championship',
          ],
        ),
      },
      {
        name: 'Priya Nair',
        role: 'Golf Fitness & Mental Game',
        timeline: steps(
          ['Flexibility Screen', 'Golf Fitness', 'Mental Game', 'Performance Tracking', 'Competition Prep'],
          2,
          [
            'TPI movement screen — identifying physical limitations affecting swing',
            'Golf-specific fitness program — rotational power, hip mobility, core stability',
            'Mental performance coaching — pre-shot routines, pressure management',
            'Tracking stats with Arccos — strokes gained analysis, practice priorities',
            'Preparing for USGA amateur qualifying events',
          ],
        ),
      },
    ],
  },
  {
    slug: 'health-and-fitness',
    name: 'Health & Fitness',
    color: '#2E7D32',
    icon: 'barbell',
    organizations: [
      // ── Exercise ──────────────────────────────────────────────
      {
        slug: 'ironworks-gym',
        name: 'Ironworks Performance Gym',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Strength & Conditioning',
            people: [
              {
                name: 'Coach Davis',
                role: 'Head Coach',
                timeline: steps(['Assessment', 'Foundation Phase', 'Build Phase', 'Peak Phase', 'Competition', 'Recovery'], 4),
              },
              {
                name: 'Tanya Brooks',
                role: 'Athlete',
                timeline: steps(['Assessment', 'Foundation Phase', 'Build Phase', 'Peak Phase', 'Competition', 'Recovery'], 2),
              },
              {
                name: 'Derek Huang',
                role: 'Athlete',
                timeline: steps(['Assessment', 'Foundation Phase', 'Build Phase', 'Peak Phase', 'Competition', 'Recovery'], 3),
              },
            ],
          },
          {
            name: 'CrossFit Program',
            people: [
              {
                name: 'Jessica Morales',
                role: 'Coach',
                timeline: steps(['Foundations', 'Skill Work', 'MetCon', 'Gymnastics', 'Olympic Lifting', 'Competition'], 5),
              },
              {
                name: 'Tyler Ross',
                role: 'Athlete',
                timeline: steps(['Foundations', 'Skill Work', 'MetCon', 'Gymnastics', 'Olympic Lifting', 'Competition'], 1),
              },
            ],
          },
        ],
      },
      // ── Food & Nutrition ──────────────────────────────────────
      {
        slug: 'nourish-collective',
        name: 'Nourish Collective',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Whole-Foods Nutrition',
            people: [
              {
                name: 'Dr. Amara Osei',
                role: 'Registered Dietitian',
                timeline: steps(['Intake Assessment', 'Meal Planning', 'Habit Building', 'Maintenance', 'Advanced Coaching'], 4),
              },
              {
                name: 'Liam Chen',
                role: 'Member',
                timeline: steps(['Intake Assessment', 'Meal Planning', 'Habit Building', 'Maintenance', 'Advanced Coaching'], 2),
              },
            ],
          },
          {
            name: 'Plant-Based Cooking',
            people: [
              {
                name: 'Chef Rosa Delgado',
                role: 'Instructor',
                timeline: steps(['Kitchen Basics', 'Seasonal Meals', 'Meal Prep Mastery', 'Fermentation', 'Teaching Others'], 4),
              },
              {
                name: 'Maya Patel',
                role: 'Student',
                timeline: steps(['Kitchen Basics', 'Seasonal Meals', 'Meal Prep Mastery', 'Fermentation', 'Teaching Others'], 1),
              },
            ],
          },
        ],
      },
      // ── Social Health ─────────────────────────────────────────
      {
        slug: 'harbor-community-center',
        name: 'Harbor Community Center',
        groupLabel: 'Groups',
        groups: [
          {
            name: 'Men\'s Wellness Circle',
            people: [
              {
                name: 'James Adler',
                role: 'Facilitator',
                timeline: steps(['Welcome Session', 'Story Sharing', 'Vulnerability Practice', 'Accountability Partners', 'Peer Leadership'], 4),
              },
              {
                name: 'Marcus Johnson',
                role: 'Member',
                timeline: steps(['Welcome Session', 'Story Sharing', 'Vulnerability Practice', 'Accountability Partners', 'Peer Leadership'], 2),
              },
            ],
          },
          {
            name: 'Intergenerational Connection',
            people: [
              {
                name: 'Eleanor Kim',
                role: 'Program Director',
                timeline: steps(['Orientation', 'Paired Activities', 'Community Projects', 'Storytelling Events', 'Ongoing Mentorship'], 3),
              },
              {
                name: 'David Okonkwo',
                role: 'Volunteer Mentor',
                timeline: steps(['Orientation', 'Paired Activities', 'Community Projects', 'Storytelling Events', 'Ongoing Mentorship'], 2),
              },
            ],
          },
        ],
      },
      // ── Spiritual Health ──────────────────────────────────────
      {
        slug: 'still-point-retreat',
        name: 'Still Point Retreat Center',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Mindfulness & Meditation',
            people: [
              {
                name: 'Roshi Anne Takahashi',
                role: 'Teacher',
                timeline: steps(['Breath Basics', 'Sitting Practice', 'Walking Meditation', 'Retreat Intensive', 'Daily Integration'], 4),
              },
              {
                name: 'Sam Rivera',
                role: 'Student',
                timeline: steps(['Breath Basics', 'Sitting Practice', 'Walking Meditation', 'Retreat Intensive', 'Daily Integration'], 1),
              },
            ],
          },
          {
            name: 'Contemplative Movement',
            people: [
              {
                name: 'Yuki Tanabe',
                role: 'Instructor',
                timeline: steps(['Gentle Yoga', 'Tai Chi Foundations', 'Qi Gong', 'Nature Walks', 'Silent Retreat'], 3),
              },
              {
                name: 'Grace Hernandez',
                role: 'Participant',
                timeline: steps(['Gentle Yoga', 'Tai Chi Foundations', 'Qi Gong', 'Nature Walks', 'Silent Retreat'], 2),
              },
            ],
          },
        ],
      },
    ],
    affiliations: [
      { name: 'Exercise', orgSlugs: ['ironworks-gym'] },
      { name: 'Food & Nutrition', orgSlugs: ['nourish-collective'] },
      { name: 'Social Health', orgSlugs: ['harbor-community-center'] },
      { name: 'Spiritual Health', orgSlugs: ['still-point-retreat'] },
    ],
    programs: [
      {
        slug: 'strength-conditioning',
        name: 'Strength & Conditioning',
        type: 'training',
        description: 'Periodized training program — assessment through competition, with structured build, peak, and recovery phases.',
        offeredBy: [{ orgSlug: 'ironworks-gym', role: 'Gym' }],
        samplePeople: [
          {
            name: 'Tanya Brooks',
            role: 'Athlete',
            timeline: steps(['Assessment', 'Foundation Phase', 'Build Phase', 'Peak Phase', 'Competition', 'Recovery'], 2),
          },
          {
            name: 'Derek Huang',
            role: 'Athlete',
            timeline: steps(['Assessment', 'Foundation Phase', 'Build Phase', 'Peak Phase', 'Competition', 'Recovery'], 3),
          },
        ],
      },
      {
        slug: 'crossfit-program',
        name: 'CrossFit Program',
        type: 'training',
        description: 'Functional fitness — foundations, gymnastics, Olympic lifting, and metabolic conditioning for competition readiness.',
        offeredBy: [{ orgSlug: 'ironworks-gym', role: 'Gym' }],
        samplePeople: [
          {
            name: 'Tyler Ross',
            role: 'Athlete',
            timeline: steps(['Foundations', 'Skill Work', 'MetCon', 'Gymnastics', 'Olympic Lifting', 'Competition'], 1),
          },
        ],
      },
      {
        slug: 'whole-foods-nutrition',
        name: 'Whole-Foods Nutrition',
        type: 'training',
        description: 'Guided nutrition journey — assessment, meal planning, habit building, and long-term maintenance with a registered dietitian.',
        offeredBy: [{ orgSlug: 'nourish-collective', role: 'Nutrition Center' }],
        samplePeople: [
          {
            name: 'Liam Chen',
            role: 'Member',
            timeline: steps(['Intake Assessment', 'Meal Planning', 'Habit Building', 'Maintenance', 'Advanced Coaching'], 2),
          },
        ],
      },
      {
        slug: 'mindfulness-meditation',
        name: 'Mindfulness & Meditation',
        type: 'training',
        description: 'From breath basics through retreat-level practice — a structured path to daily mindfulness integration.',
        offeredBy: [{ orgSlug: 'still-point-retreat', role: 'Retreat Center' }],
        samplePeople: [
          {
            name: 'Sam Rivera',
            role: 'Student',
            timeline: steps(['Breath Basics', 'Sitting Practice', 'Walking Meditation', 'Retreat Intensive', 'Daily Integration'], 1),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'Keiko Tanaka',
        role: 'Marathon Runner — Self-coached',
        timeline: steps(
          ['Base Building', '5K Race', 'Half Marathon', 'Marathon Training', 'BQ Attempt'],
          3,
          [
            'Aerobic base building — 30 mpw, easy runs, heart rate zone training',
            'First 5K race — 24:30, establishing race pacing and fueling strategy',
            'Half marathon training — 40 mpw, tempo runs, long run progression',
            'Marathon-specific block — 50+ mpw, MP workouts, nutrition dialed in',
            'Goal: Boston qualifying time at Chicago Marathon',
          ],
        ),
      },
      {
        name: 'Andre Williams',
        role: 'Home Gym — Powerlifting',
        timeline: steps(
          ['Starting Strength', 'Intermediate Program', 'Meet Prep', 'First Meet', 'Advanced Programming'],
          2,
          [
            'Starting Strength linear progression — squat, bench, deadlift 3x/week',
            'Intermediate programming — Texas Method, weekly periodization, accessory work',
            'Meet preparation — peaking cycle, attempt selection, competition commands',
            'First USAPL sanctioned meet — 3 lifts, weight class debut',
            'Advanced programming — conjugate and block periodization, coaching others',
          ],
        ),
      },
      {
        name: 'Sofia Reyes',
        role: 'Yoga & Mobility — Wellness Coach',
        timeline: steps(
          ['Personal Practice', 'Teacher Training', 'Specialty Certs', 'Studio Launch', 'Online Programs'],
          3,
          [
            'Consistent daily yoga practice — Vinyasa and Yin, 2 years of dedicated study',
            '200-hour RYT teacher training — anatomy, sequencing, philosophy, teaching practicum',
            'Specialty certifications — prenatal yoga, trauma-sensitive yoga, mobility coaching',
            'Launching small studio — class programming, community building, workshops',
            'Goal: online mobility programs for desk workers and athletes',
          ],
        ),
      },
      {
        name: 'Priya Sharma',
        role: 'Holistic Wellness — Nutrition & Meditation',
        timeline: steps(
          ['Food Journal', 'Elimination Diet', 'Meditation Practice', 'Ayurvedic Study', 'Wellness Coaching'],
          3,
          [
            'Tracking food intake, energy levels, and mood patterns for 30 days',
            'Identifying food sensitivities — systematic elimination and reintroduction protocol',
            'Daily meditation practice — 20 minutes Vipassana, journaling insights',
            'Studying Ayurvedic nutrition principles — seasonal eating, dosha-based meal plans',
            'Goal: guiding others through holistic food and mindfulness wellness',
          ],
        ),
      },
    ],
  },
  // ── Knitting ────────────────────────────────────────────────────────
  {
    slug: 'knitting',
    name: 'Knitting',
    color: '#E91E63',
    icon: 'cut',
    organizations: [
      {
        slug: 'hk-knitting-guild',
        name: 'Hong Kong Knitting Guild',
        groupLabel: 'Circles',
        groups: [
          {
            name: 'Beginner Circle',
            people: [
              {
                name: 'Mei-Lin Chan',
                role: 'Workshop Leader',
                timeline: steps(
                  ['Cast On', 'Knit Stitch', 'Purl Stitch', 'Ribbing', 'Binding Off', 'First Project'],
                  5, KNITTING_BEGINNER_DETAILS,
                ),
              },
              {
                name: 'Jenny Wu',
                role: 'Knitter',
                timeline: steps(
                  ['Cast On', 'Knit Stitch', 'Purl Stitch', 'Ribbing', 'Binding Off', 'First Project'],
                  2, KNITTING_BEGINNER_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Advanced Techniques',
            people: [
              {
                name: 'Siu-Wai Leung',
                role: 'Instructor',
                timeline: steps(
                  ['Stranded Knitting', 'Fair Isle Charts', 'Tension', 'Steeks', 'Blocking'],
                  4, KNITTING_COLORWORK_DETAILS,
                ),
              },
              {
                name: 'Rachel Tam',
                role: 'Knitter',
                timeline: steps(
                  ['Stranded Knitting', 'Fair Isle Charts', 'Tension', 'Steeks', 'Blocking'],
                  2, KNITTING_COLORWORK_DETAILS,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'uk-knitters-guild',
        name: 'The Knitters Guild (UK)',
        groupLabel: 'Chapters',
        groups: [
          {
            name: 'London Chapter',
            people: [
              {
                name: 'Emma Hartley',
                role: 'Chapter Lead',
                timeline: steps(['Beginner Knitting', 'Socks', 'Colorwork', 'Lace', 'Garment Construction'], 4),
              },
              {
                name: 'Fatima Osei',
                role: 'Knitter',
                timeline: steps(['Beginner Knitting', 'Socks', 'Colorwork', 'Lace', 'Garment Construction'], 2),
              },
            ],
          },
          {
            name: 'Scottish Chapter',
            people: [
              {
                name: 'Isla MacGregor',
                role: 'Chapter Lead',
                timeline: steps(['Fair Isle Basics', 'Traditional Patterns', 'Steeks', 'Garment Design', 'Exhibition'], 3),
              },
            ],
          },
        ],
      },
      {
        slug: 'tkga',
        name: 'The Knitting Guild Association',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Master Knitter Program',
            people: [
              {
                name: 'Carol Sullivan',
                role: 'Program Director',
                timeline: steps(['Level 1 Basics', 'Level 2 Intermediate', 'Level 3 Advanced', 'Master Portfolio'], 3),
              },
              {
                name: 'Linda Park',
                role: 'Candidate',
                timeline: steps(['Level 1 Basics', 'Level 2 Intermediate', 'Level 3 Advanced', 'Master Portfolio'], 1),
              },
            ],
          },
          {
            name: 'Correspondence Course',
            people: [
              {
                name: 'Diane Mitchell',
                role: 'Instructor',
                timeline: steps(['Enrollment', 'Swatching', 'Technique Samples', 'Project Work', 'Assessment'], 4),
              },
            ],
          },
        ],
      },
      // ── Material makers / suppliers ──
      {
        slug: 'drops-design',
        name: 'DROPS Design',
        groupLabel: 'Collections',
        groups: [
          {
            name: 'Yarn Collections',
            people: [
              {
                name: 'DROPS Design Team',
                role: 'Pattern & Yarn Design',
                timeline: steps(['Cotton Collection', 'Wool Blends', 'Alpaca Range', 'Free Patterns', 'Video Tutorials'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'lion-brand',
        name: 'Lion Brand Yarn',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Studio Workshops',
            people: [
              {
                name: 'Shira Blumenthal',
                role: 'Studio Director',
                timeline: steps(['Beginner Workshop', 'Color Workshop', 'Garment Workshop', 'Design Lab'], 3),
              },
            ],
          },
        ],
      },
      {
        slug: 'addi-needles',
        name: 'Addi (Germany)',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Circular Needles & Accessories',
            people: [
              {
                name: 'Addi Product Team',
                role: 'Design & Manufacturing',
                timeline: steps(['Turbo Circulars', 'Click System', 'CraSyTrio', 'Accessories', 'Sustainability'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'chiaogoo',
        name: 'ChiaoGoo',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Interchangeable Sets',
            people: [
              {
                name: 'ChiaoGoo Team',
                role: 'Product Development',
                timeline: steps(['Red Lace Circulars', 'TWIST System', 'Bamboo Line', 'Cables & Connectors'], 3),
              },
            ],
          },
        ],
      },
      {
        slug: 'knitpro',
        name: 'KnitPro / KnitPicks',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Wooden & Metal Needles',
            people: [
              {
                name: 'KnitPro Design Team',
                role: 'Product Design',
                timeline: steps(['Symfonie Wood', 'Nova Metal', 'Zing Aluminum', 'Interchangeable Sets'], 3),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'beginner-knitting',
        name: 'Beginner Knitting',
        type: 'course',
        description: 'Foundation knitting — cast on through first completed project, building essential skills.',
        offeredBy: [{ orgSlug: 'hk-knitting-guild', role: 'Guild' }],
        samplePeople: [
          {
            name: 'Jenny Wu',
            role: 'Knitter',
            timeline: steps(
              ['Cast On', 'Knit Stitch', 'Purl Stitch', 'Ribbing', 'Binding Off', 'First Project'],
              2, KNITTING_BEGINNER_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'master-knitter',
        name: 'Master Knitter Program',
        type: 'certification',
        description: 'TKGA Master Knitter certification — three progressive levels culminating in a master portfolio.',
        offeredBy: [{ orgSlug: 'tkga', role: 'Association' }],
        samplePeople: [
          {
            name: 'Linda Park',
            role: 'Candidate',
            timeline: steps(['Level 1 Basics', 'Level 2 Intermediate', 'Level 3 Advanced', 'Master Portfolio'], 1),
          },
        ],
      },
      {
        slug: 'colorwork-intensive',
        name: 'Colorwork Intensive',
        type: 'course',
        description: 'Stranded knitting deep dive — fair isle, intarsia, steeks, and blocking techniques.',
        offeredBy: [{ orgSlug: 'hk-knitting-guild', role: 'Guild' }],
        samplePeople: [
          {
            name: 'Rachel Tam',
            role: 'Knitter',
            timeline: steps(
              ['Stranded Knitting', 'Fair Isle Charts', 'Tension', 'Steeks', 'Blocking'],
              2, KNITTING_COLORWORK_DETAILS,
            ),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'Hannah Kowalski',
        role: 'Sock Knitter — Self-directed Journey',
        timeline: steps(
          ['First Socks', 'Heel Variations', 'Toe-Up Construction', 'Colorwork Socks', 'Own Patterns'],
          3,
          [
            'First pair of socks — cuff-down construction, heel flap and turn',
            'Exploring heel types — short row, afterthought, Fish Lips Kiss heel',
            'Toe-up socks with German short rows and Judy\'s magic cast on',
            'Stranded colorwork socks — managing floats on small circumference',
            'Designing and publishing original sock patterns on Ravelry',
          ],
        ),
      },
      {
        name: 'Eloise Marchetti',
        role: 'Knitwear Designer — Pattern Business',
        timeline: steps(
          ['Technical Skills', 'Grading & Sizing', 'Tech Editing', 'Pattern Publishing', 'Yarn Collaborations'],
          3,
          [
            'Mastering construction techniques — seamless, top-down, modular',
            'Learning grading across size ranges — ease, proportional shaping',
            'Working with tech editors — standardized patterns, clear instructions',
            'Publishing patterns independently on Ravelry and own website',
            'Collaborating with indie dyers and yarn companies for pattern support',
          ],
        ),
      },
    ],
  },
  // ── Fiber Arts ──────────────────────────────────────────────────────
  {
    slug: 'fiber-arts',
    name: 'Fiber Arts',
    color: '#8E24AA',
    icon: 'color-wand',
    organizations: [
      {
        slug: 'hk-textile-society',
        name: 'Hong Kong Textile Society',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Spinning Workshop',
            people: [
              {
                name: 'Amy Cheung',
                role: 'Workshop Leader',
                timeline: steps(
                  ['Fiber Prep', 'Drafting', 'Wheel Mechanics', 'Plying', 'Finishing'],
                  4, SPINNING_FUNDAMENTALS_DETAILS,
                ),
              },
              {
                name: 'Vivian Lo',
                role: 'Fiber Artist',
                timeline: steps(
                  ['Fiber Prep', 'Drafting', 'Wheel Mechanics', 'Plying', 'Finishing'],
                  2, SPINNING_FUNDAMENTALS_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Weaving Studio',
            people: [
              {
                name: 'Margaret Fung',
                role: 'Instructor',
                timeline: steps(
                  ['Warping', 'Threading', 'Treadling', 'Plain Weave', 'Twill', 'Finishing'],
                  5, WEAVING_FLOOR_LOOM_DETAILS,
                ),
              },
              {
                name: 'Sarah Ip',
                role: 'Fiber Artist',
                timeline: steps(
                  ['Warping', 'Threading', 'Treadling', 'Plain Weave', 'Twill', 'Finishing'],
                  3, WEAVING_FLOOR_LOOM_DETAILS,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'agwsd',
        name: 'Association of Guilds of Weavers, Spinners and Dyers (UK)',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Certificate of Achievement — Spinning',
            people: [
              {
                name: 'Helen Bristow',
                role: 'Examiner',
                timeline: steps(['Foundation Skills', 'Fiber Knowledge', 'Yarn Design', 'Advanced Techniques', 'Portfolio Assessment'], 4),
              },
              {
                name: 'Niamh O\'Sullivan',
                role: 'Candidate',
                timeline: steps(['Foundation Skills', 'Fiber Knowledge', 'Yarn Design', 'Advanced Techniques', 'Portfolio Assessment'], 2),
              },
            ],
          },
        ],
      },
      {
        slug: 'haslach',
        name: 'Textile Zentrum Haslach',
        groupLabel: 'Workshops',
        groups: [
          {
            name: 'Summer Textile Symposium',
            people: [
              {
                name: 'Michaela Eder',
                role: 'Director',
                timeline: steps(['Weaving Intensive', 'Natural Dyeing', 'Feltmaking', 'Tapestry', 'Exhibition'], 4),
              },
              {
                name: 'Lukas Berger',
                role: 'Participant',
                timeline: steps(['Weaving Intensive', 'Natural Dyeing', 'Feltmaking', 'Tapestry', 'Exhibition'], 2),
              },
            ],
          },
        ],
      },
      {
        slug: 'hga',
        name: 'Handweavers Guild of America',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Certificate of Excellence — Weaving',
            people: [
              {
                name: 'Patricia Williams',
                role: 'Program Chair',
                timeline: steps(['Technical Skills', 'Design Development', 'Documentation', 'Exhibition Piece', 'Peer Review'], 4),
              },
              {
                name: 'Rebecca Torres',
                role: 'Candidate',
                timeline: steps(['Technical Skills', 'Design Development', 'Documentation', 'Exhibition Piece', 'Peer Review'], 2),
              },
            ],
          },
        ],
      },
      {
        slug: 'penland',
        name: 'Penland School of Craft',
        groupLabel: 'Studios',
        groups: [
          {
            name: 'Fiber Studio',
            people: [
              {
                name: 'Stacey Lane',
                role: 'Studio Coordinator',
                timeline: steps(['One-Week Workshop', 'Two-Week Intensive', 'Work-Study', 'Resident Artist', 'Teaching'], 4),
              },
              {
                name: 'Marcus Green',
                role: 'Resident Artist',
                timeline: steps(['One-Week Workshop', 'Two-Week Intensive', 'Work-Study', 'Resident Artist', 'Teaching'], 3),
              },
            ],
          },
        ],
      },
      // ── Equipment makers ──
      {
        slug: 'ashford-wheels',
        name: 'Ashford (New Zealand)',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Spinning Wheels & Looms',
            people: [
              {
                name: 'Ashford Design Team',
                role: 'Product Development',
                timeline: steps(['Traditional Wheels', 'Folding Wheels', 'Rigid Heddle Looms', 'Floor Looms', 'Accessories'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'schacht-looms',
        name: 'Schacht Spindle Company',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Looms & Spinning Equipment',
            people: [
              {
                name: 'Schacht Team',
                role: 'Design & Manufacturing',
                timeline: steps(['Rigid Heddle Looms', 'Floor Looms', 'Spindles', 'Accessories', 'Education'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'louet',
        name: 'Louet (Netherlands)',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Wheels & Looms',
            people: [
              {
                name: 'Louet Design Team',
                role: 'Product Development',
                timeline: steps(['Spinning Wheels', 'Table Looms', 'Floor Looms', 'Fibers & Yarns'], 3),
              },
            ],
          },
        ],
      },
      {
        slug: 'kromski',
        name: 'Kromski (Poland)',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Traditional Spinning Wheels',
            people: [
              {
                name: 'Kromski Artisans',
                role: 'Craftspeople',
                timeline: steps(['Castle Wheels', 'Saxony Wheels', 'Folding Wheels', 'Accessories'], 3),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'spinning-fundamentals',
        name: 'Spinning Fundamentals',
        type: 'course',
        description: 'Foundation spinning — fiber prep through finishing yarn, building consistency and understanding fiber behavior.',
        offeredBy: [{ orgSlug: 'hk-textile-society', role: 'Society' }],
        samplePeople: [
          {
            name: 'Vivian Lo',
            role: 'Fiber Artist',
            timeline: steps(
              ['Fiber Prep', 'Drafting', 'Wheel Mechanics', 'Plying', 'Finishing'],
              2, SPINNING_FUNDAMENTALS_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'floor-loom-weaving',
        name: 'Floor Loom Weaving',
        type: 'course',
        description: 'Comprehensive loom weaving — warping through finishing, covering plain weave to twill structures.',
        offeredBy: [{ orgSlug: 'hk-textile-society', role: 'Society' }],
        samplePeople: [
          {
            name: 'Sarah Ip',
            role: 'Fiber Artist',
            timeline: steps(
              ['Warping', 'Threading', 'Treadling', 'Plain Weave', 'Twill', 'Finishing'],
              3, WEAVING_FLOOR_LOOM_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'certificate-of-excellence-weaving',
        name: 'Certificate of Excellence — Weaving',
        type: 'certification',
        description: 'HGA Certificate of Excellence — rigorous peer-reviewed program demonstrating mastery of weaving.',
        offeredBy: [{ orgSlug: 'hga', role: 'Guild' }],
        samplePeople: [
          {
            name: 'Rebecca Torres',
            role: 'Candidate',
            timeline: steps(['Technical Skills', 'Design Development', 'Documentation', 'Exhibition Piece', 'Peer Review'], 2),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'Fiona Stewart',
        role: 'Art Yarn Spinner — Creative Fiber',
        timeline: steps(
          ['Basic Spinning', 'Core Spun', 'Coils & Beehives', 'Art Yarn Design', 'Selling & Teaching'],
          3,
          [
            'Learning to spin consistent singles on a drop spindle and wheel',
            'Core spinning techniques — wrapping fibers around a core thread',
            'Textured yarn techniques — coils, beehives, lockspun, thick-and-thin',
            'Designing intentional art yarns — color planning, fiber blending',
            'Selling art yarns at fiber festivals and teaching workshops',
          ],
        ),
      },
      {
        name: 'Keiko Tanaka',
        role: 'Natural Dyer — Botanical Colors',
        timeline: steps(
          ['Basic Mordanting', 'Local Plants', 'Indigo Vat', 'Color Consistency', 'Eco Print'],
          3,
          [
            'Mordanting protein and cellulose fibers — alum, iron, tannin',
            'Extracting color from local plants — onion skins, marigold, avocado',
            'Building and maintaining an indigo vat — fermentation, dipping, oxidation',
            'Achieving color consistency — record keeping, water quality, pH management',
            'Eco printing on silk and paper — leaf contact printing, bundle dyeing',
          ],
        ),
      },
    ],
  },
  // ── Painting & Printing ─────────────────────────────────────────────
  {
    slug: 'painting-printing',
    name: 'Painting & Printing',
    color: '#FF6F00',
    icon: 'color-palette',
    organizations: [
      {
        slug: 'hk-print-studio',
        name: 'Hong Kong Print Studio',
        groupLabel: 'Workshops',
        groups: [
          {
            name: 'Printmaking Workshop',
            people: [
              {
                name: 'David Leung',
                role: 'Studio Director',
                timeline: steps(
                  ['Relief Printing', 'Intaglio', 'Registration', 'Editioning', 'Proofing', 'Exhibition'],
                  5, PRINTMAKING_DETAILS,
                ),
              },
              {
                name: 'Wing-Sze Ho',
                role: 'Artist',
                timeline: steps(
                  ['Relief Printing', 'Intaglio', 'Registration', 'Editioning', 'Proofing', 'Exhibition'],
                  3, PRINTMAKING_DETAILS,
                ),
              },
              {
                name: 'Kevin Yau',
                role: 'Printmaking Instructor',
                timeline: steps(
                  ['Relief Printing', 'Intaglio', 'Registration', 'Editioning', 'Proofing', 'Exhibition'],
                  5, PRINTMAKING_DETAILS,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'royal-academy',
        name: 'Royal Academy Schools (UK)',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Postgraduate Programme',
            people: [
              {
                name: 'Prof. Eileen Cooper',
                role: 'Keeper of the RA',
                timeline: steps(['Foundation', 'Studio Practice', 'Critical Studies', 'Exhibition', 'Graduation Show'], 4),
              },
              {
                name: 'James Whitfield',
                role: 'Watercolor Teacher',
                timeline: steps(['Wet-on-Wet', 'Glazing', 'Dry Brush', 'Plein Air', 'Exhibition Prep'], 4),
              },
              {
                name: 'Charlotte Moore',
                role: 'Student',
                timeline: steps(['Foundation', 'Studio Practice', 'Critical Studies', 'Exhibition', 'Graduation Show'], 2),
              },
            ],
          },
        ],
      },
      {
        slug: 'edinburgh-printmakers',
        name: 'Edinburgh Printmakers',
        groupLabel: 'Studios',
        groups: [
          {
            name: 'Open Access Studios',
            people: [
              {
                name: 'Alistair MacKenzie',
                role: 'Printmaking Instructor',
                timeline: steps(['Relief', 'Intaglio', 'Lithography', 'Screen Print', 'Artist Editions'], 4),
              },
              {
                name: 'Moira Campbell',
                role: 'Member Artist',
                timeline: steps(['Relief', 'Intaglio', 'Lithography', 'Screen Print', 'Artist Editions'], 3),
              },
            ],
          },
        ],
      },
      {
        slug: 'tamarind-institute',
        name: 'Tamarind Institute',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Master Printer Program',
            people: [
              {
                name: 'Valpuri Remling',
                role: 'Director',
                timeline: steps(['Lithography Foundations', 'Stone & Plate', 'Color Lithography', 'Artist Collaboration', 'Master Printer Certification'], 4),
              },
              {
                name: 'Alex Rivera',
                role: 'Apprentice Printer',
                timeline: steps(['Lithography Foundations', 'Stone & Plate', 'Color Lithography', 'Artist Collaboration', 'Master Printer Certification'], 2),
              },
            ],
          },
        ],
      },
      {
        slug: 'anderson-ranch',
        name: 'Anderson Ranch Arts Center',
        groupLabel: 'Workshops',
        groups: [
          {
            name: 'Painting & Drawing',
            people: [
              {
                name: 'Michael Chen',
                role: 'Plein Air Instructor',
                timeline: steps(
                  ['Color Theory', 'Underpainting', 'Glazing', 'Alla Prima', 'Composition', 'Plein Air'],
                  5, OIL_PAINTING_DETAILS,
                ),
              },
              {
                name: 'Sofia Hernandez',
                role: 'Workshop Participant',
                timeline: steps(
                  ['Color Theory', 'Underpainting', 'Glazing', 'Alla Prima', 'Composition', 'Plein Air'],
                  3, OIL_PAINTING_DETAILS,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'crown-point-press',
        name: 'Crown Point Press',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Artist Residency',
            people: [
              {
                name: 'Valerie Wade',
                role: 'Master Printer',
                timeline: steps(['Consultation', 'Proofing', 'Editioning', 'Artist Approval', 'Publication'], 4),
              },
            ],
          },
        ],
      },
      // ── Material makers / suppliers ──
      {
        slug: 'winsor-newton',
        name: 'Winsor & Newton (UK)',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Paints & Brushes',
            people: [
              {
                name: 'W&N Product Team',
                role: 'Color Chemistry',
                timeline: steps(['Professional Watercolor', 'Oil Colour', 'Acrylic', 'Brushes', 'Mediums'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'gamblin-colors',
        name: 'Gamblin (Portland, OR)',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Oil Colors & Mediums',
            people: [
              {
                name: 'Robert Gamblin',
                role: 'Founder & Color Maker',
                timeline: steps(['Artist Oil Colors', 'Solvent-Free Mediums', 'Conservation Colors', 'FastMatte', 'Portland Greys'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'speedball',
        name: 'Speedball Art Products',
        groupLabel: 'Products',
        groups: [
          {
            name: 'Printmaking Supplies',
            people: [
              {
                name: 'Speedball Team',
                role: 'Product Development',
                timeline: steps(['Block Printing Ink', 'Carving Tools', 'Brayers', 'Screen Print Supplies', 'Presses'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'blick-art',
        name: 'Blick Art Materials',
        groupLabel: 'Departments',
        groups: [
          {
            name: 'Painting & Printmaking',
            people: [
              {
                name: 'Blick Education Team',
                role: 'Art Education',
                timeline: steps(['Oil Painting Kits', 'Watercolor Sets', 'Printmaking Starter', 'Plein Air Gear', 'Studio Essentials'], 4),
              },
            ],
          },
        ],
      },
      {
        slug: 'jacksons-art',
        name: "Jackson's Art Supplies (UK)",
        groupLabel: 'Departments',
        groups: [
          {
            name: 'Fine Art Materials',
            people: [
              {
                name: "Jackson's Specialist Team",
                role: 'Product Curation',
                timeline: steps(['Own-Brand Oils', 'Watercolors', 'Printmaking', 'Surfaces', 'Brushes'], 4),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'printmaking-fundamentals',
        name: 'Printmaking Fundamentals',
        type: 'course',
        description: 'Foundation printmaking — relief through intaglio, registration, editioning, and exhibition preparation.',
        offeredBy: [{ orgSlug: 'hk-print-studio', role: 'Studio' }, { orgSlug: 'edinburgh-printmakers', role: 'Studio' }],
        samplePeople: [
          {
            name: 'Wing-Sze Ho',
            role: 'Artist',
            timeline: steps(
              ['Relief Printing', 'Intaglio', 'Registration', 'Editioning', 'Proofing', 'Exhibition'],
              3, PRINTMAKING_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'oil-painting-intensive',
        name: 'Oil Painting Intensive',
        type: 'course',
        description: 'Comprehensive oil painting — color theory through plein air, covering alla prima and layered techniques.',
        offeredBy: [{ orgSlug: 'anderson-ranch', role: 'Arts Center' }],
        samplePeople: [
          {
            name: 'Sofia Hernandez',
            role: 'Workshop Participant',
            timeline: steps(
              ['Color Theory', 'Underpainting', 'Glazing', 'Alla Prima', 'Composition', 'Plein Air'],
              3, OIL_PAINTING_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'master-printer-certificate',
        name: 'Master Printer Certificate',
        type: 'certification',
        description: 'Tamarind Institute master printer program — lithography mastery through artist collaboration and certification.',
        offeredBy: [{ orgSlug: 'tamarind-institute', role: 'Institute' }],
        samplePeople: [
          {
            name: 'Alex Rivera',
            role: 'Apprentice Printer',
            timeline: steps(['Lithography Foundations', 'Stone & Plate', 'Color Lithography', 'Artist Collaboration', 'Master Printer Certification'], 2),
          },
        ],
      },
    ],
    independentPractitioners: [
      {
        name: 'Robert Townsend',
        role: 'Plein Air Painter — Oils & Watercolor',
        timeline: steps(
          ['Studio Fundamentals', 'Pochade Box Setup', 'Local Plein Air', 'Paint-Outs & Events', 'Gallery Representation'],
          3,
          [
            'Studio color mixing, value studies, and composition exercises',
            'Building a portable plein air kit — pochade box, limited palette, panels',
            'Regular plein air sessions at local parks and coastal scenes',
            'Participating in plein air paint-out events and competitions',
            'Goal: gallery representation and juried plein air exhibition',
          ],
        ),
      },
      {
        name: 'Nadia Petrova',
        role: 'Linocut Printmaker — Edition-based Practice',
        timeline: steps(
          ['Basic Carving', 'Reduction Prints', 'Multi-Block Color', 'Artist Editions', 'Exhibition'],
          3,
          [
            'Learning linocut carving tools, simple single-color prints',
            'Reduction printing technique — progressive carving and overprinting',
            'Multi-block color registration for complex compositions',
            'Producing numbered artist editions — consistent quality, documentation',
            'Solo exhibition of edition prints at community gallery',
          ],
        ),
      },
    ],
  },
  // ── Lifelong Learning ───────────────────────────────────────────────
  {
    slug: 'lifelong-learning',
    name: 'Lifelong Learning',
    color: '#5C6BC0',
    icon: 'school',
    organizations: [
      {
        slug: 'hollyhock',
        name: 'Hollyhock',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Wisdom Teachings',
            people: [
              {
                name: 'Dana Roshi',
                role: 'Zen Teacher',
                timeline: steps(
                  ['Arrival & Settling', 'Morning Sits', 'Body Scan', 'Council', 'Integration', 'Closing Circle'],
                  4, MINDFULNESS_RETREAT_DETAILS,
                ),
              },
              {
                name: 'Amara Singh',
                role: 'Learner',
                timeline: steps(
                  ['Arrival & Settling', 'Morning Sits', 'Body Scan', 'Council', 'Integration', 'Closing Circle'],
                  2, MINDFULNESS_RETREAT_DETAILS,
                ),
                personalInterests: [
                  {
                    interestSlug: 'regenerative-agriculture',
                    role: 'Community Gardener',
                    timeline: steps(['Soil Basics', 'Composting', 'Growing Herbs', 'Harvest'], 2),
                  },
                ],
              },
            ],
          },
          {
            name: 'Creative Expressions',
            people: [
              {
                name: 'Liora Chen',
                role: 'Writing Facilitator',
                timeline: steps(
                  ['Sensory Walks', 'Free Writing', 'Nature Journal', 'Memoir', 'Workshop Circle'],
                  4, CREATIVE_WRITING_NATURE_DETAILS,
                ),
              },
              {
                name: 'Fern Gallagher',
                role: 'Learner',
                timeline: steps(
                  ['Sensory Walks', 'Free Writing', 'Nature Journal', 'Memoir', 'Workshop Circle'],
                  2, CREATIVE_WRITING_NATURE_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Health & Healing',
            people: [
              {
                name: 'Tara Meadows',
                role: 'Yoga Instructor',
                timeline: steps(['Hatha Foundations', 'Pranayama', 'Restorative Yoga', 'Yoga Nidra', 'Teaching Practice'], 4),
              },
              {
                name: 'Marcus Hale',
                role: 'Learner',
                timeline: steps(['Hatha Foundations', 'Pranayama', 'Restorative Yoga', 'Yoga Nidra', 'Teaching Practice'], 1),
              },
            ],
          },
          {
            name: 'Social Innovation',
            people: [
              {
                name: 'Kai Nakamura',
                role: 'Facilitation Lead',
                timeline: steps(['Systems Thinking', 'Design Thinking', 'Council Practice', 'Prototyping', 'Community Action'], 3),
              },
            ],
          },
        ],
        cohorts: [
          {
            name: 'Farm, Food & Contemplation — July 2026',
            isShared: true,
            partnerInterests: [{ interestSlug: 'regenerative-agriculture', orgSlug: 'the-open-field', orgName: 'The Open Field' }],
            people: [
              {
                name: 'Amara Singh',
                role: 'Learner',
                timeline: steps(
                  ['Arrival & Intentions', 'Farm & Soil Workshop', 'Tribal Cuisine', 'Morning Practice', 'Nature Immersion', 'Integration Circle'],
                  3,
                ),
                personalInterests: [
                  {
                    interestSlug: 'regenerative-agriculture',
                    role: 'Community Gardener',
                    timeline: steps(['Soil Basics', 'Composting', 'Growing Herbs', 'Harvest'], 2),
                  },
                ],
              },
              {
                name: 'Arjun Oraon',
                role: 'Grower & Guest Teacher',
                timeline: steps(
                  ['Arrival & Intentions', 'Farm & Soil Workshop', 'Tribal Cuisine', 'Morning Practice', 'Nature Immersion', 'Integration Circle'],
                  2,
                ),
                personalInterests: [
                  {
                    interestSlug: 'lifelong-learning',
                    role: 'Meditation Practitioner',
                    timeline: steps(['Mindfulness Basics', 'Daily Practice', 'Retreat Experience'], 1),
                  },
                ],
              },
              {
                name: 'Fern Gallagher',
                role: 'Learner',
                timeline: steps(
                  ['Arrival & Intentions', 'Farm & Soil Workshop', 'Tribal Cuisine', 'Morning Practice', 'Nature Immersion', 'Integration Circle'],
                  4,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'esalen-institute',
        name: 'Esalen Institute',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Contemplative Practice',
            people: [
              {
                name: 'David Whyte',
                role: 'Poet & Teacher',
                timeline: steps(['Poetry & Presence', 'Conversational Leadership', 'Creative Courage', 'Integration'], 3),
              },
              {
                name: 'Mira Desai',
                role: 'Resident',
                timeline: steps(['Gestalt Practice', 'Somatic Experiencing', 'Meditation', 'Integration'], 2),
              },
            ],
          },
        ],
      },
      {
        slug: 'kripalu-center',
        name: 'Kripalu Center',
        groupLabel: 'Schools',
        groups: [
          {
            name: 'Kripalu School of Yoga',
            people: [
              {
                name: 'Anjali Rao',
                role: 'Lead Trainer',
                timeline: steps(['200-Hour YTT', 'Advanced Training', 'Specialization', 'Mentorship'], 3),
              },
              {
                name: 'Sam Woodward',
                role: 'Trainee',
                timeline: steps(['200-Hour YTT', 'Advanced Training', 'Specialization', 'Mentorship'], 1),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'mindfulness-retreat-intensive',
        name: 'Mindfulness Retreat Intensive',
        type: 'course',
        description: 'Multi-day silent retreat — vipassana, walking meditation, council practice, and nature connection on Cortes Island.',
        offeredBy: [{ orgSlug: 'hollyhock', role: 'Center' }],
        samplePeople: [
          {
            name: 'Amara Singh',
            role: 'Learner',
            timeline: steps(
              ['Arrival & Settling', 'Morning Sits', 'Body Scan', 'Council', 'Integration', 'Closing Circle'],
              2, MINDFULNESS_RETREAT_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'creative-writing-nature',
        name: 'Creative Writing & Nature',
        type: 'course',
        description: 'Writing retreat combining nature walks, free writing, memoir, and peer workshop on the island.',
        offeredBy: [{ orgSlug: 'hollyhock', role: 'Center' }],
        samplePeople: [
          {
            name: 'Fern Gallagher',
            role: 'Learner',
            timeline: steps(
              ['Sensory Walks', 'Free Writing', 'Nature Journal', 'Memoir', 'Workshop Circle'],
              2, CREATIVE_WRITING_NATURE_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'farm-food-contemplation',
        name: 'Farm, Food & Contemplation',
        type: 'retreat',
        description: 'A 5-day retreat bridging regenerative agriculture and contemplative practice — farm immersion, tribal cuisine, morning practice, and integration circles on Cortes Island.',
        offeredBy: [{ orgSlug: 'hollyhock', role: 'Host Center' }],
        coHostedWith: [{ interestSlug: 'regenerative-agriculture', orgSlug: 'the-open-field', role: 'Farm Partner' }],
        samplePeople: [
          {
            name: 'Amara Singh',
            role: 'Learner',
            timeline: steps(
              ['Arrival & Intentions', 'Farm & Soil Workshop', 'Tribal Cuisine', 'Morning Practice', 'Nature Immersion', 'Integration Circle'],
              3,
              [
                'Settling into the retreat center, intention-setting circle, meeting the farm partner team',
                'Hands-on soil health workshop led by The Open Field growers — composting, soil biology, cover crops',
                'Cooking traditional tribal cuisine with Savitri Devi — indigenous ingredients, wood-fire methods',
                'Silent morning meditation, yoga, and walking practice in the forest',
                'Guided nature immersion combining contemplative awareness with ecological observation',
                'Final integration circle — harvesting insights, setting commitments for home practice',
              ],
            ),
            personalInterests: [
              {
                interestSlug: 'regenerative-agriculture',
                role: 'Community Gardener',
                timeline: steps(['Soil Basics', 'Composting', 'Growing Herbs', 'Harvest'], 2),
              },
            ],
          },
          {
            name: 'Arjun Oraon',
            role: 'Grower & Guest Teacher',
            timeline: steps(
              ['Arrival & Intentions', 'Farm & Soil Workshop', 'Tribal Cuisine', 'Morning Practice', 'Nature Immersion', 'Integration Circle'],
              2,
              [
                'Meeting the Hollyhock community, sharing farming journey and intentions',
                'Leading the soil health workshop — demonstrating composting and cover-crop techniques',
                'Assisting with tribal cuisine — sharing knowledge of indigenous ingredients and farming practices',
                'Experiencing silent morning practice for the first time — guided meditation and walking',
                'Co-leading nature immersion from a grower\'s perspective — reading the land, seasonal rhythms',
                'Sharing reflections on what contemplative practice adds to farming, exchanging practices',
              ],
            ),
            personalInterests: [
              {
                interestSlug: 'lifelong-learning',
                role: 'Meditation Practitioner',
                timeline: steps(['Mindfulness Basics', 'Daily Practice', 'Retreat Experience'], 1),
              },
            ],
          },
        ],
      },
    ],
    affiliations: [
      { name: 'BC Retreat Centers', orgSlugs: ['hollyhock'] },
      { name: 'North American Retreat Network', orgSlugs: ['hollyhock', 'esalen-institute', 'kripalu-center'] },
    ],
    independentPractitioners: [
      {
        name: 'Elena Vasquez',
        role: 'Meditation Teacher — Daily Practice',
        timeline: steps(
          ['Personal Practice', 'Teacher Training', 'Leading Groups', 'Retreat Facilitation', 'Mentoring Teachers'],
          3,
          [
            'Establishing a daily vipassana and loving-kindness practice',
            'Completing 200-hour meditation teacher training at Spirit Rock',
            'Leading weekly community meditation groups',
            'Facilitating weekend and week-long silent retreats',
            'Mentoring new meditation teachers in the lineage',
          ],
        ),
        personalInterests: [
          {
            interestSlug: 'regenerative-agriculture',
            role: 'Kitchen Gardener',
            timeline: steps(['Herb Garden', 'Raised Beds', 'Composting', 'Seasonal Harvest'], 2),
          },
        ],
      },
      {
        name: 'Rowan Birch',
        role: 'Contemplative Arts — Writing & Movement',
        timeline: steps(
          ['Journaling Practice', 'Authentic Movement', 'InterPlay', 'Teaching Workshops', 'Book Project'],
          2,
          [
            'Daily journaling and morning pages practice',
            'Exploring authentic movement and embodied expression',
            'InterPlay training — improvisational movement and storytelling',
            'Teaching contemplative arts workshops at retreat centers',
            'Writing a book on the intersection of movement and creativity',
          ],
        ),
      },
    ],
  },
  // ── Regenerative Agriculture ────────────────────────────────────────
  {
    slug: 'regenerative-agriculture',
    name: 'Regenerative Agriculture',
    color: '#2E7D32',
    icon: 'leaf',
    organizations: [
      {
        slug: 'the-open-field',
        name: 'The Open Field',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Farm Operations',
            people: [
              {
                name: 'Priya Munda',
                role: 'Head Grower',
                timeline: steps(
                  ['Soil Prep', 'Seed Starting', 'Transplanting', 'Pest Management', 'Harvest', 'Records'],
                  5, ORGANIC_FARMING_DETAILS,
                ),
              },
              {
                name: 'Arjun Oraon',
                role: 'Grower',
                timeline: steps(
                  ['Soil Prep', 'Seed Starting', 'Transplanting', 'Pest Management', 'Harvest', 'Records'],
                  3, ORGANIC_FARMING_DETAILS,
                ),
                personalInterests: [
                  {
                    interestSlug: 'lifelong-learning',
                    role: 'Meditation Practitioner',
                    timeline: steps(['Mindfulness Basics', 'Daily Practice', 'Retreat Experience'], 1),
                  },
                ],
              },
            ],
          },
          {
            name: 'Tribal Cuisine',
            people: [
              {
                name: 'Savitri Devi',
                role: 'Head Chef',
                timeline: steps(
                  ['Tribal Ingredients', 'Traditional Methods', 'Seasonal Menus', 'Hands-on Cooking', 'Plating'],
                  4, TRIBAL_CUISINE_DETAILS,
                ),
              },
              {
                name: 'Lakshmi Tirkey',
                role: 'Apprentice Chef',
                timeline: steps(
                  ['Tribal Ingredients', 'Traditional Methods', 'Seasonal Menus', 'Hands-on Cooking', 'Plating'],
                  2, TRIBAL_CUISINE_DETAILS,
                ),
              },
            ],
          },
          {
            name: 'Workshops & Education',
            people: [
              {
                name: 'Rajesh Kumar',
                role: 'Workshop Coordinator',
                timeline: steps(['Rainwater Harvesting', 'Organic Certification', 'Nursery Management', 'Seed Saving', 'Permaculture'], 3),
              },
            ],
          },
          {
            name: 'Farmers Market',
            people: [
              {
                name: 'Anita Bhagat',
                role: 'Market Manager',
                timeline: steps(['Setup & Planning', 'Vendor Relations', 'Customer Engagement', 'Sales Tracking', 'Community Events'], 4),
              },
            ],
          },
        ],
        cohorts: [
          {
            name: 'Farm, Food & Contemplation — July 2026',
            isShared: true,
            partnerInterests: [{ interestSlug: 'lifelong-learning', orgSlug: 'hollyhock', orgName: 'Hollyhock' }],
            people: [
              {
                name: 'Arjun Oraon',
                role: 'Grower & Guest Teacher',
                timeline: steps(
                  ['Soil Assessment', 'Planting Demo', 'Cooking: Tribal Cuisine', 'Foraging Walk', 'Market Planning', 'Harvest Reflection'],
                  3,
                ),
                personalInterests: [
                  {
                    interestSlug: 'lifelong-learning',
                    role: 'Meditation Practitioner',
                    timeline: steps(['Mindfulness Basics', 'Daily Practice', 'Retreat Experience'], 1),
                  },
                ],
              },
              {
                name: 'Amara Singh',
                role: 'Learner',
                timeline: steps(
                  ['Soil Assessment', 'Planting Demo', 'Cooking: Tribal Cuisine', 'Foraging Walk', 'Market Planning', 'Harvest Reflection'],
                  2,
                ),
                personalInterests: [
                  {
                    interestSlug: 'regenerative-agriculture',
                    role: 'Community Gardener',
                    timeline: steps(['Soil Basics', 'Composting', 'Growing Herbs', 'Harvest'], 2),
                  },
                ],
              },
              {
                name: 'Priya Munda',
                role: 'Head Grower',
                timeline: steps(
                  ['Soil Assessment', 'Planting Demo', 'Cooking: Tribal Cuisine', 'Foraging Walk', 'Market Planning', 'Harvest Reflection'],
                  5,
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'navdanya',
        name: 'Navdanya',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Seed Saving & Biodiversity',
            people: [
              {
                name: 'Dr. Vandana Shiva',
                role: 'Founder & Director',
                timeline: steps(['Seed Freedom', 'Biodiversity Conservation', 'Earth Democracy', 'Global Advocacy'], 3),
              },
              {
                name: 'Meena Rawat',
                role: 'Seed Keeper',
                timeline: steps(['Seed Collection', 'Storage & Cataloguing', 'Community Distribution', 'Training Farmers'], 2),
              },
            ],
          },
        ],
      },
      {
        slug: 'daylesford-farm',
        name: 'Daylesford',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Organic Farm & Cookery School',
            people: [
              {
                name: 'Carole Bamford',
                role: 'Founder',
                timeline: steps(['Organic Conversion', 'Farm Shop', 'Cookery School', 'Sustainability Standards'], 3),
              },
              {
                name: 'James Henderson',
                role: 'Head Farmer',
                timeline: steps(['Crop Rotation', 'Livestock Integration', 'Soil Building', 'Market Garden'], 3),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'organic-farming-foundations',
        name: 'Organic Farming Foundations',
        type: 'course',
        description: 'Comprehensive organic farming — soil preparation through harvest, including certification documentation.',
        offeredBy: [{ orgSlug: 'the-open-field', role: 'Farm' }],
        samplePeople: [
          {
            name: 'Arjun Oraon',
            role: 'Grower',
            timeline: steps(
              ['Soil Prep', 'Seed Starting', 'Transplanting', 'Pest Management', 'Harvest', 'Records'],
              3, ORGANIC_FARMING_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'tribal-cuisine-intensive',
        name: 'Tribal Cuisine Intensive',
        type: 'course',
        description: 'Traditional tribal cooking — indigenous ingredients, wood-fire methods, fermentation, and farm-to-table dining.',
        offeredBy: [{ orgSlug: 'the-open-field', role: 'Farm' }],
        samplePeople: [
          {
            name: 'Lakshmi Tirkey',
            role: 'Apprentice Chef',
            timeline: steps(
              ['Tribal Ingredients', 'Traditional Methods', 'Seasonal Menus', 'Hands-on Cooking', 'Plating'],
              2, TRIBAL_CUISINE_DETAILS,
            ),
          },
        ],
      },
      {
        slug: 'farm-food-contemplation',
        name: 'Farm, Food & Contemplation',
        type: 'retreat',
        description: 'A 5-day retreat at Hollyhock — soil workshops, tribal cuisine, contemplative practice, and cross-interest collaboration with a BC retreat center.',
        offeredBy: [{ orgSlug: 'the-open-field', role: 'Farm Partner' }],
        coHostedWith: [{ interestSlug: 'lifelong-learning', orgSlug: 'hollyhock', role: 'Host Center' }],
        samplePeople: [
          {
            name: 'Arjun Oraon',
            role: 'Grower & Guest Teacher',
            timeline: steps(
              ['Soil Assessment', 'Planting Demo', 'Cooking: Tribal Cuisine', 'Foraging Walk', 'Market Planning', 'Harvest Reflection'],
              3,
              [
                'Assessing Hollyhock garden soil health — comparing BC coastal soil with Jharkhand red soil',
                'Demonstrating cover-crop and companion planting techniques for the retreat garden',
                'Co-leading tribal cuisine workshop — Jharkhand ingredients, traditional wood-fire methods',
                'Guided foraging walk identifying wild edibles and medicinal plants on Cortes Island',
                'Planning how retreat-center gardens can supply local markets — farm-to-table economics',
                'Season-end reflection circle — what transferred between farm practices and contemplative life',
              ],
            ),
            personalInterests: [
              {
                interestSlug: 'lifelong-learning',
                role: 'Meditation Practitioner',
                timeline: steps(['Mindfulness Basics', 'Daily Practice', 'Retreat Experience'], 1),
              },
            ],
          },
          {
            name: 'Amara Singh',
            role: 'Learner',
            timeline: steps(
              ['Soil Assessment', 'Planting Demo', 'Cooking: Tribal Cuisine', 'Foraging Walk', 'Market Planning', 'Harvest Reflection'],
              2,
              [
                'Learning to assess soil health — texture, color, organism activity',
                'Participating in planting demo — learning companion planting and succession sowing',
                'Hands-on tribal cuisine cooking — learning ingredient sourcing and preparation',
                'Foraging walk with ecological observation — connecting contemplative awareness to plant identification',
                'Understanding farm economics — how mindful consumption connects producer and community',
                'Reflecting on how farm rhythms mirror contemplative practice rhythms',
              ],
            ),
            personalInterests: [
              {
                interestSlug: 'regenerative-agriculture',
                role: 'Community Gardener',
                timeline: steps(['Soil Basics', 'Composting', 'Growing Herbs', 'Harvest'], 2),
              },
            ],
          },
        ],
      },
    ],
    affiliations: [
      { name: 'Jharkhand Agriculture Network', orgSlugs: ['the-open-field'] },
      { name: 'Indian Organic Network', orgSlugs: ['the-open-field', 'navdanya'] },
    ],
    independentPractitioners: [
      {
        name: 'Deepak Mahato',
        role: 'Organic Farmer — Smallholder Journey',
        timeline: steps(
          ['Kitchen Garden', 'Composting', 'Market Garden', 'Organic Certification', 'Farmer Training'],
          3,
          [
            'Starting with a family kitchen garden — vegetables, herbs, traditional varieties',
            'Building compost systems — vermicomposting, leaf mold, cow dung composting',
            'Expanding to market garden scale — seasonal crops, crop rotation',
            'Pursuing organic certification — documentation, soil tests, transition period',
            'Training other smallholder farmers in the village — workshops, farm visits',
          ],
        ),
        personalInterests: [
          {
            interestSlug: 'lifelong-learning',
            role: 'Retreat Participant',
            timeline: steps(['Nature Immersion', 'Contemplative Practice', 'Community Building'], 1),
          },
        ],
      },
      {
        name: 'Sarah Greenfield',
        role: 'Permaculture Designer — Urban Farm',
        timeline: steps(
          ['PDC Certificate', 'Guild Design', 'Water Systems', 'Food Forest', 'Teaching'],
          3,
          [
            'Completing Permaculture Design Certificate — 72 hours, design practicum',
            'Designing plant guilds — companion planting, nitrogen fixers, dynamic accumulators',
            'Installing rainwater harvesting and greywater systems',
            'Establishing a multi-layered food forest — canopy, understory, ground cover',
            'Teaching permaculture workshops at community gardens and schools',
          ],
        ),
      },
    ],
  },
  // ── Global Health ───────────────────────────────────────────────────
  {
    slug: 'global-health',
    name: 'Global Health',
    color: '#00897B',
    icon: 'globe',
    organizations: [
      {
        slug: 'mayan-health-initiative',
        name: 'Mayan Health Initiative',
        groupLabel: 'Programs',
        groups: [
          {
            name: 'Rehabilitation Program',
            people: [
              {
                name: 'Elizabeth Barrios',
                role: 'Director of Physical Therapy',
                timeline: steps(
                  ['Program Design', 'Therapist Recruitment', 'Center Build-Out', 'Training Local Therapists', 'Community Outreach', 'Surgical Care Coordination', 'Program Expansion'],
                  6,
                  [
                    'Designed rehab program for children with disabilities in San Marcos highlands',
                    'Recruited and interviewed candidates from local communities for therapist roles',
                    'Established two rehabilitation centers with donated equipment and supplies',
                    'Trained four local women as physical therapists — hands-on mentorship',
                    'Organized community awareness campaigns about disability services',
                    'Coordinated surgical referrals for children needing orthopedic procedures',
                    'Expanding therapy services to speech and occupational therapy',
                  ],
                ),
              },
              {
                name: 'Ana María López',
                role: 'Physical Therapist',
                timeline: steps(
                  ['PT Training', 'Supervised Practice', 'Independent Caseload', 'Pediatric Specialization', 'Community Home Visits'],
                  3,
                  [
                    'Completed MHI physical therapy training program — anatomy, exercises, assistive devices',
                    'Supervised clinical practice with Elizabeth Barrios — 6 months hands-on',
                    'Managing independent caseload of 20+ pediatric patients',
                    'Specializing in cerebral palsy and developmental delay interventions',
                    'Conducting home visits for patients unable to travel to rehabilitation center',
                  ],
                ),
              },
              {
                name: 'Rosa Velásquez',
                role: 'Physical Therapist',
                timeline: steps(
                  ['PT Training', 'Supervised Practice', 'Independent Caseload', 'Assistive Devices', 'Family Education'],
                  2,
                  [
                    'Completed MHI physical therapy training — focused on pediatric rehabilitation',
                    'Supervised practice under Elizabeth — learning assessment and treatment planning',
                    'Building independent caseload with patient families in remote villages',
                    'Learning to fabricate and fit assistive devices from locally available materials',
                    'Teaching families therapeutic exercises to continue at home between visits',
                  ],
                ),
              },
            ],
          },
          {
            name: 'Nutrition Program',
            people: [
              {
                name: 'Mario Diaz de Paz',
                role: 'Lead, Nutrition Team',
                timeline: steps(
                  ['Community Assessment', 'Screening Protocols', 'Supplement Distribution', 'CHW Training', 'Data Tracking', 'Program Scaling', 'Research Partnerships'],
                  5,
                  [
                    'Conducted baseline community health assessment across Altiplano villages — Mam-speaking',
                    'Developed malnutrition screening protocols using MUAC and weight-for-height z-scores',
                    'Established Nutributter and supplement distribution with support from This Bar Saves Lives',
                    'Trained community health workers (CHWs) in 12 villages on screening and referral',
                    'Implemented data tracking system for 0-5 year olds across all program communities',
                    'Scaling nutrition program from 8 to 15 communities in San Marcos department',
                    'Building research partnerships with UIC for longitudinal nutrition outcomes study',
                  ],
                ),
                personalInterests: [
                  {
                    interestSlug: 'nursing',
                    role: 'Public Health Professional',
                    timeline: steps(
                      ['Nursing Degree', 'Public Health Certification', 'Community Health Leadership', 'Research Methods'],
                      3,
                      [
                        'Registered Nurse degree with focus on community health',
                        'Advanced public health certification — epidemiology and program evaluation',
                        'Leading community health worker networks across San Marcos',
                        'Studying research methods for nutrition outcomes measurement',
                      ],
                    ),
                  },
                ],
              },
              {
                name: 'Lili Hernández',
                role: 'Nutrition Field Worker',
                timeline: steps(
                  ['CHW Training', 'Village Screenings', 'Supplement Distribution', 'Family Counseling', 'Data Collection'],
                  3,
                  [
                    'Community health worker training — nutrition assessment, Mam-language protocols',
                    'Conducting monthly malnutrition screenings in 3 assigned villages',
                    'Distributing Nutributter supplements and tracking inventory',
                    'Providing nutritional counseling to families of malnourished children',
                    'Collecting and reporting screening data for program tracking',
                  ],
                ),
              },
              {
                name: 'Adolfo Pérez',
                role: 'Nutrition Field Worker',
                timeline: steps(
                  ['CHW Training', 'Village Screenings', 'Growth Monitoring', 'Supply Chain', 'Community Education'],
                  2,
                  [
                    'Completed community health worker training with Mario',
                    'Conducting screenings in remote highland villages — reaching underserved families',
                    'Growth monitoring and follow-up for identified malnourished children',
                    'Managing supply chain — supplement inventory and transport logistics',
                    'Leading community education sessions on nutrition and food preparation',
                  ],
                ),
              },
            ],
          },
          {
            name: 'Medical Relief',
            people: [
              {
                name: 'Dr. Bill Ahrens',
                role: 'Co-Founder & Executive Director',
                timeline: steps(
                  ['Volunteer Missions', 'Relocation to Guatemala', 'MHI Founding', 'Program Development', 'Team Building', 'Partnership Growth', 'Sustainability Planning'],
                  6,
                  [
                    'Led volunteer medical missions to Guatemala\'s western highlands since 1999 — UIC Emergency Pediatrics',
                    'Relocated from Chicago to San Marcos, Guatemala in 2011 after retiring from UIC',
                    'Co-founded Mayan Health Initiative in 2013 with John Sweeney',
                    'Developed four core programs: Rehabilitation, Nutrition, Medical Relief, Ultrasound',
                    'Built team of Guatemalan medical professionals — nurses, therapists, community health workers',
                    'Growing partnerships with UIC, Chicago medical community, and Maryknoll missionaries',
                    'Planning for long-term sustainability through local capacity building and fundraising',
                  ],
                ),
                personalInterests: [
                  {
                    interestSlug: 'nursing',
                    role: 'Medical Educator',
                    timeline: steps(
                      ['Residency', 'Emergency Pediatrics', 'Department Head', 'Global Health Educator'],
                      3,
                      [
                        'Pediatrics residency and emergency medicine fellowship',
                        'Emergency Pediatrics practice at UIC Medical Center — 15+ years',
                        'Head of Emergency Pediatrics at University of Illinois Medical Center, Chicago',
                        'Training Guatemalan health workers in pediatric assessment and emergency care',
                      ],
                    ),
                  },
                ],
              },
              {
                name: 'Dr. Rosa Chávez',
                role: 'Pediatric Clinician',
                timeline: steps(
                  ['Medical Training', 'Rural Clinic Rotation', 'MHI Partnership', 'Pediatric Clinics', 'Mentor to Students'],
                  3,
                  [
                    'Medical degree from Universidad de San Carlos de Guatemala',
                    'Rural clinic rotations in San Marcos and Huehuetenango departments',
                    'Joined MHI as partner clinician for pediatric medical relief',
                    'Running weekly pediatric clinics in San Jose Ojetenam and San Miguel Ixtahuacán',
                    'Mentoring visiting medical students from US partner universities',
                  ],
                ),
              },
            ],
          },
          {
            name: 'Feto-Maternal Ultrasound',
            people: [
              {
                name: 'Carmen Ixchel Ramírez',
                role: 'Ultrasound Technician',
                timeline: steps(
                  ['Basic Training', 'OB Ultrasound Certification', 'Independent Practice', 'Community Prenatal Clinics', 'Training Others'],
                  3,
                  [
                    'Selected from local community for ultrasound training — Mam and Spanish bilingual',
                    'Completed OB ultrasound certification with Inteleos Foundation MedMissions support',
                    'Performing independent feto-maternal scans at MHI clinic',
                    'Running monthly prenatal clinics in remote highland communities',
                    'Training additional indigenous health workers in basic ultrasound',
                  ],
                ),
              },
              {
                name: 'María Tuy',
                role: 'Ultrasound Trainee & Midwife',
                timeline: steps(
                  ['Midwifery Practice', 'Ultrasound Training', 'Supervised Scanning', 'High-Risk Identification'],
                  2,
                  [
                    'Traditional midwife (comadrona) practicing in highland communities for 10+ years',
                    'Enrolled in MHI ultrasound training program — learning prenatal assessment',
                    'Supervised scanning practice — identifying gestational age and fetal position',
                    'Learning to identify high-risk pregnancies for referral to hospital care',
                  ],
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'uic-medical-center',
        name: 'University of Illinois at Chicago — College of Medicine',
        groupLabel: 'Departments',
        groups: [
          {
            name: 'Emergency Pediatrics',
            people: [
              {
                name: 'Dr. Patricia García',
                role: 'Associate Professor, Emergency Pediatrics',
                timeline: steps(
                  ['Residency', 'Fellowship', 'Faculty Appointment', 'Global Health Committee', 'MHI Mission Lead'],
                  4,
                  [
                    'Pediatrics residency at UIC — mentored by Dr. Ahrens',
                    'Pediatric emergency medicine fellowship',
                    'Faculty appointment at UIC College of Medicine',
                    'Joined global health committee — coordinating Guatemala mission partnerships',
                    'Leading annual UIC medical mission team to MHI sites in San Marcos',
                  ],
                ),
                personalInterests: [
                  {
                    interestSlug: 'global-health',
                    role: 'Mission Volunteer',
                    timeline: steps(
                      ['First Mission Trip', 'Annual Volunteer', 'Mission Team Lead', 'Program Advisor'],
                      2,
                    ),
                  },
                ],
              },
              {
                name: 'Dr. Michael Torres',
                role: 'Resident, PGY-3',
                timeline: steps(
                  ['PGY-1 Intern Year', 'PGY-2 Rotations', 'PGY-3 Electives', 'Guatemala Elective', 'Chief Resident'],
                  3,
                  [
                    'Intern year — pediatric ward, NICU, emergency department rotations',
                    'Second year — subspecialty rotations, ICU, outpatient clinics',
                    'Third year — choosing electives, developing global health interest',
                    'Planning Guatemala elective rotation with MHI — 4 weeks in San Marcos',
                    'Applying for chief resident position — global health track',
                  ],
                ),
              },
              {
                name: 'Sarah Kim',
                role: 'Medical Student, MS-4',
                timeline: steps(
                  ['Pre-Clinical', 'Clinical Clerkships', 'Sub-Internship', 'Guatemala Rotation', 'Match & Graduation'],
                  3,
                  [
                    'Pre-clinical coursework — anatomy, physiology, pathology',
                    'Core clinical clerkships — pediatrics, surgery, internal medicine, OB/GYN',
                    'Pediatric emergency medicine sub-internship at UIC',
                    'Completing 4-week global health rotation with MHI in Guatemala',
                    'Applying for pediatric residency — global health focus',
                  ],
                ),
              },
            ],
          },
          {
            name: 'Global Health Programs',
            people: [
              {
                name: 'Dr. Anita Bhandari',
                role: 'Director, Global Health Initiatives',
                timeline: steps(
                  ['Program Design', 'Partner Site Development', 'Student Rotation Program', 'Research Collaborations', 'Funding & Sustainability'],
                  4,
                  [
                    'Designed UIC global health curriculum and international rotation framework',
                    'Established MHI as approved partner site for medical student and resident rotations',
                    'Running student rotation program — 15+ students per year to Guatemala',
                    'Developing research collaborations between UIC faculty and MHI programs',
                    'Securing NIH and foundation funding for global health research',
                  ],
                ),
              },
              {
                name: 'James O\'Brien',
                role: 'Global Health Coordinator',
                timeline: steps(
                  ['Logistics Setup', 'Student Orientation', 'Site Coordination', 'Alumni Network'],
                  2,
                  [
                    'Setting up travel logistics, housing, and insurance for Guatemala rotations',
                    'Running pre-departure orientation — cultural competency, medical Spanish, safety',
                    'On-site coordination between UIC students and MHI clinical staff',
                    'Building alumni network of UIC-MHI rotation graduates for mentorship',
                  ],
                ),
              },
            ],
          },
        ],
      },
      {
        slug: 'chicago-global-health-partners',
        name: 'Chicago Global Health Partners',
        groupLabel: 'Committees',
        groups: [
          {
            name: 'Board of Directors',
            people: [
              {
                name: 'Margaret Sullivan',
                role: 'Board Chair',
                timeline: steps(
                  ['Initial Involvement', 'Board Appointment', 'Strategic Planning', 'Capital Campaign', 'Board Chair'],
                  4,
                  [
                    'First donation to MHI after attending Chicago fundraiser in 2015',
                    'Appointed to board of directors — governance and strategy',
                    'Led strategic planning process — 5-year growth roadmap',
                    'Co-chaired capital campaign for rehabilitation center expansion',
                    'Elected board chair — overseeing organizational growth',
                  ],
                ),
              },
              {
                name: 'Dr. Robert Chen',
                role: 'Board Member, Medical Advisor',
                timeline: steps(
                  ['Volunteer Mission', 'Medical Advisory Role', 'Board Appointment', 'Protocol Development'],
                  3,
                  [
                    'First volunteer medical mission to Guatemala with Dr. Ahrens in 2016',
                    'Advising MHI on clinical protocols and quality improvement',
                    'Appointed to board — representing medical community perspective',
                    'Developing standardized clinical protocols for MHI mission teams',
                  ],
                ),
                personalInterests: [
                  {
                    interestSlug: 'nursing',
                    role: 'Clinical Educator',
                    timeline: steps(['Attending Physician', 'Clinical Instructor', 'Protocol Author'], 2),
                  },
                ],
              },
            ],
          },
          {
            name: 'Medical Volunteers',
            people: [
              {
                name: 'Dr. Jane Buellesbach',
                role: 'Maryknoll Physician & Mentor',
                timeline: steps(
                  ['Missionary Work', 'Decades in Guatemala', 'MHI Mentor', 'Ongoing Support'],
                  3,
                  [
                    'Maryknoll sister and physician — began mission work in Guatemala',
                    'Decades of healthcare delivery in Guatemala\'s rural communities',
                    'Mentored Dr. Ahrens in his transition to full-time Guatemala work',
                    'Ongoing clinical support and community connections for MHI',
                  ],
                ),
              },
              {
                name: 'Dr. Marylou Daoust',
                role: 'Maryknoll Physician & Mentor',
                timeline: steps(
                  ['Medical Missions', 'Community Health Development', 'MHI Advisory', 'Ongoing Support'],
                  3,
                  [
                    'Maryknoll sister and physician — medical missions throughout Central America',
                    'Community health program development in indigenous communities',
                    'Advisory role for MHI program design — decades of Guatemala expertise',
                    'Ongoing mentorship and community introductions for MHI team',
                  ],
                ),
              },
              {
                name: 'Dr. Lisa Ramirez',
                role: 'Volunteer Pediatrician — Rush University',
                timeline: steps(
                  ['First Mission', 'Annual Volunteer', 'Specialty Clinics', 'Chicago Fundraising'],
                  2,
                  [
                    'First MHI mission trip — pediatric care in San Marcos',
                    'Committing to annual volunteer mission — 2 weeks per year',
                    'Running developmental pediatrics specialty clinics during missions',
                    'Organizing fundraising events in Chicago medical community',
                  ],
                ),
              },
            ],
          },
          {
            name: 'Fundraising Committee',
            people: [
              {
                name: 'Isabella Blair',
                role: 'Fundraising Coordinator',
                timeline: steps(
                  ['GoFundMe Campaign', 'Donor Outreach', 'Annual Gala', 'Corporate Partnerships', 'Major Gifts Strategy'],
                  3,
                  [
                    'Launched Plumpy\'Nut GoFundMe campaign for MHI nutrition program',
                    'Building donor database and outreach strategy for Chicago supporters',
                    'Organizing annual Chicago fundraising gala — 200+ attendees',
                    'Developing corporate partnerships with medical device and pharma companies',
                    'Working on major gifts strategy — foundation grants and individual donors',
                  ],
                ),
              },
              {
                name: 'David Sweeney',
                role: 'Board Member & Donor Liaison',
                timeline: steps(
                  ['Family Legacy', 'Board Appointment', 'Donor Relations', 'Chicago Events'],
                  2,
                  [
                    'Continuing the legacy of co-founder John Sweeney — family commitment to MHI',
                    'Appointed to board — focus on fundraising and donor relations',
                    'Building relationships with Chicago philanthropic community',
                    'Hosting Chicago networking events connecting MHI with potential donors',
                  ],
                ),
              },
              {
                name: 'Patricia Moreno',
                role: 'Events Manager',
                timeline: steps(
                  ['Event Planning', 'Venue Partnerships', 'Auction Coordination', 'Impact Storytelling'],
                  1,
                  [
                    'Planning annual benefit gala and smaller quarterly fundraising events',
                    'Building venue partnerships across Chicago for MHI events',
                    'Coordinating silent and live auctions — donated items and experiences',
                    'Creating impact storytelling content — patient stories, before/after photos',
                  ],
                ),
              },
            ],
          },
        ],
      },
    ],
    programs: [
      {
        slug: 'medical-mission-volunteer-training',
        name: 'Medical Mission Volunteer Training',
        type: 'training',
        description: 'Preparation program for medical professionals volunteering with MHI missions to Guatemala',
        offeredBy: [
          { orgSlug: 'mayan-health-initiative', role: 'Mission Host' },
          { orgSlug: 'uic-medical-center', role: 'Academic Partner' },
        ],
        samplePeople: [
          {
            name: 'Dr. Emily Nguyen',
            role: 'Volunteer in Training',
            timeline: steps(
              ['Orientation', 'Cultural Competency', 'Medical Spanish', 'Pre-Departure Briefing', 'First Mission'],
              3,
              [
                'Volunteer orientation — MHI mission, programs, and community context',
                'Cultural competency training — Mayan culture, traditions, health beliefs',
                'Medical Spanish intensive — clinical terminology and patient communication',
                'Pre-departure briefing — logistics, safety, clinical protocols, packing list',
                'First medical mission — pediatric clinics in San Marcos highlands',
              ],
            ),
          },
        ],
      },
      {
        slug: 'rehabilitation-therapist-training',
        name: 'Rehabilitation Therapist Training',
        type: 'training',
        description: 'Training local Guatemalan women as physical therapists for pediatric rehabilitation',
        offeredBy: [
          { orgSlug: 'mayan-health-initiative', role: 'Training Provider' },
        ],
        samplePeople: [
          {
            name: 'Sofía Tuc',
            role: 'Therapist Trainee',
            timeline: steps(
              ['Selection', 'Anatomy & Physiology', 'PT Techniques', 'Supervised Practice', 'Independent Practice'],
              2,
              [
                'Selected from local community — bilingual Mam/Spanish, community trust',
                'Foundational training in anatomy, physiology, and child development',
                'Learning physical therapy techniques — exercises, stretching, assistive devices',
                'Supervised clinical practice with Elizabeth Barrios as mentor',
                'Transitioning to independent practice with own patient caseload',
              ],
            ),
          },
        ],
      },
    ],
    affiliations: [
      { name: 'Chicago Medical Mission Network', orgSlugs: ['mayan-health-initiative', 'uic-medical-center', 'chicago-global-health-partners'] },
    ],
  },
  {
    slug: 'self-mastery',
    name: 'Self-Mastery',
    color: '#8B5CF6',
    icon: 'shield-checkmark',
    organizations: [],
  },
  {
    slug: 'lac-craft-business',
    name: 'Lac Craft Business',
    color: '#E67E22',
    icon: 'storefront',
    organizations: [
      {
        slug: 'pradan-khunti',
        name: 'PRADAN — Khunti Unit',
        groupLabel: 'Programs' as const,
        groups: [],
      },
    ],
  },
  {
    slug: 'food-processing',
    name: 'Food Processing',
    color: '#E67E22',
    icon: 'restaurant',
    organizations: [
      {
        slug: 'pradan-ranchi-food',
        name: 'PRADAN — Ranchi Food Hub',
        groupLabel: 'Programs' as const,
        groups: [],
      },
    ],
  },
  {
    slug: 'textile-weaving',
    name: 'Textile & Weaving',
    color: '#E67E22',
    icon: 'color-palette',
    organizations: [
      {
        slug: 'pradan-hazaribagh-textiles',
        name: 'PRADAN — Hazaribagh Textiles',
        groupLabel: 'Programs' as const,
        groups: [],
      },
    ],
  },
];

export function getInterest(slug: string): SampleInterest | undefined {
  return SAMPLE_INTERESTS.find((i) => i.slug === slug);
}

export function getOrganization(interestSlug: string, orgSlug: string): SampleOrganization | undefined {
  const interest = getInterest(interestSlug);
  return interest?.organizations.find((o) => o.slug === orgSlug);
}

/** Generate a URL-friendly slug from a person's name */
export function personSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Find a person across all sample data by name slug.
 *  Returns the person plus all interest/org contexts they appear in. */
export interface PersonSearchResult {
  person: SamplePerson;
  contexts: {
    interestSlug: string;
    interestName: string;
    interestColor: string;
    orgSlug?: string;       // undefined = personal interest
    orgName?: string;
    role?: string;          // role within this context
    timeline?: SampleTimelineStep[]; // per-interest timeline (for personal interests)
    isPersonal?: boolean;
  }[];
}

export function findPersonBySlug(slug: string): PersonSearchResult | undefined {
  let matchedPerson: SamplePerson | undefined;
  const contexts: PersonSearchResult['contexts'] = [];

  for (const interest of SAMPLE_INTERESTS) {
    for (const org of interest.organizations) {
      const allPeople: SamplePerson[] = [];

      // Collect from groups
      for (const group of org.groups) {
        allPeople.push(...group.people);
        if (group.subgroups) {
          for (const sub of group.subgroups) {
            allPeople.push(...sub.people);
          }
        }
      }
      // Collect from cohorts
      if (org.cohorts) {
        for (const cohort of org.cohorts) {
          allPeople.push(...cohort.people);
        }
      }
      // Collect from capability goals
      if (org.capabilityGoals) {
        for (const goal of org.capabilityGoals) {
          allPeople.push(...goal.people);
        }
      }

      for (const person of allPeople) {
        if (personSlug(person.name) === slug) {
          if (!matchedPerson) matchedPerson = person;
          // Avoid duplicate contexts (same person may appear in groups + cohorts of same org)
          if (!contexts.some((c) => c.interestSlug === interest.slug && c.orgSlug === org.slug)) {
            contexts.push({
              interestSlug: interest.slug,
              interestName: interest.name,
              interestColor: interest.color,
              orgSlug: org.slug,
              orgName: org.name,
              role: person.role,
            });
          }
        }
      }
    }

    // Search programs
    if (interest.programs) {
      for (const program of interest.programs) {
        for (const person of program.samplePeople) {
          if (personSlug(person.name) === slug) {
            if (!matchedPerson) matchedPerson = person;
            if (!contexts.some((c) => c.interestSlug === interest.slug && c.orgName === program.name)) {
              contexts.push({
                interestSlug: interest.slug,
                interestName: interest.name,
                interestColor: interest.color,
                orgName: program.name,
                role: person.role,
              });
            }
          }
        }
      }
    }

    // Search independent practitioners
    if (interest.independentPractitioners) {
      for (const person of interest.independentPractitioners) {
        if (personSlug(person.name) === slug) {
          if (!matchedPerson) matchedPerson = person;
          if (!contexts.some((c) => c.interestSlug === interest.slug && !c.orgSlug && !c.isPersonal)) {
            contexts.push({
              interestSlug: interest.slug,
              interestName: interest.name,
              interestColor: interest.color,
              role: person.role,
            });
          }
        }
      }
    }
  }

  if (!matchedPerson) return undefined;

  // Add personal interests as contexts (no org)
  if (matchedPerson.personalInterests) {
    for (const pi of matchedPerson.personalInterests) {
      const interest = SAMPLE_INTERESTS.find((i) => i.slug === pi.interestSlug);
      if (interest) {
        contexts.push({
          interestSlug: interest.slug,
          interestName: interest.name,
          interestColor: interest.color,
          role: pi.role,
          timeline: pi.timeline,
          isPersonal: true,
        });
      }
    }
  }

  return { person: matchedPerson, contexts };
}
