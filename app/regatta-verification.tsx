import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Check, X, Edit3, Calendar, MapPin, Users, Trophy, ChevronLeft } from 'lucide-react-native';

type Regatta = {
  id: string;
  name: string;
  date: string;
  location: string;
  participants: number;
  status: 'verified' | 'pending' | 'needs-review';
  notes?: string;
};

export default function RegattaVerificationScreen() {
  const [regattas, setRegattas] = useState<Regatta[]>([
    {
      id: '1',
      name: 'National Championships',
      date: '2023-07-15',
      location: 'Lake Geneva, Switzerland',
      participants: 120,
      status: 'pending',
      notes: 'Extracted from website main event page'
    },
    {
      id: '2',
      name: 'Regional Spring Series',
      date: '2023-04-22',
      location: 'River Thames, UK',
      participants: 85,
      status: 'verified',
      notes: 'Updated participant count'
    },
    {
      id: '3',
      name: 'Junior Development Regatta',
      date: '2023-06-10',
      location: 'Loch Lomond, Scotland',
      participants: 65,
      status: 'needs-review',
      notes: 'Date needs confirmation'
    },
    {
      id: '4',
      name: 'Veterans Cup',
      date: '2023-09-05',
      location: 'Lake Como, Italy',
      participants: 92,
      status: 'pending',
      notes: 'Location details might be incomplete'
    }
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Regatta>>({});
  const [searchQuery] = useState('');

  const handleEdit = (regatta: Regatta) => {
    setEditingId(regatta.id);
    setEditForm({ ...regatta });
  };

  const handleSave = () => {
    if (!editingId) return;
    
    setRegattas(prev => 
      prev.map(regatta => 
        regatta.id === editingId ? { ...regatta, ...editForm } as Regatta : regatta
      )
    );
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const getStatusColor = (status: Regatta['status']) => {
    switch (status) {
      case 'verified': return 'bg-green-100 border-green-500';
      case 'pending': return 'bg-yellow-100 border-yellow-500';
      case 'needs-review': return 'bg-red-100 border-red-500';
      default: return 'bg-gray-100 border-gray-500';
    }
  };

  const getStatusText = (status: Regatta['status']) => {
    switch (status) {
      case 'verified': return 'Verified';
      case 'pending': return 'Pending Review';
      case 'needs-review': return 'Needs Review';
      default: return 'Unknown';
    }
  };

  const filteredRegattas = regattas.filter(regatta => {
    const matchesSearch = regatta.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          regatta.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const renderItem = ({ item }: { item: Regatta }) => {
    if (editingId === item.id) {
      return (
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Regatta Name</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              value={editForm.name || ''}
              onChangeText={(text) => setEditForm({ ...editForm, name: text })}
            />
          </View>
          
          <View className="flex-row mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-gray-500 text-sm mb-1">Date</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                value={editForm.date || ''}
                onChangeText={(text) => setEditForm({ ...editForm, date: text })}
              />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-gray-500 text-sm mb-1">Participants</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                value={editForm.participants?.toString() || ''}
                onChangeText={(text) => setEditForm({ ...editForm, participants: parseInt(text) || 0 })}
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Location</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              value={editForm.location || ''}
              onChangeText={(text) => setEditForm({ ...editForm, location: text })}
            />
          </View>
          
          <View className="mb-4">
            <Text className="text-gray-500 text-sm mb-1">Notes</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              value={editForm.notes || ''}
              onChangeText={(text) => setEditForm({ ...editForm, notes: text })}
              multiline
              numberOfLines={2}
            />
          </View>
          
          <View className="flex-row justify-end space-x-3">
            <TouchableOpacity 
              className="flex-row items-center bg-gray-200 px-4 py-2 rounded-lg"
              onPress={handleCancel}
            >
              <X size={16} color="#374151" />
              <Text className="ml-1 text-gray-700 font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-row items-center bg-blue-600 px-4 py-2 rounded-lg"
              onPress={handleSave}
            >
              <Check size={16} color="white" />
              <Text className="ml-1 text-white font-medium">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <Text className="text-lg font-bold text-gray-800">{item.name}</Text>
          <View className={`px-3 py-1 rounded-full border ${getStatusColor(item.status)}`}>
            <Text className="text-xs font-medium">
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
        
        <View className="flex-row mb-3">
          <Calendar size={16} color="#6B7280" />
          <Text className="ml-2 text-gray-600">{item.date}</Text>
        </View>
        
        <View className="flex-row mb-3">
          <MapPin size={16} color="#6B7280" />
          <Text className="ml-2 text-gray-600">{item.location}</Text>
        </View>
        
        <View className="flex-row mb-3">
          <Users size={16} color="#6B7280" />
          <Text className="ml-2 text-gray-600">{item.participants} participants</Text>
        </View>
        
        {item.notes ? (
          <View className="mb-4">
            <Text className="text-gray-500 text-sm mb-1">Notes:</Text>
            <Text className="text-gray-700">{item.notes}</Text>
          </View>
        ) : null}
        
        <TouchableOpacity 
          className="flex-row items-center self-start bg-blue-50 px-3 py-2 rounded-lg"
          onPress={() => handleEdit(item)}
        >
          <Edit3 size={16} color="#007AFF" />
          <Text className="ml-1 text-blue-600 font-medium">Edit</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header with Blue Banner */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity className="p-2 -ml-2">
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold flex-1 text-center">Club Setup</Text>
          <View className="w-8" /> {/* Spacer for alignment */}
        </View>
        
        <View className="h-2 bg-blue-500 rounded-full mb-4">
          <View className="h-2 bg-white rounded-full w-[85.7%]" />
        </View>
        <Text className="text-white text-center">Step 6 of 7</Text>
      </View>

      {/* Content */}
      <View className="bg-white pt-4 pb-2 px-4 shadow-sm">
        <View className="flex-row items-center mb-4">
          <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
            <Trophy size={24} color="#007AFF" />
          </View>
          <View>
            <Text className="text-2xl font-bold text-gray-800">Regatta Verification</Text>
            <Text className="text-gray-600">
              Review and customize regatta information extracted from your website
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Summary */}
      <View className="flex-row px-4 py-4 bg-white">
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-blue-600">{regattas.length}</Text>
          <Text className="text-gray-600 text-sm">Total Regattas</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-green-600">
            {regattas.filter(r => r.status === 'verified').length}
          </Text>
          <Text className="text-gray-600 text-sm">Verified</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-yellow-600">
            {regattas.filter(r => r.status === 'pending').length}
          </Text>
          <Text className="text-gray-600 text-sm">Pending</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-red-600">
            {regattas.filter(r => r.status === 'needs-review').length}
          </Text>
          <Text className="text-gray-600 text-sm">Needs Review</Text>
        </View>
      </View>

      {/* Regattas List */}
      <ScrollView className="flex-1 px-4">
        <Text className="text-lg font-bold text-gray-800 mb-3">
          {filteredRegattas.length} Regatta{filteredRegattas.length !== 1 ? 's' : ''} Found
        </Text>
        <FlatList
          data={filteredRegattas}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
        
        {/* Action Buttons */}
        <View className="flex-row my-6 space-x-3">
          <TouchableOpacity className="flex-1 bg-gray-200 py-4 rounded-xl items-center">
            <Text className="text-gray-700 font-bold">Skip for Now</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-blue-600 py-4 rounded-xl items-center">
            <Text className="text-white font-bold">Complete Verification</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}