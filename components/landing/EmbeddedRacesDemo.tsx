/**
 * Embedded Races Demo Component
 * Uses the actual RaceCard component to match the real /races interface exactly
 *
 * Features:
 * - Uses real RaceCard component with demo data
 * - Exact styling match to authenticated version
 * - Read-only mode (no interactions)
 * - Full scrollable interface
 */
// @ts-nocheck - This component uses web-specific styles that conflict with RN types

import { RaceConditionsCard } from '@/components/race-detail/RaceConditionsCard';
import { RaceCard } from '@/components/races/RaceCard';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { FeatureId } from './FeatureDescriptions';

interface EmbeddedRacesDemoProps {
  /**
   * Width of the screen
   * Default: 296px (phone) or 1200px (desktop)
   */
  screenWidth?: number;
  /**
   * Height of the screen
   * Default: 616px (phone) or auto (desktop)
   */
  screenHeight?: number;
  /**
   * Whether to auto-reset demo state
   * Default: false
   */
  autoReset?: boolean;
  /**
   * Delay before reset (ms)
   * Default: 10000
   */
  resetDelay?: number;
  /**
   * Display mode: 'phone' (focused), 'desktop' (full scrollable), 'fullscreen' (no frame, full-width), or 'mobile-native' (optimized for mobile web)
   * Default: 'phone'
   */
  mode?: 'phone' | 'desktop' | 'fullscreen' | 'mobile-native';
  /**
   * Whether content is scrollable (for desktop/fullscreen mode)
   * Default: false
   */
  scrollable?: boolean;
  /**
   * Whether interface is read-only (no interactions)
   * Default: false
   */
  readOnly?: boolean;
  /**
   * Hide the blue "Races" header bar (redundant with "All Races" text)
   * Default: false
   */
  hideHeader?: boolean;
  /**
   * Currently highlighted feature - triggers scroll and visual highlight
   */
  highlightedFeature?: FeatureId | null;
  /**
   * Callback when feature highlighting is complete
   */
  onFeatureHighlighted?: (featureId: FeatureId) => void;
  /**
   * Currently highlighted race ID - triggers scroll and visual highlight
   */
  highlightedRaceId?: string | null;
  /**
   * Whether to show the bottom tab navigation bar
   * Default: false (hidden for landing page demo)
   */
  showTabs?: boolean;
}

// Demo race data - variety of races to showcase full functionality
const DEMO_RACES = [
  // Upcoming fleet race - Hong Kong
  {
    id: 'demo-1',
    name: 'Dragon Class Spring Championship',
    venue: 'Royal Hong Kong Yacht Club',
    date: '2025-03-15',
    startTime: '14:00',
    wind: {
      direction: 'NE',
      speedMin: 12,
      speedMax: 15,
    },
    tide: {
      state: 'flooding' as const,
      height: 2.5,
    },
    courseName: 'Windward-Leeward',
    isMock: true,
    raceStatus: 'future' as const,
  },
  // Past completed race with results
  {
    id: 'demo-2',
    name: 'Wednesday Evening Series Race 3',
    venue: 'Victoria Harbor',
    date: '2025-01-15',
    startTime: '18:30',
    wind: {
      direction: 'E',
      speedMin: 8,
      speedMax: 12,
    },
    tide: {
      state: 'ebbing' as const,
      height: 1.8,
    },
    courseName: 'Triangle',
    isMock: true,
    raceStatus: 'past' as const,
    results: {
      position: 3,
      points: 3,
      fleetSize: 12,
      status: 'finished' as const,
      seriesPosition: 2,
      totalRaces: 5,
    },
  },
  // Distance race - Newport
  {
    id: 'demo-3',
    name: 'Newport to Bermuda Race',
    venue: 'Newport, Rhode Island',
    date: '2025-06-20',
    startTime: '10:00',
    wind: {
      direction: 'SW',
      speedMin: 15,
      speedMax: 20,
    },
    tide: {
      state: 'flooding' as const,
      height: 1.2,
    },
    courseName: 'Distance',
    isMock: true,
    raceStatus: 'future' as const,
  },
  // J/70 fleet race - Cowes
  {
    id: 'demo-4',
    name: 'J/70 Cowes Week',
    venue: 'Cowes, Isle of Wight',
    date: '2025-08-05',
    startTime: '11:30',
    wind: {
      direction: 'W',
      speedMin: 10,
      speedMax: 14,
    },
    tide: {
      state: 'ebbing' as const,
      height: 2.8,
    },
    courseName: 'Windward-Leeward',
    isMock: true,
    raceStatus: 'future' as const,
  },
  // Near future race - Hong Kong (next race)
  {
    id: 'demo-5',
    name: 'RHKYC Around the Island Race',
    venue: 'Hong Kong Island',
    date: '2025-02-28',
    startTime: '09:00',
    wind: {
      direction: 'SE',
      speedMin: 10,
      speedMax: 14,
    },
    tide: {
      state: 'flooding' as const,
      height: 2.2,
    },
    courseName: 'Distance',
    isMock: true,
    raceStatus: 'next' as const,
  },
  // Past race - Newport
  {
    id: 'demo-6',
    name: 'Newport Regatta - Race 2',
    venue: 'Newport, Rhode Island',
    date: '2024-12-10',
    startTime: '13:00',
    wind: {
      direction: 'N',
      speedMin: 6,
      speedMax: 10,
    },
    tide: {
      state: 'slack' as const,
      height: 0.5,
    },
    courseName: 'Triangle',
    isMock: true,
    raceStatus: 'past' as const,
    results: {
      position: 1,
      points: 1,
      fleetSize: 8,
      status: 'finished' as const,
    },
  },
  // Upcoming fleet race - Cowes
  {
    id: 'demo-7',
    name: 'Cowes Week - Day 3',
    venue: 'Cowes, Isle of Wight',
    date: '2025-07-28',
    startTime: '14:30',
    wind: {
      direction: 'S',
      speedMin: 12,
      speedMax: 18,
    },
    tide: {
      state: 'flooding' as const,
      height: 3.1,
    },
    courseName: 'Windward-Leeward',
    isMock: true,
    raceStatus: 'future' as const,
  },
  // Past race - Hong Kong
  {
    id: 'demo-8',
    name: 'Hong Kong Race Week - Final',
    venue: 'Royal Hong Kong Yacht Club',
    date: '2024-11-20',
    startTime: '15:00',
    wind: {
      direction: 'NE',
      speedMin: 14,
      speedMax: 18,
    },
    tide: {
      state: 'ebbing' as const,
      height: 1.5,
    },
    courseName: 'Windward-Leeward',
    isMock: true,
    raceStatus: 'past' as const,
    results: {
      position: 5,
      points: 5,
      fleetSize: 15,
      status: 'finished' as const,
      seriesPosition: 4,
      totalRaces: 6,
    },
  },
];

// Scale factor: component is designed for full screen, we scale to fit phone
const ORIGINAL_WIDTH = 375; // iPhone width
const ORIGINAL_HEIGHT = 812; // iPhone height

export function EmbeddedRacesDemo({
  screenWidth,
  screenHeight,
  autoReset = false,
  resetDelay = 10000,
  mode = 'phone',
  scrollable = false,
  readOnly: _readOnly = false,
  hideHeader = false,
  highlightedFeature,
  onFeatureHighlighted,
  highlightedRaceId,
  showTabs = false, // Default to false - hidden for landing page demo
}: EmbeddedRacesDemoProps) {
  const [key, setKey] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  // Initialize as true on native (no opacity hiding), false on web (will be set by auto-scroll or fallback)
  const [isScrollPositionSet, setIsScrollPositionSet] = useState(Platform.OS !== 'web'); // Track if initial scroll position is set
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [highlightedRaceCard, setHighlightedRaceCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'races' | 'learn' | 'courses' | 'boats' | 'venues' | 'more' | 'coaches' | 'fleet' | 'clubs'>('races');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const containerRef = useRef<View>(null);
  const raceCardHighlightRef = useRef<View>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const raceCardsScrollViewRef = useRef<ScrollView>(null);
  const detailsScrollViewRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);
  const [, setScrollContentWidth] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const hasAutoCentered = useRef(false);
  const { width: windowWidth } = useWindowDimensions();
  // Track actual container width for accurate centering calculations
  const [containerWidth, setContainerWidth] = useState(0);
  // Use container width if available, otherwise fall back to window width
  const SCREEN_WIDTH = containerWidth > 0 ? containerWidth : windowWidth;

  // Mobile-native mode detection - auto-switch on mobile web browsers
  const isMobileWeb = Platform.OS === 'web' && windowWidth <= 480;
  const effectiveMode = useMemo(() => {
    // If explicitly set to mobile-native, use it
    if (mode === 'mobile-native') return 'mobile-native';
    // Auto-switch to mobile-native on small mobile web screens (unless in phone mockup mode)
    if (isMobileWeb && mode !== 'phone') return 'mobile-native';
    return mode;
  }, [mode, isMobileWeb]);

  // Responsive race card width based on screen size
  const RACE_CARD_WIDTH = useMemo(() => {
    if (effectiveMode === 'mobile-native') {
      // On mobile, use nearly full-width cards with padding
      if (windowWidth <= 375) return windowWidth - 40; // ~335px on iPhone SE
      if (windowWidth <= 430) return Math.min(300, windowWidth - 48);
      return 280;
    }
    // Desktop/tablet keeps original size
    return 240;
  }, [windowWidth, effectiveMode]);

  // Inject global responsive CSS for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'regattaflow-responsive-styles';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      
      styleElement.textContent = `
        /* Global responsive styles */
        * {
          box-sizing: border-box;
        }
        
        img, svg {
          max-width: 100%;
          height: auto;
        }
        
        /* Prevent horizontal scroll */
        body {
          overflow-x: hidden;
        }
      `;
      
      return () => {
        const existing = document.getElementById(styleId);
        if (existing && existing.parentNode) {
          existing.remove();
        }
      };
    }
  }, []);
  
  // Refs for feature sections
  const racePlanningRef = useRef<View>(null);
  const conditionsRef = useRef<View>(null);
  const aiStrategyRef = useRef<View>(null);
  const rigTuningRef = useRef<View>(null);
  const gpsTrackingRef = useRef<View>(null);
  const postRaceRef = useRef<View>(null);
  const coachesRef = useRef<View>(null);
  const venueIntelligenceRef = useRef<View>(null);
  const fleetSharingRef = useRef<View>(null);
  const learningAcademyRef = useRef<View>(null);
  const yachtClubRef = useRef<View>(null);
  
  // Use current date for realistic countdowns
  const DEMO_NOW = new Date();
  DEMO_NOW.setHours(12, 0, 0, 0); // Set to noon for consistency
  
  // Calculate demo race dates relative to today for realistic countdowns
  const getDemoDate = (daysFromNow: number): string => {
    const date = new Date(DEMO_NOW);
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  // Create demo races with dates relative to today
  // This ensures each race shows a proper countdown
  const demoRacesWithDates = useMemo(() => {
    let pastCount = 0;
    let futureCount = 0;
    
    return DEMO_RACES.map((race) => {
      let daysOffset: number;
      
      if (race.raceStatus === 'past') {
        // Past races: 30, 20, 10 days ago
        pastCount++;
        daysOffset = pastCount === 1 ? -30 : pastCount === 2 ? -20 : -10;
      } else if (race.raceStatus === 'next') {
        // Next race: 3 days from now
        daysOffset = 3;
      } else {
        // Future races: 7, 14, 21, 30+ days from now
        futureCount++;
        daysOffset = futureCount === 1 ? 7 : futureCount === 2 ? 14 : futureCount === 3 ? 21 : 30;
      }
      
      return {
        ...race,
        date: getDemoDate(daysOffset),
      };
    });
    // getDemoDate is a stable module-scope helper; runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Sort races chronologically (past first, then future) and find NOW point
  const sortedRaces = useMemo(() => {
    const sorted = [...demoRacesWithDates].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return dateA.getTime() - dateB.getTime();
    });
    return sorted;
  }, [demoRacesWithDates]);
  
  // Find the next race (first future race)
  const nextRace = useMemo(() => {
    return sortedRaces.find(race => {
      const raceDate = new Date(`${race.date}T${race.startTime}`);
      return raceDate > DEMO_NOW;
    });
    // DEMO_NOW is a module-scope constant; never changes between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRaces]);
  
  // Find NOW index (between last past and first future)
  // NOW bar should appear BEFORE the first future race
  // Expected: Between "Wednesday Evening Series Race 3" (2025-01-15) and "RHKYC Around the Island Race" (2025-02-28)
  const nowIndex = useMemo(() => {
    // Find the first race that is in the future (date > DEMO_NOW)
    for (let i = 0; i < sortedRaces.length; i++) {
      const raceDate = new Date(`${sortedRaces[i].date}T${sortedRaces[i].startTime}`);
      if (raceDate > DEMO_NOW) {
        // NOW bar goes BEFORE this race (at index i)
        return i;
      }
    }
    // If all races are in the past, put NOW bar at the end
    return sortedRaces.length;
    // DEMO_NOW is a module-scope constant; never changes between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRaces]);
  
  // Set initial selected race to next race
  useEffect(() => {
    if (!selectedRaceId && nextRace) {
      setSelectedRaceId(nextRace.id);
    } else if (!selectedRaceId && sortedRaces.length > 0) {
      setSelectedRaceId(sortedRaces[0].id);
    }
  }, [nextRace, sortedRaces, selectedRaceId]);

  // Default dimensions based on mode
  const defaultWidth = mode === 'fullscreen' ? '100%' : mode === 'desktop' ? 1200 : 296;
  const defaultHeight = mode === 'fullscreen' || mode === 'desktop' ? undefined : 616;
  const finalWidth = screenWidth || (mode === 'fullscreen' ? '100%' : defaultWidth);
  const finalHeight = screenHeight || defaultHeight;

  // For phone mode, calculate scale factor
  // Ensure finalWidth is a number for calculations
  const widthForCalc = typeof finalWidth === 'number' ? finalWidth : ORIGINAL_WIDTH;
  const scaleX = mode === 'phone' ? widthForCalc / ORIGINAL_WIDTH : 1;
  const scaleY = mode === 'phone' && finalHeight && typeof finalHeight === 'number' ? finalHeight / ORIGINAL_HEIGHT : 1;
  const scale = mode === 'phone' ? Math.min(scaleX, scaleY) : 1;
  const scaledWidth = mode === 'phone' ? ORIGINAL_WIDTH * scale : finalWidth;
  const scaledHeight = mode === 'phone' && finalHeight ? ORIGINAL_HEIGHT * scale : undefined;

  // Viewport detection for performance
  useEffect(() => {
    if (Platform.OS !== 'web') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      // @ts-ignore - web only
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Inject CSS to hide scrollbar on tab bar (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const styleId = 'tab-bar-scrollbar-hide';
    if (document.getElementById(styleId)) return; // Already injected

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Hide scrollbar on tab bar */
      [data-tab-bar]::-webkit-scrollbar {
        display: none;
      }
      [data-tab-bar] {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Auto-reset logic
  useEffect(() => {
    if (!autoReset || !isVisible) return;

    resetTimeoutRef.current = setTimeout(() => {
      setKey((prev) => prev + 1);
      setSelectedRaceId(DEMO_RACES[0]?.id || null);
    }, resetDelay);

    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, [autoReset, resetDelay, isVisible, key]);

  const selectedRace = sortedRaces.find((r) => r.id === selectedRaceId) || sortedRaces[0];
  
  // Determine if selected race is past or future
  const isSelectedRacePast = selectedRace ? selectedRace.raceStatus === 'past' : false;
  
  // Race card dimensions (match RaceCard component)
  // RACE_CARD_WIDTH is now defined above as a responsive useMemo value
  const RACE_CARD_TOTAL_WIDTH = RACE_CARD_WIDTH + 16; // width + margin
  
  // Auto-scroll to center on NOW bar (next race) - set initial position immediately to prevent flash
  // Wait for containerWidth to be measured on web for accurate centering
  useEffect(() => {
    const hasValidWidth = Platform.OS === 'web' ? containerWidth > 0 : true;
    if (!hasAutoCentered.current && raceCardsScrollViewRef.current && sortedRaces.length > 0 && nextRace && isVisible && hasValidWidth) {
      const nextRaceIndex = sortedRaces.findIndex(race => race.id === nextRace.id);
      if (nextRaceIndex !== -1) {
        const scrollX = nextRaceIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;

        // Use double requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (Platform.OS === 'web') {
              // @ts-ignore - web only
              const element = raceCardsScrollViewRef.current as any;
              // Try multiple ways to access the DOM element on web
              const domElement = element?._component || element?.getScrollableNode?.() || element;
              if (domElement && typeof domElement.scrollLeft !== 'undefined') {
                // Set scroll position directly on DOM element (no animation)
                domElement.scrollLeft = Math.max(0, scrollX);
                hasAutoCentered.current = true;
                setIsScrollPositionSet(true); // Mark as set - show the cards
              }
            } else {
              // On native, use immediate scroll without animation
              if (raceCardsScrollViewRef.current) {
                raceCardsScrollViewRef.current.scrollTo({
                  x: Math.max(0, scrollX),
                  y: 0,
                  animated: false, // No animation to prevent flash
                });
                hasAutoCentered.current = true;
                setIsScrollPositionSet(true); // Mark as set - show the cards
              }
            }
          });
        });
      }
    }
  }, [nextRace, sortedRaces, SCREEN_WIDTH, nowIndex, RACE_CARD_TOTAL_WIDTH, RACE_CARD_WIDTH, isVisible, containerWidth]);

  // Fallback: Show race cards after a delay even if scroll position isn't set
  // This ensures cards are always visible, even if auto-scroll logic fails
  useEffect(() => {
    if (isScrollPositionSet) return; // Already set, no need for fallback
    
    const fallbackTimeout = setTimeout(() => {
      setIsScrollPositionSet(true);
    }, 500); // Show after 500ms delay
    
    return () => clearTimeout(fallbackTimeout);
  }, [isScrollPositionSet]);

  // Handle highlighted race ID from feature card clicks - scroll to race card
  useEffect(() => {
    if (!highlightedRaceId) return;
    
    const targetRace = sortedRaces.find(race => race.id === highlightedRaceId);
    if (!targetRace || !raceCardsScrollViewRef.current) return;
    
    const raceIndex = sortedRaces.findIndex(race => race.id === highlightedRaceId);
    if (raceIndex === -1) return;
    
    // Calculate scroll position to center the race card
    const scrollX = raceIndex * RACE_CARD_TOTAL_WIDTH - (SCREEN_WIDTH || 0) / 2 + RACE_CARD_WIDTH / 2;
    
    // Scroll to the race card
    if (Platform.OS === 'web') {
      // @ts-ignore - web only
      const element = raceCardsScrollViewRef.current as any;
      // Try multiple ways to access the DOM element on web
      const domElement = element?._component || element?.getScrollableNode?.() || element;
      if (domElement && typeof domElement.scrollTo === 'function') {
        domElement.scrollTo({
          left: Math.max(0, scrollX),
          behavior: 'smooth',
        });
      }
    } else {
      raceCardsScrollViewRef.current.scrollTo({
        x: Math.max(0, scrollX),
        y: 0,
        animated: true,
      });
    }
    
    // Also set internal highlighted state
    setHighlightedRaceCard(highlightedRaceId);
    setSelectedRaceId(highlightedRaceId);
    
    // Auto-clear highlight after 3 seconds
    const clearTimer = setTimeout(() => {
      setHighlightedRaceCard(null);
    }, 3000);
    
    return () => clearTimeout(clearTimer);
  }, [highlightedRaceId, sortedRaces, RACE_CARD_TOTAL_WIDTH, RACE_CARD_WIDTH, SCREEN_WIDTH]);

  // Handle feature highlighting - scroll to relevant section
  useEffect(() => {
    if (!highlightedFeature) return;

    const scrollToFeature = (ref: React.RefObject<View | null>, delay: number = 0) => {
        setTimeout(() => {
        if (ref.current && detailsScrollViewRef.current) {
          // @ts-ignore - web only
          if (Platform.OS === 'web' && ref.current.scrollIntoView) {
            // @ts-ignore
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (detailsScrollViewRef.current) {
            // For native, measure and scroll
            ref.current.measureLayout(
              // @ts-ignore
              detailsScrollViewRef.current,
              (_x, y, _width, _height) => {
                detailsScrollViewRef.current?.scrollTo({
                  y: Math.max(0, y - 20),
                  animated: true,
                });
              },
              () => {}
            );
          }
        }
      }, delay);
    };

    switch (highlightedFeature) {
      case 'race-planning':
        // Highlight the next race card (most prominent)
        if (nextRace) {
          setHighlightedRaceCard(nextRace.id);
          setSelectedRaceId(nextRace.id);
          
          // Scroll to race cards to ensure visibility
          if (raceCardsScrollViewRef.current) {
            const nextRaceIndex = sortedRaces.findIndex(race => race.id === nextRace.id);
            if (nextRaceIndex !== -1) {
              const scrollX = nextRaceIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;
            raceCardsScrollViewRef.current.scrollTo({
              x: Math.max(0, scrollX),
              y: 0,
              animated: true,
            });
            }
          }
          
          // Scroll race cards section into view
          if (Platform.OS === 'web' && raceCardHighlightRef.current) {
            setTimeout(() => {
              // @ts-ignore - web only
              if (raceCardHighlightRef.current?.scrollIntoView) {
                // @ts-ignore
                raceCardHighlightRef.current.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                });
              }
            }, 300);
          }
        }
        scrollToFeature(racePlanningRef, 100);
        break;
      case 'race-day-conditions':
        scrollToFeature(conditionsRef, 100);
        break;
      case 'ai-strategy':
        scrollToFeature(aiStrategyRef, 100);
        break;
      case 'ai-rig-tuning':
        scrollToFeature(rigTuningRef, 100);
        break;
      case 'gps-tracking':
        // Find a past race (to the left of NOW bar) to highlight
        const pastRaces = sortedRaces.filter(race => race.raceStatus === 'past');
        if (pastRaces.length > 0) {
          // Use the most recent past race (closest to NOW bar)
          const mostRecentPastRace = pastRaces[pastRaces.length - 1];
          setHighlightedRaceCard(mostRecentPastRace.id);
          setSelectedRaceId(mostRecentPastRace.id);

          // Scroll to race cards to ensure visibility
          if (raceCardsScrollViewRef.current) {
            const raceIndex = sortedRaces.findIndex(race => race.id === mostRecentPastRace.id);
            if (raceIndex !== -1) {
              const scrollX = raceIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;
              raceCardsScrollViewRef.current.scrollTo({
                x: Math.max(0, scrollX),
                y: 0,
                animated: true,
              });
            }
          }

          // Scroll race cards section into view, then scroll to GPS section
          if (Platform.OS === 'web' && raceCardHighlightRef.current) {
            setTimeout(() => {
              // @ts-ignore - web only
              if (raceCardHighlightRef.current?.scrollIntoView) {
                // @ts-ignore
                raceCardHighlightRef.current.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center'
                });
              }
              // Then scroll to GPS section - wait for element to appear
              const waitForGPSSection = (attempts = 0) => {
                if (Platform.OS === 'web') {
                  const gpsSection = document.getElementById('gps-tracking-section');
                  if (gpsSection) {
                    gpsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else if (attempts < 10) {
                    // Element not ready yet, try again after a short delay
                    setTimeout(() => waitForGPSSection(attempts + 1), 100);
                  } else {
                    scrollToSection('gps-tracking-section');
                  }
                } else {
                  scrollToSection('gps-tracking-section');
                }
              };
              setTimeout(() => waitForGPSSection(), 300);
            }, 300);
          } else {
            // For native, scroll to GPS section
            setTimeout(() => {
              scrollToSection('gps-tracking-section');
            }, 500);
          }
        }
        break;
      case 'post-race-analysis':
        scrollToFeature(postRaceRef, 100);
        break;
      case 'real-coaches':
        // Switch to Coaches tab and scroll to coach feedback
        setActiveTab('coaches');
        setTimeout(() => {
          scrollToSection('coach-feedback-section');
        }, 100);
        break;
      case 'venue-intelligence':
        scrollToFeature(venueIntelligenceRef, 100);
        break;
      case 'fleet-sharing':
        scrollToFeature(fleetSharingRef, 100);
        break;
      case 'learning-academy':
        scrollToFeature(learningAcademyRef, 100);
        break;
      case 'yacht-club-integration':
        scrollToFeature(yachtClubRef, 100);
        break;
    }

    if (onFeatureHighlighted) {
      onFeatureHighlighted(highlightedFeature);
    }
    // RACE_CARD_TOTAL_WIDTH / RACE_CARD_WIDTH derive from constants that don't change per render; scrollToSection is a stable callback reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedFeature, sortedRaces, nextRace, SCREEN_WIDTH, onFeatureHighlighted]);

  // Clear race card highlight when feature changes away from race-planning or gps-tracking
  useEffect(() => {
    if (highlightedFeature !== 'race-planning' && highlightedFeature !== 'gps-tracking') {
      setHighlightedRaceCard(null);
    }
  }, [highlightedFeature]);

  // Scroll to section helper function
  const scrollToSection = useCallback((sectionId: string) => {
    if (Platform.OS === 'web') {
      const element = document.getElementById(sectionId);
      if (element && detailsScrollViewRef.current) {
        // @ts-ignore - web only
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (detailsScrollViewRef.current) {
      // For native, find the ref and scroll
      const refs: { [key: string]: React.RefObject<View | null> } = {
        'coach-feedback-section': coachesRef,
        'venue-intelligence-section': venueIntelligenceRef,
        'rig-tuning-section': rigTuningRef,
        'gps-tracking-section': gpsTrackingRef,
        'post-race-section': postRaceRef,
      };
      const ref = refs[sectionId];
      if (ref?.current) {
        ref.current.measureLayout(
          // @ts-ignore
          detailsScrollViewRef.current,
          (_x, y, _width, _height) => {
            detailsScrollViewRef.current?.scrollTo({
              y: Math.max(0, y - 20),
              animated: true,
            });
          },
          () => {}
        );
      }
    }
  }, []);

  // Handle tab clicks
  const handleTabClick = useCallback((tab: 'races' | 'learn' | 'courses' | 'boats' | 'venues' | 'more' | 'coaches' | 'fleet' | 'clubs') => {
    setShowMoreMenu(false); // Close more menu when any tab is clicked
    
    switch(tab) {
      case 'races':
        setActiveTab('races');
        // Scroll to top of race details
        if (detailsScrollViewRef.current) {
          detailsScrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
        break;
      case 'learn':
        setActiveTab('learn');
        // Navigate to Racing Academy section (below demo) - handled by parent
        if (Platform.OS === 'web') {
          const academySection = document.getElementById('racing-academy-section');
          if (academySection) {
            academySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        break;
      case 'courses':
        setActiveTab('courses');
        // Show GPS tracks / course maps
        setTimeout(() => scrollToSection('gps-tracking-section'), 100);
        break;
      case 'boats':
        setActiveTab('boats');
        setTimeout(() => scrollToSection('rig-tuning-section'), 100);
        break;
      case 'venues':
        setActiveTab('venues');
        setTimeout(() => scrollToSection('venue-intelligence-section'), 100);
        break;
      case 'more':
        setActiveTab('more');
        setShowMoreMenu(true);
        break;
      case 'coaches':
        setActiveTab('races'); // Stay on races tab
        setTimeout(() => scrollToSection('coach-feedback-section'), 100);
        break;
      case 'fleet':
        setActiveTab('races');
        setTimeout(() => scrollToSection('fleet-sharing-section'), 100);
        break;
      case 'clubs':
        setActiveTab('races');
        setTimeout(() => scrollToSection('yacht-club-section'), 100);
        break;
    }
  }, [scrollToSection]);

  // Inject CSS animations for highlighting effects (web only)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'embedded-races-demo-animations';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes raceCardPulse {
            0%, 100% {
              box-shadow: 0 0 20px rgba(62, 146, 204, 0.4), 0 0 40px rgba(62, 146, 204, 0.2);
            }
            50% {
              box-shadow: 0 0 30px rgba(62, 146, 204, 0.8), 0 0 60px rgba(62, 146, 204, 0.4);
            }
          }
          @keyframes pointerBounce {
            0%, 100% {
              transform: translateY(-50%) translateX(0);
            }
            50% {
              transform: translateY(-50%) translateX(-8px);
            }
          }
          @keyframes calloutFadeIn {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
          .race-card-highlighted {
            animation: raceCardPulse 2s ease-in-out infinite !important;
          }
          .highlight-pointer-animated {
            animation: pointerBounce 1s ease-in-out infinite !important;
          }
          .callout-animated {
            animation: calloutFadeIn 0.3s ease-in !important;
          }
        `;
        document.head.appendChild(style);
      }
      return () => {
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, []);
  
  // Center selected race when selection changes
  useEffect(() => {
    if (!selectedRaceId || !raceCardsScrollViewRef.current || sortedRaces.length === 0) {
      return;
    }
    
    const selectedIndex = sortedRaces.findIndex(race => race.id === selectedRaceId);
    if (selectedIndex === -1) return;
    
    const scrollX = selectedIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;
    raceCardsScrollViewRef.current.scrollTo({
      x: Math.max(0, scrollX),
      y: 0,
      animated: true,
    });
  }, [selectedRaceId, sortedRaces, SCREEN_WIDTH, RACE_CARD_TOTAL_WIDTH, RACE_CARD_WIDTH]);

  // Handle arrow button clicks - scroll race cards
  const scrollRaceCards = useCallback((direction: 'left' | 'right') => {
    if (!raceCardsScrollViewRef.current) return;
    
    const scrollAmount = 400; // px to scroll
    
    if (Platform.OS === 'web') {
      // @ts-ignore - web only
      const element = raceCardsScrollViewRef.current as any;
      const currentScroll = element.scrollLeft || scrollX;
      const newScroll = direction === 'left' 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount;
      
      element.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
    } else {
      // Native
      const currentScroll = scrollX;
      const newScroll = direction === 'left' 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount;
      
      raceCardsScrollViewRef.current.scrollTo({
        x: newScroll,
        y: 0,
        animated: true,
      });
    }
  }, [scrollX]);

  const handleScrollLeft = useCallback(() => {
    scrollRaceCards('left');
  }, [scrollRaceCards]);

  const handleScrollRight = useCallback(() => {
    scrollRaceCards('right');
  }, [scrollRaceCards]);

  if (!isVisible) {
    return (
      <View
        ref={containerRef}
        style={[
          styles.container as any,
          mode === 'desktop' && (styles.containerDesktop as any),
          {
            width: finalWidth,
            height: finalHeight,
          },
        ]}
      >
        <View style={[styles.placeholder as any, { width: scaledWidth, height: scaledHeight }]} />
      </View>
    );
  }

  // Fullscreen, Desktop, or Mobile-native mode: full width, scrollable content
  if (effectiveMode === 'fullscreen' || effectiveMode === 'desktop' || effectiveMode === 'mobile-native') {
    const content = (
      <View 
        style={[
          styles.screenDesktop as any,
          Platform.OS === 'web' && {
            // CRITICAL: Force width to match parent - prevent expansion beyond container
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            // Ensure it doesn't expand beyond parent bounds
            alignSelf: 'stretch',
            // Force width constraint - override any flex behavior
            flexBasis: 'auto',
            flexGrow: 0, // Don't grow beyond parent
            flexShrink: 1, // Allow shrinking if needed
            // Prevent content from expanding container
            contain: 'layout style', // CSS containment
            // Hard width constraint
            boxSizing: 'border-box',
          },
        ]} 
        key={key}
        ref={(ref) => {
          if (Platform.OS === 'web' && ref) {
            // @ts-ignore - web only
            const element = ref as any;
            setTimeout(() => {
              if (element && element.style) {
                const parent = element.parentElement;
                const parentWidth = parent?.clientWidth;
                if (parentWidth) {
                  // CRITICAL: Force width constraint via direct DOM manipulation
                  element.style.maxWidth = `${parentWidth}px`;
                  element.style.width = `${parentWidth}px`;
                  element.style.overflow = 'hidden';
                  element.style.boxSizing = 'border-box';
                  element.style.contain = 'layout style';
                  
                  // Also constrain all children
                  const children = Array.from(element.children);
                  children.forEach((child: any) => {
                    if (child && child.style) {
                      child.style.maxWidth = `${parentWidth}px`;
                      child.style.width = '100%';
                      child.style.overflow = 'hidden';
                      child.style.boxSizing = 'border-box';
                    }
                  });
                }
              }
            }, 0);
          }
        }}
      >
        {/* CRITICAL: Wrapper to constrain ScrollView width - prevent expansion */}
        <View
          ref={(ref) => {
            if (Platform.OS === 'web' && ref) {
              // @ts-ignore - web only
              const element = ref as any;
              setTimeout(() => {
                if (element && element.style) {
                  // CRITICAL: Force width constraint via direct DOM manipulation
                  element.style.maxWidth = '100%';
                  element.style.overflow = 'hidden';
                  element.style.width = '100%';
                  element.style.boxSizing = 'border-box';
                  element.style.contain = 'layout style';
                }
              }, 0);
            }
          }}
          style={[
            Platform.OS === 'web' ? {
              width: '100%',
              maxWidth: '100%', // CRITICAL: Must match parent width
              minWidth: 0,
              flex: 1,
              overflow: 'hidden', // CRITICAL: Hide overflow to prevent expansion
              boxSizing: 'border-box',
              // Force width constraint - prevent expansion
              contain: 'layout style', // Use both layout and style containment
              isolation: 'isolate',
              // CRITICAL: Prevent any expansion beyond parent
              flexGrow: 0,
              flexShrink: 1,
              flexBasis: 'auto',
              alignSelf: 'stretch', // Stretch to parent but don't exceed
            } : { flex: 1 },
            // CRITICAL: Add explicit style object to ensure it's applied
            Platform.OS === 'web' && {
              // Force these styles to be applied
              maxWidth: '100%',
              overflow: 'hidden',
            } as any,
          ]}
        >
          <ScrollView
            style={[
              styles.mainScrollView as any,
              Platform.OS === 'web' && {
                // CRITICAL: Constrain ScrollView width to parent - prevent expansion
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                // Only add bottom padding if tabs are shown
                paddingBottom: showTabs ? 72 : 0,
                boxSizing: 'border-box',
                // Prevent horizontal expansion
                overflowX: 'hidden',
                overflowY: 'auto',
                // Force width constraint
                flex: 'none', // Don't use flex - use explicit width
              },
            ]}
            contentContainerStyle={[
              styles.mainScrollContent as any,
              Platform.OS === 'web' && {
                // Ensure content container doesn't expand beyond ScrollView
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                // Only add bottom padding if tabs are shown
                paddingBottom: showTabs ? 80 : 0,
              },
            ]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
          {/* Header - Conditionally hide if hideHeader prop is true */}
          {!hideHeader && (
            <>
              <View style={[styles.header as any, styles.headerDesktop as any]}>
                <View style={styles.headerTop as any}>
                  <Text style={styles.headerTitle as any}>Races</Text>
                  <View style={styles.headerRight as any}>
                    <View style={styles.headerBadge as any}>
                      <Text style={styles.headerBadgeText as any}>DEMO MODE</Text>
                    </View>
                  </View>
                </View>
                
                {/* Venue Display - Like real app */}
                <View style={styles.venueDisplay as any}>
                  <Ionicons name="location" size={12} color="#FFFFFF" />
                  <Text style={styles.venueDisplayText as any}>Royal Hong Kong Yacht Club</Text>
                </View>
              </View>
              
              {/* Add Race Button - Disabled in demo */}
              <View style={styles.addRaceButtonContainer as any}>
                <TouchableOpacity 
                  style={[styles.addRaceButton as any, styles.addRaceButtonDisabled as any]}
                  disabled={true}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#9CA3AF" />
                  <Text style={styles.addRaceButtonText as any}>Add Race</Text>
                </TouchableOpacity>
                <Text style={styles.addRaceHint as any}>Sign up to add races</Text>
              </View>
            </>
          )}

          {/* Race Cards Showcase Section - PROMINENT */}
          <View
            style={[
              styles.raceCardsSection as any,
              Platform.OS === 'web' && !isScrollPositionSet && {
                opacity: 0, // Hide until scroll position is set
              },
              Platform.OS === 'web' && isScrollPositionSet && {
                opacity: 1,
                transition: 'opacity 0.1s ease-in', // Smooth fade in (web only)
              },
            ] as any}
            ref={raceCardHighlightRef}
          >
            {/* Section Intro Header - Only show in fullscreen mode */}
            {mode === 'fullscreen' && (
              <View style={styles.sectionIntro as any}>
                <Text style={styles.sectionLabel as any}>LIVE DEMO</Text>
                <Text style={styles.sectionTitle as any}>Your Race Timeline</Text>
                <Text style={styles.sectionSubtitle as any}>
                  Explore past performance and upcoming races • Scroll to see details
                </Text>
              </View>
            )}

            <View style={styles.raceCardsHeader as any}>
              <View>
                <Text style={styles.raceCardsTitle as any}>All Races</Text>
                <Text style={styles.raceCardsSubtitle as any}>Swipe to view all races chronologically</Text>
              </View>
              <View style={styles.raceCountBadge as any}>
                <Text style={styles.raceCountText as any}>{sortedRaces.length} races</Text>
              </View>
            </View>
            <View
              style={[styles.raceCardsScrollContainer as any, { position: 'relative' }] as any}
              onLayout={(event) => {
                // Measure container width for accurate centering calculations
                const { width } = event.nativeEvent.layout;
                if (width > 0 && width !== containerWidth) {
                  setContainerWidth(width);
                }
              }}
            >
              {/* Left Arrow Button - Always visible */}
                <TouchableOpacity
                style={[
                  styles.scrollButton as any,
                  styles.scrollButtonLeft as any,
                  !canScrollLeft && scrollX <= 0 && (styles.scrollButtonDisabled as any)
                ] as any}
                  onPress={handleScrollLeft}
                  activeOpacity={0.7}
                disabled={!canScrollLeft && scrollX <= 0}
              >
                <Ionicons 
                  name="chevron-back-circle" 
                  size={40} 
                  color={(!canScrollLeft && scrollX <= 0) ? "#CBD5E1" : "#3E92CC"} 
                />
                </TouchableOpacity>
              
              <ScrollView
                ref={(ref) => {
                  raceCardsScrollViewRef.current = ref;
                  // On web, ensure the ScrollView element is scrollable and set initial position immediately
                  if (Platform.OS === 'web' && ref && !hasAutoCentered.current && sortedRaces.length > 0 && nextRace) {
                    requestAnimationFrame(() => {
                      // @ts-ignore - web only
                      const element = ref as any;
                      // Try multiple ways to access the DOM element on web
                      const domElement = element?._component || element?.getScrollableNode?.() || element;
                      if (domElement && typeof domElement.scrollLeft !== 'undefined') {
                        // Ensure overflow is set for scrolling if style property exists
                        if (domElement.style) {
                          domElement.style.overflowX = 'auto';
                          domElement.style.overflowY = 'hidden';
                        }

                        // Set initial scroll position immediately to prevent flash
                        if (!hasAutoCentered.current && sortedRaces.length > 0 && nextRace) {
                          const nextRaceIndex = sortedRaces.findIndex(race => race.id === nextRace.id);
                          if (nextRaceIndex !== -1) {
                            const scrollX = nextRaceIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;
                            domElement.scrollLeft = Math.max(0, scrollX);
                            hasAutoCentered.current = true;
                            setIsScrollPositionSet(true); // Mark as set - show the cards
                          }
                        }
                      }
                    });
                  }
                }}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                style={styles.raceCardsScrollView as any}
                contentContainerStyle={[
                  styles.raceCardsContent as any,
                  mode === 'desktop' && (styles.raceCardsContentDesktop as any),
                  Platform.OS === 'web' && {
                    // FIXED: Use flexbox to size content naturally instead of explicit width
                    // This prevents the content from expanding parent containers
                    flexShrink: 0,
                    flexGrow: 0,
                  },
                ] as any}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const contentWidth = event.nativeEvent.contentLayout?.width || event.nativeEvent.contentSize?.width || 0;
                  const layoutWidth = event.nativeEvent.layoutMeasurement.width;
                  
                  const newCanScrollLeft = offsetX > 10;
                  const newCanScrollRight = offsetX < contentWidth - layoutWidth - 10;
                  
                  setScrollX(offsetX);
                  setCanScrollLeft(newCanScrollLeft);
                  setCanScrollRight(newCanScrollRight);
                }}
                onContentSizeChange={(contentWidth) => {
                  setScrollContentWidth(contentWidth);
                  // Update scroll state based on content vs viewport
                  const shouldScrollRight = contentWidth > (SCREEN_WIDTH || 0);
                  setCanScrollRight(shouldScrollRight);
                }}
                onScrollBeginDrag={() => {
                  // Ensure scroll buttons update when user starts scrolling
                }}
                scrollEventThrottle={16}
                nestedScrollEnabled={true}
                bounces={false}
                decelerationRate="fast"
                snapToInterval={RACE_CARD_TOTAL_WIDTH} // Match card width + margin
                snapToAlignment="center"
                disableIntervalMomentum={true}
                alwaysBounceHorizontal={false}
                scrollEnabled={true}
                removeClippedSubviews={false}
              >
                {/* Render past races first */}
                {sortedRaces.slice(0, nowIndex).map((race: typeof DEMO_RACES[0], _index: number) => {
                  const isPast = race.raceStatus === 'past';
                  const isNext = race.raceStatus === 'next' || race.id === nextRace?.id;
                  const isHighlighted = (highlightedRaceCard === race.id) || (highlightedRaceId === race.id);
                  
                  return (
                    <View key={race.id} style={styles.raceCardContainer}>
                      {/* Highlight Pointer - Left side */}
                      {isHighlighted && (
                        <View style={styles.highlightPointer}>
                          <Ionicons name="arrow-forward" size={24} color="#3E92CC" />
                        </View>
                      )}
                      
                      {/* Highlight Label - Top */}
                      {isHighlighted && (
                        <View style={styles.highlightLabel}>
                          <Text style={styles.highlightLabelText}>
                            {highlightedFeature === 'gps-tracking' ? 'Track this race' : 'Plan this race'}
                          </Text>
                        </View>
                      )}
                      
                    <Pressable
                      onPress={() => setSelectedRaceId(race.id)}
                      style={({ pressed }) => [
                        styles.raceCardWrapper,
                        selectedRaceId === race.id && styles.raceCardWrapperSelected,
                        isPast && styles.raceCardWrapperPast,
                        isNext && styles.raceCardWrapperNext,
                        pressed && styles.raceCardWrapperPressed,
                          isHighlighted && styles.raceCardWrapperHighlighted,
                        mode === 'fullscreen' && styles.raceCardWrapperFullscreen,
                      ]}
                    >
                      <RaceCard
                        id={race.id}
                        name={race.name}
                        venue={race.venue}
                        date={race.date}
                        startTime={race.startTime}
                        courseName={race.courseName}
                        wind={race.wind}
                        tide={race.tide}
                        weatherStatus="available"
                        isMock={race.isMock}
                        raceStatus={race.raceStatus}
                        isSelected={selectedRaceId === race.id}
                        onSelect={() => setSelectedRaceId(race.id)}
                        isDimmed={selectedRaceId !== null && selectedRaceId !== race.id && !isNext}
                        results={race.results}
                        isPrimary={isNext}
                        showTimelineIndicator={false}
                        cardWidth={RACE_CARD_WIDTH}
                      />
                    </Pressable>
                      
                      {/* Callout Tooltip - Bottom */}
                      {isHighlighted && (
                        <View 
                          style={styles.callout}
                          // @ts-ignore - web only
                          {...(Platform.OS === 'web' ? { className: 'callout-animated' } : {})}
                        >
                          <View style={styles.calloutArrow} />
                          <Text style={styles.calloutText}>
                            {highlightedFeature === 'gps-tracking' 
                              ? 'Track your race in real-time with GPS. Record your position, speed, and course throughout the race for post-race analysis and improvement.'
                              : 'Plan your races with comprehensive tools for course setup, timing, crew management, and logistics. Create detailed race plans with all the information you need for success.'
                            }
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                
                {/* NOW Bar Indicator - Single instance between past and future */}
                {nowIndex < sortedRaces.length && (
                  <View style={styles.nowBarWrapper}>
                    <View style={styles.nowBarLine} />
                    <View style={styles.nowBarBadge}>
                      <Text style={styles.nowBarText}>NOW</Text>
                    </View>
                  </View>
                )}

                {/* Add Race Card - Right after NOW bar */}
                <View style={[styles.addRaceCardWrapper, { width: RACE_CARD_WIDTH }]}>
                  <View style={styles.addRaceCard}>
                    {/* Card content */}
                    <View style={styles.addRaceContent}>
                      <Text style={styles.raceTimelineLabel}>RACE TIMELINE</Text>
                      <Text style={styles.addRaceTitle}>Add your next race</Text>
                      <Text style={styles.addRaceDescription}>
                        Drop NOR / SI files, draw a racing box, and unlock tactical overlays instantly.
                      </Text>

                      {/* Feature Links */}
                      <View style={styles.featureLinks}>
                        <TouchableOpacity style={styles.featureLink} disabled={true}>
                          <Text style={styles.featureLinkText}>Auto-plan docs</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.featureLink} disabled={true}>
                          <Text style={styles.featureLinkText}>Draw race area</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.featureLink} disabled={true}>
                          <Text style={styles.featureLinkText}>Share with crew</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.addRaceCardActions}>
                        <TouchableOpacity
                          style={[styles.addRaceButton, styles.addRaceCardButtonDisabled]}
                          disabled={true}
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                          <Text style={styles.addRaceButtonText}>Add race</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.importCalendarButton, styles.addRaceCardButtonDisabled]}
                          disabled={true}
                        >
                          <Ionicons name="calendar-outline" size={16} color="#10B981" />
                          <Text style={styles.importCalendarText}>Import calendar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Render future races */}
                {sortedRaces.slice(nowIndex).map((race: typeof DEMO_RACES[0], _index: number) => {
                  const isPast = race.raceStatus === 'past';
                  const isNext = race.raceStatus === 'next' || race.id === nextRace?.id;
                  const isHighlighted = (highlightedRaceCard === race.id) || (highlightedRaceId === race.id);
                  
                  return (
                    <View key={race.id} style={styles.raceCardContainer}>
                      {/* Highlight Pointer - Left side */}
                      {isHighlighted && (
                        <View 
                          style={styles.highlightPointer}
                          // @ts-ignore - web only
                          {...(Platform.OS === 'web' ? { className: 'highlight-pointer-animated' } : {})}
                        >
                          <Ionicons name="arrow-forward" size={24} color="#3E92CC" />
                        </View>
                      )}
                      
                      {/* Highlight Label - Top */}
                      {isHighlighted && (
                        <View style={styles.highlightLabel}>
                          <Text style={styles.highlightLabelText}>
                            {highlightedFeature === 'gps-tracking' ? 'Track this race' : 'Plan this race'}
                          </Text>
                        </View>
                      )}
                      
                    <Pressable
                        onPress={() => {
                          setSelectedRaceId(race.id);
                          // If past race, scroll to GPS section
                          if (isPast && Platform.OS === 'web') {
                            setTimeout(() => {
                              scrollToSection('gps-tracking-section');
                            }, 300);
                          }
                        }}
                      style={({ pressed }) => [
                        styles.raceCardWrapper,
                        selectedRaceId === race.id && styles.raceCardWrapperSelected,
                        isPast && styles.raceCardWrapperPast,
                        isNext && styles.raceCardWrapperNext,
                        pressed && styles.raceCardWrapperPressed,
                          isHighlighted && styles.raceCardWrapperHighlighted,
                      ]}
                        // @ts-ignore - web only
                        {...(Platform.OS === 'web' && isHighlighted ? { className: 'race-card-highlighted' } : {})}
                    >
                      <RaceCard
                        id={race.id}
                        name={race.name}
                        venue={race.venue}
                        date={race.date}
                        startTime={race.startTime}
                        courseName={race.courseName}
                        wind={race.wind}
                        tide={race.tide}
                        weatherStatus="available"
                        isMock={race.isMock}
                        raceStatus={race.raceStatus}
                        isSelected={selectedRaceId === race.id}
                          onSelect={() => {
                            setSelectedRaceId(race.id);
                            if (isPast && Platform.OS === 'web') {
                              setTimeout(() => {
                                scrollToSection('gps-tracking-section');
                              }, 300);
                            }
                          }}
                        isDimmed={selectedRaceId !== null && selectedRaceId !== race.id && !isNext}
                        results={race.results}
                        isPrimary={isNext}
                        showTimelineIndicator={false}
                        cardWidth={RACE_CARD_WIDTH}
                      />
                    </Pressable>
                      
                      {/* Callout Tooltip - Bottom */}
                      {isHighlighted && (
                        <View 
                          style={styles.callout}
                          // @ts-ignore - web only
                          {...(Platform.OS === 'web' ? { className: 'callout-animated' } : {})}
                        >
                          <View style={styles.calloutArrow} />
                          <Text style={styles.calloutText}>
                            {highlightedFeature === 'gps-tracking' 
                              ? 'Track your race in real-time with GPS. Record your position, speed, and course throughout the race for post-race analysis and improvement.'
                              : 'Plan your races with comprehensive tools for course setup, timing, crew management, and logistics. Create detailed race plans with all the information you need for success.'
                            }
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              
              {/* Right Arrow Button - Always visible */}
                <TouchableOpacity
                style={[
                  styles.scrollButton, 
                  styles.scrollButtonRight,
                  !canScrollRight && styles.scrollButtonDisabled
                ]}
                  onPress={handleScrollRight}
                  activeOpacity={0.7}
                  disabled={!canScrollRight}
                >
                  <Ionicons 
                  name="chevron-forward-circle" 
                  size={40} 
                  color={!canScrollRight ? "#CBD5E1" : "#3E92CC"} 
                  />
                </TouchableOpacity>
              
              </View>
            
            {/* Scroll Hint */}
            {mode === 'fullscreen' && (
              <View style={styles.scrollHint}>
                <Ionicons name="arrow-back" size={16} color="#9CA3AF" />
                <Text style={styles.scrollHintText}>Swipe to explore</Text>
                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
              </View>
            )}
          </View>

          {/* Selected Race Details - Using Real RaceConditionsCard */}
          {selectedRace && (
            <ScrollView
              ref={detailsScrollViewRef}
              style={[
              styles.detailsContainer,
              mode === 'desktop' && styles.detailsContainerDesktop,
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* Race Planning - Race Cards Section */}
              <View ref={racePlanningRef} style={[
                styles.section,
                highlightedFeature === 'race-planning' && styles.sectionHighlighted,
              ]}>
                {/* Race cards are shown above in horizontal scroll */}
              </View>

              {/* Race Conditions - Using Real Component with Mock Data */}
              <View 
                ref={conditionsRef} 
                style={[
                  styles.section,
                  highlightedFeature === 'race-day-conditions' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'conditions-section' } : {})}
              >
                <RaceConditionsCard
                  raceId={selectedRace.id}
                  raceTime={`${selectedRace.date}T${selectedRace.startTime}`}
                  venue={{
                    id: 'demo-venue',
                    name: selectedRace.venue,
                    coordinates: {
                      latitude: 22.3193, // Hong Kong coordinates as default
                      longitude: 114.1694,
                    },
                    region: 'asia-pacific',
                    country: 'Hong Kong',
                  }}
                  savedWind={selectedRace.wind}
                  savedTide={selectedRace.tide}
                  savedWeatherFetchedAt={new Date().toISOString()}
                  raceStatus={selectedRace.raceStatus}
                  warningSignalTime={selectedRace.startTime}
                  expectedDurationMinutes={90}
                />
              </View>

              {/* Rig Tuning / Boat Setup Section */}
              <View 
                ref={rigTuningRef} 
                style={[
                  styles.section,
                  highlightedFeature === 'ai-rig-tuning' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'rig-tuning-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="settings-outline" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Rig Setup Recommendations</Text>
                </View>
                <View style={styles.rigTuningCard}>
                  <Text style={styles.conditionsLabel}>
                    For {selectedRace.wind?.speedMin}-{selectedRace.wind?.speedMax} kts {selectedRace.wind?.direction} conditions:
                  </Text>
                  
                  <View style={styles.tuningList}>
                    <View style={styles.tuningItem}>
                      <Text style={styles.tuningLabel}>Main:</Text>
                      <Text style={styles.tuningValue}>Medium tension, traveler up 2"</Text>
                    </View>
                    <View style={styles.tuningItem}>
                      <Text style={styles.tuningLabel}>Jib:</Text>
                      <Text style={styles.tuningValue}>Standard luff tension</Text>
                    </View>
                    <View style={styles.tuningItem}>
                      <Text style={styles.tuningLabel}>Backstay:</Text>
                      <Text style={styles.tuningValue}>3/4 tension</Text>
                    </View>
                    <View style={styles.tuningItem}>
                      <Text style={styles.tuningLabel}>Outhaul:</Text>
                      <Text style={styles.tuningValue}>2" from black band</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* AI Strategy Section */}
              <View 
                ref={aiStrategyRef} 
                style={[
                  styles.section,
                  highlightedFeature === 'ai-strategy' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'ai-strategy-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Strategy</Text>
                  <View style={styles.upgradeBadge}>
                    <Text style={styles.upgradeBadgeText}>Pro</Text>
                  </View>
                </View>
                <View style={styles.strategyCard}>
                  <Text style={styles.strategyTitle}>Pre-Race Plan</Text>
                  <Text style={styles.strategyText}>
                    Start line bias favors pin end. Expect {selectedRace.wind?.speedMin}-{selectedRace.wind?.speedMax} kts {selectedRace.wind?.direction} breeze with {selectedRace.tide?.state || 'building'} tide. 
                    Positioning at the pin will be critical for a strong start.
                  </Text>
                  <View style={styles.strategyFeatures}>
                    <View style={styles.strategyFeature}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.strategyFeatureText}>Wind shift analysis</Text>
                    </View>
                    <View style={styles.strategyFeature}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.strategyFeatureText}>Tide calculations</Text>
                    </View>
                    <View style={styles.strategyFeature}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.strategyFeatureText}>Fleet positioning</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Venue Intelligence */}
              <View 
                ref={venueIntelligenceRef}
                style={[
                  styles.section,
                  highlightedFeature === 'venue-intelligence' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'venue-intelligence-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="location" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Venue Intelligence</Text>
                </View>
                <View style={styles.venueCard}>
                  <Text style={styles.venueTitle}>{selectedRace.venue}</Text>
                  <Text style={styles.venueText}>
                    Historical wind patterns show {selectedRace.wind?.direction} winds are common in March. 
                    The racing line typically favors the left side of the course due to geographic effects. 
                    Community-contributed data from 50+ races at this venue.
                  </Text>
                  <View style={styles.venueStats}>
                    <View style={styles.venueStat}>
                      <Text style={styles.venueStatValue}>50+</Text>
                      <Text style={styles.venueStatLabel}>Races</Text>
                    </View>
                    <View style={styles.venueStat}>
                      <Text style={styles.venueStatValue}>12</Text>
                      <Text style={styles.venueStatLabel}>Contributors</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Fleet Sharing Strategies Section */}
              <View 
                ref={fleetSharingRef} 
                style={[
                  styles.section,
                  highlightedFeature === 'fleet-sharing' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'fleet-sharing-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="share-social-outline" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Fleet Sharing Strategies</Text>
                </View>
                
                {/* Strategy Card 1 */}
                <View style={styles.strategyCard}>
                  <View style={styles.strategyHeader}>
                    <View style={styles.strategyAuthor}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitials}>SC</Text>
                      </View>
                      <View>
                        <Text style={styles.authorName}>Sarah Chen</Text>
                        <Text style={styles.timeAgo}>2 hours ago</Text>
                      </View>
                    </View>
                    <View style={styles.strategyBadge}>
                      <Ionicons name="trophy" size={12} color="#F59E0B" />
                      <Text style={styles.badgeText}>Winner</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.strategyTitle}>Pin End Start Strategy</Text>
                  <Text style={styles.strategyText}>
                    Line bias is 5° to pin. Position at pin end 30 seconds before gun. Accelerate on gun and tack on first header.
                  </Text>
                  
                  <View style={styles.strategyMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="eye-outline" size={14} color="#6B7280" />
                      <Text style={styles.metaText}>12 views</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.metaText}>3 used</Text>
                    </View>
                  </View>
                </View>
                
                {/* Strategy Card 2 */}
                <View style={styles.strategyCard}>
                  <View style={styles.strategyHeader}>
                    <View style={styles.strategyAuthor}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitials}>MW</Text>
                      </View>
                      <View>
                        <Text style={styles.authorName}>Mike Wong</Text>
                        <Text style={styles.timeAgo}>1 day ago</Text>
                      </View>
                    </View>
                  </View>
                  
                  <Text style={styles.strategyTitle}>Downwind Layline Approach</Text>
                  <Text style={styles.strategyText}>
                    Stay high on run to avoid traffic. Gybe 3 boat lengths before layline. Build speed before rounding.
                  </Text>
                  
                  <View style={styles.strategyMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="eye-outline" size={14} color="#6B7280" />
                      <Text style={styles.metaText}>8 views</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.metaText}>5 used</Text>
                    </View>
                  </View>
                </View>
                
                {/* Your Shared Strategy */}
                <View style={styles.yourStrategiesSection}>
                  <Text style={styles.subsectionTitle}>Your Shared Strategy</Text>
                  <View style={styles.yourStrategyItem}>
                    <Text style={styles.yourStrategyTitle}>Conservative Start at Committee Boat</Text>
                    <View style={styles.yourStrategyStats}>
                      <Text style={styles.statText}>
                        <Ionicons name="people" size={12} /> 6 members used
                      </Text>
                      <Text style={styles.statText}>
                        <Ionicons name="eye" size={12} /> 15 views
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Learning Academy Section */}
              <View ref={learningAcademyRef} style={[
                styles.section,
                highlightedFeature === 'learning-academy' && styles.sectionHighlighted,
              ]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="school-outline" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Learning Academy</Text>
                </View>
                
                {/* Progress Badge */}
                <View style={styles.progressBadge}>
                  <Text style={styles.progressBadgeText}>3 of 12 modules completed</Text>
                </View>
                
                {/* Module 1 - In Progress */}
                <View style={styles.moduleCard}>
                  <View style={[styles.moduleIconContainer, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="flag" size={24} color="#3E92CC" />
                  </View>
                  
                  <Text style={styles.moduleTitle}>Start Line Tactics</Text>
                  <Text style={styles.moduleDescription}>
                    Master the start with line bias analysis, timing, and positioning strategies
                  </Text>
                  
                  <View style={styles.moduleProgressSection}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBarFill, { width: '60%' }]} />
                    </View>
                    <Text style={styles.progressText}>3 of 5 lessons</Text>
                  </View>
                  
                  <TouchableOpacity style={styles.continueButton}>
                    <Text style={styles.continueButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Module 2 - Completed */}
                <View style={styles.moduleCard}>
                  <View style={[styles.moduleIconContainer, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="trending-up" size={24} color="#10B981" />
                  </View>
                  
                  <Text style={styles.moduleTitle}>Upwind Strategy</Text>
                  <Text style={styles.moduleDescription}>
                    Optimize upwind performance with wind shifts, VMG, and tactical positioning
                  </Text>
                  
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.completedText}>Completed</Text>
                  </View>
                  
                  <TouchableOpacity style={styles.reviewButton}>
                    <Text style={styles.reviewButtonText}>Review</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Recommended */}
                <View style={styles.recommendedSection}>
                  <View style={styles.recommendedHeader}>
                    <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
                    <Text style={styles.recommendedTitle}>Recommended</Text>
                  </View>
                  <Text style={styles.recommendedText}>
                    Based on your performance, try "Tacking in Light Air" to improve upwind efficiency.
                  </Text>
                </View>
              </View>

              {/* Yacht Club Integration Section */}
              <View ref={yachtClubRef} style={[
                styles.section,
                highlightedFeature === 'yacht-club-integration' && styles.sectionHighlighted,
              ]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="business-outline" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Yacht Club Integration</Text>
                </View>
                
                {/* Connected Club Card */}
                <View style={styles.connectedClubCard}>
                  <View style={styles.clubHeader}>
                    <View style={styles.clubLogoContainer}>
                      <Ionicons name="flag" size={24} color="#3E92CC" />
                    </View>
                    <View style={styles.clubInfo}>
                      <Text style={styles.clubName}>Royal Hong Kong Yacht Club</Text>
                      <Text style={styles.clubMemberSince}>Member since 2018 • Dragon Fleet</Text>
                    </View>
                    <View style={styles.connectedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.connectedText}>Connected</Text>
                    </View>
                  </View>
                </View>
                
                {/* Upcoming Event */}
                <View style={styles.eventCard}>
                  <View style={styles.eventDateBadge}>
                    <Text style={styles.eventMonth}>JAN</Text>
                    <Text style={styles.eventDay}>15</Text>
                  </View>
                  
                  <View style={styles.eventDetails}>
                    <Text style={styles.eventTitle}>Dragon Class Spring Championship</Text>
                    <View style={styles.eventMeta}>
                      <View style={styles.eventMetaItem}>
                        <Ionicons name="time-outline" size={12} color="#6B7280" />
                        <Text style={styles.eventMetaText}>3-day series</Text>
                      </View>
                      <View style={styles.eventMetaItem}>
                        <Ionicons name="boat-outline" size={12} color="#6B7280" />
                        <Text style={styles.eventMetaText}>45 boats</Text>
                      </View>
                    </View>
                  </View>
                  
                  <TouchableOpacity style={styles.registerButton}>
                    <Text style={styles.registerButtonText}>Register</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Leaderboard Preview */}
                <View style={styles.leaderboardSection}>
                  <Text style={styles.subsectionTitle}>Season Leaderboard</Text>
                  
                  <View style={styles.leaderboardList}>
                    <View style={styles.leaderboardItem}>
                      <Text style={styles.rank}>🥇</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>Sarah Chen</Text>
                        <Text style={styles.boatName}>Dragon d42</Text>
                      </View>
                      <Text style={styles.points}>156 pts</Text>
                    </View>
                    
                    <View style={styles.leaderboardItem}>
                      <Text style={styles.rank}>🥈</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>Mike Wong</Text>
                        <Text style={styles.boatName}>Dragon d38</Text>
                      </View>
                      <Text style={styles.points}>142 pts</Text>
                    </View>
                    
                    <View style={[styles.leaderboardItem, styles.leaderboardItemYou]}>
                      <Text style={styles.rank}>3</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>You</Text>
                        <Text style={styles.boatName}>Dragon d59</Text>
                      </View>
                      <Text style={styles.points}>138 pts</Text>
                    </View>
                  </View>
                </View>
                
                {/* Quick Actions */}
                <View style={styles.quickActionsGrid}>
                  <TouchableOpacity style={styles.quickActionCard}>
                    <Ionicons name="calendar-outline" size={20} color="#3E92CC" />
                    <Text style={styles.quickActionText}>Schedule</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.quickActionCard}>
                    <Ionicons name="people-outline" size={20} color="#3E92CC" />
                    <Text style={styles.quickActionText}>Members</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.quickActionCard}>
                    <Ionicons name="document-text-outline" size={20} color="#3E92CC" />
                    <Text style={styles.quickActionText}>Resources</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Race Timeline */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="time-outline" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Race Timeline</Text>
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTime}>13:55</Text>
                      <Text style={styles.timelineEvent}>Warning Signal</Text>
                    </View>
                  </View>
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTime}>13:56</Text>
                      <Text style={styles.timelineEvent}>Preparatory Signal</Text>
                    </View>
                  </View>
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTime}>13:59</Text>
                      <Text style={styles.timelineEvent}>Prep Down</Text>
                    </View>
                  </View>
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, styles.timelineDotActive]} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTime}>14:00</Text>
                      <Text style={[styles.timelineEvent, styles.timelineEventActive]}>Start</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* GPS Track - Enhanced with realistic course and wind arrows */}
              <View 
                ref={gpsTrackingRef}
                style={[
                  styles.section,
                  highlightedFeature === 'gps-tracking' && styles.sectionHighlighted,
                ]}
                // @ts-ignore - web only
                {...(Platform.OS === 'web' ? { id: 'gps-tracking-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="analytics-outline" size={24} color="#1976D2" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Race Track Statistics & Analysis</Text>
                    <Text style={styles.sectionSubtitle}>Wednesday Evening Series Race 3 • 2 Laps • Dragon Class</Text>
                  </View>
                </View>
                
                {/* Quick Stats Cards */}
                <View style={styles.quickStatsGrid}>
                  <View style={styles.quickStatCard}>
                    <Ionicons name="flag-outline" size={32} color="#4CAF50" />
                    <Text style={styles.quickStatValue}>3rd / 12</Text>
                    <Text style={styles.quickStatLabel}>Final Position</Text>
                  </View>
                  
                  <View style={styles.quickStatCard}>
                    <Ionicons name="time-outline" size={32} color="#2196F3" />
                    <Text style={styles.quickStatValue}>1:18:23</Text>
                    <Text style={styles.quickStatLabel}>Total Time</Text>
                  </View>
                  
                  <View style={styles.quickStatCard}>
                    <Ionicons name="speedometer-outline" size={32} color="#FF9800" />
                    <Text style={styles.quickStatValue}>6.4 kts</Text>
                    <Text style={styles.quickStatLabel}>Avg Speed</Text>
                  </View>
                  
                  <View style={styles.quickStatCard}>
                    <Ionicons name="resize-outline" size={32} color="#9C27B0" />
                    <Text style={styles.quickStatValue}>4.2 nm</Text>
                    <Text style={styles.quickStatLabel}>Distance</Text>
                  </View>
                </View>
                
                {/* Lap Breakdown Table */}
                <View style={styles.lapBreakdownSection}>
                  <Text style={styles.subsectionTitle}>Lap-by-Lap Breakdown</Text>
                  
                  <View style={styles.lapTable}>
                    {/* Table Header */}
                    <View style={styles.lapTableHeader}>
                      <Text style={styles.lapTableHeaderCell}>Lap</Text>
                      <Text style={styles.lapTableHeaderCell}>Time</Text>
                      <Text style={styles.lapTableHeaderCell}>Split</Text>
                      <Text style={styles.lapTableHeaderCell}>Avg Speed</Text>
                      <Text style={styles.lapTableHeaderCell}>Position</Text>
                      <Text style={styles.lapTableHeaderCell}>Gain/Loss</Text>
                    </View>
                    
                    {/* Lap 1 */}
                    <View style={styles.lapTableRow}>
                      <Text style={styles.lapTableCell}>1</Text>
                      <Text style={styles.lapTableCell}>39:12</Text>
                      <Text style={styles.lapTableCell}>-</Text>
                      <Text style={styles.lapTableCell}>6.5 kts</Text>
                      <Text style={styles.lapTableCell}>4th</Text>
                      <View style={styles.lapTableCell}>
                        <Ionicons name="arrow-down" size={14} color="#F44336" />
                        <Text style={[styles.gainLoss, { color: '#F44336' }]}> -1</Text>
                      </View>
                    </View>
                    
                    {/* Lap 2 */}
                    <View style={styles.lapTableRow}>
                      <Text style={styles.lapTableCell}>2</Text>
                      <Text style={styles.lapTableCell}>39:11</Text>
                      <Text style={[styles.lapTableCell, styles.fasterSplit]}>-0:01</Text>
                      <Text style={styles.lapTableCell}>6.4 kts</Text>
                      <Text style={styles.lapTableCell}>3rd</Text>
                      <View style={styles.lapTableCell}>
                        <Ionicons name="arrow-up" size={14} color="#4CAF50" />
                        <Text style={[styles.gainLoss, { color: '#4CAF50' }]}> +1</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                {/* Leg Performance */}
                <View style={styles.legPerformanceSection}>
                  <Text style={styles.subsectionTitle}>Performance by Leg</Text>
                  
                  <View style={styles.legsGrid}>
                    {/* Upwind Performance */}
                    <View style={styles.legCard}>
                      <View style={styles.legCardHeader}>
                        <Ionicons name="trending-up-outline" size={24} color="#2196F3" />
                        <Text style={styles.legCardTitle}>Upwind (Beat)</Text>
                      </View>
                      
                      <View style={styles.legStats}>
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Avg VMG</Text>
                          <Text style={styles.legStatValue}>5.2 kts</Text>
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankBadgeText}>3rd in fleet</Text>
                          </View>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Avg Speed</Text>
                          <Text style={styles.legStatValue}>6.1 kts</Text>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Tacks</Text>
                          <Text style={styles.legStatValue}>12 total</Text>
                          <Text style={styles.legStatDetail}>6 per lap avg</Text>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Tack Loss</Text>
                          <Text style={[styles.legStatValue, styles.negativeValue]}>2.3 boat lengths</Text>
                          <View style={styles.warningBadge}>
                            <Text style={styles.warningBadgeText}>Below avg</Text>
                          </View>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Time on Port</Text>
                          <Text style={styles.legStatValue}>52%</Text>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Time on Starboard</Text>
                          <Text style={styles.legStatValue}>48%</Text>
                        </View>
                      </View>
                    </View>
                    
                    {/* Downwind Performance */}
                    <View style={styles.legCard}>
                      <View style={styles.legCardHeader}>
                        <Ionicons name="trending-down-outline" size={24} color="#FF9800" />
                        <Text style={styles.legCardTitle}>Downwind (Run)</Text>
                      </View>
                      
                      <View style={styles.legStats}>
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Avg VMG</Text>
                          <Text style={styles.legStatValue}>6.8 kts</Text>
                          <View style={[styles.rankBadge, styles.goodRank]}>
                            <Text style={styles.rankBadgeText}>2nd in fleet</Text>
                          </View>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Avg Speed</Text>
                          <Text style={styles.legStatValue}>7.2 kts</Text>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Gybes</Text>
                          <Text style={styles.legStatValue}>2 total</Text>
                          <Text style={styles.legStatDetail}>1 per lap</Text>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Gybe Loss</Text>
                          <Text style={[styles.legStatValue, styles.positiveValue]}>0.8 boat lengths</Text>
                          <View style={styles.goodBadge}>
                            <Text style={styles.goodBadgeText}>Above avg</Text>
                          </View>
                        </View>
                        
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Sailing Angle</Text>
                          <Text style={styles.legStatValue}>155° TWA</Text>
                  </View>
                  
                        <View style={styles.legStatRow}>
                          <Text style={styles.legStatLabel}>Max Speed</Text>
                          <Text style={styles.legStatValue}>8.7 kts</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                    </View>
                    
                {/* Mark Roundings */}
                <View style={styles.markRoundingsSection}>
                  <Text style={styles.subsectionTitle}>Mark Rounding Analysis</Text>
                  
                  <View style={styles.roundingsGrid}>
                    {/* Windward Mark */}
                    <View style={styles.roundingCard}>
                      <View style={styles.roundingHeader}>
                        <View style={styles.markIcon}>
                          <Ionicons name="flag" size={20} color="#FF9800" />
                        </View>
                        <Text style={styles.roundingTitle}>Windward Mark</Text>
                    </View>
                    
                      <View style={styles.roundingStats}>
                        <View style={styles.roundingStat}>
                          <Text style={styles.roundingLabel}>Avg Time</Text>
                          <Text style={styles.roundingValue}>4.2 sec</Text>
                    </View>
                    
                        <View style={styles.roundingStat}>
                          <Text style={styles.roundingLabel}>Best Lap</Text>
                          <Text style={styles.roundingValue}>3.8 sec (Lap 2)</Text>
                    </View>
                    
                        <View style={styles.roundingStat}>
                          <Text style={styles.roundingLabel}>Fleet Rank</Text>
                          <Text style={styles.roundingValue}>5th</Text>
                        </View>
                    </View>
                    
                      <View style={styles.roundingNote}>
                        <Ionicons name="information-circle-outline" size={16} color="#2196F3" />
                        <Text style={styles.roundingNoteText}>Good speed maintained, slight overshoot on Lap 1</Text>
                    </View>
                  </View>
                  
                    {/* Leeward Mark */}
                    <View style={styles.roundingCard}>
                      <View style={styles.roundingHeader}>
                        <View style={styles.markIcon}>
                          <Ionicons name="flag" size={20} color="#FF9800" />
                        </View>
                        <Text style={styles.roundingTitle}>Leeward Mark</Text>
                      </View>
                      
                      <View style={styles.roundingStats}>
                        <View style={styles.roundingStat}>
                          <Text style={styles.roundingLabel}>Avg Time</Text>
                          <Text style={styles.roundingValue}>5.1 sec</Text>
                        </View>
                        
                        <View style={styles.roundingStat}>
                          <Text style={styles.roundingLabel}>Best Lap</Text>
                          <Text style={styles.roundingValue}>4.6 sec (Lap 2)</Text>
                        </View>
                        
                        <View style={styles.roundingStat}>
                          <Text style={styles.roundingLabel}>Fleet Rank</Text>
                          <Text style={styles.roundingValue}>7th</Text>
                        </View>
                      </View>
                      
                      <View style={[styles.roundingNote, styles.warningNote]}>
                        <Ionicons name="warning-outline" size={16} color="#FF9800" />
                        <Text style={styles.roundingNoteText}>Wide rounding on Lap 1, lost 2 positions</Text>
                        </View>
                    </View>
                        </View>
                      </View>
                      
                {/* Speed Distribution */}
                <View style={styles.speedDistributionSection}>
                  <Text style={styles.subsectionTitle}>Speed Distribution</Text>
                  
                  <View style={styles.speedBars}>
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>0-3 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '5%', backgroundColor: '#EF5350' }]} />
                        </View>
                      <Text style={styles.speedPercent}>5%</Text>
                        </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>3-5 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '18%', backgroundColor: '#FF9800' }]} />
                      </View>
                      <Text style={styles.speedPercent}>18%</Text>
                    </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>5-7 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '52%', backgroundColor: '#4CAF50' }]} />
                  </View>
                      <Text style={styles.speedPercent}>52%</Text>
                    </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>7-9 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '22%', backgroundColor: '#2196F3' }]} />
                      </View>
                      <Text style={styles.speedPercent}>22%</Text>
                    </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>9+ kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '3%', backgroundColor: '#9C27B0' }]} />
                      </View>
                      <Text style={styles.speedPercent}>3%</Text>
                    </View>
                  </View>
                </View>
                
                {/* Fleet Comparison */}
                <View style={styles.fleetComparisonSection}>
                  <Text style={styles.subsectionTitle}>Fleet Comparison (GPS Tracked Boats)</Text>
                  
                  <View style={styles.comparisonTable}>
                    {/* Header */}
                    <View style={styles.comparisonHeader}>
                      <Text style={styles.comparisonHeaderCell}>Pos</Text>
                      <Text style={styles.comparisonHeaderCell}>Boat</Text>
                      <Text style={styles.comparisonHeaderCell}>Time</Text>
                      <Text style={styles.comparisonHeaderCell}>Δ Leader</Text>
                      <Text style={styles.comparisonHeaderCell}>Avg Speed</Text>
                      <Text style={styles.comparisonHeaderCell}>VMG ↑</Text>
                    </View>
                    
                    {/* 1st Place */}
                    <View style={styles.comparisonRow}>
                      <Text style={styles.positionCell}>🥇 1</Text>
                      <Text style={styles.boatCell}>d42 • Sarah Chen</Text>
                      <Text style={styles.timeCell}>1:15:23</Text>
                      <Text style={styles.deltaCell}>-</Text>
                      <Text style={styles.speedCell}>6.7 kts</Text>
                      <Text style={styles.vmgCell}>5.5 kts</Text>
                    </View>
                    
                    {/* 2nd Place */}
                    <View style={styles.comparisonRow}>
                      <Text style={styles.positionCell}>🥈 2</Text>
                      <Text style={styles.boatCell}>d38 • Mike Wong</Text>
                      <Text style={styles.timeCell}>1:16:45</Text>
                      <Text style={styles.deltaCell}>+1:22</Text>
                      <Text style={styles.speedCell}>6.5 kts</Text>
                      <Text style={styles.vmgCell}>5.4 kts</Text>
                    </View>
                    
                    {/* You - 3rd Place */}
                    <View style={[styles.comparisonRow, styles.yourRow]}>
                      <Text style={styles.positionCell}>🥉 3</Text>
                      <Text style={[styles.boatCell, styles.yourBoat]}>d59 • You</Text>
                      <Text style={styles.timeCell}>1:18:23</Text>
                      <Text style={styles.deltaCell}>+3:00</Text>
                      <Text style={styles.speedCell}>6.4 kts</Text>
                      <Text style={styles.vmgCell}>5.2 kts</Text>
                    </View>
                    
                    {/* 4th-8th (Condensed) */}
                    <View style={styles.comparisonRow}>
                      <Text style={styles.positionCell}>4-8</Text>
                      <Text style={styles.boatCell}>5 other boats</Text>
                      <Text style={[styles.timeCell, styles.mutedText]}>No GPS data</Text>
                      <Text style={styles.deltaCell}>-</Text>
                      <Text style={styles.speedCell}>-</Text>
                      <Text style={styles.vmgCell}>-</Text>
                    </View>
                  </View>
                </View>
                
                {/* Key Insights */}
                <View style={styles.keyInsightsSection}>
                  <Text style={styles.subsectionTitle}>Key Performance Insights</Text>
                  
                  <View style={styles.insightsList}>
                    <View style={styles.insightItemGood}>
                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Strong Downwind Performance</Text>
                        <Text style={styles.insightText}>2nd best downwind VMG in fleet at 6.8 kts. Excellent boat handling on runs.</Text>
                      </View>
                    </View>
                    
                    <View style={styles.insightItemGood}>
                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Consistent Lap Times</Text>
                        <Text style={styles.insightText}>Lap 2 was 1 second faster than Lap 1, showing good stamina and learning.</Text>
                      </View>
                    </View>
                    
                    <View style={styles.insightItemWarning}>
                      <Ionicons name="alert-circle-outline" size={24} color="#FF9800" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Tacking Efficiency Needs Work</Text>
                        <Text style={styles.insightText}>Losing 2.3 boat lengths per tack vs fleet avg of 1.8. Focus on smoother tacks in practice.</Text>
                      </View>
                    </View>
                    
                    <View style={styles.insightItemWarning}>
                      <Ionicons name="alert-circle-outline" size={24} color="#FF9800" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Leeward Mark Roundings</Text>
                        <Text style={styles.insightText}>7th in fleet for leeward roundings. Work on approaching mark tighter and maintaining speed through turn.</Text>
                      </View>
                    </View>
                    
                    <View style={styles.insightItemBad}>
                      <Ionicons name="close-circle" size={24} color="#F44336" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Lost Positions Mid-Race</Text>
                        <Text style={styles.insightText}>Dropped from 3rd to 4th in Lap 1 due to wide leeward rounding. Regained in Lap 2.</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                {/* Training Recommendations */}
                <View style={styles.trainingSection}>
                  <Text style={styles.subsectionTitle}>Recommended Training Focus</Text>
                  
                  <View style={styles.trainingCards}>
                    <View style={styles.trainingCard}>
                      <View style={styles.trainingIconCircle}>
                        <Ionicons name="git-branch-outline" size={24} color="#2196F3" />
                      </View>
                      <Text style={styles.trainingTitle}>Tacking Drills</Text>
                      <Text style={styles.trainingDescription}>Practice 20-30 tacks focusing on smooth helm movement and crew timing</Text>
                      <View style={styles.trainingPriority}>
                        <Text style={styles.priorityLabel}>Priority: High</Text>
                      </View>
                    </View>
                    
                    <View style={styles.trainingCard}>
                      <View style={styles.trainingIconCircle}>
                        <Ionicons name="flag-outline" size={24} color="#FF9800" />
                      </View>
                      <Text style={styles.trainingTitle}>Mark Roundings</Text>
                      <Text style={styles.trainingDescription}>Set up practice marks and work on tight, fast roundings maintaining boat speed</Text>
                      <View style={styles.trainingPriority}>
                        <Text style={styles.priorityLabel}>Priority: High</Text>
                      </View>
                    </View>
                    
                    <View style={styles.trainingCard}>
                      <View style={styles.trainingIconCircle}>
                        <Ionicons name="speedometer-outline" size={24} color="#4CAF50" />
                      </View>
                      <Text style={styles.trainingTitle}>Upwind Speed</Text>
                      <Text style={styles.trainingDescription}>Dial in upwind trim and VMG to match top boats in fleet</Text>
                      <View style={[styles.trainingPriority, styles.priorityMedium]}>
                        <Text style={styles.priorityLabel}>Priority: Medium</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                {/* Speed Distribution */}
                <View style={styles.speedDistributionSection}>
                  <Text style={styles.subsectionTitle}>Speed Distribution</Text>
                  
                  <View style={styles.speedBars}>
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>0-3 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '5%', backgroundColor: '#EF5350' }]} />
                      </View>
                      <Text style={styles.speedPercent}>5%</Text>
                    </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>3-5 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '18%', backgroundColor: '#FF9800' }]} />
                      </View>
                      <Text style={styles.speedPercent}>18%</Text>
                    </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>5-7 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '52%', backgroundColor: '#4CAF50' }]} />
                      </View>
                      <Text style={styles.speedPercent}>52%</Text>
                    </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>7-9 kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '22%', backgroundColor: '#2196F3' }]} />
                      </View>
                      <Text style={styles.speedPercent}>22%</Text>
                    </View>
                    
                    <View style={styles.speedBarRow}>
                      <Text style={styles.speedLabel}>9+ kts</Text>
                      <View style={styles.speedBarContainer}>
                        <View style={[styles.speedBarFill, { width: '3%', backgroundColor: '#9C27B0' }]} />
                      </View>
                      <Text style={styles.speedPercent}>3%</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Post Race Analysis - Enhanced Section */}
              <View 
                style={styles.section}
                // @ts-ignore - web only
                {...(Platform.OS === 'web' ? { id: 'post-race-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="analytics" size={24} color="#8B5CF6" />
                  <Text style={styles.sectionTitle}>Post Race Analysis</Text>
                </View>
                
                <View style={styles.analysisContent}>
                  {/* Performance Summary */}
                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisHeading}>📊 Performance Summary</Text>
                    <View style={styles.summaryCard}>
                      <View style={styles.resultBadge}>
                        <Text style={styles.resultPosition}>3rd</Text>
                        <Text style={styles.resultTotal}>out of 12 boats</Text>
                      </View>
                      <Text style={styles.analysisText}>
                        Strong race execution overall. Excellent start positioning at the pin end 
                        with good recognition of line bias. Lost 2 positions on the first windward 
                        leg due to conservative layline approach and slower tack execution. 
                        Recovered well on downwind legs with good speed and tactical positioning.
                      </Text>
                    </View>
                  </View>
                  
                  {/* Key Performance Metrics */}
                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisHeading}>📈 Key Performance Metrics</Text>
                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Upwind VMG</Text>
                        <Text style={styles.metricValue}>5.2 kts</Text>
                        <Text style={styles.metricRank}>3rd in fleet</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Downwind VMG</Text>
                        <Text style={styles.metricValue}>6.8 kts</Text>
                        <Text style={styles.metricRank}>2nd in fleet</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Tack Efficiency</Text>
                        <Text style={styles.metricValue}>78%</Text>
                        <Text style={styles.metricRank}>Below average</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Mark Roundings</Text>
                        <Text style={styles.metricValue}>4.2 sec avg</Text>
                        <Text style={styles.metricRank}>Average</Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Tactical Insights */}
                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisHeading}>💡 Tactical Insights</Text>
                    
                    <View style={styles.insightGood}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Excellent Start Execution</Text>
                        <Text style={styles.insightText}>
                          Perfect timing at pin end, gained 3 boat lengths in first 30 seconds. 
                          Good acceleration and clear air.
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.insightGood}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Strong Downwind Speed</Text>
                        <Text style={styles.insightText}>
                          Consistently fast VMG, good wave riding technique. Gained 1 position on run.
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.insightWarning}>
                      <Ionicons name="warning" size={20} color="#F59E0B" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Slow Tack Execution</Text>
                        <Text style={styles.insightText}>
                          8 tacks total, losing 2-3 boat lengths per tack. Crew timing could be smoother, 
                          especially on jib release/trim.
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.insightBad}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Missed Wind Shift at Mark 2</Text>
                        <Text style={styles.insightText}>
                          Fleet lifted 10° on port tack approach. You tacked early and sailed into header, 
                          losing 2 positions. Cost approximately 30 seconds.
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Recommendations */}
                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisHeading}>✅ Recommendations for Next Race</Text>
                    
                    <View style={styles.recommendationsList}>
                      <View style={styles.recommendationItem}>
                        <Text style={styles.recommendationNumber}>1</Text>
                        <View style={styles.recommendationContent}>
                          <Text style={styles.recommendationTitle}>Practice Tacking Drills</Text>
                          <Text style={styles.recommendationText}>
                            Focus on crew coordination: earlier jib release, faster trim. 
                            Goal: reduce speed loss from 3 boat lengths to 1-1.5.
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.recommendationItem}>
                        <Text style={styles.recommendationNumber}>2</Text>
                        <View style={styles.recommendationContent}>
                          <Text style={styles.recommendationTitle}>More Aggressive Laylines</Text>
                          <Text style={styles.recommendationText}>
                            Don't overstand. Tack closer to marks to stay in pressure and avoid traffic.
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.recommendationItem}>
                        <Text style={styles.recommendationNumber}>3</Text>
                        <View style={styles.recommendationContent}>
                          <Text style={styles.recommendationTitle}>Watch for Wind Shifts</Text>
                          <Text style={styles.recommendationText}>
                            Stay more in tune with compass and fleet positioning on port tack approaches.
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.recommendationItem}>
                        <Text style={styles.recommendationNumber}>4</Text>
                        <View style={styles.recommendationContent}>
                          <Text style={styles.recommendationTitle}>Maintain Downwind Momentum</Text>
                          <Text style={styles.recommendationText}>
                            Your downwind speed was excellent - keep that technique consistent.
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Coach Feedback Section */}
              <View 
                style={styles.section}
                // @ts-ignore - web only
                {...(Platform.OS === 'web' ? { id: 'coach-feedback-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="person" size={24} color="#3E92CC" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Real Coach Feedback</Text>
                    <Text style={styles.sectionSubtitle}>Professional Analysis from Sarah Chen</Text>
                  </View>
                </View>
                
                <View style={styles.coachContent}>
                  {/* Coach profile */}
                  <View style={styles.coachProfile}>
                    <View style={styles.coachAvatar}>
                      <Ionicons name="person-circle" size={80} color="#3E92CC" />
                    </View>
                    <View style={styles.coachInfo}>
                      <Text style={styles.coachName}>Sarah Chen</Text>
                      <Text style={styles.coachCredentials}>
                        Olympic Sailing Coach • 15 years experience • 470 Class Specialist
                      </Text>
                      <View style={styles.coachBadges}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Olympic Coach</Text>
                        </View>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>World Championships</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  
                  {/* Video analysis */}
                  <View style={styles.videoAnalysisCard}>
                    <View style={styles.videoThumbnail}>
                      <Ionicons name="play-circle" size={60} color="#FFFFFF" />
                      <Text style={styles.videoLabel}>Video Review: 8:32</Text>
                    </View>
                    <Text style={styles.videoTitle}>
                      Race 3 Performance Review - Upwind Tactics
                    </Text>
                  </View>
                  
                  {/* Written feedback */}
                  <View style={styles.feedbackBlock}>
                    <Text style={styles.feedbackHeading}>Strategy Review</Text>
                    <Text style={styles.feedbackText}>
                      Your pre-race plan was solid, and I'm really pleased with how you executed the start. 
                      The pin end bias was about 5-7 degrees, and you positioned perfectly to take advantage. 
                      That's textbook execution.
                    </Text>
                    <Text style={styles.feedbackText}>
                      However, I noticed on the first beat you were sailing too conservatively. When you had 
                      clear air on starboard tack at the 4-minute mark, you should have extended further before 
                      tacking. You tacked too early and had to make 2 extra tacks to get around the mark. 
                      That's where you lost those 2 positions.
                    </Text>
                  </View>
                  
                  <View style={styles.feedbackBlock}>
                    <Text style={styles.feedbackHeading}>Technical Performance</Text>
                    <Text style={styles.feedbackText}>
                      Your boat speed was good - I saw consistent 5.2-5.4 kts upwind which is right where 
                      we want to be in those conditions. The problem is in the tacks. We're losing 2-3 boat 
                      lengths per tack, and with 8 tacks in this race, that adds up quickly.
                    </Text>
                    <Text style={styles.feedbackText}>
                      I want you to focus on smoother crew work this week. The jib release needs to happen 
                      earlier (helmsman at 45° through the wind, not at head-to-wind). And the trim needs 
                      to be faster and more decisive on the new side.
                    </Text>
                  </View>
                  
                  <View style={styles.feedbackBlock}>
                    <Text style={styles.feedbackHeading}>Next Steps</Text>
                    <Text style={styles.feedbackText}>
                      Book a session with me this week to work specifically on tacking drills. We'll also 
                      review your layline judgment - I have some exercises that will help you be more 
                      aggressive without overstanding.
                    </Text>
                  </View>
                  
                  {/* Action buttons */}
                  <View style={styles.coachActions}>
                    <TouchableOpacity style={styles.primaryButton}>
                      <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Schedule Session</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.secondaryButton}>
                      <Ionicons name="chatbubble-outline" size={20} color="#3E92CC" />
                      <Text style={styles.secondaryButtonText}>Send Message</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
          
          {/* Bottom padding for tab bar - only if tabs are shown */}
          {showTabs && <View style={styles.bottomPadding} />}
        </ScrollView>
        </View>
        {/* CRITICAL: End of wrapper View to constrain ScrollView width */}

        {/* Bottom Tab Navigation - Only show if showTabs prop is true */}
        {showTabs && (
        <View 
          style={styles.tabBarContainer}
          ref={(ref) => {
            if (Platform.OS === 'web' && ref) {
              // @ts-ignore - web only
              const element = ref as any;
              setTimeout(() => {
                if (element) {
                  // Find the demo container to match its width and position
                  const demoContainer = element.closest('[class*="demoCenter"]') || 
                                       document.querySelector('[class*="demoCenter"]');
                  if (demoContainer) {
                    const demoRect = (demoContainer as HTMLElement).getBoundingClientRect();
                    const demoWidth = demoRect.width;
                    const demoLeft = demoRect.left;
                    // Set tab bar width and position to match demo container
                    element.style.width = `${demoWidth}px`;
                    element.style.maxWidth = `${demoWidth}px`;
                    element.style.left = `${demoLeft}px`;
                    element.style.transform = 'none'; // Remove centering transform
                  } else {
                    // Fallback: center with transform
                    element.style.left = '50%';
                    element.style.transform = 'translateX(-50%)';
                  }
                }
              }, 100);
            }
          }}
        >
          <View 
            style={styles.tabBar}
            // @ts-ignore - web only
            {...(Platform.OS === 'web' ? { 'data-tab-bar': 'true' } : {})}
            ref={(ref) => {
              if (Platform.OS === 'web' && ref) {
                // @ts-ignore - web only
                const element = ref as any;
                setTimeout(() => {
                  if (element) {
                    // Find the demo container to match its width
                    const demoContainer = element.closest('[class*="demoCenter"]') || 
                                         document.querySelector('[class*="demoCenter"]');
                    if (demoContainer) {
                      const demoRect = (demoContainer as HTMLElement).getBoundingClientRect();
                      const demoWidth = demoRect.width;
                      const demoLeft = demoRect.left;
                      
                      // Constrain the tabBar container (parent)
                      const tabBarContainer = element.parentElement;
                      if (tabBarContainer) {
                        (tabBarContainer as HTMLElement).style.width = `${demoWidth}px`;
                        (tabBarContainer as HTMLElement).style.maxWidth = `${demoWidth}px`;
                        (tabBarContainer as HTMLElement).style.left = `${demoLeft}px`;
                      }
                      
                      // Constrain the tabBar itself
                      element.style.width = `${demoWidth}px`;
                      element.style.maxWidth = `${demoWidth}px`;
                    } else {
                      // Fallback: constrain to parent
                      const parent = element.parentElement;
                      if (parent) {
                        const parentWidth = parent.clientWidth || parent.offsetWidth;
                        if (parentWidth > 0) {
                          element.style.width = `${parentWidth}px`;
                          element.style.maxWidth = `${parentWidth}px`;
                        }
                      }
                    }
                    
                  }
                }, 150);
              }
            }}
          >
            {/* Races Tab */}
            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'races' && styles.tabItemActive]}
              onPress={() => handleTabClick('races')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="flag" 
                size={16} 
                color={activeTab === 'races' ? '#3E92CC' : '#6B7280'} 
              />
              <Text 
                style={[styles.tabLabel, activeTab === 'races' && styles.tabLabelActive]} 
                numberOfLines={1}
              >
                Races
              </Text>
            </TouchableOpacity>
            
            {/* More Tab - MOVED TO POSITION 2 FOR TESTING */}
            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'more' && styles.tabItemActive, styles.tabItemMore]}
              onPress={() => handleTabClick('more')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="ellipsis-horizontal" 
                size={16} 
                color={activeTab === 'more' ? '#3E92CC' : '#6B7280'} 
              />
              <Text 
                style={[styles.tabLabel, activeTab === 'more' && styles.tabLabelActive]} 
                numberOfLines={1}
              >
                More
              </Text>
            </TouchableOpacity>
            
            {/* Learn Tab */}
            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'learn' && styles.tabItemActive]}
              onPress={() => handleTabClick('learn')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="school-outline" 
                size={16} 
                color={activeTab === 'learn' ? '#3E92CC' : '#6B7280'} 
              />
              <Text 
                style={[styles.tabLabel, activeTab === 'learn' && styles.tabLabelActive]} 
                numberOfLines={1}
              >
                Learn
              </Text>
            </TouchableOpacity>
            
            {/* Courses Tab */}
            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'courses' && styles.tabItemActive]}
              onPress={() => handleTabClick('courses')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="map-outline" 
                size={16} 
                color={activeTab === 'courses' ? '#3E92CC' : '#6B7280'} 
              />
              <Text 
                style={[styles.tabLabel, activeTab === 'courses' && styles.tabLabelActive]} 
                numberOfLines={1}
              >
                Courses
              </Text>
            </TouchableOpacity>
            
            {/* Boats Tab */}
            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'boats' && styles.tabItemActive]}
              onPress={() => handleTabClick('boats')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="boat-outline" 
                size={16} 
                color={activeTab === 'boats' ? '#3E92CC' : '#6B7280'} 
              />
              <Text 
                style={[styles.tabLabel, activeTab === 'boats' && styles.tabLabelActive]} 
                numberOfLines={1}
              >
                Boats
              </Text>
            </TouchableOpacity>
            
            {/* Venues Tab */}
            <TouchableOpacity 
              style={[styles.tabItem, activeTab === 'venues' && styles.tabItemActive]}
              onPress={() => handleTabClick('venues')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="location-outline" 
                size={16} 
                color={activeTab === 'venues' ? '#3E92CC' : '#6B7280'} 
              />
              <Text 
                style={[styles.tabLabel, activeTab === 'venues' && styles.tabLabelActive]} 
                numberOfLines={1}
              >
                Venues
              </Text>
            </TouchableOpacity>
            </View>
            
            {/* More Menu Dropdown */}
            {showMoreMenu && (
              <View style={styles.moreMenu}>
                <TouchableOpacity 
                  style={styles.moreMenuItem}
                  onPress={() => handleTabClick('coaches')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={20} color="#6B7280" />
                  <Text style={styles.moreMenuItemText}>Coaches</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.moreMenuItem}
                  onPress={() => handleTabClick('fleet')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-social-outline" size={20} color="#6B7280" />
                  <Text style={styles.moreMenuItemText}>Fleet Sharing</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.moreMenuItem}
                  onPress={() => handleTabClick('clubs')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="business-outline" size={20} color="#6B7280" />
                  <Text style={styles.moreMenuItemText}>Yacht Clubs</Text>
                </TouchableOpacity>
            </View>
            )}
          </View>
        )}
      </View>
    );

    // Wrap in ScrollView for fullscreen or mobile-native mode to enable scrolling
    if ((effectiveMode === 'fullscreen' || effectiveMode === 'mobile-native') && scrollable) {
      return (
        <View
          ref={containerRef}
          style={[
            styles.container,
            styles.containerDesktop,
            styles.containerFullscreen,
          ]}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            scrollEventThrottle={16}
          >
            {content}
          </ScrollView>
        </View>
      );
    }

    // Desktop/mobile-native mode without scroll wrapper (for fixed height containers)
    return (
      <View
        ref={containerRef}
        style={[
          styles.container,
          styles.containerDesktop,
          effectiveMode === 'fullscreen' && styles.containerFullscreen,
          effectiveMode === 'mobile-native' && styles.containerMobileNative,
        ]}
      >
        {content}
      </View>
    );
  }

  // Phone mode: scaled interface
  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        {
          width: finalWidth,
          height: finalHeight,
        },
      ]}
    >
      <View
        style={[
          styles.scaleContainer,
          {
            width: ORIGINAL_WIDTH,
            height: ORIGINAL_HEIGHT,
            transform: [{ scale }],
            ...Platform.select({
              web: {
              },
            }),
          },
        ]}
      >
        <View style={styles.screen} key={key}>
          {/* Status Bar */}
          <View style={styles.statusBar}>
            <Text style={styles.statusTime}>3:58</Text>
            <View style={styles.statusIcons}>
              <Ionicons name="cellular" size={12} color="#FFF" />
              <Ionicons name="wifi" size={12} color="#FFF" style={{ marginLeft: 4 }} />
              <Ionicons name="battery-full" size={12} color="#FFF" style={{ marginLeft: 4 }} />
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Races</Text>
            <Ionicons name="add-circle-outline" size={24} color="#3E92CC" />
          </View>

          {/* Race Cards - Horizontal Scroll */}
          <View style={styles.raceCardsScrollContainer}>
            {/* Left Arrow Button - Always visible */}
              <TouchableOpacity
              style={[
                styles.scrollButton, 
                styles.scrollButtonLeft,
                !canScrollLeft && scrollX <= 0 && styles.scrollButtonDisabled
              ]}
                onPress={handleScrollLeft}
                activeOpacity={0.7}
              disabled={!canScrollLeft && scrollX <= 0}
              >
                <Ionicons 
                name="chevron-back-circle" 
                size={40} 
                color={(!canScrollLeft && scrollX <= 0) ? "#CBD5E1" : "#3E92CC"} 
                />
              </TouchableOpacity>
            
          <ScrollView
              ref={raceCardsScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.raceCardsContainer}
            contentContainerStyle={styles.raceCardsContent}
              onScroll={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const contentWidth = event.nativeEvent.contentLayout?.width || event.nativeEvent.contentSize?.width || 0;
                const layoutWidth = event.nativeEvent.layoutMeasurement.width;
                
                setScrollX(offsetX);
                setCanScrollLeft(offsetX > 10);
                setCanScrollRight(offsetX < contentWidth - layoutWidth - 10);
              }}
              onContentSizeChange={(contentWidth) => {
                setScrollContentWidth(contentWidth);
                if (contentWidth > (SCREEN_WIDTH || 0)) {
                  setCanScrollRight(true);
                }
              }}
              scrollEventThrottle={16}
          >
            {DEMO_RACES.map((race) => (
              <TouchableOpacity
                key={race.id}
                style={[
                  styles.raceCard,
                  selectedRaceId === race.id && styles.raceCardSelected,
                ]}
                onPress={() => setSelectedRaceId(race.id)}
              >
                <View style={styles.raceCardHeader}>
                  <Text style={styles.raceCardName} numberOfLines={1}>
                    {race.name}
                  </Text>
                  <View style={styles.raceCardBadge}>
                    <Text style={styles.raceCardBadgeText}>Upcoming</Text>
                  </View>
                </View>
                <Text style={styles.raceCardVenue} numberOfLines={1}>
                  {race.venue}
                </Text>
                <View style={styles.raceCardDetails}>
                  <View style={styles.raceCardDetail}>
                    <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                    <Text style={styles.raceCardDetailText}>{race.date}</Text>
                  </View>
                  <View style={styles.raceCardDetail}>
                    <Ionicons name="time-outline" size={12} color="#6B7280" />
                    <Text style={styles.raceCardDetailText}>{race.startTime}</Text>
                  </View>
                </View>
                <View style={styles.raceCardWind}>
                  <Ionicons name="flag-outline" size={12} color="#3E92CC" />
                  <Text style={styles.raceCardWindText}>
                    {race.wind ? `${race.wind.speedMin}-${race.wind.speedMax} kts ${race.wind.direction}` : 'N/A'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
            
            {/* Right Arrow Button - Always visible */}
              <TouchableOpacity
              style={[
                styles.scrollButton, 
                styles.scrollButtonRight,
                !canScrollRight && styles.scrollButtonDisabled
              ]}
                onPress={handleScrollRight}
                activeOpacity={0.7}
                disabled={!canScrollRight}
              >
                <Ionicons 
                name="chevron-forward-circle" 
                size={40} 
                color={!canScrollRight ? "#CBD5E1" : "#3E92CC"} 
                />
              </TouchableOpacity>
          </View>

          {/* Selected Race Details */}
          {selectedRace && (
            <ScrollView ref={detailsScrollViewRef} style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
              {/* Race Planning - Race Cards Section */}
              <View 
                ref={racePlanningRef} 
                style={[
                  styles.section,
                  highlightedFeature === 'race-planning' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'race-planning-section' } : {})}
              >
                {/* Race cards are shown above in horizontal scroll */}
              </View>

              {/* Race Conditions Section */}
              <View 
                ref={conditionsRef} 
                style={[
                  styles.section,
                  highlightedFeature === 'race-day-conditions' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'conditions-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="partly-sunny-outline" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Race Day Conditions</Text>
                </View>
                <View style={styles.venueCard}>
                  <Text style={styles.venueText}>
                    Wind: {selectedRace.wind ? `${selectedRace.wind.speedMin}-${selectedRace.wind.speedMax} kts ${selectedRace.wind.direction}` : 'N/A'}
                  </Text>
                  <Text style={styles.venueText}>
                    Tide: {selectedRace.tide ? `${selectedRace.tide.state}, ${selectedRace.tide.height}m` : 'N/A'}
                  </Text>
                </View>
              </View>

              {/* FUTURE RACE SECTIONS - Only show for future races */}
              {!isSelectedRacePast && (
                <>
                  {/* Rig Tuning Section */}
                  <View 
                    ref={rigTuningRef} 
                    style={[
                      styles.section,
                      highlightedFeature === 'ai-rig-tuning' && styles.sectionHighlighted,
                    ]}
                    {...(Platform.OS === 'web' ? { id: 'rig-tuning-section' } : {})}
                  >
                    <View style={styles.sectionHeader}>
                      <Ionicons name="settings-outline" size={20} color="#3E92CC" />
                      <Text style={styles.sectionTitle}>Rig Tuning</Text>
                    </View>
                    <View style={styles.venueCard}>
                      <Text style={styles.venueText}>
                        AI-powered rig tuning recommendations tailored to your boat class and current conditions.
                      </Text>
                    </View>
                  </View>

              {/* AI Strategy Section */}
                  <View 
                    ref={aiStrategyRef} 
                    style={[
                      styles.section,
                      highlightedFeature === 'ai-strategy' && styles.sectionHighlighted,
                    ]}
                    {...(Platform.OS === 'web' ? { id: 'ai-strategy-section' } : {})}
                  >
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Strategy</Text>
                </View>
                <View style={styles.strategyCard}>
                  <Text style={styles.strategyTitle}>Pre-Race Plan</Text>
                  <Text style={styles.strategyText}>
                    Start line bias favors pin end. Expect {selectedRace.wind?.speedMin}-{selectedRace.wind?.speedMax} kts {selectedRace.wind?.direction} breeze with {selectedRace.tide?.state || 'building'} tide.
                  </Text>
                  <View style={styles.strategyFeatures}>
                    <View style={styles.strategyFeature}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.strategyFeatureText}>Wind shift analysis</Text>
                    </View>
                    <View style={styles.strategyFeature}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.strategyFeatureText}>Tide calculations</Text>
                    </View>
                  </View>
                </View>
              </View>
                </>
              )}

              {/* PAST RACE SECTIONS - Only show for past races */}
              {isSelectedRacePast && (
                <>
                  {/* GPS Race Track Section */}
                  <View 
                    ref={gpsTrackingRef} 
                    style={[
                      styles.section,
                      highlightedFeature === 'gps-tracking' && styles.sectionHighlighted,
                    ]}
                    // @ts-ignore - web only
                    {...(Platform.OS === 'web' ? { id: 'gps-tracking-section' } : {})}
                  >
                    <View style={styles.sectionHeader}>
                      <Ionicons name="navigate" size={24} color="#3E92CC" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>GPS Race Track</Text>
                        {selectedRace && (
                          <Text style={styles.sectionSubtitle}>{selectedRace.name}</Text>
                        )}
                      </View>
                    </View>
                    {Platform.OS === 'web' && (
                      <Text style={{ color: '#10B981', fontSize: 10, marginBottom: 8, paddingHorizontal: 16 }}>
                        [DEBUG] GPS Section Rendered for {selectedRace?.name || 'Unknown Race'}
                      </Text>
                    )}
                    
                    {/* GPS Map Visualization */}
                    <View style={styles.gpsMapContainer}>
                      <View style={styles.raceTrack}>
                        {/* Start line */}
                        <View style={styles.startLine}>
                          <View style={styles.startLineMarker} />
                          <Text style={styles.startLineText}>START</Text>
                          <View style={styles.startLineMarker} />
                        </View>
                        
                        {/* Simplified race track path */}
                        <View style={styles.trackPathContainer}>
                          {/* Track path using View-based approach */}
                          <View style={styles.trackPath}>
                            {/* Start point */}
                            <View style={[styles.trackPoint, styles.trackPointStart]}>
                              <View style={styles.trackPointInner} />
                            </View>
                            
                            {/* Middle point */}
                            <View style={[styles.trackPoint, styles.trackPointMiddle]}>
                              <View style={styles.trackPointInner} />
                            </View>
                            
                            {/* End point */}
                            <View style={[styles.trackPoint, styles.trackPointEnd]}>
                              <View style={styles.trackPointInner} />
                            </View>
                          </View>
                          
                          {/* Connecting lines */}
                          <View style={styles.trackLine1} />
                          <View style={styles.trackLine2} />
                          <View style={styles.trackLine3} />
                        </View>
                        
                        {/* Track stats */}
                        <View style={styles.trackStats}>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Distance</Text>
                            <Text style={styles.statValue}>8.2 nm</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Avg Speed</Text>
                            <Text style={styles.statValue}>6.4 kts</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Max Speed</Text>
                            <Text style={styles.statValue}>8.7 kts</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Duration</Text>
                            <Text style={styles.statValue}>1:18:23</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Post Race Analysis Section */}
                  <View 
                    ref={postRaceRef} 
                    style={[
                      styles.section,
                      highlightedFeature === 'post-race-analysis' && styles.sectionHighlighted,
                    ]}
                    // @ts-ignore - web only
                    {...(Platform.OS === 'web' ? { id: 'post-race-section' } : {})}
                  >
                    <View style={styles.sectionHeader}>
                      <Ionicons name="analytics" size={20} color="#3E92CC" />
                      <Text style={styles.sectionTitle}>Post Race Analysis</Text>
                    </View>
                    
                    <View style={styles.analysisContent}>
                      <Text style={styles.analysisHeading}>Performance Summary</Text>
                      <Text style={styles.analysisText}>
                        {selectedRace.results ? 
                          `Finished ${selectedRace.results.position}${selectedRace.results.position === 1 ? 'st' : selectedRace.results.position === 2 ? 'nd' : selectedRace.results.position === 3 ? 'rd' : 'th'} out of ${selectedRace.results.fleetSize} boats. ` : 
                          'Finished race. '
                        }
                        Strong start execution with good positioning at the pin end. 
                        Lost ground on first beat due to conservative layline approach.
                      </Text>
                      
                      <Text style={styles.analysisHeading}>Key Insights</Text>
                      <View style={styles.insightItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.insightText}>Excellent upwind VMG: 5.2 kts average</Text>
                      </View>
                      <View style={styles.insightItem}>
                        <Ionicons name="warning" size={16} color="#F59E0B" />
                        <Text style={styles.insightText}>Tack execution cost ~3 boat lengths each</Text>
                      </View>
                      <View style={styles.insightItem}>
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                        <Text style={styles.insightText}>Missed wind shift at mark 2 (-2 positions)</Text>
                      </View>
                      
                      <Text style={styles.analysisHeading}>Recommendations for Next Race</Text>
                      <View style={styles.recommendationList}>
                        <Text style={styles.recommendationItem}>• Practice tacking drills to improve speed and reduce losses</Text>
                        <Text style={styles.recommendationItem}>• Stay closer to layline to avoid traffic at windward mark</Text>
                        <Text style={styles.recommendationItem}>• Watch for wind shifts on port tack approach to marks</Text>
                        <Text style={styles.recommendationItem}>• Consider more aggressive positioning in middle of beat</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
              
              {/* GPS Tracking Placeholder - Show for future races when GPS tracking feature is highlighted */}
              {!isSelectedRacePast && highlightedFeature === 'gps-tracking' && (
                <View ref={gpsTrackingRef} style={[
                  styles.section,
                  styles.sectionHighlighted,
                ]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="navigate-outline" size={20} color="#3E92CC" />
                    <Text style={styles.sectionTitle}>GPS Tracking</Text>
                  </View>
                  <View style={styles.venueCard}>
                    <Text style={styles.venueText}>
                      Track your race in real-time with GPS. Record your position, speed, and course throughout the race.
                      Select a past race to view GPS track data.
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Post Race Analysis Placeholder - Show for future races when post-race feature is highlighted */}
              {!isSelectedRacePast && highlightedFeature === 'post-race-analysis' && (
                <View ref={postRaceRef} style={[
                  styles.section,
                  styles.sectionHighlighted,
                ]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="analytics-outline" size={20} color="#3E92CC" />
                    <Text style={styles.sectionTitle}>Post Race Analysis</Text>
                  </View>
                  <View style={styles.venueCard}>
                    <Text style={styles.venueText}>
                      Analyze your race performance with AI-powered insights. Get detailed feedback on tactics and boat handling.
                      Select a past race to view post-race analysis.
                    </Text>
                  </View>
                </View>
              )}

              {/* Coach Feedback Section - Show when Coaches tab is active */}
              {activeTab === 'coaches' && (
                <View 
                  ref={coachesRef} 
                  style={[
                    styles.section,
                    highlightedFeature === 'real-coaches' && styles.sectionHighlighted,
                  ]}
                  // @ts-ignore - web only
                  {...(Platform.OS === 'web' ? { id: 'coach-feedback-section' } : {})}
                >
                  <View style={styles.sectionHeader}>
                    <Ionicons name="person" size={20} color="#3E92CC" />
                    <Text style={styles.sectionTitle}>Coach Feedback</Text>
                  </View>
                  
                  <View style={styles.coachCard}>
                    <View style={styles.coachAvatar}>
                      <Ionicons name="person-circle" size={64} color="#3E92CC" />
                    </View>
                    <Text style={styles.coachName}>Sarah Chen</Text>
                    <Text style={styles.coachTitle}>Olympic Coach • 15 years experience</Text>
                    
                    <View style={styles.feedbackSection}>
                      <Text style={styles.feedbackHeading}>Strategy Review</Text>
                      <Text style={styles.feedbackText}>
                        Your pre-race plan was solid - good recognition of the line bias. 
                        However, I noticed you were conservative on the first beat. 
                        Next time, consider tacking earlier to stay in the pressure.
                      </Text>
                    </View>
                    
                    <View style={styles.feedbackSection}>
                      <Text style={styles.feedbackHeading}>Performance Analysis</Text>
                      <Text style={styles.feedbackText}>
                        Upwind speed is improving! Your VMG was 5.2 kts average. 
                        Focus on smoother tacks - you're losing 2-3 boat lengths per tack. 
                        Practice tacking drills this week.
                      </Text>
                    </View>
                    
                    <TouchableOpacity style={styles.scheduleButton}>
                      <Text style={styles.scheduleButtonText}>Schedule Session</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Real Coaches Section - Default view when not on Coaches tab */}
              {activeTab !== 'coaches' && (
                <View ref={coachesRef} style={[
                  styles.section,
                  highlightedFeature === 'real-coaches' && styles.sectionHighlighted,
                ]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="people-outline" size={20} color="#3E92CC" />
                    <Text style={styles.sectionTitle}>Real Coaches</Text>
                  </View>
                  <View style={styles.venueCard}>
                    <Text style={styles.venueText}>
                      Connect with professional sailing coaches for personalized guidance. Book sessions and get expert advice.
                    </Text>
                  </View>
                </View>
              )}

              {/* Venue Intelligence */}
              <View 
                ref={venueIntelligenceRef} 
                style={[
                  styles.section,
                  highlightedFeature === 'venue-intelligence' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'venue-intelligence-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="location" size={20} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Venue Intelligence</Text>
                </View>
                <View style={styles.venueCard}>
                  <Text style={styles.venueTitle}>{selectedRace.venue}</Text>
                  <Text style={styles.venueText}>
                    Historical wind patterns, racing lines, and tactical insights for this venue.
                  </Text>
                </View>
              </View>

              {/* Fleet Sharing Strategies Section */}
              <View 
                ref={fleetSharingRef} 
                style={[
                  styles.fleetSharingSection,
                  highlightedFeature === 'fleet-sharing' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'fleet-sharing-section' } : {})}
              >
                <View>
                <View style={styles.sectionHeader}>
                    <Ionicons name="share-social-outline" size={24} color="#3E92CC" />
                  <Text style={styles.sectionTitle}>Fleet Sharing Strategies</Text>
                </View>
                  <Text style={styles.sectionSubtitle}>Collaborate with your fleet</Text>
                </View>
                
                {/* Shared Strategy Cards Grid */}
                <View style={styles.sharedStrategiesGrid}>
                  {/* Strategy Card 1 */}
                  <View style={styles.strategyCard}>
                    <View style={styles.strategyHeader}>
                      <View style={styles.strategyAuthor}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarInitials}>SC</Text>
                        </View>
                        <View>
                          <Text style={styles.authorName}>Sarah Chen</Text>
                          <Text style={styles.timeAgo}>2 hours ago</Text>
                        </View>
                      </View>
                      <View style={styles.strategyBadge}>
                        <Ionicons name="trophy" size={14} color="#F59E0B" />
                        <Text style={styles.badgeText}>Used by winners</Text>
                      </View>
                    </View>
                    
                    <Text style={styles.strategyTitle}>Pin End Start Strategy</Text>
                    <Text style={styles.strategyText}>
                      Line bias is 5° to pin. Position at pin end 30 seconds before gun. 
                      Accelerate on gun and tack on first header to cover fleet.
                  </Text>
                    
                    <View style={styles.strategyMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="eye-outline" size={16} color="#6B7280" />
                        <Text style={styles.metaText}>12 views</Text>
                </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.metaText}>3 sailors used this</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity style={styles.useStrategyButton}>
                      <Ionicons name="add-circle-outline" size={18} color="#3E92CC" />
                      <Text style={styles.useStrategyText}>Add to My Race Plan</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Strategy Card 2 */}
                  <View style={styles.strategyCard}>
                    <View style={styles.strategyHeader}>
                      <View style={styles.strategyAuthor}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarInitials}>MW</Text>
                        </View>
                        <View>
                          <Text style={styles.authorName}>Mike Wong</Text>
                          <Text style={styles.timeAgo}>1 day ago</Text>
                        </View>
                      </View>
                      <View style={styles.strategyBadge}>
                        <Ionicons name="trophy" size={14} color="#F59E0B" />
                        <Text style={styles.badgeText}>Used by winners</Text>
                      </View>
                    </View>
                    
                    <Text style={styles.strategyTitle}>Downwind Layline Approach</Text>
                    <Text style={styles.strategyText}>
                      Stay high on run to avoid traffic. Gybe 3 boat lengths before layline. 
                      Build speed before rounding leeward mark.
                    </Text>
                    
                    <View style={styles.strategyMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="eye-outline" size={16} color="#6B7280" />
                        <Text style={styles.metaText}>8 views</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.metaText}>5 sailors used this</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity style={styles.useStrategyButton}>
                      <Ionicons name="add-circle-outline" size={18} color="#3E92CC" />
                      <Text style={styles.useStrategyText}>Add to My Race Plan</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Strategy Card 3 */}
                  <View style={styles.strategyCard}>
                    <View style={styles.strategyHeader}>
                      <View style={styles.strategyAuthor}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarInitials}>TL</Text>
                        </View>
                        <View>
                          <Text style={styles.authorName}>Tom Liu</Text>
                          <Text style={styles.timeAgo}>3 days ago</Text>
                        </View>
                      </View>
                    </View>
                    
                    <Text style={styles.strategyTitle}>Windward Mark Rounding</Text>
                    <Text style={styles.strategyText}>
                      Approach on starboard tack, round wide to avoid congestion. 
                      Accelerate immediately after rounding for clean air on the run.
                    </Text>
                    
                    <View style={styles.strategyMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="eye-outline" size={16} color="#6B7280" />
                        <Text style={styles.metaText}>15 views</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.metaText}>7 sailors used this</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity style={styles.useStrategyButton}>
                      <Ionicons name="add-circle-outline" size={18} color="#3E92CC" />
                      <Text style={styles.useStrategyText}>Add to My Race Plan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Your Shared Strategies */}
                <View style={styles.yourStrategiesSection}>
                  <Text style={styles.subsectionTitle}>Your Shared Strategies</Text>
                  
                  <View style={styles.yourStrategyItem}>
                    <View style={styles.yourStrategyHeader}>
                      <Text style={styles.yourStrategyTitle}>Conservative Start at Committee Boat</Text>
                      <TouchableOpacity>
                        <Ionicons name="create-outline" size={20} color="#3E92CC" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.yourStrategyStats}>
                      <Text style={styles.statText}>
                        <Ionicons name="people" size={14} /> 6 fleet members used this
                      </Text>
                      <Text style={styles.statText}>
                        <Ionicons name="eye" size={14} /> 15 views
                      </Text>
                    </View>
                  </View>
                  
                  <View style={[styles.yourStrategyItem, { marginTop: 12 }]}>
                    <View style={styles.yourStrategyHeader}>
                      <Text style={styles.yourStrategyTitle}>Port Tack Start in Light Air</Text>
                      <TouchableOpacity>
                        <Ionicons name="create-outline" size={20} color="#3E92CC" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.yourStrategyStats}>
                      <Text style={styles.statText}>
                        <Ionicons name="people" size={14} /> 4 fleet members used this
                      </Text>
                      <Text style={styles.statText}>
                        <Ionicons name="eye" size={14} /> 9 views
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Share New Button */}
                <TouchableOpacity style={styles.shareNewButton}>
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.shareNewText}>Share New Strategy with Fleet</Text>
                </TouchableOpacity>
              </View>

              {/* Learning Academy Section */}
              <View 
                ref={learningAcademyRef} 
                style={[
                  styles.learningAcademySection,
                  highlightedFeature === 'learning-academy' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'learning-academy-section' } : {})}
              >
                <View>
                <View style={styles.sectionHeader}>
                    <Ionicons name="school-outline" size={24} color="#8B5CF6" />
                    <Text style={styles.sectionTitle}>Racing Academy</Text>
                    <View style={styles.progressBadge}>
                      <Text style={styles.progressBadgeText}>3 of 12 modules completed</Text>
                </View>
                  </View>
                </View>
                
                {/* Course Modules Grid */}
                <View style={styles.modulesGrid}>
                  {/* Module 1 - In Progress */}
                  <View style={styles.moduleCard}>
                    <View style={[styles.moduleIconContainer, { backgroundColor: '#DBEAFE' }]}>
                      <Ionicons name="flag" size={32} color="#3E92CC" />
                    </View>
                    
                    <Text style={styles.moduleTitle}>Start Line Tactics</Text>
                    <Text style={styles.moduleDescription}>
                      Master the start with line bias analysis, timing, and positioning strategies
                  </Text>
                    
                    <View style={styles.moduleProgressSection}>
                      <Text style={styles.progressLabel}>Progress</Text>
                      <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBarFill, { width: '60%' }]} />
                      </View>
                      <Text style={styles.progressText}>3 of 5 lessons complete</Text>
                    </View>
                    
                    <TouchableOpacity style={styles.continueButton}>
                      <Text style={styles.continueButtonText}>Continue Learning</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Module 2 - Completed */}
                  <View style={styles.moduleCard}>
                    <View style={[styles.moduleIconContainer, { backgroundColor: '#D1FAE5' }]}>
                      <Ionicons name="trending-up" size={32} color="#10B981" />
                    </View>
                    
                    <Text style={styles.moduleTitle}>Upwind Strategy</Text>
                    <Text style={styles.moduleDescription}>
                      Optimize upwind performance with wind shifts, VMG, and tactical positioning
                    </Text>
                    
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={styles.completedText}>Completed</Text>
                    </View>
                    
                    <TouchableOpacity style={styles.reviewButton}>
                      <Text style={styles.reviewButtonText}>Review Course</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Module 3 - Locked */}
                  <View style={[styles.moduleCard, styles.moduleCardLocked]}>
                    <View style={[styles.moduleIconContainer, { backgroundColor: '#F3F4F6' }]}>
                      <Ionicons name="lock-closed" size={32} color="#9CA3AF" />
                    </View>
                    
                    <Text style={styles.moduleTitle}>Mark Roundings</Text>
                    <Text style={styles.moduleDescription}>
                      Advanced techniques for clean, fast mark roundings under pressure
                    </Text>
                    
                    <View style={styles.lockedBadge}>
                      <Ionicons name="lock-closed" size={14} color="#6B7280" />
                      <Text style={styles.lockedText}>Unlock with Sailor Pro</Text>
                    </View>
                    
                    <TouchableOpacity style={styles.unlockButton}>
                      <Text style={styles.unlockButtonText}>Upgrade to Pro ($29/mo)</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Module 4 - Available */}
                  <View style={styles.moduleCard}>
                    <View style={[styles.moduleIconContainer, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="speedometer-outline" size={32} color="#F59E0B" />
                    </View>
                    
                    <Text style={styles.moduleTitle}>Downwind Tactics</Text>
                    <Text style={styles.moduleDescription}>
                      Master gybing angles, VMG optimization, and passing techniques on the run
                    </Text>
                    
                    <TouchableOpacity style={styles.continueButton}>
                      <Text style={styles.continueButtonText}>Start Course</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Recommended Section */}
                <View style={styles.recommendedSection}>
                  <View style={styles.recommendedHeader}>
                    <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
                    <Text style={styles.recommendedTitle}>Recommended for You</Text>
                  </View>
                  <Text style={styles.recommendedText}>
                    Based on your recent race performance, we recommend: <Text style={styles.recommendedCourse}>"Tacking in Light Air"</Text> to improve your upwind efficiency.
                  </Text>
                </View>
              </View>

              {/* Yacht Club Integration Section */}
              <View 
                ref={yachtClubRef} 
                style={[
                  styles.yachtClubSection,
                  highlightedFeature === 'yacht-club-integration' && styles.sectionHighlighted,
                ]}
                {...(Platform.OS === 'web' ? { id: 'yacht-club-section' } : {})}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="business-outline" size={24} color="#F59E0B" />
                  <Text style={styles.sectionTitle}>Yacht Club Integration</Text>
                </View>
                
                {/* Connected Club Card */}
                <View style={styles.connectedClubCard}>
                  <View style={styles.clubHeader}>
                    <View style={styles.clubLogoContainer}>
                      <Ionicons name="flag" size={32} color="#3E92CC" />
                    </View>
                    <View style={styles.clubInfo}>
                      <Text style={styles.clubName}>Royal Hong Kong Yacht Club</Text>
                      <Text style={styles.clubMemberSince}>Member since 2018 • Dragon Fleet</Text>
                    </View>
                    <View style={styles.connectedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={styles.connectedText}>Connected</Text>
                    </View>
                  </View>
                </View>
                
                {/* Upcoming Club Events */}
                <View style={styles.clubEventsSection}>
                  <Text style={styles.subsectionTitle}>Upcoming Club Events</Text>
                  
                  <View style={styles.eventsList}>
                    {/* Event 1 */}
                    <View style={styles.eventCard}>
                      <View style={styles.eventDateBadge}>
                        <Text style={styles.eventMonth}>JAN</Text>
                        <Text style={styles.eventDay}>15</Text>
                      </View>
                      
                      <View style={styles.eventDetails}>
                        <Text style={styles.eventTitle}>Dragon Class Spring Championship</Text>
                        <View style={styles.eventMeta}>
                          <View style={styles.eventMetaItem}>
                            <Ionicons name="time-outline" size={14} color="#6B7280" />
                            <Text style={styles.eventMetaText}>3-day series</Text>
                          </View>
                          <View style={styles.eventMetaItem}>
                            <Ionicons name="boat-outline" size={14} color="#6B7280" />
                            <Text style={styles.eventMetaText}>45 boats registered</Text>
                          </View>
                        </View>
                      </View>
                      
                      <TouchableOpacity style={styles.registerButton}>
                        <Text style={styles.registerButtonText}>Register</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Event 2 - Already Registered */}
                    <View style={styles.eventCard}>
                      <View style={styles.eventDateBadge}>
                        <Text style={styles.eventMonth}>JAN</Text>
                        <Text style={styles.eventDay}>22</Text>
                      </View>
                      
                      <View style={styles.eventDetails}>
                        <Text style={styles.eventTitle}>Around the Island Race</Text>
                        <View style={styles.eventMeta}>
                          <View style={styles.eventMetaItem}>
                            <Ionicons name="time-outline" size={14} color="#6B7280" />
                            <Text style={styles.eventMetaText}>Single race</Text>
                          </View>
                          <View style={styles.eventMetaItem}>
                            <Ionicons name="navigate-outline" size={14} color="#6B7280" />
                            <Text style={styles.eventMetaText}>28nm course</Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.registeredButton}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.registeredButtonText}>Registered</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                {/* Season Leaderboard */}
                <View style={styles.leaderboardSection}>
                  <Text style={styles.subsectionTitle}>Season Leaderboard</Text>
                  
                  <View style={styles.leaderboardList}>
                    <View style={styles.leaderboardItem}>
                      <Text style={styles.rank}>🥇</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>Sarah Chen</Text>
                        <Text style={styles.boatName}>Dragon d42</Text>
                      </View>
                      <Text style={styles.points}>156 pts</Text>
                    </View>
                    
                    <View style={styles.leaderboardItem}>
                      <Text style={styles.rank}>🥈</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>Mike Wong</Text>
                        <Text style={styles.boatName}>Dragon d38</Text>
                      </View>
                      <Text style={styles.points}>142 pts</Text>
                    </View>
                    
                    <View style={[styles.leaderboardItem, styles.leaderboardItemYou]}>
                      <Text style={styles.rank}>3</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>You</Text>
                        <Text style={styles.boatName}>Dragon d59</Text>
                      </View>
                      <Text style={styles.points}>138 pts</Text>
                    </View>
                    
                    <View style={styles.leaderboardItem}>
                      <Text style={styles.rank}>4</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>Tom Liu</Text>
                        <Text style={styles.boatName}>Dragon d27</Text>
                      </View>
                      <Text style={styles.points}>134 pts</Text>
                    </View>
                    
                    <View style={styles.leaderboardItem}>
                      <Text style={styles.rank}>5</Text>
                      <View style={styles.skipperInfo}>
                        <Text style={styles.skipperName}>David Park</Text>
                        <Text style={styles.boatName}>Dragon d15</Text>
                      </View>
                      <Text style={styles.points}>128 pts</Text>
                    </View>
                  </View>
                </View>
                
                {/* Quick Actions */}
                <View style={styles.quickActionsSection}>
                  <Text style={styles.subsectionTitle}>Quick Actions</Text>
                  
                  <View style={styles.quickActionsGrid}>
                    <TouchableOpacity style={styles.quickActionCard}>
                      <Ionicons name="calendar-outline" size={24} color="#3E92CC" />
                      <Text style={styles.quickActionText}>View Schedule</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.quickActionCard}>
                      <Ionicons name="people-outline" size={24} color="#3E92CC" />
                      <Text style={styles.quickActionText}>Member Directory</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.quickActionCard}>
                      <Ionicons name="chatbubbles-outline" size={24} color="#3E92CC" />
                      <Text style={styles.quickActionText}>Club Forum</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.quickActionCard}>
                      <Ionicons name="document-text-outline" size={24} color="#3E92CC" />
                      <Text style={styles.quickActionText}>Documents</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Club Resources */}
                <View style={styles.clubResourcesSection}>
                  <Text style={styles.subsectionTitle}>Club Resources</Text>
                  
                  <View style={styles.resourcesList}>
                    <TouchableOpacity style={styles.resourceItem}>
                      <View style={styles.resourceIcon}>
                        <Ionicons name="document-text-outline" size={20} color="#3E92CC" />
                      </View>
                      <Text style={styles.resourceTitle}>Sailing Instructions</Text>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.resourceItem}>
                      <View style={styles.resourceIcon}>
                        <Ionicons name="map-outline" size={20} color="#3E92CC" />
                      </View>
                      <Text style={styles.resourceTitle}>Course Maps</Text>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.resourceItem}>
                      <View style={styles.resourceIcon}>
                        <Ionicons name="people-outline" size={20} color="#3E92CC" />
                      </View>
                      <Text style={styles.resourceTitle}>Club Directory</Text>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.resourceItem}>
                      <View style={styles.resourceIcon}>
                        <Ionicons name="calendar-outline" size={20} color="#3E92CC" />
                      </View>
                      <Text style={styles.resourceTitle}>Race Schedule 2025</Text>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F8FAFC', // Match real races screen
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    ...Platform.select({
      web: {
        width: '100%',
        minWidth: 320,
        maxWidth: '100vw',
        overflowX: 'hidden',
      },
    }),
  },
  scaleContainer: {
    ...Platform.select({
      web: {
        transformOrigin: 'top left',
      },
    }),
  },
  placeholder: {
    backgroundColor: '#F8FAFC',
  },
  screen: {
    width: ORIGINAL_WIDTH,
    height: ORIGINAL_HEIGHT,
    backgroundColor: '#F8FAFC', // Match real races screen
    overflow: 'hidden',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3E92CC',
  },
  statusTime: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#3E92CC', // Match real app bg-primary-500
    paddingTop: 40,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerDesktop: {
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF', // White text on blue background
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  venueDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  venueDisplayText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.95,
  },
  addRaceButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerAddRaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addRaceButtonDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  headerAddRaceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  addRaceHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    marginLeft: 4,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E92CC',
  },
  raceCardsScrollContainer: {
    position: 'relative',
    marginBottom: 24,
    minHeight: 620, // Increased to accommodate: 35px label + 450px cards + 140px callout
    zIndex: 1,
    width: '100%',
    ...Platform.select({
      web: {
        overflowX: 'hidden', // Clip horizontal content
        overflowY: 'visible', // Allow vertical elements (callout, label) to show
        maxWidth: '100%',
        boxSizing: 'border-box',
        // CSS containment removed to allow tooltip/label to render outside bounds
        isolation: 'isolate',
        // Position relative required for absolutely positioned children
        position: 'relative',
      },
    }),
  },
  scrollButton: {
    position: 'absolute',
    top: '50%',
    zIndex: 100, // Very high z-index to ensure visibility
    backgroundColor: 'rgba(62, 146, 204, 0.9)',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        transform: 'translateY(-50%)',
        transition: 'all 0.2s ease',
        ':hover': {
          backgroundColor: 'rgba(62, 146, 204, 1)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      },
      default: {
        transform: [{ translateY: -24 }],
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
    }),
  },
  scrollButtonLeft: {
    left: 8, // FIXED: Position inside container instead of outside
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        border: '2px solid #E5E7EB',
        ':hover': {
          backgroundColor: '#EFF6FF',
          borderColor: '#3E92CC',
          boxShadow: '0 4px 12px rgba(62, 146, 204, 0.3)',
        },
        // Hide on mobile - swipe is natural
        '@media (max-width: 768px)': {
          display: 'none',
        },
      },
    }),
  },
  scrollButtonRight: {
    right: 8, // FIXED: Position inside container instead of outside
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        border: '2px solid #E5E7EB',
        ':hover': {
          backgroundColor: '#EFF6FF',
          borderColor: '#3E92CC',
          boxShadow: '0 4px 12px rgba(62, 146, 204, 0.3)',
        },
        // Hide on mobile - swipe is natural
        '@media (max-width: 768px)': {
          display: 'none',
        },
      },
    }),
  },
  scrollButtonDisabled: {
    ...Platform.select({
      web: {
        opacity: 0.5,
        cursor: 'not-allowed',
        ':hover': {
          backgroundColor: '#FFFFFF',
          borderColor: '#E5E7EB',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        },
      },
      default: {
        opacity: 0.5,
      },
    }),
  },
  raceCardsScrollView: {
    minHeight: 620, // Increased to accommodate: 35px label + 450px cards + 140px callout
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    ...Platform.select({
      web: {
        overflowX: 'auto', // Enable horizontal scroll
        overflowY: 'visible', // Allow cards to show full height with callout/label
        // REMOVED: WebkitOverflowScrolling creates GPU layer that escapes containment
        // WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y',
        overscrollBehaviorX: 'contain',
        position: 'relative',
        display: 'block',
        maxWidth: '100%',
        boxSizing: 'border-box',
        // Containment removed to allow tooltip/label to render
      },
    }),
  },
  raceCardsContainer: {
    // Keep for backward compatibility if referenced elsewhere
    minHeight: 620,
  },
  raceCardsContent: {
    paddingHorizontal: 16,
    paddingTop: 50, // Increased to accommodate highlight label (35px + buffer)
    paddingBottom: 160, // Increased to accommodate callout (140px + buffer)
    gap: 8,
    paddingRight: 32, // Extra padding for NOW bar and Add Race card
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        flexWrap: 'nowrap',
        boxSizing: 'border-box',
        position: 'relative',
        flexShrink: 0,
        paddingHorizontal: 60,
        paddingTop: 50, // Increased to accommodate highlight label (35px + buffer)
        paddingBottom: 160, // Increased to accommodate callout (140px + buffer)
        '@media (max-width: 768px)': {
          paddingHorizontal: 16,
          gap: 12,
          flexDirection: 'row',
          overflowX: 'auto',
          flexWrap: 'nowrap',
        },
        '@media (max-width: 480px)': {
          paddingHorizontal: 12,
          gap: 10,
        },
      } as any,
      default: {
        flexDirection: 'row',
        alignItems: 'flex-start',
      },
    }),
  },
  raceCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  raceCardSelected: {
    borderColor: '#3E92CC',
    backgroundColor: '#F0F9FF',
  },
  raceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  raceCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  raceCardBadge: {
    backgroundColor: '#3E92CC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  raceCardBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  raceCardVenue: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  raceCardDetails: {
    gap: 4,
    marginBottom: 8,
  },
  raceCardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  raceCardDetailText: {
    fontSize: 11,
    color: '#6B7280',
  },
  raceCardWind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  raceCardWindText: {
    fontSize: 11,
    color: '#3E92CC',
    fontWeight: '600',
  },
  detailsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
    ...Platform.select({
      web: {
        width: '100%',
        paddingHorizontal: 16,
        '@media (max-width: 768px)': {
          paddingHorizontal: 12,
        },
      } as any,
    }),
    zIndex: 1,
  },
  sectionHighlighted: {
    backgroundColor: 'rgba(62, 146, 204, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#3E92CC',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(62, 146, 204, 0.2)',
        transition: 'all 0.3s ease',
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    ...Platform.select({
      web: {
        marginBottom: 20,
        '@media (max-width: 768px)': {
          marginBottom: 16,
        },
      } as any,
    }),
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'left',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        fontSize: 'clamp(20px, 3vw, 28px)',
        textAlign: 'left',
        alignSelf: 'flex-start',
      } as any,
    }),
  },
  cardSectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
    ...Platform.select({
      web: {
        fontSize: 'clamp(13px, 2vw, 16px)',
      } as any,
    }),
  },
  cardStrategyCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cardStrategyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  cardStrategyText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 12,
  },
  strategyFeatures: {
    gap: 8,
  },
  strategyFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  strategyFeatureText: {
    fontSize: 12,
    color: '#374151',
  },
  venueCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  venueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  venueText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  // Desktop/Fullscreen mode styles
  containerDesktop: {
    width: '100%',
    flex: 1,
    ...Platform.select({
      web: {
        position: 'relative' as any,
      },
    }),
  },
  containerFullscreen: {
    width: '100%',
    maxWidth: '100%',
    ...Platform.select({
      web: {
        position: 'relative' as any,
      },
    }),
  },
  containerMobileNative: {
    width: '100%',
    maxWidth: '100vw',
    ...Platform.select({
      web: {
        position: 'relative' as any,
        overflowX: 'hidden' as any,
        padding: 0,
      },
    }),
  },
  screenDesktop: {
    width: '100%',
    backgroundColor: '#F9FAFB', // Match real races screen background (bg-gray-50)
    // REMOVED flex: 1 - this was causing expansion beyond parent
    ...Platform.select({
      web: {
        borderRadius: 0, // No border radius - parent container handles it
        overflow: 'visible', // Allow tab bar to be visible - only constrain scroll views
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative', // For sticky tab bar positioning
        minWidth: 0, // Allow shrinking
        maxWidth: '100%', // Hard constraint - cannot exceed parent
        boxSizing: 'border-box', // Include padding/border in width
        // CRITICAL: Force width to match parent - prevent expansion beyond container
        width: '100%',
        // Ensure it respects parent constraints - don't expand to fit content
        alignSelf: 'stretch', // Stretch to parent width but don't exceed
        // Prevent content from expanding container - use CSS containment
        contain: 'layout style', // CSS containment to prevent expansion
        // Force width calculation to respect parent, not content
        flexBasis: 'auto',
        flexGrow: 0, // Don't grow beyond parent
        flexShrink: 1, // Allow shrinking if needed
        // CRITICAL: Prevent any expansion beyond parent width
        minHeight: 0, // Allow height shrinking
        // CRITICAL: Use CSS to force width constraint - override any content-based expansion
        // This ensures the element cannot expand beyond its parent's width
        isolation: 'isolate', // Create new stacking context and containment
      },
      default: {
        position: 'relative',
      },
    }),
  },
  mainScrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        paddingBottom: 72, // Space for tab bar (72px height)
        // CRITICAL: Constrain ScrollView width to parent - prevent expansion
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        // Prevent ScrollView from expanding container
        overflowX: 'hidden', // Hide horizontal overflow
        overflowY: 'auto', // Allow vertical scrolling
        // Ensure it doesn't expand beyond parent
        flexShrink: 1,
        flexGrow: 0,
      },
      default: {
        paddingBottom: 72,
      },
    }),
  },
  mainScrollContent: {
    paddingBottom: 80, // Extra padding for tab bar
    ...Platform.select({
      web: {
        minHeight: '100%',
      },
    }),
  },
  raceCardsSection: {
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 24,
    zIndex: 1,
  },
  sectionIntro: {
    alignItems: 'flex-start',
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 24,
    marginTop: 0,
    marginBottom: 16,
    width: '100%',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        textAlign: 'left',
        alignSelf: 'flex-start',
        marginLeft: 0,
        marginRight: 'auto',
        maxWidth: '100%',
        width: '100%',
      } as any,
    }),
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3E92CC',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'left',
    width: '100%',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        textAlign: 'left',
        alignSelf: 'flex-start',
        marginLeft: 0,
        marginRight: 'auto',
      } as any,
    }),
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'left',
    marginBottom: 12,
    width: '100%',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        fontSize: 'clamp(20px, 3vw, 28px)',
        maxWidth: 800,
        textAlign: 'left',
        marginLeft: 0,
        marginRight: 'auto',
        alignSelf: 'flex-start',
      } as any,
    }),
  },
  sectionSubtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'left',
    lineHeight: 26,
    width: '100%',
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        fontSize: 'clamp(13px, 2vw, 16px)',
        maxWidth: 600,
        textAlign: 'left',
        marginLeft: 0,
        marginRight: 'auto',
        alignSelf: 'flex-start',
      } as any,
    }),
  },
  showcaseHeader: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 24,
    marginBottom: 24,
  },
  showcaseLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3E92CC',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  showcaseTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 40,
  },
  showcaseSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 16,
  },
  scrollHintText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  raceCardWrapperFullscreen: {
    marginRight: 16,
    ...Platform.select({
      web: {
        '@media (max-width: 768px)': {
          marginRight: 12,
        },
        '@media (max-width: 480px)': {
          marginRight: 8,
        },
      } as any,
    }),
  },
  raceCardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 0,
    marginTop: 0,
    marginBottom: 12,
  },
  raceCardsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  raceCardsSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  raceCountBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  raceCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  raceCardWrapper: {
    marginRight: 8,
    ...Platform.select({
      web: {
        flexShrink: 0,
        flexGrow: 0,
      },
    }),
  },
  raceCardWrapperSelected: {
    // Selection handled by RaceCard component
  },
  raceCardWrapperPast: {
    opacity: 0.6, // Dim past races
  },
  raceCardWrapperNext: {
    // Next race is highlighted via isPrimary prop on RaceCard
    transform: [{ scale: 1.05 }], // Slightly larger
  },
  raceCardWrapperPressed: {
    opacity: 0.9,
  },
  raceCardContainer: {
    position: 'relative',
    marginRight: 8,
    ...Platform.select({
      web: {
        flexShrink: 0,
        flexGrow: 0,
      },
    }),
  },
  raceCardWrapperHighlighted: {
    ...Platform.select({
      web: {
        borderWidth: 3,
        borderColor: '#3E92CC',
        borderRadius: 12,
        boxShadow: '0 0 20px rgba(62, 146, 204, 0.4), 0 0 40px rgba(62, 146, 204, 0.2)',
        transform: [{ scale: 1.05 }],
        zIndex: 10,
        // Animation removed - React Native Web doesn't support CSS animations in styles
      },
    }),
  },
  highlightPointer: {
    position: 'absolute',
    left: -40,
    top: '50%',
    zIndex: 15,
    backgroundColor: '#3E92CC',
    borderRadius: 12,
    padding: 8,
    ...Platform.select({
      web: {
        transform: 'translateY(-50%)',
        boxShadow: '0 2px 8px rgba(62, 146, 204, 0.4)',
        // Animation removed - React Native Web doesn't support CSS animations in styles
      },
    }),
  },
  highlightLabel: {
    position: 'absolute',
    top: -35,
    left: '50%',
    zIndex: 15,
    backgroundColor: '#3E92CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    ...Platform.select({
      web: {
        transform: 'translateX(-50%)',
        boxShadow: '0 2px 8px rgba(62, 146, 204, 0.4)',
        whiteSpace: 'nowrap',
      },
    }),
  },
  highlightLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  callout: {
    position: 'absolute',
    bottom: -140,
    left: '50%',
    zIndex: 20,
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    maxWidth: 300,
    ...Platform.select({
      web: {
        transform: 'translateX(-50%)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        // Animation removed - React Native Web doesn't support CSS animations in styles
      },
    }),
  },
  calloutArrow: {
    position: 'absolute',
    top: -8,
    left: '50%',
    ...Platform.select({
      web: {
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#1F2937',
        borderStyle: 'solid',
      },
    }),
  },
  calloutText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  // GPS Race Track Section
  gpsVisualization: {
    marginTop: 16,
    ...Platform.select({
      web: {
        width: '100%',
        overflow: 'hidden',
      },
    }),
  },
  gpsTrackLayout: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    ...Platform.select({
      web: {
        '@media (max-width: 768px)': {
          flexDirection: 'column',
        },
      },
      default: {
        flexDirection: 'column',
      },
    }),
  },
  gpsControlsPanel: {
    width: 280,
    gap: 12,
    ...Platform.select({
      web: {
        '@media (max-width: 768px)': {
          width: '100%',
        },
      },
      default: {
        width: '100%',
      },
    }),
  },
  quickStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  quickStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  quickStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  cardQuickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  cardQuickStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  quickStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  controlsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  controlsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  controlToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  controlToggleActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3E92CC',
  },
  controlToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlToggleIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  controlToggleLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  controlToggleLabelActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  metricContent: {
    flex: 1,
  },
  cardMetricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  gpsMapContainer: {
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trackMapContainer: {
    width: '100%',
    height: 600,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        '@media (max-width: 1024px)': {
          height: 500,
        },
        '@media (max-width: 768px)': {
          height: 450,
        },
        '@media (max-width: 480px)': {
          height: 400,
        },
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  // Professional GPS Track Styles
  courseInfoCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    ...Platform.select({
      web: {
        '@media (max-width: 768px)': {
          flexDirection: 'column',
        },
      },
      default: {
        flexDirection: 'column',
      },
    }),
  },
  infoCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    // borderLeft shorthand removed - already using borderLeftWidth and borderLeftColor
  },
  infoLabel: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  raceStatsContainer: {
    marginBottom: 24,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      },
    }),
  },
  statSubtext: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },
  tacticalAnalysis: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  analysisList: {
    gap: 12,
  },
  analysisItemGood: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    // borderLeft shorthand removed - already using borderLeftWidth and borderLeftColor
  },
  analysisItemBad: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    // borderLeft shorthand removed - already using borderLeftWidth and borderLeftColor
  },
  analysisItemWarning: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    // borderLeft shorthand removed - already using borderLeftWidth and borderLeftColor
  },
  cardAnalysisContent: {
    flex: 1,
  },
  cardAnalysisHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  cardAnalysisText: {
    fontSize: 13,
    color: '#616161',
    lineHeight: 18,
  },
  // Race Track Statistics Styles
  raceTrackStatistics: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 32,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      },
    }),
  },
  quickStatCard: {
    flex: 1,
    minWidth: 150,
    padding: 24,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    alignItems: 'center',
    ...Platform.select({
      web: {
        textAlign: 'center',
      },
    }),
  },
  quickStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#212529',
    marginTop: 12,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 8,
  },
  lapBreakdownSection: {
    marginBottom: 32,
  },
  trackSubsectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  lapTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    overflow: 'hidden',
  },
  lapTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#DEE2E6',
  },
  lapTableHeaderCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#495057',
    textAlign: 'center',
  },
  lapTableRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
  },
  lapTableCell: {
    flex: 1,
    fontSize: 14,
    color: '#212529',
    textAlign: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fasterSplit: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  gainLoss: {
    fontSize: 14,
    fontWeight: '600',
  },
  legPerformanceSection: {
    marginBottom: 32,
  },
  legsGrid: {
    flexDirection: 'row',
    gap: 16,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        '@media (max-width: 768px)': {
          gridTemplateColumns: '1fr',
        },
      },
      default: {
        flexDirection: 'column',
      },
    }),
  },
  legCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  legCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  legCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  legStats: {
    gap: 12,
  },
  legStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  legStatLabel: {
    fontSize: 14,
    color: '#6C757D',
    flex: 1,
  },
  legStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginRight: 12,
  },
  legStatDetail: {
    fontSize: 12,
    color: '#6C757D',
    marginLeft: 8,
  },
  negativeValue: {
    color: '#F44336',
  },
  positiveValue: {
    color: '#4CAF50',
  },
  rankBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  goodRank: {
    backgroundColor: '#E8F5E9',
  },
  goodRankText: {
    color: '#4CAF50',
  },
  warningBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  warningBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  goodBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  goodBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  markRoundingsSection: {
    marginBottom: 32,
  },
  roundingsGrid: {
    flexDirection: 'row',
    gap: 16,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        '@media (max-width: 768px)': {
          gridTemplateColumns: '1fr',
        },
      },
      default: {
        flexDirection: 'column',
      },
    }),
  },
  roundingCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  roundingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  markIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  roundingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  roundingStat: {
    alignItems: 'center',
  },
  roundingLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 4,
  },
  roundingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
  },
  roundingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  warningNote: {
    backgroundColor: '#FFF3E0',
  },
  roundingNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#616161',
    lineHeight: 18,
  },
  speedDistributionSection: {
    marginBottom: 32,
  },
  speedBars: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  speedBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  speedLabel: {
    width: 60,
    fontSize: 14,
    color: '#495057',
  },
  speedBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#E9ECEF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  speedBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  speedPercent: {
    width: 50,
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    textAlign: 'right',
  },
  fleetComparisonSection: {
    marginBottom: 32,
  },
  comparisonTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#DEE2E6',
  },
  comparisonHeaderCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#495057',
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
  },
  positionCell: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    textAlign: 'center',
  },
  boatCell: {
    flex: 1.5,
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
  },
  yourBoat: {
    fontWeight: '700',
    color: '#1976D2',
  },
  timeCell: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
  },
  deltaCell: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
  },
  speedCell: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
  },
  vmgCell: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
  },
  yourRow: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  mutedText: {
    color: '#ADB5BD',
    fontStyle: 'italic',
  },
  keyInsightsSection: {
    marginBottom: 32,
  },
  insightsList: {
    gap: 12,
  },
  insightItemGood: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  insightItemWarning: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  insightItemBad: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  trackInsightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  trainingSection: {
    marginBottom: 32,
  },
  trainingCards: {
    flexDirection: 'row',
    gap: 16,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      },
      default: {
        flexDirection: 'column',
      },
    }),
  },
  trainingCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trainingIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  trainingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  trainingDescription: {
    fontSize: 14,
    color: '#616161',
    lineHeight: 20,
    marginBottom: 16,
  },
  trainingPriority: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
  },
  priorityMedium: {
    backgroundColor: '#FFF3E0',
  },
  priorityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  raceTrack: {
    position: 'relative',
    height: 300,
    width: '100%',
  },
  startLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  startLineMarker: {
    width: 40,
    height: 2,
    backgroundColor: '#10B981',
  },
  startLineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  trackPathContainer: {
    position: 'relative',
    height: 200,
    width: '100%',
    marginBottom: 20,
  },
  trackPath: {
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  trackPoint: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackPointStart: {
    left: '10%',
    top: '80%',
    backgroundColor: '#10B981',
  },
  trackPointMiddle: {
    left: '50%',
    top: '40%',
    backgroundColor: '#3E92CC',
  },
  trackPointEnd: {
    left: '90%',
    top: '20%',
    backgroundColor: '#EF4444',
  },
  trackPointInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  trackLine1: {
    position: 'absolute',
    left: '10%',
    top: '80%',
    width: '40%',
    height: 2,
    backgroundColor: '#3E92CC',
    transform: [{ rotate: '-25deg' }],
  },
  trackLine2: {
    position: 'absolute',
    left: '50%',
    top: '40%',
    width: '40%',
    height: 2,
    backgroundColor: '#3E92CC',
    transform: [{ rotate: '-15deg' }],
  },
  trackLine3: {
    position: 'absolute',
    left: '50%',
    top: '40%',
    width: '40%',
    height: 2,
    backgroundColor: '#3E92CC',
    transform: [{ rotate: '-5deg' }],
  },
  trackStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  trackStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        '@media (max-width: 768px)': {
          gridTemplateColumns: 'repeat(2, 1fr)',
      },
        '@media (max-width: 480px)': {
          gridTemplateColumns: '1fr',
        },
      } as any,
    }),
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        minHeight: 100,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ':hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)',
        },
        '@media (max-width: 480px)': {
          padding: 12,
          minHeight: 80,
      },
      } as any,
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  // Post Race Analysis Section
  analysisContent: {
    marginTop: 16,
    gap: 24,
  },
  analysisBlock: {
    marginBottom: 24,
  },
  analysisHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  resultPosition: {
    fontSize: 32,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  resultTotal: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  metricRank: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  insightGood: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  insightWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  insightBad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
  },
  recommendationsList: {
    gap: 12,
    marginTop: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recommendationNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
  },
  // Coach Feedback Section
  coachContent: {
    marginTop: 16,
    gap: 20,
  },
  coachProfile: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  coachAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachInfo: {
    flex: 1,
    gap: 8,
  },
  coachName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  coachCredentials: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  coachBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  coachBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  videoAnalysisCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  videoThumbnail: {
    height: 200,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoLabel: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    padding: 16,
  },
  feedbackBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  feedbackHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 12,
  },
  coachActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3E92CC',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(62, 146, 204, 0.3)',
        transition: 'all 0.2s',
        ':hover': {
          backgroundColor: '#2E7AB8',
          boxShadow: '0 4px 8px rgba(62, 146, 204, 0.4)',
        },
      },
      default: {
        elevation: 2,
        shadowColor: '#3E92CC',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3E92CC',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s',
        ':hover': {
          backgroundColor: '#F0F9FF',
        },
      },
    }),
  },
  secondaryButtonText: {
    color: '#3E92CC',
    fontSize: 16,
    fontWeight: '600',
  },
  // NOW Bar Indicator
  nowBarWrapper: {
    width: 2,
    height: 400, // Match race card height
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'visible',
    flexShrink: 0,
  },
  nowBarLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#10B981', // Green color to match design
  },
  nowBarBadge: {
    position: 'absolute',
    top: 8,
    backgroundColor: '#10B981', // Green color to match design
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    transform: [{ translateX: -20 }], // Center badge on line
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
      },
      default: {
        elevation: 4,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  nowBarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // NOTE: scrollGradientLeft and scrollGradientRight are defined earlier in this file (around line 5076)
  // Do NOT define duplicates here as the later definition would override with incomplete properties
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readOnlyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Bottom Tab Navigation - Fixed at bottom, constrained to demo container width
  tabBarContainer: {
    ...Platform.select({
      web: {
        // Use fixed positioning to stay at bottom of viewport
        // Match demo container width (60% of viewport)
        position: 'fixed' as any,
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '60%', // Match demoCenter width
        maxWidth: 1200, // Prevent it from getting too wide
        zIndex: 1000,
        overflow: 'visible',
        backgroundColor: 'transparent',
        boxSizing: 'border-box',
        display: 'flex',
        visibility: 'visible',
        opacity: 1,
        pointerEvents: 'auto',
      },
      default: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        width: '100%',
      },
    }),
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    minHeight: 70, // Increased minimum height
    paddingTop: 12, // Increased from 6
    paddingBottom: Platform.OS === 'ios' ? 20 : 12, // Increased from 8
    flexDirection: 'row',
    justifyContent: 'flex-start', // Start from left
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        visibility: 'visible',
        opacity: 1,
        width: '100%',
        paddingHorizontal: 0,
        marginLeft: 0,
        marginRight: 0,
        gap: 0,
        overflowX: 'auto', // Enable horizontal scroll if needed
        overflowY: 'hidden',
        flexWrap: 'nowrap',
        boxSizing: 'border-box',
        // Match parent container's bottom border radius
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 2,
    ...Platform.select({
      web: {
        display: 'flex',
        visibility: 'visible',
        overflow: 'visible',
        // CRITICAL: Fixed width per tab - exactly 1/6 of container
        flexGrow: 0, // Don't grow
        flexShrink: 0, // Don't shrink
        flexBasis: 'auto',
        width: 'calc(100% / 6)', // Exactly 1/6 of container
        minWidth: 0,
        maxWidth: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        pointerEvents: 'auto',
        touchAction: 'manipulation',
        contain: 'layout style', // Prevent expansion beyond allocated space
      },
      default: {
        flex: 1, // For native, use flex
      },
    }),
  },
  tabItemActive: {
    // Active state styling
  },
  tabItemMore: {
    // Ensure More tab is visible
    ...Platform.select({
      web: {
        display: 'flex',
        visibility: 'visible',
        opacity: 1,
      },
    }),
  },
  tabLabel: {
    fontSize: 7, // Very small to fit 6 tabs
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 1,
    textAlign: 'center',
    ...Platform.select({
      web: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        lineHeight: 1,
        letterSpacing: 0,
      },
    }),
  },
  tabLabelActive: {
    color: '#3E92CC',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 90, // Increased from 80 to match new tab bar height
  },
  // Add Race Card in Timeline - same size as race cards
  addRaceCardWrapper: {
    marginRight: 8,
    flexShrink: 0,
    flexGrow: 0,
    width: 240, // Same as RACE_CARD_WIDTH
    height: 400, // Match race card height
    position: 'relative',
    ...Platform.select({
      web: {
        display: 'flex',
        visibility: 'visible',
        opacity: 1,
        flexBasis: 'auto',
      },
    }),
  },
  addRaceCard: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0FDF4', // Light green background
    borderRadius: 16,
    borderWidth: 2, // Use 2px for crisp rendering
    borderColor: '#10B981', // Green border
    borderStyle: 'solid',
    padding: 14, // Adjusted for 2px border
    flexDirection: 'column',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        // Ensure no subpixel rendering issues
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  // Add Race card content
  addRaceContent: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4', // Same as parent to eliminate gaps
    // DEBUG: Add red border to see exact bounds
    // borderWidth: 2,
    // borderColor: 'red',
  },
  raceTimelineLabel: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  addRaceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 20,
  },
  addRaceDescription: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
    marginBottom: 12,
  },
  featureLinks: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
  },
  featureLink: {
    paddingVertical: 2,
  },
  featureLinkText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10B981', // Green color
  },
  addRaceCardActions: {
    gap: 8,
    marginTop: 'auto',
  },
  addRaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981', // Green background
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  addRaceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  importCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981', // Green border
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  importCalendarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981', // Green text
  },
  addRaceCardButtonDisabled: {
    opacity: 0.6,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      },
    }),
  },
  // Rig Tuning Section
  rigTuningCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conditionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  tuningList: {
    gap: 12,
  },
  tuningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tuningLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    width: 80,
    flexShrink: 0,
  },
  tuningValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  raceCardsContentDesktop: {
    paddingHorizontal: 24,
  },
  detailsContainerDesktop: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  // Race Conditions
  conditionsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  conditionItem: {
    flex: 1,
    minWidth: 140,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  conditionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
  },
  conditionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  conditionSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Upgrade badge
  upgradeBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  upgradeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Venue stats
  venueStats: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  venueStat: {
    alignItems: 'center',
  },
  venueStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3E92CC',
  },
  venueStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  // Timeline
  timelineCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1D5DB',
    marginRight: 16,
  },
  timelineDotActive: {
    backgroundColor: '#3E92CC',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  timelineEvent: {
    fontSize: 14,
    color: '#6B7280',
  },
  timelineEventActive: {
    color: '#3E92CC',
    fontWeight: '600',
  },
  moreMenu: {
    ...Platform.select({
      web: {
        position: 'absolute',
        bottom: 70, // Above tabs
        right: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: 8,
        minWidth: 200,
        zIndex: 1001,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      },
      default: {
        position: 'absolute',
        bottom: 70,
        right: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 8,
        minWidth: 200,
        zIndex: 1001,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      },
    }),
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  moreMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  // Fleet Sharing Styles
  fleetSharingSection: {
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: 32,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  sharedStrategiesGrid: {
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
      },
    }),
    marginBottom: 24,
  },
  strategyCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  strategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  strategyAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3E92CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  timeAgo: {
    fontSize: 12,
    color: '#6B7280',
  },
  strategyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  strategyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  strategyMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  useStrategyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  useStrategyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E92CC',
  },
  yourStrategiesSection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  yourStrategyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  yourStrategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  yourStrategyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  yourStrategyStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
  },
  shareNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3E92CC',
    paddingVertical: 12,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  shareNewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Learning Academy Styles
  learningAcademySection: {
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: 32,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  progressBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B21A8',
  },
  modulesGrid: {
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
        '@media (max-width: 768px)': {
          gridTemplateColumns: '1fr',
        },
      } as any,
    }),
    marginTop: 20,
  },
  moduleCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  moduleCardLocked: {
    opacity: 0.7,
  },
  moduleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  moduleDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  moduleProgressSection: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3E92CC',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  completedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  lockedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3E92CC',
    paddingVertical: 12,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  continueButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reviewButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  unlockButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recommendedSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recommendedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  recommendedText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  recommendedCourse: {
    fontWeight: '600',
    color: '#92400E',
  },
  // Yacht Club Styles
  yachtClubSection: {
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: 32,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  connectedClubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clubLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  clubMemberSince: {
    fontSize: 14,
    color: '#6B7280',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  connectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  clubEventsSection: {
    marginBottom: 24,
  },
  eventsList: {
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      },
    }),
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  eventDateBadge: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  eventDay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400E',
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  registerButton: {
    backgroundColor: '#3E92CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  registerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  registeredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  registeredButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leaderboardSection: {
    marginBottom: 24,
  },
  leaderboardList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  leaderboardItemYou: {
    backgroundColor: '#EFF6FF',
  },
  rank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    width: 40,
  },
  skipperInfo: {
    flex: 1,
  },
  skipperName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  boatName: {
    fontSize: 13,
    color: '#6B7280',
  },
  points: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E92CC',
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 12,
        '@media (max-width: 480px)': {
          gridTemplateColumns: 'repeat(2, 1fr)',
        },
      } as any,
    }),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ':hover': {
          borderColor: '#3E92CC',
          backgroundColor: '#F0F9FF',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(62, 146, 204, 0.15)',
        },
      },
    }),
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  clubResourcesSection: {
    // No extra margin, last section
  },
  resourcesList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          backgroundColor: '#F9FAFB',
        },
      },
    }),
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resourceTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  // Wind Timeline Styles
  windTimelineSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 20,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  windTimeline: {
    gap: 16,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  timelineMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  timelineWind: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

