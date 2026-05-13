import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { CoachSearchFilters, SkillLevel, ServiceType } from '../../types/coach';

interface CoachFiltersProps {
  filters: CoachSearchFilters;
  onApply: (filters: CoachSearchFilters) => void;
  onClose: () => void;
}

const BOAT_CLASSES = [
  'dragon', 'j70', 'j80', 'melges-24', 'laser', '470', '49er', 'optimist', 'rc44'
];

const SPECIALTIES = [
  'tactics', 'spinnaker', 'heavy-weather', 'light-air', 'boat-tuning', 'match-racing', 'team-racing'
];

const SKILL_LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Chinese (Mandarin)'];

const SESSION_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'on_water', label: 'On-Water Coaching' },
  { value: 'video_review', label: 'Video Review' },
  { value: 'strategy_session', label: 'Strategy Session' },
  { value: 'race_analysis', label: 'Race Analysis' },
  { value: 'live_coaching', label: 'Live Coaching' },
];

const TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function CoachFilters({ filters, onApply, onClose }: CoachFiltersProps) {
  const [tempFilters, setTempFilters] = useState<CoachSearchFilters>(filters);

  const toggleArrayFilter = (
    key: 'boat_classes' | 'specialties' | 'skill_levels' | 'languages' | 'session_types',
    value: string
  ) => {
    const currentArray = tempFilters[key] || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];

    setTempFilters(prev => ({
      ...prev,
      [key]: newArray.length > 0 ? newArray : undefined,
    }));
  };

  const setTimeZone = (timezone: string | undefined) => {
    setTempFilters(prev => ({
      ...prev,
      time_zone: timezone,
    }));
  };

  const setMinMatchScore = (score: string) => {
    const scoreValue = parseFloat(score);
    if (isNaN(scoreValue) || scoreValue <= 0) {
      setTempFilters(prev => ({ ...prev, min_match_score: undefined }));
    } else {
      setTempFilters(prev => ({
        ...prev,
        min_match_score: Math.min(Math.max(scoreValue, 0), 1), // Clamp between 0 and 1
      }));
    }
  };

  const setPriceRange = (min: string, max: string) => {
    const minPrice = parseInt(min) * 100 || 0; // Convert to cents
    const maxPrice = parseInt(max) * 100 || 50000; // Max $500/hour

    if (minPrice === 0 && maxPrice === 50000) {
      setTempFilters(prev => ({ ...prev, price_range: undefined }));
    } else {
      setTempFilters(prev => ({
        ...prev,
        price_range: [minPrice, maxPrice],
      }));
    }
  };

  const setMinRating = (rating: number) => {
    setTempFilters(prev => ({
      ...prev,
      rating: rating > 0 ? rating : undefined,
    }));
  };

  const clearAllFilters = () => {
    setTempFilters({});
  };

  const handleApply = () => {
    onApply(tempFilters);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (tempFilters.boat_classes?.length) count++;
    if (tempFilters.specialties?.length) count++;
    if (tempFilters.skill_levels?.length) count++;
    if (tempFilters.price_range) count++;
    if (tempFilters.rating) count++;
    if (tempFilters.languages?.length) count++;
    if (tempFilters.session_types?.length) count++;
    if (tempFilters.time_zone) count++;
    if (tempFilters.min_match_score) count++;
    return count;
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={clearAllFilters}>
            <Text style={styles.clearButton}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Boat Classes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Boat Classes {tempFilters.boat_classes?.length ? `(${tempFilters.boat_classes.length})` : ''}
            </Text>
            <View style={styles.chipContainer}>
              {BOAT_CLASSES.map((boatClass) => (
                <TouchableOpacity
                  key={boatClass}
                  style={[
                    styles.chip,
                    tempFilters.boat_classes?.includes(boatClass) && styles.chipSelected
                  ]}
                  onPress={() => toggleArrayFilter('boat_classes', boatClass)}
                >
                  <Text style={[
                    styles.chipText,
                    tempFilters.boat_classes?.includes(boatClass) && styles.chipTextSelected
                  ]}>
                    {boatClass.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Specialties */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Specialties {tempFilters.specialties?.length ? `(${tempFilters.specialties.length})` : ''}
            </Text>
            <View style={styles.chipContainer}>
              {SPECIALTIES.map((specialty) => (
                <TouchableOpacity
                  key={specialty}
                  style={[
                    styles.chip,
                    tempFilters.specialties?.includes(specialty) && styles.chipSelected
                  ]}
                  onPress={() => toggleArrayFilter('specialties', specialty)}
                >
                  <Text style={[
                    styles.chipText,
                    tempFilters.specialties?.includes(specialty) && styles.chipTextSelected
                  ]}>
                    {specialty.replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Skill Levels */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Skill Levels {tempFilters.skill_levels?.length ? `(${tempFilters.skill_levels.length})` : ''}
            </Text>
            <View style={styles.chipContainer}>
              {SKILL_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.chip,
                    tempFilters.skill_levels?.includes(level) && styles.chipSelected
                  ]}
                  onPress={() => toggleArrayFilter('skill_levels', level)}
                >
                  <Text style={[
                    styles.chipText,
                    tempFilters.skill_levels?.includes(level) && styles.chipTextSelected
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Range (USD per hour)</Text>
            <View style={styles.priceInputs}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                value={tempFilters.price_range ? (tempFilters.price_range[0] / 100).toString() : ''}
                onChangeText={(value) => {
                  const maxValue = tempFilters.price_range ? (tempFilters.price_range[1] / 100).toString() : '500';
                  setPriceRange(value, maxValue);
                }}
                keyboardType="numeric"
              />
              <Text style={styles.priceRangeText}>to</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={tempFilters.price_range ? (tempFilters.price_range[1] / 100).toString() : ''}
                onChangeText={(value) => {
                  const minValue = tempFilters.price_range ? (tempFilters.price_range[0] / 100).toString() : '0';
                  setPriceRange(minValue, value);
                }}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Minimum Rating */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minimum Rating</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={[
                    styles.ratingButton,
                    tempFilters.rating && rating <= tempFilters.rating && styles.ratingButtonSelected
                  ]}
                  onPress={() => setMinRating(rating)}
                >
                  <Text style={[
                    styles.ratingButtonText,
                    tempFilters.rating && rating <= tempFilters.rating && styles.ratingButtonTextSelected
                  ]}>
                    ★ {rating}+
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Languages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Languages {tempFilters.languages?.length ? `(${tempFilters.languages.length})` : ''}
            </Text>
            <View style={styles.chipContainer}>
              {LANGUAGES.map((language) => (
                <TouchableOpacity
                  key={language}
                  style={[
                    styles.chip,
                    tempFilters.languages?.includes(language) && styles.chipSelected
                  ]}
                  onPress={() => toggleArrayFilter('languages', language)}
                >
                  <Text style={[
                    styles.chipText,
                    tempFilters.languages?.includes(language) && styles.chipTextSelected
                  ]}>
                    {language}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Session Types */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Session Types {tempFilters.session_types?.length ? `(${tempFilters.session_types.length})` : ''}
            </Text>
            <View style={styles.chipContainer}>
              {SESSION_TYPES.map((sessionType) => (
                <TouchableOpacity
                  key={sessionType.value}
                  style={[
                    styles.chip,
                    tempFilters.session_types?.includes(sessionType.value) && styles.chipSelected
                  ]}
                  onPress={() => toggleArrayFilter('session_types', sessionType.value)}
                >
                  <Text style={[
                    styles.chipText,
                    tempFilters.session_types?.includes(sessionType.value) && styles.chipTextSelected
                  ]}>
                    {sessionType.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Time Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Zone</Text>
            <View style={styles.chipContainer}>
              {TIME_ZONES.map((timezone) => (
                <TouchableOpacity
                  key={timezone}
                  style={[
                    styles.chip,
                    tempFilters.time_zone === timezone && styles.chipSelected
                  ]}
                  onPress={() => setTimeZone(tempFilters.time_zone === timezone ? undefined : timezone)}
                >
                  <Text style={[
                    styles.chipText,
                    tempFilters.time_zone === timezone && styles.chipTextSelected
                  ]}>
                    {timezone.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Minimum Match Score */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Minimum Match Score (0-1)
            </Text>
            <Text style={styles.sectionDescription}>
              Filter coaches by match score. Higher scores indicate better alignment with your goals.
            </Text>
            <TextInput
              style={styles.matchScoreInput}
              placeholder="e.g., 0.7 for 70% match"
              value={tempFilters.min_match_score?.toString() || ''}
              onChangeText={setMinMatchScore}
              keyboardType="decimal-pad"
            />
            {tempFilters.min_match_score && (
              <Text style={styles.matchScoreHint}>
                Showing coaches with {Math.round(tempFilters.min_match_score * 100)}%+ match
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.filtersCount}>
            {getActiveFiltersCount()} filters applied
          </Text>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeButton: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  clearButton: {
    fontSize: 16,
    color: '#0066CC',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  priceRangeText: {
    fontSize: 16,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  ratingButtonSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  ratingButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ratingButtonTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  filtersCount: {
    fontSize: 16,
    color: '#666',
  },
  applyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066CC',
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  matchScoreInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  matchScoreHint: {
    fontSize: 13,
    color: '#0066CC',
    fontWeight: '500',
  },
});
