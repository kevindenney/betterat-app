/**
 * Legacy Discover route — now a redirect shim.
 *
 * The Discover tab was folded into Library (5→4 tabs). Its segments were
 * rehomed: interests/orgs/plans/today → Library zones, people → Watch,
 * nearby → Atlas. This shim keeps old deep links (`/discover?segment=…`,
 * `?category=…`) working by bouncing them to the new home. The detail
 * sub-routes under `app/discover/*` (org, person, topic, …) are separate
 * and still live.
 */

import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function DiscoverRedirect() {
  const params = useLocalSearchParams<{ segment?: string; category?: string }>();

  const raw =
    (Array.isArray(params.segment) ? params.segment[0] : params.segment) ??
    (Array.isArray(params.category) ? params.category[0] : params.category) ??
    'all';

  // Legacy ?category aliases used by older surfaces.
  const segment =
    raw === 'organizations' ? 'orgs' : raw === 'blueprints' ? 'plans' : raw;

  let href = '/(tabs)/library';
  switch (segment) {
    case 'people':
      href = '/(tabs)/watch';
      break;
    case 'nearby':
      href = '/(tabs)/atlas';
      break;
    case 'plans':
      href = '/(tabs)/library?zone=follow';
      break;
    case 'orgs':
      href = '/(tabs)/library?zone=orgs';
      break;
    case 'interests':
      href = '/(tabs)/library?zone=interests';
      break;
    case 'today':
      href = '/(tabs)/library?zone=today';
      break;
    default:
      href = '/(tabs)/library';
  }

  return <Redirect href={href as never} />;
}
