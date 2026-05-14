# Visual Redesign Gap — Secondary Surfaces

**Status**: written gap analysis, no code changes
**Generated**: 2026-05-14
**Source mockups**: none yet — `docs/redesign/mockups/` covers step detail only (01–16 are all step-flow surfaces)
**Source spec**: `docs/redesign/betterat-redesign-spec.md` §11 (palette + typography) and §10.2 (no AI persona). Visual targets here are *inferred* from those spec sections by applying the same token system the step-detail audit operationalised (`docs/audit/visual-redesign-gap-step-detail.md` §2.4 / §2.5).

This audit picks up where the step-detail audit left off: it explicitly scoped commits 1–6 to the step detail screen (the open-step modal + the carousel-card variant). Everything reachable *outside* that view — the four bottom-nav tabs other than the active step — still uses the pre-redesign Ocean Blue + forest-green palette plus the legacy bold-sans hierarchy.

The four surfaces in scope:

1. **Activity** (`app/social-notifications.tsx`) — the inbox/notifications screen reached from the bell icon in the top bar
2. **Playbook** (`components/playbook/PlaybookHome.tsx`) — per-interest playbook view (the second of four tabs)
3. **Reflect** (`app/(tabs)/reflect.tsx`) — the fourth tab, progress + session log + profile
4. **Session list chrome** (`components/cards/content/RaceSummaryCard.tsx` header + `app/(tabs)/races.tsx` page shell) — the timeline-card status chips, action pills, and FAB on the first tab. The *step content* inside each card is already redesigned; this is everything wrapping it.

Other secondary surfaces noted but **out of scope** for this audit: auth/onboarding flow (Welcome back, Sign-in, Continue with phone), Discover tab, Settings, organization/coach back-office screens, landing pages. Each will need its own audit pass.

---

## 1. Current state

### 1.1 Activity (`app/social-notifications.tsx`, 500 lines)

The Activity screen is the unified notification inbox surfaced from the bell icon. Two view modes: Grouped (default) and All (raw).

**Chrome (sans, system iOS colors)**:
- Page header — sans bold 28pt "Activity" + "Mark All Read" link (`IOS_COLORS.systemBlue` `#007AFF`)
- View-mode toggle pills "Grouped / All" — selected pill fill `IOS_COLORS.systemBlue` (`social-notifications.tsx:810,844`), unread badge same color (`:930`)
- Section headers "Messages" / "This Week" / "Earlier" — sans bold ~17pt
- Backgrounds: `IOS_COLORS.systemGroupedBackground` (`#F2F2F7`) for page, `secondarySystemGroupedBackground` (`#FFFFFF`) for cards
- "See All" link on Messages section — blue

**Notification rows**:
- Each notification has a circular icon-bg colored per type (`social-notifications.tsx:42-51`): heart=red, comment=blue, share=violet, tuning-guide=amber, race-result=green, event=pink, check-in=teal, mention=indigo, new-post=gray. Custom palette per notification kind.
- Avatar fallback bg `:628` is a per-user hashed color
- Title sans bold 15pt, subtitle sans regular 13pt secondaryLabel

**Status**: 0% redesigned. No serif, no `STEP_PALETTE`/`text.*` recipe, no neutral chrome. All blue accents are legacy `systemBlue`.

### 1.2 Playbook (`components/playbook/PlaybookHome.tsx`, 384 lines)

The Playbook view (second tab). Renders sections in order: Vision card, This Week's Focus card, Suggestions list, Concepts list, etc.

**Already redesign-aligned**:
- "THIS WEEK'S FOCUS" eyebrow uses `text.sansEyebrow` style — uppercase, tertiary tan, letter-spaced (matches mockup pattern from step detail commit 4)
- Card structure: `bgPrimary` cards on `bgSecondary` page background

**Legacy elements remaining**:
- Page-level header "Playbook" — sans bold, no serif treatment
- Top-right action cluster: share icon (blue), `+` icon (blue), Sparkles icon (blue), avatar (blue circle)
- "Drawing" interest selector dot — red (legacy interest-color palette, not the `STEP_PALETTE.textInfo` violet the redesign wants for interest accents)
- "7 pending suggestions" greyed header bar — no eyebrow treatment, just plain greyed sans
- "Accept focus" button — light-blue fill (legacy systemBlue tint), not `STEP_PALETTE.ctaBg` charcoal
- "Edit" / "Dismiss" secondary buttons — sans on neutral, look right but should be confirmed against spec
- Card titles ("Add details to 'draw water' debrief:", "Vision") — sans bold 17pt, should be serif per the redesign body-prose rule from §3.3
- Card body prose ("What happened? What was learned?", capability descriptions) — sans 15pt, should be serif 16–17px per audit §2.3
- Card source line "From weekly review · Mon, May 11" — sans tertiary, looks acceptable

**Status**: ~25% redesigned (eyebrow recipe applied, palette tokens used on some surfaces). The card-internal typography and the CTA button treatment are the biggest gaps.

### 1.3 Reflect (`app/(tabs)/reflect.tsx`, 1203 lines)

Reflect tab — three-tab sub-control (Progress / Session Log / Profile). Progress view is what the screenshots show.

**Already redesign-aligned**:
- "Working On / All / Needs Attention" pill bar — Working On pill is rendered in dark/charcoal fill, matching `STEP_PALETTE.ctaBg` direction

**Legacy elements**:
- Page header "Reflect" — sans bold, no serif
- "Drawing" interest selector with red dot + share icon + `+` blue circle in top-right
- Three-tab control "Progress / Session Log / Profile" — uses default UISegmentedControl tint, no neutral underline pattern
- Section cards "0% — 0 of 0 capabilities", "This Week" calendar, "Monthly Activities" — sans bold titles, white card on grouped background (legacy iOS pattern, not warm `bgPrimary`/`bgSecondary`)
- "See more of your drawing" — `IOS_COLORS.systemBlue` link (`reflect.tsx:1081`)
- This Week dot legend: Session = blue, Study = green — legacy palette literals
- Pull-to-refresh tintColor — `systemBlue` (`reflect.tsx:170,598,878`)
- Upgrade banner — `#2563EB` Ocean Blue (`reflect.tsx:619,1046,1162`)
- "Coaching Insight" / "AI Coaching Insight" empty state copy (`reflect.tsx:622` — flagged in `project_depersonification_powered_by.md`: this one was already softened to "Insights" but flag here for completeness)

**Status**: 5% redesigned. The Working-On pill is the only redesign-aligned bit; everything else is legacy.

### 1.4 Session list chrome (`app/(tabs)/races.tsx` + `components/cards/content/RaceSummaryCard.tsx` header)

The first tab — timeline list of steps. Step content inside each card is redesigned (step-detail commits 3–6 + the slice that closed this session); this section is about everything OUTSIDE the card content.

**Already redesign-aligned**:
- Page header "Session" — sans bold (acceptable; mockups don't show a serif here)
- Interest selector "Drawing" dropdown
- 4-tab nav: Session / Playbook / Discover / Reflect
- Filter chips "All / Before / During / Done" (`components/step/StepFilterBar.tsx`) — names updated per redesign commit 2/3
- Card title — serif 22pt per fix that landed this session (`bd0def08`)
- Step tabs Before / During / After per the fix that landed this session (`68bbb510`)

**Legacy elements** (visible in the screenshots):
- Status pills inside cards: `Done` (green check), `UP NEXT` (green fill), `IN PROGRESS` (green fill) — all forest-green `#3D8A5A`
- "All" filter chip selected-state — green fill (was forest green); other chips inactive grey
- `+` floating action button (top-right of page) — `IOS_COLORS.systemBlue` blue circle
- Top-right notification bell with red badge — bell icon uses default tint, badge red
- "Bulk Edit" / "Reorder" inline pills under the filter bar — blue fill
- "Next: draw water" status pill — green dot + green text
- Card "Do" CTA button on each TODAY card — green pill
- The `0/2`, `0/7` sub-step progress indicators at bottom of TODAY cards — neutral, acceptable
- TODAY band separator dot/banner — green
- Day-completed checkmark icon in top-left of cards — `IOS_COLORS.systemGreen`

**Status**: card *content* is redesigned (~90%); card *chrome and page chrome* is 10% redesigned — the filter labels got renamed and the title got serif, but every status indicator, CTA, and action button still uses the pre-redesign green + blue accents.

---

## 2. Target state (from redesign spec + step-detail audit token system)

### 2.1 Universal palette (recap from step-detail audit §2.4)

| Token                  | Value      | Use across these surfaces                                        |
|------------------------|------------|-------------------------------------------------------------------|
| `bgPrimary`            | `#FAFAF7`  | page + card surfaces                                              |
| `bgSecondary`          | `#F0EEE8`  | section panels, notification cards inset                          |
| `bgInfo`               | `#E5E1F0`  | playbook-source surfaces, "from playbook" tile, You-avatar bg     |
| `textPrimary`          | `#2A2824`  | titles, body, primary CTA fill                                    |
| `textSecondary`        | `#58544A`  | sub-meta, status text                                             |
| `textTertiary`         | `#8A8478`  | eyebrows, timestamps, section dividers                            |
| `textInfo`             | `#5A4078`  | playbook accent, interest dot replacement                         |
| `borderSecondary`      | `#C8C2B4`  | outlined secondary buttons, tab dividers                          |
| `borderTertiary`       | `#DDD8CA`  | row hairlines                                                     |
| `ctaBg` / `ctaText`    | `#2A2824` / `#FAFAF7` | primary action button (Mark All Read, Accept focus, +) |

No `systemBlue` `#007AFF`, no `systemGreen` `#34C759`, no Ocean Blue `#2563EB`, no forest green `#3D8A5A` on any of these surfaces.

### 2.2 Universal typography (recap from step-detail audit §2.5)

- Page headers ("Activity", "Reflect", "Playbook") — `text.serifSubtitle` 22pt or `text.serifTitle` 28pt depending on hierarchy (the in-app card already uses 22pt for step titles; a top-level tab header earns the larger 28pt)
- Section eyebrows ("MESSAGES", "THIS WEEK", "THIS WEEK'S FOCUS", "MONTHLY ACTIVITIES") — `text.sansEyebrow`, uppercase, tertiary tan, letter-spaced
- Card titles ("Add details to 'draw water' debrief:") — `text.serifBody` 19pt or `text.serifSubtitle` 22pt for emphasis
- Body prose — `text.serifBody` 16–17pt, line-height 1.5
- Chrome labels (tab names, button labels, timestamps) — sans, weight 500, 13–14pt

### 2.3 Per-surface targets

**Activity** — neutral inbox feel matching mockups 02/15's "ambient information" tone:
- Page header "Activity" serif 28pt + "Mark All Read" as a tap target on the right styled in `ctaText` on `ctaBg` rounded pill (or text-only `textPrimary` underline)
- Section eyebrows "MESSAGES", "THIS WEEK", "EARLIER" in `text.sansEyebrow` `textTertiary`
- View-mode toggle "Grouped / All" — neutral underline-on-active or charcoal-fill, no blue
- Notification rows: keep avatar circle but resolve the icon-bg per-type colors to the redesign palette (most current type colors map cleanly: heart→stays expressive red OR shifts to neutral charcoal with a heart glyph; race-result green→`textPrimary` trophy glyph; tuning-guide amber→`textPrimary` wrench). Open decision below.
- Unread badge color: `textInfo` violet `#5A4078` (matches playbook/"You" accent) instead of `systemBlue`

**Playbook**:
- Page header "Playbook" serif 28pt
- Top-right action buttons — neutral icon set, no blue circles; the avatar can stay a colored hash but the share/+/sparkles icons should be `textPrimary` glyphs on transparent
- Interest dot — `textInfo` violet instead of red, or drop the dot entirely and rely on the text label
- Eyebrow on "7 pending suggestions" → `text.sansEyebrow` "PENDING SUGGESTIONS · 7"
- "Add details to …" card title — `text.serifBody` 19pt
- "What happened? What was learned?" body — `text.serifBody` 16pt
- "Accept focus" primary button — `ctaBg` charcoal fill, `ctaText` cream label. "Edit" / "Dismiss" as outlined `borderSecondary` neutral pills

**Reflect**:
- Page header "Reflect" serif 28pt
- Three-tab sub-control "Progress / Session Log / Profile" — plain text + underline-on-active pattern (mirrors mockups 01/02 step-detail tab control), no blue tint
- Capability progress "0% — 0 of 0 capabilities" — card uses `bgPrimary`, eyebrow "CAPABILITIES IN PROGRESS" in tertiary tan
- Working On pill — keep current charcoal treatment ✓
- "This Week" calendar legend dots — Session = `textPrimary`, Study = `textInfo` (or two distinct ink shades within the neutral family, no chromatic colors)
- "See more of your drawing" — neutral link, charcoal underline
- Pull-to-refresh tintColor — `textTertiary`
- Upgrade banner — `bgInfo` lavender card with `textInfo` icon and `ctaBg` charcoal CTA; no Ocean Blue fill

**Session list chrome**:
- Status pills `Done` / `UP NEXT` / `IN PROGRESS` — drop the colored fills, use plain text labels in `textSecondary` (mockup pattern from step detail: status is text, not chip)
- "All" filter chip selected-state — `ctaBg` charcoal fill, `ctaText` cream label (replaces forest-green)
- `+` floating action button — `ctaBg` charcoal circle with cream plus glyph (replaces blue)
- Bell icon — `textPrimary` glyph, red badge replaced with `textInfo` violet badge
- "Bulk Edit" / "Reorder" pills — outlined `borderSecondary` neutral, not blue
- "Next: draw water" pill — `bgInfo` lavender fill, `textInfo` violet text (matches the "from playbook" surface pattern from mockup 06)
- TODAY band separator — `textTertiary` hairline + tertiary text, not green
- "Do" CTA on TODAY cards — `ctaBg` charcoal pill
- Card top-left day-completed checkmark — `textPrimary` glyph, no green ring

---

## 3. Gap analysis

### 3.1 Activity gap — biggest, no redesign tokens used at all

Zero `STEP_PALETTE` or `text.*` recipe consumers in `social-notifications.tsx`. The whole file is `IOS_COLORS.systemBlue` / `systemGroupedBackground` / hardcoded `#FFFFFF` cards. Migration here is essentially "rewrite the chrome and styles from scratch" rather than "swap tokens."

The notification-type icon palette (`social-notifications.tsx:42-51`) is the only legitimately expressive use of color across these four surfaces — heart-red for likes is conventional. Decision needed (§5 below) on whether to keep expressive type icons or render them all in neutral charcoal.

### 3.2 Playbook gap — typography + buttons

The redesign tokens partially landed (eyebrow recipe, palette tokens on background surfaces) but didn't propagate to:
- Card-internal body prose (still sans)
- "Accept focus" primary CTA color (still blue)
- Page header treatment (still bold sans)
- Top-right icon cluster (still blue glyphs)

This is the closest surface to "drop-in redesign" — the structure is right, just needs token substitution.

### 3.3 Reflect gap — half-redesigned at the chip level only

The Working-On pill is the lone redesign-aligned bit. Everything else, especially the upgrade banner at `reflect.tsx:619,1046,1162` and the `IOS_COLORS.systemBlue` on `reflect.tsx:170,598,878,1081`, is fully legacy. The three-tab sub-control needs the most design thought because RN's segmented control doesn't ship with a plain-text+underline variant — we'd either pass `tintColor={textPrimary}` and live with the pill fill, or swap in a custom component.

### 3.4 Session list chrome gap — universal green/blue replacement

The card *content* is redesigned but every status indicator and action button surrounding the content uses the old palette. This is the most visually jarring surface because the redesigned card content sits inside green chrome — you see the new serif title with a green DONE pill above it.

Migration is mechanical (find/replace forest green + system blue with `STEP_PALETTE` tokens) but touches many components. The status pills in particular live inside RaceSummaryCard which is already a 4000+ line file.

---

## 4. Proposed migration sequence

Six independently shippable commits, in increasing order of touch surface. Each leaves the app fully functional.

### Commit 1 — Session list chrome (visual priority)

The chrome wrapping the now-redesigned step content is the most jarring inconsistency users see. Tackle this first.

- Status pills `Done` / `UP NEXT` / `IN PROGRESS` → plain text labels in `textSecondary` (drop the green fill chip entirely)
- "All" filter chip selected fill → `STEP_PALETTE.ctaBg`
- `+` FAB → `ctaBg` charcoal circle
- "Bulk Edit" / "Reorder" → outlined `borderSecondary` neutral pills
- "Next: draw water" pill → `bgInfo` lavender + `textInfo` violet text
- "Do" CTA on TODAY cards → `ctaBg` charcoal
- TODAY band, day-completed checkmark → `textTertiary` and `textPrimary` respectively
- **Visible diff**: session list looks neutral, no more forest-green/blue chrome around the redesigned cards
- **Touch surface**: `RaceSummaryCard.tsx` (already paired-cleaned), `app/(tabs)/races.tsx`, `components/step/StepFilterBar.tsx`

### Commit 2 — Playbook drop-in tokens

The closest surface to "swap and ship":

- Page header → `text.serifTitle` 28pt
- Card title → `text.serifBody` 19pt
- Card body prose → `text.serifBody` 16pt
- Top-right action icons → `textPrimary` glyphs, no blue circles
- Interest dot → `textInfo` violet (or drop)
- "Accept focus" → `ctaBg` charcoal fill
- **Visible diff**: Playbook tab feels coherent with step detail; serif body in cards reads like first-person prose
- **Touch surface**: `components/playbook/PlaybookHome.tsx` + sibling section components (`VisionCard.tsx`, suggestion card component)

### Commit 3 — Reflect drop-in tokens

- Page header → `text.serifTitle` 28pt
- Sub-tab control "Progress / Session Log / Profile" → custom plain-text+underline picker (or pass `tintColor={textPrimary}` and accept the residual pill)
- Capability progress card eyebrow + serif title
- "See more …" link → neutral underline
- Pull-to-refresh tintColor → `textTertiary`
- Legend dots → neutral ink shades
- Upgrade banner → `bgInfo` lavender card + `ctaBg` CTA
- **Touch surface**: `app/(tabs)/reflect.tsx` only

### Commit 4 — Activity chrome

Bigger lift because the file has no redesign tokens today and needs custom palette decisions on notification types.

- Page header serif treatment, "Mark All Read" right action
- Section eyebrows
- View-mode toggle neutral fill
- Backgrounds → `bgPrimary` / `bgSecondary`
- Unread badge → `textInfo` violet
- **Notification type icons**: requires §5 #1 decision — either keep expressive per-type colors (the only spec-permitted exception is `bgInfo` and `textInfo` for playbook-source surfaces, but conventional notification icons may warrant their own exception) or recolor all to charcoal glyphs with the icon alone communicating type.
- **Touch surface**: `app/social-notifications.tsx`

### Commit 5 — Auth flow palette

Out of scope but flagging: the Welcome-back screen still uses Ocean Blue. When the user is making a fresh sign-in or sees the "Plan, Do, Review" tagline, they're seeing the legacy app. Treat as its own audit-and-migration pass.

### Commit 6 — Reflect/Activity "AI Insight" empty states (already done)

Memory note: the depersonification campaign closed most of the in-product AI-persona language. Re-check the empty states under Reflect after commit 3 to confirm no regression.

---

## 5. Open decisions (need user)

1. **Notification type icon palette**. The `social-notifications.tsx:42-51` per-type colors (heart=red, comment=blue, race-result=green, etc.) are a culturally conventional palette — users expect "heart = like = red." Strict redesign §11.6 ("no bright accents") would push these to neutral charcoal. Three options: (a) keep the expressive palette as the *only* place chromatic color is allowed, (b) recolor everything to charcoal glyphs and let the icon shape communicate type, (c) compromise — keep red+green for emotionally-loaded notification types (likes, race results) and neutralise the rest. **Recommendation: (c)**, but it's a design call.

2. **Reflect sub-tab control**. The three-tab "Progress / Session Log / Profile" can either use a custom plain-text+underline picker (matches mockup 01/02 step-detail tab pattern, but requires writing a new component) or accept `IOSSegmentedControl` with `tintColor={textPrimary}` (ships fast, residual pill shape doesn't fully match the mockup aesthetic). **Recommendation**: ship the segmented variant first; a dedicated `RedesignTabUnderline` component can replace it later as part of a design-system PR.

3. **Interest selector dot color**. Today each interest has a color (Drawing=red, Sailing=blue, etc.) shown as a 6px dot next to the interest name. The redesign §11.6 wants the only non-neutral accent to be `textInfo` violet. Options: (a) recolor all interest dots to violet (loses interest distinction), (b) drop dots, just show the name in eyebrow style, (c) keep current interest-color dots as the one expressive-color exception. **Recommendation: (b)** — drop the dot; the interest name + dropdown caret is enough chrome.

4. **"Mark All Read" affordance**. Currently a blue link in the top-right. Three styling options: (a) `ctaBg` charcoal pill (heavyweight for a secondary action), (b) `textPrimary` plain text with hover/press feedback (lightweight, matches mockup chrome density), (c) icon-only (envelope-check glyph). **Recommendation: (b)**.

5. **Status pill removal**. The redesign instinct from mockup 02/15 is that status is rendered as text inline ("Done · 3d ago", "Up next · today") rather than as a colored chip. Confirm the user wants the green/red/orange chips removed entirely vs. just recolored to neutral fills. **Recommendation**: remove the chips, surface status as inline text — chips encode information already conveyed by position in the timeline (above the TODAY band = past = done; below = upcoming).

---

## 6. Risks

- **Notification icon palette decision (§5 #1) blocks Commit 4**. Without a call, the migration either ships an inconsistent neutral chrome on top of legacy colored icons (looks unfinished), or recolors icons in a way that may surprise users used to "like = red heart." Don't ship Commit 4 until decision lands.

- **`IOSSegmentedControl` doesn't accept underline-on-active mode**. If the user wants the mockup-faithful tab control on Reflect, we either write a new component or accept the segmented-pill compromise. The new-component path adds ~3 hours and a design-system PR ahead of the Reflect migration. Flag early.

- **`RaceSummaryCard.tsx` is 4000+ lines and already had 86 pre-existing warnings before the cleanup pass that closed during this session**. Commit 1 will likely re-touch this file — the paired-cleanup pattern from slice V/T/U/X/Y already covers this; budget time for warnings that surface during the chrome changes.

- **The page-header serif treatment may break iOS large-title navigation**. Expo Router's stack defaults give us a navigation bar that renders titles in the system font. If we serif-ize "Activity" / "Reflect" / "Playbook" headers, they may stop matching the iOS-native header in screens that DO use the stack header. Verify whether each of these screens has a stack header (likely they don't — they're tab roots — but confirm).

- **`reflect.tsx` is 1203 lines and likely warning-heavy**. Same paired-cleanup discipline applies. Don't open Reflect changes without budget for pre-existing warning cleanup.

- **Upgrade banner color change has commercial implications**. The Ocean Blue "Upgrade" banner is high-contrast precisely so users see it. A `bgInfo` lavender card with charcoal CTA may convert less. Flag for product/growth review before migrating.

---

## 7. Top 3 things to pay attention to when reviewing this audit

1. **Notification icon palette is the one place where strict §11.6 ("no bright accents") conflicts with platform/UX convention.** All other surfaces have a clean neutral target; this one requires a product call that should happen before Commit 4 starts. The recommendation above is "keep red+green for emotionally-loaded types, neutralise the rest" but design has the last word.

2. **The "Plan, Do, Review" tagline on the sign-in screen still uses the old phase verbs.** I called this out in the user-screenshot review and it lives in the auth flow which is out of scope here, but flagging again so it doesn't get forgotten — when the auth pass happens, "Plan, Do, Review" → "Before, During, After" to match the rest of the app.

3. **Commit 1 (session list chrome) is the highest-impact visible change with the lowest design risk.** Forest-green status chips wrapping serif-titled cards is the most jarring inconsistency in the current app. If the user wants a fast win that visibly shifts the feel of the most-used surface, ship Commit 1 first and decide on the rest later.
