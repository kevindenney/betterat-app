import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Check, X, Edit3, MapPin, Plus, Search, ChevronLeft, Navigation } from 'lucide-react-native';

type Venue = {
  id: string;
  name: string;
  address: string;
  location: string;
  status: 'verified' | 'pending' | 'needs-review';
  notes?: string;
};

export default function VenueVerificationScreen() {
  const [venues, setVenues] = useState<Venue[]>([
    {
      id: '1',
      name: 'Main Harbor Marina',
      address: '123 Marina Drive, Coastal City',
      location: 'Dock A, Slip 10-15',
      status: 'verified',
      notes: 'Primary sailing venue'
    },
    {
      id: '2',
      name: 'North Lake Sailing Center',
      address: '456 Lakeview Blvd, Northern District',
      location: 'Lake Pavilion, Bay 3',
      status: 'pending',
      notes: 'Summer training venue'
    },
    {
      id: '3',
      name: 'Riverside Yacht Club',
      address: '789 River Road, Downtown',
      location: 'Pier 7, Sections C-E',
      status: 'needs-review',
      notes: 'Potential expansion venue'
    }
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Venue>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Venue['status']>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVenue, setNewVenue] = useState({
    name: '',
    address: '',
    location: '',
    notes: ''
  });

  const handleEdit = (venue: Venue) => {
    setEditingId(venue.id);
    setEditForm({ ...venue });
  };

  const handleSave = () => {
    if (!editingId) return;

    setVenues(prev => 
      prev.map(venue => 
        venue.id === editingId ? { ...venue, ...editForm } as Venue : venue
      )
    );
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleAddVenue = () => {
    if (!newVenue.name.trim()) return;
    
    const venueToAdd: Venue = {
      id: (venues.length + 1).toString(),
      name: newVenue.name,
      address: newVenue.address,
      location: newVenue.location,
      status: 'pending',
      notes: newVenue.notes
    };
    
    setVenues([...venues, venueToAdd]);
    setNewVenue({ name: '', address: '', location: '', notes: '' });
    setShowAddForm(false);
  };

  const getStatusColor = (status: Venue['status']) => {
    switch (status) {
      case 'verified': return 'bg-green-100 border-green-500';
      case 'pending': return 'bg-yellow-100 border-yellow-500';
      case 'needs-review': return 'bg-red-100 border-red-500';
      default: return 'bg-gray-100 border-gray-500';
    }
  };

  const getStatusText = (status: Venue['status']) => {
    switch (status) {
      case 'verified': return 'Verified';
      case 'pending': return 'Pending Review';
      case 'needs-review': return 'Needs Review';
      default: return 'Unknown';
    }
  };

  const filteredVenues = venues.filter(venue => {
    const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         venue.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatusFilter = filterStatus === 'all' || venue.status === filterStatus;
    return matchesSearch && matchesStatusFilter;
  });

  const renderVenueItem = ({ item }: { item: Venue }) => {
    if (editingId === item.id) {
      return (
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200 shadow-sm">
          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Venue Name</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              value={editForm.name || ''}
              onChangeText={(text) => setEditForm({ ...editForm, name: text })}
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Address</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              value={editForm.address || ''}
              onChangeText={(text) => setEditForm({ ...editForm, address: text })}
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Location Details</Text>
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
      <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
              <MapPin size={20} color="#007AFF" />
            </View>
            <View>
              <Text className="text-lg font-bold text-gray-800">{item.name}</Text>
              <Text className="text-gray-600">{item.address}</Text>
            </View>
          </View>
          <View className={`px-3 py-1 rounded-full border ${getStatusColor(item.status)}`}>
            <Text className="text-xs font-medium">
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <View className="mb-3">
          <Text className="text-gray-500 text-sm mb-1">Location Details:</Text>
          <Text className="text-gray-700">{item.location}</Text>
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
    <View className="flex-1 bg-gray-50">
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
          <View className="h-2 bg-white rounded-full w-[71.4%]" />
        </View>
        <Text className="text-white text-center">Step 5 of 7</Text>
      </View>

      {/* Content */}
      <View className="bg-white pt-4 pb-2 px-4 shadow-sm">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-gray-800">Venue Verification</Text>
          <Navigation size={28} color="#007AFF" />
        </View>
        <Text className="text-gray-600">
          Locate and verify all venues associated with your sailing club
        </Text>
      </View>

      {/* Search and Filter */}
      <View className="px-4 py-3 bg-white mb-4">
        <View className="flex-row mb-3">
          <View className="flex-row items-center flex-1 bg-gray-100 rounded-lg px-3 py-2">
            <Search size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-2 text-gray-700"
              placeholder="Search venues..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View className="flex-row mb-3">
          <TouchableOpacity 
            className={`flex-1 items-center py-2 rounded-lg mr-2 ${filterStatus === 'all' ? 'bg-blue-100 border border-blue-300' : 'bg-gray-100'}`}
            onPress={() => setFilterStatus('all')}
          >
            <Text className={filterStatus === 'all' ? 'text-blue-600 font-medium' : 'text-gray-600'}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 items-center py-2 rounded-lg mx-1 ${filterStatus === 'verified' ? 'bg-green-100 border border-green-300' : 'bg-gray-100'}`}
            onPress={() => setFilterStatus('verified')}
          >
            <Text className={filterStatus === 'verified' ? 'text-green-600 font-medium' : 'text-gray-600'}>Verified</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 items-center py-2 rounded-lg mx-1 ${filterStatus === 'pending' ? 'bg-yellow-100 border border-yellow-300' : 'bg-gray-100'}`}
            onPress={() => setFilterStatus('pending')}
          >
            <Text className={filterStatus === 'pending' ? 'text-yellow-600 font-medium' : 'text-gray-600'}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 items-center py-2 rounded-lg ml-2 ${filterStatus === 'needs-review' ? 'bg-red-100 border border-red-300' : 'bg-gray-100'}`}
            onPress={() => setFilterStatus('needs-review')}
          >
            <Text className={filterStatus === 'needs-review' ? 'text-red-600 font-medium' : 'text-gray-600'}>Review</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Summary */}
      <View className="flex-row px-4 pb-4 bg-white">
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-blue-600">{venues.length}</Text>
          <Text className="text-gray-600 text-sm">Total Venues</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-green-600">
            {venues.filter(v => v.status === 'verified').length}
          </Text>
          <Text className="text-gray-600 text-sm">Verified</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-yellow-600">
            {venues.filter(v => v.status === 'pending').length}
          </Text>
          <Text className="text-gray-600 text-sm">Pending</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-red-600">
            {venues.filter(v => v.status === 'needs-review').length}
          </Text>
          <Text className="text-gray-600 text-sm">Needs Review</Text>
        </View>
      </View>

      {/* Add Venue Form */}
      {showAddForm ? (
        <View className="bg-white rounded-xl p-4 mx-4 mb-4 border border-gray-200 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-3">Add New Venue</Text>
          
          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Venue Name</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              placeholder="e.g. Main Harbor Marina"
              value={newVenue.name}
              onChangeText={(text) => setNewVenue({ ...newVenue, name: text })}
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Address</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              placeholder="Full address"
              value={newVenue.address}
              onChangeText={(text) => setNewVenue({ ...newVenue, address: text })}
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">Location Details</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              placeholder="Dock, pier, or section details"
              value={newVenue.location}
              onChangeText={(text) => setNewVenue({ ...newVenue, location: text })}
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-500 text-sm mb-1">Notes</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 bg-gray-50"
              placeholder="Additional information"
              value={newVenue.notes}
              onChangeText={(text) => setNewVenue({ ...newVenue, notes: text })}
              multiline
              numberOfLines={2}
            />
          </View>

          <View className="flex-row justify-end space-x-3">
            <TouchableOpacity 
              className="flex-row items-center bg-gray-200 px-4 py-2 rounded-lg"
              onPress={() => setShowAddForm(false)}
            >
              <X size={16} color="#374151" />
              <Text className="ml-1 text-gray-700 font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-row items-center bg-blue-600 px-4 py-2 rounded-lg"
              onPress={handleAddVenue}
            >
              <Plus size={16} color="white" />
              <Text className="ml-1 text-white font-medium">Add Venue</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          className="flex-row items-center self-start mx-4 mb-4 bg-blue-50 px-4 py-3 rounded-lg"
          onPress={() => setShowAddForm(true)}
        >
          <Plus size={20} color="#007AFF" />
          <Text className="ml-1 text-blue-600 font-medium">Add New Venue</Text>
        </TouchableOpacity>
      )}

      {/* Venues List */}
      <ScrollView className="flex-1 px-4">
        <Text className="text-lg font-bold text-gray-800 mb-3">
          {filteredVenues.length} Venue{filteredVenues.length !== 1 ? 's' : ''} Found
        </Text>
        <FlatList
          data={filteredVenues}
          renderItem={renderVenueItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </ScrollView>

      {/* Footer with Consistent Buttons */}
      <View className="px-4 pb-6 bg-gray-50">
        <View className="flex-row space-x-3">
          <TouchableOpacity 
            className="flex-1 bg-gray-200 py-4 rounded-xl items-center"
          >
            <Text className="text-gray-700 font-bold">Complete later</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="flex-1 bg-blue-600 py-4 rounded-xl items-center"
          >
            <Text className="text-white font-bold">Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}