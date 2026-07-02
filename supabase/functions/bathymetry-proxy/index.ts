import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Bathymetry Proxy Edge Function
 *
 * Proxies requests to Open Topo Data GEBCO API to avoid CORS issues.
 * Supports batching up to 100 locations per request.
 *
 * Open Topo Data limits:
 * - 1 call/second
 * - 1000 calls/day
 * - 100 locations per request
 *
 * Usage:
 * POST /bathymetry-proxy
 * Body: { locations: [{ lat: number, lng: number }, ...] }
 *
 * Response:
 * { results: [{ elevation: number, location: { lat, lng } }, ...], status: "OK" }
 */

interface LocationInput {
  lat: number;
  lng: number;
}

interface ElevationResult {
  elevation: number | null;
  location: {
    lat: number;
    lng: number;
  };
}

interface OpenTopoDataResponse {
  results: {
    elevation: number | null;
    location: {
      lat: number;
      lng: number;
    };
  }[];
  status: string;
  error?: string;
}

const OPEN_TOPO_DATA_URL = 'https://api.opentopodata.org/v1/gebco2020';
const MAX_LOCATIONS_PER_REQUEST = 100;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const body = await req.json()
    const locations: LocationInput[] = body.locations

    // Validate input
    if (!locations || !Array.isArray(locations)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid locations array' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (locations.length === 0) {
      return new Response(
        JSON.stringify({ results: [], status: 'OK' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (locations.length > MAX_LOCATIONS_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: `Too many locations. Maximum ${MAX_LOCATIONS_PER_REQUEST} per request.`,
          received: locations.length
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate each location
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i]
      if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
        return new Response(
          JSON.stringify({
            error: `Invalid location at index ${i}. Expected { lat: number, lng: number }`,
            received: loc
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180) {
        return new Response(
          JSON.stringify({
            error: `Invalid coordinates at index ${i}. Lat must be -90 to 90, lng must be -180 to 180.`,
            received: loc
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Build the locations parameter for Open Topo Data
    // Format: lat1,lng1|lat2,lng2|lat3,lng3...
    const locationsParam = locations
      .map(loc => `${loc.lat},${loc.lng}`)
      .join('|')

    const url = `${OPEN_TOPO_DATA_URL}?locations=${locationsParam}`

    console.log('[bathymetry-proxy] Fetching elevations for', locations.length, 'locations')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BetterAt/1.0 (sailing-app)'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[bathymetry-proxy] Open Topo Data error:', response.status, errorText)

      // Check for rate limiting
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Rate limited by Open Topo Data. Please wait and try again.',
            status: 'RATE_LIMITED'
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': '2'
            }
          }
        )
      }

      return new Response(
        JSON.stringify({
          error: `Open Topo Data returned ${response.status}`,
          details: errorText
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data: OpenTopoDataResponse = await response.json()

    if (data.status !== 'OK') {
      console.error('[bathymetry-proxy] Open Topo Data status not OK:', data)
      return new Response(
        JSON.stringify({
          error: data.error || 'Open Topo Data returned non-OK status',
          status: data.status
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('[bathymetry-proxy] Successfully fetched', data.results?.length || 0, 'elevation points')

    // Return the results
    return new Response(
      JSON.stringify({
        results: data.results,
        status: 'OK'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // Cache for 1 year - bathymetry doesn't change
          'Cache-Control': 'public, max-age=31536000'
        }
      }
    )

  } catch (error) {
    console.error('[bathymetry-proxy] Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
