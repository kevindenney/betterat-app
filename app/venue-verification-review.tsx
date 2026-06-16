import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { createLogger } from '@/lib/utils/logger';
import {
  MapPin,
  CheckCircle2,
  Edit3,
  ChevronRight,
  AlertCircle,
  Clock
} from 'lucide-react-native';

const logger = createLogger('VenueVerification');

export default function VenueVerificationReview() {
  // Mock data for venue verification
  const [venueData] = useState({
    name: "Royal Marina Sailing Club",
    address: "123 Harbor Drive, Marina Bay",
    status: "verified", // 'verified', 'pending', 'rejected'
    verificationDate: "2023-10-15",
    venues: [
      {
        id: 1,
        name: "Main Marina",
        address: "123 Harbor Drive, Marina Bay",
        status: "verified",
        capacity: 150,
        features: ["Docking", "Clubhouse", "Restaurant"]
      },
      {
        id: 2,
        name: "North Harbor",
        address: "456 North Pier, Marina Bay",
        status: "verified",
        capacity: 80,
        features: ["Docking", "Storage", "Workshop"]
      }
    ]
  });

  const handleEditVenue = (venueId: number) => {
    // In a real app, this would navigate to the venue editing screen
    logger.debug(`Editing venue ${venueId}`);
  };

  const handleCompleteSetup = () => {
    // In a real app, this would navigate to the dashboard
    logger.debug("Completing setup");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'rejected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle2 size={20} color="#10B981" />;
      case 'pending': return <Clock size={20} color="#F59E0B" />;
      case 'rejected': return <AlertCircle size={20} color="#EF4444" />;
      default: return <AlertCircle size={20} color="#6B7280" />;
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 px-4 pt-12 pb-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-semibold">Venue Verification</Text>
          <Text className="text-white text-sm">Step 6 of 6</Text>
        </View>
        
        <Text className="text-white text-xl font-bold">Review Your Venues</Text>
        <Text className="text-blue-100 mt-1">Final step before accessing your dashboard</Text>
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4 py-6">
        <Text className="text-2xl font-bold text-gray-800 mb-2">
          Venue Verification Review
        </Text>
        <Text className="text-gray-500 mb-6">
          Confirm your venue details before finalizing your club profile
        </Text>

        {/* Club Card */}
        <View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-800">Club Information</Text>
            <TouchableOpacity className="flex-row items-center">
              <Edit3 size={18} color="#007AFF" />
              <Text className="text-blue-600 font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-start">
            <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
              <MapPin size={24} color="#007AFF" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold text-lg">{venueData.name}</Text>
              <Text className="text-gray-600 text-sm mt-1">{venueData.address}</Text>
              <View className="flex-row items-center mt-2">
                {getStatusIcon(venueData.status)}
                <Text className={`font-medium ml-2 ${getStatusColor(venueData.status)}`}>
                  {venueData.status.charAt(0).toUpperCase() + venueData.status.slice(1)}
                </Text>
                <Text className="text-gray-500 text-sm ml-2">• Verified on {venueData.verificationDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Venues Section */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">Your Venues</Text>
          
          {venueData.venues.map((venue) => (
            <View 
              key={venue.id} 
              className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100"
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-gray-800">{venue.name}</Text>
                <TouchableOpacity 
                  className="flex-row items-center"
                  onPress={() => handleEditVenue(venue.id)}
                >
                  <Edit3 size={18} color="#007AFF" />
                  <Text className="text-blue-600 font-medium ml-1">Edit</Text>
                </TouchableOpacity>
              </View>
              
              <View className="flex-row items-start mb-3">
                <MapPin size={16} color="#6B7280" className="mr-2 mt-1" />
                <Text className="text-gray-600 flex-1">{venue.address}</Text>
              </View>
              
              <View className="flex-row items-center mb-3">
                {getStatusIcon(venue.status)}
                <Text className={`font-medium ml-2 ${getStatusColor(venue.status)}`}>
                  {venue.status.charAt(0).toUpperCase() + venue.status.slice(1)}
                </Text>
              </View>
              
              <View className="flex-row items-center mb-3">
                <Text className="text-gray-700 font-medium">Capacity:</Text>
                <Text className="text-gray-600 ml-2">{venue.capacity} boats</Text>
              </View>
              
              <View className="mt-2">
                <Text className="text-gray-700 font-medium mb-1">Features:</Text>
                <View className="flex-row flex-wrap">
                  {venue.features.map((feature, index) => (
                    <View 
                      key={index} 
                      className="bg-blue-50 rounded-full px-3 py-1 mr-2 mb-2"
                    >
                      <Text className="text-blue-700 text-sm">{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Verification Info */}
        <View className="bg-blue-50 rounded-xl p-5 mb-6 border border-blue-100">
          <View className="flex-row items-start">
            <AlertCircle size={20} color="#007AFF" className="mr-2 mt-0.5" />
            <View className="flex-1">
              <Text className="text-blue-800 font-medium mb-1">Verification Complete</Text>
              <Text className="text-blue-700 text-sm">
                All your venues have been successfully verified. You can now access all club features and 
                manage your venues from your dashboard.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View className="px-4 py-4 border-t border-gray-200 bg-white">
        <TouchableOpacity 
          className="bg-blue-600 rounded-xl py-4 flex-row items-center justify-center"
          onPress={handleCompleteSetup}
        >
          <Text className="text-white font-semibold text-lg">
            Complete Setup & Go to Dashboard
          </Text>
          <ChevronRight size={20} color="white" className="ml-2" />
        </TouchableOpacity>
      </View>
    </View>
  );
}