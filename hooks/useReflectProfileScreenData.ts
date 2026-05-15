import { useMemo, useState } from 'react';
import { useInterest } from '@/providers/InterestProvider';
import { useReflectProfile } from '@/hooks/useReflectProfile';
import {
  mapReflectProfileToProfileScreen,
  type ProfilePreferenceState,
} from '@/lib/reflect/mapReflectProfile';

export function useReflectProfileScreenData() {
  const profile = useReflectProfile();
  const { userInterests, currentInterest } = useInterest();
  const isSailing = currentInterest?.slug === 'sail-racing';
  const [windUnit, setWindUnit] = useState<ProfilePreferenceState['windUnit']>(
    isSailing ? 'knots' : 'm/s',
  );
  const [distanceUnit, setDistanceUnit] = useState<
    ProfilePreferenceState['distanceUnit']
  >(isSailing ? 'nautical' : 'metric');
  const [weeklyDigestOn, setWeeklyDigestOn] = useState(true);
  const [resurfaceOldCapturesOn, setResurfaceOldCapturesOn] = useState(true);
  const [privateModeOn, setPrivateModeOn] = useState(false);

  const props = useMemo(() => {
    if (!profile.data) return null;
    return mapReflectProfileToProfileScreen(
      profile.data,
      userInterests,
      currentInterest,
      {
        windUnit,
        distanceUnit,
        weeklyDigestOn,
        resurfaceOldCapturesOn,
        privateModeOn,
      },
    );
  }, [
    currentInterest,
    distanceUnit,
    privateModeOn,
    profile.data,
    resurfaceOldCapturesOn,
    userInterests,
    weeklyDigestOn,
    windUnit,
  ]);

  return {
    props,
    loading: profile.loading,
    error: profile.error,
    refresh: profile.refresh,
    handlers: {
      setWindUnit,
      setDistanceUnit,
      setWeeklyDigestOn,
      setResurfaceOldCapturesOn,
      setPrivateModeOn,
    },
  };
}

export type UseReflectProfileScreenDataResult = ReturnType<
  typeof useReflectProfileScreenData
>;
