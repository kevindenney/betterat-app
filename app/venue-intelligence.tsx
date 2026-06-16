import { LinearGradient } from 'expo-linear-gradient';
import { CloudRain, Droplets, Eye, MapPin, Navigation, Thermometer, Wind } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from '@/components/ui';

// Setup LinearGradient for NativeWind compatibility
cssInterop(LinearGradient, {
  className: 'style',
});

// Mock data for venue intelligence
const venueData = {
  name: "Marina Del Rey Yacht Club",
  location: "Los Angeles, CA",
  image: "https://images.unsplash.com/photo-1519281493836-0d0b3c436b36?auto=format&fit=crop&w=800",
  weather: {
    temperature: 72,
    condition: "Partly Cloudy",
    windSpeed: 8,
    windDirection: "NW",
    visibility: 10,
    humidity: 65,
    pressure: 30.15,
    tide: {
      height: 2.3,
      direction: "Falling",
    }
  },
  course: {
    type: "Windward-Leeward",
    marks: 4,
    length: "1.2 nautical miles",
    startLine: "Buoy Start",
  },
  nextRace: {
    date: "2023-07-22",
    time: "14:00",
    fleet: "Laser Radial Fleet",
  }
};

const forecastData = [
  { day: "Today", high: 75, low: 65, condition: "Sunny", wind: "10 mph NW" },
  { day: "Sat", high: 78, low: 67, condition: "Partly Cloudy", wind: "12 mph W" },
  { day: "Sun", high: 74, low: 64, condition: "Cloudy", wind: "8 mph SW" },
  { day: "Mon", high: 76, low: 66, condition: "Sunny", wind: "11 mph NW" },
];

export default function VenueIntelligenceScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-blue-50 justify-center items-center">
        <Text className="text-gray-600 text-lg">Loading venue intelligence...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-blue-50">
      {/* Header */}
      <View className="bg-white shadow-sm py-4 px-4">
        <View className="flex-row items-center">
          <MapPin color="#007AFF" size={24} />
          <Text className="text-2xl font-bold text-gray-800 ml-2">Venue Intelligence</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {/* Venue Card */}
        <View className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <Image 
            source={{ uri: venueData.image }} 
            className="h-48 w-full"
            resizeMode="cover"
          />
          <View className="p-4">
            <Text className="text-2xl font-bold text-gray-800">{venueData.name}</Text>
            <View className="flex-row items-center mt-1">
              <MapPin color="#6B7280" size={16} />
              <Text className="text-gray-600 ml-1">{venueData.location}</Text>
            </View>
          </View>
        </View>

        {/* Weather Section */}
        <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <Text className="text-xl font-bold text-gray-800 mb-3">Current Conditions</Text>
          
          <View className="flex-row justify-between mb-4">
            <View className="flex-row items-center">
              <Thermometer color="#007AFF" size={24} />
              <Text className="text-3xl font-bold text-gray-800 ml-2">{venueData.weather.temperature}°F</Text>
            </View>
            <Text className="text-lg text-gray-600 self-center">{venueData.weather.condition}</Text>
          </View>
          
          <View className="flex-row flex-wrap justify-between">
            <View className="flex-row items-center mb-2 w-1/2">
              <Wind color="#6B7280" size={20} />
              <View className="ml-2">
                <Text className="text-gray-600 text-sm">Wind</Text>
                <Text className="font-medium">{venueData.weather.windSpeed} mph {venueData.weather.windDirection}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center mb-2 w-1/2">
              <Eye color="#6B7280" size={20} />
              <View className="ml-2">
                <Text className="text-gray-600 text-sm">Visibility</Text>
                <Text className="font-medium">{venueData.weather.visibility} mi</Text>
              </View>
            </View>
            
            <View className="flex-row items-center mb-2 w-1/2">
              <Droplets color="#6B7280" size={20} />
              <View className="ml-2">
                <Text className="text-gray-600 text-sm">Humidity</Text>
                <Text className="font-medium">{venueData.weather.humidity}%</Text>
              </View>
            </View>
            
            <View className="flex-row items-center mb-2 w-1/2">
              <CloudRain color="#6B7280" size={20} />
              <View className="ml-2">
                <Text className="text-gray-600 text-sm">Pressure</Text>
                <Text className="font-medium">{venueData.weather.pressure} in</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Course Information */}
        <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <Text className="text-xl font-bold text-gray-800 mb-3">Course Layout</Text>
          
          <View className="flex-row justify-between mb-4">
            <View className="items-center">
              <Navigation color="#007AFF" size={32} className="mb-1" />
              <Text className="text-gray-600 text-sm">Course Type</Text>
              <Text className="font-medium">{venueData.course.type}</Text>
            </View>
            
            <View className="items-center">
              <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mb-1">
                <Text className="text-blue-600 font-bold">{venueData.course.marks}</Text>
              </View>
              <Text className="text-gray-600 text-sm">Marks</Text>
              <Text className="font-medium">{venueData.course.length}</Text>
            </View>
            
            <View className="items-center">
              <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mb-1">
                <Text className="text-blue-600 font-bold">1</Text>
              </View>
              <Text className="text-gray-600 text-sm">Start Line</Text>
              <Text className="font-medium">{venueData.course.startLine}</Text>
            </View>
          </View>
          
          <TouchableOpacity className="bg-blue-600 rounded-lg py-3 mt-2 items-center">
            <Text className="text-white font-medium">View Detailed Course Map</Text>
          </TouchableOpacity>
        </View>

        {/* Tide Information */}
        <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <Text className="text-xl font-bold text-gray-800 mb-3">Tidal Information</Text>
          
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-gray-600">Current Tide</Text>
              <Text className="text-2xl font-bold text-gray-800">{venueData.weather.tide.height} ft</Text>
            </View>
            
            <View className="items-end">
              <Text className="text-gray-600">Direction</Text>
              <Text className="text-lg font-medium text-gray-800">{venueData.weather.tide.direction}</Text>
            </View>
          </View>
          
          <View className="mt-4">
            <Text className="text-gray-600 mb-2">Next 6 Hours</Text>
            <View className="h-20 bg-blue-100 rounded-lg">
              {/* This would be a tide chart in a real implementation */}
              <View className="flex-1 flex-row items-end px-2">
                {[1.8, 2.1, 2.3, 2.2, 2.0, 1.7].map((height, index) => (
                  <View 
                    key={index} 
                    className="flex-1 items-center"
                  >
                    <View 
                      className="w-2 bg-blue-500 rounded-t"
                      style={{ height: `${(height / 3) * 100}%` }}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Forecast */}
        <View className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <Text className="text-xl font-bold text-gray-800 mb-3">4-Day Forecast</Text>
          
          <View className="flex-row justify-between">
            {forecastData.map((day, index) => (
              <View key={index} className="items-center">
                <Text className="font-medium text-gray-800">{day.day}</Text>
                <Text className="text-gray-600 text-sm mt-1">{day.condition}</Text>
                <Text className="text-lg font-bold text-gray-800 mt-1">{day.high}°</Text>
                <Text className="text-gray-600 text-sm">{day.low}°</Text>
                <Text className="text-gray-600 text-xs mt-1">{day.wind}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Next Race */}
        <View className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-sm p-4 mb-6">
          <Text className="text-xl font-bold text-white mb-2">Next Race</Text>
          <Text className="text-white text-2xl font-bold">{venueData.nextRace.date}</Text>
          <Text className="text-white text-lg">{venueData.nextRace.time}</Text>
          <Text className="text-blue-100 mt-1">{venueData.nextRace.fleet}</Text>
          
          <TouchableOpacity className="bg-white rounded-lg py-2 mt-3 items-center">
            <Text className="text-blue-600 font-medium">View Race Details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}