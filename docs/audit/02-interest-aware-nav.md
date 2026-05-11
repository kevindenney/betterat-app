# Pass 2 — Interest-aware navigation

Read-only audit of how the active interest (sailing, nursing, drawing, fitness, …)
drives the tab bar, sidebar, drawer, and screen-level labels. Branch:
`audit/codebase-recon`. All citations are `path:line`. No code changes proposed
here — only findings.

---

## TL;DR

There are **three independent label-resolution systems** wired into the UI, and
none of them is the single source of truth the codebase comments imply:

1. **`lib/vocabulary.ts`** — a 15-key universal-term map fetched from the
   `betterat_vocabulary` Supabase table (with a `tableUnavailable` short-circuit
   flag at `lib/vocabulary.ts:16`) and a per-interest hard-coded fallback for
   sail-racing, nursing, drawing, fitness, knitting, design, etc.
2. **`lib/navigation-config.ts`** — derives tab/sidebar labels from `vocabulary`
   *only* for one slot (the "Learning Event" tab), via `getEventTabTitle`
   (`lib/navigation-config.ts:58-70`). The rest of the labels (`Playbook`,
   `Discover`, `Learn`, `Reflect`, `Workspace`, `People`, `Programs &
   Placements`, …) are hard-coded English strings.
3. **`configs/{interest}.ts`** (e.g. `configs/nursing.ts`) — independent
   `reflectConfig.segments`, `progressLabels`, `eventLabels`, that the in-screen
   chrome reads directly via `useInterestEventConfig()` and bypass both of the
   layers above.

Symptoms of this split observed on the nursing surface:
- Tab bar shows "Practice" (or "Clinical") only because of the
  `getEventTabTitle` first/last-word slice — every other tab keeps its English
  noun.
- The Reflect tab still says **"Shift Log"** because that label is hard-coded
  in `configs/nursing.ts:919`, independent of vocabulary.
- The Learn tab still says **"Coaches"** for nursing because the segment label
  in `app/(tabs)/learn.tsx:100` is the literal string `'Coaches'` — never run
  through vocabulary, so nursing users do not see "Preceptors".

The audit ground rule is read-only, so the below catalogues every place a
label is wired and every consumer that is inconsistent with the others. Fix
sizing is left for the synthesis pass.

---

## 1. The three labeling layers

### 1.1 `lib/vocabulary.ts` — DB-backed term map

- Type: `VocabularyMap = Record<string, string>` (`lib/vocabulary.ts:24`).
- Universal keys (15 total) defined by the sail-racing fallback at
  `lib/vocabulary.ts:30-46`:
  `Learning Event, Plan Phase, Do Phase, Review Phase, Practice, Institution,
  Coach, Passport, Period, Milestone, Skill, Community, Equipment, Competency,
  Supervision`.
- Per-interest fallbacks live in the same file: nursing
  (`lib/vocabulary.ts:52-68`), drawing (`70-86`), design (`88-102`), fitness
  (`104-118`), knitting (`120-…`), and more.
- Source-of-truth at runtime is the `betterat_vocabulary` Supabase table; the
  module also exposes a `tableUnavailable` module-level flag
  (`lib/vocabulary.ts:16`) that disables future fetch attempts once a 4xx is
  observed, so vocabulary degrades silently to the fallback maps for the
  remainder of the session.

### 1.2 `lib/navigation-config.ts` — partial consumer of vocabulary

- `getEventTabTitle(vocabulary, activeDomain)` at
  `lib/navigation-config.ts:58-70` reads `vocabulary['Learning Event']` and
  returns the **last word** (so `Clinical Shift → "Shift"`, `Skills Lab → "Lab"`).
  This is the only place vocabulary actually drives a tab title.
- Sail-racing default at `lib/navigation-config.ts:63`:
  `defaultLabel = domain === 'sailing' ? 'Race' : 'Practice'` — the *fallback for
  any interest without an active domain* is "Practice", but only after
  vocabulary has resolved to nothing.
- `getTabsForUserType(userType, isGuest, capabilities, vocabulary,
  workspaceContext)` at `lib/navigation-config.ts:77-145`:
  - learner tabs (`lib/navigation-config.ts:123-129`) are literal strings:
    `Playbook`, `Discover`, `Learn`, `Reflect` — none reads from `vocabulary`.
  - club tabs (`lib/navigation-config.ts:98-116`) ditto: `Events`, `Members`,
    `Programs & Placements`, `Club`, `Settings`.
  - Program-workspace fork at `lib/navigation-config.ts:99-107` is the only
    place `workspaceContext` is consulted; it returns `Workspace, People,
    Programs & Placements, Org, Settings` for nursing/drawing/fitness
    institutions.
- `getNavItemsForUserType(userType, vocabulary, workspaceContext)` at
  `lib/navigation-config.ts:198-244` mirrors `getTabsForUserType`, but only
  rewrites the `'races'` item's label using `eventTitle` (line 226-231). The
  rest of `SAILOR_NAV_ITEMS` (`lib/navigation-config.ts:152-158`) is hard-coded
  English.
- Note the comment at `lib/navigation-config.ts:118-119` — "*Legacy coach users
  now get the same tabs as learners (coach persona deprecated)*" — yet
  `COACH_NAV_ITEMS` is still exported (`lib/navigation-config.ts:164-168`) and
  the `case 'coach'` switch arm at `lib/navigation-config.ts:209-210` still
  returns coach-only nav. (Carried forward from Pass 1's dead-code smells.)

### 1.3 `configs/{interest}.ts` — direct, independent labels

Per-interest configs (resolved by slug in `configs/index.ts`) hard-code label
sets that bypass vocabulary entirely. Concrete nursing example:

```text
configs/nursing.ts:916-942  reflectConfig.segments / progressStats / progressLabels
  - segments[1]:    { value: 'racelog', label: 'Shift Log' }   ← line 919
  - eventsLabel:    'Shifts'                                   ← line 923
  - hoursLabel:     'Clinical Hours'                           ← line 924
  - skillsLabel:    'Competencies'                             ← line 925
  - streakLabel:    'Shift Streak'                             ← line 926
```

Consumer: `useInterestEventConfig()` (`hooks/useInterestEventConfig.ts:18-23`)
returns this config directly to whichever screen needs interest-specific copy.
Screens reading this config render its strings verbatim — no vocabulary lookup.

**Implication:** if a designer or PM changes the term "Shift" in the
`betterat_vocabulary` Supabase table, the bottom-of-screen segmented control
on the Reflect tab will not update. Two writes are required (Supabase row
*and* `configs/nursing.ts`), and the two can diverge silently.

---

## 2. Workspace-context wiring is inconsistent

`workspaceContext = { organizationType?, activeDomain?, isOrgAdmin? }` is the
only signal that triggers the program-workspace tab fork at
`lib/navigation-config.ts:99-107`. Every caller of `getTabsForUserType` or
`getNavItemsForUserType` must thread it through, or the fork never fires.

### 2.1 `getTabsForUserType` callsites

| Callsite | Threads `workspaceContext`? |
|---|---|
| `app/(tabs)/_layout.tsx:135` | **NO** — `getTabsForUserType(userType, isGuest, capabilities, vocabulary)` |
| `lib/utils/userTypeRouting.ts:51` | **NO** — also omits `vocabulary` |
| `app/__tests__/secondary-packs-route-api.contract.test.ts:9,19` | YES (passes 5th arg) |

**Effect:** the mobile/native tab bar built by `app/(tabs)/_layout.tsx` *never*
takes the program-workspace branch. A JHU School of Nursing dean signed in as
the institution admin gets `Events / Members / Programs & Placements / Club /
Settings` on the bottom tab bar (`lib/navigation-config.ts:109-115`), not the
intended `Workspace / People / Programs & Placements / Org / Settings`
(`lib/navigation-config.ts:101-106`). Only the web sidebar gets the right
labels (see 2.2).

A WIP patch in `docs/ai/wip-backup.patch:85-88` already drafts the fix
(`getTabsForUserType(..., vocabulary, { organizationType, activeDomain,
isOrgAdmin })`) but is not committed.

### 2.2 `getNavItemsForUserType` callsites

| Callsite | Threads `workspaceContext`? |
|---|---|
| `components/navigation/WebSidebarNav.tsx:54-57` | YES — `{ activeDomain, isOrgAdmin }` |
| `components/navigation/NavigationDrawer.tsx:189` | YES |
| `components/navigation/NavigationDrawer.tsx:548` | YES |
| `components/navigation/NavigationDrawer.tsx:825` (`getCurrentSectionName`) | **NO** — `getNavItemsForUserType(userType, vocabulary)` |

**Effect:** the persistent web sidebar and the mobile slide-in drawer correctly
re-label tabs for program workspaces, but the **header section name** computed
by `getCurrentSectionName` for the same screen falls back to learner labels.
A nursing institution admin therefore sees a sidebar that says "Workspace" but
a header that says "Race" (or the resolved `eventTitle`), depending on the
current pathname.

### 2.3 `isProgramWorkspace` predicate

`lib/navigation-config.ts:40-48`:

```text
const isProgramWorkspace = (organizationType, activeDomain) => {
  domain = lowercase(activeDomain)
  if (domain === 'sailing') return false
  if (domain in { nursing, drawing, fitness, health-and-fitness,
                  lac-craft-business }) return true
  return organizationType === 'institution'
}
```

Notes:
- **Hard-coded allowlist of domains.** A new interest (e.g. `cooking`,
  `coding`) will fall through to the `organizationType === 'institution'`
  check, which is fine for users with an org membership but means a solo
  learner in a brand-new interest gets the learner tab set with no warning.
- The check rejects `'sailing'` explicitly, even when `organizationType ===
  'institution'`. So a sailing club admin will *always* get the legacy club
  tabs (`Events / Members / …`), never the program-workspace tabs — likely
  intentional but unexplained in the file.

---

## 3. Hard-coded English labels that should be vocabulary-aware

The following user-visible strings are rendered verbatim with no vocabulary
lookup. Each is a likely visual-audit finding when running the app under
nursing or drawing.

| File:line | Hard-coded label | Vocabulary key it ought to use |
|---|---|---|
| `app/(tabs)/learn.tsx:100` | `'Coaches'` (segmented control) | `Coach` → "Preceptor" / "Instructor" |
| `lib/navigation-config.ts:125` | `'Playbook'` tab | (none defined) |
| `lib/navigation-config.ts:126` | `'Discover'` tab | (none defined) |
| `lib/navigation-config.ts:127` | `'Learn'` tab | (none defined) |
| `lib/navigation-config.ts:128` | `'Reflect'` tab | (none defined) |
| `lib/navigation-config.ts:103` | `'Programs & Placements'` (institution) | (none defined) |
| `lib/navigation-config.ts:111` | `'Members'` (club) | (none defined) |
| `lib/navigation-config.ts:113` | `'Club'` profile tab | `Institution` → "Yacht Club" / "Clinical Site" / "Studio" |
| `lib/navigation-config.ts:104` | `'Org'` profile tab (institution branch) | `Institution` |
| `configs/nursing.ts:919` | `'Shift Log'` | `Learning Event` ("Clinical") + "Log" |
| `configs/nursing.ts:923-926` | `Shifts / Clinical Hours / Competencies / Shift Streak` | `Learning Event`, `Skill`, `Competency` |

The vocabulary map only defines 15 universal keys (`lib/vocabulary.ts:30-46`),
so the rows above flagged "(none defined)" cannot be solved by extending an
existing map — they require either a vocabulary-key expansion or moving the
label into per-interest configs.

---

## 4. `currentInterest?.slug ?? 'sail-racing'` defaults leak sailing language

Two hooks fall back to `'sail-racing'` when no interest is resolved yet:

- `hooks/useInterestEventConfig.ts:20`
  `const slug = currentInterest?.slug ?? 'sail-racing'`
- `app/(tabs)/learn.tsx:91-92` derives `isSailingInterest` from the same slug;
  if it is falsy/unresolved it lands in the non-sailing branch, but the
  `'Coaches'` segment label is not gated by this flag — so even a sailing
  user sees "Coaches" instead of "Sailing Coaches".

`InterestProvider` resolves the active interest from AsyncStorage →
`user_preferences` → server profile signal → first `userInterest` → `null`
(triggering the onboarding gate). Until that chain finishes (network
roundtrips on first launch), every screen that reads
`useInterestEventConfig()` renders **sailing** labels for a brief window,
including the Reflect tab title, segment captions, and event-card chrome.

The flicker is observable as a "Race / Sail" flash before nursing language
locks in.

---

## 5. Tab bar render path is split by user type

`app/(tabs)/_layout.tsx` builds two tab-bar surfaces from the same `tabs`
array:

- **Sailor / learner / guest** → custom `FloatingTabBar`
  (`components/navigation/FloatingTabBar.tsx`), a floating pill on top of the
  screen. It reads `tab.title` directly from the array returned by
  `getTabsForUserType` — so any vocabulary-driven re-label flows through here.
- **Club / institution admin** → React Navigation's stock tab bar, with
  `tabBarButton` overridden by `renderClubTabButton` inside `(tabs)/_layout.tsx`.
  Because the layout never passed `workspaceContext` (see §2.1), institution
  admins get the legacy club labels here regardless of domain.

The two render paths also diverge on:
- `renderSailorTabButton` (`app/(tabs)/_layout.tsx:267-…`) uses
  `IOS_COLORS.systemBlue` for active state.
- The club path uses different active/inactive styles and is the only one that
  honors `tabBarButton` overrides for haptics.

This is a maintenance hazard for any future label change: the test at
`app/__tests__/secondary-packs-route-api.contract.test.ts` exercises the
workspace-context path but does **not** mount `(tabs)/_layout.tsx`, so the
inconsistency is invisible to CI.

---

## 6. Many `<Tabs.Screen href={null}>` ghost routes

`app/(tabs)/_layout.tsx` declares numerous tab screens with `href={null}` to
hide them while keeping the route mounted:
`more, connect, follow, community, discuss, tuning-guides, progress,
race-detail-demo, race-browser, …`

Combined with the `userType === 'coach' → /clients` redirect
(`app/(tabs)/_layout.tsx:163-169`) and the `userType === 'club' → /events`
redirect (`app/(tabs)/_layout.tsx:172-177`), the file is doing both the tab
config job and a role-routing job. This couples the tab-bar render to side
effects, and it is the reason the visual audit shows a brief flash of `/races`
before institution admins land on `/events`.

---

## 7. Vocabulary fetch failure mode is silent

`lib/vocabulary.ts:16` exposes `tableUnavailable` and the loader logs a warning
once when a fetch returns empty for an interest (`emptyVocabularyLoggedInterests`
guard). Behaviour when:

- **Network fails**: returns fallback map (sail-racing universal or the
  matching interest fallback in `lib/vocabulary.ts`).
- **Table missing entirely**: `tableUnavailable = true`, all subsequent calls
  short-circuit to fallback. No user surface signal.
- **Row missing for current interest**: empty map returned, callers expecting
  `vocabulary['Coach']` get `undefined`, downstream renderers fall back to
  hard-coded strings.

The audit could not find a UI surface that exposes "vocabulary unavailable"
to the user or to QA. The only signal is a console warning at first miss.

---

## 8. Routes that don't participate in interest-aware labeling at all

These screens read `useInterest()` directly but never consult vocabulary:

- `app/(tabs)/learn.tsx:90-104` — segments, course headers (`'Coaches'`,
  `'People'`, `'Courses'`/`'Training'` toggle by slug equality).
- `app/(tabs)/discover.tsx` (sampled, not exhaustively read this pass) —
  feed copy uses `currentInterest?.name`/`slug` directly.
- `app/race/[id]/…` — uses event config from `useInterestEventConfig`, not
  vocabulary, so any race-flow label change must be made in the per-interest
  config file, not the DB.

Pass 3 (step component) will dig deeper into the step-screen variant of this.

---

## Summary of citations (file:line)

- `lib/vocabulary.ts:16, 24, 30-46, 52-68, 70-86, 88-102, 104-118`
- `lib/navigation-config.ts:40-48, 58-70, 77-145, 99-107, 109-115, 118-119,
  152-158, 164-168, 198-244`
- `app/(tabs)/_layout.tsx:134-137, 163-169, 172-177, 267, 1519`
- `lib/utils/userTypeRouting.ts:51`
- `components/navigation/WebSidebarNav.tsx:54-57`
- `components/navigation/NavigationDrawer.tsx:189, 548, 825`
- `app/__tests__/secondary-packs-route-api.contract.test.ts:9, 19`
- `app/(tabs)/learn.tsx:90-104`
- `hooks/useInterestEventConfig.ts:18-23`
- `configs/nursing.ts:916-942`
- `configs/index.ts` (lookup map)
- `hooks/useVocabulary.ts:1-79`
- `docs/ai/wip-backup.patch:85-88, 9712-9865, 13482-13494` (uncommitted fix
  draft confirming the gap is already known internally)

---

## Carry to synthesis (Pass 8)

Items that will need P0/P1/P2 sizing in `00-SYNTHESIS.md`:

1. `(tabs)/_layout.tsx:135` does not pass `workspaceContext`. Mobile tab bar
   never shows program-workspace labels — a JHU demo blocker for any flow that
   starts in `/(tabs)`.
2. `app/(tabs)/learn.tsx:100` hard-codes `'Coaches'`. Nursing should read
   "Preceptors". Single-file change, no behaviour impact.
3. `configs/nursing.ts:919` keeps `'Shift Log'` independent of vocabulary;
   verify product intent before unifying.
4. `useInterestEventConfig.ts:20` defaults to `sail-racing` — sailing leak for
   any user without a resolved interest.
5. Legacy `case 'coach'` arms in `lib/navigation-config.ts` and the dedicated
   redirect in `(tabs)/_layout.tsx:163-169` are inconsistent with the
   "coach persona deprecated" comment.
6. Vocabulary key set (15 keys) is too small to drive the full tab bar; either
   expand it or move per-tab labels into `configs/{interest}.ts`.
7. `getCurrentSectionName` in `NavigationDrawer.tsx:825` omits
   `workspaceContext`, causing header/sidebar mismatch.
