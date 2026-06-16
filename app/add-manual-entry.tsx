import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Plus, X, User, Mail, Phone, Hash, Navigation, CreditCard } from 'lucide-react-native';

const AddManualEntryScreen = () => {
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [sailNumber, setSailNumber] = useState('');
  const [boatName, setBoatName] = useState('');
  const [country, setCountry] = useState('');
  const [crewMembers, setCrewMembers] = useState([{ name: '', role: '' }]);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Recent sailors data
  const recentSailors = [
    { id: 1, name: 'John Smith', sailNumber: 'N12345' },
    { id: 2, name: 'Emma Johnson', sailNumber: 'S67890' },
    { id: 3, name: 'Michael Brown', sailNumber: 'E54321' },
    { id: 4, name: 'Sarah Davis', sailNumber: 'W09876' },
  ];

  // Boat classes data
  const boatClasses = ['Dragon', 'J/70', 'Laser', '470', 'RS400', 'ILCA 7'];

  // Countries data
  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'CA', name: 'Canada' },
    { code: 'NZ', name: 'New Zealand' },
  ];

  // Handle crew member changes
  const handleCrewChange = (index: number, field: string, value: string) => {
    const updatedCrew = [...crewMembers];
    updatedCrew[index] = { ...updatedCrew[index], [field]: value };
    setCrewMembers(updatedCrew);
  };

  // Add new crew member
  const addCrewMember = () => {
    setCrewMembers([...crewMembers, { name: '', role: '' }]);
  };

  // Remove crew member
  const removeCrewMember = (index: number) => {
    if (crewMembers.length > 1) {
      const updatedCrew = crewMembers.filter((_, i) => i !== index);
      setCrewMembers(updatedCrew);
    }
  };

  // Auto-fill form with recent sailor data
  const autoFillSailor = (sailor: typeof recentSailors[0]) => {
    setFullName(sailor.name);
    setSailNumber(sailor.sailNumber);
  };

  // Form validation
  const isFormValid = fullName && email && sailNumber && selectedClass;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <Text className="text-white text-2xl font-bold">Add Manual Entry</Text>
        <Text className="text-blue-100 mt-1">Spring Series R1 (March 15)</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Search Section */}
        <View className="mb-6">
          <Text className="text-gray-800 font-medium mb-2">Search Sailor</Text>
          <View className="flex-row items-center bg-white rounded-lg px-3 py-2 mb-3 border border-gray-200">
            <User size={18} color="#6B7280" />
            <TextInput
              className="flex-1 ml-2 text-gray-800"
              placeholder="Search by name, sail number, email..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Recent Sailors */}
          <Text className="text-gray-600 text-sm mb-2">Recent Sailors</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {recentSailors.map((sailor) => (
              <TouchableOpacity
                key={sailor.id}
                className="bg-white rounded-lg px-3 py-2 border border-gray-200"
                onPress={() => autoFillSailor(sailor)}
              >
                <Text className="font-medium text-gray-800">{sailor.name}</Text>
                <Text className="text-xs text-gray-500">{sailor.sailNumber}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-gray-200"></View>
            <Text className="mx-4 text-gray-500 text-sm">OR ADD NEW SAILOR</Text>
            <View className="flex-1 h-px bg-gray-200"></View>
          </View>
        </View>

        {/* Sailor Details */}
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-3">Sailor Details</Text>
          
          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Full Name *</Text>
            <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <User size={18} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-gray-800"
                placeholder="Enter full name"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Email *</Text>
            <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <Mail size={18} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-gray-800"
                placeholder="Enter email address"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View>
            <Text className="text-gray-700 mb-1">Phone (Optional)</Text>
            <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <Phone size={18} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-gray-800"
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
        </View>

        {/* Boat Details */}
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-3">Boat Details</Text>
          
          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Class *</Text>
            <View className="bg-gray-50 rounded-lg border border-gray-200">
              <TouchableOpacity className="flex-row items-center justify-between px-3 py-3">
                <Text className={selectedClass ? "text-gray-800" : "text-gray-400"}>
                  {selectedClass || "Select boat class"}
                </Text>
                <Navigation size={18} color="#6B7280" />
              </TouchableOpacity>
              <View className="border-t border-gray-200">
                {boatClasses.map((boatClass) => (
                  <TouchableOpacity 
                    key={boatClass}
                    className="px-3 py-2 border-b border-gray-100"
                    onPress={() => setSelectedClass(boatClass)}
                  >
                    <Text className={selectedClass === boatClass ? "text-blue-600 font-medium" : "text-gray-700"}>
                      {boatClass}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Sail Number *</Text>
            <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <Hash size={18} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-gray-800"
                placeholder="Enter sail number"
                value={sailNumber}
                onChangeText={setSailNumber}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Boat Name (Optional)</Text>
            <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <Navigation size={18} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-gray-800"
                placeholder="Enter boat name"
                value={boatName}
                onChangeText={setBoatName}
              />
            </View>
          </View>

          <View>
            <Text className="text-gray-700 mb-1">Country</Text>
            <View className="bg-gray-50 rounded-lg border border-gray-200">
              <TouchableOpacity className="flex-row items-center justify-between px-3 py-3">
                <Text className={country ? "text-gray-800" : "text-gray-400"}>
                  {country || "Select country"}
                </Text>
                <Navigation size={18} color="#6B7280" />
              </TouchableOpacity>
              <View className="border-t border-gray-200">
                {countries.map((countryItem) => (
                  <TouchableOpacity 
                    key={countryItem.code}
                    className="flex-row items-center px-3 py-2 border-b border-gray-100"
                    onPress={() => setCountry(countryItem.name)}
                  >
                    <Text className="mr-2 text-lg">🏁</Text>
                    <Text className={country === countryItem.name ? "text-blue-600 font-medium" : "text-gray-700"}>
                      {countryItem.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Crew Section */}
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-gray-800">Crew</Text>
            <TouchableOpacity 
              className="flex-row items-center bg-blue-50 rounded-lg px-3 py-1"
              onPress={addCrewMember}
            >
              <Plus size={16} color="#007AFF" />
              <Text className="text-blue-600 ml-1">Add Crew</Text>
            </TouchableOpacity>
          </View>

          {crewMembers.map((member, index) => (
            <View key={index} className="mb-3">
              <View className="flex-row items-center">
                <View className="flex-1 mr-2">
                  <Text className="text-gray-700 mb-1">Crew {index + 1}</Text>
                  <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <User size={18} color="#6B7280" />
                    <TextInput
                      className="flex-1 ml-2 text-gray-800"
                      placeholder="Enter crew member name"
                      value={member.name}
                      onChangeText={(value) => handleCrewChange(index, 'name', value)}
                    />
                  </View>
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-gray-700 mb-1">Role</Text>
                  <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <TextInput
                      className="flex-1 text-gray-800"
                      placeholder="Role"
                      value={member.role}
                      onChangeText={(value) => handleCrewChange(index, 'role', value)}
                    />
                  </View>
                </View>
                {crewMembers.length > 1 && (
                  <TouchableOpacity 
                    className="ml-2 mt-6"
                    onPress={() => removeCrewMember(index)}
                  >
                    <X size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Payment Section */}
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-3">Payment</Text>
          
          <View className="mb-4">
            <Text className="text-gray-700 mb-2">Entry Fee: $75.00</Text>
            <View className="flex-row justify-between items-center bg-blue-50 rounded-lg p-3 mb-3">
              <CreditCard size={20} color="#007AFF" />
              <Text className="text-blue-600 font-medium flex-1 ml-2">Entry fee will be charged upon confirmation</Text>
            </View>
          </View>

          <Text className="text-gray-700 mb-2">Payment Status</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity 
              className={`flex-1 rounded-lg border p-3 ${paymentStatus === 'paid' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
              onPress={() => setPaymentStatus('paid')}
            >
              <Text className={paymentStatus === 'paid' ? "text-blue-600 font-medium" : "text-gray-700"}>Paid</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className={`flex-1 rounded-lg border p-3 ${paymentStatus === 'pending' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
              onPress={() => setPaymentStatus('pending')}
            >
              <Text className={paymentStatus === 'pending' ? "text-blue-600 font-medium" : "text-gray-700"}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className={`flex-1 rounded-lg border p-3 ${paymentStatus === 'waived' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
              onPress={() => setPaymentStatus('waived')}
            >
              <Text className={paymentStatus === 'waived' ? "text-blue-600 font-medium" : "text-gray-700"}>Waived</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes */}
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-3">Notes</Text>
          <View className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
            <TextInput
              className="text-gray-800 h-24"
              placeholder="Add any special notes or requirements..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View className="flex-row bg-white p-4 border-t border-gray-200">
        <TouchableOpacity className="flex-1 bg-gray-100 rounded-lg py-3 mr-2 items-center">
          <Text className="text-gray-700 font-medium">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 rounded-lg py-3 ml-2 items-center ${isFormValid ? 'bg-blue-600' : 'bg-gray-300'}`}
          disabled={!isFormValid}
        >
          <Text className="text-white font-medium">Add Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 bg-blue-800 rounded-lg py-3 ml-2 items-center">
          <Text className="text-white font-medium">Save & Add Another</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AddManualEntryScreen;