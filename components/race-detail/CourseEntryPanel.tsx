/**
 * CourseEntryPanel Component
 * Provides multiple ways to enter course data:
 * - Manual waypoint entry (text/coordinates)
 * - URL input (sailing instructions link)
 * - PDF/Image upload with AI extraction
 */

import { supabase } from '@/services/supabase';
import type { Mark } from '@/types/courses';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { createLogger } from '@/lib/utils/logger';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

interface RouteWaypoint {
  name: string;
  latitude: number;
  longitude: number;
  type: 'start' | 'waypoint' | 'gate' | 'finish' | 'mark';
  passingSide?: 'port' | 'starboard' | 'either';
  notes?: string;
}

interface CourseEntryPanelProps {
  onWaypointsExtracted: (waypoints: RouteWaypoint[]) => void;
  onMarksExtracted?: (marks: Mark[]) => void;
  raceType?: 'fleet' | 'distance';
  venueName?: string;
  venueId?: string;
  onCourseSaved?: (courseId: string) => void;
}

type TabType = 'manual' | 'url' | 'upload';

const logger = createLogger('CourseEntryPanel');

export function CourseEntryPanel({
  onWaypointsExtracted,
  onMarksExtracted,
  raceType = 'distance',
  venueName,
  venueId,
  onCourseSaved,
}: CourseEntryPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const [manualText, setManualText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedWaypoints, setParsedWaypoints] = useState<RouteWaypoint[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Save course state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseVisibility, setCourseVisibility] = useState<'private' | 'venue' | 'public'>('venue');
  const [isSaving, setIsSaving] = useState(false);
  const [extractedCourseName, _setExtractedCourseName] = useState<string | null>(null);
  const [extractedTotalDistance, _setExtractedTotalDistance] = useState<number | null>(null);

  // Parse manual text input for coordinates
  const parseManualInput = useCallback((text: string): RouteWaypoint[] => {
    const waypoints: RouteWaypoint[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Patterns for coordinate parsing
    const patterns = [
      // "Start: 22.2855°N, 114.1577°E" or "Mark 1: 22.265, 114.210"
      /^(.+?):\s*(-?\d+\.?\d*)[°]?\s*([NS])?,?\s*(-?\d+\.?\d*)[°]?\s*([EW])?$/i,
      // "22.2855, 114.1577" (just coordinates)
      /^(-?\d+\.?\d*)[°]?\s*([NS])?,?\s*(-?\d+\.?\d*)[°]?\s*([EW])?$/i,
      // "22°17'08"N 114°09'28"E" (DMS format)
      /^(.+?):\s*(\d+)[°](\d+)'(\d+(?:\.\d+)?)"?\s*([NS])\s+(\d+)[°](\d+)'(\d+(?:\.\d+)?)"?\s*([EW])$/i,
      // GPX/KML waypoint format: <wpt lat="22.2855" lon="114.1577"><name>Start</name></wpt>
      /<wpt\s+lat="(-?\d+\.?\d*)"\s+lon="(-?\d+\.?\d*)"[^>]*>(?:\s*<name>([^<]*)<\/name>)?/gi,
    ];

    let waypointIndex = 0;

    lines.forEach((line, _lineIndex) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Try pattern 1: Named coordinate
      let match = trimmedLine.match(patterns[0]);
      if (match) {
        let lat = parseFloat(match[2]);
        let lng = parseFloat(match[4]);
        if (match[3]?.toUpperCase() === 'S') lat = -lat;
        if (match[5]?.toUpperCase() === 'W') lng = -lng;
        
        const name = match[1].trim();
        waypoints.push({
          name,
          latitude: lat,
          longitude: lng,
          type: inferWaypointType(name, waypointIndex, lines.length),
        });
        waypointIndex++;
        return;
      }

      // Try pattern 2: Just coordinates
      match = trimmedLine.match(patterns[1]);
      if (match) {
        let lat = parseFloat(match[1]);
        let lng = parseFloat(match[3]);
        if (match[2]?.toUpperCase() === 'S') lat = -lat;
        if (match[4]?.toUpperCase() === 'W') lng = -lng;

        waypoints.push({
          name: `Waypoint ${waypointIndex + 1}`,
          latitude: lat,
          longitude: lng,
          type: inferWaypointType('', waypointIndex, lines.length),
        });
        waypointIndex++;
        return;
      }

      // Try DMS format
      match = trimmedLine.match(patterns[2]);
      if (match) {
        const latDeg = parseInt(match[2]);
        const latMin = parseInt(match[3]);
        const latSec = parseFloat(match[4]);
        let lat = latDeg + latMin / 60 + latSec / 3600;
        if (match[5].toUpperCase() === 'S') lat = -lat;

        const lngDeg = parseInt(match[6]);
        const lngMin = parseInt(match[7]);
        const lngSec = parseFloat(match[8]);
        let lng = lngDeg + lngMin / 60 + lngSec / 3600;
        if (match[9].toUpperCase() === 'W') lng = -lng;

        const name = match[1].trim();
        waypoints.push({
          name,
          latitude: lat,
          longitude: lng,
          type: inferWaypointType(name, waypointIndex, lines.length),
        });
        waypointIndex++;
      }
    });

    // Also check for GPX format in the whole text
    const gpxMatches = text.matchAll(patterns[3]);
    for (const gpxMatch of gpxMatches) {
      const lat = parseFloat(gpxMatch[1]);
      const lng = parseFloat(gpxMatch[2]);
      const name = gpxMatch[3] || `Waypoint ${waypoints.length + 1}`;
      waypoints.push({
        name,
        latitude: lat,
        longitude: lng,
        type: inferWaypointType(name, waypoints.length, waypoints.length + 1),
      });
    }

    return waypoints;
  }, []);

  // Infer waypoint type from name
  const inferWaypointType = (name: string, index: number, total: number): RouteWaypoint['type'] => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('start')) return 'start';
    if (lowerName.includes('finish')) return 'finish';
    if (lowerName.includes('gate')) return 'gate';
    if (lowerName.includes('mark')) return 'mark';
    
    // Infer from position
    if (index === 0) return 'start';
    if (index === total - 1) return 'finish';
    return 'waypoint';
  };

  // Handle manual text parse (for formatted coordinates)
  const handleParseManual = useCallback(() => {
    setError(null);
    const waypoints = parseManualInput(manualText);
    
    if (waypoints.length === 0) {
      setError('No valid coordinates found. Please check the format.');
      return;
    }

    setParsedWaypoints(waypoints);
    setShowPreview(true);
  }, [manualText, parseManualInput]);

  // Handle AI extraction from raw pasted text (like from a PDF)
  const handleAIExtractFromText = useCallback(async (retryCount = 0) => {
    if (!manualText.trim()) {
      setError('Please paste some text first');
      return;
    }

    // Check if text is too short to be useful
    if (manualText.trim().length < 50) {
      setError('Text seems too short. Please paste more content from your document.');
      return;
    }

    logger.debug('Starting AI extraction from pasted text, attempt:', retryCount + 1);
    logger.debug('Text length:', manualText.length);
    logger.debug('supabase object:', typeof supabase);
    logger.debug('supabase.functions:', typeof supabase?.functions);
    setIsProcessing(true);
    setError(null);

    try {
      // Limit text size to avoid timeouts
      const textToProcess = manualText.slice(0, 30000);
      
      logger.debug('About to invoke extract-course-from-text...');
      const startTime = Date.now();
      
      // Try direct fetch first as supabase.functions.invoke seems to hang
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      logger.debug('Supabase URL:', supabaseUrl);
      logger.debug('Making direct fetch to edge function...');
      
      const fetchPromise = fetch(`${supabaseUrl}/functions/v1/extract-course-from-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey!,
        },
        body: JSON.stringify({
          text: textToProcess,
          raceType,
        }),
      }).then(async (response) => {
        logger.debug('Fetch response received, status:', response.status);
        const responseText = await response.text();
        logger.debug('Response text length:', responseText.length);
        try {
          const data = JSON.parse(responseText);
          return { data, error: response.ok ? null : new Error(`HTTP ${response.status}`) };
        } catch {
          return { data: null, error: new Error(`Invalid JSON: ${responseText.slice(0, 100)}`) };
        }
      }).catch((err) => {
        logger.error('Fetch error:', err);
        return { data: null, error: err };
      });
      
      logger.debug('fetchPromise created');

      const timeoutPromise = new Promise<{ data: null, error: Error }>((resolve) => {
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          logger.debug('Timeout triggered after', elapsed, 'ms');
          resolve({ data: null, error: new Error('TIMEOUT') });
        }, 90000); // 90 seconds for large documents
      });

      logger.debug('Starting Promise.race...');
      const { data, error: fnError } = await Promise.race([fetchPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;
      logger.debug('Promise.race completed after', elapsed, 'ms');

      logger.debug('AI extraction response:', { data, error: fnError });

      if (fnError) {
        logger.error('AI extraction error:', fnError);
        throw fnError;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.waypoints && data.waypoints.length > 0) {
        logger.debug('AI found waypoints:', data.waypoints.length);
        setParsedWaypoints(data.waypoints);
        setShowPreview(true);
      } else {
        setError('No course waypoints found in the text. Make sure the text contains coordinate information.');
      }
    } catch (err: any) {
      logger.error('AI extraction error:', err);
      
      // Check if it's a network error or timeout that might be fixed by retry
      const isNetworkError = err.message?.includes('network') || 
                             err.message?.includes('TIMEOUT') ||
                             err.message?.includes('fetch') ||
                             err.message?.includes('Failed to fetch') ||
                             err.name === 'TypeError';
      
      if (isNetworkError && retryCount < 2) {
        logger.debug('Network error, retrying...', retryCount + 1);
        setError('Connection issue, retrying...');
        // Don't call finally, continue with retry
        setTimeout(() => {
          setIsProcessing(true);
          handleAIExtractFromText(retryCount + 1);
        }, 1500);
        return;
      }
      
      setError(
        err.message === 'TIMEOUT'
          ? 'Request timed out. The server may be processing - please refresh the page and try again.'
          : err.message || 'Failed to extract course data. Try using formatted coordinates instead.'
      );
    } finally {
      setIsProcessing(false);
    }
  }, [manualText, raceType]);

  // Handle URL fetch
  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    logger.debug('Starting URL fetch:', urlInput);
    setIsProcessing(true);
    setError(null);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

      // Call edge function to extract course from URL
      logger.debug('Calling extract-course-from-url edge function...');
      const { data, error: fnError } = await supabase.functions.invoke('extract-course-from-url', {
        body: {
          url: urlInput,
          raceType,
        },
      });

      clearTimeout(timeoutId);

      logger.debug('Response:', { data, error: fnError });

      if (fnError) {
        logger.error('Edge function error:', fnError);
        throw fnError;
      }

      // Check if the response contains an error (like PDF not supported)
      if (data?.error) {
        logger.debug('Server returned error:', data.error);
        setError(data.error);
        return;
      }
      
      if (data?.waypoints && data.waypoints.length > 0) {
        logger.debug('Found waypoints:', data.waypoints.length);
        setParsedWaypoints(data.waypoints);
        setShowPreview(true);
      } else {
        logger.debug('No waypoints found in response');
        setError('No course waypoints found at this URL. Try uploading the document directly or using Manual Entry.');
      }
    } catch (err: any) {
      logger.error('URL fetch error:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. The page may be too large. Try uploading the PDF directly.');
      } else {
        setError(err.message || 'Failed to fetch course data from URL. Check browser console for details.');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [urlInput, raceType]);

  // Handle file upload
  const handleFileUpload = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setIsProcessing(false);
        return;
      }

      const file = result.assets[0];
      
      // Read file content
      let fileContent: string | null = null;
      let fileType = file.mimeType || 'application/octet-stream';
      
      if (Platform.OS === 'web') {
        // For web, fetch the file and convert to base64
        const response = await fetch(file.uri);
        const blob = await response.blob();
        fileContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } else {
        // For native, use the uri directly
        fileContent = file.uri;
      }

      // Call edge function to extract course from document
      const { data, error: fnError } = await supabase.functions.invoke('extract-course-from-document', {
        body: {
          fileContent,
          fileName: file.name,
          fileType,
          raceType,
        },
      });

      if (fnError) throw fnError;

      if (data?.waypoints && data.waypoints.length > 0) {
        setParsedWaypoints(data.waypoints);
        setShowPreview(true);
      } else {
        setError('No course waypoints found in document. Try entering coordinates manually.');
      }
    } catch (err: any) {
      logger.error('Upload error:', err);
      setError(err.message || 'Failed to extract course from document');
    } finally {
      setIsProcessing(false);
    }
  }, [raceType]);

  // Calculate total distance from waypoints
  const calculateTotalDistance = useCallback((waypoints: RouteWaypoint[]): number => {
    if (waypoints.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const lat1 = waypoints[i].latitude * Math.PI / 180;
      const lat2 = waypoints[i + 1].latitude * Math.PI / 180;
      const dLat = lat2 - lat1;
      const dLon = (waypoints[i + 1].longitude - waypoints[i].longitude) * Math.PI / 180;
      
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = 6371 * c;
      total += distKm * 0.539957; // Convert to nautical miles
    }
    return Math.round(total * 10) / 10;
  }, []);

  // Save course to database
  const handleSaveCourse = useCallback(async () => {
    if (!courseName.trim()) {
      showAlert('Name Required', 'Please enter a name for this course.');
      return;
    }

    logger.debug('Starting save course...');
    setIsSaving(true);
    try {
      // Get user with timeout to prevent hanging
      logger.debug('Getting user session...');
      const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => {
          logger.error('Session lookup timed out');
          resolve({ data: { session: null } });
        }, 5000)
      );
      
      const { data: sessionData } = await Promise.race([
        supabase.auth.getSession(),
        sessionTimeout
      ]);
      
      logger.debug('Session result:', sessionData?.session ? 'found' : 'not found');
      
      if (!sessionData?.session?.user) {
        showAlert('Sign In Required', 'Please sign in to save courses.');
        setIsSaving(false);
        return;
      }
      
      const userData = { user: sessionData.session.user };

      // Convert waypoints to marks format for storage
      const marks = parsedWaypoints.map((wp, index) => ({
        id: `mark-${index}`,
        name: wp.name,
        type: wp.type === 'start' ? 'committee_boat' : 
              wp.type === 'finish' ? 'finish' :
              wp.type === 'gate' ? 'gate_left' : 'custom',
        latitude: wp.latitude,
        longitude: wp.longitude,
        passingSide: wp.passingSide,
        notes: wp.notes,
      }));

      const totalDistance = extractedTotalDistance || calculateTotalDistance(parsedWaypoints);

      logger.debug('Inserting course into database...');
      
      // Add timeout to database insert
      const insertTimeout = new Promise<{ data: null, error: Error }>((resolve) =>
        setTimeout(() => {
          logger.error('Database insert timed out');
          resolve({ data: null, error: new Error('Save timed out. Please try again.') });
        }, 15000)
      );
      
      const insertPromise = supabase
        .from('race_courses')
        .insert({
          name: courseName.trim(),
          description: courseDescription.trim() || null,
          venue_id: venueId || null,
          marks: marks,
          course_type: raceType === 'distance' ? 'coastal' : 'custom',
          race_type: raceType,
          typical_length_nm: totalDistance,
          total_distance_nm: totalDistance,
          visibility: courseVisibility,
          created_by: userData.user.id,
          origin: 'user-created',
          source_document_text: manualText || null,
          metadata: {
            venueName: venueName,
            waypointCount: parsedWaypoints.length,
            createdFrom: activeTab,
          },
        })
        .select('id')
        .single();

      const { data, error: saveError } = await Promise.race([insertPromise, insertTimeout]);

      if (saveError) {
        logger.error('Save error:', saveError);
        showAlert('Save Failed', saveError.message);
        setIsSaving(false);
        return;
      }

      logger.debug('Course saved:', data?.id);
      
      // Success!
      showAlert(
        'Course Saved! 🎉',
        `"${courseName}" has been saved to ${
          courseVisibility === 'private' ? 'your private courses' :
          courseVisibility === 'venue' ? `courses at ${venueName || 'this venue'}` :
          'public courses'
        }.`
      );

      setShowSaveModal(false);
      onCourseSaved?.(data.id);
      
      // Also use the waypoints
      handleConfirmWaypoints();
    } catch (err) {
      logger.error('Save exception:', err);
      showAlert('Error', 'Failed to save course. Please try again.');
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    courseName,
    courseDescription,
    parsedWaypoints,
    venueId, 
    venueName, 
    raceType, 
    courseVisibility, 
    manualText, 
    activeTab,
    extractedTotalDistance,
    calculateTotalDistance,
    onCourseSaved,
  ]);

  // Confirm and use parsed waypoints
  const handleConfirmWaypoints = useCallback(() => {
    onWaypointsExtracted(parsedWaypoints);
    
    // Also convert to marks if callback provided
    if (onMarksExtracted) {
      const marks: Mark[] = parsedWaypoints.map((wp, index) => ({
        id: `extracted-${index}`,
        name: wp.name,
        type: wp.type === 'start' ? 'committee_boat' : 
              wp.type === 'finish' ? 'finish' :
              wp.type === 'gate' ? 'gate_left' : 'custom',
        latitude: wp.latitude,
        longitude: wp.longitude,
      }));
      onMarksExtracted(marks);
    }

    // Reset state
    setParsedWaypoints([]);
    setShowPreview(false);
    setManualText('');
    setUrlInput('');
  }, [parsedWaypoints, onWaypointsExtracted, onMarksExtracted]);

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'manual' && styles.tabActive]}
        onPress={() => setActiveTab('manual')}
      >
        <MaterialCommunityIcons
          name="pencil"
          size={18}
          color={activeTab === 'manual' ? '#7C3AED' : '#64748B'}
        />
        <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
          Manual
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'url' && styles.tabActive]}
        onPress={() => setActiveTab('url')}
      >
        <MaterialCommunityIcons
          name="link"
          size={18}
          color={activeTab === 'url' ? '#7C3AED' : '#64748B'}
        />
        <Text style={[styles.tabText, activeTab === 'url' && styles.tabTextActive]}>
          From URL
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'upload' && styles.tabActive]}
        onPress={() => setActiveTab('upload')}
      >
        <MaterialCommunityIcons
          name="file-upload"
          size={18}
          color={activeTab === 'upload' ? '#7C3AED' : '#64748B'}
        />
        <Text style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}>
          Upload
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render manual entry tab
  const renderManualTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.helpText}>
        Paste text from your sailing instructions, Notice of Race, or formatted coordinates:
      </Text>

      <TextInput
        style={styles.textInput}
        multiline
        placeholder={`Paste sailing instructions text here...\n\nOr formatted coordinates:\nStart: 22.2855°N, 114.1577°E\nMark 1: 22.2650°N, 114.2100°E\nFinish: 22.2855°N, 114.1577°E`}
        placeholderTextColor="#94A3B8"
        value={manualText}
        onChangeText={setManualText}
        textAlignVertical="top"
        editable={!isProcessing}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            // Paste from clipboard
            if (Platform.OS === 'web') {
              navigator.clipboard.readText().then(text => setManualText(text));
            }
          }}
          disabled={isProcessing}
        >
          <MaterialCommunityIcons name="clipboard-outline" size={18} color="#64748B" />
          <Text style={styles.secondaryButtonText}>Paste</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, !manualText.trim() && styles.buttonDisabled]}
          onPress={handleParseManual}
          disabled={!manualText.trim() || isProcessing}
        >
          <MaterialCommunityIcons name="map-marker-check" size={18} color="#64748B" />
          <Text style={styles.secondaryButtonText}>Parse Coords</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR extract automatically</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.aiButton, (!manualText.trim() || isProcessing) && styles.buttonDisabled]}
        onPress={() => handleAIExtractFromText(0)}
        disabled={!manualText.trim() || isProcessing}
      >
        {isProcessing ? (
          <>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.aiButtonText}>Extracting...</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="auto-fix" size={20} color="white" />
            <Text style={styles.aiButtonText}>✨ Extract Waypoints</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.tipText}>
        💡 Waypoints can be extracted from raw sailing instructions text
      </Text>
    </View>
  );

  // Render URL tab
  const renderUrlTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.helpText}>
        Enter a URL to sailing instructions or course information page:
      </Text>

      <TextInput
        style={styles.urlInput}
        placeholder="https://example.com/sailing-instructions.pdf"
        placeholderTextColor="#94A3B8"
        value={urlInput}
        onChangeText={setUrlInput}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!isProcessing}
      />

      <TouchableOpacity
        style={[styles.primaryButton, styles.fullWidthButton, (!urlInput.trim() || isProcessing) && styles.buttonDisabled]}
        onPress={handleFetchUrl}
        disabled={!urlInput.trim() || isProcessing}
      >
        {isProcessing ? (
          <>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.primaryButtonText}>Analyzing...</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="cloud-download" size={18} color="white" />
            <Text style={styles.primaryButtonText}>Fetch Course Data</Text>
          </>
        )}
      </TouchableOpacity>

      {isProcessing && (
        <View style={styles.processingNote}>
          <Text style={styles.processingNoteText}>
            ⏳ This may take up to 60 seconds while the page is fetched and analyzed...
          </Text>
        </View>
      )}

      <Text style={styles.tipText}>
        💡 Tip: Works best with PDFs or web pages containing coordinate tables
      </Text>
    </View>
  );

  // Render upload tab
  const renderUploadTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.helpText}>
        Upload a document containing course information:
      </Text>

      <TouchableOpacity
        style={styles.uploadZone}
        onPress={handleFileUpload}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <View style={styles.uploadContent}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.uploadProcessingText}>
              Processing document...
            </Text>
          </View>
        ) : (
          <View style={styles.uploadContent}>
            <MaterialCommunityIcons name="file-document-outline" size={48} color="#7C3AED" />
            <Text style={styles.uploadText}>
              Tap to select file
            </Text>
            <Text style={styles.uploadSubtext}>
              PDF, Image, or Text file
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.supportedFormats}>
        <Text style={styles.supportedTitle}>Supported formats:</Text>
        <View style={styles.formatTags}>
          <View style={styles.formatTag}>
            <MaterialCommunityIcons name="file-pdf-box" size={14} color="#EF4444" />
            <Text style={styles.formatTagText}>PDF</Text>
          </View>
          <View style={styles.formatTag}>
            <MaterialCommunityIcons name="image" size={14} color="#10B981" />
            <Text style={styles.formatTagText}>Images</Text>
          </View>
          <View style={styles.formatTag}>
            <MaterialCommunityIcons name="file-document" size={14} color="#3B82F6" />
            <Text style={styles.formatTagText}>Text</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Render preview
  const renderPreview = () => (
    <View style={styles.previewContainer}>
      <View style={styles.previewHeader}>
        <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
        <Text style={styles.previewTitle}>
          {parsedWaypoints.length} Waypoints Found
        </Text>
      </View>

      <ScrollView style={styles.waypointList}>
        {parsedWaypoints.map((wp, index) => (
          <View key={index} style={styles.waypointItem}>
            <View style={[styles.waypointIcon, getWaypointIconStyle(wp.type)]}>
              <MaterialCommunityIcons
                name={getWaypointIconName(wp.type)}
                size={14}
                color={getWaypointIconColor(wp.type)}
              />
            </View>
            <View style={styles.waypointInfo}>
              <Text style={styles.waypointName}>{wp.name}</Text>
              <Text style={styles.waypointCoords}>
                {wp.latitude.toFixed(5)}°, {wp.longitude.toFixed(5)}°
              </Text>
            </View>
            <Text style={styles.waypointType}>{wp.type}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.previewActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            setShowPreview(false);
            setParsedWaypoints([]);
          }}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => {
            // Pre-populate course name if we extracted one
            if (extractedCourseName && !courseName) {
              setCourseName(extractedCourseName);
            }
            setShowSaveModal(true);
          }}
        >
          <MaterialCommunityIcons name="content-save" size={18} color="#7C3AED" />
          <Text style={styles.saveButtonText}>Save Course</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleConfirmWaypoints}
        >
          <MaterialCommunityIcons name="check" size={18} color="white" />
          <Text style={styles.primaryButtonText}>Use These Waypoints</Text>
        </TouchableOpacity>
      </View>

      {/* Save Course Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="map-marker-plus" size={24} color="#7C3AED" />
              <Text style={styles.modalTitle}>Save Course</Text>
              <TouchableOpacity 
                style={styles.modalClose}
                onPress={() => setShowSaveModal(false)}
              >
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Course Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={courseName}
              onChangeText={setCourseName}
              placeholder="e.g., Around the Island Race"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.modalLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={courseDescription}
              onChangeText={setCourseDescription}
              placeholder="Course details, notes..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.modalLabel}>Visibility</Text>
            <View style={styles.visibilityOptions}>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  courseVisibility === 'private' && styles.visibilityOptionActive
                ]}
                onPress={() => setCourseVisibility('private')}
              >
                <MaterialCommunityIcons 
                  name="lock" 
                  size={18} 
                  color={courseVisibility === 'private' ? '#7C3AED' : '#64748B'} 
                />
                <Text style={[
                  styles.visibilityText,
                  courseVisibility === 'private' && styles.visibilityTextActive
                ]}>Private</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  courseVisibility === 'venue' && styles.visibilityOptionActive
                ]}
                onPress={() => setCourseVisibility('venue')}
              >
                <MaterialCommunityIcons 
                  name="map-marker" 
                  size={18} 
                  color={courseVisibility === 'venue' ? '#7C3AED' : '#64748B'} 
                />
                <Text style={[
                  styles.visibilityText,
                  courseVisibility === 'venue' && styles.visibilityTextActive
                ]}>Venue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  courseVisibility === 'public' && styles.visibilityOptionActive
                ]}
                onPress={() => setCourseVisibility('public')}
              >
                <MaterialCommunityIcons 
                  name="earth" 
                  size={18} 
                  color={courseVisibility === 'public' ? '#7C3AED' : '#64748B'} 
                />
                <Text style={[
                  styles.visibilityText,
                  courseVisibility === 'public' && styles.visibilityTextActive
                ]}>Public</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.visibilityHint}>
              {courseVisibility === 'private' && '🔒 Only you can see this course'}
              {courseVisibility === 'venue' && `📍 Visible to sailors at ${venueName || 'this venue'}`}
              {courseVisibility === 'public' && '🌍 Visible to all RegattaFlow users'}
            </Text>

            {venueName && (
              <View style={styles.venueInfo}>
                <MaterialCommunityIcons name="sail-boat" size={16} color="#64748B" />
                <Text style={styles.venueInfoText}>
                  Linked to: {venueName}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, isSaving && styles.buttonDisabled]}
                onPress={handleSaveCourse}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={18} color="white" />
                    <Text style={styles.modalSaveText}>Save Course</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  // Helper functions for waypoint icons
  const getWaypointIconName = (type: string): string => {
    switch (type) {
      case 'start': return 'flag-variant';
      case 'finish': return 'flag-checkered';
      case 'gate': return 'gate';
      case 'mark': return 'map-marker';
      default: return 'circle';
    }
  };

  const getWaypointIconColor = (type: string): string => {
    switch (type) {
      case 'start': return '#10B981';
      case 'finish': return '#EF4444';
      case 'gate': return '#F59E0B';
      default: return '#7C3AED';
    }
  };

  const getWaypointIconStyle = (type: string): object => {
    const color = getWaypointIconColor(type);
    return {
      backgroundColor: `${color}20`,
      borderColor: color,
    };
  };

  // Render content based on preview state
  if (showPreview) {
    return renderPreview();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="map-marker-plus" size={20} color="#7C3AED" />
        <Text style={styles.headerTitle}>Add Course</Text>
      </View>

      {venueName && (
        <View style={styles.venueTag}>
          <MaterialCommunityIcons name="map-marker" size={14} color="#64748B" />
          <Text style={styles.venueText}>{venueName}</Text>
        </View>
      )}

      {renderTabs()}

      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {activeTab === 'manual' && renderManualTab()}
      {activeTab === 'url' && renderUrlTab()}
      {activeTab === 'upload' && renderUploadTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  venueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  venueText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'white',
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#7C3AED',
  },
  tabContent: {
    gap: 12,
  },
  helpText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  formatExamples: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  formatExample: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 120,
    backgroundColor: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  fullWidthButton: {
    flex: 0,
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  aiButton: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(139, 92, 246, 0.3)',
      },
      default: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  aiButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  tipText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  processingNote: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  processingNoteText: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
  },
  uploadZone: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  uploadContent: {
    alignItems: 'center',
    gap: 8,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  uploadSubtext: {
    fontSize: 13,
    color: '#94A3B8',
  },
  uploadProcessingText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '500',
    marginTop: 8,
  },
  supportedFormats: {
    marginTop: 12,
  },
  supportedTitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  formatTags: {
    flexDirection: 'row',
    gap: 8,
  },
  formatTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  formatTagText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#EF4444',
  },
  previewContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  waypointList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  waypointIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginRight: 10,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  waypointCoords: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  waypointType: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'capitalize',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#7C3AED',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  saveButtonText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalClose: {
    padding: 4,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  visibilityOptionActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  visibilityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  visibilityTextActive: {
    color: '#7C3AED',
  },
  visibilityHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  venueInfoText: {
    fontSize: 13,
    color: '#64748B',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});

export default CourseEntryPanel;

