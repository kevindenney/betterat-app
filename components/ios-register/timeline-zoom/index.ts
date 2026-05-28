/**
 * Timeline Zoom — public entry. Re-exported from
 * components/ios-register/index.ts for the canonical iOS register surface
 * pattern.
 */

export { TimelineZoomCanvas } from './TimelineZoomCanvas';
export { TimelineZoomPracticeScreen } from './TimelineZoomPracticeScreen';
export { mapToTimelineDataset } from './realDataAdapter';
export { ZoomLevelPicker } from './ZoomLevelPicker';
export { L1StepView } from './L1StepView';
export { L2WeekView } from './L2WeekView';
export { L3SeasonView } from './L3SeasonView';
export { L4YearsView } from './L4YearsView';
export { StepDigestCard } from './StepDigestCard';
export { InterestHeader } from './InterestHeader';
export { SAMPLE_DATASET, CAPABILITY_PALETTE } from './sampleData';
export type {
  ZoomLevel,
  StepStatus,
  DayKey,
  Capability,
  CohortAvatar,
  BlueprintProvenance,
  StepHowItem,
  TimelineStep,
  TimelineWeek,
  TimelineSeason,
  TimelineInterest,
  TimelineDataset,
} from './types';
