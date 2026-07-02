/**
 * Extract Course from Document Edge Function
 * Uses AI to extract waypoints and course data from PDFs and images
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { complete, type ContentPart } from '../_shared/ai/provider.ts';

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

interface ExtractionResult {
  waypoints: RouteWaypoint[];
  courseName?: string;
  totalDistanceNm?: number;
  courseDescription?: string;
  startLocationName?: string | null;
  finishLocationName?: string | null;
  rawExtraction?: any;
}

/**
 * Geocode start/finish location names and add them as waypoints
 */
async function geocodeStartFinishLocations(
  existingWaypoints: RouteWaypoint[],
  startLocationName?: string | null,
  finishLocationName?: string | null
): Promise<RouteWaypoint[]> {
  const waypoints = [...existingWaypoints];
  
  // Check if start waypoint already exists
  const hasStart = waypoints.some(wp => wp.type === 'start');
  
  // Geocode start location if name is provided and no start waypoint exists
  if (startLocationName && !hasStart) {
    try {
      const startQuery = `${startLocationName}, Hong Kong`;
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q: startQuery,
        format: 'json',
        limit: '1',
        countrycodes: 'hk',
      })}`;
      
      const response = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'BetterAt/1.0 (Sailing Race Management App)',
        },
      });
      
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          const startWaypoint: RouteWaypoint = {
            name: `Start - ${startLocationName}`,
            latitude: parseFloat(results[0].lat),
            longitude: parseFloat(results[0].lon),
            type: 'start',
            notes: `Start location at ${startLocationName} (geocoded)`,
          };
          
          // Insert at the beginning (point 0)
          waypoints.unshift(startWaypoint);
        }
      }
    } catch (error) {
      console.warn(`[extract-course] Failed to geocode start location: ${startLocationName}`, error);
    }
  }
  
  // Check if finish waypoint already exists
  const hasFinish = waypoints.some(wp => wp.type === 'finish');
  
  // Geocode finish location if name is provided and no finish waypoint exists
  if (finishLocationName && !hasFinish) {
    try {
      const finishQuery = `${finishLocationName}, Hong Kong`;
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q: finishQuery,
        format: 'json',
        limit: '1',
        countrycodes: 'hk',
      })}`;
      
      const response = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'BetterAt/1.0 (Sailing Race Management App)',
        },
      });
      
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          const finishWaypoint: RouteWaypoint = {
            name: `Finish - ${finishLocationName}`,
            latitude: parseFloat(results[0].lat),
            longitude: parseFloat(results[0].lon),
            type: 'finish',
            notes: `Finish location at ${finishLocationName} (geocoded)`,
          };
          
          // Add at the end (last point)
          waypoints.push(finishWaypoint);
        }
      }
    } catch (error) {
      console.warn(`[extract-course] Failed to geocode finish location: ${finishLocationName}`, error);
    }
  }
  
  return waypoints;
}

const EXTRACTION_PROMPT = `You are an expert sailing race course analyst. Extract all course waypoints and marks from this document.

For each waypoint/mark found, extract:
1. Name (e.g., "Start Line", "Mark 1", "Windward Mark", "Gate Left", "Finish")
2. Coordinates (latitude and longitude in decimal degrees)
3. Type: one of "start", "waypoint", "gate", "finish", or "mark"
4. Passing side if specified: "port", "starboard", or "either"
5. Any notes about rounding or specific instructions

Look for:
- Start/finish line coordinates
- **CRITICAL: Start location names even if coordinates aren't provided** (e.g., "Tai Tam Bay", "starting line will be laid in [location]")
- **CRITICAL: Finish location names even if coordinates aren't provided** (e.g., "ABC Main Club", "Race Safety Control Centre at [location]")
- Course marks and buoys
- Gate marks
- Turning points
- Waypoints in offshore/distance races
- Coordinates in any format (decimal degrees, degrees/minutes/seconds, etc.)

Return a JSON object with this exact structure:
{
  "courseName": "Name of the course if found",
  "totalDistanceNm": number or null,
  "courseDescription": "Brief description if available",
  "startLocationName": "Location name if mentioned (e.g., 'Tai Tam Bay')" or null,
  "finishLocationName": "Location name if mentioned (e.g., 'ABC Main Club')" or null,
  "waypoints": [
    {
      "name": "Start",
      "latitude": 22.2855,
      "longitude": 114.1577,
      "type": "start",
      "passingSide": null,
      "notes": "Start line between committee boat and pin"
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
    const { fileContent, fileName, fileType, raceType } = await req.json();

    if (!fileContent) {
      return new Response(
        JSON.stringify({ error: 'No file content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare content parts
    const contentParts: ContentPart[] = [];

    // Add context about the race type
    const raceContext = raceType === 'distance'
      ? 'This is a DISTANCE/OFFSHORE race. Look for route waypoints, turning marks, and course coordinates that define a long-distance sailing route.'
      : 'This is a FLEET race. Look for windward/leeward marks, gate marks, start/finish lines, and buoy racing course elements.';

    if (fileType?.startsWith('image/') || fileContent.startsWith('data:image')) {
      // Image file
      const base64Data = fileContent.includes('base64,')
        ? fileContent.split('base64,')[1]
        : fileContent;

      const mediaType = fileType || 'image/jpeg';

      contentParts.push({
        type: 'inline_data', mimeType: mediaType, data: base64Data,
      });
      contentParts.push({
        type: 'text', text: `${EXTRACTION_PROMPT}\n\n${raceContext}\n\nAnalyze this image (${fileName || 'course image'}) and extract all course waypoints and coordinates.`,
      });
    } else if (fileType === 'application/pdf' || fileContent.startsWith('data:application/pdf')) {
      // PDF file
      const base64Data = fileContent.includes('base64,')
        ? fileContent.split('base64,')[1]
        : fileContent;

      contentParts.push({
        type: 'inline_data', mimeType: 'application/pdf', data: base64Data,
      });
      contentParts.push({
        type: 'text', text: `${EXTRACTION_PROMPT}\n\n${raceContext}\n\nAnalyze this PDF document (${fileName || 'sailing instructions'}) and extract all course waypoints and coordinates.`,
      });
    } else {
      // Text content
      const textContent = fileContent.includes('base64,')
        ? atob(fileContent.split('base64,')[1])
        : fileContent;

      contentParts.push({
        type: 'text', text: `${EXTRACTION_PROMPT}\n\n${raceContext}\n\nDocument content (${fileName || 'course document'}):\n\n${textContent}`,
      });
    }

    // Call AI provider for extraction
    let responseText: string;
    try {
      const result = await complete({
        task: 'extraction',
        messages: [{ role: 'user', content: contentParts }],
        maxOutputTokens: 4096,
      });
      responseText = result.text;
    } catch (aiError: any) {
      console.error('[extract-course] AI error:', aiError.message);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON from response
    let result: ExtractionResult;
    try {
      // Find JSON in response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[extract-course] Parse error:', parseError);
      result = {
        waypoints: [],
        rawExtraction: responseText,
      };
    }

    // Validate and clean waypoints
    const validWaypoints = (result.waypoints || []).filter((wp: RouteWaypoint) => {
      return (
        typeof wp.latitude === 'number' &&
        typeof wp.longitude === 'number' &&
        !isNaN(wp.latitude) &&
        !isNaN(wp.longitude) &&
        wp.latitude >= -90 && wp.latitude <= 90 &&
        wp.longitude >= -180 && wp.longitude <= 180
      );
    }).map((wp: RouteWaypoint) => ({
      name: wp.name || 'Unnamed',
      latitude: wp.latitude,
      longitude: wp.longitude,
      type: wp.type || 'waypoint',
      passingSide: wp.passingSide || undefined,
      notes: wp.notes || undefined,
    }));

    // Geocode start/finish location names if provided
    const finalWaypoints = await geocodeStartFinishLocations(
      validWaypoints,
      result.startLocationName,
      result.finishLocationName
    );

    return new Response(
      JSON.stringify({
        waypoints: finalWaypoints,
        courseName: result.courseName,
        totalDistanceNm: result.totalDistanceNm,
        courseDescription: result.courseDescription,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[extract-course] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract course data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
