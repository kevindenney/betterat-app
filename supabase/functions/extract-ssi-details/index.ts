import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { complete } from '../_shared/ai/provider.ts';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Extract SSI Details Edge Function
 *
 * Extracts structured data from Sailing Instructions (SSI) documents:
 * - VHF channels (race committee, safety, start lines)
 * - Course marks and positions
 * - Emergency contacts
 * - Racing area information
 * - Course configurations
 * - Racing procedures
 *
 * Accepts either:
 * - text: Direct text content to analyze
 * - documentId: ID of a user_club_documents record to extract from
 */

interface ExtractionRequest {
  text?: string;
  documentId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let activeDocumentId: string | undefined;

  try {
    const { text, documentId }: ExtractionRequest = await req.json();
    activeDocumentId = documentId;

    if (!text && !documentId) {
      return new Response(
        JSON.stringify({ error: 'Either text or documentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // API key is checked inside complete()

    let documentText = text;

    // If documentId provided, fetch the document and update status
    if (documentId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get the document record
      const { data: document, error: docError } = await supabase
        .from('user_club_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return new Response(
          JSON.stringify({ error: 'Document not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update status to processing
      await supabase
        .from('user_club_documents')
        .update({ extraction_status: 'processing' })
        .eq('id', documentId);

      // Download the file from storage
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('user-documents')
        .download(document.file_path);

      if (fileError || !fileData) {
        await supabase
          .from('user_club_documents')
          .update({
            extraction_status: 'failed',
            extraction_error: 'Failed to download file from storage'
          })
          .eq('id', documentId);

        return new Response(
          JSON.stringify({ error: 'Failed to download document' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if it's a PDF and extract text
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const isPdf = bytes.length >= 5 &&
        bytes[0] === 0x25 && // %
        bytes[1] === 0x50 && // P
        bytes[2] === 0x44 && // D
        bytes[3] === 0x46 && // F
        bytes[4] === 0x2D;   // -

      if (isPdf) {
        // Use pdf-parse for PDF extraction
        const { Buffer } = await import("node:buffer");
        const pdf = (await import("npm:pdf-parse@1.1.1")).default;

        const buffer = Buffer.from(arrayBuffer);
        const pdfData = await pdf(buffer);
        documentText = pdfData.text;
      } else {
        // Assume it's plain text
        documentText = new TextDecoder().decode(bytes);
      }
    }

    if (!documentText || documentText.trim().length < 50) {
      const errorMsg = 'Document text too short or empty for meaningful extraction';

      if (documentId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('user_club_documents')
          .update({
            extraction_status: 'failed',
            extraction_error: errorMsg
          })
          .eq('id', documentId);
      }

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Gemini Flash with SSI-specific extraction prompt
    const ssiPrompt = `You are an expert at extracting structured data from Sailing Instructions (SSI) documents.

Extract the following information from this SSI document:

DOCUMENT:
${documentText.substring(0, 25000)}

Return a JSON object with this EXACT structure:

{
  "vhfChannels": {
    "raceCommittee": {
      "channel": string,  // e.g., "72"
      "name": string | null,  // e.g., "Race Committee"
      "purpose": string | null
    } | null,
    "safety": {
      "channel": string,
      "name": string | null,
      "purpose": string | null  // e.g., "Safety Watch", "Distress"
    } | null,
    "startLines": [
      {
        "channel": string,
        "lineName": string  // e.g., "Inner Starting Line", "Outer Starting Line"
      }
    ] | null,
    "other": [
      {
        "channel": string,
        "purpose": string  // e.g., "Finish", "Protest Committee"
      }
    ] | null
  },

  "marks": [
    {
      "name": string,  // e.g., "ODM", "Kellett VIII", "Alpha"
      "type": "permanent" | "temporary" | "government" | "inflatable" | "virtual",
      "position": {
        "lat": number,  // Decimal degrees if available
        "lng": number
      } | null,
      "description": string | null,  // e.g., "Orange inflatable buoy"
      "color": string | null,
      "rounding": "port" | "starboard" | "either" | null
    }
  ],

  "emergencyContacts": [
    {
      "name": string,  // e.g., "Marine Rescue Centre", "RHKYC Race Office"
      "phone": string | null,
      "vhfChannel": string | null,  // e.g., "16" for Coast Guard
      "role": string  // e.g., "Marine Rescue", "Race Committee", "Safety Boat"
    }
  ],

  "racingArea": {
    "name": string | null,  // e.g., "Victoria Harbour", "Port Shelter"
    "description": string | null,
    "boundaries": [
      { "lat": number, "lng": number }
    ] | null,
    "prohibitedZones": [
      {
        "name": string,
        "reason": string,  // e.g., "Traffic Separation Scheme", "Military Zone"
        "boundaries": [{ "lat": number, "lng": number }] | null
      }
    ] | null
  },

  "courseConfigurations": [
    {
      "name": string,  // e.g., "Course Alpha", "Windward-Leeward"
      "type": "windward-leeward" | "triangle" | "trapezoid" | "distance" | "other",
      "description": string | null,
      "marks": [string] | null,  // Mark names in order
      "approximateDistanceNm": number | null
    }
  ],

  "procedures": {
    "startSequence": string | null,  // e.g., "5-4-1-0 minute sequence"
    "penaltySystem": string | null,  // e.g., "One-Turn Penalty", "Two-Turns"
    "protestDeadline": string | null,  // e.g., "90 minutes after finish"
    "signOnRequirements": string | null,  // e.g., "via SailSys 10 minutes before"
    "timeLimit": string | null  // e.g., "1700hrs absolute"
  },

  "confidence": number,  // 0.0 to 1.0 - overall extraction confidence
  "extractedSections": [string]  // List of sections successfully extracted
}

EXTRACTION GUIDELINES:
1. Extract ALL VHF channels mentioned - they are critical for race safety
2. Extract ALL marks with GPS coordinates if provided (may be in DMS or decimal format)
3. Include ALL emergency contacts - race office, marine rescue, coast guard, safety boats
4. For racing area, extract boundaries and any prohibited zones (TSS, military, etc.)
5. Extract course configurations - names, types, and mark sequences
6. For procedures, focus on start sequence, penalties, protests, sign-on, and time limits
7. Set confidence based on how clearly the information was stated (0.9+ for explicit, 0.5-0.8 for inferred)
8. List which sections you successfully extracted in extractedSections

If a section has no relevant information, set it to null or empty array.
Return ONLY the JSON object, no additional text.`;

    let content: string;
    try {
      const result = await complete({
        task: 'extraction',
        messages: [{ role: 'user', content: ssiPrompt }],
        maxOutputTokens: 4096,
        temperature: 0,
      });
      content = result.text.trim();
    } catch (aiError: any) {
      console.error('[extract-ssi-details] AI API error:', aiError.message);

      if (documentId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('user_club_documents')
          .update({
            extraction_status: 'failed',
            extraction_error: `AI extraction failed: ${aiError.message}`
          })
          .eq('id', documentId);
      }

      return new Response(
        JSON.stringify({ error: `AI API error: ${aiError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean markdown code blocks if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let extractedData;
    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      // Try to find JSON object in content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0]);
        } catch {
          throw parseError;
        }
      } else {
        throw parseError;
      }
    }

    // Add metadata
    extractedData.extractedAt = new Date().toISOString();
    extractedData.modelVersion = 'ai-provider';

    // If documentId provided, update the record with extracted data
    if (documentId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase
        .from('user_club_documents')
        .update({
          extraction_status: 'completed',
          extracted_data: extractedData,
          extracted_at: extractedData.extractedAt,
          extraction_error: null
        })
        .eq('id', documentId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        documentId: documentId || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-ssi-details] Error:', error);

    if (activeDocumentId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase
        .from('user_club_documents')
        .update({
          extraction_status: 'failed',
          extraction_error: error.message || 'Internal server error'
        })
        .eq('id', activeDocumentId);
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
