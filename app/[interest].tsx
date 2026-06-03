/**
 * Interest Landing Page (catch-all)
 *
 * Dynamic route for interest slugs without a dedicated folder
 * (e.g. /self-mastery, /lac-craft-business, /food-processing, /textile-weaving).
 * Renders the same marketing surface as the dedicated interest routes, so the
 * Plans section is wired to the real subscribable catalog (/marketplace).
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { InterestBrowserPage } from '@/components/landing/InterestBrowserPage';

export default function InterestLandingPage() {
  const { interest: slug } = useLocalSearchParams<{ interest: string }>();
  if (!slug) return null;
  return <InterestBrowserPage slug={slug} />;
}
