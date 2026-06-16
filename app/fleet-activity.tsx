import { LinearGradient } from 'expo-linear-gradient';
import { Activity, Bell, Calendar, ChevronRight, Clock, MapPin, Users } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

// Configure LinearGradient for NativeWind
cssInterop(LinearGradient, {
  className: 'style',
});

// Mock data for fleet activity
const mockFleetData = {
  fleetName: "San Francisco Bay Fleet",
  members: 42,
  activeToday: 28,
  upcomingEvents: [
    {
      id: 1,
      title: "Weekly Regatta",
      date: "2023-07-22",
      time: "10:00 AM",
      location: "Golden Gate Yacht Club",
      participants: 18,
      type: "Race"
    },
    {
      id: 2,
      title: "Training Session",
      date: "2023-07-25",
      time: "6:00 PM",
      location: "Marina Bay",
      participants: 12,
      type: "Training"
    },
    {
      id: 3,
      title: "Fleet Meeting",
      date: "2023-07-28",
      time: "7:30 PM",
      location: "Clubhouse",
      participants: 25,
      type: "Meeting"
    }
  ],
  recentActivity: [
    {
      id: 1,
      member: "Alex Morgan",
      action: "posted a new photo",
      time: "2 hours ago",
      boat: "Nacra 17"
    },
    {
      id: 2,
      member: "James Wilson",
      action: "joined the fleet",
      time: "5 hours ago",
      boat: "Laser"
    },
    {
      id: 3,
      member: "Sarah Johnson",
      action: "completed a race",
      time: "1 day ago",
      boat: "J/70"
    },
    {
      id: 4,
      member: "Michael Chen",
      action: "updated profile",
      time: "2 days ago",
      boat: "RS Feva"
    }
  ],
  fleetStats: {
    racesCompleted: 24,
    averageParticipation: "82%",
    topBoatClass: "J/70"
  }
};

export default function FleetActivityScreen() {
  const [activeTab, setActiveTab] = useState('events');

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient 
        colors={['#007AFF', '#3b82f6']} 
        className="pt-12 pb-6 px-4"
      >
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-2xl font-bold">Fleet Activity</Text>
          <TouchableOpacity className="p-2">
            <Bell color="white" size={24} />
          </TouchableOpacity>
        </View>
        
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-3xl font-bold">{mockFleetData.fleetName}</Text>
            <View className="flex-row items-center mt-1">
              <Users color="white" size={16} className="mr-1" />
              <Text className="text-blue-100">{mockFleetData.members} members</Text>
            </View>
          </View>
          
          <View className="bg-white/20 rounded-full px-4 py-2">
            <Text className="text-white font-bold">{mockFleetData.activeToday} active today</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View className="flex-row px-4 mt-4">
        <View className="flex-1 bg-white rounded-xl shadow-sm p-4 mr-2">
          <Text className="text-gray-500 text-sm">Races Completed</Text>
          <Text className="text-2xl font-bold text-gray-800">{mockFleetData.fleetStats.racesCompleted}</Text>
        </View>
        <View className="flex-1 bg-white rounded-xl shadow-sm p-4 mx-2">
          <Text className="text-gray-500 text-sm">Participation</Text>
          <Text className="text-2xl font-bold text-gray-800">{mockFleetData.fleetStats.averageParticipation}</Text>
        </View>
        <View className="flex-1 bg-white rounded-xl shadow-sm p-4 ml-2">
          <Text className="text-gray-500 text-sm">Top Class</Text>
          <Text className="text-2xl font-bold text-gray-800">{mockFleetData.fleetStats.topBoatClass}</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row bg-white mt-4 mx-4 rounded-xl p-1">
        <TouchableOpacity 
          className={`flex-1 py-3 rounded-lg items-center ${activeTab === 'events' ? 'bg-blue-100' : ''}`}
          onPress={() => setActiveTab('events')}
        >
          <Text className={`font-medium ${activeTab === 'events' ? 'text-blue-600' : 'text-gray-500'}`}>Upcoming Events</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 rounded-lg items-center ${activeTab === 'activity' ? 'bg-blue-100' : ''}`}
          onPress={() => setActiveTab('activity')}
        >
          <Text className={`font-medium ${activeTab === 'activity' ? 'text-blue-600' : 'text-gray-500'}`}>Recent Activity</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 pb-6">
        {activeTab === 'events' ? (
          <View className="mt-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Upcoming Events</Text>
            {mockFleetData.upcomingEvents.map((event) => (
              <TouchableOpacity 
                key={event.id} 
                className="bg-white rounded-xl shadow-sm p-4 mb-4 flex-row"
              >
                <View className="bg-blue-50 w-16 h-16 rounded-lg items-center justify-center mr-4">
                  <Calendar color="#007AFF" size={24} />
                  <Text className="text-blue-600 font-bold mt-1">{new Date(event.date).getDate()}</Text>
                  <Text className="text-blue-600 text-xs">{new Date(event.date).toLocaleString('default', { month: 'short' })}</Text>
                </View>
                
                <View className="flex-1">
                  <View className="flex-row justify-between items-start">
                    <Text className="text-lg font-bold text-gray-800">{event.title}</Text>
                    <View className="bg-blue-100 px-2 py-1 rounded-full">
                      <Text className="text-blue-600 text-xs font-medium">{event.type}</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row mt-2">
                    <Clock color="#6B7280" size={16} className="mr-1" />
                    <Text className="text-gray-600 text-sm mr-4">{event.time}</Text>
                    <MapPin color="#6B7280" size={16} className="mr-1" />
                    <Text className="text-gray-600 text-sm">{event.location}</Text>
                  </View>
                  
                  <View className="flex-row mt-2 items-center">
                    <Users color="#6B7280" size={16} className="mr-1" />
                    <Text className="text-gray-600 text-sm">{event.participants} participants</Text>
                  </View>
                </View>
                
                <ChevronRight color="#6B7280" size={20} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="mt-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Recent Activity</Text>
            {mockFleetData.recentActivity.map((activity) => (
              <View 
                key={activity.id} 
                className="bg-white rounded-xl shadow-sm p-4 mb-3 flex-row items-center"
              >
                <View className="bg-gray-200 w-12 h-12 rounded-full mr-3" />
                <View className="flex-1">
                  <Text className="font-bold text-gray-800">{activity.member}</Text>
                  <Text className="text-gray-600">{activity.action}</Text>
                  <View className="flex-row mt-1">
                    <Text className="text-gray-500 text-sm">{activity.time}</Text>
                    {activity.boat && (
                      <Text className="text-gray-500 text-sm mx-2">• {activity.boat}</Text>
                    )}
                  </View>
                </View>
                <Activity color="#007AFF" size={20} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}