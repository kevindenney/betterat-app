/**
 * Comprehensive Sailor Onboarding Form
 * Single page with all structured fields for complete sailor profile
 */

import { BoatAutocompleteInput } from '@/components/onboarding/BoatAutocompleteInput';
import { VenueLocationPicker } from '@/components/races/VenueLocationPicker';
import { useAuth } from '@/providers/AuthProvider';
import {
  getBoatClassesForClub,
  getDocumentUrlsForRace,
  getEquipmentForClass,
  getHongKongClubs,
  getHongKongRaces,
  getSailNumbersForClass,
  HONG_KONG_CLUBS,
  isHongKongVenue,
} from '@/services/HongKongVenueIntelligence';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Anchor,
  ArrowLeft,
  Calendar,
  ChevronRight,
  FileText,
  Loader,
  MapPin,
  Plus,
  User,
  X
} from 'lucide-react-native';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

// Dynamic import helper for expo-location (native only)
let LocationModule: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!LocationModule) {
    LocationModule = await import('expo-location');
  }
  return LocationModule;
}

interface Boat {
  className: string;
  sailNumber: string;
  boatName?: string;
  hullMaker?: string;
  rigMaker?: string;
  sailMaker?: string;
  role: 'owner' | 'crew' | 'both';
  isPrimary: boolean;
}

interface Club {
  name: string;
  url?: string;
}

interface Document {
  type: 'class_association' | 'tuning_guide' | 'race_calendar' | 'sailing_instructions' | 'course_map' | 'other';
  url: string;
  description?: string;
}

interface NextRace {
  name: string;
  date: string;
  startTime: string;
  location: string;
  norUrl?: string;
  siUrl?: string;
  courseMapUrl?: string;
}

export default function SailorOnboardingComprehensive() {
  const router = useRouter();
  const { user, fetchUserProfile } = useAuth();
  const params = useLocalSearchParams();
  const [isMounted, setIsMounted] = useState(true);

  // Track mount state to prevent state updates after unmount
  React.useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Parse chatData if provided
  const chatData = params.chatData ? JSON.parse(params.chatData as string) : null;
  const fromChat = !!chatData;

  // Section 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [primaryRole, setPrimaryRole] = useState<'owner' | 'crew' | 'both'>('owner');

  // Section 2: Boats - Pre-populate from chat
  const [boats, setBoats] = useState<Boat[]>(
    chatData?.boats && chatData.boats.length > 0
      ? chatData.boats.map((b: any, idx: number) => ({
          className: b.className || '',
          sailNumber: b.sailNumber || '',
          boatName: b.boatName || '',
          hullMaker: b.hullMaker || '',
          rigMaker: b.rigMaker || '',
          sailMaker: b.sailMaker || '',
          role: 'owner' as const,
          isPrimary: idx === 0,
        }))
      : [{
          className: '',
          sailNumber: '',
          boatName: '',
          hullMaker: '',
          rigMaker: '',
          sailMaker: '',
          role: 'owner',
          isPrimary: true,
        }]
  );

  // Section 3: Clubs & Venues - Pre-populate from chat
  const [clubs, setClubs] = useState<Club[]>(
    chatData?.clubs && chatData.clubs.length > 0
      ? chatData.clubs.map((c: any) => ({ name: c.name || '', url: c.url || '' }))
      : [{ name: '', url: '' }]
  );
  const [homeVenue, setHomeVenue] = useState(
    chatData?.venues?.[0]?.name || ''
  );

  // Section 4: Documents - Pre-populate from chat
  const [documents, setDocuments] = useState<Document[]>(
    chatData?.documents || []
  );
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocType, setNewDocType] = useState<Document['type']>('class_association');

  // Section 5: Next Race (REQUIRED) - Pre-populate from chat
  const [nextRace, setNextRace] = useState<NextRace>({
    name: chatData?.nextRace?.name || '',
    date: chatData?.nextRace?.date || '',
    startTime: chatData?.nextRace?.startTime || '',
    location: chatData?.nextRace?.location || '',
    norUrl: chatData?.nextRace?.norUrl || '',
    siUrl: chatData?.nextRace?.siUrl || '',
    courseMapUrl: chatData?.nextRace?.courseMapUrl || '',
  });

  // Upcoming races from calendar scraping
  const upcomingRaces = chatData?.upcomingRaces || [];
  const [showRaceSelector, setShowRaceSelector] = useState(upcomingRaces.length > 0);

  // NEW: Direct paste fields
  const [calendarPasteData, setCalendarPasteData] = useState('');
  const [siNorPasteData, setSiNorPasteData] = useState('');
  const [raceAreaImageUri, setRaceAreaImageUri] = useState('');
  const [selectedRaces, setSelectedRaces] = useState<number[]>(
    upcomingRaces.length > 0 ? upcomingRaces.map((_: any, idx: number) => idx) : []
  ); // Track which races user wants to keep

  // AI processing states
  const [isProcessingSiNor, setIsProcessingSiNor] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionTimedOut, setExtractionTimedOut] = useState(false);
  const [extractedSiNorData, setExtractedSiNorData] = useState<{
    raceName?: string;
    date?: string;
    startTime?: string;
    location?: string;
    marks?: string[];
    courseDescription?: string;
    windLimits?: string;
  } | null>(null);
  
  // Debounce timer for SI/NOR extraction
  const siNorExtractionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Track if we've already auto-filled for this venue (prevent re-triggering)
  const [autoFilledForVenue, setAutoFilledForVenue] = useState<string>('');

  // Smart auto-suggestions when Hong Kong venue is detected
  useEffect(() => {
    if (!homeVenue.trim()) {
      setAutoFilledForVenue('');
      return;
    }

    const venueName = homeVenue.trim();
    if (!isHongKongVenue(venueName)) {
      setAutoFilledForVenue('');
      return;
    }

    // Only auto-fill once per venue
    if (autoFilledForVenue === venueName) return;

    // Auto-suggest clubs
    const hkClubs = getHongKongClubs(venueName);
    if (hkClubs.length > 0 && (!clubs[0]?.name || clubs[0].name === '')) {
      const firstClub = hkClubs[0];
      updateClub(0, 'name', firstClub.name);
      if (firstClub.website) {
        updateClub(0, 'url', firstClub.website);
      }

      // Auto-suggest boats for the club
      const suggestedBoats = getBoatClassesForClub(firstClub.name);
      if (suggestedBoats.length > 0 && (!boats[0]?.className || boats[0].className === '')) {
        const firstBoat = suggestedBoats[0];
        updateBoat(0, 'className', firstBoat);
        
        // Auto-suggest sail number
        const sailNumbers = getSailNumbersForClass(firstBoat);
        if (sailNumbers.length > 0 && (!boats[0]?.sailNumber || boats[0].sailNumber === '')) {
          updateBoat(0, 'sailNumber', sailNumbers[0]);
        }

        // Auto-suggest equipment
        const equipment = getEquipmentForClass(firstBoat);
        if (equipment.hullMakers.length > 0 && !boats[0]?.hullMaker) {
          updateBoat(0, 'hullMaker', equipment.hullMakers[0]);
        }
        if (equipment.rigMakers.length > 0 && !boats[0]?.rigMaker) {
          updateBoat(0, 'rigMaker', equipment.rigMakers[0]);
        }
        if (equipment.sailMakers.length > 0 && !boats[0]?.sailMaker) {
          updateBoat(0, 'sailMaker', equipment.sailMakers[0]);
        }
      }
    }

    // Auto-suggest races
    const hkRaces = getHongKongRaces(venueName);
    if (hkRaces.length > 0 && !nextRace.name) {
      const firstRace = hkRaces[0];
      setNextRace(prev => ({
        ...prev,
        name: firstRace.name,
        location: venueName,
      }));

      // Auto-suggest documents for the race
      const docUrls = getDocumentUrlsForRace(firstRace.name);
      if (docUrls.classAssociation && documents.length === 0) {
        setDocuments([{
          type: 'class_association',
          url: docUrls.classAssociation,
        }]);
      }
      if (docUrls.tuningGuide) {
        setDocuments(prev => {
          const hasTuningGuide = prev.some(d => d.type === 'tuning_guide');
          if (!hasTuningGuide) {
            return [...prev, {
              type: 'tuning_guide',
              url: docUrls.tuningGuide!,
            }];
          }
          return prev;
        });
      }
      if (docUrls.calendar) {
        setDocuments(prev => {
          const hasCalendar = prev.some(d => d.type === 'race_calendar');
          if (!hasCalendar) {
            return [...prev, {
              type: 'race_calendar',
              url: docUrls.calendar!,
            }];
          }
          return prev;
        });
      }
    }

    setAutoFilledForVenue(venueName);
    // Intentionally fires only on homeVenue change; auto-fill mutations read latest state but should not re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeVenue]);

  // Auto-detect location on mount (mobile only)
  useEffect(() => {
    const detectLocation = async () => {
      if (homeVenue || Platform.OS === 'web') return;

      const Location = await getLocationModule();
      if (!Location) return;

      try {
        setDetectingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setDetectingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        // Reverse geocode to get venue name
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode && geocode.length > 0) {
          const address = geocode[0];
          if (address.city === 'Hong Kong' || address.region === 'Hong Kong') {
            setHomeVenue('Victoria Harbour, Hong Kong');
          }
        }
      } catch (error) {
        console.error('Location detection error:', error);
      } finally {
        setDetectingLocation(false);
      }
    };

    detectLocation();
    // Runs once on mount; intentionally does not re-fire if homeVenue changes via user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle text input change (just update state, don't extract yet)
  const handleSiNorTextChange = useCallback((text: string) => {
    setSiNorPasteData(text);
    
    // Clear any previous extraction, errors, and timeout state when text changes
    setExtractedSiNorData(null);
    setExtractionError(null);
    setExtractionTimedOut(false);
    
    // Clear existing timer
    if (siNorExtractionTimerRef.current) {
      clearTimeout(siNorExtractionTimerRef.current);
    }
    
    // Only process if we have meaningful content (more than ~50 chars)
    if (text.length < 50) {
      setIsProcessingSiNor(false);
      return;
    }
    
    // Set processing state immediately to show feedback
    setIsProcessingSiNor(true);
    
    // Debounce: Wait 2 seconds after user stops typing before extracting
    siNorExtractionTimerRef.current = setTimeout(() => {
      extractSiNorData(text);
    }, 2000);
    // extractSiNorData captured via timer; stable identity not required since it's invoked once per debounce tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if input is a URL
  const isUrl = (input: string): boolean => {
    try {
      const url = new URL(input.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Check if URL is a PDF
  const isPdfUrl = (url: string): boolean => {
    return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');
  };

  // Actual extraction function (called after debounce)
  const extractSiNorData = async (text: string, isRetry: boolean = false) => {
    // Clear previous errors and timeout state
    setExtractionError(null);
    setExtractionTimedOut(false);
    
    // Check if input is a URL
    if (isUrl(text)) {
      if (isPdfUrl(text)) {
        // PDF URLs cannot be processed directly - need to fetch and extract text
        setIsProcessingSiNor(true);
        
        // Create timeout for PDF download/extraction (60 seconds for PDFs)
        const pdfTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('PDF_TIMEOUT'));
          }, 60000); // 60 seconds for PDF processing
        });

        try {
          // Try to fetch the PDF and extract text with timeout
          const fetchPromise = (async () => {
            const response = await fetch(text);
            if (!response.ok) {
              throw new Error(`Failed to fetch PDF: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Use PDF extraction service if available
            try {
              const { PDFExtractionService } = await import('@/services/PDFExtractionService');
              const result = await PDFExtractionService.extractText(blobUrl, { maxPages: 50 });
              URL.revokeObjectURL(blobUrl);

              if (result.success && result.text) {
                // Recursively call with extracted text
                await extractSiNorData(result.text, isRetry);
                return;
              } else {
                throw new Error(result.error || 'Failed to extract text from PDF');
              }
            } catch (pdfError: any) {
              URL.revokeObjectURL(blobUrl);
              throw pdfError;
            }
          })();

          await Promise.race([fetchPromise, pdfTimeoutPromise]);
        } catch (fetchError: any) {
          if (fetchError?.message === 'PDF_TIMEOUT') {
            setExtractionTimedOut(true);
            setExtractionError('PDF download and extraction took too long (over 60 seconds).');
            setIsProcessingSiNor(false);
            return;
          }
          
          setExtractionError(
            fetchError?.message || 'Could not download or extract text from the PDF.'
          );
          setIsProcessingSiNor(false);
          return;
        }
      } else {
        // Non-PDF URL - suggest pasting text instead
        setExtractionError('Please paste the text content from the document, not the URL. The AI extraction works best with the actual text content.');
        setIsProcessingSiNor(false);
        return;
      }
    }

    // Only process if we have meaningful content (more than ~50 chars)
    if (text.length < 50) {
      setExtractedSiNorData(null);
      setIsProcessingSiNor(false);
      return;
    }

    setIsProcessingSiNor(true);
    setExtractedSiNorData(null); // Clear previous extraction
    
    // Create a timeout promise (45 seconds max for text extraction)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, 45000); // 45 seconds for text extraction
    });

    try {
      // Call edge function to extract race info from SI/NOR with timeout
      const extractionPromise = supabase.functions.invoke('extract-race-info', {
        body: { text, type: 'si_nor' },
      });

      const { data, error } = await Promise.race([extractionPromise, timeoutPromise]);

      if (error) {
        console.warn('[SailorOnboarding] SI/NOR extraction error:', error);
        setExtractionError('Could not extract race information. Please try again or enter the details manually.');
        setIsProcessingSiNor(false);
        return;
      }

      if (data?.success && data?.extracted) {
        setExtractedSiNorData(data.extracted);
        setExtractionError(null); // Clear any previous errors
        
        // Auto-fill next race fields if empty
        if (data.extracted.raceName && !nextRace.name) {
          setNextRace(prev => ({ ...prev, name: data.extracted.raceName }));
        }
        if (data.extracted.date && !nextRace.date) {
          setNextRace(prev => ({ ...prev, date: data.extracted.date }));
        }
        if (data.extracted.startTime && !nextRace.startTime) {
          setNextRace(prev => ({ ...prev, startTime: data.extracted.startTime }));
        }
        if (data.extracted.location && !nextRace.location) {
          setNextRace(prev => ({ ...prev, location: data.extracted.location }));
        }
      } else if (data && !data.success) {
        console.warn('[SailorOnboarding] Extraction returned unsuccessful:', data.error);
        setExtractionError(data.error || 'Could not extract race information. Please enter the details manually.');
      }
    } catch (err: any) {
      console.error('[SailorOnboarding] SI/NOR extraction failed:', err);
      
      // Handle timeout specifically
      if (err?.message === 'TIMEOUT' || err?.message?.includes('timed out')) {
        setExtractionTimedOut(true);
        setExtractionError('Extraction took too long (over 45 seconds). This can happen with very long documents.');
      } else {
        setExtractionError(err?.message || 'An error occurred during extraction. Please try again or enter the details manually.');
      }
    } finally {
      // Always stop the loading indicator
      setIsProcessingSiNor(false);
    }
  };

  // Retry extraction
  const retryExtraction = () => {
    if (siNorPasteData) {
      extractSiNorData(siNorPasteData, true);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (siNorExtractionTimerRef.current) {
        clearTimeout(siNorExtractionTimerRef.current);
      }
    };
  }, []);

  // Select race as "next race" and populate form
  const selectAsNextRace = (race: any, index: number) => {

    setNextRace({
      name: race.name || '',
      date: race.date || '',
      startTime: race.startTime || race.time || '',
      location: race.location || '',
      norUrl: race.norUrl || '',
      siUrl: race.siUrl || '',
      courseMapUrl: race.courseMapUrl || '',
    });

    // Ensure this race is selected
    if (!selectedRaces.includes(index)) {
      setSelectedRaces([...selectedRaces, index]);
    }

  };

  // Toggle race selection for keeping in calendar
  const toggleRaceSelection = (index: number) => {
    if (selectedRaces.includes(index)) {
      setSelectedRaces(selectedRaces.filter(i => i !== index));
    } else {
      setSelectedRaces([...selectedRaces, index]);
    }
  };

  // Boat management
  const addBoat = () => {
    setBoats([...boats, {
      className: '',
      sailNumber: '',
      boatName: '',
      hullMaker: '',
      rigMaker: '',
      sailMaker: '',
      role: 'owner',
      isPrimary: false,
    }]);
  };

  const removeBoat = (index: number) => {
    if (boats.length > 1) {
      setBoats(boats.filter((_, i) => i !== index));
    }
  };

  const updateBoat = (index: number, field: keyof Boat, value: any) => {
    const updated = [...boats];
    updated[index] = { ...updated[index], [field]: value };
    setBoats(updated);
  };

  // Club management
  const addClub = () => {
    setClubs([...clubs, { name: '', url: '' }]);
  };

  const removeClub = (index: number) => {
    if (clubs.length > 1) {
      setClubs(clubs.filter((_, i) => i !== index));
    }
  };

  const updateClub = (index: number, field: keyof Club, value: string) => {
    const updated = [...clubs];
    updated[index] = { ...updated[index], [field]: value };
    setClubs(updated);
  };

  // Document management
  const addDocument = () => {
    if (!newDocUrl.trim()) {
      showAlert('Missing URL', 'Please enter a document URL');
      return;
    }

    setDocuments([...documents, {
      type: newDocType,
      url: newDocUrl.trim(),
    }]);

    setNewDocUrl('');
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  // Validation
  const validateForm = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check at least one boat with class and sail number
    const validBoat = boats.find(b => b.className.trim() && b.sailNumber.trim());
    if (!validBoat) {
      errors.push('At least one boat with class and sail number');
    }

    // Check next race required fields
    if (!nextRace.name.trim()) errors.push('Next race name');
    if (!nextRace.date) errors.push('Next race date');
    if (!nextRace.startTime) errors.push('Next race start time');
    if (!nextRace.location.trim()) errors.push('Next race location');

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  // State for validation errors display
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSubmit = async () => {
    const validation = validateForm();

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      showAlert(
        'Missing Required Information',
        `Please provide:\n• ${validation.errors.join('\n• ')}`
      );
      return;
    }

    setValidationErrors([]);

    if (!user?.id) {
      showAlert('Error', 'User not authenticated');
      return;
    }

    setSubmitting(true);

    try {
      // Update user profile - only update columns that exist in the users table
      // Note: onboarding_data and onboarding_step columns don't exist, so we skip them
      const profileUpdates: Record<string, any> = {
        onboarding_completed: true,
        user_type: 'sailor',
      };

      // Only update full_name if user provided one (avoid NOT NULL constraint violation)
      if (fullName && fullName.trim()) {
        profileUpdates.full_name = fullName.trim();
      }

      const { error: userUpdateError } = await supabase
        .from('users')
        .update(profileUpdates)
        .eq('id', user.id);

      if (userUpdateError) {
        console.error('[SailorOnboarding] User update error:', userUpdateError);
        throw userUpdateError;
      }

      // Save boats to sailor_boats table if any valid boats provided
      const validBoats = boats.filter(b => b.className.trim() && b.sailNumber.trim());
      if (validBoats.length > 0) {
        for (let i = 0; i < validBoats.length; i++) {
          const boat = validBoats[i];
          try {
            // First, find or create the boat class
            let classId: string | null = null;
            
            const { data: existingClass } = await supabase
              .from('boat_classes')
              .select('id')
              .ilike('name', boat.className.trim())
              .maybeSingle();
            
            if (existingClass) {
              classId = existingClass.id;
            } else {
              // Create the boat class if it doesn't exist
              const { data: newClass } = await supabase
                .from('boat_classes')
                .insert({ name: boat.className.trim() })
                .select('id')
                .single();
              
              if (newClass) {
                classId = newClass.id;
              }
            }
            
            if (classId) {
              // Insert the boat
              await supabase
                .from('sailor_boats')
                .upsert({
                  sailor_id: user.id,
                  class_id: classId,
                  name: boat.boatName?.trim() || boat.className.trim(),
                  sail_number: boat.sailNumber.trim(),
                  is_primary: i === 0,
                  status: 'active',
                }, {
                  onConflict: 'sailor_id,class_id',
                });
            }
          } catch (boatError) {
            console.warn('[SailorOnboarding] Error saving boat:', boatError);
            // Continue with other boats even if one fails
          }
        }
      }

      // Refresh the auth context so it picks up the new user_type
      await fetchUserProfile(user.id);

      // Only navigate if component is still mounted
      if (isMounted) {
        router.replace('/(tabs)/races');
      }
    } catch (error: any) {
      console.error('[SailorOnboarding] Submit error:', error);
      // Only show alert if component is still mounted
      if (isMounted) {
        const errorMsg = error.message || 'Failed to save profile. Please try again.';
        showAlert('Error', errorMsg);
      }
    } finally {
      // Always reset submitting state if still mounted
      if (isMounted) {
        setSubmitting(false);
      }
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 100 }}
        style={Platform.select({
          web: {
            overflow: 'visible',
          } as any,
          default: {},
        })}
      >
        <View 
          className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full"
          style={Platform.select({
            web: {
              overflow: 'visible',
            } as any,
            default: {},
          })}
        >
        {/* Back to Chat Button */}
        {fromChat && (
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-2 mb-4"
          >
            <ArrowLeft size={20} color="#0284c7" />
            <Text className="text-sky-600 font-semibold">Back to Chat</Text>
          </Pressable>
        )}

        {/* Header */}
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            ⛵ Your Sailing Profile
          </Text>
          <Text className="text-base text-gray-600">
            {fromChat
              ? 'Review and complete the information from our chat'
              : 'Tell us about your sailing so we can provide personalized race strategy and weather forecasts'
            }
          </Text>
        </View>

        {/* Progress Indicator & Completion Status - At Top */}
        <View className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-blue-900 font-bold text-base">Onboarding Progress</Text>
            <Text className="text-blue-700 text-sm font-semibold">
              {(() => {
                const requiredFields = [
                  boats.some(b => b.className.trim() && b.sailNumber.trim()),
                  nextRace.name.trim(),
                  nextRace.date.trim(),
                  nextRace.startTime.trim(),
                  nextRace.location.trim(),
                ];
                const completed = requiredFields.filter(Boolean).length;
                return `${completed}/${requiredFields.length} Required Sections`;
              })()}
            </Text>
          </View>
          <Text className="text-blue-700 text-sm mb-3">
            Complete all required fields below, then click "Complete Onboarding" at the bottom to finish setup.
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            {boats.some(b => b.className.trim() && b.sailNumber.trim()) ? (
              <View className="bg-green-100 px-2 py-1 rounded">
                <Text className="text-green-800 text-xs">✓ Boats</Text>
              </View>
            ) : (
              <View className="bg-yellow-100 px-2 py-1 rounded">
                <Text className="text-yellow-800 text-xs">○ Boats</Text>
              </View>
            )}
            {nextRace.name.trim() && nextRace.date.trim() && nextRace.startTime.trim() && nextRace.location.trim() ? (
              <View className="bg-green-100 px-2 py-1 rounded">
                <Text className="text-green-800 text-xs">✓ Next Race</Text>
              </View>
            ) : (
              <View className="bg-yellow-100 px-2 py-1 rounded">
                <Text className="text-yellow-800 text-xs">○ Next Race</Text>
              </View>
            )}
          </View>
        </View>

        {/* SECTION 1: Personal Info */}
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-4">
            <User size={24} color="#0284c7" />
            <Text className="text-xl font-bold text-gray-900">Personal Info</Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Full Name (Optional)</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g., John Smith"
              className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Primary Role</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setPrimaryRole('owner')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 ${
                  primaryRole === 'owner' ? 'bg-sky-100 border-sky-600' : 'bg-white border-gray-300'
                }`}
              >
                <Text className={`text-center font-semibold ${
                  primaryRole === 'owner' ? 'text-sky-700' : 'text-gray-700'
                }`}>Owner</Text>
              </Pressable>

              <Pressable
                onPress={() => setPrimaryRole('crew')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 ${
                  primaryRole === 'crew' ? 'bg-sky-100 border-sky-600' : 'bg-white border-gray-300'
                }`}
              >
                <Text className={`text-center font-semibold ${
                  primaryRole === 'crew' ? 'text-sky-700' : 'text-gray-700'
                }`}>Crew</Text>
              </Pressable>

              <Pressable
                onPress={() => setPrimaryRole('both')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 ${
                  primaryRole === 'both' ? 'bg-sky-100 border-sky-600' : 'bg-white border-gray-300'
                }`}
              >
                <Text className={`text-center font-semibold ${
                  primaryRole === 'both' ? 'text-sky-700' : 'text-gray-700'
                }`}>Both</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* SECTION 2: Clubs & Venues */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <MapPin size={24} color="#0284c7" />
              <Text className="text-xl font-bold text-gray-900">Where You Sail</Text>
            </View>
          </View>

          {/* Home Venue - Now First */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Home Venue</Text>
            <VenueLocationPicker
              value={homeVenue}
              onChangeText={setHomeVenue}
              coordinates={null}
              onCoordinatesChange={() => {}}
              placeholder="e.g., Victoria Harbour, Hong Kong"
            />
            {detectingLocation && (
              <Text className="text-xs text-gray-500 mt-1">Detecting your location...</Text>
            )}
          </View>

          {/* Home Yacht Club - Now Second */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">Home Yacht Club</Text>
            <Pressable
              onPress={addClub}
              className="flex-row items-center gap-1 bg-sky-600 px-3 py-2 rounded-lg"
            >
              <Plus size={16} color="white" />
              <Text className="text-white font-semibold text-sm">Add Club</Text>
            </Pressable>
          </View>

          {clubs.map((club, index) => (
            <View key={index} className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="font-semibold text-gray-900">
                  {index === 0 ? 'Home Yacht Club' : `Club ${index + 1}`}
                </Text>
                {clubs.length > 1 && index > 0 && (
                  <Pressable onPress={() => removeClub(index)}>
                    <X size={20} color="#dc2626" />
                  </Pressable>
                )}
              </View>

              <View className="mb-3">
                <Text className="text-sm font-medium text-gray-700 mb-1">Club Name</Text>
                <TextInput
                  value={club.name}
                  onChangeText={(val) => {
                    updateClub(index, 'name', val);
                    // Auto-fill URL if Hong Kong club is detected
                    if (isHongKongVenue(homeVenue)) {
                      const hkClub = Object.values(HONG_KONG_CLUBS).find(c => 
                        c.name.toLowerCase().includes(val.toLowerCase()) ||
                        val.toLowerCase().includes(c.name.toLowerCase())
                      );
                      if (hkClub && !club.url) {
                        updateClub(index, 'url', hkClub.website);
                      }
                    }
                  }}
                  placeholder="e.g., Royal Hong Kong Yacht Club"
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2"
                />
                {/* Show club suggestions for Hong Kong */}
                {isHongKongVenue(homeVenue) && (
                  <View className="mt-2">
                    <Text className="text-xs text-gray-500 mb-1">
                      {club.name.length < 3 ? 'Popular clubs:' : 'Other clubs:'}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {Object.values(HONG_KONG_CLUBS).map((hkClub) => (
                        <Pressable
                          key={hkClub.name}
                          onPress={() => {
                            // Populate club name and URL when clicked
                            updateClub(index, 'name', hkClub.name);
                            updateClub(index, 'url', hkClub.website);
                          }}
                          className={`border rounded px-3 py-2 ${
                            club.name === hkClub.name
                              ? 'bg-sky-100 border-sky-600'
                              : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <Text className={`text-xs ${
                            club.name === hkClub.name
                              ? 'text-sky-700 font-semibold'
                              : 'text-blue-700'
                          }`}>
                            {hkClub.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">Website URL</Text>
                <TextInput
                  value={club.url}
                  onChangeText={(val) => updateClub(index, 'url', val)}
                  placeholder="https://www.rhkyc.org.hk"
                  autoCapitalize="none"
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2"
                />
              </View>
            </View>
          ))}
        </View>

        {/* SECTION 3: Boats */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <Anchor size={24} color="#0284c7" />
              <Text className="text-xl font-bold text-gray-900">Your Boats *</Text>
            </View>
            <Pressable
              onPress={addBoat}
              className="flex-row items-center gap-1 bg-sky-600 px-3 py-2 rounded-lg"
            >
              <Plus size={16} color="white" />
              <Text className="text-white font-semibold text-sm">Add Boat</Text>
            </Pressable>
          </View>

          {boats.map((boat, index) => (
            <View 
              key={index} 
              className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200"
              style={Platform.select({
                web: {
                  position: 'relative',
                  overflow: 'visible',
                  zIndex: 'auto',
                  isolation: 'auto',
                } as any,
                default: {},
              })}
            >
              <View className="flex-row justify-between items-center mb-3">
                <Text className="font-semibold text-gray-900">Boat {index + 1}</Text>
                {boats.length > 1 && (
                  <Pressable onPress={() => removeBoat(index)}>
                    <X size={20} color="#dc2626" />
                  </Pressable>
                )}
              </View>

              <View 
                className="flex-row gap-3 mb-3"
                style={Platform.select({
                  web: {
                    position: 'relative',
                    overflow: 'visible',
                  } as any,
                  default: {},
                })}
              >
                <View 
                  className="flex-1"
                  style={Platform.select({
                    web: {
                      position: 'relative',
                      overflow: 'visible',
                    } as any,
                    default: {},
                  })}
                >
                  <BoatAutocompleteInput
                    label="Class"
                    value={boat.className}
                    onChangeText={(val) => updateBoat(index, 'className', val)}
                    placeholder="e.g., Dragon, J/70, Etchells"
                    required
                    type="boatClass"
                    region="hong_kong"
                  />
                </View>

                <View 
                  className="flex-1"
                  style={Platform.select({
                    web: {
                      position: 'relative',
                      overflow: 'visible',
                    } as any,
                    default: {},
                  })}
                >
                  <BoatAutocompleteInput
                    label="Sail #"
                    value={boat.sailNumber}
                    onChangeText={(val) => updateBoat(index, 'sailNumber', val)}
                    placeholder="e.g., D59"
                    required
                    type="sailNumber"
                    boatClassName={boat.className}
                  />
                </View>
              </View>

              <View 
                className="mb-3"
                style={Platform.select({
                  web: {
                    position: 'relative',
                    overflow: 'visible',
                  } as any,
                    default: {},
                })}
              >
                <BoatAutocompleteInput
                  label="Boat Name"
                  value={boat.boatName || ''}
                  onChangeText={(val) => updateBoat(index, 'boatName', val)}
                  placeholder="e.g., Phoenix"
                  type="boatName"
                  boatClassName={boat.className}
                />
              </View>

              <View 
                className="flex-row gap-3 mb-3"
                style={Platform.select({
                  web: {
                    position: 'relative',
                    overflow: 'visible',
                  } as any,
                  default: {},
                })}
              >
                <View 
                  className="flex-1"
                  style={Platform.select({
                    web: {
                      position: 'relative',
                      overflow: 'visible',
                    } as any,
                    default: {},
                  })}
                >
                  <BoatAutocompleteInput
                    label="Hull Maker"
                    value={boat.hullMaker || ''}
                    onChangeText={(val) => updateBoat(index, 'hullMaker', val)}
                    placeholder="e.g., Petticrows"
                    type="hullMaker"
                    boatClassName={boat.className}
                  />
                </View>

                <View 
                  className="flex-1"
                  style={Platform.select({
                    web: {
                      position: 'relative',
                      overflow: 'visible',
                    } as any,
                    default: {},
                  })}
                >
                  <BoatAutocompleteInput
                    label="Rig Maker"
                    value={boat.rigMaker || ''}
                    onChangeText={(val) => updateBoat(index, 'rigMaker', val)}
                    placeholder="e.g., Selden"
                    type="rigMaker"
                    boatClassName={boat.className}
                  />
                </View>
              </View>

              <View
                style={Platform.select({
                  web: {
                    position: 'relative',
                    overflow: 'visible',
                  } as any,
                  default: {},
                })}
              >
                <BoatAutocompleteInput
                  label="Sail Maker"
                  value={boat.sailMaker || ''}
                  onChangeText={(val) => updateBoat(index, 'sailMaker', val)}
                  placeholder="e.g., North Sails, Quantum"
                  type="sailMaker"
                  boatClassName={boat.className}
                />
              </View>
            </View>
          ))}
        </View>

        {/* SECTION 4: Documents & Organizations */}
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-4">
            <FileText size={24} color="#0284c7" />
            <Text className="text-xl font-bold text-gray-900">Sailing Documents</Text>
          </View>

          <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <Text className="text-sm font-semibold text-blue-900 mb-2">
              📚 Add URLs to sailing documents
            </Text>
            <Text className="text-sm text-blue-800">
              • Class association websites (for fleet lists, tuning guides){'\n'}
              • Sail maker tuning guides (North Sails, Quantum, etc.){'\n'}
              • Race calendars, sailing instructions, course maps
            </Text>
          </View>

          {/* Document Type Selector */}
          <View className="mb-3">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Document Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
              {[
                { value: 'class_association', label: 'Class Assoc.' },
                { value: 'tuning_guide', label: 'Tuning Guide' },
                { value: 'race_calendar', label: 'Calendar' },
                { value: 'sailing_instructions', label: 'SIs' },
                { value: 'course_map', label: 'Course Map' },
                { value: 'other', label: 'Other' },
              ].map((type) => (
                <Pressable
                  key={type.value}
                  onPress={() => setNewDocType(type.value as Document['type'])}
                  className={`py-2 px-4 rounded-lg border ${
                    newDocType === type.value
                      ? 'bg-sky-100 border-sky-600'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${
                    newDocType === type.value ? 'text-sky-700' : 'text-gray-700'
                  }`}>{type.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Document URL Input */}
          <View className="flex-row gap-2 mb-4">
            <TextInput
              value={newDocUrl}
              onChangeText={setNewDocUrl}
              placeholder="https://example.com/document.pdf"
              autoCapitalize="none"
              className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3"
            />
            <Pressable
              onPress={addDocument}
              className="bg-sky-600 py-3 px-4 rounded-lg items-center justify-center"
            >
              <Plus size={20} color="white" />
            </Pressable>
          </View>

          {/* Document List */}
          {documents.length > 0 && (
            <View className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <Text className="text-sm font-semibold text-gray-900 mb-2">
                Added Documents ({documents.length})
              </Text>
              {documents.map((doc, index) => (
                <View key={index} className="flex-row items-center justify-between py-2 border-b border-gray-200">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-semibold text-sky-700 capitalize">
                      {doc.type.replace(/_/g, ' ')}
                    </Text>
                    <Text className="text-xs text-gray-600" numberOfLines={1}>
                      {doc.url}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeDocument(index)}>
                    <X size={16} color="#dc2626" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* SECTION 5: Next Race (REQUIRED) */}
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-3">
            <Calendar size={24} color="#dc2626" />
            <Text className="text-xl font-bold text-gray-900">Your Next Race *</Text>
          </View>

          <View className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
            <Text className="text-base font-bold text-red-900 mb-1">
              🎯 Required for Race Strategy
            </Text>
            <Text className="text-sm text-red-800">
              We need these details to provide weather forecasts, hull/rig tuning recommendations, and tactical strategy for your upcoming race.
            </Text>
          </View>

          {/* Race Selector from Calendar */}
          {upcomingRaces.length > 0 && showRaceSelector && (
            <View className="bg-sky-50 border-2 border-sky-300 rounded-lg p-4 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <View>
                  <Text className="text-base font-bold text-sky-900">
                    📅 Found {upcomingRaces.length} Upcoming Races
                  </Text>
                  <Text className="text-xs text-sky-700 mt-1">
                    ✓ {selectedRaces.length} selected to keep
                  </Text>
                </View>
                <Pressable onPress={() => setShowRaceSelector(false)}>
                  <Text className="text-sky-600 text-sm font-medium">Enter manually</Text>
                </Pressable>
              </View>

              <View className="flex-row gap-2 mb-3">
                <Pressable
                  onPress={() => setSelectedRaces(upcomingRaces.map((_: any, i: number) => i))}
                  className="flex-1 bg-sky-100 px-3 py-2 rounded-lg"
                >
                  <Text className="text-sky-700 text-xs font-semibold text-center">
                    ✓ Select All
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedRaces([])}
                  className="flex-1 bg-gray-100 px-3 py-2 rounded-lg"
                >
                  <Text className="text-gray-700 text-xs font-semibold text-center">
                    ✗ Deselect All
                  </Text>
                </Pressable>
              </View>

              <Text className="text-sm text-sky-800 mb-3">
                Check races to keep in your calendar. Click "Set as Next" to populate form.
              </Text>

              <ScrollView className="max-h-80">
                {upcomingRaces.map((race: any, idx: number) => {
                  const isSelected = selectedRaces.includes(idx);
                  const isNextRace =
                    nextRace.name === race.name &&
                    nextRace.date === race.date;

                  return (
                    <View
                      key={idx}
                      className={`bg-white border rounded-lg p-3 mb-2 ${
                        isNextRace ? 'border-green-500 border-2' : 'border-sky-200'
                      }`}
                    >
                      <View className="flex-row items-start gap-3">
                        {/* Checkbox */}
                        <Pressable
                          onPress={() => toggleRaceSelection(idx)}
                          className={`w-6 h-6 rounded border-2 items-center justify-center mt-1 ${
                            isSelected
                              ? 'bg-sky-600 border-sky-600'
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <Text className="text-white font-bold text-sm">✓</Text>
                          )}
                        </Pressable>

                        <View className="flex-1">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="font-semibold text-gray-900 text-base flex-1">
                              {race.name}
                              {isNextRace && (
                                <Text className="text-green-600 text-xs"> (Next Race)</Text>
                              )}
                            </Text>
                          </View>

                          <View className="flex-row flex-wrap gap-3 mb-2">
                            <Text className="text-sm text-gray-600">
                              📅 {race.date}
                            </Text>
                            {race.startTime && (
                              <Text className="text-sm text-gray-600">
                                ⏰ {race.startTime}
                              </Text>
                            )}
                            {race.location && (
                              <Text className="text-sm text-gray-600">
                                📍 {race.location}
                              </Text>
                            )}
                          </View>

                          {!isNextRace && (
                            <Pressable
                              onPress={() => selectAsNextRace(race, idx)}
                              className="bg-sky-600 px-3 py-2 rounded-lg self-start"
                            >
                              <Text className="text-white text-xs font-semibold">
                                Set as Next Race
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View className="mt-3 pt-3 border-t border-sky-200">
                <Text className="text-xs text-sky-700 text-center">
                  💡 Tip: Uncheck races you don't want. Selected races will be added to your calendar.
                </Text>
              </View>
            </View>
          )}

          {/* Manual Entry / Show selected */}
          {(!showRaceSelector || upcomingRaces.length === 0) && upcomingRaces.length > 0 && (
            <Pressable
              onPress={() => setShowRaceSelector(true)}
              className="bg-sky-100 border border-sky-300 rounded-lg p-3 mb-3"
            >
              <Text className="text-sky-700 text-sm font-medium text-center">
                📅 Choose from {upcomingRaces.length} calendar races instead
              </Text>
            </Pressable>
          )}

          {/* NEW: Direct Paste Fields */}
          <View className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
            <Text className="text-base font-bold text-purple-900 mb-2">
              📋 Quick Paste Options
            </Text>
            <Text className="text-xs text-purple-700 mb-3">
              Paste calendar data, SI/NOR text, or upload race area images directly
            </Text>

            {/* Calendar CSV/Table Paste */}
            <View className="mb-3">
              <Text className="text-sm font-semibold text-purple-900 mb-1">
                📊 Paste Racing Calendar (CSV/Table)
              </Text>
              <Text className="text-xs text-purple-600 mb-2">
                Copy/paste from Excel, Google Sheets, or CSV racing calendar
              </Text>
              <TextInput
                value={calendarPasteData}
                onChangeText={setCalendarPasteData}
                placeholder="Paste CSV or table data here...&#10;e.g., Croucher 3, 2025-03-15, 14:00, Victoria Harbour"
                multiline
                numberOfLines={4}
                className="bg-white border border-purple-300 rounded-lg px-3 py-2 text-sm min-h-[100px]"
              />
            </View>

            {/* SIs/NORs Text Paste */}
            <View className="mb-3">
              <Text className="text-sm font-semibold text-purple-900 mb-1">
                📄 Paste SIs/NORs Text
              </Text>
              <Text className="text-xs text-purple-600 mb-2">
                Copy/paste Sailing Instructions or Notice of Race text for analysis
              </Text>
              <TextInput
                value={siNorPasteData}
                onChangeText={handleSiNorTextChange}
                placeholder="Paste sailing instructions or NOR text here...&#10;Course details, marks, timing, etc. are extracted automatically."
                multiline
                numberOfLines={6}
                className="bg-white border border-purple-300 rounded-lg px-3 py-2 text-sm min-h-[120px]"
              />
              {/* AI Processing Status */}
              {isProcessingSiNor && (
                <View className="flex-row items-center gap-2 mt-2 px-2">
                  <Loader size={14} color="#7C3AED" />
                  <Text className="text-purple-600 text-xs">
                    Extracting race information...
                  </Text>
                </View>
              )}
              
              {/* Error/Timeout Message with Retry */}
              {extractionError && !isProcessingSiNor && (
                <View className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <Text className="text-red-800 font-semibold text-sm mb-1">
                    {extractionTimedOut ? '⏱️ Extraction Timed Out' : '❌ Extraction Failed'}
                  </Text>
                  <Text className="text-red-700 text-xs mb-3">
                    {extractionError}
                  </Text>
                  {extractionTimedOut && (
                    <Text className="text-red-600 text-xs mb-3">
                      This can happen with very long documents. Try copying a shorter section or enter details manually.
                    </Text>
                  )}
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={retryExtraction}
                      className="flex-1 bg-purple-600 px-4 py-2 rounded-lg"
                    >
                      <Text className="text-white text-xs font-semibold text-center">
                        🔄 Retry Extraction
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setExtractionError(null);
                        setExtractionTimedOut(false);
                      }}
                      className="flex-1 bg-gray-200 px-4 py-2 rounded-lg"
                    >
                      <Text className="text-gray-700 text-xs font-semibold text-center">
                        Dismiss
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
              
              {/* Extracted Data Preview */}
              {extractedSiNorData && !isProcessingSiNor && !extractionError && (
                <View className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <Text className="text-green-800 font-semibold text-sm mb-1">
                    ✓ AI Extracted:
                  </Text>
                  {extractedSiNorData.raceName && (
                    <Text className="text-green-700 text-xs">• Race: {extractedSiNorData.raceName}</Text>
                  )}
                  {extractedSiNorData.date && (
                    <Text className="text-green-700 text-xs">• Date: {extractedSiNorData.date}</Text>
                  )}
                  {extractedSiNorData.startTime && (
                    <Text className="text-green-700 text-xs">• Start: {extractedSiNorData.startTime}</Text>
                  )}
                  {extractedSiNorData.location && (
                    <Text className="text-green-700 text-xs">• Location: {extractedSiNorData.location}</Text>
                  )}
                  {extractedSiNorData.marks && extractedSiNorData.marks.length > 0 && (
                    <Text className="text-green-700 text-xs">• Marks: {extractedSiNorData.marks.join(', ')}</Text>
                  )}
                  <Text className="text-green-600 text-xs italic mt-1">
                    Fields auto-filled below (if empty). Edit as needed.
                  </Text>
                </View>
              )}
            </View>

            {/* Race Area Image */}
            <View>
              <Text className="text-sm font-semibold text-purple-900 mb-1">
                🗺️ Race Area Image URL
              </Text>
              <Text className="text-xs text-purple-600 mb-2">
                Paste link to course map, race area diagram, or aerial photo
              </Text>
              <TextInput
                value={raceAreaImageUri}
                onChangeText={setRaceAreaImageUri}
                placeholder="https://... (course map, race area, or aerial image)"
                autoCapitalize="none"
                className="bg-white border border-purple-300 rounded-lg px-3 py-2 text-sm"
              />
            </View>
          </View>

          <View className="mb-3">
            <Text className="text-sm font-semibold text-gray-900 mb-2">Race Name *</Text>
            <TextInput
              value={nextRace.name}
              onChangeText={(val) => setNextRace({ ...nextRace, name: val })}
              placeholder="e.g., Croucher Series - Race 3"
              className="bg-gray-50 border-2 border-gray-300 rounded-lg px-4 py-3 text-base"
            />
          </View>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900 mb-2">Date *</Text>
              <TextInput
                value={nextRace.date}
                onChangeText={(val) => setNextRace({ ...nextRace, date: val })}
                placeholder="2025-03-15"
                className="bg-gray-50 border-2 border-gray-300 rounded-lg px-4 py-3 text-base"
              />
            </View>

            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900 mb-2">Start Time *</Text>
              <TextInput
                value={nextRace.startTime}
                onChangeText={(val) => setNextRace({ ...nextRace, startTime: val })}
                placeholder="14:00"
                className="bg-gray-50 border-2 border-gray-300 rounded-lg px-4 py-3 text-base"
              />
            </View>
          </View>

          <View className="mb-3">
            <Text className="text-sm font-semibold text-gray-900 mb-2">Location *</Text>
            <TextInput
              value={nextRace.location}
              onChangeText={(val) => setNextRace({ ...nextRace, location: val })}
              placeholder="e.g., Victoria Harbour, Hong Kong"
              className="bg-gray-50 border-2 border-gray-300 rounded-lg px-4 py-3 text-base"
            />
          </View>

          <View className="bg-gray-100 rounded-lg p-3">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Race Documents (Optional)</Text>

            <View className="mb-2">
              <Text className="text-xs font-medium text-gray-600 mb-1">Notice of Race URL</Text>
              <TextInput
                value={nextRace.norUrl}
                onChangeText={(val) => setNextRace({ ...nextRace, norUrl: val })}
                placeholder="https://..."
                autoCapitalize="none"
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </View>

            <View className="mb-2">
              <Text className="text-xs font-medium text-gray-600 mb-1">Sailing Instructions URL</Text>
              <TextInput
                value={nextRace.siUrl}
                onChangeText={(val) => setNextRace({ ...nextRace, siUrl: val })}
                placeholder="https://..."
                autoCapitalize="none"
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </View>

            <View>
              <Text className="text-xs font-medium text-gray-600 mb-1">Course Map URL</Text>
              <TextInput
                value={nextRace.courseMapUrl}
                onChangeText={(val) => setNextRace({ ...nextRace, courseMapUrl: val })}
                placeholder="https://..."
                autoCapitalize="none"
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </View>
          </View>
        </View>

        {/* Validation Errors Display */}
        {validationErrors.length > 0 && (
          <View className="mt-4 mb-2 bg-red-50 border border-red-200 rounded-xl p-4">
            <Text className="text-red-800 font-bold mb-2">Please complete required fields:</Text>
            {validationErrors.map((error, idx) => (
              <Text key={idx} className="text-red-700 text-sm">• {error}</Text>
            ))}
          </View>
        )}

        {/* Extra padding at bottom to account for sticky footer */}
        <View className="mt-4 mb-24" />
        </View>
      </ScrollView>
      
      {/* Sticky Footer with Submit Button - Always Visible */}
      <View 
        style={{
          ...Platform.select({
            web: {
              position: 'fixed' as any,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100002, // Higher than dropdowns (100001) but reasonable
            },
            default: {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            },
          }),
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
          style={[
            {
              backgroundColor: submitting ? '#9CA3AF' : '#0284C7',
              paddingVertical: 16,
              paddingHorizontal: 24,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            },
            Platform.OS === 'web' ? { cursor: submitting ? 'not-allowed' : 'pointer' } as any : {},
          ]}
        >
          {submitting ? (
            <>
              <Loader size={20} color="white" />
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Processing...</Text>
            </>
          ) : (
            <>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Complete Onboarding</Text>
              <ChevronRight size={20} color="white" />
            </>
          )}
        </TouchableOpacity>
        <Text className="text-center text-gray-500 text-xs mt-2">
          Complete required fields above to finish setup
        </Text>
      </View>
    </View>
  );
}
