/**
 * Tracking Services
 * 
 * GPS tracking integration for BetterAt supporting:
 * - Velocitek devices (SpeedPuck, Shift, ProStart, RTK Puck)
 * - TracTrac live race tracking
 * - GPX file imports
 * - Track analysis and statistics
 */

// Types
export * from './types';

// Parsers
export { VelocitekParser } from './VelocitekParser';
export { GPXParser } from './GPXParser';

// Services
export { TracTracService } from './TracTracService';
export type { TracTracConfig } from './TracTracService';

export { TrackingService } from './TrackingService';

// Default export - main service
export { TrackingService as default } from './TrackingService';
