import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PIIRedactionService');

const PATTERNS: { name: string; re: RegExp; replacement: string }[] = [
  { name: 'mrn', re: /\b(MRN|Mrn|mrn)[:#\s-]*\d{4,12}\b/g, replacement: '[MRN redacted]' },
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN redacted]' },
  { name: 'phone', re: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[phone redacted]' },
  { name: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[email redacted]' },
  { name: 'dob', re: /\b(DOB|Dob|dob)[:#\s-]*\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, replacement: '[DOB redacted]' },
  { name: 'patient-name-prefix', re: /\b(Mr|Mrs|Ms|Dr|Patient|Pt)\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, replacement: '[patient redacted]' },
];

const NAME_HINTS = /\bpatient\b|\bmrn\b|\bdob\b|\broom\s*\d+\b/i;

export interface RedactionResult {
  redacted: string;
  hits: { pattern: string; count: number }[];
  totalHits: number;
  highRiskBlocked: boolean;
}

export function scrubPII(input: string): RedactionResult {
  let text = input;
  const hits: RedactionResult['hits'] = [];

  for (const pattern of PATTERNS) {
    const matches = text.match(pattern.re);
    if (matches && matches.length > 0) {
      hits.push({ pattern: pattern.name, count: matches.length });
      text = text.replace(pattern.re, pattern.replacement);
    }
  }

  // Heuristic: if the body still mentions patient/MRN/DOB/room together with
  // any digits, we treat it as high-risk and block the share.
  const highRiskBlocked =
    NAME_HINTS.test(text) && /\d/.test(text) && hits.length === 0;

  if (hits.length > 0 || highRiskBlocked) {
    logger.warn('PII scrub hit', { hits, highRiskBlocked });
  }

  return {
    redacted: text,
    hits,
    totalHits: hits.reduce((sum, h) => sum + h.count, 0),
    highRiskBlocked,
  };
}

export class PIIScrubBlocked extends Error {
  constructor(message = 'Capture blocked: contains patient identifiers we cannot share automatically.') {
    super(message);
    this.name = 'PIIScrubBlocked';
  }
}
