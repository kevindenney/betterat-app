/**
 * RouteBriefingWizard
 *
 * Multi-step wizard for conducting route briefings with crew before distance races.
 * Steps: Route Overview -> Leg Details (with weather) -> Hazards & Decisions -> Share/Export
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
  TextInput,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Navigation,
  MapPin,
  AlertTriangle,
  Radio,
  Clock,
  Share2,
  Copy,
  Check,
  Wind,
  Waves,
  BookOpen,
  Flag,
  Anchor,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Compass,
  MessageCircle,
  Edit2,
  Save,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import type { ChecklistToolProps } from '@/lib/checklists/toolRegistry';
import { supabase } from '@/services/supabase';
import { useRaceWeatherForecast } from '@/hooks/useRaceWeatherForecast';
import { DistanceRouteMap, RouteWaypoint as MapRouteWaypoint } from '@/components/races/DistanceRouteMap';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  purple: '#AF52DE',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  yellow: '#FFCC00',
  gray: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  background: '#F2F2F7',
  secondaryBackground: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C4349',
};

type WizardStep = 'loading' | 'overview' | 'edit' | 'legs' | 'hazards' | 'share';

// Types
interface RouteWaypoint {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'start' | 'waypoint' | 'gate' | 'finish';
  required?: boolean;
  order?: number;
}

interface ProhibitedArea {
  name: string;
  description?: string;
  coordinates?: { lat: number; lng: number }[];
}

interface TideGate {
  location: string;
  optimalTime?: string;
  notes?: string;
}

interface VHFChannel {
  channel: string;
  purpose?: string;
}

interface RouteBriefingData {
  name: string;
  start_date: string;
  warning_signal_time?: string;
  time_limit_hours?: number;
  total_distance_nm?: number;
  location?: string;
  route_waypoints?: RouteWaypoint[];
  start_area_name?: string;
  finish_area_name?: string;
  prohibited_areas?: ProhibitedArea[];
  traffic_separation_schemes?: string[];
  tide_gates?: TideGate[];
  vhf_channels?: VHFChannel[];
  expected_wind_direction?: string;
  expected_wind_speed_min?: number;
  expected_wind_speed_max?: number;
}

interface RouteLeg {
  index: number;
  fromWaypoint: RouteWaypoint;
  toWaypoint: RouteWaypoint;
  distanceNm: number;
  bearing: number;
  cumulativeDistanceNm: number;
  estimatedEta: Date;
  weather?: {
    windSpeed: number;
    windDirection: string;
  };
}

interface RouteBriefingWizardProps extends ChecklistToolProps {
  raceName?: string;
  raceDate?: string | null;
  venue?: { latitude?: number; longitude?: number } | null;
}

// Calculate distance between two points in nautical miles
function calculateDistanceNm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between two points
function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;
  return Math.round(bearing);
}

export function RouteBriefingWizard({
  item,
  regattaId,
  boatId,
  onComplete,
  onCancel,
  raceName,
  raceDate,
  venue,
}: RouteBriefingWizardProps) {
  const router = useRouter();

  // State
  const [step, setStep] = useState<WizardStep>('loading');
  const [raceData, setRaceData] = useState<RouteBriefingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legNotes, setLegNotes] = useState<Record<number, string>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    prohibitedAreas: true,
    tideGates: true,
    vhfChannels: true,
  });
  const [copied, setCopied] = useState(false);
  const [averageSpeedKts, setAverageSpeedKts] = useState(6); // Default average speed
  const [editedWaypoints, setEditedWaypoints] = useState<MapRouteWaypoint[]>([]);
  const [hasWaypointChanges, setHasWaypointChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch race data
  useEffect(() => {
    async function fetchData() {
      if (!regattaId) {
        setError('No race ID provided');
        setIsLoading(false);
        setStep('overview');
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('regattas')
          .select(
            `
            name,
            start_date,
            warning_signal_time,
            time_limit_hours,
            total_distance_nm,
            location,
            route_waypoints,
            start_area_name,
            finish_area_name,
            prohibited_areas,
            traffic_separation_schemes,
            tide_gates,
            vhf_channels,
            expected_wind_direction,
            expected_wind_speed_min,
            expected_wind_speed_max
          `
          )
          .eq('id', regattaId)
          .single();

        if (fetchError) {
          console.error('Error fetching race data:', fetchError);
          setError('Could not load race data');
        } else if (data) {
          setRaceData(data as RouteBriefingData);
          // Initialize edited waypoints from race data
          const waypoints = (data as RouteBriefingData).route_waypoints || [];
          setEditedWaypoints(waypoints.map((wp, idx) => ({
            id: wp.id || `wp-${idx}`,
            name: wp.name,
            latitude: wp.latitude,
            longitude: wp.longitude,
            type: wp.type,
            required: wp.required || wp.type === 'start' || wp.type === 'finish',
          })));
        }
      } catch (err) {
        console.error('Error:', err);
        setError('An error occurred loading race data');
      } finally {
        setIsLoading(false);
        setStep('overview');
      }
    }

    fetchData();
  }, [regattaId]);

  // Weather integration - use venue coordinates from props or first waypoint
  const firstWaypoint = raceData?.route_waypoints?.[0];
  const weatherVenue = useMemo(() => {
    const lat = venue?.latitude || firstWaypoint?.latitude;
    const lng = venue?.longitude || firstWaypoint?.longitude;
    if (!lat || !lng) return null;
    return { id: 'route', name: 'Route', coordinates_lat: String(lat), coordinates_lng: String(lng) } as any;
  }, [venue, firstWaypoint]);
  const weatherData = useRaceWeatherForecast(
    weatherVenue,
    raceData?.start_date || raceDate || null,
    true,
    (raceData?.time_limit_hours || 24) * 60,
  );

  // Calculate legs from waypoints
  const legs = useMemo((): RouteLeg[] => {
    if (!raceData?.route_waypoints || raceData.route_waypoints.length < 2) {
      return [];
    }

    // Sort waypoints by order field to ensure correct leg sequence (start → waypoints → finish)
    const waypoints = [...raceData.route_waypoints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const calculatedLegs: RouteLeg[] = [];
    let cumulativeDistance = 0;

    // Parse race start time (from warning_signal_time or extract from start_date timestamp)
    const startTimeStr = raceData.warning_signal_time ||
      new Date(raceData.start_date).toTimeString().slice(0, 5) || '10:00';
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const raceStartDate = new Date(raceData.start_date);
    raceStartDate.setHours(startH, startM, 0, 0);

    for (let i = 1; i < waypoints.length; i++) {
      const from = waypoints[i - 1];
      const to = waypoints[i];

      const distance = calculateDistanceNm(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude
      );

      cumulativeDistance += distance;

      // Calculate ETA based on cumulative distance and average speed
      const etaHours = cumulativeDistance / averageSpeedKts;
      const eta = new Date(raceStartDate.getTime() + etaHours * 60 * 60 * 1000);

      // Find weather at ETA
      let legWeather: { windSpeed: number; windDirection: string } | undefined;
      if (weatherData.data?.hourlyWind && weatherData.data?.hourlyWind.length > 0) {
        const etaTimestamp = eta.getTime();
        const closest = weatherData.data?.hourlyWind.reduce((prev: any, curr: any) => {
          const prevTs = new Date(prev.timestamp).getTime();
          const currTs = new Date(curr.timestamp).getTime();
          return Math.abs(currTs - etaTimestamp) < Math.abs(prevTs - etaTimestamp)
            ? curr
            : prev;
        });
        legWeather = {
          windSpeed: Math.round(closest.value),
          windDirection: closest.direction || '',
        };
      }

      calculatedLegs.push({
        index: i,
        fromWaypoint: from,
        toWaypoint: to,
        distanceNm: Math.round(distance * 10) / 10,
        bearing: calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude),
        cumulativeDistanceNm: Math.round(cumulativeDistance * 10) / 10,
        estimatedEta: eta,
        weather: legWeather,
      });
    }

    return calculatedLegs;
  }, [raceData, averageSpeedKts, weatherData.data?.hourlyWind]);

  // Calculate total distance
  const totalDistance = useMemo(() => {
    if (raceData?.total_distance_nm) return raceData.total_distance_nm;
    if (legs.length > 0) return legs[legs.length - 1].cumulativeDistanceNm;
    return 0;
  }, [raceData, legs]);

  // Navigate to learn more
  const handleLearnMore = useCallback(() => {
    onCancel();
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/learn/distance-racing-strategy' as any,
        params: { moduleId: 'module-12-1' },
      });
    }, 150);
  }, [router, onCancel]);

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Generate briefing text
  const generateBriefingText = useCallback((): string => {
    if (!raceData) return '';

    const lines: string[] = [];

    // Header
    lines.push(`ROUTE BRIEFING - ${raceData.name}`);
    const displayStartTime = raceData.warning_signal_time ||
      new Date(raceData.start_date).toTimeString().slice(0, 5) || 'TBC';
    lines.push(`Date: ${formatDate(raceData.start_date)} | Start: ${displayStartTime}`);
    lines.push(
      `Distance: ${totalDistance} nm | Time Limit: ${raceData.time_limit_hours || 'N/A'}h`
    );
    lines.push('');

    // Route
    lines.push('ROUTE');
    legs.forEach((leg, i) => {
      const weather = leg.weather
        ? ` | ${leg.weather.windSpeed}kt ${leg.weather.windDirection}`
        : '';
      lines.push(
        `${i + 1}. ${leg.fromWaypoint.name} -> ${leg.toWaypoint.name}`
      );
      lines.push(`   ${leg.distanceNm}nm, ${leg.bearing}°${weather}`);
      if (legNotes[leg.index]) {
        lines.push(`   Note: ${legNotes[leg.index]}`);
      }
    });

    // Hazards
    if (raceData.prohibited_areas && raceData.prohibited_areas.length > 0) {
      lines.push('');
      lines.push('HAZARDS');
      raceData.prohibited_areas.forEach((area) => {
        lines.push(`- ${area.name}${area.description ? `: ${area.description}` : ''}`);
      });
    }

    // Traffic
    if (raceData.traffic_separation_schemes && raceData.traffic_separation_schemes.length > 0) {
      lines.push('');
      lines.push('TRAFFIC ZONES');
      raceData.traffic_separation_schemes.forEach((scheme) => {
        lines.push(`- ${scheme}`);
      });
    }

    // Tide gates
    if (raceData.tide_gates && raceData.tide_gates.length > 0) {
      lines.push('');
      lines.push('TIDE GATES');
      raceData.tide_gates.forEach((gate) => {
        lines.push(
          `- ${gate.location}: ${gate.optimalTime || 'See chart'}${gate.notes ? ` (${gate.notes})` : ''}`
        );
      });
    }

    // VHF
    if (raceData.vhf_channels && raceData.vhf_channels.length > 0) {
      lines.push('');
      lines.push('VHF CHANNELS');
      raceData.vhf_channels.forEach((ch) => {
        lines.push(`- Ch ${ch.channel}: ${ch.purpose || ''}`);
      });
    }

    return lines.join('\n');
  }, [raceData, legs, legNotes, totalDistance]);

  // Handle copy
  const handleCopy = useCallback(async () => {
    const text = generateBriefingText();
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generateBriefingText]);

  // Handle native share
  const handleShare = useCallback(async () => {
    const text = generateBriefingText();
    const title = `Route Briefing - ${raceData?.name || 'Race'}`;
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ title, text });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(text);
        }
      } else {
        await Share.share({ message: text, title });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }, [generateBriefingText, raceData]);

  // Handle WhatsApp share
  const handleWhatsApp = useCallback(async () => {
    const text = generateBriefingText();
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error('WhatsApp share failed:', err);
    }
  }, [generateBriefingText]);

  // Handle waypoints change from DistanceRouteMap
  const handleWaypointsChange = useCallback((newWaypoints: MapRouteWaypoint[]) => {
    setEditedWaypoints(newWaypoints);
    setHasWaypointChanges(true);
  }, []);

  // Calculate total distance from edited waypoints
  const editedTotalDistance = useMemo(() => {
    if (editedWaypoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < editedWaypoints.length; i++) {
      const prev = editedWaypoints[i - 1];
      const curr = editedWaypoints[i];
      total += calculateDistanceNm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
    return Math.round(total * 10) / 10;
  }, [editedWaypoints]);

  // Save waypoints to database
  const handleSaveWaypoints = useCallback(async () => {
    if (!regattaId || !hasWaypointChanges) return;

    setIsSaving(true);
    try {
      // Convert MapRouteWaypoint to the database format
      const waypointsForDb = editedWaypoints.map(wp => ({
        id: wp.id,
        name: wp.name,
        latitude: wp.latitude,
        longitude: wp.longitude,
        type: wp.type,
        required: wp.required,
      }));

      const { error: updateError } = await supabase
        .from('regattas')
        .update({
          route_waypoints: waypointsForDb,
          total_distance_nm: editedTotalDistance,
        })
        .eq('id', regattaId);

      if (updateError) {
        console.error('Error saving waypoints:', updateError);
        setError('Failed to save waypoints');
      } else {
        // Update local raceData with new waypoints
        setRaceData(prev => prev ? {
          ...prev,
          route_waypoints: waypointsForDb as RouteWaypoint[],
          total_distance_nm: editedTotalDistance,
        } : null);
        setHasWaypointChanges(false);
        // Go back to overview
        setStep('overview');
      }
    } catch (err) {
      console.error('Error saving waypoints:', err);
      setError('An error occurred saving waypoints');
    } finally {
      setIsSaving(false);
    }
  }, [regattaId, hasWaypointChanges, editedWaypoints, editedTotalDistance]);

  // Navigate to edit step
  const handleEditRoute = useCallback(() => {
    setStep('edit');
  }, []);

  // Cancel editing and go back to overview
  const handleCancelEdit = useCallback(() => {
    // Reset edited waypoints to original
    const waypoints = raceData?.route_waypoints || [];
    setEditedWaypoints(waypoints.map((wp, idx) => ({
      id: wp.id || `wp-${idx}`,
      name: wp.name,
      latitude: wp.latitude,
      longitude: wp.longitude,
      type: wp.type,
      required: wp.required || wp.type === 'start' || wp.type === 'finish',
    })));
    setHasWaypointChanges(false);
    setStep('overview');
  }, [raceData]);

  // Format time limit as day and time
  const formatTimeLimit = useCallback((startDate: string, timeLimitHours?: number): string => {
    if (!timeLimitHours || !startDate) return 'N/A';
    try {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) return `${timeLimitHours}h`;

      // Add time limit hours to start date
      const deadline = new Date(start.getTime() + timeLimitHours * 60 * 60 * 1000);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const hours = deadline.getHours();
      const ampm = hours >= 12 ? 'pm' : 'am';
      const hour12 = hours % 12 || 12;

      return `${dayNames[deadline.getDay()]} ${hour12}${ampm}`;
    } catch {
      return `${timeLimitHours}h`;
    }
  }, []);

  // Format date
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
    } catch {
      return '';
    }
  };

  // Format time
  const formatTime = (date: Date): string => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  // Calculate progress (edit step is not counted in main flow)
  const progress = useMemo(() => {
    const stepMap: Record<WizardStep, number> = {
      loading: 0,
      overview: 1,
      edit: 1.5, // Edit is a sub-step of overview
      legs: 2,
      hazards: 3,
      share: 4,
    };
    return stepMap[step] / 4;
  }, [step]);

  // Step navigation (edit step is accessed separately via Edit Route button)
  const handleNext = useCallback(() => {
    const steps: WizardStep[] = ['overview', 'legs', 'hazards', 'share'];
    const currentIndex = steps.indexOf(step as any);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    // If in edit mode, go back to overview
    if (step === 'edit') {
      handleCancelEdit();
      return;
    }
    const steps: WizardStep[] = ['overview', 'legs', 'hazards', 'share'];
    const currentIndex = steps.indexOf(step as any);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  }, [step, handleCancelEdit]);

  // Render loading
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={IOS_COLORS.blue} />
      <Text style={styles.loadingText}>Loading route data...</Text>
    </View>
  );

  // Render Overview step
  const renderOverview = () => {
    const waypoints = raceData?.route_waypoints || [];
    const hasWaypoints = waypoints.length > 0;

    // Extract start and finish waypoints
    const startWaypoint = waypoints.find(wp => wp.type === 'start');
    const finishWaypoint = waypoints.find(wp => wp.type === 'finish');
    const intermediateWaypoints = waypoints.filter(wp => wp.type !== 'start' && wp.type !== 'finish');

    // Get prohibited areas
    const prohibitedAreas = raceData?.prohibited_areas || [];
    const hasProhibitedAreas = prohibitedAreas.length > 0;

    return (
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner}>
        {/* Header */}
        <View style={styles.overviewHeader}>
          <View style={[styles.iconCircle, { backgroundColor: `${IOS_COLORS.blue}15` }]}>
            <Navigation size={32} color={IOS_COLORS.blue} />
          </View>
          <Text style={styles.overviewTitle}>{raceData?.name || raceName || 'Route Briefing'}</Text>
          <Text style={styles.overviewDescription}>
            {formatDate(raceData?.start_date)} · {raceData?.warning_signal_time || (raceData?.start_date ? new Date(raceData.start_date).toTimeString().slice(0, 5) : 'TBC')} start
          </Text>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Distance</Text>
              <Text style={styles.summaryValue}>{totalDistance} nm</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Legs</Text>
              <Text style={styles.summaryValue}>{legs.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Time Limit</Text>
              <Text style={styles.summaryValue}>
                {formatTimeLimit(raceData?.start_date || '', raceData?.time_limit_hours)}
              </Text>
            </View>
          </View>
        </View>

        {/* Edit Route Button */}
        <Pressable style={styles.editRouteButton} onPress={handleEditRoute}>
          <Edit2 size={18} color={IOS_COLORS.purple} />
          <Text style={styles.editRouteButtonText}>Edit Route</Text>
          <ChevronRight size={18} color={IOS_COLORS.purple} />
        </Pressable>

        {/* Start Location */}
        {(startWaypoint || raceData?.start_area_name) && (
          <View style={styles.startFinishCard}>
            <View style={styles.startFinishHeader}>
              <View style={[styles.startFinishIcon, { backgroundColor: `${IOS_COLORS.green}15` }]}>
                <Flag size={20} color={IOS_COLORS.green} />
              </View>
              <View style={styles.startFinishInfo}>
                <Text style={styles.startFinishLabel}>START</Text>
                <Text style={styles.startFinishName}>
                  {startWaypoint?.name || raceData?.start_area_name || 'Start Line'}
                </Text>
                {startWaypoint && (
                  <Text style={styles.startFinishCoords}>
                    {startWaypoint.latitude.toFixed(4)}°, {startWaypoint.longitude.toFixed(4)}°
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Finish Location */}
        {(finishWaypoint || raceData?.finish_area_name) && (
          <View style={styles.startFinishCard}>
            <View style={styles.startFinishHeader}>
              <View style={[styles.startFinishIcon, { backgroundColor: `${IOS_COLORS.red}15` }]}>
                <Anchor size={20} color={IOS_COLORS.red} />
              </View>
              <View style={styles.startFinishInfo}>
                <Text style={styles.startFinishLabel}>FINISH</Text>
                <Text style={styles.startFinishName}>
                  {finishWaypoint?.name || raceData?.finish_area_name || 'Finish Line'}
                </Text>
                {finishWaypoint && (
                  <Text style={styles.startFinishCoords}>
                    {finishWaypoint.latitude.toFixed(4)}°, {finishWaypoint.longitude.toFixed(4)}°
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Prohibited Areas */}
        {hasProhibitedAreas && (
          <View style={styles.prohibitedAreasCard}>
            <View style={styles.prohibitedAreasHeader}>
              <AlertCircle size={18} color={IOS_COLORS.red} />
              <Text style={styles.prohibitedAreasTitle}>PROHIBITED AREAS</Text>
              <View style={styles.prohibitedAreasBadge}>
                <Text style={styles.prohibitedAreasBadgeText}>{prohibitedAreas.length}</Text>
              </View>
            </View>
            {prohibitedAreas.map((area, index) => (
              <View key={index} style={styles.prohibitedAreaItem}>
                <Text style={styles.prohibitedAreaName}>{area.name}</Text>
                {area.description && (
                  <Text style={styles.prohibitedAreaDescription}>{area.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Intermediate Waypoints List */}
        {intermediateWaypoints.length > 0 ? (
          <View style={styles.waypointsList}>
            <Text style={styles.sectionTitle}>ROUTE WAYPOINTS</Text>
            {intermediateWaypoints.map((wp, index) => {
              const Icon = wp.type === 'gate' ? Navigation : MapPin;
              const iconColor = wp.type === 'gate' ? IOS_COLORS.orange : IOS_COLORS.blue;

              return (
                <View key={wp.id || index} style={styles.waypointRow}>
                  <View style={[styles.waypointIcon, { backgroundColor: `${iconColor}15` }]}>
                    <Icon size={16} color={iconColor} />
                  </View>
                  <View style={styles.waypointInfo}>
                    <Text style={styles.waypointName}>{wp.name}</Text>
                    <Text style={styles.waypointCoords}>
                      {wp.latitude.toFixed(4)}°, {wp.longitude.toFixed(4)}°
                    </Text>
                  </View>
                  <Text style={styles.waypointType}>{wp.type}</Text>
                </View>
              );
            })}
          </View>
        ) : !hasWaypoints ? (
          <View style={styles.emptyState}>
            <AlertTriangle size={32} color={IOS_COLORS.orange} />
            <Text style={styles.emptyStateTitle}>No Waypoints Set</Text>
            <Text style={styles.emptyStateDescription}>
              Add waypoints to the race to enable route briefing. Edit the race to add course
              waypoints.
            </Text>
          </View>
        ) : null}

        {/* Expected Conditions */}
        {(raceData?.expected_wind_direction || raceData?.expected_wind_speed_min) && (
          <View style={styles.conditionsCard}>
            <Text style={styles.sectionTitle}>EXPECTED CONDITIONS</Text>
            <View style={styles.conditionsRow}>
              <Wind size={18} color={IOS_COLORS.blue} />
              <Text style={styles.conditionsText}>
                {raceData.expected_wind_direction || ''}{' '}
                {raceData.expected_wind_speed_min && raceData.expected_wind_speed_max
                  ? `${raceData.expected_wind_speed_min}-${raceData.expected_wind_speed_max} kts`
                  : raceData.expected_wind_speed_min
                  ? `${raceData.expected_wind_speed_min}+ kts`
                  : ''}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render Legs step
  const renderLegs = () => {
    if (legs.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <AlertTriangle size={48} color={IOS_COLORS.orange} />
          <Text style={styles.emptyStateTitle}>No Legs to Display</Text>
          <Text style={styles.emptyStateDescription}>
            Add at least 2 waypoints to see leg details.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner}>
        {/* Speed Setting */}
        <View style={styles.speedSetting}>
          <Text style={styles.speedLabel}>Average Speed</Text>
          <View style={styles.speedInputRow}>
            <Pressable
              style={styles.speedButton}
              onPress={() => setAverageSpeedKts((s) => Math.max(1, s - 1))}
            >
              <Text style={styles.speedButtonText}>-</Text>
            </Pressable>
            <Text style={styles.speedValue}>{averageSpeedKts} kts</Text>
            <Pressable
              style={styles.speedButton}
              onPress={() => setAverageSpeedKts((s) => Math.min(20, s + 1))}
            >
              <Text style={styles.speedButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Legs List */}
        {legs.map((leg) => (
          <View key={leg.index} style={styles.legCard}>
            <View style={styles.legHeader}>
              <Text style={styles.legNumber}>Leg {leg.index}</Text>
              <Text style={styles.legDistance}>{leg.distanceNm} nm</Text>
            </View>

            <View style={styles.legRoute}>
              <Text style={styles.legFrom}>{leg.fromWaypoint.name}</Text>
              <ChevronRight size={16} color={IOS_COLORS.gray} />
              <Text style={styles.legTo}>{leg.toWaypoint.name}</Text>
            </View>

            <View style={styles.legDetails}>
              <View style={styles.legDetailItem}>
                <Compass size={14} color={IOS_COLORS.gray} />
                <Text style={styles.legDetailText}>{leg.bearing}°</Text>
              </View>
              <View style={styles.legDetailItem}>
                <Clock size={14} color={IOS_COLORS.gray} />
                <Text style={styles.legDetailText}>ETA {formatTime(leg.estimatedEta)}</Text>
              </View>
              <View style={styles.legDetailItem}>
                <MapPin size={14} color={IOS_COLORS.gray} />
                <Text style={styles.legDetailText}>{leg.cumulativeDistanceNm} nm total</Text>
              </View>
            </View>

            {/* Weather at ETA */}
            {leg.weather && (
              <View style={styles.legWeather}>
                <Wind size={14} color={IOS_COLORS.blue} />
                <Text style={styles.legWeatherText}>
                  {leg.weather.windSpeed} kts {leg.weather.windDirection}
                </Text>
              </View>
            )}

            {/* Notes input */}
            <TextInput
              style={styles.legNotesInput}
              placeholder="Add tactical notes for this leg..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={legNotes[leg.index] || ''}
              onChangeText={(text) =>
                setLegNotes((prev) => ({ ...prev, [leg.index]: text }))
              }
              multiline
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  // Render Hazards step
  const renderHazards = () => {
    const hasProhibited =
      raceData?.prohibited_areas && raceData.prohibited_areas.length > 0;
    const hasTraffic =
      raceData?.traffic_separation_schemes &&
      raceData.traffic_separation_schemes.length > 0;
    const hasTideGates = raceData?.tide_gates && raceData.tide_gates.length > 0;
    const hasVHF = raceData?.vhf_channels && raceData.vhf_channels.length > 0;
    const hasAnyData = hasProhibited || hasTraffic || hasTideGates || hasVHF;

    if (!hasAnyData) {
      return (
        <View style={styles.emptyStateContainer}>
          <CheckCircle2 size={48} color={IOS_COLORS.green} />
          <Text style={styles.emptyStateTitle}>No Hazards Defined</Text>
          <Text style={styles.emptyStateDescription}>
            No prohibited areas, tide gates, or special instructions have been extracted for this
            race.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner}>
        {/* Prohibited Areas */}
        {hasProhibited && (
          <View style={styles.hazardSection}>
            <Pressable
              style={styles.hazardHeader}
              onPress={() => toggleSection('prohibitedAreas')}
            >
              <AlertCircle size={20} color={IOS_COLORS.red} />
              <Text style={styles.hazardTitle}>Prohibited Areas</Text>
              <Text style={styles.hazardCount}>{raceData!.prohibited_areas!.length}</Text>
              {expandedSections.prohibitedAreas ? (
                <ChevronUp size={20} color={IOS_COLORS.gray} />
              ) : (
                <ChevronDown size={20} color={IOS_COLORS.gray} />
              )}
            </Pressable>
            {expandedSections.prohibitedAreas && (
              <View style={styles.hazardContent}>
                {raceData!.prohibited_areas!.map((area, index) => (
                  <View key={index} style={styles.hazardItem}>
                    <Text style={styles.hazardItemName}>{area.name}</Text>
                    {area.description && (
                      <Text style={styles.hazardItemDescription}>{area.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Traffic Separation */}
        {hasTraffic && (
          <View style={styles.hazardSection}>
            <View style={styles.hazardHeader}>
              <Navigation size={20} color={IOS_COLORS.orange} />
              <Text style={styles.hazardTitle}>Traffic Zones</Text>
              <Text style={styles.hazardCount}>
                {raceData!.traffic_separation_schemes!.length}
              </Text>
            </View>
            <View style={styles.hazardContent}>
              {raceData!.traffic_separation_schemes!.map((scheme, index) => (
                <View key={index} style={styles.hazardItem}>
                  <Text style={styles.hazardItemName}>{scheme}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tide Gates */}
        {hasTideGates && (
          <View style={styles.hazardSection}>
            <Pressable style={styles.hazardHeader} onPress={() => toggleSection('tideGates')}>
              <Waves size={20} color={IOS_COLORS.purple} />
              <Text style={styles.hazardTitle}>Tide Gates</Text>
              <Text style={styles.hazardCount}>{raceData!.tide_gates!.length}</Text>
              {expandedSections.tideGates ? (
                <ChevronUp size={20} color={IOS_COLORS.gray} />
              ) : (
                <ChevronDown size={20} color={IOS_COLORS.gray} />
              )}
            </Pressable>
            {expandedSections.tideGates && (
              <View style={styles.hazardContent}>
                {raceData!.tide_gates!.map((gate, index) => (
                  <View key={index} style={styles.hazardItem}>
                    <View style={styles.tideGateRow}>
                      <Text style={styles.hazardItemName}>{gate.location}</Text>
                      {gate.optimalTime && (
                        <Text style={styles.tideGateTime}>{gate.optimalTime}</Text>
                      )}
                    </View>
                    {gate.notes && (
                      <Text style={styles.hazardItemDescription}>{gate.notes}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* VHF Channels */}
        {hasVHF && (
          <View style={styles.hazardSection}>
            <Pressable style={styles.hazardHeader} onPress={() => toggleSection('vhfChannels')}>
              <Radio size={20} color={IOS_COLORS.green} />
              <Text style={styles.hazardTitle}>VHF Channels</Text>
              <Text style={styles.hazardCount}>{raceData!.vhf_channels!.length}</Text>
              {expandedSections.vhfChannels ? (
                <ChevronUp size={20} color={IOS_COLORS.gray} />
              ) : (
                <ChevronDown size={20} color={IOS_COLORS.gray} />
              )}
            </Pressable>
            {expandedSections.vhfChannels && (
              <View style={styles.hazardContent}>
                {raceData!.vhf_channels!.map((channel, index) => (
                  <View key={index} style={styles.vhfRow}>
                    <Text style={styles.vhfChannel}>Ch {channel.channel}</Text>
                    <Text style={styles.vhfPurpose}>{channel.purpose || ''}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  // Render Share step
  const renderShare = () => {
    const briefingPreview = generateBriefingText();

    return (
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner}>
        {/* Header */}
        <View style={styles.shareHeader}>
          <View style={[styles.iconCircle, { backgroundColor: `${IOS_COLORS.green}15` }]}>
            <Share2 size={32} color={IOS_COLORS.green} />
          </View>
          <Text style={styles.overviewTitle}>Share Briefing</Text>
          <Text style={styles.overviewDescription}>
            Send the route briefing to your crew
          </Text>
        </View>

        {/* Share Buttons */}
        <View style={styles.shareButtons}>
          <Pressable style={styles.shareButton} onPress={handleWhatsApp}>
            <MessageCircle size={24} color={IOS_COLORS.green} />
            <Text style={styles.shareButtonText}>WhatsApp</Text>
          </Pressable>

          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Share2 size={24} color={IOS_COLORS.blue} />
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>

          <Pressable style={styles.shareButton} onPress={handleCopy}>
            {copied ? (
              <Check size={24} color={IOS_COLORS.green} />
            ) : (
              <Copy size={24} color={IOS_COLORS.gray2} />
            )}
            <Text style={styles.shareButtonText}>{copied ? 'Copied!' : 'Copy'}</Text>
          </Pressable>
        </View>

        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Preview</Text>
          <ScrollView style={styles.previewScroll} nestedScrollEnabled>
            <Text style={styles.previewText}>{briefingPreview}</Text>
          </ScrollView>
        </View>
      </ScrollView>
    );
  };

  // Render Edit step with DistanceRouteMap
  const renderEditStep = () => {
    // Get initial center from first waypoint or race location
    const firstWp = editedWaypoints[0];
    const initialCenter = firstWp
      ? { lat: firstWp.latitude, lng: firstWp.longitude }
      : { lat: 22.28, lng: 114.16 }; // Default to Hong Kong

    return (
      <View style={styles.editContainer}>
        {/* Edit Header */}
        <View style={styles.editHeader}>
          <View style={[styles.iconCircle, { backgroundColor: `${IOS_COLORS.purple}15`, width: 48, height: 48, borderRadius: 24 }]}>
            <Edit2 size={24} color={IOS_COLORS.purple} />
          </View>
          <View style={styles.editHeaderText}>
            <Text style={styles.editTitle}>Edit Route</Text>
            <Text style={styles.editSubtitle}>
              {editedWaypoints.length} waypoints · {editedTotalDistance} nm
            </Text>
          </View>
          {hasWaypointChanges && (
            <View style={styles.unsavedBadge}>
              <Text style={styles.unsavedBadgeText}>Unsaved</Text>
            </View>
          )}
        </View>

        {/* Map Component */}
        {Platform.OS === 'web' ? (
          <View style={styles.mapContainer}>
            <DistanceRouteMap
              waypoints={editedWaypoints}
              onWaypointsChange={handleWaypointsChange}
              initialCenter={initialCenter}
              initialZoom={11}
              onTotalDistanceChange={() => {}} // We calculate this ourselves
            />
          </View>
        ) : (
          <View style={styles.nativeMapPlaceholder}>
            <MapPin size={48} color={IOS_COLORS.gray} />
            <Text style={styles.nativeMapText}>Map editing available on web</Text>
            <Text style={styles.nativeMapSubtext}>Open BetterAt in a browser to edit waypoints</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.editInstructions}>
          <Text style={styles.editInstructionsTitle}>How to Edit</Text>
          <Text style={styles.editInstructionsText}>
            • Click the map to add waypoints{'\n'}
            • Drag markers to reposition{'\n'}
            • Click a marker to edit name/type{'\n'}
            • Use ↑↓ arrows to reorder
          </Text>
        </View>
      </View>
    );
  };

  // Render content based on step
  const renderContent = () => {
    switch (step) {
      case 'loading':
        return renderLoading();
      case 'overview':
        return renderOverview();
      case 'edit':
        return renderEditStep();
      case 'legs':
        return renderLegs();
      case 'hazards':
        return renderHazards();
      case 'share':
        return renderShare();
      default:
        return null;
    }
  };

  // Render bottom navigation
  const renderBottomNav = () => {
    if (step === 'loading') return null;

    return (
      <View style={styles.bottomNav}>
        {step === 'overview' && (
          <Pressable style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>View Legs</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </Pressable>
        )}

        {step === 'edit' && (
          <View style={styles.navRow}>
            <Pressable style={styles.secondaryButton} onPress={handleCancelEdit}>
              <X size={20} color={IOS_COLORS.gray} />
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryButton,
                styles.saveButton,
                (!hasWaypointChanges || isSaving) && styles.disabledButton,
              ]}
              onPress={handleSaveWaypoints}
              disabled={!hasWaypointChanges || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Save size={20} color="#FFFFFF" />
              )}
              <Text style={styles.primaryButtonText}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        )}

        {step === 'legs' && (
          <View style={styles.navRow}>
            <Pressable style={styles.secondaryButton} onPress={handleBack}>
              <ChevronLeft size={20} color={IOS_COLORS.blue} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Hazards</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {step === 'hazards' && (
          <View style={styles.navRow}>
            <Pressable style={styles.secondaryButton} onPress={handleBack}>
              <ChevronLeft size={20} color={IOS_COLORS.blue} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Share</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {step === 'share' && (
          <View style={styles.navRow}>
            <Pressable style={styles.secondaryButton} onPress={handleBack}>
              <ChevronLeft size={20} color={IOS_COLORS.blue} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, styles.successButton]}
              onPress={onComplete}
            >
              <CheckCircle2 size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Complete</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={onCancel}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={styles.closeButtonInner}>
              <X size={20} color={IOS_COLORS.gray} strokeWidth={2.5} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>Route Briefing</Text>
          <View style={styles.headerRight}>
            <Pressable style={styles.learnButton} onPress={handleLearnMore}>
              <BookOpen size={20} color={IOS_COLORS.purple} />
            </Pressable>
          </View>
        </View>

        {/* Progress Bar */}
        {step !== 'loading' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%` },
                  step === 'share' && styles.progressComplete,
                ]}
              />
            </View>
          </View>
        )}

        {/* Content */}
        {renderContent()}
      </SafeAreaView>

      {/* Bottom Navigation */}
      {renderBottomNav()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.secondaryBackground,
  },
  safeArea: {
    flex: 1,
    backgroundColor: IOS_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 56,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  closeButton: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  learnButton: {
    padding: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: IOS_COLORS.secondaryBackground,
  },
  progressBar: {
    height: 4,
    backgroundColor: IOS_COLORS.separator,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 2,
  },
  progressComplete: {
    backgroundColor: IOS_COLORS.green,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
  },
  overviewHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 4,
    textAlign: 'center',
  },
  overviewDescription: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1,
    marginBottom: 12,
  },
  startFinishCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  startFinishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  startFinishIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startFinishInfo: {
    flex: 1,
  },
  startFinishLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1,
    marginBottom: 2,
  },
  startFinishName: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  startFinishCoords: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  prohibitedAreasCard: {
    backgroundColor: `${IOS_COLORS.red}08`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.red}20`,
  },
  prohibitedAreasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  prohibitedAreasTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.red,
    letterSpacing: 1,
    flex: 1,
  },
  prohibitedAreasBadge: {
    backgroundColor: IOS_COLORS.red,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  prohibitedAreasBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  prohibitedAreaItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${IOS_COLORS.red}20`,
  },
  prohibitedAreaName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  prohibitedAreaDescription: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  waypointsList: {
    marginBottom: 16,
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  waypointIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  waypointCoords: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  waypointType: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'capitalize',
  },
  conditionsCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
  },
  conditionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conditionsText: {
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
  },
  speedSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  speedLabel: {
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  speedInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speedButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  speedValue: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    minWidth: 60,
    textAlign: 'center',
  },
  legCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  legHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  legNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  legDistance: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  legRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  legFrom: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  legTo: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  legDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  legDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legDetailText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  legWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    marginBottom: 12,
  },
  legWeatherText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  legNotesInput: {
    backgroundColor: IOS_COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: IOS_COLORS.label,
    minHeight: 40,
  },
  hazardSection: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  hazardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  hazardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    flex: 1,
  },
  hazardCount: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    backgroundColor: IOS_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  hazardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  hazardItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  hazardItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  hazardItemDescription: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  tideGateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tideGateTime: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.purple,
  },
  vhfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  vhfChannel: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.green,
    minWidth: 60,
  },
  vhfPurpose: {
    fontSize: 14,
    color: IOS_COLORS.label,
    flex: 1,
  },
  shareHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  shareButton: {
    alignItems: 'center',
    gap: 8,
  },
  shareButtonText: {
    fontSize: 13,
    color: IOS_COLORS.label,
  },
  previewCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    flex: 1,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 12,
  },
  previewScroll: {
    maxHeight: 300,
  },
  previewText: {
    fontSize: 12,
    color: IOS_COLORS.label,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  bottomNav: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.blue,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.background,
    gap: 4,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  successButton: {
    backgroundColor: IOS_COLORS.green,
  },
  saveButton: {
    backgroundColor: IOS_COLORS.purple,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Edit Route Button styles
  editRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${IOS_COLORS.purple}10`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.purple}30`,
  },
  editRouteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.purple,
    flex: 1,
  },
  // Edit Step styles
  editContainer: {
    flex: 1,
    backgroundColor: IOS_COLORS.background,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: IOS_COLORS.secondaryBackground,
    gap: 12,
  },
  editHeaderText: {
    flex: 1,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  editSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  unsavedBadge: {
    backgroundColor: IOS_COLORS.orange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unsavedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
    minHeight: 400,
  },
  nativeMapPlaceholder: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.secondaryBackground,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  nativeMapText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  nativeMapSubtext: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  editInstructions: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  editInstructionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 8,
  },
  editInstructionsText: {
    fontSize: 13,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
});

export default RouteBriefingWizard;
