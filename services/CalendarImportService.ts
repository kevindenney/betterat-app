import { createLogger } from '@/lib/utils/logger';

/**
 * Calendar Import Service
 * Parse and import sailing calendars from CSV files
 */

export interface CalendarRace {
  subject: string;
  startDate: string; // YYYY-MM-DD
  location: string;
  allDayEvent: boolean;
  isPrivate: boolean;
}

export interface CalendarImportResult {
  success: boolean;
  races: CalendarRace[];
  skipped: {
    row: number;
    reason: string;
    data: any;
  }[];
  error?: string;
}

const logger = createLogger('CalendarImportService');
export class CalendarImportService {
  /**
   * Parse a CSV calendar file
   * Supports formats like: Subject,Start Date,Location,All Day Event,Private
   */
  static parseCSV(csvContent: string): CalendarImportResult {
    try {
      const lines = csvContent.trim().split('\n');

      if (lines.length === 0) {
        return {
          success: false,
          error: 'Empty CSV file',
          races: [],
          skipped: []
        };
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim());
      logger.debug('[CalendarImportService] CSV header:', header);

      // Expected columns
      const subjectIdx = header.findIndex(h => h.toLowerCase().includes('subject'));
      const dateIdx = header.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('start'));
      const locationIdx = header.findIndex(h => h.toLowerCase().includes('location') || h.toLowerCase().includes('venue'));
      const allDayIdx = header.findIndex(h => h.toLowerCase().includes('all day'));
      const privateIdx = header.findIndex(h => h.toLowerCase().includes('private'));

      if (subjectIdx === -1 || dateIdx === -1) {
        return {
          success: false,
          error: 'CSV must have Subject and Date columns',
          races: [],
          skipped: []
        };
      }

      const races: CalendarRace[] = [];
      const skipped: { row: number; reason: string; data: any }[] = [];

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const values = line.split(',').map(v => v.trim());

        const subject = values[subjectIdx] || '';
        const startDateRaw = values[dateIdx] || '';
        const location = locationIdx !== -1 ? values[locationIdx] || '' : '';
        const allDayEvent = allDayIdx !== -1 ? values[allDayIdx]?.toUpperCase() === 'TRUE' : true;
        const isPrivate = privateIdx !== -1 ? values[privateIdx]?.toUpperCase() === 'TRUE' : false;

        // Skip rows without subject or date
        if (!subject || !startDateRaw) {
          skipped.push({
            row: i + 1,
            reason: 'Missing subject or date',
            data: { subject, startDateRaw }
          });
          continue;
        }

        // Skip "Race Management" entries (not actual races)
        if (subject.toLowerCase().includes('race management')) {
          skipped.push({
            row: i + 1,
            reason: 'Race Management entry (not a race)',
            data: { subject }
          });
          continue;
        }

        // Parse date (support DD/MM/YYYY and other formats)
        const parsedDate = this.parseDate(startDateRaw);
        if (!parsedDate) {
          skipped.push({
            row: i + 1,
            reason: `Invalid date format: ${startDateRaw}`,
            data: { subject, startDateRaw }
          });
          continue;
        }

        races.push({
          subject,
          startDate: parsedDate,
          location,
          allDayEvent,
          isPrivate
        });
      }

      logger.debug(`[CalendarImportService] Parsed ${races.length} races, skipped ${skipped.length} entries`);

      return {
        success: true,
        races,
        skipped
      };
    } catch (error: any) {
      logger.error('[CalendarImportService] Parse error:', error);
      return {
        success: false,
        error: error.message,
        races: [],
        skipped: []
      };
    }
  }

  /**
   * Parse date from various formats
   * Supports: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.
   */
  private static parseDate(dateStr: string): string | null {
    try {
      // Try DD/MM/YYYY format (RHKYC calendar format)
      const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const yyyy = year;
        const mm = month.padStart(2, '0');
        const dd = day.padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }

      // Try YYYY-MM-DD format (ISO)
      const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const yyyy = year;
        const mm = month.padStart(2, '0');
        const dd = day.padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }

      // Try JavaScript Date parsing as fallback
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }

      return null;
    } catch (error) {
      logger.error('[CalendarImportService] Date parse error:', error);
      return null;
    }
  }

  /**
   * Validate parsed races
   */
  static validateRaces(races: CalendarRace[]): {
    valid: CalendarRace[];
    invalid: { race: CalendarRace; reason: string }[];
  } {
    const valid: CalendarRace[] = [];
    const invalid: { race: CalendarRace; reason: string }[] = [];

    for (const race of races) {
      // Check required fields
      if (!race.subject || !race.startDate) {
        invalid.push({
          race,
          reason: 'Missing subject or date'
        });
        continue;
      }

      // Check date is in future or recent past (within 1 year)
      const raceDate = new Date(race.startDate);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const twoYearsForward = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

      if (raceDate < oneYearAgo || raceDate > twoYearsForward) {
        invalid.push({
          race,
          reason: `Date out of range: ${race.startDate}`
        });
        continue;
      }

      valid.push(race);
    }

    return { valid, invalid };
  }
}
