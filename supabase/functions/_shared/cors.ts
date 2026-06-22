const ALLOWED_ORIGINS = [
  'https://regattaflow-app.vercel.app',
  'https://www.betterat.com',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:19006',
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Returns CORS headers with a specific allowed origin.
 * Checks the request's Origin header against the allowlist; falls back to
 * the first allowed origin if no match (never reflects arbitrary origins).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get('origin') ?? '';
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'],
    'Access-Control-Allow-Methods': corsHeaders['Access-Control-Allow-Methods'],
  };
}
