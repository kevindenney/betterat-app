import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { complete } from '../_shared/ai/provider.ts';

/**
 * Enhanced Race Extraction Edge Function
 * - Detects single race OR multiple races (series/calendar)
 * - Extracts comprehensive fields from NOR/SI documents
 * - Returns multi-race data when calendar detected
 * - Includes source tracking for provenance
 */

/**
 * Build source tracking information for document provenance
 */
function buildSourceTracking(extractedData: any, sourceUrl?: string): {
  sourceType: 'url' | 'paste';
  sourceUrl?: string;
  extractedFields: string[];
  fieldConfidence: Record<string, number>;
  documentType: string;
} {
  const extractedFields: string[] = [];
  const fieldConfidence: Record<string, number> = {};

  // Helper to recursively extract field paths with values
  function extractFieldsFromObject(obj: any, prefix = ''): void {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      // Skip metadata fields
      if (['confidenceScores', 'multipleRaces', 'documentType', 'overallConfidence'].includes(key)) {
        continue;
      }

      if (value === null || value === undefined) {
        // Skip null/undefined values
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          extractedFields.push(path);
          // For arrays, recurse into first element for nested fields
          if (typeof value[0] === 'object') {
            extractFieldsFromObject(value[0], `${path}[0]`);
          }
        }
      } else if (typeof value === 'object') {
        extractFieldsFromObject(value, path);
      } else if (value !== '' && value !== 0) {
        extractedFields.push(path);
      }
    }
  }

  // Extract fields from first race (or all races for multi-race)
  if (extractedData.races && extractedData.races.length > 0) {
    const firstRace = extractedData.races[0];
    extractFieldsFromObject(firstRace, 'races[0]');

    // Build confidence scores from the race's confidenceScores if available
    if (firstRace.confidenceScores) {
      for (const [field, score] of Object.entries(firstRace.confidenceScores)) {
        if (typeof score === 'number') {
          fieldConfidence[`races[0].${field}`] = score;
        }
      }
    }
  }

  // Also extract top-level fields
  extractFieldsFromObject({
    organizingAuthority: extractedData.organizingAuthority,
  });

  // Add overall confidence
  if (extractedData.overallConfidence) {
    fieldConfidence['overall'] = extractedData.overallConfidence;
  }

  return {
    sourceType: sourceUrl ? 'url' : 'paste',
    sourceUrl: sourceUrl || undefined,
    extractedFields,
    fieldConfidence,
    documentType: extractedData.documentType || 'OTHER',
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      text,
      url,
      compactMode = false,
      currentDate,
      includePast = true,
    }: {
      text?: string;
      url?: string;
      compactMode?: boolean;
      currentDate?: string;
      includePast?: boolean;
    } = await req.json();

    // Default currentDate to today (UTC) if not provided
    const todayIso = currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)
      ? currentDate
      : new Date().toISOString().split('T')[0];

    // Determine the document text - either provided directly or fetched from URL
    let documentText = text;

    if (!documentText && url) {
      try {
        const urlResponse = await fetch(url, {
          headers: {
            'User-Agent': 'BetterAt/1.0 (Document Extraction)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
          },
        });

        if (!urlResponse.ok) {
          console.error('[extract-race-details] Failed to fetch URL:', urlResponse.status, urlResponse.statusText);
          return new Response(
            JSON.stringify({ error: `Failed to fetch URL: ${urlResponse.status} ${urlResponse.statusText}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const contentType = urlResponse.headers.get('content-type') || '';

        if (contentType.includes('application/pdf')) {
          // PDF handling - for now, return an error suggesting text extraction
          // TODO: Add PDF parsing library (like pdf-parse) in the future
          return new Response(
            JSON.stringify({
              error: 'PDF documents are not yet supported for URL extraction. Please copy and paste the text content instead.',
              contentType: contentType
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        documentText = await urlResponse.text();

        // Clean up HTML if the content appears to be HTML
        if (contentType.includes('text/html') || documentText.trim().startsWith('<!DOCTYPE') || documentText.trim().startsWith('<html')) {
          // Basic HTML to text conversion - strip tags and decode entities
          documentText = documentText
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
            .replace(/<[^>]+>/g, ' ')                          // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
            .replace(/\s+/g, ' ')                              // Normalize whitespace
            .trim();
        }
      } catch (fetchError) {
        console.error('[extract-race-details] Error fetching URL:', fetchError);
        return new Response(
          JSON.stringify({ error: `Failed to fetch URL: ${fetchError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!documentText || documentText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No text or URL provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === COMPACT / CALENDAR MODE ===
    // Used for season calendar PDFs that contain 50-200+ races.
    // Skips the comprehensive schema and just extracts the per-race essentials,
    // so we can fit a full season in the AI's output token budget.
    const compactPrompt = `You are extracting races from a sailing season calendar.

Your job: enumerate EVERY race day in the document.${includePast ? '' : `

DATE FILTER: Today is ${todayIso}. SKIP any race whose raceDate is BEFORE ${todayIso}. Only include races on or after ${todayIso}.`}

Document:
${documentText}

Return JSON ONLY (no prose, no markdown), in this EXACT shape:

{
  "multipleRaces": true,
  "documentType": "CALENDAR",
  "organizingAuthority": string | null,
  "overallConfidence": number,
  "races": [
    {
      "raceName": string,                  // e.g., "Around the Island Race", "Croucher Series Race 1"
      "raceSeriesName": string | null,     // e.g., "Croucher Series" — null if standalone
      "raceDate": string | null,           // ISO 8601 (YYYY-MM-DD). NEVER guess.
      "venue": string,                     // The host club / sailing venue (e.g., "Royal Hong Kong Yacht Club")
      "venueVariant": string | null,       // Sub-area if specified (e.g., "Port Shelter", "Middle Island", "Harbour")
      "warningSignalTime": string | null,  // HH:MM (24h). Strip "hrs" suffix.
      "eligibleClasses": string[] | null,  // e.g., ["IRC", "PHS", "Dragon"]
      "raceType": "fleet" | "distance" | null,
      "notes": string | null               // Anything else worth preserving in 1 short sentence
    }
  ]
}

CRITICAL RULES:
1. EXTRACT EVERY RACE DAY. A season calendar typically has 50-200+ entries. Do not stop early.
2. ONE entry per race day per series. If the calendar lists the same date for "IRC Division 1" and "IRC Division 2" as part of the same race, that is ONE race entry — combine the divisions into eligibleClasses.
3. NEVER invent dates. If a row has no clear date, set raceDate to null.
4. Common venue abbreviations: RHKYC = Royal Hong Kong Yacht Club, ABC = Aberdeen Boat Club, HHYC = Hebe Haven Yacht Club, RHKABT = Royal Hong Kong Yacht Club (some references). Expand to the full club name in the "venue" field. If the row only shows a single-letter code (M, L, H, etc.) and you cannot confidently expand it, set venue to "Unknown" rather than guessing.
5. Tabular text in calendar PDFs is often jumbled. Use the date column and race-name column as the source of truth; ignore garbled single-letter cells.
6. warningSignalTime: only set if explicitly stated in the schedule.
7. Resolve dates relative to the calendar's stated season (e.g., "Saturday 27 September" in a 2025-2026 calendar → "2025-09-27").
8. ALWAYS set documentType to "CALENDAR".${includePast ? '' : `
9. Today is ${todayIso}. Skip any race before this date.`}

Return ONLY the JSON object.`;

    // Call Gemini Flash with enhanced multi-race detection prompt
    const extractionPrompt = `You are an expert at extracting structured race information from sailing documents (NOR, SI, calendars).

CRITICAL: First determine if this document contains:
1. **SINGLE RACE**: One race event with one date
2. **RACE SERIES**: Multiple races under one series name (e.g., "Croucher Series")
3. **MULTIPLE SERIES**: Multiple distinct race series (e.g., "Croucher Series", "Corinthian Series")

**TOKEN EFFICIENCY FOR MULTI-RACE DOCUMENTS:**
When extracting multiple race days from a series document:
- Extract COMMON fields (rules, eligibility, scoring, safety, etc.) at the document level (in the top-level fields)
- For EACH RACE DAY, only include the UNIQUE/VARYING fields: raceName, raceSeriesName, raceDate, venue, venueVariant, warningSignalTime, racesPerDay
- DO NOT repeat identical information across race entries - keep them minimal
- This allows extracting 15+ race days without hitting token limits

IMPORTANT: You MUST extract ALL race days from ALL series. If you see 5 series with 3 race days each, create 15 race entries!

Document:
${documentText}

Return a JSON object with this EXACT structure:

{
  "multipleRaces": boolean,  // true if document contains 2+ races/series
  "races": [  // Array of race objects (even if just one race)
    {
      // === RACE TYPE (Fleet vs Distance) ===
      // IMPORTANT: Detect race type from document content
      "raceType": "fleet" | "distance",  // "fleet" = buoy/mark racing, "distance" = offshore/passage racing
      // Distance race indicators: "offshore", "distance race", "circumnavigation", "around the island", 
      // "passage race", "point-to-point", waypoint coordinates, total distance in nm, time limits in hours
      // Fleet race indicators: "windward/leeward", "mark rounding", "course mark", "start sequence", 
      // "class start", multiple classes, course selection criteria
      
      // === BASIC INFORMATION ===
      "raceName": string,  // Full race name (include series name if applicable, e.g., "Croucher Series Race 1")
      "raceSeriesName": string | null,  // Series name if part of a series (e.g., "Croucher Series")
      "raceDate": string | null,  // ISO 8601 format (YYYY-MM-DD). MUST be null if no specific date is stated in the document. NEVER guess or invent dates.
      "venue": string,
      "venueVariant": string | null,  // If venue changes per race (e.g., "Port Shelter", "Clearwater Bay")
      "description": string | null,

      // === TIMING & SCHEDULE ===
      "warningSignalTime": string | null,  // HH:MM format or "HHMMhrs"
      "racesPerDay": number | null,
      "raceNumber": number | null,  // Race number within series
      "totalRacesInSeries": number | null,

      // === MULTI-DAY EVENT SCHEDULE (for events spanning multiple days) ===
      "schedule": [  // Array of ALL scheduled events in chronological order
        {
          "date": string,  // YYYY-MM-DD format
          "time": string,  // HH:MM or HHMMhrs format
          "event": string,  // e.g., "Skippers Briefing", "Race Start", "Race Finish Deadline", "Prize Giving"
          "location": string | null,  // e.g., "ABC Main Clubhouse Harbour Room"
          "mandatory": boolean  // true if attendance is compulsory (e.g., skippers briefing)
        }
      ] | null,

      // === GOVERNING RULES ===
      "racingRulesSystem": string | null,  // e.g., "Racing Rules of Sailing (RRS)"
      "prescriptions": string | null,  // e.g., "HKSF Prescriptions"
      "classRules": Array<string> | null,  // Array of class rules that apply, e.g., ["IRC Rules", "ORC Rules", "Dragon Class Rules"]
      "ssiReference": string | null,  // e.g., "Part 1 and Appendix D for Harbour racing"
      "courseAttachmentReference": string | null,  // e.g., "SSI Attachment A" or "SSI Attachment B"

      // === ELIGIBILITY & ENTRY ===
      "eligibilityRequirements": string | null,  // e.g., "Open to all boats of the Dragon class"
      "eligibleClasses": Array<string> | null,  // e.g., ["IRC Monohull", "PHS Monohull", "Dragon", "J/80"]
      "entryFormUrl": string | null,
      "entryDeadline": string | null,  // e.g., "1800hrs Friday 5 December 2025"
      "entryFees": Array<{type: string, amount: string, deadline?: string}> | null,  // e.g., [{type: "Early Bird", amount: "HK$580", deadline: "7 Nov"}]
      "signOnRequirement": string | null,  // e.g., "via SailSys text message"
      "crewListDeadline": string | null,  // e.g., "1700hrs Friday 12 December"
      "safetyBriefingRequired": boolean | null,
      "safetyBriefingDetails": string | null,  // e.g., "Tuesday 9 or Thursday 11 December at 1900hrs"

      // === CREW REQUIREMENTS (especially for distance/adventure races) ===
      "minimumCrew": number | null,  // Minimum number of crew required (e.g., 5)
      "crewRequirements": string | null,  // Special requirements (e.g., "All crew except 3 must complete at least one peak ascent")
      "minorSailorRules": string | null,  // Rules for under-18 crew (e.g., "Parental consent required, must be accompanied by adult on hill runs")

      // === TIME LIMITS ===
      "absoluteTimeLimit": string | null,  // e.g., "1700hrs"
      "cutOffPoints": Array<{location: string, time: string}> | null,  // e.g., [{location: "Lei Yue Mun Gap", time: "1230hrs"}]
      
      // === CONTACTS & LOGISTICS ===
      "raceOfficeLocation": string | null,  // e.g., "RHKYC Kellett Island Gun Room"
      "raceOfficePhone": Array<string> | null,  // e.g., ["2239 0376", "5402 7089"]
      "contactEmail": string | null,
      "eventWebsite": string | null,  // e.g., "www.4peaksrace.com"
      "fuelLocations": string | null,  // e.g., "FUEGY fuel barge at western entrance of Aberdeen Harbour"
      "parkingInfo": string | null,  // e.g., "Car parking not available at ABC. Public car parks opposite main clubhouse"
      "berthingInfo": string | null,  // e.g., "Limited mooring available, allocated in order of entries"
      
      // === PRIZEGIVING ===
      "prizegivingDate": string | null,  // e.g., "Wednesday 17 December 2025"
      "prizegivingTime": string | null,  // e.g., "1930hrs"  
      "prizegivingLocation": string | null,  // e.g., "RHKYC Kellett Island"

      // === CLASS & FLEET ===
      "boatClass": string | null,  // e.g., "Dragon"
      "classDivisions": Array<{name: string, fleet_size: number}> | null,  // e.g., [{"name": "IRC Division 1", "fleet_size": 10}, {"name": "IRC Division 2", "fleet_size": 8}]
      "expectedFleetSize": number | null,  // Total expected fleet size if mentioned

      // === SCORING & HANDICAPS ===
      "scoringSystem": string | null,  // e.g., "Low Point System", "RHKATI", "IRC", "PHS", "ORC"
      "handicapSystem": string | null,  // e.g., "RHKATI", "IRC", "PHS", "ORC", "ORCi"
      "seriesRacesRequired": number | null,  // Minimum races to constitute a series
      "discardsPolicy": string | null,
      "scoringFormulaDescription": string | null,  // Human-readable explanation of how results are calculated (e.g., "Corrected time = (elapsed - hill times) adjusted by handicap + hill times")
      "scoringCheckpoints": Array<{location: string, checkType: string}> | null,  // Timing checkpoints (e.g., [{location: "Lantau Peak", checkType: "gate"}])

      // === MOTORING DIVISION (for distance races allowing engine use) ===
      "motoringDivisionAvailable": boolean | null,  // true if boats can elect to enter motoring division
      "motoringDivisionRules": string | null,  // Rules for motoring (e.g., "Call Race Control before switching on engines, 30 min after start")
      "motoringPenaltyFormula": string | null,  // How motoring time is penalized

      // === PENALTY SYSTEM ===
      "penaltySystem": string | null,  // e.g., "One-Turn Penalty", "Two-Turns Penalty", "Scoring Penalty"
      "penaltyDetails": string | null,  // Additional details (e.g., "RRS 44.1 changed - Two-Turns replaced by One-Turn")
      "ocsPolicy": string | null,  // OCS handling (e.g., "5% time penalty if no significant advantage")

      // === COURSE & VENUE ===
      "courseArea": string | null,  // e.g., "Harbour", "Port Shelter", "Clearwater Bay"
      "courseSelectionCriteria": string | null,
      "courseDescription": string | null,  // Full course description (e.g., "Four peaks: Lantau Peak, Mount Stenhouse, Violet Hill, Ma On Shan")
      "potentialCourses": Array<string> | null,  // List of possible courses (e.g., ["Course Alpha", "Course Bravo", "Four Peaks Route"])
      
      // === START AREA & START LINES ===
      // IMPORTANT: Extract BOTH startAreaName/startAreaDescription AND startLines array
      "startAreaName": string | null,  // e.g., "Tai Tam Bay", "Inner Harbour", "Starting Line in Tai Tam Bay"
      "startAreaDescription": string | null,  // e.g., "Starting line will be laid in Tai Tam Bay", "between IDM and ODM"
      // For distance races with a single start line, create ONE entry in startLines array
      // For fleet races with multiple start lines, create MULTIPLE entries
      "startLines": [  // Array of all starting lines (even if only one)
        {
          "name": string,           // e.g., "Inner Starting Line", "Outer Starting Line"
          "description": string | null,  // e.g., "between IDM and ODM from west to east"
          "classes": Array<string>,  // Which classes use this line
          "vhfChannel": string | null,  // VHF channel for this line
          "marks": {
            "starboardEnd": string | null,  // e.g., "Starter's Box", "Kellett VIII"
            "portEnd": string | null        // e.g., "ODM", "orange inflatable buoy"
          } | null,
          "direction": string | null,  // e.g., "W-E"
          "startTimes": [  // Start schedule for this line
            {
              "class": string,
              "flag": string,  // IC Flag/Pennant
              "time": string   // Start time (HH:MM or HHMMhrs)
            }
          ] | null
        }
      ] | null,
      
      // === RACING AREA & COURSE ===
      "racingAreaName": string | null,        // e.g., "Hong Kong Island"
      "racingAreaDescription": string | null, // e.g., "Hong Kong Island to Starboard"
      "approximateDistance": string | null,   // e.g., "26nm"
      "courseDescription": string | null,     // Full course description
      
      // === DISTANCE RACING FIELDS (only for raceType === "distance") ===
      "totalDistanceNm": number | null,       // Total race distance in nautical miles
      "timeLimitHours": number | null,        // Time limit for race completion in hours
      "startFinishSameLocation": boolean | null,  // True for circumnavigation, false for point-to-point
      "routeWaypoints": [  // Array of waypoints for distance races
        {
          "name": string,                     // Waypoint name (e.g., "Green Island Gate")
          "latitude": number | null,          // Decimal degrees
          "longitude": number | null,
          "type": "start" | "waypoint" | "gate" | "finish",  // Type of waypoint
          "required": boolean,                // Is this waypoint mandatory?
          "passingSide": "port" | "starboard" | "either" | null,  // How to pass
          "notes": string | null              // Additional instructions
        }
      ] | null,
      "tideGates": [  // Timing windows based on tidal currents
        {
          "location": string,
          "optimalPassingTime": string | null,  // e.g., "Before 1230hrs"
          "currentDirection": "favorable" | "adverse" | null,
          "notes": string | null
        }
      ] | null
      
      // === COURSE GATES ===
      "gates": [
        {
          "name": string,
          "description": string | null,
          "orientation": string | null,  // e.g., "SE-NW"
          "portMark": string | null,
          "starboardMark": string | null,
          "canShortenHere": boolean | null
        }
      ] | null,
      
      // === COURSE MARKS (with GPS coordinates if available) ===
      "courseMarks": [
        {
          "name": string,
          "type": string,  // "government_buoy", "club_mark", "gate", "geographical"
          "latitude": number | null,  // Decimal degrees
          "longitude": number | null,
          "description": string | null,
          "rounding": string | null,  // "to_port", "to_starboard", "pass_through"
          "color": string | null
        }
      ] | null,
      
      // === PROHIBITED AREAS (TSS, military zones, etc.) ===
      "prohibitedAreas": [
        {
          "name": string,
          "description": string | null,
          "coordinates": Array<{lat: number, lng: number}> | null,
          "consequence": string | null  // e.g., "disqualified without a hearing"
        }
      ] | null,

      // === SAFETY ===
      "safetyRequirements": string | null,  // e.g., "Keep clear of commercial traffic", "All boats must carry safety equipment", "Life jackets required"
      "safetyConsequences": string | null,  // What happens if safety rule broken (e.g., "disqualified without a hearing")
      "retirementNotificationRequirements": string | null,  // How to notify if retiring (e.g., "Notify Race Committee via VHF Channel 77")

      // === INSURANCE ===
      "insuranceRequired": boolean | null,
      "minimumInsuranceCoverage": string | null,  // e.g., "Third-party liability minimum per HKSAR law"

      // === PRIZES ===
      "prizesDescription": string | null,  // e.g., "Trophies presented at Annual Prizegiving Dinner"

      // === FINISH AREA ===
      "finishAreaName": string | null,  // e.g., "Club Finishing Line"
      "finishAreaDescription": string | null,  // e.g., "Between ODM and IDM from west to east"
      "finishMarks": {
        "starboardEnd": string | null,  // e.g., "RHKYC Kellett Island Starter's Box"
        "portEnd": string | null  // e.g., "ODM"
      } | null,

      // === DOCUMENT URLS ===
      "sailingInstructionsUrl": string | null,  // URL to SI document or race page
      "noticeOfRaceUrl": string | null,  // URL to NOR document
      "onlineNoticeBoard": string | null,  // URL where notices are posted

      // === ADDITIONAL INFO ===
      "organizer": string | null,  // e.g., "Royal Hong Kong Yacht Club"
      "classSecretary": string | null,  // Contact person
      "specialDesignations": Array<string> | null,  // e.g., ["Clean Regatta by Sailors for the Sea"]

      // === COMMUNICATIONS (IMPORTANT: Extract ALL VHF channels mentioned) ===
      "vhfChannel": string | null,  // Primary/default VHF channel
      "safetyChannel": string | null,  // Safety/distress channel
      "vhfChannels": [  // Array of ALL VHF channels with their purposes
        {
          "channel": string,  // Channel number (e.g., "72", "73", "77")
          "purpose": string,  // Purpose (e.g., "Inner Starting Line", "Outer Starting Line", "Safety Watch", "Race Committee")
          "classes": Array<string> | null  // Which classes use this channel (e.g., ["Dragon", "J/80", "Fast Fleet"])
        }
      ] | null,
      "raceOfficer": string | null,  // Principal Race Officer name

      // === CLASS FLAGS (CRITICAL for Race Tab - shows which flag to watch for starts) ===
      "classFlags": [  // Array mapping boat classes to their International Code Flags
        {
          "className": string,  // Boat class name (e.g., "Dragon", "Etchells", "J/80", "Big Boats")
          "flag": string,       // International Code Flag letter/number (e.g., "D", "G", "W", "Naval 6")
          "flagDescription": string | null  // Optional description if not a standard letter flag
        }
      ] | null,

      // === PROTEST PROCEDURES (CRITICAL for Post-Race Tab) ===
      "protestProcedures": {
        "protestTimeLimit": string | null,         // e.g., "90 minutes after last boat finishes", "within 2 hours"
        "protestFormLocation": string | null,      // Where to get/submit forms (e.g., "Race Office", "Online via SailSys")
        "protestHearingLocation": string | null,   // Where hearings are held
        "protestCommitteeContact": string | null,  // Contact info
        "protestFee": string | null,               // Fee if applicable
        "specialProcedures": string | null         // Any RRS modifications or special procedures
      } | null,

      // === POST-RACE REQUIREMENTS ===
      "postRaceRequirements": {
        "signOffRequired": boolean | null,         // Whether boats must sign off after racing
        "signOffMethod": string | null,            // How to sign off (e.g., "via SailSys", "at Race Office")
        "retirementNotification": string | null,   // How to notify if retiring (e.g., "Notify Race Committee on VHF 77")
        "resultsPostingLocation": string | null,   // Where results will be posted
        "resultsPostingTime": string | null        // When results will be available
      } | null,

      // === SIGNALS MADE ASHORE (CRITICAL for Race Morning) ===
      "signalsMadeAshore": {
        "location": string | null,                 // Where signals are displayed (e.g., "RHKYC Shelter Cove flagpoles")
        "apFlagMeaning": string | null,            // What AP flag means (e.g., "not less than 30 minutes" delay)
        "otherSignals": [
          {
            "signal": string,   // Signal name/flag
            "meaning": string   // What it means
          }
        ] | null
      } | null,

      // === CONFIDENCE SCORES ===
      "confidenceScores": {
        "raceName": number,  // 0.0 to 1.0
        "raceDate": number,
        "venue": number,
        "overall": number
      }
    }
  ],
  "documentType": "NOR" | "SI" | "CALENDAR" | "AMENDMENT" | "OTHER",
  "organizingAuthority": string | null,
  "overallConfidence": number  // 0.0 to 1.0
}

IMPORTANT INSTRUCTIONS:
1. **CRITICAL - EXTRACT ALL RACE DAYS**: If you detect multiple race series (like Croucher, Corinthian, Commodore, Moonraker, Phyloong), you MUST extract EVERY SINGLE RACE DAY from EVERY SERIES. Do NOT stop after extracting one or two races!
   - Example: If there are 5 series with 3 race days each, you must extract 15 race day entries
   - Look at EVERY date mentioned in the SCHEDULE section and create a race entry for each one
2. For each race DAY (not individual race), create a separate race object with all the races for that day
3. Extract dates carefully - they may be in various formats (e.g., "Saturday 27 September 2025")
4. Extract ALL governing rules, SSI references, and course attachments
5. If a field is not found in the document, set it to null (not undefined)
6. Be generous with confidence scores for clearly stated information (0.9-1.0 for explicit data)
7. For race days within series, use naming like "Croucher Series Races 1 & 2", "Croucher Series Races 3 & 4", etc. (matching the document)
8. Extract venue variants carefully (Port Shelter vs Clearwater Bay vs Harbour)
9. **COUNT YOUR RACES**: Before returning, verify you have extracted ALL race days from ALL series mentioned in the document. If the document mentions 5 series with 3 race days each, you should have ~15 race entries
10. **NEVER HALLUCINATE DATES**: If the document does NOT contain specific dates for races, set raceDate to null. Do NOT invent or guess dates. Set the confidence score for raceDate to 0.0 when the date is not found. HOWEVER: Many NORs (even ones titled "Standard NOR") DO include a SCHEDULE section with explicit race dates — if the document contains a schedule with specific dates like "Saturday 27 September 2025", you MUST extract those dates. Only set raceDate to null when the document genuinely has NO dates anywhere in its content.
11. **TIME FORMAT**: warningSignalTime MUST be in HH:MM format (e.g., "14:00"), not "1400hrs" or "14:00hrs". Strip any "hrs" suffix.

**RACE TYPE DETECTION (CRITICAL)**:
   - Detect "fleet" vs "distance" race type from document content
   - **DISTANCE race indicators**: 
     * Words: "offshore", "distance race", "circumnavigation", "around the island", "passage race", "point-to-point", "ocean race", "coastal race"
     * Features: Time limits in hours (not minutes), total distance in nautical miles, named waypoints/gates along route, different start/finish locations
     * Example: "Around Hong Kong Island Race" = distance
   - **FLEET race indicators**: 
     * Words: "windward/leeward", "mark rounding", "course mark", "start sequence", "class start", "buoy racing"
     * Features: Multiple boat classes with class flags, start sequences with minute intervals, course selection criteria, RC boat signals
     * Example: "Lipton Trophy" with classes Dragon, J/80, etc. = fleet
   - When in doubt, default to "fleet"
   - For distance races, extract routeWaypoints (including peaks, landmarks, gates), totalDistanceNm, timeLimitHours, and tideGates
  - For unique distance races (e.g., "Four Peaks Race"), extract peaks/landmarks as waypoints even if they don't have GPS coordinates - include them as routeWaypoints with descriptive names
9. **VHF CHANNELS**: Extract ALL VHF channels mentioned in the document!
   - Different channels may be used for different starting lines (Inner vs Outer)
   - Different classes may use different channels
   - Safety/listening watch channels are common (often Channel 77 or 16)
   - Example: If document says "VHF Channel 73 for One Design" and "VHF 72 for IRC/PHS", extract BOTH as separate entries in vhfChannels array

10. **START AREA & START LINES** (CRITICAL FOR RACE DAY): Extract start location and all starting lines!
    - **startAreaName**: Extract the location/area where the start is (e.g., "Tai Tam Bay", "Inner Harbour", "Port Shelter")
      - Look for phrases like "starting line will be laid in [location]", "start in [location]", "starting area in [location]"
      - Example: If document says "The starting line will be laid in Tai Tam Bay" → startAreaName: "Tai Tam Bay"
    - **startAreaDescription**: Extract the full description of the start (e.g., "Starting line will be laid in Tai Tam Bay", "between IDM and ODM")
    - **startLines array**: Extract ALL starting lines as entries in the array
      - For DISTANCE races with a single start line: Create ONE entry in the array
        - name: e.g., "Starting Line" or use the location name like "Tai Tam Bay Starting Line"
        - description: Full description from document (e.g., "Starting line will be laid in Tai Tam Bay")
        - classes: Array of all divisions/classes that start from this line (e.g., ["IRC Division 1", "IRC Division 2", "PHS Division A", "PHS Division B"])
      - For FLEET races with multiple start lines: Create MULTIPLE entries
        - Extract EACH starting line separately (e.g., "Inner Starting Line", "Outer Starting Line")
        - Include ALL classes that start from each line
        - Include start times for each class on that line
      - Example: "Inner Starting Line" for One Design (Dragon 0840, J/80 0855) and "Outer Starting Line" for IRC/PHS
    - Link VHF channels to their respective start lines if specified
    - ALWAYS populate startLines array, even if there's only one line!

11. **COURSES & COURSE MARKS** (CRITICAL FOR STRATEGY):
    - **COURSES**: Extract ALL possible courses mentioned
      - Look for "COURSE", "COURSES", "COURSE DESCRIPTION", or course selection criteria
      - Extract potentialCourses array (e.g., ["Course Alpha", "Course Bravo", "Four Peaks Route"])
      - Extract courseDescription (full description of the course, e.g., route through peaks, waypoints, etc.)
      - For unique races like "Four Peaks Race", extract the course as a description of the route (e.g., "Four peaks: Lantau Peak, Mount Stenhouse, Violet Hill, Ma On Shan")
    - **COURSE MARKS & GPS**: Extract ALL course marks with GPS coordinates when available
      - Government buoys, club marks, gates, geographical features
      - Include rounding instructions (to port, to starboard, pass through)
      - Include approximate positions if GPS not explicit (e.g., "0.83nm west north-west of Bluff Head Light")

12. **PROHIBITED AREAS** (CRITICAL FOR STRATEGY - EXTRACT ALL OF THEM!): Extract ALL TSS zones, military areas, and other prohibited zones
    - **CRITICAL**: This is ESSENTIAL for race strategy and route planning - you MUST extract every prohibited area mentioned!
    - Look for sections titled "PROHIBITED AREAS", "OUT OF BOUNDS", "RESTRICTED ZONES", "NO-GO ZONES", or similar
    - Also check sections like "SAFETY", "RESTRICTIONS", "BOUNDARIES", "NAVIGATION", or "COURSE LIMITATIONS"
    - Extract every single prohibited area mentioned, even if coordinates aren't provided
    - Common prohibited areas include:
      * Private property (e.g., "All private property", "Private property out of bounds")
      * Marine police compounds (e.g., "Sai Kung Marine Police Compound")
      * Prisons (e.g., "Stanley Prison")
      * Marine reserves (e.g., "Cape d'Aguilar Marine Reserve")
      * TSS zones (Traffic Separation Schemes)
      * Military training areas
      * No-go zones
    - For each prohibited area, extract:
      - name: The name of the area (e.g., "Private Property", "Sai Kung Marine Police Compound")
      - description: Full description from document (e.g., "All private property", "Out of bounds")
      - coordinates: GPS coordinates if provided (array of {lat, lng} points)
      - consequence: What happens if violated (e.g., "disqualified without a hearing", "out of bounds")
    - **IMPORTANT**: Even if the document just says "All private property" or "Out of bounds" without specific coordinates, still extract it as a prohibited area!
    - Example: If document lists "Private Property - All private property", "Sai Kung Marine Police Compound - Out of bounds", "Stanley Prison - Out of bounds", "Cape d'Aguilar Marine Reserve - Out of bounds", extract ALL FOUR of them!
    - These areas are ESSENTIAL for race strategy and route planning - extract them all!

13. **PENALTY SYSTEM** (CRITICAL FOR STRATEGY): Extract ALL penalty rules from the document
    - Look for section titled "PENALTY SYSTEM", "PENALTIES", or "RULES AND PENALTIES"
    - Extract the main penalty type (e.g., "One-Turn Penalty", "Two-Turns Penalty", "Scoring Penalty", "Time Penalty")
    - Extract penalty amounts/details (e.g., "time penalty not less than 15 minutes")
    - Note any modifications to standard RRS (e.g., "Two-Turns Penalty replaced by One-Turn Penalty")
    - Extract OCS (On Course Side) policies (e.g., "5% time penalty if no significant advantage")
    - Include rule references (e.g., "RRS 44.1 and 44.2 apply")
    - Extract ALL penalty information - this is critical for understanding consequences of rule violations

14. **START & FINISH LINES** (CRITICAL FOR STRATEGY): Extract ALL start and finish line details
    - **START LINES**: Look for sections titled "THE START", "STARTING LINE", "STARTING AREA"
      - Extract EVERY starting line mentioned (e.g., "Inner Starting Line", "Outer Starting Line", "Starting Line W-E")
      - Extract the description of each line (e.g., "between IDM and ODM from west to east", "Starting Line W-E")
      - Extract which classes use each line
      - Extract start times for each class on each line
      - Extract marks that define the line ends (starboard end, port end)
      - Extract VHF channel for each line if different
      - For distance races, extract start line location and description
    - **FINISH AREA** (CRITICAL FOR DISTANCE RACES): Extract finish line details from multiple places
      - Look for sections titled "THE FINISH", "FINISH", "FINISH AREA", OR check the SCHEDULE section
      - **Important**: For distance races, finish information is often in the schedule, not a separate "FINISH" section
      - Look for phrases like:
        * "Race finish time will be [time]. All boats which have not yet finished must report into [location]"
        * "Boats return to [location]"
        * "Report to [location] when finished"
        * "Finish at [location]"
      - Extract:
        - finishAreaName: The location mentioned (e.g., "ABC Main Club", "Aberdeen Boat Club", or location where boats report/return)
        - finishAreaDescription: Full description including time and location (e.g., "Race finish time will be 1900 hrs. Boats report to ABC Main Club", "Boats return to safe haven at ABC Main Club")
      - If no explicit finish location, check if finish is at start location (same as startFinishSameLocation)
      - For fleet races: Look for explicit finish line details
        - finishAreaName: Name of the finish line (e.g., "Club Finishing Line")
        - finishAreaDescription: How boats finish (e.g., "passing between ODM and IDM from west to east")
        - finishMarks: The marks defining the finish line ends

15. **DOCUMENT URLS** (CRITICAL): Extract ALL URLs mentioned in the document
    - sailingInstructionsUrl: URL where race info is posted (often in "COMMUNICATIONS" section or header/footer)
    - noticeOfRaceUrl: Link to NOR document if mentioned (often in header, footer, or "DOCUMENTS" section)
      - If the document being extracted IS a NOR, extract the URL from the document itself (e.g., from header/footer)
      - Look for phrases like "Notice of Race available at [URL]", "NOR: [URL]", or URLs in document headers
    - onlineNoticeBoard: URL for official notice board (often in "COMMUNICATIONS" section)
    - Extract URLs even if they're partial (e.g., "www.rhkyc.org.hk/racing" - complete them if context suggests full URL)
    - Example: "www.rhkyc.org.hk/sailing/races-and-regattas/localracing/aroundtheislandrace"

16. **SCORING & HANDICAPS** (CRITICAL FOR STRATEGY): Extract ALL handicap and scoring information
    - Look for "HANDICAPS", "SCORING", "SCORING SYSTEM", or "RESULTS" sections
    - Common handicap systems: RHKATI, IRC, PHS, ORC, ORCi, ORR
    - scoringSystem: How results are calculated (e.g., "Corrected time using IRC", "Corrected time with hill times deduction")
    - handicapSystem: The specific system used (e.g., "RHKATI", "IRC", "PHS")
    - Extract discards policy if mentioned
    - For unique races (like "Four Peaks Race"), extract any special scoring calculations (e.g., "corrected time minus hill times", "sailing time plus climbing time")
    - Extract ALL scoring details - this determines how race results are calculated

17. **PRIZES**: Extract prize information if present
    - Often in "PRIZES" or "AWARDS" section
    - May reference "Annual Prizegiving" or specific trophy names
    - If not explicitly mentioned, set to null (prizes often in NOR, not SI)

18. **ENTRY INFORMATION** (typically from NOR):
    - eligibleClasses: List ALL boat classes that can enter
    - entryFees: Extract different fee tiers (Early Bird, Standard, Late)
    - entryDeadline: Final entry deadline
    - entryFormUrl: URL to entry form if mentioned
    - crewListDeadline: When crew lists are due
    - **signOnRequirement**: Extract sign-on/sign-in requirements (CRITICAL!)
      - Look for "SIGN-ON", "SIGN-ON REQUIREMENT", "CHECK-IN", or "SailSys" mentions
      - Extract how sailors sign on (e.g., "via SailSys text message", "via SailSys ≥10 minutes before warning signal", "Sign-on via SailSys app")
      - Extract timing requirements (e.g., "≥10 minutes before warning signal", "before 0855hrs")
      - Extract SailSys-specific requirements (e.g., "Single season entry through SailSys")
      - This is ESSENTIAL for race participation - extract it fully!

19. **SAFETY BRIEFING**:
    - safetyBriefingRequired: true if briefing is mandatory
    - safetyBriefingDetails: Date, time, and location of briefing

20. **TIME LIMITS**:
    - absoluteTimeLimit: Final time to finish (e.g., "1700hrs")
    - cutOffPoints: Intermediate cut-off times at specific locations

21. **CONTACTS & LOGISTICS** (CRITICAL FOR RACE DAY):
    - **raceOfficeLocation**: Where the race office/race control is located (e.g., "RHKYC Kellett Island Gun Room", "Aberdeen Boat Club Race Office")
      - Look for "RACE OFFICE", "RACE CONTROL", "RACE COMMITTEE OFFICE", or similar headings
      - Extract the exact location - this is where sailors go for questions, documents, protests
    - raceOfficePhone: Phone numbers to call (extract ALL numbers mentioned)
    - contactEmail: Contact email addresses

22. **PRIZEGIVING**:
    - prizegivingDate, prizegivingTime, prizegivingLocation
    - Extract from "PRIZES" or "PRIZEGIVING" section

23. **MULTI-DAY EVENT SCHEDULE** (CRITICAL for distance races & multi-day events):
    - Extract ALL scheduled events into the "schedule" array
    - Look for "SCHEDULE", "PROGRAMME", "TIMETABLE", or numbered date entries
    - For each event extract: date (YYYY-MM-DD), time (HH:MM), event name, location, and whether it's mandatory
    - Common events to capture:
      * Skippers Briefing (often COMPULSORY - mark mandatory: true)
      * Race Start / Warning Signal
      * Race Finish / Time Limit
      * Prize Giving / Awards Ceremony
      * Safety Briefing
      * Registration / Check-in
    - Example: If document says "Thursday 15th January - Skippers Briefing at 1900hrs in ABC Main Clubhouse (compulsory)" → create schedule entry with mandatory: true

24. **CREW REQUIREMENTS** (CRITICAL for adventure/distance races):
    - **minimumCrew**: Extract minimum crew number (e.g., "minimum number of crew is five")
    - **crewRequirements**: Extract special crew rules for unique races
      - For "Four Peaks Race" type events: "All crew members except three must complete the ascent of at least one peak"
      - For offshore: "Watch system required with minimum 3 crew on deck at all times"
    - **minorSailorRules**: Extract rules for under-18 sailors
      - Look for "under the age of eighteen", "parental consent", "guardian", "minor"
      - Example: "Crew under 18 not sailing with parent/guardian must submit signed Parental Consent form. Any person under 18 must be accompanied by adult on hill runs"

25. **MOTORING DIVISION** (for distance races):
    - Extract if boats can elect to enter a "motoring division" or use engines
    - **motoringDivisionAvailable**: true if mentioned
    - **motoringDivisionRules**: When/how to use engines (e.g., "call Race Control before switching on engines, no earlier than 30 minutes after scheduled start")
    - **motoringPenaltyFormula**: How motoring time is penalized (e.g., "time penalty for accumulated periods of motoring")
    - Look for "MOTORING", "MOTORING DIVISION", "ENGINE", "MOTOR"

26. **UNIQUE SCORING FORMULAS** (CRITICAL for adventure races like Four Peaks):
    - **scoringFormulaDescription**: Extract the full scoring formula in human-readable form
      - For Four Peaks: "Corrected time = (total elapsed time - hill times) adjusted by PHS/IRC rating, then add back cumulative hill times"
      - For standard races: "Corrected time using IRC" or "PHS handicap applied"
    - **scoringCheckpoints**: Extract any timing gates/checkpoints mentioned
      - Example: "Lantau Peak running times will be checked at a gate" → {location: "Lantau Peak", checkType: "timing gate"}
    - Look for "SCORING", "RESULTS", "CALCULATION", "FORMULA", unique scoring methods

27. **EVENT LOGISTICS** (helpful for competitors):
    - **eventWebsite**: Main event URL (often in "FURTHER INFORMATION" section)
    - **fuelLocations**: Where to get fuel (look for "FUEL", "SHIPS STORES")
    - **parkingInfo**: Car parking availability (look for "CAR PARKING", "PARKING")
    - **berthingInfo**: Mooring/berthing availability (look for "BERTHING", "MOORINGS", "MOORING")

28. **ROUTE WAYPOINTS FOR DISTANCE RACES** (CRITICAL - extract ALL waypoints/peaks):
    - For races like "Four Peaks Race", extract each peak/waypoint in order:
      - Example: Lantau Peak → Mount Stenhouse → Violet Hill → Ma On Shan
      - Create routeWaypoints array entries even without GPS coordinates
      - Set type: "waypoint" for intermediate points, "start"/"finish" for start/end
      - Include notes about drop-off points or ascent requirements if mentioned
    - For offshore races with geographic waypoints:
      - Extract each gate, mark, or geographical feature in order
      - Include passing side requirements (port/starboard)
    - The ORDER matters - extract waypoints in the sequence they must be visited!

29. **CLASS FLAGS** (CRITICAL for Race Tab - extract ALL class/flag mappings):
    - Look for section titled "CLASS FLAGS", "FLAGS", or similar
    - Extract EVERY class-to-flag mapping mentioned:
      - className: The boat class name (e.g., "Dragon", "Etchells", "J/80", "All Boats", "Big Boats")
      - flag: The International Code Flag (e.g., "D", "G", "J", "W", "E", "Naval 6")
      - flagDescription: For non-standard flags like "Naval 6", include description
    - Example from document: "Dragon - D", "Etchells - G", "Flying Fifteen - Naval 6", "Impala - K"
    - This is ESSENTIAL for Race Tab - sailors need to know which flag signals their class start!

30. **PROTEST PROCEDURES** (CRITICAL for Post-Race Tab):
    - Look for sections titled "PROTESTS", "HEARINGS", "PROTESTS AND REQUESTS FOR REDRESS"
    - Extract:
      - protestTimeLimit: Time limit for filing (e.g., "90 minutes after last boat finishes", "within protest time limit as posted")
      - protestFormLocation: Where to get/submit forms (e.g., "Race Office", "Online via SailSys")
      - protestHearingLocation: Where hearings are held
      - protestFee: Any fee required
      - specialProcedures: Any RRS modifications (e.g., "Arbitration available per ISAF Addendum Q")
    - This is ESSENTIAL for Post-Race Tab - sailors need to know how and when to file protests!

31. **POST-RACE REQUIREMENTS**:
    - Look for sections on "FINISHING", "AFTER RACING", "SIGN-OFF", "RETIREMENT"
    - Extract:
      - signOffRequired: Whether boats must sign off after racing
      - signOffMethod: How to sign off (e.g., "via SailSys", "at Race Office")
      - retirementNotification: How to notify if retiring (e.g., "Notify Race Committee on VHF 77")
      - resultsPostingLocation: Where results will be posted (e.g., "Online Notice Board", "Race Office")
      - resultsPostingTime: When results will be available

32. **SIGNALS MADE ASHORE** (CRITICAL for Race Morning):
    - Look for section titled "SIGNALS MADE ASHORE" or "SIGNALS"
    - Extract:
      - location: Where signals are displayed (e.g., "RHKYC Shelter Cove flagpoles", "Club flagpole")
      - apFlagMeaning: What AP (Answering Pennant) flag means - often modified from standard
        - Example: "When flag AP is displayed ashore, '1 minute' is replaced with 'not less than 30 minutes'"
      - otherSignals: Any other shore signals and their meanings
    - This is ESSENTIAL for Race Morning - tells sailors where to look for postponement/cancellation signals!

Return ONLY the JSON object, no additional text.`;

    const promptToUse = compactMode ? compactPrompt : extractionPrompt;
    console.log(`[extract-race-details] Mode: ${compactMode ? 'COMPACT/CALENDAR' : 'COMPREHENSIVE'}, includePast: ${includePast}, currentDate: ${todayIso}, prompt length: ${promptToUse.length}`);

    let content: string;
    try {
      const result = await complete({
        task: 'extraction',
        messages: [{ role: 'user', content: promptToUse }],
        // Compact mode emits ~50 tokens per race, so 16k handles ~250 races; bump higher for safety on long calendars
        maxOutputTokens: compactMode ? 32768 : 16384,
        temperature: 0,
      });
      content = result.text;
    } catch (aiError: any) {
      console.error('[extract-race-details] AI API error:', aiError.message);
      return new Response(
        JSON.stringify({
          error: `AI API error: ${aiError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log raw response length and first/last chars for debugging
    console.log(`[extract-race-details] AI response length: ${content.length}`);
    console.log(`[extract-race-details] Response preview: ${content.substring(0, 300)}`);

    // Claude sometimes wraps JSON in markdown code blocks, so clean it up
    // Remove markdown code fences if present
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    content = content.trim();

    // Parse the JSON - try multiple strategies
    let extractedData;
    let parseAttempts = [];

    // Attempt 1: Direct parse
    try {
      extractedData = JSON.parse(content);
    } catch (parseError1) {
      parseAttempts.push({ attempt: 1, error: parseError1.message });

      // Attempt 2: Find JSON object in content (Claude may prefix with text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0]);
        } catch (parseError2) {
          parseAttempts.push({ attempt: 2, error: parseError2.message });
        }
      } else {
        parseAttempts.push({ attempt: 2, error: 'No JSON object found in content' });
      }

      // Attempt 3: Recover truncated JSON by closing open braces/brackets
      if (!extractedData) {
        const jsonStart = content.indexOf('{');
        if (jsonStart > -1) {
          let truncated = content.substring(jsonStart);

          // Find the last complete race object in the races array
          // Strategy: find the last '},' or '}' that closes a race entry, then close the array and root object
          const racesArrayStart = truncated.indexOf('"races"');
          if (racesArrayStart > -1) {
            // Find all complete race objects by looking for closing patterns
            // A race object ends with '}' followed by ',' or ']'
            const raceEndRegex = /\}[\s]*,[\s]*\{/g;
            let lastCompleteRaceEnd = -1;
            let raceMatch;
            while ((raceMatch = raceEndRegex.exec(truncated)) !== null) {
              lastCompleteRaceEnd = raceMatch.index + 1; // position after the '}'
            }

            // Also check for the very last complete object (before truncation)
            // Look backwards from the end for a complete "confidenceScores" or closing pattern
            const lastCloseBrace = truncated.lastIndexOf('}');
            const lastOpenBrace = truncated.lastIndexOf('{');

            // Try to close the JSON by adding missing brackets
            // Remove any trailing partial object (after last complete '},')
            if (lastCompleteRaceEnd > 0) {
              let recovered = truncated.substring(0, lastCompleteRaceEnd + 1);
              // Close the races array and root object
              // Check what's still open
              const openBraces = (recovered.match(/\{/g) || []).length;
              const closeBraces = (recovered.match(/\}/g) || []).length;
              const openBrackets = (recovered.match(/\[/g) || []).length;
              const closeBrackets = (recovered.match(/\]/g) || []).length;

              // Close remaining open brackets and braces
              for (let i = 0; i < openBrackets - closeBrackets; i++) recovered += ']';
              // Add required closing fields before final brace
              if (openBraces - closeBraces > 0) {
                // Add minimal required fields
                const fallbackDocType = compactMode ? 'CALENDAR' : 'NOR';
                recovered += `, "documentType": "${fallbackDocType}", "organizingAuthority": null, "overallConfidence": 0.8`;
                for (let i = 0; i < openBraces - closeBraces; i++) recovered += '}';
              }

              try {
                extractedData = JSON.parse(recovered);
                parseAttempts.push({ attempt: 3, error: `Recovered truncated JSON with ${extractedData.races?.length || 0} races` });
                console.log(`[extract-race-details] Recovered ${extractedData.races?.length || 0} races from truncated JSON (${content.length} chars)`);
              } catch (parseError3) {
                parseAttempts.push({ attempt: 3, error: `Recovery failed: ${parseError3.message}` });
              }
            }
          }

          // Attempt 3b: Brute force - try progressively removing chars from the end and closing
          if (!extractedData) {
            const openBraces = (truncated.match(/\{/g) || []).length;
            const closeBraces = (truncated.match(/\}/g) || []).length;
            parseAttempts.push({ attempt: '3b', error: `JSON truncated: ${openBraces} open braces, ${closeBraces} close braces. Trying brute force recovery...` });

            // Find last complete race by looking for "}," pattern
            let lastGoodPos = truncated.length;
            for (let i = truncated.length - 1; i > 0; i--) {
              if (truncated[i] === '}') {
                const testStr = truncated.substring(0, i + 1);
                const ob = (testStr.match(/\{/g) || []).length;
                const cb = (testStr.match(/\}/g) || []).length;
                const obrk = (testStr.match(/\[/g) || []).length;
                const cbrk = (testStr.match(/\]/g) || []).length;

                let attempt = testStr;
                for (let j = 0; j < obrk - cbrk; j++) attempt += ']';
                for (let j = 0; j < ob - cb; j++) attempt += '}';

                try {
                  extractedData = JSON.parse(attempt);
                  console.log(`[extract-race-details] Brute force recovered JSON at position ${i}, ${extractedData.races?.length || 0} races`);
                  parseAttempts.push({ attempt: '3b-success', error: `Recovered at pos ${i} with ${extractedData.races?.length || 0} races` });
                  break;
                } catch {
                  // Continue searching
                }
              }
            }
          }
        }
      }
    }

    if (!extractedData) {
      console.error('[extract-race-details] Failed to parse Claude response as JSON');
      console.error('[extract-race-details] Parse attempts:', JSON.stringify(parseAttempts));
      console.error('[extract-race-details] Content first 500 chars:', content.substring(0, 500));
      console.error('[extract-race-details] Content last 500 chars:', content.substring(Math.max(0, content.length - 500)));
      console.error('[extract-race-details] Total content length:', content.length);

      // Check for common error patterns
      let errorHint = '';
      if (content.toLowerCase().includes('i cannot') || content.toLowerCase().includes('i\'m unable')) {
        errorHint = 'Claude may have refused the request';
      } else if (content.toLowerCase().includes('error') || content.toLowerCase().includes('invalid')) {
        errorHint = 'Claude may have returned an error message';
      } else if (content.length < 100) {
        errorHint = 'Response unusually short - may be an error or refusal';
      } else if (!content.includes('{')) {
        errorHint = 'No JSON object found in response';
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to parse AI response',
          details: content.substring(0, 500),
          parseAttempts,
          contentLength: content.length,
          errorHint
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log extraction summary for debugging
    const raceCount = extractedData?.races?.length || 0;
    const raceDates = extractedData?.races?.map((r: any) => `${r.raceName}: ${r.raceDate || 'NULL'}`).join(', ');
    console.log(`[extract-race-details] Extracted ${raceCount} races. multipleRaces=${extractedData?.multipleRaces}. Dates: ${raceDates}`);
    console.log(`[extract-race-details] Input text length: ${documentText.length}. Has SCHEDULE: ${documentText.includes('SCHEDULE') || documentText.includes('Schedule')}`);

    // Force documentType to a non-null value so downstream UI never renders 'undefined'
    if (!extractedData.documentType) {
      extractedData.documentType = compactMode ? 'CALENDAR' : 'OTHER';
    }
    if (compactMode) {
      // Compact mode is always multi-race by intent
      extractedData.multipleRaces = true;
      // Belt-and-suspenders: drop any past races if includePast is false and AI ignored the instruction
      if (includePast === false && Array.isArray(extractedData.races)) {
        const before = extractedData.races.length;
        extractedData.races = extractedData.races.filter((r: any) => !r.raceDate || r.raceDate >= todayIso);
        const after = extractedData.races.length;
        if (after !== before) {
          console.log(`[extract-race-details] Filtered out ${before - after} past races (cutoff: ${todayIso})`);
        }
      }
    }

    // POST-PROCESSING: Patch missing dates/times from document text
    // Gemini sometimes misses dates even when the document has a clear schedule.
    // Parse schedule patterns and match them to extracted races.
    // Skipped in compact/calendar mode — the document text is huge and schedule patterns differ.
    if (!compactMode && extractedData?.races?.length > 0) {
      // Build a schedule lookup from the document text
      // Matches patterns like: "Races 5 & 6: Saturday 11 April 2026 (Port Shelter) max.2 1255hrs"
      // or: "Races 1 & 2: Saturday 27 September 2025 (Port Shelter) 2 1336hrs"
      const scheduleRegex = /Races?\s+(\d+(?:\s*[&,]\s*\d+)?)\s*:\s*\w+\s+(\d{1,2}\s+\w+\s+\d{4})\s*\(([^)]+)\)\s*(?:max\.?\s*)?(\d+)\s+(\d{3,4})hrs/gi;
      const scheduleEntries: {
        raceNumbers: number[];
        date: string;
        venue: string;
        time: string;
      }[] = [];

      let match;
      while ((match = scheduleRegex.exec(documentText)) !== null) {
        const raceNumStr = match[1];
        const raceNumbers = raceNumStr.split(/[&,]/).map((n: string) => parseInt(n.trim(), 10)).filter((n: number) => !isNaN(n));
        const dateStr = match[2]; // e.g., "11 April 2026"
        const venue = match[3];   // e.g., "Port Shelter"
        const rawTime = match[5]; // e.g., "1255"

        // Parse date to ISO format
        const parsedDate = new Date(dateStr);
        const isoDate = !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString().split('T')[0]
          : null;

        // Parse time to HH:MM format
        const paddedTime = rawTime.padStart(4, '0');
        const formattedTime = `${paddedTime.slice(0, 2)}:${paddedTime.slice(2, 4)}`;

        if (isoDate) {
          scheduleEntries.push({
            raceNumbers,
            date: isoDate,
            venue,
            time: formattedTime,
          });
        }
      }

      console.log(`[extract-race-details] Found ${scheduleEntries.length} schedule entries in document text`);

      // Also try to extract series context: match series names to their race number ranges
      // Pattern: "3.4 Moonraker Series" followed by race entries
      const seriesRegex = /\d+\.\d+\s+(\w[\w\s]*?)\s+Series/gi;
      const seriesNames: string[] = [];
      while ((match = seriesRegex.exec(documentText)) !== null) {
        seriesNames.push(match[1].trim());
      }
      console.log(`[extract-race-details] Found series in document: ${seriesNames.join(', ')}`);

      // Patch missing dates and times into extracted races
      for (const race of extractedData.races) {
        // Extract race number from race name (e.g., "Moonraker Series Race 5" -> 5)
        const raceNumMatch = race.raceName?.match(/Race\s+(\d+)/i);
        const raceNum = raceNumMatch ? parseInt(raceNumMatch[1], 10) : null;

        if (raceNum) {
          // Find matching schedule entry
          const scheduleEntry = scheduleEntries.find((e: any) =>
            e.raceNumbers.includes(raceNum) &&
            // Also check series name match if possible
            (!race.raceSeriesName || scheduleEntries.filter((se: any) => se.raceNumbers.includes(raceNum)).length === 1 ||
              documentText.includes(race.raceSeriesName))
          );

          if (scheduleEntry) {
            if (!race.raceDate) {
              race.raceDate = scheduleEntry.date;
              console.log(`[extract-race-details] Patched date for ${race.raceName}: ${scheduleEntry.date}`);
            }
            if (!race.warningSignalTime || race.warningSignalTime === '14:00') {
              race.warningSignalTime = scheduleEntry.time;
              console.log(`[extract-race-details] Patched time for ${race.raceName}: ${scheduleEntry.time}`);
            }
            if (!race.venueVariant && scheduleEntry.venue) {
              race.venueVariant = scheduleEntry.venue;
            }
          }
        }
      }
    }

    // Build source tracking information for provenance
    const sourceTracking = buildSourceTracking(extractedData, url);

    // Return the extracted data with source tracking
    return new Response(
      JSON.stringify({
        success: true,
        ...extractedData,
        sourceTracking,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-race-details] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
