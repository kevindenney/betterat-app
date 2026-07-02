/**
 * /welcome — legacy first-run route, now an alias for the value funnel.
 *
 * The native hero → how-it-works → interest-picker stack that lived here was
 * retired in favor of the single pre-signup intro shared with the web
 * landing: pick your craft → see the Plan/Do/Review loop in that craft's
 * vocabulary → create account. Old entry points (org-page signup CTAs,
 * bookmarks) still land here, so the route stays alive as an alias.
 *
 * Re-export, not a redirect: <Redirect> during the initial mount races the
 * value stack's route resolution on web (the URL settles on the
 * alphabetically-first sibling /onboarding/value/loop while pick-craft
 * renders), and router.replace in an effect fires before the Root Layout is
 * mounted on a cold load ("Attempted to navigate before mounting…").
 * Rendering the screen directly at /welcome has no race; its Continue
 * button pushes absolute funnel routes, so the flow proceeds normally.
 */

export { default } from './onboarding/value/pick-craft';
