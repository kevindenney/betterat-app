# BetterAt Redesign — Addendum 6, May 13 2026 (morning)

PRADAN context as a first-class case. The development sector reveals architectural extensions the platform needs: people-as-knowledge-nodes, financial state, scheme tracking, inventory, and SHG groups with financial overlay. Plus a more disciplined position on equipment tracking by interest.

---

## 1. Why PRADAN matters more than initially weighted

Four reasons:

1. **Scale**: NRLM (which PRADAN connects to) touches 90M+ rural women. A single institutional contract dwarfs sailing club and academic cohort sizes.

2. **Strategic distinctness**: The sailing case proves architecture for affluent individuals. The nursing case proves it for institutional academia. PRADAN proves it for institutional development — a fundamentally different market with different economics, infrastructure, content, and success metrics.

3. **Mission alignment**: If BetterAt is genuinely a "deliberate practice platform," the development sector test is the most honest one. A platform that works for Mikkel but not Sunita is a fundamentally different platform than one that works for both.

4. **Sustainable revenue**: Per-beneficiary fees from state governments and donors are durable across economic cycles. Aligned with mission-driven funders.

This case shouldn't be treated as a "we'll get to it later" market. It should shape architecture decisions now.

---

## 2. New architectural primitives needed

PRADAN context introduces three primitives the current architecture doesn't have:

### Inventory / quantity tracking
Sunita has raw lac stockpile, finished bangles by style/size, dye supply, working capital cash. She needs to track quantities across time.

Not present in the current architecture. Needs:
- Inventory items as countable entities
- Quantity changes tied to specific events (bought 2 kg from Munnu, sold 12 bangles at the haat)
- Aggregation views (how much raw lac left, finished pieces by category)
- Light forecasting (will I run out before the festival?)

This is a new sub-section of the playbook for users in interests that need it.

### Financial state
Sunita is running a tiny business. She needs to track:
- Cash on hand
- Receivables (buyers who'll pay later)
- Payables (suppliers extending credit, like Munnu's 15-day terms)
- SHG group savings (her stake)
- Loans (Mudra, repayment schedule)
- Working capital flows

This is the most consequential new primitive. It's not optional decoration — for development context users, financial state IS the practice context.

Architectural shape: a "money" tab (पैसा in Hindi) as a fifth functional area, available when the interest has financial dimensions. Sunita sees it; Mikkel doesn't.

### Schemes and benefits
Mudra loan, PM Vishwakarma, e-Shram, PMJDY, state-level schemes, federation programs. Each has:
- Eligibility criteria
- Application process
- Status (eligible / applied / approved / receiving / completed)
- Benefit flow (loans, grants, subsidies, training)
- Repayment or compliance obligations

Architectural shape: schemes-as-knowledge-nodes — similar to orgs but with specific properties (eligibility checking, application tracking, status flow).

---

## 3. Existing primitives, specialized

PRADAN context also drives heavy use of existing primitives with development-specific specialization:

### People-as-knowledge-nodes (suppliers, buyers, peers)
Sunita knows Munnu (supplier), Sushil (occasional supplier), Manisha (CRP), Radha (treasurer), Saraswati (group president). Each is an entity she accumulates knowledge about over years.

The architecture already has people in profiles. What's new: **non-platform people as knowledge nodes**. Munnu doesn't have a BetterAt account. Sunita's knowledge about Munnu is hers, not Munnu's. She can record price history, quality patterns, payment terms, personal notes ("Munnu's son got married last month — be polite").

This is parallel to the local-knowledge-maps architecture but for people instead of places.

### Group with financial overlay
The standard group unit (designed in Addendum 5) is mostly social/practice-focused. SHGs have an additional layer: **shared financial state**.

The SHG view I designed shows:
- Group corpus (₹48,200)
- Member contributions ("your savings: ₹4,200")
- Inter-member loans outstanding (₹12,500)
- Available pool (₹35,700)

This financial overlay is opt-in per group. Mikkel's crew doesn't have it. Sunita's SHG does. Emily's clinical pod doesn't. A future Italian wine-tasting group might.

### Place-as-knowledge-nodes (markets)
Hatia market is a place. Like Victoria Harbour for Mikkel, it accumulates knowledge — which shops are where, seasonal patterns, days that pay well. Sunita's accumulated wisdom about Hatia is structurally identical to Mikkel's wisdom about Victoria Harbour.

The vocabulary differs ("बाज़ार" vs. "racing area") but the architecture is the same.

---

## 4. Equipment tracking — revised position

The earlier "opt-in module per interest" framing was too uniform. The actual answer differs sharply by interest:

| Interest | Equipment importance | Right shape |
|---|---|---|
| Sail racing | **Critical** | Full equipment-as-concept with maintenance log, performance correlations |
| Cycling, photography, woodworking | **High** | Full equipment-as-concept |
| Golf | **Medium** | Per-club performance tracking (simpler than equipment-as-concept) |
| Music (with multiple instruments) | **Medium-high** | Equipment-as-concept |
| Nursing | **Not needed** | Module not activated |
| Drawing | **Not needed** | Module not activated |
| Writing, language learning | **Not needed** | Module not activated |
| Rural livelihoods (Sunita) | **Partial overlap** | Mostly served by people-as-nodes (suppliers), techniques-as-concepts, and inventory primitive |

### What this means for build sequencing
1. Build equipment-as-concept fully for sailing (highest conviction, clearest needs)
2. Validate with real Dragon sailors
3. Extend selectively — don't build for all interests uniformly
4. For PRADAN context, build inventory + people-as-nodes + financial primitives instead of equipment

### What to NOT build
A "universal equipment module" available across all interests. This would be over-engineered for most cases and under-engineered for the ones that matter. The right pattern is interest-specific specialization of generic primitives (knowledge nodes that accumulate over time, financial state where applicable, etc.).

---

## 5. PRADAN-specific UX considerations

### Voice-first is not optional, it's primary
Sunita types slowly in Hindi on a phone keyboard. Voice is dramatically faster and more natural. The voice-first commitment that's good practice for Mikkel is *essential* for Sunita.

The home surface should default to a large mic button. Text input is secondary.

### Devanagari typography with proper care
Hindi rendering needs:
- Proper font selection (Lyon Display has Devanagari, or pair with Tiro Devanagari Hindi)
- Appropriate sizes (Devanagari often reads better slightly larger than Latin script)
- Tested character rendering (compound characters, conjuncts)
- Right line-height for the script's vertical proportions

This is real localization work, not a translation overlay.

### Connectivity assumptions
Patchy 3G/4G. Many users on 2G in some regions. WhatsApp is the primary digital surface for many. The app must:
- Work fully offline with sync-when-possible
- Compress media aggressively
- Cache critical surfaces (home, recent steps, group view)
- Defer heavy AI synthesis to opportunistic sync windows

### WhatsApp as primary, not optional
For Sunita, WhatsApp bot capture is not a convenience — it's the primary interaction mode. She may use the app once a week to review what she's captured via WhatsApp throughout the week.

### CRP (Community Resource Person) as structural mentor
Manisha Lakda visits Sunita's village. She's PRADAN-employed (or sometimes federation-employed). She mentors multiple SHGs across multiple villages. She's structurally important to the practice.

The CRP role:
- One-to-many mentor (like a path author but more local)
- Visits in person, not just digitally
- Has direct messaging access (gated to her assigned villages)
- Can author content (training materials, scheme explanations)
- Sees aggregate patterns across her assigned groups

Architecturally she's a path author + a real person who knows users in person. The premium 1:1 tier doesn't apply (her time is institutionally compensated). The relationship is durable across years.

---

## 6. Cohort/group structure for PRADAN

The hierarchy:
- **Self**: Sunita as an individual
- **Family/household**: implicit, sometimes economically integrated
- **SHG**: 10-20 women in the village (Sunita's "Saraswati Mahila Mandal")
- **Village Organization (VO)**: 8-15 SHGs at village level
- **Cluster-level Federation**: 30-80 VOs at block/cluster level
- **Implementing partner (PRADAN)**: the NGO
- **State Mission (JSLPS)**: state government program
- **NRLM**: national program

Most users will operate at SHG level primarily. VO and Federation are visible but not daily. PRADAN appears as an org that publishes paths and assigns CRPs. JSLPS and NRLM are visible as scheme sources.

The product needs to make this layered structure *legible* without making it overwhelming. Sunita opens the SHG view and sees her group; tapping the "PRADAN supported" tag reveals the broader structure for those who want to understand it.

---

## 7. New mockups added (this session)

- Sunita's home (Hindi voice-first conversational surface) — `betterat_sunita_home_hindi`
- Supplier knowledge node (Munnu's shop with price history, seasonal quality patterns, group intelligence) — `betterat_supplier_node_munnu_shop`
- SHG group view with financial overlay (Saraswati Mahila Mandal) — `betterat_shg_group_view_sunita`

All described in this addendum but not yet saved as standalone HTML; see conversation transcript for full widget code.

---

## 8. What these mockups commit to

### The fifth functional area
Sunita's home shows **पैसा (money) as a fourth quick-access tab** alongside काम (work/practice), सीख (learn/playbook), समूह (group). The four-tab navigation we settled on globally doesn't apply uniformly — for development context, money is structural enough to warrant its own primary location.

### People-as-knowledge-nodes
The Munnu's shop surface establishes that non-platform people can be tracked as knowledge nodes the same way places and concepts are. The architecture is consistent: synthesized understanding paragraph, accumulated history, group knowledge surfacing, primary actions.

### Financial overlay on groups
The SHG view establishes that groups can have a financial dimension. Same group primitive, opt-in financial layer. Visual treatment uses the info color to mark structural distinction.

### CRP as a different kind of mentor
The SHG view surfaces Manisha (CRP) as a structurally distinct role from path authors. Persistent across villages, in-person visits, direct messaging access. This is mentor-as-employee-of-the-institution, not mentor-as-paid-creator.

### Hindi typography as first-class
The mockups use proper Devanagari with `'Lyon Display', 'Tiro Devanagari Hindi', serif` font stack. Headers in serif at proper sizes for Devanagari. This treatment is the commitment: Hindi gets the same visual register as English, not a downgraded translation overlay.

---

## 9. Decisions locked

- **PRADAN is a first-class market**, not a future market. Architecture decisions account for it now.
- **Three new primitives**: inventory, financial state, schemes-as-knowledge-nodes.
- **People-as-knowledge-nodes** is a generalization of the existing concept/place node architecture, applied to non-platform people (suppliers, buyers, mentors-by-presence).
- **Groups can have an optional financial overlay** for contexts where shared finances are structural (SHGs, household groups).
- **Equipment tracking is interest-specific**, not universal. Build for sailing first, validate, extend selectively. Do not build a universal equipment module.
- **Fifth functional area "money"** appears for users in interests with financial dimensions. Not present for nursing, drawing, sailing (typically), etc.
- **CRP role** is structurally distinct from path author — institutionally employed, in-person presence, multi-group, durable across years.
- **Hindi typography** is first-class, with proper Devanagari font selection and sizing.
- **Voice-first is essential** for development context, not just preferred.

---

## 10. What's now open

The architecture covers PRADAN. What remains:
- AI prompt engineering for Hindi (synthesis quality, conversational naturalness)
- Specific UX for low-bandwidth modes (degraded image quality, deferred sync windows, offline-first behavior)
- CRP dashboard design (aggregate view across her assigned SHGs)
- VO and Federation surfaces (when users need to engage at those levels)
- Scheme-application flows (Mudra application within the app)
- Inventory tracking UI (count entry, depletion alerts)
- Financial entry UI (income, expense, savings deposit)

These are next-phase. The architecture supports them; the surfaces need design.

---

## End

The PRADAN case has driven architectural extensions that strengthen the whole platform. People-as-knowledge-nodes generalizes a useful primitive. Financial state opens the architecture to small-business contexts beyond development (a freelance designer tracking income, a craft seller, a small-scale farmer). The fifth functional area "money" is opt-in but powerful where it applies.

Equipment tracking has been correctly bounded — sailing-first, not universal. This protects against over-engineering and keeps the architecture clean.

The platform now genuinely supports both Mikkel and Sunita, with the architecture they each need. Different surfaces, different vocabularies, same underlying primitives. This is what universality looks like when it's done with discipline.
