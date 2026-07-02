import { initialsForName } from '@/components/discover/canonical';

const CONNECTOR_WORDS = /^(the|of|and|de|le|la|von)$/i;

function hasLetter(value: string | null | undefined): boolean {
  return /\p{L}/u.test(value ?? '');
}

function meaningfulName(value: string): string {
  const words = value
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word && !CONNECTOR_WORDS.test(word))
    .filter((word) => hasLetter(word));
  return words.join(' ');
}

export function initialsForGroup(
  preferred: string | null | undefined,
  fallback: string,
): string {
  const source = hasLetter(preferred) ? preferred ?? '' : fallback;
  const meaningful = meaningfulName(source) || meaningfulName(fallback);
  return initialsForName(meaningful || fallback);
}
