# Get Inspired iOS — Running State

## Context
Get Inspired iOS already has two designed states: the empty state before a link is dropped, and the filled state once the user has provided a link and the CTA is enabled. This brief covers the missing third state: the running state shown after the user submits the link and BetterAt is actively building a practice plan from it through the Claude API. This is the first surface where the loading-state narration principle needs to become an explicit designed state rather than an implementation detail.

## When this state is shown
- Show this state immediately after the user submits a link from the filled CTA state
- It stays on screen while BetterAt is reading the link, extracting the practice signal, and generating the first structured plan
- This is specifically the in-between state during Claude API plan generation
- The user should feel that the system is alive, specific, and making progress on this exact link

## Voice rules
- Present continuous
- Plain language
- No exclamation marks
- No progress percentages
- No vague "Loading..." copy
- No indeterminate spinner as the primary communication
- The system narrates what it is doing in human terms
- The line should always feel specific to the task of turning a link into a practice plan

## Concrete narration sequence
Use a sequence of short messages that replace or gently scroll as the pipeline advances. Proposed sequence:

- Reading the link
- Finding the practice in it
- Pulling out the useful details
- Drafting your plan
- Shaping the first step

Optional alternates if design needs slightly different cadence:
- Understanding what is worth practicing
- Turning it into something you can try

The messages should feel calm, specific, and procedural rather than theatrical.

## Visual treatment guidance
- This remains the same modal sheet surface at iPhone 16e width, 393pt
- Keep the overall sheet structure stable so the state change feels like a transition within the same flow, not a hard mode switch
- The submitted link stays visible and static as the anchor
- The CTA area becomes the narration area or sits directly above it
- The narration should be visually prominent enough to carry the state, but not oversized or dramatic
- Typography should follow the iOS register: SF Pro, clear hierarchy, platform-native restraint
- Motion should be one of:
  - gentle replace/fade between lines, or
  - short vertical scroll/slide as one line yields to the next
- Motion should be quiet and intentional, not flashy
- Avoid spinner-centric loading chrome
- If a secondary progress indicator exists at all, it should be subordinate to the narration line, not the main event
- Keep enough static elements visible that the user still feels located in Get Inspired:
  link field/snapshot, sheet title, close affordance, and overall sheet frame

## Error fallback within this state
If the Claude API call fails while in the running state, the surface should transition into a plain-language error treatment that follows the error-state principle.

The user should see:
- what happened, in human terms
- what they can do next

Example fallback copy direction:
- We couldn't build a plan from that link just now. Try again in a moment, or paste a different link.

Avoid:
- error codes
- technical jargon
- "Something went wrong"
- dead-end failure states

The fallback should keep the user's submitted link visible if possible, so retry feels lightweight rather than punitive.

## Deliverable specification
- Design the running state for Get Inspired iOS as a 393pt-wide iPhone 16e modal sheet
- Show the surface mid-sequence while BetterAt is actively generating the plan
- Include at least one visible narration line from the proposed sequence
- Side rail commentary must explain:
  - why narration is the primary loading treatment
  - the voice rules
  - why the motion is replace vs scroll
  - what remains static to preserve orientation
  - how the error fallback should behave if generation fails
