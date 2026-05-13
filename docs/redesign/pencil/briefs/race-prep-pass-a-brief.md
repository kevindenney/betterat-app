Pass A: Race Prep — Race 4 (iOS register, Journal as primary reference)

Build a Race Prep surface for Felix, a sailing app user preparing
for Race 4 of the Spring Series at RHKYC. Use tokens from
design-system.pen — every color and type size maps to an existing
token.

Visual register: iOS-native, anchored on Apple Journal (capture-and-
reflection app with structured entries, photo-embedded prose,
insights, prompts). Secondary references: Apple Weather (atmospheric
tile pattern), Apple Books (curated-shelf treatment, for later
surfaces).

TYPOGRAPHY: SF Pro throughout. Large title 32–34px regular for
surface titles. Section headers 22px semibold. Body 17px regular.
Captions and metadata 13–15px secondary label color. No serif. No
italic for utterance.

SURFACE: System gray 6 ($ground-neutral) base. Content lives in
white rounded-rect cards floating on gray. Cards have soft 1–2px
y-offset shadows, ~5% black, 8px blur, 16px corner radius (Journal's
pattern). The forecast section gets a subtle atmospheric tint
behind the cards (very low saturation cool slate, ~5% sat, for
18–22 knot NE conditions) — Weather's atmospheric move scoped to
the data section only, not the whole surface.

ACCENTS: $ios-blue for primary user actions and active states.
$ios-coral for AI prompts/questions and marked content (the
permission rule earns coral because it's marked content the user
committed to). Two accents, two jobs, never blur into one role.

TOP CHROME: Minimal — back chevron left, search glyph and three-dot
overflow right. Each 22px regular weight, $text-secondary.

TITLE BLOCK (Journal's "All Entries / Today" pattern):
- Eyebrow ALL-CAPS: "SATURDAY · IN TWO DAYS" — SF Pro 11px semibold,
  $text-secondary, 0.5px letter-spacing
- Large title: "Race 4 in 18–22 knots northeast" — SF Pro Display
  32px regular, $text-primary, left-aligned
- Metadata block (SF Pro 15px $text-secondary, two lines):
  "Heavy-air helm work · Week 7 of 12"
  "Spring Series · RHKYC · 14 boats"

Generous 32px breathing room below before content begins.

FORECAST TILE GROUP — Journal-style horizontal row, sits on
atmospheric tint:
- Four tiles: WIND, SEA, TIDE, SKY
- Each rounded-rect white, 16px corners, soft shadow, ~22% width
  with 8px gaps
- ALL-CAPS label top: SF Pro 11px semibold $text-secondary
- Large value: SF Pro Display 22px regular
- Small secondary line below
- SF Symbol glyph 17px top-right, $text-secondary
Values:
- WIND: "18–22 kn" / "NE, gusts 28" / wind-direction arrow
- SEA: "1.2 m" / "Building" / wave glyph
- TIDE: "Falling" / "LW 14:08" / tide-arrow glyph
- SKY: "Partly cloudy" / "Cloud lifting" / sun-with-clouds glyph

Provenance line below: SF Pro 13px $text-secondary —
"RHKYC weather · updated 8:00 am."

WORKING-ON CHIPS — Journal-style tag pills, system gray 5 fill,
no border, SF Pro 13px regular:
- Pill 1: figure-running glyph 13px $ios-blue, "Heavy-air helm
  work", small "practicing" suffix in $ios-blue at right edge
- Pill 2: small $ios-coral dot 6px (active-practice signal), quote-
  bubble glyph 13px $ios-coral, "Trust the shift, not just the side"

FROM YOUR LAST RACE — Journal-style quote cards, two cards
horizontal or vertical:
Card 1:
- White rounded-rect, 16px corners, soft shadow
- Body SF Pro 17px regular $text-primary with proper double-quote
  punctuation: "The mistake wasn't the plan, it was not updating it
  when the breeze told me to."
- Below quote: small mic SF Symbol 13px $ios-blue (signals spoken)
- Provenance foot: "Race 3 Debrief · Sunday morning" SF Pro 13px
  $text-secondary
Card 2:
- Same structure
- Body: "Trust the shift, not just the side."
- Small lightbulb SF Symbol 13px $ios-blue
- Provenance: "First time you used these words. Wednesday."

Section eyebrow above: "FROM YOUR LAST RACE" — SF Pro 11px
semibold ALL-CAPS $text-secondary.

THE NAMED BEATS — Journal-entry treatment, three white cards
stacked vertically with 16px gaps, each card:
- Section header inside card top-left: "Start" / "First beat" /
  "Contingency" — SF Pro 22px semibold $text-primary
- Thin 1px iOS-separator rule beneath, edge-to-edge of card
- Body prose SF Pro 17px regular, line-height 1.45, $text-primary
- Embedded photos render as rounded-rect 240×135 thumbnails
  wrapping with text (Journal photo-in-entry treatment)

Start card body: "Pin end is favored by about 8°. Boats will pile
up there. Plan to start one boatlength to leeward of pin, accelerate
at -10 and punch into clear air on starboard." Include embedded
photo: "START LINE · 13:55" thumbnail wrap-right.

First beat body: "Right side is paying in this breeze. If the left
fills in past ten degrees on starboard, I commit and tack."

Contingency body: "If I'm behind at the windward mark, focus on
speed not tactics. Don't try to dig out — make up boatlengths
downwind." Inside this card, render the permission rule as an
inline callout:
- White inner card, no shadow
- 3px $ios-coral left border, full-height
- Small flag SF Symbol top-left, $ios-coral 17px
- Rule text SF Pro 17px semibold $text-primary: "If the left fills
  in past ten degrees on starboard, I commit."
- Eyebrow above rule: "YOUR RULE" SF Pro 11px semibold ALL-CAPS
  $ios-coral

FROM YOUR PLAYBOOK — Journal-style coral prompt card:
- Rounded-rect, $ios-coral fill at 12% opacity, no border, 16px
  corners
- Sparkles SF Symbol top-left, $ios-coral 17px
- Eyebrow: "FROM YOUR PLAYBOOK" SF Pro 11px semibold ALL-CAPS
  $ios-coral
- Body SF Pro 17px regular $text-primary, with italic for the
  quoted concept name (italic here is quotation-mark substitute,
  not voice-grammar): "You've written about 'Trust the shift, not
  just the side' in three reflections since March. Want to open
  it as a concept and bring its accumulated notes into this race's
  prep?"
- Two buttons at bottom: filled iOS-style "Open as a concept"
  ($ios-blue background, white text, rounded-pill), text-only
  "Not now" ($ios-blue text, no background)

CREW LIST — Journal-style person list:
- Eyebrow: "WHO'S ON THE BOAT" SF Pro 11px semibold ALL-CAPS
  $text-secondary, with "3 on Moonraker" small right-aligned
  secondary text on the eyebrow line
- Three rows: circular avatar 40px left, name SF Pro 17px regular
  $text-primary, role SF Pro 15px $text-secondary, chevron right
- Rows: Sam Cooke · Tactician / Jess Reilly · Trimmer / Danny
  Mok · Bow

COMPOSER TOOLBAR — Journal's bottom cluster (composition surface,
modality-equal):
- Prompt above: "Anything else you want to think out loud about?"
  SF Pro 17px regular $text-primary, left-aligned
- Horizontal row of SF Symbol buttons, ~40px tappable target,
  ~22px glyph at $ios-blue: list-bullets, camera, photo-library,
  audio-waveform, location-pin, sparkles
- This is a toolbar, not a hero — capture is one of several
  actions, user picks the modality

FLOATING FOUR-TAB NAV:
- iOS material translucent pill at 22px from bottom
- SF Symbol glyphs: anchor (Race), book (Playbook), globe
  (Discover), clock-arrow-backwards (Reflect)
- Tab labels SF Pro 10px
- Active tab (Race): $ios-blue tint on icon and label
- Inactive: $text-secondary

iPhone frame: 393×852 (iPhone 15 Pro standard).

ARCHITECTURAL COMMITMENTS:
- Component grammars preserved (live dot = active practice within
  step surface)
- AI never speaks as itself
- Named absences: no gamification, no streaks, no progress
  percentages
- Composition surface principle: toolbar composer not hero mic
- Two-accent system: $ios-blue for user action, $ios-coral for AI
  + marked content
- Italic returns only for literal voice transcription (not used on
  this surface — Race Prep has no voice transcription content)