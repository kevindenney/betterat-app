/**
 * Content Formatters
 * Format race content for sharing via different channels
 */

import type { ShareableContent, RaceResult, DetailedWeatherBriefing, SailPlan, WatchScheduleData } from '../types';

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format position with ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function formatPosition(position: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = position % 100;
  return position + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/**
 * Format wind direction as cardinal
 */
function formatWindDirection(dir: number | string | undefined): string {
  if (dir === undefined) return '';
  if (typeof dir === 'string') return dir;
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(dir / 22.5) % 16;
  return directions[index];
}

/**
 * Format time from ISO string
 */
function formatTime(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format weather briefing section
 */
function formatWeatherBriefingSection(
  weather: ShareableContent['preRace'],
  lines: string[]
): void {
  const w = weather?.raceInfo?.weather;
  const briefing = weather?.weatherBriefing;

  if (!w && !briefing) return;

  lines.push(`🌤️ WEATHER FORECAST`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);

  // Wind summary
  if (briefing?.summary) {
    lines.push(`Wind: ${briefing.summary}`);
  } else if (w?.windSpeed !== undefined) {
    const windStr = w.windSpeedMax
      ? `${w.windDirection || ''} ${w.windSpeed}-${w.windSpeedMax}kts`
      : `${w.windDirection || ''} ${w.windSpeed}kts`;
    const trend = briefing?.windTrend ? ` ${briefing.windTrend}` : '';
    lines.push(`Wind: ${windStr.trim()}${trend}`);
  }

  // Hourly forecast (key times)
  if (briefing?.hourlyForecast && briefing.hourlyForecast.length > 0) {
    const keyPoints = briefing.hourlyForecast.slice(0, 4); // Start, mid, end times
    keyPoints.forEach(pt => {
      const dir = formatWindDirection(pt.windDirection);
      lines.push(`  • ${pt.time}: ${pt.windSpeed}kts from ${dir}`);
    });
  }
  lines.push('');

  // Tide info
  if (briefing?.tideExtremes && briefing.tideExtremes.length > 0) {
    const tideFlow = w?.tideState === 'flooding' ? 'Flood → Slack → Ebb' :
                     w?.tideState === 'ebbing' ? 'Ebb → Slack → Flood' :
                     'Tide:';
    lines.push(tideFlow);
    briefing.tideExtremes.forEach(ext => {
      const label = ext.type === 'high' ? 'High' : 'Low';
      lines.push(`  • ${label}: ${ext.time} (${ext.height.toFixed(1)}m)`);
    });
    if (briefing.tideTurnTime) {
      lines.push(`  • Turn: ${briefing.tideTurnTime}`);
    }
  } else if (w?.tideState) {
    lines.push(`Tide: ${w.tideState}${w.tideHeight ? ` (${w.tideHeight.toFixed(1)}m)` : ''}`);
  }

  // Current
  if (briefing?.currentSpeed && briefing.currentSpeed > 0) {
    const dir = briefing.currentDirection ? ` setting ${briefing.currentDirection}` : '';
    lines.push(`Current: ${briefing.currentSpeed.toFixed(1)}kts${dir}`);
  } else if (w?.currentSpeed && w.currentSpeed > 0) {
    lines.push(`Current: ${w.currentSpeed.toFixed(1)}kts${w.currentDirection ? ` ${w.currentDirection}` : ''}`);
  }

  // Waves
  const waveHeight = briefing?.waveHeight ?? w?.waveHeight;
  if (waveHeight && waveHeight > 0) {
    const period = briefing?.wavePeriod ?? w?.wavePeriod;
    const dir = briefing?.waveDirection ?? w?.waveDirection;
    let waveStr = `Waves: ${waveHeight.toFixed(1)}m`;
    if (dir) waveStr += ` from ${dir}`;
    if (period) waveStr += `, period ${period}s`;
    lines.push(waveStr);
  }

  // Temperature
  const airTemp = briefing?.airTemperature ?? w?.temperature;
  const waterTemp = briefing?.waterTemperature ?? w?.waterTemperature;
  if (airTemp || waterTemp) {
    const temps: string[] = [];
    if (waterTemp) temps.push(`Water: ${waterTemp}°C`);
    if (airTemp) temps.push(`Air: ${airTemp}°C`);
    lines.push(temps.join(' | '));
  }

  lines.push('');
}

/**
 * Format sail plan section
 */
function formatSailPlanSection(sailPlan: SailPlan | undefined, lines: string[]): void {
  if (!sailPlan) return;

  const hasSails = sailPlan.mainsail || sailPlan.jib || sailPlan.spinnaker || sailPlan.codeZero;
  if (!hasSails) return;

  lines.push(`⛵ SAIL PLAN`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);

  if (sailPlan.mainsail) lines.push(`• Main: ${sailPlan.mainsail}`);
  if (sailPlan.jib) lines.push(`• Jib: ${sailPlan.jib}`);
  if (sailPlan.spinnaker) lines.push(`• Spin: ${sailPlan.spinnaker}`);
  if (sailPlan.codeZero) lines.push(`• Code 0: ${sailPlan.codeZero}`);
  if (sailPlan.stormSails) lines.push(`• Storm: ${sailPlan.stormSails}`);

  if (sailPlan.notes) {
    lines.push('');
    lines.push(`Notes: ${sailPlan.notes}`);
  }

  lines.push('');
}

/**
 * Format rig settings section
 */
function formatRigSection(rigTuning: ShareableContent['preRace'], lines: string[]): void {
  const rig = rigTuning?.raceInfo?.rigTuning;
  if (!rig) return;

  lines.push(`🔧 RIG SETTINGS`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);

  if (rig.preset) lines.push(`Preset: ${rig.preset}`);
  if (rig.windRange) lines.push(`Wind Range: ${rig.windRange}`);

  if (rig.settings) {
    const s = rig.settings;
    if (s.backstay) lines.push(`• Backstay: ${s.backstay}`);
    if (s.forestay) lines.push(`• Forestay: ${s.forestay}`);
    if (s.cunningham) lines.push(`• Cunningham: ${s.cunningham}`);
    if (s.outhaul) lines.push(`• Outhaul: ${s.outhaul}`);
    if (s.vang) lines.push(`• Vang: ${s.vang}`);
    if (s.mast) lines.push(`• Mast: ${s.mast}`);
  }

  if (rig.notes) {
    lines.push('');
    lines.push(`Notes: ${rig.notes}`);
  }

  lines.push('');
}

/**
 * Format strategy section
 */
function formatStrategySection(preRace: ShareableContent['preRace'], lines: string[]): void {
  const hasStrategy = preRace?.startStrategy || preRace?.upwindStrategy ||
                      preRace?.downwindStrategy || preRace?.finishStrategy ||
                      preRace?.windwardMarkStrategy || preRace?.leewardMarkStrategy;

  if (!hasStrategy) return;

  lines.push(`🎯 STRATEGY`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);

  if (preRace?.startStrategy) {
    lines.push(`START: ${preRace.startStrategy}`);
    lines.push('');
  }

  if (preRace?.upwindStrategy) {
    lines.push(`UPWIND: ${preRace.upwindStrategy}`);
    lines.push('');
  }

  if (preRace?.windwardMarkStrategy) {
    lines.push(`WINDWARD MARK: ${preRace.windwardMarkStrategy}`);
    lines.push('');
  }

  if (preRace?.downwindStrategy) {
    lines.push(`DOWNWIND: ${preRace.downwindStrategy}`);
    lines.push('');
  }

  if (preRace?.leewardMarkStrategy) {
    lines.push(`LEEWARD MARK: ${preRace.leewardMarkStrategy}`);
    lines.push('');
  }

  if (preRace?.finishStrategy) {
    lines.push(`FINISH: ${preRace.finishStrategy}`);
    lines.push('');
  }
}

/**
 * Format watch schedule section (compact)
 */
function formatWatchScheduleSection(ws: WatchScheduleData | undefined, lines: string[]): void {
  if (!ws || !ws.watches || ws.watches.length === 0) return;

  lines.push(`⏰ WATCH SCHEDULE`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Est. Duration: ${ws.raceDurationHours}h | Watch Length: ${ws.watchLengthHours}h`);
  lines.push('');

  // Simple rotation display
  const formatTimeWithMinutes = (hour: number, minute: number = 0) => {
    const h = ((hour % 24) + 24) % 24;
    return `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const [startHour, startMinute] = (ws.scheduleStartTime || '10:00').split(':').map(Number);
  let currentHour = startHour;
  let hoursElapsed = 0;

  while (hoursElapsed < Math.min(ws.raceDurationHours, 24)) { // Show first day only
    const watchIdx = Math.floor(hoursElapsed / ws.watchLengthHours) % ws.watches.length;
    const watch = ws.watches[watchIdx];
    const endHour = currentHour + ws.watchLengthHours;

    // Display watch name with crew names if available
    const crewDisplay = watch?.crewNames?.length
      ? `: ${watch.crewNames.join(', ')}`
      : '';
    const watchName = watch?.name || `Watch ${String.fromCharCode(65 + watchIdx)}`;

    lines.push(`${formatTimeWithMinutes(currentHour, startMinute)}-${formatTimeWithMinutes(endHour, startMinute)}  ${watchName}${crewDisplay}`);

    currentHour = endHour;
    hoursElapsed += ws.watchLengthHours;
  }

  if (ws.raceDurationHours > 24) {
    lines.push(`... (${Math.ceil(ws.raceDurationHours / 24)} days total)`);
  }

  lines.push('');
}

/**
 * Format pre-race strategy content for sharing - COMPREHENSIVE VERSION
 */
export function formatPreRaceContent(content: ShareableContent): string {
  const lines: string[] = [];
  const { raceDate, raceName, venue, boatClass, preRace } = content;

  // Header
  lines.push(`🏁 RACE BRIEFING`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📍 ${raceName}`);
  lines.push(`📅 ${formatDate(raceDate)}`);

  // Race details line
  const details: string[] = [];
  if (preRace?.raceInfo?.startTime) details.push(`Start: ${preRace.raceInfo.startTime}`);
  if (preRace?.raceInfo?.totalDistanceNm) details.push(`${preRace.raceInfo.totalDistanceNm}nm`);
  if (details.length > 0) lines.push(`⏰ ${details.join(' | ')}`);

  // Course/Route
  if (preRace?.documentData?.routeWaypoints && preRace.documentData.routeWaypoints.length > 0) {
    const waypoints = preRace.documentData.routeWaypoints
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(wp => wp.name)
      .join(' → ');
    lines.push(`🚩 ${waypoints}`);
  }

  if (venue && venue !== 'Venue TBD') lines.push(`📍 ${venue}`);
  if (boatClass && boatClass !== 'Class TBD') lines.push(`⛵ ${boatClass}`);
  lines.push('');

  // Weather Forecast Section
  formatWeatherBriefingSection(preRace, lines);

  // Sail Plan Section
  formatSailPlanSection(preRace?.sailPlan, lines);

  // Rig Settings Section
  formatRigSection(preRace, lines);

  // Strategy Section
  formatStrategySection(preRace, lines);

  // Watch Schedule Section (for distance races)
  formatWatchScheduleSection(preRace?.watchSchedule, lines);

  // Key Insights
  if (preRace?.aiInsights && preRace.aiInsights.length > 0) {
    lines.push(`💡 KEY INSIGHTS`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    preRace.aiInsights.forEach(insight => {
      lines.push(`• ${insight}`);
    });
    lines.push('');
  }

  // User Notes (if any additional notes)
  if (preRace?.userNotes) {
    lines.push(`📝 NOTES`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(preRace.userNotes);
    lines.push('');
  }

  // Check if we have any meaningful content
  const hasContent = preRace?.raceInfo?.weather ||
                     preRace?.weatherBriefing ||
                     preRace?.sailPlan ||
                     preRace?.raceInfo?.rigTuning ||
                     preRace?.startStrategy ||
                     preRace?.aiInsights?.length ||
                     preRace?.watchSchedule;

  if (!hasContent) {
    lines.push(`📋 RACE PREP`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`• Add venue for weather forecast`);
    lines.push(`• Set strategy in race prep`);
    lines.push(`• Select sails and rig setup`);
    lines.push('');
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Generated by BetterAt`);

  return lines.join('\n');
}

/**
 * Format post-race analysis content for sharing
 */
export function formatPostRaceContent(content: ShareableContent): string {
  const lines: string[] = [];
  const { raceDate, raceName, venue, boatClass, postRace } = content;

  lines.push(`🏁 RACE COMPLETE`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📍 ${raceName}`);
  lines.push(`📅 ${formatDate(raceDate)}`);
  if (venue) lines.push(`🌊 ${venue}`);
  if (boatClass) lines.push(`⛵ ${boatClass}`);
  lines.push('');

  // Result
  if (postRace?.result) {
    const r = postRace.result;
    lines.push(`🏆 RESULT`);
    if (r.status) {
      lines.push(`${r.status}`);
    } else {
      lines.push(`${formatPosition(r.position)} of ${r.fleetSize} boats`);
      if (r.points !== undefined) {
        lines.push(`${r.points} points`);
      }
    }
    lines.push('');
  }

  // Key takeaway / learning
  if (postRace?.keyLearning) {
    lines.push(`💡 KEY TAKEAWAY`);
    lines.push(`"${postRace.keyLearning}"`);
    lines.push('');
  }

  // Narrative
  if (postRace?.narrative) {
    lines.push(`📝 HOW IT WENT`);
    lines.push(postRace.narrative);
    lines.push('');
  }

  // Key moment
  if (postRace?.keyMoment) {
    lines.push(`⚡ KEY MOMENT`);
    lines.push(postRace.keyMoment);
    lines.push('');
  }

  // AI Analysis summary
  if (postRace?.coachingFeedback && postRace.coachingFeedback.length > 0) {
    lines.push(`📊 AI ANALYSIS`);

    // Show first few coaching insights
    postRace.coachingFeedback.slice(0, 3).forEach(feedback => {
      const phase = feedback.phase || 'General';
      const score = feedback.execution_score;
      const icon = score && score >= 80 ? '✅' : score && score >= 50 ? '⚡' : '❌';
      lines.push(`${icon} ${phase}: ${feedback.execution_feedback || 'Good'}`);
    });
    lines.push('');
  }

  // Framework scores (brief)
  if (postRace?.frameworkScores?.overall_framework_adoption !== undefined) {
    lines.push(`📈 FRAMEWORK SCORE: ${postRace.frameworkScores.overall_framework_adoption}/100`);
    lines.push('');
  }

  // Focus for next race
  if (postRace?.focusNextRace) {
    lines.push(`🎯 FOCUS NEXT RACE`);
    lines.push(postRace.focusNextRace);
    lines.push('');
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Generated by BetterAt`);

  return lines.join('\n');
}

/**
 * Format result-only content (minimal share)
 */
export function formatResultOnly(content: ShareableContent): string {
  const lines: string[] = [];
  const { raceDate, raceName, postRace } = content;

  lines.push(`🏁 ${raceName}`);
  lines.push(`📅 ${formatDate(raceDate)}`);

  if (postRace?.result) {
    const r = postRace.result;
    if (r.status) {
      lines.push(`Result: ${r.status}`);
    } else {
      lines.push(`🏆 ${formatPosition(r.position)} of ${r.fleetSize}`);
    }
  }

  if (postRace?.keyMoment) {
    lines.push('');
    lines.push(`"${postRace.keyMoment}"`);
  }

  return lines.join('\n');
}

/**
 * Format content for WhatsApp (more compact)
 */
export function formatForWhatsApp(content: ShareableContent): string {
  // WhatsApp has a character limit, so we use the standard formatters
  // which are already optimized for mobile reading
  switch (content.context) {
    case 'pre-race':
      return formatPreRaceContent(content);
    case 'post-race':
      return formatPostRaceContent(content);
    case 'result-only':
      return formatResultOnly(content);
    default:
      return formatPostRaceContent(content);
  }
}

/**
 * Format content for Email (can be more detailed)
 */
export function formatForEmail(content: ShareableContent): string {
  // Email can handle more detail, so we use the full formatters
  switch (content.context) {
    case 'pre-race':
      return formatPreRaceContent(content);
    case 'post-race':
      return formatPostRaceContent(content);
    case 'result-only':
      return formatResultOnly(content);
    default:
      return formatPostRaceContent(content);
  }
}
