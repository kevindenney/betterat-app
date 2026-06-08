/**
 * Retired: institutional pricing now lives at /schools/pricing (single per-seat
 * calculator with a 25-seat floor). This route redirects there to keep the many
 * existing "For institutions" links working.
 */

import { Redirect } from 'expo-router';

export default function InstitutionsPricingRedirect() {
  return <Redirect href="/schools/pricing" />;
}
