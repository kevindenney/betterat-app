import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts';

// Use pdf-parse library via npm specifier
import pdf from "npm:pdf-parse@1.1.1";
// Import Buffer from Node.js compatibility layer
import { Buffer } from "node:buffer";

/**
 * Extract Text from PDF Edge Function
 * Fetches a PDF from URL and extracts text using pdf-parse library
 */

/**
 * Check if bytes represent a valid PDF (starts with %PDF-)
 */
function isPdfContent(bytes: Uint8Array): boolean {
  return bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2D;   // -
}

/**
 * Check if bytes represent HTML content
 */
function isHtmlContent(bytes: Uint8Array): boolean {
  const firstChars = new TextDecoder().decode(bytes.slice(0, 500)).toLowerCase();
  return firstChars.includes('<!doctype') ||
         firstChars.includes('<html') ||
         firstChars.includes('<head') ||
         firstChars.includes('<body');
}

/**
 * Generate browser-like headers for fetching PDFs
 */
function getBrowserHeaders(url: string, minimal = false): Record<string, string> {
  const origin = new URL(url).origin;

  if (minimal) {
    // Minimal headers - some servers reject "too perfect" browser signatures
    return {
      'User-Agent': 'Mozilla/5.0 (compatible; PDFBot/1.0)',
      'Accept': '*/*',
    };
  }

  // Full browser headers to mimic real Chrome browser
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/pdf,application/octet-stream,*/*;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': origin + '/',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };
}

/**
 * Reject URLs that point to private/internal network ranges (SSRF prevention).
 */
function isPrivateUrl(urlString: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(urlString).hostname;
  } catch {
    return true;
  }

  if (hostname === 'localhost' || hostname === '::1') return true;

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }

  return false;
}

/**
 * Fetch PDF with retry logic and different header strategies
 */
async function fetchPdfWithRetry(url: string): Promise<{
  success: boolean;
  buffer?: ArrayBuffer;
  error?: string;
  finalUrl?: string;
  contentType?: string;
}> {
  const strategies = [
    { name: 'full browser headers', minimal: false },
    { name: 'minimal headers', minimal: true },
  ];

  for (const strategy of strategies) {
    try {
      const headers = getBrowserHeaders(url, strategy.minimal);
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
      });

      const finalUrl = response.url;
      const contentType = response.headers.get('content-type') || 'unknown';

      if (!response.ok) {
        continue;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (isPdfContent(bytes)) {
        return { success: true, buffer, finalUrl, contentType };
      }

      if (isHtmlContent(bytes)) {
        continue;
      }

      // Not PDF and not HTML - might be a different binary format, check content-type
      if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
        return {
          success: false,
          error: `Server returned content-type "${contentType}" but file doesn't appear to be a valid PDF.`,
          finalUrl,
          contentType
        };
      }

      continue;

    } catch (fetchError) {
      continue;
    }
  }

  return {
    success: false,
    error: 'Could not fetch PDF. The server may be blocking automated requests or returning a login/error page. Try downloading the PDF manually and uploading it directly.'
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'No URL provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (parsedUrl.protocol !== 'https:') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only https:// URLs are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isPrivateUrl(url)) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is disallowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the PDF with retry logic
    const fetchResult = await fetchPdfWithRetry(url);

    if (!fetchResult.success || !fetchResult.buffer) {
      return new Response(
        JSON.stringify({
          success: false,
          error: fetchResult.error || 'Failed to fetch PDF',
          details: {
            requestedUrl: url,
            finalUrl: fetchResult.finalUrl,
            contentType: fetchResult.contentType,
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get PDF as ArrayBuffer
    const pdfBuffer = fetchResult.buffer;
    const pdfBytes = new Uint8Array(pdfBuffer)

    // Extract text using pdf-parse
    // Convert Uint8Array to Buffer for pdf-parse
    const buffer = Buffer.from(pdfBuffer);

    const data = await pdf(buffer);

    const extractedText = data.text || '';

    if (!extractedText || extractedText.trim().length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not extract meaningful text from this PDF. The PDF may be image-based or corrupted.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: extractedText,
        pdfSize: pdfBytes.length,
        numPages: data.numpages,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-pdf-text] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
