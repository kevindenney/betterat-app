import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from '@/components/ui';
import { ChevronLeft, Plus } from 'lucide-react-native';

const BoatSetupScreen = () => {
  const [boatName, setBoatName] = useState('');
  const [boatClass, setBoatClass] = useState('');
  const [sailNumber, setSailNumber] = useState('');
  const [crewMembers, setCrewMembers] = useState(1);
  const [boatImage] = useState('https://images.unsplash.com/photo-1627923316244-f4da80d8f281?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fEJvYXQlMjBzaGlwJTIwc2FpbGluZyUyMHdhdGVyJTIwbWFyaW5lfGVufDB8fDB8fHww');

  const boatClasses = [
    { id: 1, name: 'Laser', description: 'Single-handed dinghy' },
    { id: 2, name: 'RS Feva', description: 'Youth training boat' },
    { id: 3, name: 'J/70', description: 'One-design keelboat' },
    { id: 4, name: 'Melges 24', description: 'High-performance sportboat' },
    { id: 5, name: 'Catalina 315', description: 'Weekend cruiser' },
    { id: 6, name: 'Other', description: 'Select custom boat class' },
  ];

  const incrementCrew = () => setCrewMembers(prev => prev + 1);
  const decrementCrew = () => setCrewMembers(prev => (prev > 1 ? prev - 1 : 1));

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-blue-600 px-4 pt-12 pb-6">
        <View className="flex-row items-center">
          <TouchableOpacity className="p-2">
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold flex-1 text-center mr-10">
            Boat Setup
          </Text>
        </View>
        <Text className="text-blue-100 text-center mt-2">
          Tell us about your boat
        </Text>
      </View>

      {/* Progress Indicator */}
      <View className="flex-row justify-center py-4 bg-blue-50">
        <View className="h-2 w-16 bg-blue-200 rounded-full mx-1" />
        <View className="h-2 w-16 bg-blue-200 rounded-full mx-1" />
        <View className="h-2 w-16 bg-blue-600 rounded-full mx-1" />
        <View className="h-2 w-16 bg-blue-200 rounded-full mx-1" />
        <View className="h-2 w-16 bg-blue-200 rounded-full mx-1" />
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Boat Image */}
        <View className="items-center mb-6">
          <Image
            source={{ uri: boatImage }}
            className="w-80 h-48 rounded-xl"
            resizeMode="cover"
          />
          <TouchableOpacity className="mt-3 flex-row items-center">
            <Plus color="#007AFF" size={16} />
            <Text className="text-blue-600 font-medium ml-1">Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Boat Name Input */}
        <View className="mb-6">
          <Text className="text-gray-800 font-bold mb-2">Boat Name</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 bg-white"
            placeholder="Enter your boat name"
            value={boatName}
            onChangeText={setBoatName}
          />
        </View>

        {/* Sail Number Input */}
        <View className="mb-6">
          <Text className="text-gray-800 font-bold mb-2">Sail Number</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 bg-white"
            placeholder="Enter your sail number"
            value={sailNumber}
            onChangeText={setSailNumber}
          />
        </View>

        {/* Boat Class Selection */}
        <View className="mb-6">
          <Text className="text-gray-800 font-bold mb-3">Boat Class</Text>
          <View className="flex-row flex-wrap gap-3">
            {boatClasses.map((boatClassItem) => (
              <TouchableOpacity
                key={boatClassItem.id}
                className={`flex-1 min-w-[40%] border rounded-xl py-3 px-2 ${
                  boatClass === boatClassItem.name
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200'
                }`}
                onPress={() => setBoatClass(boatClassItem.name)}
              >
                <Text className="font-medium text-gray-800 text-center">
                  {boatClassItem.name}
                </Text>
                <Text className="text-gray-500 text-xs text-center mt-1">
                  {boatClassItem.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Crew Members Selector */}
        <View className="mb-8">
          <Text className="text-gray-800 font-bold mb-2">Crew Members</Text>
          <View className="flex-row items-center justify-between bg-gray-50 rounded-xl p-4">
            <Text className="text-gray-700">Number of crew members</Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="bg-white border border-gray-300 rounded-lg w-10 h-10 items-center justify-center"
                onPress={decrementCrew}
              >
                <Text className="text-gray-700 text-xl">-</Text>
              </TouchableOpacity>
              <Text className="mx-6 text-lg font-medium">{crewMembers}</Text>
              <TouchableOpacity
                className="bg-white border border-gray-300 rounded-lg w-10 h-10 items-center justify-center"
                onPress={incrementCrew}
              >
                <Text className="text-gray-700 text-xl">+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity className="bg-blue-600 rounded-xl py-4 items-center mb-6">
          <Text className="text-white font-bold text-lg">Save Boat Details</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default BoatSetupScreen;