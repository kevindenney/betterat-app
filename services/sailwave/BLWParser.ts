/**
 * Sailwave BLW File Parser
 *
 * Parses .BLW (INI-style) files into structured data for import into BetterAt.
 * The BLW format is the standard file format used by Sailwave, the dominant
 * regatta scoring software in Europe.
 *
 * @see https://www.sailwave.com for Sailwave documentation
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface BLWSection {
  type:
    | 'series'
    | 'event'
    | 'scoring'
    | 'discard'
    | 'comp'
    | 'race'
    | 'raceresult'
    | 'fleet'
    | 'division'
    | 'rating'
    | 'unknown';
  data: Record<string, string>;
}

export interface SeriesConfig {
  name: string;
  path?: string;
  session?: number;
}

export interface EventConfig {
  name: string;
  startDate: Date;
  endDate: Date;
  venue: string;
  organizingClub: string;
  boatClass?: string;
  notes?: string;
}

export interface ScoringConfig {
  system: 'low-point' | 'high-point' | 'bonus-point' | 'custom';
  systemCode: string;
  systemName: string;
  dnfValue: string;
  dncValue: string;
  dsqValue: string;
  dneValue: string;
  ocsValue: string;
  zfpPenalty: string;
  bfdValue: string;
  ufpValue: string;
  scpPenalty: string;
  retValue: string;
  rafValue: string;
}

export interface Competitor {
  id: number;
  sailNumber: string;
  boatClass?: string;
  fleet?: number;
  division?: string;
  helmName: string;
  crewName?: string;
  club?: string;
  nationality?: string;
  rating?: number;
  ratingSystem?: string;
  excluded?: boolean;
  notes?: string;
}

export interface Race {
  id: number;
  date: Date;
  time?: string;
  name: string;
  rank: number;
  status: 'sailed' | 'abandoned' | 'cancelled' | 'scheduled';
  notes?: string;
  windConditions?: string;
  windDirection?: number;
  windSpeed?: number;
  fleet?: number;
}

export interface RaceResult {
  id: number;
  raceId: number;
  competitorId: number;
  position?: number;
  elapsedTime?: string;
  correctedTime?: string;
  statusCode?: string;
  points: number;
  notes?: string;
  penalty?: string;
  penaltyPercent?: number;
  redress?: boolean;
  redressPosition?: number;
}

export interface SailwaveData {
  series: SeriesConfig;
  event: EventConfig;
  scoring: ScoringConfig;
  discards: number[];
  competitors: Competitor[];
  races: Race[];
  results: RaceResult[];
  fleets: { id: number; name: string }[];
  divisions: { id: number; name: string }[];
  raw: BLWSection[]; // Preserve unknown sections for round-trip
}

// ============================================================================
// Status Code Mappings
// ============================================================================

export const SAILWAVE_STATUS_CODES = [
  'DNF', // Did Not Finish
  'DNS', // Did Not Start
  'DNC', // Did Not Come to starting area
  'DSQ', // Disqualified
  'DNE', // Disqualified Not Excludable
  'OCS', // On Course Side at start
  'BFD', // Black Flag Disqualification
  'UFD', // U Flag Disqualification
  'ZFP', // Z Flag Penalty (20%)
  'SCP', // Scoring Penalty
  'RET', // Retired
  'RAF', // Retired After Finish
  'RDG', // Redress Given
  'DPI', // Discretionary Penalty Imposed
  'NSC', // Did Not Sail Course
  'TLE', // Time Limit Expired
  'AVG', // Average points
  'STP', // Standard Penalty
] as const;

export type SailwaveStatusCode = (typeof SAILWAVE_STATUS_CODES)[number];

// ============================================================================
// Parser Class
// ============================================================================

export class BLWParser {
  /**
   * Parse a BLW file string into structured data
   */
  parse(content: string): SailwaveData {
    const lines = this.normalizeLineEndings(content).split('\n');
    const sections = this.parseSections(lines);

    return {
      series: this.parseSeriesSection(sections),
      event: this.parseEventSection(sections),
      scoring: this.parseScoringSection(sections),
      discards: this.parseDiscardSection(sections),
      competitors: this.parseCompetitorSections(sections),
      races: this.parseRaceSections(sections),
      results: this.parseResultSections(sections),
      fleets: this.parseFleetSections(sections),
      divisions: this.parseDivisionSections(sections),
      raw: sections.filter((s) => s.type === 'unknown'),
    };
  }

  /**
   * Validate a BLW file and return any issues found
   */
  validate(content: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const data = this.parse(content);

      // Check for required data
      if (!data.event.name) {
        warnings.push('Event name is missing');
      }

      if (data.competitors.length === 0) {
        warnings.push('No competitors found in file');
      }

      if (data.races.length === 0) {
        warnings.push('No races found in file');
      }

      // Check for duplicate sail numbers
      const sailNumbers = new Set<string>();
      for (const comp of data.competitors) {
        const normalizedSailNo = comp.sailNumber.toUpperCase().replace(/\s+/g, '');
        if (sailNumbers.has(normalizedSailNo)) {
          warnings.push(`Duplicate sail number: ${comp.sailNumber}`);
        }
        sailNumbers.add(normalizedSailNo);
      }

      // Check for orphaned results
      const competitorIds = new Set(data.competitors.map((c) => c.id));
      const raceIds = new Set(data.races.map((r) => r.id));

      for (const result of data.results) {
        if (!competitorIds.has(result.competitorId)) {
          warnings.push(`Result references unknown competitor ID: ${result.competitorId}`);
        }
        if (!raceIds.has(result.raceId)) {
          warnings.push(`Result references unknown race ID: ${result.raceId}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }

  // ==========================================================================
  // Private Methods - Section Parsing
  // ==========================================================================

  private normalizeLineEndings(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  private parseSections(lines: string[]): BLWSection[] {
    const sections: BLWSection[] = [];
    let currentSection: BLWSection | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith(';')) continue;

      // Section header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        const sectionName = trimmed.slice(1, -1).toLowerCase();
        currentSection = {
          type: this.getSectionType(sectionName),
          data: {},
        };
        continue;
      }

      // Key=value pair
      if (currentSection) {
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex > 0) {
          const key = trimmed.slice(0, equalsIndex).toLowerCase().trim();
          const value = trimmed.slice(equalsIndex + 1);
          currentSection.data[key] = value;
        }
      }
    }

    // Don't forget last section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private getSectionType(name: string): BLWSection['type'] {
    const typeMap: Record<string, BLWSection['type']> = {
      series: 'series',
      event: 'event',
      scoring: 'scoring',
      discard: 'discard',
      discards: 'discard',
      comp: 'comp',
      competitor: 'comp',
      race: 'race',
      raceresult: 'raceresult',
      result: 'raceresult',
      fleet: 'fleet',
      division: 'division',
      rating: 'rating',
    };
    return typeMap[name] || 'unknown';
  }

  // ==========================================================================
  // Private Methods - Data Extraction
  // ==========================================================================

  private parseSeriesSection(sections: BLWSection[]): SeriesConfig {
    const section = sections.find((s) => s.type === 'series');
    if (!section) {
      return { name: 'Imported Series' };
    }
    return {
      name: section.data['sername'] || section.data['name'] || 'Imported Series',
      path: section.data['serpath'] || section.data['path'],
      session: this.parseIntSafe(section.data['session']),
    };
  }

  private parseEventSection(sections: BLWSection[]): EventConfig {
    const section = sections.find((s) => s.type === 'event');
    const seriesSection = sections.find((s) => s.type === 'series');

    // Try to get event name from multiple sources
    const name =
      section?.data['evtname'] ||
      section?.data['name'] ||
      seriesSection?.data['sername'] ||
      'Imported Event';

    return {
      name,
      startDate: this.parseDate(section?.data['evtstart'] || section?.data['startdate']),
      endDate: this.parseDate(section?.data['evtend'] || section?.data['enddate']),
      venue: section?.data['evtvenue'] || section?.data['venue'] || '',
      organizingClub: section?.data['evtorgclub'] || section?.data['club'] || '',
      boatClass: section?.data['evtclass'] || section?.data['class'],
      notes: section?.data['evtnotes'] || section?.data['notes'],
    };
  }

  private parseScoringSection(sections: BLWSection[]): ScoringConfig {
    const section = sections.find((s) => s.type === 'scoring');
    if (!section) {
      return this.getDefaultScoringConfig();
    }

    const systemCode = section.data['scrcode'] || section.data['code'] || 'rrs-lp';

    return {
      system: this.mapScoringSystem(systemCode),
      systemCode,
      systemName: section.data['scrname'] || section.data['name'] || 'RRS Low Point',
      dnfValue: section.data['scrdnfvalue'] || section.data['dnf'] || 'n+1',
      dncValue: section.data['scrdncvalue'] || section.data['dnc'] || 'n+1',
      dsqValue: section.data['scrdsqvalue'] || section.data['dsq'] || 'n+1',
      dneValue: section.data['scrdnevalue'] || section.data['dne'] || 'n+1',
      ocsValue: section.data['scrocs'] || section.data['ocs'] || 'n+1',
      zfpPenalty: section.data['scrzfp'] || section.data['zfp'] || '20%',
      bfdValue: section.data['scrbfd'] || section.data['bfd'] || 'n+1',
      ufpValue: section.data['scrufp'] || section.data['ufp'] || 'n+1',
      scpPenalty: section.data['scrscp'] || section.data['scp'] || 'n+1',
      retValue: section.data['scrret'] || section.data['ret'] || 'n+1',
      rafValue: section.data['scrraf'] || section.data['raf'] || 'n+1',
    };
  }

  private parseDiscardSection(sections: BLWSection[]): number[] {
    const section = sections.find((s) => s.type === 'discard');
    if (!section) {
      // Default: 1 discard after 4 races, 2 after 7
      return [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    }

    const discardStr = section.data['discards'] || section.data['profile'];
    if (!discardStr) {
      return [0, 0, 0, 0, 1, 1, 1, 2, 2, 2];
    }

    return discardStr.split(',').map((s) => parseInt(s.trim()) || 0);
  }

  private parseCompetitorSections(sections: BLWSection[]): Competitor[] {
    return sections
      .filter((s) => s.type === 'comp')
      .map((section) => ({
        id: this.parseIntSafe(section.data['compid'] || section.data['id']) || 0,
        sailNumber: section.data['compsailno'] || section.data['sailno'] || section.data['sail'] || '',
        boatClass: section.data['compclass'] || section.data['class'],
        fleet: this.parseIntSafe(section.data['compfleet'] || section.data['fleet']),
        division: section.data['compdivision'] || section.data['division'],
        helmName: section.data['comphelmname'] || section.data['helm'] || section.data['skipper'] || '',
        crewName: section.data['compcrewname'] || section.data['crew'],
        club: section.data['compclub'] || section.data['club'],
        nationality:
          section.data['compnat'] || section.data['nationality'] || section.data['nation'],
        rating: this.parseFloatSafe(section.data['comprating'] || section.data['rating']),
        ratingSystem: section.data['compratingsystem'] || section.data['ratingsystem'],
        excluded: section.data['compexclude'] === '1' || section.data['exclude'] === '1',
        notes: section.data['compnotes'] || section.data['notes'],
      }));
  }

  private parseRaceSections(sections: BLWSection[]): Race[] {
    return sections
      .filter((s) => s.type === 'race')
      .map((section) => ({
        id: this.parseIntSafe(section.data['raceid'] || section.data['id']) || 0,
        date: this.parseDate(section.data['racedate'] || section.data['date']),
        time: section.data['racetime'] || section.data['time'],
        name:
          section.data['racename'] ||
          section.data['name'] ||
          `Race ${section.data['raceid'] || section.data['id']}`,
        rank: this.parseIntSafe(section.data['racerank'] || section.data['rank']) || 0,
        status: this.mapRaceStatus(section.data['racestatus'] || section.data['status']),
        notes: section.data['racenotes'] || section.data['notes'],
        windConditions: section.data['racewind'] || section.data['wind'],
        windDirection: this.parseIntSafe(section.data['racewinddir'] || section.data['winddir']),
        windSpeed: this.parseFloatSafe(section.data['racewindspeed'] || section.data['windspeed']),
        fleet: this.parseIntSafe(section.data['racefleet'] || section.data['fleet']),
      }));
  }

  private parseResultSections(sections: BLWSection[]): RaceResult[] {
    return sections
      .filter((s) => s.type === 'raceresult')
      .map((section) => ({
        id: this.parseIntSafe(section.data['rrid'] || section.data['id']) || 0,
        raceId: this.parseIntSafe(section.data['rrrace'] || section.data['race']) || 0,
        competitorId: this.parseIntSafe(section.data['rrcompetitor'] || section.data['comp']) || 0,
        position: this.parseIntSafe(section.data['rrpos'] || section.data['pos']),
        elapsedTime: section.data['rrelapsed'] || section.data['elapsed'],
        correctedTime: section.data['rrcorrected'] || section.data['corrected'],
        statusCode: this.normalizeStatusCode(section.data['rrcode'] || section.data['code']),
        points: this.parseFloatSafe(section.data['rrpts'] || section.data['pts']) || 0,
        notes: section.data['rrnotes'] || section.data['notes'],
        penalty: section.data['rrpenalty'] || section.data['penalty'],
        penaltyPercent: this.parseFloatSafe(
          section.data['rrpenaltypercent'] || section.data['penaltypercent']
        ),
        redress:
          section.data['rrredress'] === '1' ||
          section.data['redress'] === '1' ||
          section.data['rrredress'] === 'true',
        redressPosition: this.parseIntSafe(
          section.data['rrredresspos'] || section.data['redresspos']
        ),
      }));
  }

  private parseFleetSections(sections: BLWSection[]): { id: number; name: string }[] {
    return sections
      .filter((s) => s.type === 'fleet')
      .map((section) => ({
        id: this.parseIntSafe(section.data['fleetid'] || section.data['id']) || 0,
        name: section.data['fleetname'] || section.data['name'] || `Fleet ${section.data['id']}`,
      }));
  }

  private parseDivisionSections(sections: BLWSection[]): { id: number; name: string }[] {
    return sections
      .filter((s) => s.type === 'division')
      .map((section) => ({
        id: this.parseIntSafe(section.data['divisionid'] || section.data['id']) || 0,
        name:
          section.data['divisionname'] ||
          section.data['name'] ||
          `Division ${section.data['id']}`,
      }));
  }

  // ==========================================================================
  // Private Methods - Helpers
  // ==========================================================================

  private parseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date();

    // Handle DD/MM/YYYY format (European)
    const euroMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (euroMatch) {
      return new Date(parseInt(euroMatch[3]), parseInt(euroMatch[2]) - 1, parseInt(euroMatch[1]));
    }

    // Handle DD.MM.YYYY format (German)
    const germanMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (germanMatch) {
      return new Date(
        parseInt(germanMatch[3]),
        parseInt(germanMatch[2]) - 1,
        parseInt(germanMatch[1])
      );
    }

    // Handle YYYY-MM-DD format (ISO)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }

    // Fallback to Date parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private parseIntSafe(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  private parseFloatSafe(value: string | undefined): number | undefined {
    if (!value) return undefined;
    // Handle European decimal format (comma)
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? undefined : parsed;
  }

  private mapScoringSystem(code: string): ScoringConfig['system'] {
    const lowerCode = code.toLowerCase();
    if (lowerCode.includes('hp') || lowerCode.includes('high')) return 'high-point';
    if (lowerCode.includes('bp') || lowerCode.includes('bonus')) return 'bonus-point';
    if (lowerCode.includes('lp') || lowerCode.includes('low')) return 'low-point';
    if (lowerCode.includes('custom')) return 'custom';
    return 'low-point';
  }

  private mapRaceStatus(status: string | undefined): Race['status'] {
    if (!status) return 'scheduled';
    const s = status.toLowerCase();
    if (s === 'sailed' || s === 'completed' || s === 'finished') return 'sailed';
    if (s === 'abandoned' || s === 'abandoned race') return 'abandoned';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    return 'scheduled';
  }

  private normalizeStatusCode(code: string | undefined): string | undefined {
    if (!code) return undefined;
    const upper = code.toUpperCase().trim();
    if (SAILWAVE_STATUS_CODES.includes(upper as SailwaveStatusCode)) {
      return upper;
    }
    return code; // Return original if not recognized
  }

  private getDefaultScoringConfig(): ScoringConfig {
    return {
      system: 'low-point',
      systemCode: 'rrs-lp',
      systemName: 'RRS Low Point 2021-2024',
      dnfValue: 'n+1',
      dncValue: 'n+1',
      dsqValue: 'n+1',
      dneValue: 'n+1',
      ocsValue: 'n+1',
      zfpPenalty: '20%',
      bfdValue: 'n+1',
      ufpValue: 'n+1',
      scpPenalty: 'n+1',
      retValue: 'n+1',
      rafValue: 'n+1',
    };
  }
}

// Export singleton instance
export const blwParser = new BLWParser();
