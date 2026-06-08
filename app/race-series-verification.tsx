import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Check, X, Plus, Edit3, Trash2, Calendar, ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Mock data for race series extracted from website
const initialRaceSeries = [
  { 
    id: '1', 
    name: 'Wednesday Evening Series', 
    description: 'Weekly racing on Wednesday evenings from April to September', 
    verified: true,
    startDate: '2025-04-02',
    endDate: '2025-09-30',
    frequency: 'Weekly'
  },
  { 
    id: '2', 
    name: 'Weekend Regatta Series', 
    description: 'Monthly regattas on weekends', 
    verified: false,
    startDate: '2025-05-03',
    endDate: '2025-10-25',
    frequency: 'Monthly'
  },
  { 
    id: '3', 
    name: 'Championship Series', 
    description: 'Annual championship regatta', 
    verified: true,
    startDate: '2025-08-15',
    endDate: '2025-08-17',
    frequency: 'Annual'
  },
];

export default function RaceSeriesVerificationScreen() {
  const router = useRouter();
  const [raceSeries, setRaceSeries] = useState(initialRaceSeries);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [newSeriesFrequency, setNewSeriesFrequency] = useState('Weekly');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFrequency, setEditFrequency] = useState('Weekly');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const toggleVerification = (id: string) => {
    setRaceSeries(raceSeries.map(series => 
      series.id === id ? { ...series, verified: !series.verified } : series
    ));
  };

  const addNewSeries = () => {
    if (newSeriesName.trim()) {
      const newSeries = {
        id: Date.now().toString(),
        name: newSeriesName,
        description: newSeriesDescription,
        verified: false,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        frequency: newSeriesFrequency
      };
      setRaceSeries([...raceSeries, newSeries]);
      setNewSeriesName('');
      setNewSeriesDescription('');
      setNewSeriesFrequency('Weekly');
    }
  };

  const startEditing = (series: any) => {
    setEditingId(series.id);
    setEditName(series.name);
    setEditDescription(series.description);
    setEditFrequency(series.frequency);
    setEditStartDate(series.startDate);
    setEditEndDate(series.endDate);
  };

  const saveEdit = () => {
    if (editingId) {
      setRaceSeries(raceSeries.map(series => 
        series.id === editingId 
          ? { ...series, name: editName, description: editDescription, frequency: editFrequency, startDate: editStartDate, endDate: editEndDate } 
          : series
      ));
      setEditingId(null);
    }
  };

  const deleteSeries = (id: string) => {
    showConfirm(
      "Delete Race Series",
      "Are you sure you want to delete this race series?",
      () => setRaceSeries(raceSeries.filter(series => series.id !== id)),
      { destructive: true },
    );
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const renderSeriesItem = ({ item }: { item: any }) => {
    if (editingId === item.id) {
      return (
        <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-2 text-base"
            value={editName}
            onChangeText={setEditName}
            placeholder="Series name"
          />
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-2 text-base"
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Description"
          />
          
          <View className="flex-row items-center mb-2">
            <Text className="text-gray-700 mr-2 w-24">Frequency:</Text>
            <TouchableOpacity 
              className="bg-blue-100 px-3 py-1 rounded-full"
              onPress={() => setEditFrequency(editFrequency === 'Weekly' ? 'Monthly' : editFrequency === 'Monthly' ? 'Annual' : 'Weekly')}
            >
              <Text className="text-blue-800">{editFrequency}</Text>
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center mb-2">
            <Text className="text-gray-700 mr-2 w-24">Start Date:</Text>
            <TextInput
              className="flex-1 border border-gray-300 rounded-lg p-2 text-base"
              value={editStartDate}
              onChangeText={setEditStartDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
          
          <View className="flex-row items-center mb-3">
            <Text className="text-gray-700 mr-2 w-24">End Date:</Text>
            <TextInput
              className="flex-1 border border-gray-300 rounded-lg p-2 text-base"
              value={editEndDate}
              onChangeText={setEditEndDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
          
          <View className="flex-row justify-end gap-2">
            <TouchableOpacity 
              className="bg-gray-200 px-4 py-2 rounded-lg"
              onPress={() => setEditingId(null)}
            >
              <Text className="text-gray-700 font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="bg-blue-600 px-4 py-2 rounded-lg"
              onPress={saveEdit}
            >
              <Text className="text-white font-medium">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-800">{item.name}</Text>
            <Text className="text-gray-600 mt-1">{item.description}</Text>
            
            <View className="flex-row items-center mt-2">
              <Calendar size={16} color="#6B7280" />
              <Text className="text-gray-500 ml-2 text-sm">
                {formatDate(item.startDate)} - {formatDate(item.endDate)}
              </Text>
            </View>
            
            <View className="flex-row mt-2">
              <View className="bg-blue-100 px-2 py-1 rounded-full mr-2">
                <Text className="text-blue-800 text-xs">{item.frequency}</Text>
              </View>
            </View>
          </View>
          
          <View className="flex-row gap-2">
            <TouchableOpacity 
              className={`p-2 rounded-full ${item.verified ? 'bg-green-100' : 'bg-gray-100'}`}
              onPress={() => toggleVerification(item.id)}
            >
              {item.verified ? (
                <Check color="#10B981" size={20} />
              ) : (
                <X color="#6B7280" size={20} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="p-2 rounded-full bg-blue-100"
              onPress={() => startEditing(item)}
            >
              <Edit3 color="#2563EB" size={20} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="p-2 rounded-full bg-red-100"
              onPress={() => deleteSeries(item.id)}
            >
              <Trash2 color="#EF4444" size={20} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View className="mt-3 flex-row">
          <View className={`px-3 py-1 rounded-full ${item.verified ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Text className={`text-xs font-medium ${item.verified ? 'text-green-800' : 'text-gray-800'}`}>
              {item.verified ? 'Verified' : 'Not Verified'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header with Blue Banner */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity className="p-2 -ml-2" onPress={() => router.push('/fleet-verification')}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold flex-1 text-center">Club Setup</Text>
          <View className="w-8" /> {/* Spacer for alignment */}
        </View>
        
        <View className="h-2 bg-blue-500 rounded-full mb-4">
          <View className="h-2 bg-white rounded-full w-[71.4%]" />
        </View>
        <Text className="text-white text-center">Step 5 of 7</Text>
      </View>

      {/* Content */}
      <View className="bg-white pt-4 pb-2 px-4 shadow-sm">
        <View className="flex-row items-center mb-4">
          <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
            <Calendar size={24} color="#2563EB" />
          </View>
          <View>
            <Text className="text-2xl font-bold text-gray-800">Race Series Verification</Text>
            <Text className="text-gray-600">
              Review and customize race series extracted from your website
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4 py-4">
        {/* Stats Summary */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <View className="flex-row justify-between">
            <View>
              <Text className="text-gray-500 text-sm">Total Series</Text>
              <Text className="text-2xl font-bold text-gray-800">{raceSeries.length}</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-sm">Verified</Text>
              <Text className="text-2xl font-bold text-green-600">
                {raceSeries.filter(s => s.verified).length}
              </Text>
            </View>
            <View>
              <Text className="text-gray-500 text-sm">Pending</Text>
              <Text className="text-2xl font-bold text-amber-600">
                {raceSeries.filter(s => !s.verified).length}
              </Text>
            </View>
          </View>
        </View>

        {/* Add New Series */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-3">Add New Series</Text>
          
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-2 text-base"
            value={newSeriesName}
            onChangeText={setNewSeriesName}
            placeholder="Series name"
          />
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-2 text-base"
            value={newSeriesDescription}
            onChangeText={setNewSeriesDescription}
            placeholder="Description (optional)"
          />
          
          <View className="flex-row items-center mb-3">
            <Text className="text-gray-700 mr-2">Frequency:</Text>
            <TouchableOpacity 
              className="bg-blue-100 px-3 py-1 rounded-full"
              onPress={() => setNewSeriesFrequency(newSeriesFrequency === 'Weekly' ? 'Monthly' : newSeriesFrequency === 'Monthly' ? 'Annual' : 'Weekly')}
            >
              <Text className="text-blue-800">{newSeriesFrequency}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            className="flex-row items-center justify-center bg-blue-600 p-3 rounded-lg"
            onPress={addNewSeries}
          >
            <Plus color="white" size={20} />
            <Text className="text-white font-bold ml-2">Add Series</Text>
          </TouchableOpacity>
        </View>

        {/* Race Series List */}
        <Text className="text-lg font-bold text-gray-800 mb-3">Extracted Race Series</Text>
        <FlatList
          data={raceSeries}
          renderItem={renderSeriesItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </ScrollView>

      {/* Footer with Consistent Buttons */}
      <View className="px-4 pb-6">
        <View className="flex-row space-x-3">
          <TouchableOpacity 
            className="flex-1 bg-gray-200 py-4 rounded-xl items-center"
            onPress={() => router.push('/club-dashboard')}
          >
            <Text className="text-gray-700 font-bold">Complete later</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="flex-1 bg-blue-600 py-4 rounded-xl items-center"
            onPress={() => router.push('/club-dashboard')}
          >
            <Text className="text-white font-bold">Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
