-- Widen organizations.interest_slug allow-list to cover golf and entrepreneur.
-- These are valid `interests.slug` values, but the CHECK predated them, so
-- org-per-interest tagging (Library Orgs zone filters org.interest_slug ===
-- interestSlug) could never surface a golf or entrepreneur org.

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_interest_slug_check;

ALTER TABLE organizations ADD CONSTRAINT organizations_interest_slug_check CHECK (
  interest_slug = ANY (ARRAY[
    'general',
    'nursing',
    'sail-racing',
    'golf',
    'entrepreneur',
    'drawing',
    'design',
    'fitness',
    'health-and-fitness',
    'knitting',
    'fiber-arts',
    'painting-printing',
    'lifelong-learning',
    'regenerative-agriculture',
    'global-health',
    'self-mastery',
    'lac-craft-business',
    'food-processing',
    'textile-weaving',
    'college-career-planning'
  ])
);
