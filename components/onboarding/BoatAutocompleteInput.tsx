/**
 * Boat Autocomplete Input Component
 * Provides autocomplete suggestions for boat classes and equipment
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Platform } from 'react-native';
import { searchBoatClasses, searchEquipmentMakers, getAllEquipmentMakers, searchBoatNames, searchSailNumbers } from '@/services/BoatEquipmentSuggestions';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  type: 'boatClass' | 'hullMaker' | 'rigMaker' | 'sailMaker' | 'boatName' | 'sailNumber';
  boatClassName?: string; // Required for equipment autocomplete
  region?: 'hong_kong' | 'international' | 'both';
}

export function BoatAutocompleteInput({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  type,
  boatClassName,
  region,
}: AutocompleteInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    // Don't show suggestions if not focused
    if (!isFocused) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // For boatName and sailNumber, require at least 1 character
    // For other fields, show suggestions even when empty
    const requiresInput = type === 'boatName' || type === 'sailNumber';
    if (requiresInput && !value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        let newSuggestions: string[] = [];

        if (type === 'boatClass') {
          const classSuggestions = searchBoatClasses(value || '', region);
          newSuggestions = classSuggestions.map(c => c.name);
        } else if (type === 'boatName') {
          // Search boat names from database - require at least 1 char
          if (value.trim().length >= 1) {
            newSuggestions = await searchBoatNames(value, boatClassName);
          }
        } else if (type === 'sailNumber') {
          // Search sail numbers from database - require at least 1 char
          if (value.trim().length >= 1) {
            newSuggestions = await searchSailNumbers(value, boatClassName);
          }
        } else {
          // Equipment autocomplete - show suggestions even when empty
          const equipmentType = type === 'hullMaker' ? 'hull' : type === 'rigMaker' ? 'rig' : 'sail';
          
          // Get all makers as fallback
          const allMakers = getAllEquipmentMakers(equipmentType);
          const normalizedQuery = (value || '').toLowerCase().trim();
          
          if (boatClassName && boatClassName.trim()) {
            // If boat class is selected, try class-specific makers first
            const classSpecificMakers = searchEquipmentMakers(equipmentType, boatClassName, value || '');
            
            // If we have class-specific makers, use them; otherwise fall back to all makers
            if (classSpecificMakers.length > 0) {
              newSuggestions = classSpecificMakers;
            } else {
              // Fallback to all makers filtered by query
              if (normalizedQuery) {
                newSuggestions = allMakers.filter(maker => 
                  maker.toLowerCase().includes(normalizedQuery)
                );
              } else {
                newSuggestions = allMakers;
              }
            }
          } else {
            // If no boat class selected, show all makers for this type, filtered by query
            if (normalizedQuery) {
              newSuggestions = allMakers.filter(maker => 
                maker.toLowerCase().includes(normalizedQuery)
              );
            } else {
              // Show all makers when field is focused but empty
              newSuggestions = allMakers;
            }
          }
        }

        // Only update state if the effect hasn't been cancelled
        if (!cancelled) {
          const limitedSuggestions = newSuggestions.slice(0, 10);
          setSuggestions(limitedSuggestions);
          setShowSuggestions(limitedSuggestions.length > 0);
        }
      } catch (error) {
        console.warn('[BoatAutocompleteInput] Error loading suggestions:', error);
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    };

    // Add a small delay to debounce rapid typing
    const timeoutId = setTimeout(() => {
      loadSuggestions();
    }, type === 'boatName' || type === 'sailNumber' ? 300 : 100);

    // Cleanup function to cancel if value changes or component unmounts
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [value, isFocused, type, boatClassName, region]);

  const handleSelectSuggestion = (suggestion: string) => {
    onChangeText(suggestion);
    setIsFocused(false);
    setShowSuggestions(false);
  };

  return (
    <View 
      className="mb-3"
      style={Platform.select({
        web: {
          zIndex: showSuggestions ? 100000 : 'auto',
          position: 'relative',
          overflow: 'visible',
          isolation: showSuggestions ? 'isolate' : 'auto',
          paddingBottom: showSuggestions ? 290 : 0,
        } as any,
        default: {
          paddingBottom: showSuggestions ? 290 : 0,
        },
      })}
    >
      <Text className="text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      <View style={[
        styles.inputContainer,
        Platform.select({
          web: {
            zIndex: showSuggestions ? 100000 : 'auto',
            position: 'relative',
            overflow: 'visible',
          } as any,
          default: {},
        }),
      ]}>
        <TextInput
          className="bg-white border border-gray-300 rounded-lg px-3 py-2"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay hiding suggestions to allow tap on suggestion
            setTimeout(() => {
              setIsFocused(false);
              setShowSuggestions(false);
            }, 200);
          }}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <View 
            style={[
              styles.suggestionsContainer,
              Platform.select({
                web: {
                  backgroundColor: '#FFFFFF',
                  opacity: 1,
                  zIndex: 100001,
                  position: 'absolute',
                  display: 'block',
                } as any,
                default: {},
              }),
            ]}
          >
            <FlatList
              data={suggestions}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.suggestionItem,
                    hoveredIndex === index && styles.suggestionItemHovered,
                    Platform.select({
                      web: {
                        backgroundColor: hoveredIndex === index ? '#DBEAFE' : '#FFFFFF',
                        opacity: 1,
                      } as any,
                      default: {},
                    }),
                  ]}
                  onPress={() => handleSelectSuggestion(item)}
                  onPressIn={() => setHoveredIndex(index)}
                  onPressOut={() => setHoveredIndex(null)}
                >
                  <Text 
                    style={[
                      styles.suggestionText,
                      Platform.select({
                        web: {
                          color: '#000000',
                          opacity: 1,
                        } as any,
                        default: {},
                      }),
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              style={[
                styles.suggestionsList,
                Platform.select({
                  web: {
                    backgroundColor: '#FFFFFF',
                    opacity: 1,
                  } as any,
                  default: {},
                }),
              ]}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    position: 'relative',
    zIndex: 9999,
    ...Platform.select({
      web: {
        overflow: 'visible',
        zIndex: 9999,
        position: 'relative',
        isolation: 'isolate',
      } as any,
    }),
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 12,
    maxHeight: 280,
    zIndex: 99999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    ...Platform.select({
      web: {
        position: 'absolute',
        zIndex: 100001,
        overflow: 'visible',
        backgroundColor: '#FFFFFF',
        opacity: 1,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        borderStyle: 'solid',
        borderWidth: 3,
        borderColor: '#007AFF',
        backdropFilter: 'none',
        isolation: 'isolate',
        willChange: 'transform',
        transform: 'translateZ(0)',
        display: 'block',
        visibility: 'visible',
      } as any,
    }),
  },
  suggestionsList: {
    maxHeight: 280,
  },
  suggestionItem: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    minHeight: 56,
    ...Platform.select({
      web: {
        backgroundColor: '#FFFFFF',
        opacity: 1,
      } as any,
    }),
  },
  suggestionItemHovered: {
    backgroundColor: '#DBEAFE',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    paddingLeft: 16,
    ...Platform.select({
      web: {
        backgroundColor: '#DBEAFE',
        opacity: 1,
      } as any,
    }),
  },
  suggestionText: {
    fontSize: 20,
    fontWeight: Platform.select({
      web: '700',
      ios: '700',
      android: '700',
      default: 'bold',
    }) as any,
    color: '#000000',
    lineHeight: 26,
    ...Platform.select({
      web: {
        letterSpacing: '0.3px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#000000',
        opacity: 1,
      },
      default: {},
    }),
  },
});

