import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { ChevronRight, Plus, User, Users } from 'lucide-react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useRouter } from 'expo-router';
import { useSailorOnboardingState, type SailorCrewData, type SailorCrewMember } from '@/hooks/useSailorOnboardingState';

// Common sailing crew roles
const CREW_ROLES = [
  "Skipper",
  "Tactician",
  "Navigator",
  "Mastman",
  "Bowman",
  "Helmsman",
  "Trimmer",
  "Pitman",
];

export default function CrewScreen() {
  const router = useRouter();
  const { state, updateCrew, loading } = useSailorOnboardingState();
  const [crewMembers, setCrewMembers] = useState<SailorCrewMember[]>(() => state.crew?.crewMembers ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  
  const [newMember, setNewMember] = useState({ name: '', role: '' });
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  const [filteredRoles, setFilteredRoles] = useState(CREW_ROLES);

  useEffect(() => {
    setCrewMembers(state.crew?.crewMembers ?? []);
  }, [state.crew?.crewMembers]);

  const persistCrewMembers = useCallback(
    (members: SailorCrewMember[]) => {
      setCrewMembers(members);
      const nextCrewData: SailorCrewData = {
        crewMembers: members,
        lookingForCrew: state.crew?.lookingForCrew ?? false,
        crewRoles: Array.from(
          new Set(members.map(member => member.role).filter(Boolean))
        ),
      };
      updateCrew(nextCrewData);
    },
    [state.crew?.lookingForCrew, updateCrew]
  );

  const generateMemberId = () => `crew-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const handleAddMember = async () => {
    if (isAddingMember) return;

    try {
      setIsAddingMember(true);

      if (!newMember.name.trim() || !newMember.role.trim()) {
        showAlert('Missing info', 'Please enter both name and role');
        return;
      }

      const member: SailorCrewMember = {
        id: generateMemberId(),
        name: newMember.name.trim(),
        role: newMember.role.trim(),
      };

      const updatedMembers = [...crewMembers, member];
      setCrewMembers(updatedMembers);
      persistCrewMembers(updatedMembers);

      // Reset form
      setNewMember({ name: '', role: '' });
      setShowRoleSuggestions(false);
    } catch (error) {
      console.error('Error adding crew member:', error);
      showAlert('Error', 'Failed to add crew member. Please try again.');
    } finally {
      setIsAddingMember(false);
    }
  };

  const filterRoles = (text: string) => {
    setNewMember(prev => ({ ...prev, role: text }));
    if (text.length > 0) {
      const filtered = CREW_ROLES.filter(role => 
        role.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredRoles(filtered);
      setShowRoleSuggestions(true);
    } else {
      setShowRoleSuggestions(false);
    }
  };

  const selectRole = (role: string) => {
    setNewMember(prev => ({ ...prev, role }));
    setShowRoleSuggestions(false);
  };

  const removeCrewMember = (id: string) => {
    const updated = crewMembers.filter(member => member.id !== id);
    persistCrewMembers(updated);
  };

  const handleContinueToReview = () => {
    try {
      setIsSaving(true);
      if (crewMembers.length > 0) {
        persistCrewMembers(crewMembers);
      }
      router.push('/review');
    } catch (error: any) {
      console.error('Error continuing to review:', error);
      showAlert('Unable to continue', 'Please try again in a moment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/review');
  };

  const canContinue = !isSaving;

  return (
    <View className="flex-1 bg-white">
      {/* Progress Header */}
      <View className="bg-blue-600 px-4 pt-12 pb-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-semibold">Step 4 of 5</Text>
          <Text className="text-white text-sm">1:15 remaining</Text>
        </View>
        
        {/* Progress Bar */}
        <View className="h-2 bg-blue-400 rounded-full">
          <View className="w-[80%] h-2 bg-white rounded-full" />
        </View>
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4">
        <View className="mt-6">
          <Text className="text-2xl font-bold text-gray-800 mb-2">
            Add Your Crew
          </Text>
          <Text className="text-gray-500 mb-4">
            Optionally add crew members now, or skip and add them later
          </Text>

          {/* Educational tip about CrewHub */}
          <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <View className="flex-row items-center mb-2">
              <Users size={18} color="#007AFF" />
              <Text className="text-blue-800 font-semibold ml-2">Crew Hub Available Later</Text>
            </View>
            <Text className="text-blue-700 text-sm">
              You can manage your full crew roster anytime from your race cards.
              This includes assigning positions, inviting coaches, and tracking who you sail with.
            </Text>
          </View>

          {/* Add Crew Member Form */}
          <View className="mb-8 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-4">
              Quick Add Crew Member
            </Text>

            {/* Name Input */}
            <View className="mb-4">
              <Text className="text-gray-800 font-medium mb-2">Name</Text>
              <TextInput
                value={newMember.name}
                onChangeText={(text) => setNewMember(prev => ({ ...prev, name: text }))}
                placeholder="Enter crew member name"
                className="bg-white border border-gray-200 rounded-xl p-4 text-base"
              />
            </View>
            
            {/* Role Input with Auto-Suggest */}
            <View className="mb-4">
              <Text className="text-gray-800 font-medium mb-2">Role</Text>
              <View className="relative">
                <TextInput
                  value={newMember.role}
                  onChangeText={filterRoles}
                  onFocus={() => newMember.role.length > 0 && setShowRoleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowRoleSuggestions(false), 150)}
                  placeholder="Enter crew role"
                  className="bg-white border border-gray-200 rounded-xl p-4 text-base"
                />
                {showRoleSuggestions && filteredRoles.length > 0 && (
                  <View className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 z-10 shadow-lg">
                    <FlatList
                      data={filteredRoles}
                      keyExtractor={(item) => item}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          className="p-3 border-b border-gray-100"
                          onPress={() => selectRole(item)}
                        >
                          <Text className="text-gray-800">{item}</Text>
                        </TouchableOpacity>
                      )}
                      scrollEnabled={filteredRoles.length > 4}
                      style={{ maxHeight: 200 }}
                    />
                  </View>
                )}
              </View>
            </View>
            
            {/* Add Button */}
            <TouchableOpacity 
              onPress={handleAddMember}
              activeOpacity={0.8}
              disabled={isAddingMember}
              style={{
                backgroundColor: isAddingMember ? '#94A3B8' : '#007AFF',
                borderRadius: 12,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                opacity: isAddingMember ? 0.6 : 1,
              }}
            >
              {isAddingMember ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Plus size={20} color="white" style={{ marginRight: 8 }} />
                  <Text 
                    style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}
                  >
                    Add Crew Member
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Current Crew Members */}
          <View>
            <Text className="text-lg font-semibold text-gray-800 mb-4">
              Current Crew ({crewMembers.length})
            </Text>
            
            {loading ? (
              <View className="bg-gray-50 rounded-xl p-8 items-center justify-center">
                <ActivityIndicator size="large" color="#007AFF" />
                <Text className="text-gray-500 mt-4">Loading crew preferences...</Text>
              </View>
            ) : crewMembers.length === 0 ? (
              <View className="bg-gray-50 rounded-xl p-6 items-center justify-center">
                <Users size={40} color="#9CA3AF" />
                <Text className="text-gray-500 text-center mt-3">
                  No crew added yet. Skip this step or add someone above.
                </Text>
              </View>
            ) : (
              <FlatList
                data={crewMembers}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                        <User size={20} color="#007AFF" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-gray-800">{item.name}</Text>
                        <Text className="text-blue-600 text-sm">{item.role}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeCrewMember(item.id)}>
                        <Text className="text-red-500 font-medium">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View className="px-4 py-4 border-t border-gray-200 bg-white">
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 rounded-xl py-4 flex-row items-center justify-center border border-gray-300 bg-white"
            onPress={handleSkip}
          >
            <Text className="text-gray-700 font-semibold text-lg">
              Skip for Now
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-xl py-4 flex-row items-center justify-center ${canContinue ? 'bg-blue-600' : 'bg-gray-300'}`}
            disabled={!canContinue}
            onPress={handleContinueToReview}
          >
            <Text className="text-white font-semibold text-lg">
              {isSaving ? 'Saving...' : crewMembers.length > 0 ? 'Continue' : 'Skip'}
            </Text>
            <ChevronRight size={20} color="white" className="ml-2" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
