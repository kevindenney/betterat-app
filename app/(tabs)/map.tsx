import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Map3DView } from '@/components/map/Map3DView';
import { ProfessionalMapScreen } from '@/components/map/ProfessionalMapScreen';
import { RaceCourseVisualization } from '@/components/map/RaceCourseVisualization';
import type { RaceMark, WeatherConditions } from '@/lib/types/map';
import type { RaceCourseExtraction } from '@/lib/types/ai-knowledge';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('map');
const sampleMarks: RaceMark[] = [
  {
    id: '1',
    name: 'Start',
    position: { latitude: 37.8, longitude: -122.4 },
    type: 'start',
    rounding: 'port',
  },
  {
    id: '2',
    name: 'Mark 1',
    position: { latitude: 37.81, longitude: -122.39 },
    type: 'windward',
    rounding: 'port',
  },
  {
    id: '3',
    name: 'Finish',
    position: { latitude: 37.79, longitude: -122.41 },
    type: 'finish',
    rounding: 'port',
  },
];

const sampleWeather: WeatherConditions = {
  wind: {
    speed: 12,
    direction: 225,
    gusts: 15,
  },
  tide: {
    height: 2.1,
    direction: 'flood',
    speed: 0.8,
  },
  waves: {
    height: 1.2,
    period: 6,
    direction: 210,
  },
  timestamp: new Date(),
};

export default function MapScreen() {
  const [selectedMark, setSelectedMark] = useState<RaceMark | null>(null);
  const [professionalMode, setProfessionalMode] = useState(true);
  const [currentVenue, setCurrentVenue] = useState('san-francisco-bay');
  const [currentWeather, setCurrentWeather] = useState<any | null>(null);
  const [courseVisualizationMode, setCourseVisualizationMode] = useState(false);
  const [extractedCourse, setExtractedCourse] = useState<RaceCourseExtraction | null>(null);

  const handleMarkPress = (mark: RaceMark) => {
    setSelectedMark(mark);
    showAlert(
      `Race Mark: ${mark.name}`,
      `Type: ${mark.type}\nRounding: ${mark.rounding}`
    );
  };

  const handleMapPress = (coordinates: any) => {
    logger.debug('Map pressed at:', coordinates);
  };

  const handleWeatherUpdate = (weather: any) => {
    setCurrentWeather(weather);
  };

  const handleNavigationCalculated = (result: any) => {
    showAlert(
      'Tactical Analysis',
      `Distance: ${result.distance.nauticalMiles} nm\n` +
      `Bearing: ${result.bearing.true}°T\n` +
      `ETA: ${result.time.estimatedDuration * 60} minutes\n` +
      `Recommendation: ${result.time.courseRecommendation}`
    );
  };

  // Create sample extracted course data for demonstration
  const createSampleExtractedCourse = (): RaceCourseExtraction => ({
    courseLayout: {
      type: 'windward_leeward',
      description: 'Windward/leeward course with start and finish at committee boat',
      confidence: 0.9
    },
    marks: [
      {
        name: 'Committee Boat',
        position: {
          latitude: 37.8,
          longitude: -122.4,
          description: 'Committee boat at north end of start line',
          confidence: 0.95
        },
        type: 'start',
        color: 'orange',
        shape: 'boat'
      },
      {
        name: 'Pin End',
        position: {
          latitude: 37.799,
          longitude: -122.401,
          description: 'Pin buoy at south end of start line',
          confidence: 0.95
        },
        type: 'start',
        color: 'orange',
        shape: 'cylindrical'
      },
      {
        name: 'Windward Mark',
        position: {
          latitude: 37.82,
          longitude: -122.39,
          description: 'Yellow inflatable buoy to be rounded to port',
          confidence: 0.85
        },
        type: 'windward',
        color: 'yellow',
        shape: 'inflatable'
      },
      {
        name: 'Leeward Gate Port',
        position: {
          latitude: 37.785,
          longitude: -122.405,
          description: 'Red inflatable buoy - port gate mark',
          confidence: 0.8
        },
        type: 'leeward',
        color: 'red',
        shape: 'inflatable'
      },
      {
        name: 'Leeward Gate Starboard',
        position: {
          latitude: 37.785,
          longitude: -122.395,
          description: 'Red inflatable buoy - starboard gate mark',
          confidence: 0.8
        },
        type: 'leeward',
        color: 'red',
        shape: 'inflatable'
      }
    ],
    boundaries: [],
    schedule: {
      warningSignal: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      preparatorySignal: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      startingSignal: new Date(Date.now() + 0), // Now
      confidence: 0.9
    },
    distances: {
      beat: {
        distance: 1.2,
        unit: 'nm',
        bearing: 45,
        confidence: 0.85
      },
      run: {
        distance: 1.2,
        unit: 'nm',
        bearing: 225,
        confidence: 0.85
      },
      total: {
        distance: 3.6,
        unit: 'nm',
        confidence: 0.8
      }
    },
    startLine: {
      type: 'line',
      description: 'Start line between committee boat and pin buoy',
      bias: 'neutral',
      length: 150,
      confidence: 0.9
    },
    requirements: {
      equipment: ['Life jackets', 'VHF Radio', 'Sound signals'],
      crew: ['Maximum 4 crew'],
      safety: ['Check in required before start'],
      registration: ['Online registration by 10:00 AM'],
      confidence: 0.7
    },
    weatherLimits: {
      windMax: 25,
      waveMax: 2,
      visibility: 1000,
      thunderstorm: false,
      confidence: 0.8
    },
    communication: {
      vhfChannel: '72',
      callSign: 'Race Committee',
      confidence: 0.9
    },
    regulations: {
      specialFlags: ['Code flag P - Preparatory'],
      penalties: ['Two-turn penalty for infringements'],
      protests: ['Must be filed within 2 hours of finish'],
      confidence: 0.8
    },
    extractionMetadata: {
      documentType: 'sailing_instructions',
      source: 'SF Bay Race Week - Sailing Instructions.pdf',
      extractedAt: new Date(),
      overallConfidence: 0.85,
      processingNotes: ['GPS coordinates extracted from document', 'Schedule parsed successfully']
    }
  });

  const handleCourseVisualizationToggle = () => {
    setCourseVisualizationMode(!courseVisualizationMode);
    if (!courseVisualizationMode && !extractedCourse) {
      // Create sample course when entering visualization mode
      setExtractedCourse(createSampleExtractedCourse());
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Mode Toggle */}
      <View style={styles.header}>
        <ThemedText type="title">
          {courseVisualizationMode ? 'Course Visualization' :
           professionalMode ? 'RegattaFlow Professional' : 'RegattaFlow Standard'}
        </ThemedText>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              courseVisualizationMode && styles.activeModeButton
            ]}
            onPress={handleCourseVisualizationToggle}
          >
            <ThemedText
              type="subtitle"
              style={[
                { textAlign: 'center' },
                courseVisualizationMode && { color: '#FFFFFF' }
              ]}
            >
              🏁 Course AI
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              !professionalMode && !courseVisualizationMode && styles.activeModeButton
            ]}
            onPress={() => {
              setProfessionalMode(false);
              setCourseVisualizationMode(false);
            }}
          >
            <ThemedText
              type="subtitle"
              style={[
                { textAlign: 'center' },
                !professionalMode && !courseVisualizationMode && { color: '#FFFFFF' }
              ]}
            >
              Standard
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              professionalMode && !courseVisualizationMode && styles.activeModeButton
            ]}
            onPress={() => {
              setProfessionalMode(true);
              setCourseVisualizationMode(false);
            }}
          >
            <ThemedText
              type="subtitle"
              style={[
                { textAlign: 'center' },
                professionalMode && !courseVisualizationMode && { color: '#FFFFFF' }
              ]}
            >
              Professional
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Venue Selection */}
      <View style={styles.venueSelector}>
        <ThemedText style={styles.venueLabel}>Venue:</ThemedText>
        {['san-francisco-bay', 'newport-rhode-island', 'cowes-isle-of-wight', 'sydney-harbour'].map(venue => (
          <ThemedText
            key={venue}
            style={[
              styles.venueOption,
              currentVenue === venue && styles.activeVenueOption
            ]}
            onPress={() => setCurrentVenue(venue)}
          >
            {venue.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </ThemedText>
        ))}
      </View>

      {/* Render appropriate map component */}
      {courseVisualizationMode ? (
        <RaceCourseVisualization
          courseExtraction={extractedCourse}
          weather={sampleWeather}
          onMarkPress={handleMarkPress}
        />
      ) : professionalMode ? (
        <ProfessionalMapScreen
          venue={currentVenue}
          marks={sampleMarks}
          initialWeather={currentWeather}
          onMarkPress={handleMarkPress}
          onMapPress={handleMapPress}
          onWeatherUpdate={handleWeatherUpdate}
          onNavigationCalculated={handleNavigationCalculated}
          professionalMode={true}
        />
      ) : (
        <Map3DView
          marks={sampleMarks}
          weather={sampleWeather}
          onMarkPress={handleMarkPress}
          onMapPress={handleMapPress}
        />
      )}

      {/* Course Visualization Info Panel */}
      {courseVisualizationMode && extractedCourse && (
        <View style={styles.courseInfo}>
          <View style={styles.infoRow}>
            <ThemedText type="default">
              🏁 {extractedCourse.courseLayout.type.replace('_', ' ').toUpperCase()}
            </ThemedText>
            <ThemedText type="default">
              ✅ {Math.round(extractedCourse.extractionMetadata.overallConfidence * 100)}% confidence
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="default">
              📍 {extractedCourse.marks.length} marks extracted
            </ThemedText>
            <ThemedText type="default">
              📄 {extractedCourse.extractionMetadata.source.split('.')[0]}
            </ThemedText>
          </View>
          {selectedMark && (
            <View style={styles.selectedInfo}>
              <ThemedText type="subtitle">Selected: {selectedMark.name}</ThemedText>
              <ThemedText type="default">Type: {selectedMark.type}</ThemedText>
            </View>
          )}
        </View>
      )}

      {/* Professional Info Panel */}
      {professionalMode && !courseVisualizationMode && currentWeather && (
        <View style={styles.professionalInfo}>
          <View style={styles.infoRow}>
            <ThemedText type="default">
              📍 {currentVenue.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </ThemedText>
            <ThemedText type="default">
              🌬️ {currentWeather.wind.speed.toFixed(1)}kts @ {currentWeather.wind.direction}° •
              📊 {Math.round(currentWeather.forecast.confidence * 100)}% confidence
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="default">
              🌊 Pressure: {currentWeather.pressure.sealevel.toFixed(1)}mb ({currentWeather.pressure.trend})
            </ThemedText>
            <ThemedText type="default">
              📡 {currentWeather.forecast.source}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Standard Info Panel */}
      {!professionalMode && !courseVisualizationMode && (
        <View style={styles.info}>
          <View style={styles.infoRow}>
            <ThemedText type="default">📍 Race Area: San Francisco Bay</ThemedText>
            <ThemedText type="default">
              🌬️ {sampleWeather.wind.speed}kts SW • 🌊 {sampleWeather.tide.speed}kt flood
            </ThemedText>
          </View>
          {selectedMark && (
            <View style={styles.selectedInfo}>
              <ThemedText type="subtitle">Selected: {selectedMark.name}</ThemedText>
              <ThemedText type="default">Type: {selectedMark.type}</ThemedText>
            </View>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    textAlign: 'center',
    minWidth: 80,
  },
  activeModeButton: {
    backgroundColor: '#0066CC',
    color: '#FFFFFF',
  },
  venueSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  venueLabel: {
    fontWeight: '600',
    color: '#666666',
  },
  venueOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    fontSize: 12,
    textAlign: 'center',
  },
  activeVenueOption: {
    backgroundColor: '#0066CC',
    color: '#FFFFFF',
  },
  info: {
    marginTop: 16,
    gap: 8,
  },
  courseInfo: {
    marginTop: 16,
    gap: 8,
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  professionalInfo: {
    marginTop: 16,
    gap: 8,
    backgroundColor: '#000000',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00FF88',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedInfo: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
});
