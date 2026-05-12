/**
 * Locale-aware Formatting Utilities
 *
 * Provides date, time, and number formatting that respects the current locale.
 */

import { format, parseISO, formatDistance as dateFnsFormatDistance, formatRelative, type Locale } from 'date-fns';
import { de, fr, it, es, enGB, nl, pt, sv, da, pl, el, fi, hi } from 'date-fns/locale';
import { getCurrentLocale, getCurrentLocaleConfig, SupportedLocale } from './index';

// ============================================================================
// Date-fns Locale Mapping
// ============================================================================

const dateFnsLocales: Record<SupportedLocale, Locale> = {
  en: enGB,
  de: de,
  fr: fr,
  it: it,
  es: es,
  nl: nl,
  pt: pt,
  sv: sv,
  da: da,
  pl: pl,
  el: el,
  fi: fi,
  hi: hi,
};

/**
 * Get date-fns locale for current language
 */
function getDateFnsLocale(): Locale {
  const locale = getCurrentLocale();
  return dateFnsLocales[locale] || enGB;
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format a date according to current locale
 *
 * @param date - Date object or ISO string
 * @param formatStr - date-fns format string (default: localized long date)
 *
 * @example
 * formatDate(new Date())
 * // English: "8 December 2025"
 * // German: "8. Dezember 2025"
 */
export function formatDate(date: Date | string, formatStr: string = 'PPP'): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (isNaN(d.getTime())) return '';
    return format(d, formatStr, { locale: getDateFnsLocale() });
  } catch {
    return '';
  }
}

/**
 * Format a date with short format (e.g., "8 Dec 2025")
 */
export function formatDateShort(date: Date | string): string {
  return formatDate(date, 'PP');
}

/**
 * Format a date with numeric format according to locale
 * e.g., "08/12/2025" (en), "08.12.2025" (de)
 */
export function formatDateNumeric(date: Date | string): string {
  return formatDate(date, 'P');
}

/**
 * Format time according to locale (24-hour format)
 */
export function formatTime(date: Date | string): string {
  return formatDate(date, 'HH:mm');
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'PPp');
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date | string, baseDate: Date = new Date()): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (isNaN(d.getTime())) return '';
    return dateFnsFormatDistance(d, baseDate, {
      locale: getDateFnsLocale(),
      addSuffix: true,
    });
  } catch {
    return '';
  }
}

/**
 * Format relative date (e.g., "today at 10:00", "yesterday at 14:30")
 */
export function formatRelativeDate(date: Date | string, baseDate: Date = new Date()): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (isNaN(d.getTime())) return '';
    return formatRelative(d, baseDate, { locale: getDateFnsLocale() });
  } catch {
    return '';
  }
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format a number according to current locale
 *
 * @example
 * formatNumber(1234.56)
 * // English: "1,234.56"
 * // German: "1.234,56"
 * // French: "1 234,56"
 */
export function formatNumber(
  value: number,
  options?: {
    decimals?: number;
    minDecimals?: number;
    maxDecimals?: number;
  }
): string {
  const locale = getCurrentLocale();

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options?.minDecimals ?? options?.decimals ?? 0,
    maximumFractionDigits: options?.maxDecimals ?? options?.decimals ?? 2,
  }).format(value);
}

/**
 * Format as integer (no decimals)
 */
export function formatInteger(value: number): string {
  return formatNumber(value, { decimals: 0 });
}

/**
 * Format as percentage
 *
 * @example
 * formatPercent(0.25) // "25%"
 * formatPercent(0.256, 1) // "25.6%"
 */
export function formatPercent(value: number, decimals: number = 0): string {
  const locale = getCurrentLocale();

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format as currency
 *
 * @example
 * formatCurrency(99.99) // "€99.99" or "99,99 €" depending on locale
 */
export function formatCurrency(
  value: number,
  currency?: string,
  options?: { showSymbol?: boolean }
): string {
  const locale = getCurrentLocale();
  const config = getCurrentLocaleConfig();
  const curr = currency || config.currency;

  return new Intl.NumberFormat(locale, {
    style: options?.showSymbol === false ? 'decimal' : 'currency',
    currency: curr,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// Sailing-Specific Formatting
// ============================================================================

/**
 * Format wind speed with unit
 */
export function formatWindSpeed(knots: number): string {
  return `${formatNumber(knots, { decimals: 1 })} kts`;
}

/**
 * Format wind direction (compass bearing)
 */
export function formatWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return `${directions[index]} (${formatInteger(degrees)}°)`;
}

/**
 * Format distance in nautical miles
 */
export function formatDistance(nm: number): string {
  return `${formatNumber(nm, { decimals: 2 })} nm`;
}

/**
 * Format elapsed time (HH:MM:SS)
 */
export function formatElapsedTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format race points (show 1 decimal if needed)
 */
export function formatPoints(points: number): string {
  if (points % 1 === 0) {
    return formatInteger(points);
  }
  return formatNumber(points, { decimals: 1 });
}

// ============================================================================
// Coordinate Formatting
// ============================================================================

/**
 * Format latitude/longitude in degrees, minutes format
 */
export function formatCoordinate(
  decimal: number,
  type: 'lat' | 'lng'
): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutes = (absolute - degrees) * 60;

  const direction =
    type === 'lat' ? (decimal >= 0 ? 'N' : 'S') : decimal >= 0 ? 'E' : 'W';

  return `${degrees}° ${minutes.toFixed(3)}' ${direction}`;
}

/**
 * Format a position (lat, lng)
 */
export function formatPosition(lat: number, lng: number): string {
  return `${formatCoordinate(lat, 'lat')}, ${formatCoordinate(lng, 'lng')}`;
}

