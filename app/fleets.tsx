import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from '@/components/ui';
import { Search, Users, Bell, ChevronRight, Star, Zap, Globe } from 'lucide-react-native';

export default function FleetsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFleets, setSelectedFleets] = useState<number[]>([1]);
  const [notifications, setNotifications] = useState<{[key: number]: boolean}>({
    1: true,
    2: false,
    3: true
  });

  const toggleNotification = (fleetId: number) => {
    setNotifications(prev => ({
      ...prev,
      [fleetId]: !prev[fleetId]
    }));
  };

  const fleets = [
    {
      id: 1,
      name: 'RHKYC Dragons',
      description: 'Active fleet at Royal Hong Kong Yacht Club',
      members: 42,
      popularity: 'High',
      image: 'https://images.unsplash.com/photo-1543868100-0d584b46a694?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'
    },
    {
      id: 2,
      name: 'Aberdeen Internationals',
      description: 'International Dragon fleet at Aberdeen Marina',
      members: 28,
      popularity: 'Medium',
      image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'
    },
    {
      id: 3,
      name: 'Discovery Bay Racers',
      description: 'Competitive racing fleet',
      members: 19,
      popularity: 'High',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'
    },
    {
      id: 4,
      name: 'Hong Kong Buccaneers',
      description: 'Social sailing group',
      members: 35,
      popularity: 'Medium',
      image: 'https://images.unsplash.com/photo-1509587338418-1a8a9dcda1a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'
    }
  ];

  const aiSuggestions = [
    {
      id: 5,
      name: 'RHKYC Wednesday Racing',
      description: 'Suggested based on your boat selection',
      members: 24,
      popularity: 'High'
    },
    {
      id: 6,
      name: 'Dragon Class Championship Fleet',
      description: 'Recommended based on your boat class',
      members: 16,
      popularity: 'High'
    }
  ];

  return (
    <View className="flex-1 bg-white">
      {/* Progress Header */}
      <View className="bg-blue-600 px-4 pt-12 pb-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-semibold">Step 3 of 5</Text>
          <Text className="text-white text-sm">1:30 remaining</Text>
        </View>
        
        {/* Progress Bar */}
        <View className="h-2 bg-blue-400 rounded-full">
          <View className="w-[60%] h-2 bg-white rounded-full" />
        </View>
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4">
        <View className="mt-6">
          <Text className="text-2xl font-bold text-gray-800 mb-2">
            Discover Fleets
          </Text>
          <Text className="text-gray-500 mb-6">
            Join fleets to connect with sailors and get race notifications
          </Text>

          {/* Search Bar */}
          <View className="flex-row items-center bg-gray-100 rounded-xl p-3 mb-6">
            <Search size={20} className="text-gray-400 mr-2" />
            <TextInput
              placeholder="Search fleets..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-base text-gray-800"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Selected Fleets */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-800">Your Fleets</Text>
              <Text className="text-blue-600 text-sm">{selectedFleets.length} selected</Text>
            </View>
            
            {fleets
              .filter(fleet => selectedFleets.includes(fleet.id))
              .map((fleet) => (
                <View 
                  key={fleet.id} 
                  className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="w-12 h-12 rounded-lg mr-3 overflow-hidden">
                        <Image 
                          source={{ uri: fleet.image }} 
                          className="w-full h-full"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-blue-600 font-semibold text-lg">{fleet.name}</Text>
                        <Text className="text-blue-500 text-sm mt-1">{fleet.members} members</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      <TouchableOpacity 
                        className={`p-2 rounded-full mr-2 ${notifications[fleet.id] ? 'bg-blue-100' : 'bg-gray-100'}`}
                        onPress={() => toggleNotification(fleet.id)}
                      >
                        <Bell 
                          size={20} 
                          className={notifications[fleet.id] ? "text-blue-600" : "text-gray-400"} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setSelectedFleets(prev => prev.filter(id => id !== fleet.id))}
                      >
                        <Text className="text-blue-600 font-medium">Leave</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
          </View>

          {/* AI Suggestions */}
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Zap size={20} className="text-yellow-500 mr-2" />
              <Text className="text-lg font-semibold text-gray-800">Suggestions</Text>
            </View>
            
            {aiSuggestions.map((fleet) => (
              <TouchableOpacity
                key={fleet.id}
                className="flex-row items-center bg-white border border-gray-200 rounded-xl p-4 mb-3"
                onPress={() => {
                  if (!selectedFleets.includes(fleet.id)) {
                    setSelectedFleets([...selectedFleets, fleet.id]);
                  }
                }}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-12 h-12 rounded-lg bg-gray-100 items-center justify-center mr-3">
                    <Star size={24} className="text-yellow-500" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-800 font-semibold text-lg">{fleet.name}</Text>
                    <Text className="text-gray-500 text-sm mt-1">{fleet.description}</Text>
                    <View className="flex-row items-center mt-1">
                      <Users size={12} className="text-gray-400 mr-1" />
                      <Text className="text-gray-500 text-xs">{fleet.members} members</Text>
                      <View className="w-1 h-1 bg-gray-300 rounded-full mx-2" />
                      <Globe size={12} className="text-gray-400 mr-1" />
                      <Text className="text-gray-500 text-xs">{fleet.popularity} popularity</Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={20} className="text-gray-400" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Popular Fleets */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-4">
              Popular at your location
            </Text>
            
            {fleets
              .filter(fleet => !selectedFleets.includes(fleet.id))
              .map((fleet) => (
                <TouchableOpacity
                  key={fleet.id}
                  className="flex-row items-center bg-white border border-gray-200 rounded-xl p-4 mb-3"
                  onPress={() => {
                    if (!selectedFleets.includes(fleet.id)) {
                      setSelectedFleets([...selectedFleets, fleet.id]);
                    }
                  }}
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-12 h-12 rounded-lg mr-3 overflow-hidden">
                      <Image 
                        source={{ uri: fleet.image }} 
                        className="w-full h-full"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-800 font-semibold text-lg">{fleet.name}</Text>
                      <Text className="text-gray-500 text-sm mt-1">{fleet.description}</Text>
                      <View className="flex-row items-center mt-1">
                        <Users size={12} className="text-gray-400 mr-1" />
                        <Text className="text-gray-500 text-xs">{fleet.members} members</Text>
                        <View className="w-1 h-1 bg-gray-300 rounded-full mx-2" />
                        <Globe size={12} className="text-gray-400 mr-1" />
                        <Text className="text-gray-500 text-xs">{fleet.popularity} popularity</Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={20} className="text-gray-400" />
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View className="px-4 py-4 border-t border-gray-200">
        <TouchableOpacity 
          className="bg-blue-600 rounded-xl py-4 flex-row items-center justify-center"
          onPress={() => {/* Navigate to next screen */}}
        >
          <Text className="text-white font-semibold text-lg">
            Continue to Clubs
          </Text>
          <ChevronRight size={20} color="white" className="ml-2" />
        </TouchableOpacity>
      </View>
    </View>
  );
}