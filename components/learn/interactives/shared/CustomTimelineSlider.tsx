/**
 * Custom Timeline Slider for Starting Sequence
 * Shows colored segments for different phases and clickable markers
 */

import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, Pressable, PanResponder } from 'react-native';

interface TimelineMarker {
  value: number;
  label: string;
}

interface CustomTimelineSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  markers: TimelineMarker[];
  disabled?: boolean;
}

export function CustomTimelineSlider({
  min,
  max,
  value,
  onChange,
  markers,
  disabled = false,
}: CustomTimelineSliderProps) {
  const sliderRef = useRef<View>(null);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [, setIsDragging] = useState(false);
  const totalRange = max - min;

  const getPercentage = (val: number) => ((val - min) / totalRange) * 100;

  // Colored segments for different phases
  const segments = [
    { start: getPercentage(min), end: getPercentage(-300), color: '#94A3B8', label: 'Pre-Warning' }, // Gray
    { start: getPercentage(-300), end: getPercentage(-240), color: '#3B82F6', label: 'Warning' }, // Blue
    { start: getPercentage(-240), end: getPercentage(-60), color: '#F59E0B', label: 'Prep' }, // Yellow/Amber
    { start: getPercentage(-60), end: getPercentage(0), color: '#22C55E', label: 'Final' }, // Green
    { start: getPercentage(0), end: getPercentage(max), color: '#16A34A', label: 'Racing' }, // Dark Green
  ];

  const handleLayout = (event: any) => {
    const { width, x, y } = event.nativeEvent.layout;
    setSliderWidth(width);
    sliderLayoutRef.current = { x, y, width };
    
    // On web, also try to get the element's absolute position
    if (Platform.OS === 'web' && sliderRef.current) {
      // Use setTimeout to allow layout to complete
      setTimeout(() => {
        try {
          (sliderRef.current as any)?.measure?.((fx: number, fy: number, w: number, h: number, px: number, py: number) => {
            if (typeof px === 'number' && !isNaN(px)) {
              sliderLayoutRef.current.x = px;
              sliderLayoutRef.current.y = py;
            }
          });
        } catch (e) {
          // Ignore measurement errors
        }
      }, 0);
    }
  };

  const calculateValueFromPosition = useCallback((x: number) => {
    // Guard against invalid values
    if (sliderWidth === 0 || typeof x !== 'number' || isNaN(x)) {
      return value;
    }
    const percentage = Math.max(0, Math.min(1, x / sliderWidth));
    const newValue = min + percentage * totalRange;
    // Guard against NaN result
    return isNaN(newValue) ? value : newValue;
  }, [sliderWidth, min, totalRange, value]);

  const handlePress = (event: any) => {
    if (disabled) return;
    // Use offsetX on web, locationX on native
    const x = Platform.OS === 'web' 
      ? (event.nativeEvent.offsetX ?? event.nativeEvent.locationX)
      : event.nativeEvent.locationX;
    if (typeof x === 'number' && !isNaN(x)) {
      onChange(calculateValueFromPosition(x));
    }
  };

  const handleMarkerPress = (markerValue: number) => {
    if (disabled) return;
    onChange(markerValue);
  };

  // Store the slider's layout position for accurate drag calculations on web
  const sliderLayoutRef = useRef({ x: 0, y: 0, width: 0 });

  const getXFromEvent = useCallback((evt: any) => {
    // On web, pageX is more reliable, so calculate relative position
    if (Platform.OS === 'web' && evt.nativeEvent.pageX !== undefined) {
      return evt.nativeEvent.pageX - sliderLayoutRef.current.x;
    }
    // Use offsetX if available (web)
    if (evt.nativeEvent.offsetX !== undefined) {
      return evt.nativeEvent.offsetX;
    }
    // Fallback to locationX (native)
    return evt.nativeEvent.locationX;
  }, []);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      const x = getXFromEvent(evt);
      if (typeof x === 'number' && !isNaN(x)) {
        onChange(calculateValueFromPosition(x));
      }
    },
    onPanResponderMove: (evt) => {
      const x = getXFromEvent(evt);
      if (typeof x === 'number' && !isNaN(x)) {
        onChange(calculateValueFromPosition(x));
      }
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
    },
  });

  const thumbPosition = getPercentage(value);

  return (
    <View style={styles.container}>
      {/* Markers above */}
      <View style={styles.markersContainer}>
        {markers.map((marker) => {
          const markerPercentage = getPercentage(marker.value);
          return (
            <Pressable
              key={marker.value}
              style={[styles.markerLabel, { left: `${markerPercentage}%` }]}
              onPress={() => handleMarkerPress(marker.value)}
            >
              <Text style={[
                styles.markerText,
                disabled && styles.markerTextDisabled,
              ]}>
                {marker.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Slider track */}
      <Pressable
        ref={sliderRef}
        style={styles.track}
        onLayout={handleLayout}
        onPress={handlePress}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      >
        {/* Colored segments */}
        <View style={styles.segmentsContainer}>
          {segments.map((segment, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                {
                  backgroundColor: segment.color,
                  width: `${segment.end - segment.start}%`,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            />
          ))}
        </View>

        {/* Marker ticks */}
        {markers.map((marker) => {
          const markerPercentage = getPercentage(marker.value);
          return (
            <View
              key={`tick-${marker.value}`}
              style={[
                styles.markerTick,
                { left: `${markerPercentage}%` },
              ]}
            />
          );
        })}

        {/* Thumb */}
        <View
          style={[
            styles.thumb,
            {
              left: `${thumbPosition}%`,
              backgroundColor: disabled ? '#94A3B8' : '#1E40AF',
              transform: [{ translateX: -8 }],
            },
          ]}
        />
      </Pressable>

      {/* Phase labels below */}
      <View style={styles.phaseLabelsContainer}>
        <Text style={styles.phaseLabel}>Pre-Start</Text>
        <Text style={styles.phaseLabel}>Warning</Text>
        <Text style={styles.phaseLabel}>Prep</Text>
        <Text style={styles.phaseLabel}>Final</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 24,
    paddingBottom: 20,
  },
  markersContainer: {
    position: 'relative',
    height: 20,
    marginBottom: 4,
  },
  markerLabel: {
    position: 'absolute',
    transform: [{ translateX: -20 }],
  },
  markerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    minWidth: 40,
  },
  markerTextDisabled: {
    color: '#94A3B8',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer' }
      : {}),
  },
  segmentsContainer: {
    flexDirection: 'row',
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  markerTick: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 16,
    backgroundColor: '#1E293B',
    borderRadius: 1,
    transform: [{ translateX: -1 }],
  },
  thumb: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.2)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        }),
  },
  phaseLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  phaseLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
});

