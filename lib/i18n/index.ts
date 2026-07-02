/**
 * Internationalization (i18n) Configuration
 *
 * Sets up react-i18next for multi-language support in BetterAt.
 * Supports automatic locale detection, language switching, and
 * European locale formats.
 *
 * @example
 * ```typescript
 * import { useTranslation } from 'react-i18next';
 *
 * function MyComponent() {
 *   const { t } = useTranslation();
 *   return <Text>{t('common:actions.save')}</Text>;
 * }
 * ```
 */

import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import enAi from './locales/en/ai.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enNavigation from './locales/en/navigation.json';
import enRaces from './locales/en/races.json';
import enScoring from './locales/en/scoring.json';
import enSettings from './locales/en/settings.json';

import deAi from './locales/de/ai.json';
import deCommon from './locales/de/common.json';
import deErrors from './locales/de/errors.json';
import deNavigation from './locales/de/navigation.json';
import deRaces from './locales/de/races.json';
import deScoring from './locales/de/scoring.json';
import deSettings from './locales/de/settings.json';

import frAi from './locales/fr/ai.json';
import frCommon from './locales/fr/common.json';
import frErrors from './locales/fr/errors.json';
import frNavigation from './locales/fr/navigation.json';
import frRaces from './locales/fr/races.json';
import frScoring from './locales/fr/scoring.json';
import frSettings from './locales/fr/settings.json';

import itAi from './locales/it/ai.json';
import itCommon from './locales/it/common.json';
import itErrors from './locales/it/errors.json';
import itNavigation from './locales/it/navigation.json';
import itRaces from './locales/it/races.json';
import itScoring from './locales/it/scoring.json';
import itSettings from './locales/it/settings.json';

import esAi from './locales/es/ai.json';
import esCommon from './locales/es/common.json';
import esErrors from './locales/es/errors.json';
import esNavigation from './locales/es/navigation.json';
import esRaces from './locales/es/races.json';
import esScoring from './locales/es/scoring.json';
import esSettings from './locales/es/settings.json';

import nlAi from './locales/nl/ai.json';
import nlCommon from './locales/nl/common.json';
import nlErrors from './locales/nl/errors.json';
import nlNavigation from './locales/nl/navigation.json';
import nlRaces from './locales/nl/races.json';
import nlScoring from './locales/nl/scoring.json';
import nlSettings from './locales/nl/settings.json';

import ptAi from './locales/pt/ai.json';
import ptCommon from './locales/pt/common.json';
import ptErrors from './locales/pt/errors.json';
import ptNavigation from './locales/pt/navigation.json';
import ptRaces from './locales/pt/races.json';
import ptScoring from './locales/pt/scoring.json';
import ptSettings from './locales/pt/settings.json';

import svAi from './locales/sv/ai.json';
import svCommon from './locales/sv/common.json';
import svErrors from './locales/sv/errors.json';
import svNavigation from './locales/sv/navigation.json';
import svRaces from './locales/sv/races.json';
import svScoring from './locales/sv/scoring.json';
import svSettings from './locales/sv/settings.json';

import daAi from './locales/da/ai.json';
import daCommon from './locales/da/common.json';
import daErrors from './locales/da/errors.json';
import daNavigation from './locales/da/navigation.json';
import daRaces from './locales/da/races.json';
import daScoring from './locales/da/scoring.json';
import daSettings from './locales/da/settings.json';

import plAi from './locales/pl/ai.json';
import plCommon from './locales/pl/common.json';
import plErrors from './locales/pl/errors.json';
import plNavigation from './locales/pl/navigation.json';
import plRaces from './locales/pl/races.json';
import plScoring from './locales/pl/scoring.json';
import plSettings from './locales/pl/settings.json';

import elAi from './locales/el/ai.json';
import elCommon from './locales/el/common.json';
import elErrors from './locales/el/errors.json';
import elNavigation from './locales/el/navigation.json';
import elRaces from './locales/el/races.json';
import elScoring from './locales/el/scoring.json';
import elSettings from './locales/el/settings.json';

import fiAi from './locales/fi/ai.json';
import fiCommon from './locales/fi/common.json';
import fiErrors from './locales/fi/errors.json';
import fiNavigation from './locales/fi/navigation.json';
import fiRaces from './locales/fi/races.json';
import fiScoring from './locales/fi/scoring.json';
import fiSettings from './locales/fi/settings.json';

import hiAi from './locales/hi/ai.json';
import hiAuth from './locales/hi/auth.json';
import hiCommon from './locales/hi/common.json';
import hiErrors from './locales/hi/errors.json';
import hiNavigation from './locales/hi/navigation.json';
import hiRaces from './locales/hi/races.json';
import hiScoring from './locales/hi/scoring.json';
import hiSettings from './locales/hi/settings.json';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Supported locales - 12 European languages + Hindi (dev-context onboarding)
 */
export const supportedLocales = ['en', 'de', 'fr', 'it', 'es', 'nl', 'pt', 'sv', 'da', 'pl', 'el', 'fi', 'hi'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

/**
 * Locale configuration with formatting preferences
 */
export interface LocaleConfig {
  name: string;
  nativeName: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  numberFormat: {
    decimal: string;
    thousands: string;
  };
  flag: string;
}

export const localeConfig: Record<SupportedLocale, LocaleConfig> = {
  en: {
    name: 'English',
    nativeName: 'English',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: '.', thousands: ',' },
    flag: '🇬🇧',
  },
  de: {
    name: 'German',
    nativeName: 'Deutsch',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: '.' },
    flag: '🇩🇪',
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: ' ' },
    flag: '🇫🇷',
  },
  it: {
    name: 'Italian',
    nativeName: 'Italiano',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: '.' },
    flag: '🇮🇹',
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: '.' },
    flag: '🇪🇸',
  },
  nl: {
    name: 'Dutch',
    nativeName: 'Nederlands',
    dateFormat: 'DD-MM-YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: '.' },
    flag: '🇳🇱',
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: ' ' },
    flag: '🇵🇹',
  },
  sv: {
    name: 'Swedish',
    nativeName: 'Svenska',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
    currency: 'SEK',
    numberFormat: { decimal: ',', thousands: ' ' },
    flag: '🇸🇪',
  },
  da: {
    name: 'Danish',
    nativeName: 'Dansk',
    dateFormat: 'DD-MM-YYYY',
    timeFormat: 'HH:mm',
    currency: 'DKK',
    numberFormat: { decimal: ',', thousands: '.' },
    flag: '🇩🇰',
  },
  pl: {
    name: 'Polish',
    nativeName: 'Polski',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
    currency: 'PLN',
    numberFormat: { decimal: ',', thousands: ' ' },
    flag: '🇵🇱',
  },
  el: {
    name: 'Greek',
    nativeName: 'Ελληνικά',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: '.' },
    flag: '🇬🇷',
  },
  fi: {
    name: 'Finnish',
    nativeName: 'Suomi',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    numberFormat: { decimal: ',', thousands: ' ' },
    flag: '🇫🇮',
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिन्दी',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currency: 'INR',
    numberFormat: { decimal: '.', thousands: ',' },
    flag: '🇮🇳',
  },
};

/**
 * Translation namespaces
 */
export const namespaces = [
  'common',
  'navigation',
  'races',
  'scoring',
  'ai',
  'settings',
  'errors',
  'auth',
] as const;

export type TranslationNamespace = (typeof namespaces)[number];

// ============================================================================
// Resources
// ============================================================================

const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    races: enRaces,
    scoring: enScoring,
    ai: enAi,
    settings: enSettings,
    errors: enErrors,
    auth: enAuth,
  },
  de: {
    common: deCommon,
    navigation: deNavigation,
    races: deRaces,
    scoring: deScoring,
    ai: deAi,
    settings: deSettings,
    errors: deErrors,
    auth: enAuth,
  },
  fr: {
    common: frCommon,
    navigation: frNavigation,
    races: frRaces,
    scoring: frScoring,
    ai: frAi,
    settings: frSettings,
    errors: frErrors,
    auth: enAuth,
  },
  it: {
    common: itCommon,
    navigation: itNavigation,
    races: itRaces,
    scoring: itScoring,
    ai: itAi,
    settings: itSettings,
    errors: itErrors,
    auth: enAuth,
  },
  es: {
    common: esCommon,
    navigation: esNavigation,
    races: esRaces,
    scoring: esScoring,
    ai: esAi,
    settings: esSettings,
    errors: esErrors,
    auth: enAuth,
  },
  nl: {
    common: nlCommon,
    navigation: nlNavigation,
    races: nlRaces,
    scoring: nlScoring,
    ai: nlAi,
    settings: nlSettings,
    errors: nlErrors,
    auth: enAuth,
  },
  pt: {
    common: ptCommon,
    navigation: ptNavigation,
    races: ptRaces,
    scoring: ptScoring,
    ai: ptAi,
    settings: ptSettings,
    errors: ptErrors,
    auth: enAuth,
  },
  sv: {
    common: svCommon,
    navigation: svNavigation,
    races: svRaces,
    scoring: svScoring,
    ai: svAi,
    settings: svSettings,
    errors: svErrors,
    auth: enAuth,
  },
  da: {
    common: daCommon,
    navigation: daNavigation,
    races: daRaces,
    scoring: daScoring,
    ai: daAi,
    settings: daSettings,
    errors: daErrors,
    auth: enAuth,
  },
  pl: {
    common: plCommon,
    navigation: plNavigation,
    races: plRaces,
    scoring: plScoring,
    ai: plAi,
    settings: plSettings,
    errors: plErrors,
    auth: enAuth,
  },
  el: {
    common: elCommon,
    navigation: elNavigation,
    races: elRaces,
    scoring: elScoring,
    ai: elAi,
    settings: elSettings,
    errors: elErrors,
    auth: enAuth,
  },
  fi: {
    common: fiCommon,
    navigation: fiNavigation,
    races: fiRaces,
    scoring: fiScoring,
    ai: fiAi,
    settings: fiSettings,
    errors: fiErrors,
    auth: enAuth,
  },
  hi: {
    common: hiCommon,
    navigation: hiNavigation,
    races: hiRaces,
    scoring: hiScoring,
    ai: hiAi,
    settings: hiSettings,
    errors: hiErrors,
    auth: hiAuth,
  },
};

// ============================================================================
// Initialization
// ============================================================================

/**
 * Detect device locale and return supported locale
 */
function getDeviceLocale(): SupportedLocale {
  try {
    // Use getLocales() API (expo-localization 14+)
    const locales = Localization.getLocales();
    if (!locales || locales.length === 0) {
      return 'en';
    }
    const deviceLocale = locales[0].languageCode?.toLowerCase();
    if (deviceLocale && supportedLocales.includes(deviceLocale as SupportedLocale)) {
      return deviceLocale as SupportedLocale;
    }
  } catch (error) {
    console.warn('Failed to detect device locale:', error);
  }
  return 'en';
}

/**
 * Initialize i18next
 */
i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLocale(),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: namespaces as unknown as string[],

  interpolation: {
    escapeValue: false, // React already escapes
  },

  react: {
    useSuspense: false, // Disable suspense for React Native
  },

  // Debug in development (disabled to reduce console noise)
  debug: false,

  // Missing key handling
  saveMissing: __DEV__,
  missingKeyHandler: (lngs, ns, key) => {
    if (__DEV__) {
      console.warn(`Missing translation: ${ns}:${key} for languages: ${lngs.join(', ')}`);
    }
  },
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Change the current language
 */
export async function changeLanguage(locale: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(locale);
}

/**
 * Get the current language
 */
export function getCurrentLocale(): SupportedLocale {
  const current = i18n.language;
  if (supportedLocales.includes(current as SupportedLocale)) {
    return current as SupportedLocale;
  }
  return 'en';
}

/**
 * Get locale config for current language
 */
export function getCurrentLocaleConfig(): LocaleConfig {
  return localeConfig[getCurrentLocale()];
}

/**
 * Check if a locale is supported
 */
export function isLocaleSupported(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}

export default i18n;
