/**
 * Shared invalidation list for racing-area mutations. Racing areas live in
 * atlas_pois (kind='racing_area'), so a write must refresh every reader of
 * that table: the Atlas polygon layer, the race-flag picker, the
 * step-plan race-area centers, and the generic POI list.
 */

import type { QueryClient } from '@tanstack/react-query';

export function invalidateRacingAreaQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['atlas-racing-areas'] });
  queryClient.invalidateQueries({ queryKey: ['my-racing-areas'] });
  queryClient.invalidateQueries({ queryKey: ['user-atlas-race-area-centers'] });
  queryClient.invalidateQueries({ queryKey: ['atlas-pois'] });
}
