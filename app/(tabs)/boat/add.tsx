/**
 * Add Boat Screen - Create new boat
 */

import { useAuth } from '@/providers/AuthProvider';
import { sailorBoatService, type CreateBoatInput } from '@/services/SailorBoatService';
import { supabase } from '@/services/supabase';
import { DRAGON_HULL_MAKER_NAMES } from '@/constants/boatEquipment';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { createLogger } from '@/lib/utils/logger';

interface BoatClass {
  id: string;
  name: string;
  class_association?: string;
  type?: string;
}

const logger = createLogger('AddBoatScreen');

export default function AddBoatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [boatClasses, setBoatClasses] = useState<BoatClass[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [sailNumber, setSailNumber] = useState('');
  const [hullNumber, setHullNumber] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [manufacturer, setManufacturer] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [hullMaterial, setHullMaterial] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [ownershipType, setOwnershipType] = useState<'owned' | 'co_owned' | 'chartered' | 'club_boat' | 'crew'>('owned');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showManufacturerPicker, setShowManufacturerPicker] = useState(false);
  const [usingFallbackClasses, setUsingFallbackClasses] = useState(false);

  useEffect(() => {
    loadBoatClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback mock data for common boat classes
  const FALLBACK_BOAT_CLASSES: BoatClass[] = [
    { id: 'mock-laser', name: 'Laser', class_association: 'ILCA' },
    { id: 'mock-420', name: '420', class_association: 'International 420 Class' },
    { id: 'mock-optimist', name: 'Optimist', class_association: 'IODA' },
    { id: 'mock-470', name: '470', class_association: 'International 470 Class' },
    { id: 'mock-49er', name: '49er', class_association: 'International 49er Class' },
    { id: 'mock-finn', name: 'Finn', class_association: 'International Finn Association' },
    { id: 'mock-nacra-17', name: 'Nacra 17', class_association: 'International Catamaran Federation' },
    { id: 'mock-j70', name: 'J/70', class_association: 'J/70 Class Association' },
    { id: 'mock-melges-24', name: 'Melges 24', class_association: 'International Melges 24 Class' },
    { id: 'mock-star', name: 'Star', class_association: 'International Star Class' },
    { id: 'mock-snipe', name: 'Snipe', class_association: 'SCIRA' },
    { id: 'mock-other', name: 'Other / Custom', class_association: undefined },
  ];

  const loadBoatClasses = async () => {
    logger.debug('Loading boat classes...');
    try {
      setLoadingClasses(true);

      // Create a timeout promise (15 seconds - increased for mobile networks)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000)
      );

      // Race the Supabase query against the timeout
      const supabasePromise = supabase
        .from('boat_classes')
        .select('*')
        .order('name');

      const { data, error } = await Promise.race([
        supabasePromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('[AddBoatScreen] Supabase error loading classes:', error);
        throw error;
      }

      logger.debug('Loaded boat classes from Supabase:', data?.length ?? 0);
      if (data && data.length > 0) {
        setBoatClasses(data);
        setUsingFallbackClasses(false);
      } else {
        setBoatClasses(FALLBACK_BOAT_CLASSES);
        setUsingFallbackClasses(true);
      }
    } catch (error) {
      console.error('[AddBoatScreen] Error loading boat classes, using fallback data:', error);

      // Use fallback data instead of blocking the UI
      setBoatClasses(FALLBACK_BOAT_CLASSES);
      setUsingFallbackClasses(true);

      // Show a non-blocking alert
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Using offline boat class data:', errorMessage);
      // Use a timeout to allow the UI to render first
      setTimeout(() => {
        showAlert('Using Offline Data', 'Could not connect to server. Using a default list of boat classes.');
      }, 100);
    } finally {
      setLoadingClasses(false);
      logger.debug('loadBoatClasses finished, loadingClasses set to false');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      showAlert('Permission Required', 'Please grant camera roll permissions to upload photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {

    if (!user) {

      showAlert('Error', 'Not authenticated. Please sign in.');
      return;
    }

    // Validation
    if (!name.trim()) {

      showAlert('Required Field', 'Please enter a boat name');
      return;
    }

    if (!selectedClassId) {

      showAlert('Required Field', 'Please select a boat class');
      return;
    }

    // Check if using fallback/mock classes (they won't work with the database)
    if (usingFallbackClasses || selectedClassId.startsWith('mock-')) {
      showConfirm(
        'Connection Required',
        'Unable to connect to server to load boat classes. Please check your internet connection and try again.',
        loadBoatClasses,
        { confirmText: 'Retry' }
      );
      return;
    }

    try {
      setLoading(true);

      const boatInput: CreateBoatInput = {
        sailor_id: user.id,
        class_id: selectedClassId,
        name: name.trim(),
        sail_number: sailNumber.trim() || undefined,
        hull_number: hullNumber.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        year_built: yearBuilt ? parseInt(yearBuilt) : undefined,
        hull_material: hullMaterial.trim() || undefined,
        is_primary: isPrimary,
        ownership_type: ownershipType,
        notes: notes.trim() || undefined,
      };

      // Add timeout to detect hanging requests
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 10 seconds')), 10000)
      );

      const boat = await Promise.race([
        sailorBoatService.createBoat(boatInput),
        timeoutPromise
      ]) as any;

      // TODO: Upload photo to Supabase storage if photoUri exists
      // For now, we'll skip photo upload as it requires storage bucket setup

      // Auto-join the worldwide class fleet for this boat's class so
      // the user shows up as fleet-mates to other declared sailors of
      // the same class on Atlas. Idempotent + best-effort — never block
      // the success message on the membership write.
      try {
        await supabase.rpc('ensure_class_fleet_membership_by_id', {
          class_id: selectedClassId,
        });
      } catch {
        // Best-effort; the boat is already saved.
      }

      showAlert('Success', 'Boat added successfully');
      router.push(`/boat/${boat.id}`);
    } catch (error) {




      // Try to extract Supabase error details
      const supabaseError = error as any;
      if (supabaseError?.message) {

      }
      if (supabaseError?.details) {

      }
      if (supabaseError?.hint) {

      }
      if (supabaseError?.code) {

      }


      const errorMessage = error instanceof Error ? error.message :
                          supabaseError?.message ||
                          'Unknown error';

      showAlert('Error', `Failed to save boat: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const selectedClass = boatClasses.find(bc => bc.id === selectedClassId);

  if (loadingClasses) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading boat classes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={insets.top}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Boat</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.headerButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Boat Photo</Text>
            <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={32} color="#94A3B8" />
                  <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Boat Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Dragonfly"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Boat Class *</Text>
              {usingFallbackClasses && (
                <View style={styles.offlineWarning}>
                  <Ionicons name="cloud-offline" size={16} color="#F59E0B" />
                  <Text style={styles.offlineWarningText}>
                    Offline mode - connect to internet to save
                  </Text>
                  <TouchableOpacity onPress={loadBoatClasses} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[styles.picker, usingFallbackClasses && styles.pickerDisabled]}
                onPress={() => setShowClassPicker(!showClassPicker)}
              >
                <Text style={selectedClass ? styles.pickerText : styles.pickerPlaceholder}>
                  {selectedClass ? selectedClass.name : 'Select boat class'}
                </Text>
                <Ionicons
                  name={showClassPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {showClassPicker && (
                <View style={styles.pickerOptions}>
                  <ScrollView style={styles.pickerScroll}>
                    {boatClasses.map((boatClass) => (
                      <TouchableOpacity
                        key={boatClass.id}
                        style={styles.pickerOption}
                        onPress={() => {
                          setSelectedClassId(boatClass.id);
                          setShowClassPicker(false);
                        }}
                      >
                        <Text style={styles.pickerOptionText}>{boatClass.name}</Text>
                        {boatClass.class_association && (
                          <Text style={styles.pickerOptionSubtext}>
                            {boatClass.class_association}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sail Number</Text>
              <TextInput
                style={styles.input}
                value={sailNumber}
                onChangeText={setSailNumber}
                placeholder="e.g., USA 123"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hull Number</Text>
              <TextInput
                style={styles.input}
                value={hullNumber}
                onChangeText={setHullNumber}
                placeholder="e.g., ABC12345"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Boat Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Boat Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hull Manufacturer</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowManufacturerPicker(!showManufacturerPicker)}
              >
                <Text style={manufacturer ? styles.pickerText : styles.pickerPlaceholder}>
                  {manufacturer || 'Select hull manufacturer'}
                </Text>
                <Ionicons
                  name={showManufacturerPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {showManufacturerPicker && (
                <View style={styles.pickerOptions}>
                  <ScrollView style={styles.pickerScroll}>
                    {/* Option to clear selection */}
                    <TouchableOpacity
                      style={styles.pickerOption}
                      onPress={() => {
                        setManufacturer('');
                        setShowManufacturerPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerOptionText, { color: '#94A3B8' }]}>
                        None / Other
                      </Text>
                    </TouchableOpacity>
                    {DRAGON_HULL_MAKER_NAMES.map((maker) => (
                      <TouchableOpacity
                        key={maker}
                        style={styles.pickerOption}
                        onPress={() => {
                          setManufacturer(maker);
                          setShowManufacturerPicker(false);
                        }}
                      >
                        <Text style={styles.pickerOptionText}>{maker}</Text>
                      </TouchableOpacity>
                    ))}
                    {/* Option for custom entry */}
                    <TouchableOpacity
                      style={[styles.pickerOption, { backgroundColor: '#F8FAFC' }]}
                      onPress={() => {
                        setShowManufacturerPicker(false);
                        // Keep manufacturer field editable for custom entry
                      }}
                    >
                      <Text style={[styles.pickerOptionText, { fontStyle: 'italic', color: '#3B82F6' }]}>
                        Enter custom manufacturer...
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              {/* Allow custom text entry when not using picker */}
              {!showManufacturerPicker && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={manufacturer}
                  onChangeText={setManufacturer}
                  placeholder="Or type custom manufacturer"
                  placeholderTextColor="#94A3B8"
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Year Built</Text>
              <TextInput
                style={styles.input}
                value={yearBuilt}
                onChangeText={setYearBuilt}
                placeholder="e.g., 2020"
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hull Material</Text>
              <TextInput
                style={styles.input}
                value={hullMaterial}
                onChangeText={setHullMaterial}
                placeholder="e.g., Carbon fiber"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Ownership */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ownership</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ownership Type</Text>
              <View style={styles.radioGroup}>
                {(['owned', 'co_owned', 'chartered', 'club_boat', 'crew'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.radioOption}
                    onPress={() => setOwnershipType(type)}
                  >
                    <View style={styles.radio}>
                      {ownershipType === type && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>
                      {type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsPrimary(!isPrimary)}
            >
              <View style={styles.checkbox}>
                {isPrimary && <Ionicons name="checkmark" size={18} color="#3B82F6" />}
              </View>
              <Text style={styles.checkboxLabel}>Set as primary boat for this class</Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes about this boat..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={[styles.bottomSpacer, { height: 32 + insets.bottom + 80 }]} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  photoContainer: {
    alignSelf: 'center',
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  pickerText: {
    fontSize: 16,
    color: '#1E293B',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#94A3B8',
  },
  pickerDisabled: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  offlineWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pickerOptions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    maxHeight: 200,
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#1E293B',
  },
  pickerOptionSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  radioLabel: {
    fontSize: 16,
    color: '#1E293B',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1E293B',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    minHeight: 100,
  },
  bottomSpacer: {
    height: 32,
  },
});
