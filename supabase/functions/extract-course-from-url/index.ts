/**
 * Extract Course from URL Edge Function
 * Fetches content from a URL and extracts course waypoints using AI
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { complete } from '../_shared/ai/provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RouteWaypoint {
  name: string;
  latitude: number;
  longitude: number;
  type: 'start' | 'waypoint' | 'gate' | 'finish' | 'mark';
  passingSide?: 'port' | 'starboard' | 'either';
  notes?: string;
}

const EXTRACTION_PROMPT = `You are an expert sailing race course analyst. Extract all course waypoints and marks from this content.

For each waypoint/mark found, extract:
1. Name (e.g., "Start Line", "Mark 1", "Windward Mark", "Gate Left", "Finish")
2. Coordinates (latitude and longitude in decimal degrees)
3. Type: one of "start", "waypoint", "gate", "finish", or "mark"
4. Passing side if specified: "port", "starboard", or "either"
5. Any notes about rounding or specific instructions

Return a JSON object with this exact structure:
{
  "courseName": "Name of the course if found",
  "totalDistanceNm": number or null,
  "courseDescription": "Brief description if available",
  "waypoints": [
    {
      "name": "Start",
      "latitude": 22.2855,
      "longitude": 114.1577,
      "type": "start",
      "passingSide": null,
      "notes": null
    }
  ]
}

Important:
- Convert ALL coordinates to decimal degrees (positive for N/E, negative for S/W)
- If DMS format (22°17'08"N), convert to decimal (22.2855)
- Extract every waypoint mentioned with coordinates
- Infer waypoint type from context if not explicit
- Return empty waypoints array if no valid coordinates found`;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, raceType } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'No URL provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the URL content
    let pageContent: string;
    let contentType: string;
    
    try {
      // Set a timeout for the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BetterAt/1.0; Sailing Race Course Extractor)',
          'Accept': 'text/html,text/plain,*/*',
        },
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      contentType = response.headers.get('content-type') || 'text/html';
      
      // PDFs cannot be processed via URL - use document upload instead
      if (contentType.includes('pdf')) {
        return new Response(
          JSON.stringify({ 
            error: 'PDF files cannot be processed via URL. Please use the Upload tab to upload the PDF directly.',
            waypoints: []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      pageContent = await response.text();
    } catch (fetchError: any) {
      console.error('[extract-course-url] Fetch error:', fetchError);
      const message = fetchError.name === 'AbortError' 
        ? 'Request timed out. The page took too long to load.'
        : `Could not fetch URL: ${fetchError.message}`;
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For HTML/text content, strip HTML tags and limit size
    let cleanContent = pageContent;
    if (contentType.includes('html')) {
      // Remove scripts, styles, and HTML tags
      cleanContent = pageContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Limit content size
    if (cleanContent.length > 50000) {
      cleanContent = cleanContent.substring(0, 50000);
    }

    const raceContext = raceType === 'distance'
      ? 'This is a DISTANCE/OFFSHORE race. Look for route waypoints, turning marks, and course coordinates that define a long-distance sailing route.'
      : 'This is a FLEET race. Look for windward/leeward marks, gate marks, start/finish lines, and buoy racing course elements.';

    let responseText: string;
    try {
      const result = await complete({
        task: 'extraction',
        messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\n${raceContext}\n\nURL: ${url}\n\nPage content:\n${cleanContent}` }],
        maxOutputTokens: 2048,
      });
      responseText = result.text;
    } catch (aiError: any) {
      console.error('[extract-course-url] AI error:', aiError.message);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON from response
    let result: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('[extract-course-url] Parse error:', parseError);
      result = { waypoints: [] };
    }

    // Validate waypoints
    const validWaypoints = (result.waypoints || []).filter((wp: RouteWaypoint) => {
      return (
        typeof wp.latitude === 'number' &&
        typeof wp.longitude === 'number' &&
        !isNaN(wp.latitude) &&
        !isNaN(wp.longitude) &&
        wp.latitude >= -90 && wp.latitude <= 90 &&
        wp.longitude >= -180 && wp.longitude <= 180
      );
    });

    return new Response(
      JSON.stringify({
        waypoints: validWaypoints,
        courseName: result.courseName,
        totalDistanceNm: result.totalDistanceNm,
        courseDescription: result.courseDescription,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[extract-course-url] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract course data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
