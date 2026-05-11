# Screenshot Index

Source: `~/Desktop/betteratredesign/` (171 PNGs, CleanShot 2026-05-11).

## Methodology note

The screenshots are working-session captures from Kevin's 2026-05-11 audit-planning
day. The vast majority pair a Claude.ai chat window (left) with one of:

- the running BetterAt web app at `localhost:8081/*` (right)
- a Pocket Casts / podcast window (right) — these are filler captures showing
  audit-planning *text* on the left and unrelated audio UI on the right; the
  BetterAt findings are in the chat text, not the right pane
- an iOS Simulator (`iPhone 17 Pro — iOS 26.0`) screen mirrored in the browser
- Claude Code terminal (left) + browser (right)

Surface identification was done by reading the right-pane URL + headline of each
shot. Many sequential timestamps (e.g. `09.30.08` → `09.31.06`) are the same
surface with one new chat message — they're grouped under a single surface
heading below rather than transcribed row-by-row. Where a screenshot meaningfully
shows a *different* surface or modal, it gets its own row.

The full filename list (171 entries) is at the bottom for completeness.

## Surfaces observed

### Landing / unauthenticated

| Surface | Filenames | Notes |
|---|---|---|
| Landing page (`/start`) – "Three steps to mastery" | 11.28.09, 11.44.46 | Sign In dropdown (Individual Pricing / Institutional Plans) top-right |
| Pricing — Free / $499/yr Pro modal (in-app account → Plans) | 11.43.23 | Modal launched from gear → "Plans & Pricing" |
| Institutional Plans page (`/institutions/pricing`) | 11.45.02 | Starter $500 / Department $750 (most popular) / Enterprise Custom |
| Signup (`/signup`) | 12.22.43, 12.22.51, 12.23.01 | "Create your account" with Learner / Organization toggle, Continue with Google / Apple, Full Name / Email / Password |
| Invite accept screen (signed-out) | 11.43.58 | "You're Invited to Johns Hopkins School of Nursing" with red error banner ("You need to sign in to accept…") |
| Mobile sign-in (`iPhone 17 Pro` mock) | 12.21.24 | "Welcome back", Continue with Apple/Google, Username-or-email + password, Sign In button |
| Mobile Worlds-2027 promo offer | 12.21.06 | "Your Worlds 2027 prep plan, on us." in-app paywall framing for Dragon Worlds cohort |

### Primary IA (left sidebar)

The sidebar shows (top→bottom):
**Active context items** — Clinical (nursing) OR Race (sailing) / Playbook / Discover / Learn / Reflect
**MORE** — Search
**Org Admin** (only if user has org admin role) — appears as separate section in nursing context

| Surface | Filenames |
|---|---|
| Sidebar with sailing context (Race + others) | 11.47.27, 11.48.07, 11.48.48, 11.54.27, 11.54.43, 11.53.58 |
| Sidebar with nursing context (Clinical) | 11.29.01, 11.31.33, 11.43.14, 11.43.19, 12.25.58, 12.26.44, 12.27.51, 12.38.25, 12.43.04 |
| Sidebar with Org Admin section visible | 12.18.38 (Learn), 12.26.44 (Clinical) |

### Race tab (sailing) – timeline view

| Surface | Filenames | Notes |
|---|---|---|
| Race timeline grid (cards laid out chronologically with status pills) | 11.47.27, 11.53.58, 11.54.27, 11.54.43 | Cards show race name, date, status, subscribers/blueprint chip |
| Race step detail (right pane, multi-column with center step card + Coach panel) | 11.47.27, 11.48.07, 11.48.48 | Three tabs: Race Prep / On the Water / Debrief |
| Race step center card | 11.48.07 | "Plan this step", What/How/Why/Who/Where, sub-step list, "Add sub-step", AI Coach button, Add from Playbook |
| Race step → Add to Timeline modal | 11.47.50 | "Worldwater Two-Race Event" with options Race Series / Add Race / Manage Blueprint |
| Race step + Coach chat panel | 11.54.43 | "Coach" sidebar with quoted message thread (right column) |
| Race step On-the-Water tab with strategy block | 11.48.48 | "Goal weather forecasts", "Boat optimization deck" right column |

### Clinical tab (nursing) – timeline view

| Surface | Filenames | Notes |
|---|---|---|
| Clinical timeline grid | 11.29.01, 11.31.33, 11.43.14, 12.25.58, 12.27.51, 12.28.32, 12.43.04 | Same timeline-grid component as Race; cards are nursing courses (Patient Safety, Adult Health Nursing, Maternal-Newborn, Critical Care, Psych & Behavioral, etc.) |
| Clinical step detail | 12.26.44, 12.27.51, 12.34.02, 12.38.25 | Tabs: Pre-Clinical / On Shift / Debrief |
| Clinical step Debrief view | 12.27.51 | Right rail shows Profile drawer (Kevin Denney, Plans & Pricing, Manage Sub, Username, Manage Interests & Catalog) layered over step |
| Clinical step Sub-tabs + step body | 12.34.02, 12.34.21 | "What did you do?", "What did the case present?", "What did the patient need?", "Reflection block" |
| Clinical "Follow-up: Patient Safety and Foundational St…" mentor-context step | 12.38.25 | Shows the kebab → menu in a sibling shot |

### Step kebab / actions

| Surface | Filenames |
|---|---|
| Step kebab menu (Add Collaborators, Share Step, Suggest to, Move Earlier, Move Later, Set Due Date, Visibility/Followers, Edit Step, Delete Step) | 12.45.55 |
| Add People / Add Collaborators modal | 12.45.30, 12.45.42 | Search field + emily2 chen, savannah Mccarthy, Emily Rodriguez |
| Suggest to… modal | 12.46.16 | Search "Suggest to:", results: emily2 chen, savannah Mccarthy, Emily Rodriguez |
| Suggest-to "Sent" confirmation | 12.46.20 | Toast: "Sent: Suggestion: [name] for the next assessment to [user]" + OK |
| Visibility / Publish-as-Blueprint modal | 11.31.33 | Free vs Paid toggle, "Connect your bank account" → Connect Stripe; pricing, period, title, description, alignment |

### Session Complete (celebration)

| Surface | Filenames |
|---|---|
| Session Complete header "Steady step forward." | 12.37.31, 12.37.46, 12.37.56 | Star rating, "What I did" recap blocks, Patient Communication / Discharge planning / Pediatric education chips, "7 sessions and counting" momentum block, AI summary, "Create next step" CTA |

### Mentor Review

| Surface | Filenames |
|---|---|
| Mentor Review page header "Review Step" | 12.40.53, 12.41.08, 12.41.21, 12.41.51 | "Patient Safety and Foundational Skills" review, "Who will you do this with?", "Competencies" block, "Comments" field, "Mentoring Feedback" section, Approve / Request Revision buttons, "Save Revision" / "Save Suggestion" buttons, "Student's Review" |
| Mentor Review with Approve clicked | 12.41.51 | Green "Approved" pill, "What should they work on next?" textarea, Save Suggestion |

### Discover

| Surface | Filenames |
|---|---|
| Discover › Interests | 12.18.24, 12.19.49, 11.56.25 | Cards grouped by category (Health & Fitness, Creative Arts, Sports & Outdoors, etc.); active interests at top with Adopt/Adopted chip |
| Discover › Orgs | 12.18.02 | Cards: 2027 Hong Kong, Hong Kong Victoria Harbor, Valencia – Mediterranean, Aarhus – Jutland, etc. + sail-side & nursing-side mixed |
| Discover › Orgs (nursing focus) | 12.19.53 | Single card: Johns Hopkins School of Nursing with "Request" button (already-admin bug) |
| Discover › Programs | 11.43.39, 11.47.05, 12.17.57 | Tab list of subscribed programs; "Looking for cohort? Want to subscribe to peers?" empty state copy |
| Discover › People | 11.56.40, 12.18.10, 12.19.58 | "49 People to Follow" with Follow All; entries include "b", Sarah Chen, demo-sailor2, Mike Thompson, Emma Wilson, jhu2+denneyke@gmail.com (sailing context); James Rodriguez, Emily Watson, Aisha Patel, Marcus Thompson, Rachel Kim, Dr Linda Brown (nursing context); duplicate Sarah Chen on sailing list |
| Discover › Forums (default landing tab) | 12.17.57 | "Your Feed" tabs with cards: "Looking for crew? Want to subscribe to crew?", "Current pattern over Green Island…", Drowsers & charging, Furling & Code change |

### Learn

| Surface | Filenames |
|---|---|
| Learn › Training (sailing default) | 11.57.01 | "Looking to improve a skill?" with cards: Racing Starts & Pre-Start Strategy, Upwind Tactics & Boatspeed, Downwind Strategy & Mark Roundings, Race Management & Advanced Tactics |
| Learn › Training (nursing context shows same sailing copy — bug) | 11.57.01 implied (need re-check) | Cards do not adapt to nursing |
| Learn › Courses (nursing courses catalog) | 12.18.38 | Johns Hopkins School of Nursing cohort, with Org Admin tools (Organization access, Access requests, Members, Cohorts, Blueprints) |
| Learn › People (org members) | 12.18.38 | "Your Organizations" list with admin badges |

### Reflect

| Surface | Filenames |
|---|---|
| Reflect › Progress | 11.57.08, 12.19.01, 12.20.13 | "0% [of 13 competencies]", This Week, Monthly Activities (counts), Performance chart placeholder, My Skills checklist |
| Reflect › Race Log | 11.59.32 | List of "Hong Kong Dragon World Championship – Race Day 6", Jasmine, Spring Negative Roof, Foursoll, Spring Riposte, Foursoll |
| Reflect › Shift Log (nursing context, still labeled "Shift Log") | 12.20.41 confirms text "shift log is wrong" | The Claude chat at 12.20.41 explicitly notes "shift log is wrong" |
| Reflect › Profile (KD avatar) | 11.57.31, 11.59.45, 12.20.33 | "Kevin Denney" header with Pulse/Drive/Mind/Body stat blocks (all sailing-themed metrics), "Social" counts, Recent Activity feed, Statistics chart |

### Activity feed

| Surface | Filenames |
|---|---|
| Activity (`/social-notifications`) | 11.46.44, 12.46.59 | "Suggestions for you" avatar row (b, KD, Sarah, demo-sailor2, MT), Today: "Kevin suggested 'Geriatric Fall Risk Assessment'", "Kevin demo-sailor@regattaflow.app added you as a collaborator on 'test suggestion'", "jhu2+denneyke approved 'Patient Safety and Foundational Skills'"; Earlier: "jhu2+denneyke Clinical Reasoning Case Study: Sepsis", "Membership approved Your request to join Johns Hopkins School of Nursing was approved", "Welcome to Johns Hopkins School of Nursing: Your organization access is now active" |

### Search

| Surface | Filenames |
|---|---|
| Search (`/search`) | 12.19.14 | Tabs: Sailors / Forums / Orgs / All Tabs; "49 People to Follow" with same names as Discover › People; includes "jasminek02@dorkademy.appleid.com", "kdl", "Justin", "Kev1", "valeri kayes", "ezed Salaria", "Spring Negative", and others |

### Playbook

| Surface | Filenames |
|---|---|
| Playbook | 12.17.47 | "Explore the 'Hire a coach' debrief" banner; Vision card, Ask your Playbook input, Recent sessions ("Worldwater Two-Race Event 25", weekly reviews list), Suggestions / Raw Inbox / Shared with right rail |

### Org Admin

| Surface | Filenames |
|---|---|
| Royal Harbour Yacht Club Dashboard | 10.39.28 | Members 342, Active 127, Boats 5, Active Events 5, Total Events 166, Revenue $28,645; Quick Actions (New Regatta / Race Series / Training / Social Event); Upcoming Events; calendar |
| Club Operations HQ | 11.01.05, 11.01.18 | Generic empty club dash, all-zero metrics, Quick Actions same as RHKYC |
| Club Operations HQ (Manage Subscription menu) | 11.01.18 | Three-dot menu open showing options |
| Nursing org admin – Catalog | 11.44.10, 11.44.17 | Tabs: Catalog / Organization / Members / Cohorts / Access; "Add Program" CTA, category dropdown filter, programs by interest |
| Nursing org admin – Catalog filtered list | 11.44.17 | Removable cards for Design, Drawing, Fitness, Food Processing, Global Health, Golf, Knitting, Law Craft Business, Nursing, Sail Racing, Self-Mastery, Team Racing |
| Nursing org admin – Coach Onboarding | 11.44.23 | "Welcome to Coaching", form: Full Name, Coaching Discipline, Organization, Experience radios (<1, 1-2, 3-5, 6-10, 11-15, 15+, Olympic / Professional), Phone, Contact Info |
| Nursing org admin – Organization Access | 11.43.58 | Settings page; "No org memberships yet" empty state |

### Creator Dashboard

| Surface | Filenames |
|---|---|
| Kevin's Dashboard – No Stripe Account | 10.30.04 | "Connect your Stripe account to start receiving payments from Blueprint sales" empty state |
| Kevin's Dashboard – Blueprints / Earnings tabs | 12.27.33 | Tabs (Blueprints / Earnings) + counts (15 / 3 / 13), list of authored blueprints (Achieving Peak Performance at the Dragon Worlds, Kevin's sail Mast Imprint, Pulse and Tow, Water Sports Pathway, Dinghy Sail Training Scheme L1-L4, Instructor Development Pathway, Youth High Performance Pathway, Junior Dinghy Scheme J51-J04, School Sailing Programme, etc.) |
| Blueprint detail (creator view) | 12.28.09, 12.28.32 | "Achieving Peak Performance at the Dragon Worlds", subscribers 1 / 33 / 3 / 5 metric tiles, timeline steps list, "View Details & Mentor" per subscriber |
| Blueprint detail – step list with subscribers | 12.28.32 | Step list "Commit to Hong Kong 2017", "Set a performance baseline", "Build a regatta fitness base", "Boat optimization block", "Ship the boat to Hong Kong", "On-site practice and tune-up regatta", "Tapes and recover", "Race the Worlds — execute the plan", and Subscribers list at bottom (Kevin Denney, Sarah Chen) |
| Blueprint per-step subscriber detail (mentor) | 12.29.36 | Modal "Commit to Hong Kong 2017": prompt list "Submit entry on the regatta site", "Confirm boat shipping itinerary…" with Read More expansion; mentor checkmark step approval flow |
| Blueprint subscribers list with per-subscriber dropdown | 12.30.32 | "Two-Race Event" → "Commit to Hong Kong 2017" + "Untitled" rail; per-subscriber blueprint view with progress |
| Nursing blueprint detail | 12.40.30 | "Patient Safety and Foundational Skills" with steps Fundamentals/Adult Health/Maternal-Newborn Nursing/Critical Care/Psych & Behavioral/Capstone & NCLEX Prep/Clinical Reasoning Case Study/Simulation Lab/Code Blue Response; subscribers list: Kevin Denney, Maya Patel, Jordan Kim, Ariana Lopez, Priya Nair, Sam Chen, Sara Chen (duplicate-ish), emily3 chen |
| Nursing per-subscriber detail | 12.40.40 | "emily3 chen" page: tabs Review Notes/Comments/All Progress; "Patient Safety and Foundational Skills" under tabs; Suggest Step CTA at bottom |
| Mentor Review (single step) | 12.40.53–12.41.51 | See "Mentor Review" section above |

### Mobile

| Surface | Filenames |
|---|---|
| Mobile sign-in | 12.21.24 | iPhone 17 Pro frame |
| Mobile Worlds 2027 paywall card | 12.21.06 | Same iPhone frame |

### Account / Settings

| Surface | Filenames |
|---|---|
| Account modal (gear icon) | 11.43.19 | "Kevin Denney" header with avatar, Plans & Pricing, Manage Subscription, Username, Notifications, Telegram Assistant, Current Interest (toggle), Manage Interests & Catalog, Organization Access, Looking Insights, Connected Devices, Privacy Settings, Sign Out |
| Pricing / Plans modal | 11.43.23 | "Choose your plan" — Free $0 vs Pro $499/yr; "Start 14-day free trial" |
| Organization Access settings | 11.43.58 | "No org memberships yet" |
| Catalog management (Account → Manage Interests & Catalog) | 11.44.17 | Filterable interests catalog with Remove buttons |

### Audit-planning / Claude.ai meta-shots (no product surface)

These are screenshots where the right pane is a Pocket Casts podcast UI or a
Claude.ai chat with no live BetterAt surface — they show the user composing the
audit plan itself. Useful for *intent* but not for visual code-tracing. Group:

- 09.28.48, 09.29.55, 09.30.08, 09.30.50, 09.31.06, 09.31.19, 09.31.24, 09.31.58,
  09.33.20, 09.33.44, 09.34.16, 09.34.44, 09.36.18, 09.36.32, 09.36.52, 09.37.10,
  09.37.30, 09.37.41 — early-morning planning conversation
- 09.53.44, 09.54.58, 09.55.09, 09.55.21, 09.57.45, 10.00.03, 10.04.15, 10.09.22,
  10.13.31, 10.14.57, 10.15.20, 10.15.26, 10.15.31, 10.15.37, 10.15.44, 10.16.02
  — mid-morning planning continuation
- 10.22.06, 10.22.32, 10.22.42, 10.22.47, 10.22.52, 10.22.57, 10.23.03, 10.23.08,
  10.23.55, 10.24.05, 10.24.16, 10.24.40, 10.24.55, 10.25.03, 10.25.10, 10.25.19,
  10.25.56, 10.26.13, 10.26.21, 10.26.46, 10.28.17, 10.28.28, 10.28.52, 10.29.02,
  10.29.13, 10.29.18, 10.29.29, 10.29.41, 10.30.51, 10.31.21, 11.24.13, 11.43.39,
  11.47.05, 11.52.46, 11.56.21, 11.56.55, 11.57.16, 11.59.24, 12.18.43, 12.19.24,
  12.19.36, 12.20.02, 12.20.18, 12.20.41, 12.21.45, 12.21.50, 12.21.57, 12.22.32,
  12.22.43, 12.45.30, 12.45.42, 12.45.55, 12.46.16 — chat-only with audit-plan text

These contain text-only signal that confirms findings (e.g. 12.20.41 includes
the literal note "shift log is wrong. also, coach now not per interest", and
12.21.45 includes "we're finally seen the Nursing side… top-right shows
'Nursing' instead of 'Sail Racing'. Sidebar changes: where it said 'Race' before,
it now says 'Clinical'.").

## Full filename list

(All 171 files in `~/Desktop/betteratredesign/`, sorted chronologically.)

```
CleanShot 2026-05-11 at 09.28.48@2x.png
CleanShot 2026-05-11 at 09.29.55@2x.png
CleanShot 2026-05-11 at 09.30.08@2x.png
CleanShot 2026-05-11 at 09.30.50@2x.png
CleanShot 2026-05-11 at 09.31.06@2x.png
CleanShot 2026-05-11 at 09.31.19@2x.png
CleanShot 2026-05-11 at 09.31.24@2x.png
CleanShot 2026-05-11 at 09.31.58@2x.png
CleanShot 2026-05-11 at 09.33.20@2x.png
CleanShot 2026-05-11 at 09.33.44@2x.png
CleanShot 2026-05-11 at 09.34.16@2x.png
CleanShot 2026-05-11 at 09.34.44@2x.png
CleanShot 2026-05-11 at 09.36.18@2x.png
CleanShot 2026-05-11 at 09.36.32@2x.png
CleanShot 2026-05-11 at 09.36.52@2x.png
CleanShot 2026-05-11 at 09.37.10@2x.png
CleanShot 2026-05-11 at 09.37.30@2x.png
CleanShot 2026-05-11 at 09.37.41@2x.png
CleanShot 2026-05-11 at 09.53.44@2x.png
CleanShot 2026-05-11 at 09.54.58@2x.png
CleanShot 2026-05-11 at 09.55.09@2x.png
CleanShot 2026-05-11 at 09.55.21@2x.png
CleanShot 2026-05-11 at 09.57.45@2x.png
CleanShot 2026-05-11 at 10.00.03@2x.png
CleanShot 2026-05-11 at 10.04.15@2x.png
CleanShot 2026-05-11 at 10.09.22@2x.png
CleanShot 2026-05-11 at 10.13.31@2x.png
CleanShot 2026-05-11 at 10.14.57@2x.png
CleanShot 2026-05-11 at 10.15.20@2x.png
CleanShot 2026-05-11 at 10.15.26@2x.png
CleanShot 2026-05-11 at 10.15.31@2x.png
CleanShot 2026-05-11 at 10.15.37@2x.png
CleanShot 2026-05-11 at 10.15.44@2x.png
CleanShot 2026-05-11 at 10.16.02@2x.png
CleanShot 2026-05-11 at 10.22.06@2x.png
CleanShot 2026-05-11 at 10.22.32@2x.png
CleanShot 2026-05-11 at 10.22.42@2x.png
CleanShot 2026-05-11 at 10.22.47@2x.png
CleanShot 2026-05-11 at 10.22.52@2x.png
CleanShot 2026-05-11 at 10.22.57@2x.png
CleanShot 2026-05-11 at 10.23.03@2x.png
CleanShot 2026-05-11 at 10.23.08@2x.png
CleanShot 2026-05-11 at 10.23.55@2x.png
CleanShot 2026-05-11 at 10.24.05@2x.png
CleanShot 2026-05-11 at 10.24.16@2x.png
CleanShot 2026-05-11 at 10.24.40@2x.png
CleanShot 2026-05-11 at 10.24.55@2x.png
CleanShot 2026-05-11 at 10.25.03@2x.png
CleanShot 2026-05-11 at 10.25.10@2x.png
CleanShot 2026-05-11 at 10.25.19@2x.png
CleanShot 2026-05-11 at 10.25.56@2x.png
CleanShot 2026-05-11 at 10.26.13@2x.png
CleanShot 2026-05-11 at 10.26.21@2x.png
CleanShot 2026-05-11 at 10.26.46@2x.png
CleanShot 2026-05-11 at 10.28.17@2x.png
CleanShot 2026-05-11 at 10.28.28@2x.png
CleanShot 2026-05-11 at 10.28.52@2x.png
CleanShot 2026-05-11 at 10.29.02@2x.png
CleanShot 2026-05-11 at 10.29.13@2x.png
CleanShot 2026-05-11 at 10.29.18@2x.png
CleanShot 2026-05-11 at 10.29.29@2x.png
CleanShot 2026-05-11 at 10.29.41@2x.png
CleanShot 2026-05-11 at 10.30.04@2x.png
CleanShot 2026-05-11 at 10.30.51@2x.png
CleanShot 2026-05-11 at 10.31.21@2x.png
CleanShot 2026-05-11 at 10.31.33@2x.png
CleanShot 2026-05-11 at 10.39.28@2x.png
CleanShot 2026-05-11 at 11.01.05@2x.png
CleanShot 2026-05-11 at 11.01.18@2x.png
CleanShot 2026-05-11 at 11.24.13@2x.png
CleanShot 2026-05-11 at 11.28.09@2x.png
CleanShot 2026-05-11 at 11.29.01@2x.png
CleanShot 2026-05-11 at 11.43.14@2x.png
CleanShot 2026-05-11 at 11.43.19@2x.png
CleanShot 2026-05-11 at 11.43.23@2x.png
CleanShot 2026-05-11 at 11.43.39@2x.png
CleanShot 2026-05-11 at 11.43.58@2x.png
CleanShot 2026-05-11 at 11.44.10@2x.png
CleanShot 2026-05-11 at 11.44.17@2x.png
CleanShot 2026-05-11 at 11.44.23@2x.png
CleanShot 2026-05-11 at 11.44.46@2x.png
CleanShot 2026-05-11 at 11.44.55@2x.png
CleanShot 2026-05-11 at 11.45.02@2x.png
CleanShot 2026-05-11 at 11.46.44@2x.png
CleanShot 2026-05-11 at 11.47.05@2x.png
CleanShot 2026-05-11 at 11.47.27@2x.png
CleanShot 2026-05-11 at 11.47.30@2x.png
CleanShot 2026-05-11 at 11.47.50@2x.png
CleanShot 2026-05-11 at 11.48.07@2x.png
CleanShot 2026-05-11 at 11.48.18@2x.png
CleanShot 2026-05-11 at 11.48.48@2x.png
CleanShot 2026-05-11 at 11.48.54@2x.png
CleanShot 2026-05-11 at 11.52.46@2x.png
CleanShot 2026-05-11 at 11.53.32@2x.png
CleanShot 2026-05-11 at 11.53.58@2x.png
CleanShot 2026-05-11 at 11.54.27@2x.png
CleanShot 2026-05-11 at 11.54.43@2x.png
CleanShot 2026-05-11 at 11.56.21@2x.png
CleanShot 2026-05-11 at 11.56.25@2x.png
CleanShot 2026-05-11 at 11.56.31@2x.png
CleanShot 2026-05-11 at 11.56.40@2x.png
CleanShot 2026-05-11 at 11.56.48@2x.png
CleanShot 2026-05-11 at 11.56.55@2x.png
CleanShot 2026-05-11 at 11.57.01@2x.png
CleanShot 2026-05-11 at 11.57.08@2x.png
CleanShot 2026-05-11 at 11.57.16@2x.png
CleanShot 2026-05-11 at 11.57.31@2x.png
CleanShot 2026-05-11 at 11.59.24@2x.png
CleanShot 2026-05-11 at 11.59.32@2x.png
CleanShot 2026-05-11 at 11.59.45@2x.png
CleanShot 2026-05-11 at 12.17.47@2x.png
CleanShot 2026-05-11 at 12.17.57@2x.png
CleanShot 2026-05-11 at 12.18.02@2x.png
CleanShot 2026-05-11 at 12.18.10@2x.png
CleanShot 2026-05-11 at 12.18.17@2x.png
CleanShot 2026-05-11 at 12.18.21@2x.png
CleanShot 2026-05-11 at 12.18.24@2x.png
CleanShot 2026-05-11 at 12.18.38@2x.png
CleanShot 2026-05-11 at 12.18.43@2x.png
CleanShot 2026-05-11 at 12.19.01@2x.png
CleanShot 2026-05-11 at 12.19.09@2x.png
CleanShot 2026-05-11 at 12.19.14@2x.png
CleanShot 2026-05-11 at 12.19.24@2x.png
CleanShot 2026-05-11 at 12.19.36@2x.png
CleanShot 2026-05-11 at 12.19.49@2x.png
CleanShot 2026-05-11 at 12.19.53@2x.png
CleanShot 2026-05-11 at 12.19.58@2x.png
CleanShot 2026-05-11 at 12.20.02@2x.png
CleanShot 2026-05-11 at 12.20.07@2x.png
CleanShot 2026-05-11 at 12.20.13@2x.png
CleanShot 2026-05-11 at 12.20.18@2x.png
CleanShot 2026-05-11 at 12.20.33@2x.png
CleanShot 2026-05-11 at 12.20.41@2x.png
CleanShot 2026-05-11 at 12.21.06@2x.png
CleanShot 2026-05-11 at 12.21.24@2x.png
CleanShot 2026-05-11 at 12.21.45@2x.png
CleanShot 2026-05-11 at 12.21.50@2x.png
CleanShot 2026-05-11 at 12.21.57@2x.png
CleanShot 2026-05-11 at 12.22.32@2x.png
CleanShot 2026-05-11 at 12.22.43@2x.png
CleanShot 2026-05-11 at 12.22.51@2x.png
CleanShot 2026-05-11 at 12.23.01@2x.png
CleanShot 2026-05-11 at 12.25.58@2x.png
CleanShot 2026-05-11 at 12.26.44@2x.png
CleanShot 2026-05-11 at 12.27.33@2x.png
CleanShot 2026-05-11 at 12.27.51@2x.png
CleanShot 2026-05-11 at 12.28.09@2x.png
CleanShot 2026-05-11 at 12.28.32@2x.png
CleanShot 2026-05-11 at 12.29.36@2x.png
CleanShot 2026-05-11 at 12.30.32@2x.png
CleanShot 2026-05-11 at 12.33.45@2x.png
CleanShot 2026-05-11 at 12.34.02@2x.png
CleanShot 2026-05-11 at 12.34.21@2x.png
CleanShot 2026-05-11 at 12.37.31@2x.png
CleanShot 2026-05-11 at 12.37.46@2x.png
CleanShot 2026-05-11 at 12.37.56@2x.png
CleanShot 2026-05-11 at 12.38.25@2x.png
CleanShot 2026-05-11 at 12.40.30@2x.png
CleanShot 2026-05-11 at 12.40.40@2x.png
CleanShot 2026-05-11 at 12.40.53@2x.png
CleanShot 2026-05-11 at 12.41.08@2x.png
CleanShot 2026-05-11 at 12.41.21@2x.png
CleanShot 2026-05-11 at 12.41.51@2x.png
CleanShot 2026-05-11 at 12.43.04@2x.png
CleanShot 2026-05-11 at 12.45.08@2x.png
CleanShot 2026-05-11 at 12.45.30@2x.png
CleanShot 2026-05-11 at 12.45.42@2x.png
CleanShot 2026-05-11 at 12.45.55@2x.png
CleanShot 2026-05-11 at 12.46.16@2x.png
CleanShot 2026-05-11 at 12.46.20@2x.png
CleanShot 2026-05-11 at 12.46.59@2x.png
```

## Notable visual artifacts (carry into later passes)

Confirmed from screenshots (cite when discussing UI behavior in later passes):

1. **Demo data leakage in Activity feed** (12.46.59): single-letter "b" user,
   "demo-sailor2", "jhu2+denneyke" displayed as user names; "test suggestion"
   appears as a real shared step title.
2. **Duplicate Sarah Chen in Discover › People** (11.56.40 sailing; 12.40.30
   nursing).
3. **Apple ID privaterelay email** in People list (12.19.14): "jasminek02@dorkademy"
   appearing as a "follow" suggestion.
4. **Profile shows sailing metrics in nursing context** (11.57.31, 12.20.33):
   Pulse/Drive/Mind/Body sailing-themed stat layout regardless of active interest.
5. **Reflect Progress count mismatch** (11.57.08, 12.20.13): "0% of 13
   competencies" header alongside a competency list with no completed entries;
   monthly activities counts and skills list do not reconcile.
6. **"Coaches" tab not interest-aware** (chat note 12.21.45: "we should have
   seen this, but the coach now not per interest").
7. **"Shift Log" terminology incorrect** (chat note 12.20.41: "shift log is wrong").
8. **Discover › Orgs "Request" button shown even when current user is org admin**
   (12.19.53 — single Johns Hopkins card with Request button).
9. **Mentor Review Comments field UI present** (12.40.53–12.41.51) — needs code
   audit to confirm save wiring.
10. **Catalog-step preview vs timeline-step divergence** (12.45.08): catalog
    cards in right pane render the *same* domain step compactly while the left
    timeline renders the full multi-column composition.
11. **Suggest-to "Sent" toast confirmation** (12.46.20) — sender side complete.
12. **Mobile sign-in shows "BetterAt" branded but iOS frame is "iPhone 17 Pro"
    iOS 26.0** (12.21.24).
13. **Profile page Recent Activity** (11.57.31) shows "Kevin started following you"
    by "kdenney+regattaflow.appleid.com" — another email-as-display-name leak.
