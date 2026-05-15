11. **`/step/[id]` vs `/race/ios/[stepId]` detail-surface split.** Today there are two different detail surfaces for the same underlying step:

   - **`/step/[id]`** — the deep-edit surface with the full feature set: comments, sharing, collaborators, AI extraction, and other legacy step-management affordances. It is still reachable from older entry points.
   - **`/race/ios/[stepId]`** — the iOS register Race Prep detail surface. After the Race Prep cards cutover, this becomes the new canonical tap target from cards. It is intentionally lighter and more composed than `/step/[id]`.

   **Question:** do these surfaces merge, diverge, or coexist?

   - **Merge** — `/step/[id]` also flips to an iOS register full-surface and somehow absorbs the full feature set. This requires designing iOS-register treatments for comments, sharing, collaborators, AI extraction, and any other deep-edit affordances that currently live only on the legacy surface.
   - **Diverge** — `/step/[id]` stays legacy as a power-user or management surface, while `/race/ios/[stepId]` is the canonical user-facing detail surface for new Race Prep entry points. Two surfaces, two jobs.
   - **Coexist for now** — defer the decision, accept the split, and revisit after production usage shows whether people actually discover and depend on `/step/[id]` through non-card entry points.

   **Why this matters:**

   - Architecture decision #4 answered the summary-vs-detail question. This is a different architecture question: when there are **two detail surfaces** with different feature density, what is the rule?
   - User-visible behavior can get confusing: a card tap goes to the lighter iOS detail surface, while another menu path may still open the deeper legacy detail surface.
   - Feature parity stays unresolved. If `/step/[id]` remains editorial/legacy while Race Prep detail goes iOS-native, the register is only partially applied across the Race tab.

   **When to revisit:** after the Race Prep cards cutover has been live in production long enough to observe whether users find and use `/step/[id]` from non-card entry points, and whether those entry points still matter enough to justify a second full-surface migration.
