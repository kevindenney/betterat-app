import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from '@/components/ui';
import { 
  TrendingUp, 
  Wind, 
  Clock, 
  Calendar, 
  MapPin, 
  Trophy, 
  BarChart3, 
  Users, 
  Download,
  ChevronRight
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const races = [
  {
    id: '1',
    name: 'Summer Regatta',
    date: '2023-07-15',
    venue: 'Marina Bay',
    position: '1st',
    fleetSize: 24,
    time: '1:24:32',
    wind: '12 knots SW',
    image: 'https://images.unsplash.com/photo-1558281050-4c33200099c7?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2F0ZXIlMjBzcG9ydHN8ZW58MHx8MHx8fDA%3D'
  },
  {
    id: '2',
    name: 'Weekend Series',
    date: '2023-07-08',
    venue: 'Harbor Cove',
    position: '3rd',
    fleetSize: 18,
    time: '2:12:45',
    wind: '8 knots NE',
    image: 'https://images.unsplash.com/photo-1627923316244-f4da80d8f281?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fEJvYXQlMjBzaGlwJTIwc2FpbGluZyUyMHdhdGVyJTIwbWFyaW5lfGVufDB8fDB8fHww'
  },
  {
    id: '3',
    name: 'Spring Championship',
    date: '2023-06-22',
    venue: 'Ocean Point',
    position: '2nd',
    fleetSize: 32,
    time: '1:45:18',
    wind: '15 knots NW',
    image: 'https://images.unsplash.com/photo-1536244955395-0b8a2a5ab5df?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8c3BvcnRzd2VhcnxlbnwwfHwwfHx8MA%3D%3D'
  }
];

const performanceMetrics = [
  { label: 'Start', value: 'Good', color: 'text-green-600' },
  { label: 'Upwind', value: 'Excellent', color: 'text-green-600' },
  { label: 'Downwind', value: 'Good', color: 'text-green-600' },
  { label: 'Boat Handling', value: 'Average', color: 'text-yellow-600' },
  { label: 'Tactics', value: 'Excellent', color: 'text-green-600' },
];

const RecentRaceAnalysis = () => {
  const [selectedRace, setSelectedRace] = useState(races[0]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <Text className="text-white text-2xl font-bold">Race Analysis</Text>
        <Text className="text-blue-100 mt-1">Performance insights and metrics</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Race Summary Card */}
        <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-xl font-bold text-gray-900">{selectedRace.name}</Text>
              <View className="flex-row items-center mt-1">
                <MapPin size={16} color="#6B7280" />
                <Text className="text-gray-600 ml-1">{selectedRace.venue}</Text>
              </View>
              <View className="flex-row items-center mt-1">
                <Calendar size={16} color="#6B7280" />
                <Text className="text-gray-600 ml-1">{selectedRace.date}</Text>
              </View>
            </View>
            <View className="bg-blue-100 px-3 py-1 rounded-full">
              <Text className="text-blue-800 font-bold">{selectedRace.position}</Text>
            </View>
          </View>

          <View className="mt-4 rounded-lg overflow-hidden">
            <Image 
              source={{ uri: selectedRace.image }} 
              style={{ width: width - 32, height: 180 }}
              resizeMode="cover"
            />
          </View>

          <View className="flex-row justify-between mt-4 pt-4 border-t border-gray-100">
            <View className="items-center">
              <Users size={20} color="#6B7280" />
              <Text className="text-gray-600 mt-1">Fleet</Text>
              <Text className="font-bold">{selectedRace.fleetSize}</Text>
            </View>
            <View className="items-center">
              <Clock size={20} color="#6B7280" />
              <Text className="text-gray-600 mt-1">Time</Text>
              <Text className="font-bold">{selectedRace.time}</Text>
            </View>
            <View className="items-center">
              <Wind size={20} color="#6B7280" />
              <Text className="text-gray-600 mt-1">Wind</Text>
              <Text className="font-bold">{selectedRace.wind}</Text>
            </View>
          </View>
        </View>

        {/* Performance Metrics */}
        <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <View className="flex-row items-center mb-4">
            <TrendingUp size={20} color="#007AFF" />
            <Text className="text-lg font-bold text-gray-900 ml-2">Performance Metrics</Text>
          </View>
          
          <View className="flex-row flex-wrap">
            {performanceMetrics.map((metric, index) => (
              <View 
                key={index} 
                className="w-1/2 mb-4"
              >
                <Text className="text-gray-600">{metric.label}</Text>
                <Text className={`font-bold ${metric.color}`}>{metric.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Race History */}
        <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <View className="flex-row items-center mb-4">
            <BarChart3 size={20} color="#007AFF" />
            <Text className="text-lg font-bold text-gray-900 ml-2">Race History</Text>
          </View>
          
          <View className="space-y-3">
            {races.slice(0, 3).map((race) => (
              <TouchableOpacity 
                key={race.id}
                className={`flex-row items-center p-3 rounded-lg ${selectedRace.id === race.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}
                onPress={() => setSelectedRace(race)}
              >
                <View className="flex-1">
                  <Text className="font-bold text-gray-900">{race.name}</Text>
                  <Text className="text-gray-600 text-sm">{race.venue} • {race.date}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-blue-600 font-bold mr-2">{race.position}</Text>
                  <ChevronRight size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View className="flex-row justify-between mb-6">
          <TouchableOpacity className="flex-row items-center bg-white rounded-xl shadow-sm p-4 flex-1 mr-2">
            <Download size={20} color="#007AFF" />
            <Text className="text-blue-600 font-bold ml-2">Download Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center bg-blue-600 rounded-xl shadow-sm p-4 flex-1 ml-2">
            <Trophy size={20} color="white" />
            <Text className="text-white font-bold ml-2">View Full Analysis</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default RecentRaceAnalysis;