# Profile iOS

## Context
Profile iOS is the third sub-tab under Reflect, alongside Progress and Race Log. Progress is the quantitative surface: stats, counts, movement, return patterns. Race Log is the chronological surface: what Felix actually did, in sequence, across races and practice moments. Profile is the identity surface: who this account belongs to, which interests are active, and how BetterAt is configured around the person using it. This screen should feel operational and calm rather than interpretive. It sits inside the same iOS register family, but this is the place where the register deliberately steps back and lets platform convention lead.

## What this surface does
- Shows Felix's account identity clearly and without ceremony
- Makes active interests visible, especially Sail Racing, with room for secondary interests like Fitness
- Lets Felix inspect and lightly edit core identity fields
- Surfaces BetterAt-relevant preferences without collapsing into a generic settings dump
- Shows subscription or plan state if that exists in the product
- Provides access to account-level actions like support, privacy, sign-out, and related utility actions

## Sections to include
- Hero
  Avatar, full name, and member-since line. This should feel like an iOS account header, not a branded hero module.
- Interests
  Active interests as chips. Use realistic Felix content with `Sail Racing` primary and `Fitness` secondary.
- Identity
  Inline-editable rows for core identity fields such as display name, email, home club/affiliation if useful, and possibly timezone/locale if that matters to scheduling.
- Preferences
  BetterAt-specific preferences only: notifications, capture defaults, reminders, or similar account behaviors tied to product use.
- Subscription
  If applicable, current plan, billing/manage-subscription entry, and lightweight plan status.
- Account
  Support/help, privacy/legal, sign out, and any sensitive account-management entries.

## Density guidance
- Use standard iOS settings density
- Group content into grouped list sections or white cards on system gray 6
- Use system separators and familiar row heights
- This is where the BetterAt register defers most strongly to platform convention
- Prioritize clarity, scanability, and low cognitive load over expressive composition
- The surface should feel native first, branded second

## What this surface explicitly is NOT
- Not over-designed
- Not a contemplative hero surface competing with Reflect home
- Not faculty-density
- Not a settings dump with endless toggles
- Not an attempt to make utility chrome feel profound
- Not visually louder than Race Log

## Earned register exception assessment
- None
- This is utility chrome
- No weight-up element
- No oversized controls
- No special visual exception beyond standard iOS hierarchy

## Deliverable specification
- Design a canonical iOS-register Profile surface for iPhone 16e width at 393pt
- Use realistic Felix content:
  Felix Denney, member since date, `Sail Racing` and `Fitness` interests, Royal Hong Kong Yacht Club context where relevant
- Make the account believable as a real BetterAt user account, not placeholder settings filler
- Include side rail commentary covering:
  - where the register defers to platform convention
  - where the register still asserts itself subtly
  - why this surface is intentionally less visually interesting than Race Log
- Deliver it in the same handoff style as the other iOS-register surfaces:
  fully composed screen, realistic content, and explicit commentary for engineering
