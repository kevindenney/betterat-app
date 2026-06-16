import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { createLogger } from '@/lib/utils/logger';
import {
  CheckCircle2,
  Edit3,
  ChevronRight,
  MapPin,
  Calendar,
  Shield,
  User
} from 'lucide-react-native';

const logger = createLogger('ConfirmCrew');

export default function ConfirmCrewScreen() {
  // Mock data representing all verified information
  const [clubData] = useState({
    clubName: "Royal Marina Sailing Club",
    website: "www.royalmarina.com",
    status: "verified",
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
    ],
    fleets: [
      { id: 1, name: "J/70 Fleet", boats: 12, status: "verified" },
      { id: 2, name: "Laser Radial Fleet", boats: 18, status: "verified" },
      { id: 3, name: "Melges 24 Fleet", boats: 8, status: "verified" }
    ],
    raceSeries: [
      { id: 1, name: "Wednesday Evening Series", frequency: "Weekly", status: "verified" },
      { id: 2, name: "Weekend Regatta Series", frequency: "Monthly", status: "verified" },
      { id: 3, name: "Championship Series", frequency: "Annual", status: "verified" }
    ],
    regattas: [
      { id: 1, name: "National Championships", date: "2023-07-15", status: "verified" },
      { id: 2, name: "Regional Spring Series", date: "2023-04-22", status: "verified" }
    ],
    adminUsers: [
      { id: 1, name: "Alex Morgan", email: "alex@royalmarina.com", role: "admin" },
      { id: 2, name: "Jamie Smith", email: "jamie@royalmarina.com", role: "editor" },
      { id: 3, name: "Taylor Johnson", email: "taylor@royalmarina.com", role: "viewer" }
    ]
  });

  const handleEditSection = (section: string) => {
    showConfirm(
      "Edit Section",
      `Would you like to edit your ${section}?`,
      () => logger.debug(`Editing ${section}`),
      { confirmLabel: 'Edit' }
    );
  };

  const handleCompleteSetup = () => {
    showAlert(
      "Setup Complete!",
      "Your club profile has been successfully verified and is now active."
    );
    logger.debug("Navigating to dashboard");
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
      case 'pending': return <Calendar size={20} color="#F59E0B" />;
      case 'rejected': return <Shield size={20} color="#EF4444" />;
      default: return <Shield size={20} color="#6B7280" />;
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 px-4 pt-12 pb-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-semibold">Club Setup</Text>
          <Text className="text-white text-sm">Step 7 of 7</Text>
        </View>
        
        <Text className="text-white text-2xl font-bold">Final Review</Text>
        <Text className="text-blue-100 mt-1">Confirm all details before completing setup</Text>
      </View>

      {/* Progress Bar */}
      <View className="h-2 bg-blue-500">
        <View className="h-2 bg-white rounded-full w-full" />
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4 py-6">
        <Text className="text-2xl font-bold text-gray-800 mb-2">
          Club Profile Review
        </Text>
        <Text className="text-gray-500 mb-6">
          Review all verified information before finalizing your club profile
        </Text>

        {/* Club Summary Card */}
        <View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-800">Club Information</Text>
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => handleEditSection("club information")}
            >
              <Edit3 size={18} color="#007AFF" />
              <Text className="text-blue-600 font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-start mb-4">
            <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
              <Shield size={24} color="#007AFF" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold text-xl">{clubData.clubName}</Text>
              <Text className="text-gray-600 text-sm mt-1">{clubData.website}</Text>
              <View className="flex-row items-center mt-2">
                {getStatusIcon(clubData.status)}
                <Text className={`font-medium ml-2 ${getStatusColor(clubData.status)}`}>
                  {clubData.status.charAt(0).toUpperCase() + clubData.status.slice(1)}
                </Text>
                <Text className="text-gray-500 text-sm ml-2">• Verified on {clubData.verificationDate}</Text>
              </View>
            </View>
          </View>

          <View className="bg-blue-50 rounded-lg p-3">
            <Text className="text-blue-800 text-center font-medium">
              All club information has been successfully verified
            </Text>
          </View>
        </View>

        {/* Venues Section */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-800">Venues</Text>
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => handleEditSection("venues")}
            >
              <Edit3 size={18} color="#007AFF" />
              <Text className="text-blue-600 font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>
          
          {clubData.venues.map((venue) => (
            <View 
              key={venue.id} 
              className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-lg font-bold text-gray-800">{venue.name}</Text>
                <View className="flex-row items-center">
                  {getStatusIcon(venue.status)}
                  <Text className={`font-medium ml-1 ${getStatusColor(venue.status)}`}>
                    {venue.status.charAt(0).toUpperCase() + venue.status.slice(1)}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-start mb-2">
                <MapPin size={16} color="#6B7280" className="mr-2 mt-0.5" />
                <Text className="text-gray-600 flex-1">{venue.address}</Text>
              </View>
              
              <View className="flex-row items-center mb-2">
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

        {/* Fleets Section */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-800">Fleets</Text>
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => handleEditSection("fleets")}
            >
              <Edit3 size={18} color="#007AFF" />
              <Text className="text-blue-600 font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <View className="flex-row flex-wrap gap-3">
              {clubData.fleets.map((fleet) => (
                <View 
                  key={fleet.id} 
                  className="bg-blue-50 rounded-xl px-4 py-3 flex-1 min-w-[40%]"
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="font-bold text-blue-800">{fleet.name}</Text>
                    <View className="w-5 h-5 rounded-full bg-green-500 items-center justify-center">
                      <CheckCircle2 size={12} color="white" />
                    </View>
                  </View>
                  <Text className="text-blue-700 text-sm">{fleet.boats} boats</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Race Series Section */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-800">Race Series</Text>
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => handleEditSection("race series")}
            >
              <Edit3 size={18} color="#007AFF" />
              <Text className="text-blue-600 font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            {clubData.raceSeries.map((series) => (
              <View 
                key={series.id} 
                className="flex-row items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <View>
                  <Text className="font-bold text-gray-800">{series.name}</Text>
                  <Text className="text-gray-600 text-sm">{series.frequency} races</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-green-600 font-medium mr-2">Verified</Text>
                  <CheckCircle2 size={20} color="#10B981" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Regattas Section */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-800">Regattas</Text>
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => handleEditSection("regattas")}
            >
              <Edit3 size={18} color="#007AFF" />
              <Text className="text-blue-600 font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            {clubData.regattas.map((regatta) => (
              <View 
                key={regatta.id} 
                className="flex-row items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <View>
                  <Text className="font-bold text-gray-800">{regatta.name}</Text>
                  <Text className="text-gray-600 text-sm">Date: {regatta.date}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-green-600 font-medium mr-2">Verified</Text>
                  <CheckCircle2 size={20} color="#10B981" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Admin Users Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-800">Admin Users</Text>
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => handleEditSection("admin users")}
            >
              <Edit3 size={18} color="#007AFF" />
              <Text className="text-blue-600 font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            {clubData.adminUsers.map((user) => (
              <View 
                key={user.id} 
                className="flex-row items-center py-3 border-b border-gray-100 last:border-0"
              >
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <User size={20} color="#007AFF" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-gray-800">{user.name}</Text>
                  <Text className="text-gray-600 text-sm">{user.email}</Text>
                </View>
                <View className="px-3 py-1 rounded-full bg-blue-100">
                  <Text className="text-blue-800 text-xs font-medium">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Confirmation Message */}
        <View className="bg-green-50 rounded-xl p-5 mb-6 border border-green-100">
          <View className="flex-row items-start">
            <CheckCircle2 size={24} color="#10B981" className="mr-3 mt-0.5" />
            <View className="flex-1">
              <Text className="text-green-800 font-bold mb-1">All Information Verified</Text>
              <Text className="text-green-700">
                Your club profile has been successfully verified. You can now access all club features 
                and manage your sailing activities from your dashboard.
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