import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Check, X, Plus, Edit3, Trash2, ChevronLeft, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Mock data for fleets extracted from website
const initialFleets = [
{ id: '1', name: 'J/70 Fleet', description: 'Active racing fleet for J/70 class', verified: true },
{ id: '2', name: 'Laser Radial Fleet', description: 'Youth sailing program fleet', verified: false },
{ id: '3', name: 'Melges 24 Fleet', description: 'Weekend racing series', verified: true },
{ id: '4', name: 'Optimist Fleet', description: 'Learn to sail program', verified: false },
];

export default function FleetVerificationScreen() {
const router = useRouter();
const [fleets, setFleets] = useState(initialFleets);
const [newFleetName, setNewFleetName] = useState('');
const [newFleetDescription, setNewFleetDescription] = useState('');
const [editingId, setEditingId] = useState<string | null>(null);
const [editName, setEditName] = useState('');
const [editDescription, setEditDescription] = useState('');

const toggleVerification = (id: string) => {
setFleets(fleets.map(fleet => 
fleet.id === id ? { ...fleet, verified: !fleet.verified } : fleet
));
};

const addNewFleet = () => {
if (newFleetName.trim()) {
const newFleet = {
id: Date.now().toString(),
name: newFleetName,
description: newFleetDescription,
verified: false
};
setFleets([...fleets, newFleet]);
setNewFleetName('');
setNewFleetDescription('');
}
};

const startEditing = (fleet: { id: string; name: string; description: string }) => {
setEditingId(fleet.id);
setEditName(fleet.name);
setEditDescription(fleet.description);
};

const saveEdit = () => {
if (editingId) {
setFleets(fleets.map(fleet => 
fleet.id === editingId 
? { ...fleet, name: editName, description: editDescription } 
: fleet
));
setEditingId(null);
}
};

const deleteFleet = (id: string) => {
setFleets(fleets.filter(fleet => fleet.id !== id));
};

const renderFleetItem = ({ item }: { item: typeof initialFleets[0] }) => {
if (editingId === item.id) {
return (
<View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
<TextInput
className="border border-gray-300 rounded-lg p-3 mb-2 text-base"
value={editName}
onChangeText={setEditName}
placeholder="Fleet name"
/>
<TextInput
className="border border-gray-300 rounded-lg p-3 mb-3 text-base"
value={editDescription}
onChangeText={setEditDescription}
placeholder="Description"
/>
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
<Edit3 color="#007AFF" size={20} />
</TouchableOpacity>

<TouchableOpacity 
className="p-2 rounded-full bg-red-100"
onPress={() => deleteFleet(item.id)}
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
<TouchableOpacity className="p-2 -ml-2" onPress={() => router.back()}>
<ChevronLeft size={24} color="#FFFFFF" />
</TouchableOpacity>
<Text className="text-white text-lg font-bold flex-1 text-center">Club Setup</Text>
<View className="w-8" /> {/* Spacer for alignment */}

</View>

<View className="h-2 bg-blue-500 rounded-full mb-4">
<View className="h-2 bg-white rounded-full w-[57.1%]" />
</View>
<Text className="text-white text-center">Step 4 of 7</Text>
</View>

{/* Content */}
<View className="bg-white pt-4 pb-2 px-4 shadow-sm">
<View className="flex-row items-center mb-4">
<View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
<Users size={24} color="#007AFF" />
</View>
<View>
<Text className="text-2xl font-bold text-gray-800">Fleet Verification</Text>
<Text className="text-gray-600">
Review and customize fleets extracted from your website
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
<Text className="text-gray-500 text-sm">Total Fleets</Text>
<Text className="text-2xl font-bold text-gray-800">{fleets.length}</Text>
</View>
<View>
<Text className="text-gray-500 text-sm">Verified</Text>
<Text className="text-2xl font-bold text-green-600">
{fleets.filter(f => f.verified).length}
</Text>
</View>
<View>
<Text className="text-gray-500 text-sm">Pending</Text>
<Text className="text-2xl font-bold text-amber-600">
{fleets.filter(f => !f.verified).length}
</Text>
</View>
</View>
</View>

{/* Add New Fleet */}
<View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
<Text className="text-lg font-bold text-gray-800 mb-3">Add New Fleet</Text>
<TextInput
className="border border-gray-300 rounded-lg p-3 mb-2 text-base"
value={newFleetName}
onChangeText={setNewFleetName}
placeholder="Fleet name"
/>
<TextInput
className="border border-gray-300 rounded-lg p-3 mb-3 text-base"
value={newFleetDescription}
onChangeText={setNewFleetDescription}
placeholder="Description (optional)"
/>
<TouchableOpacity 
className="flex-row items-center justify-center bg-blue-600 p-3 rounded-lg"
onPress={addNewFleet}
>
<Plus color="white" size={20} />
<Text className="text-white font-bold ml-2">Add Fleet</Text>
</TouchableOpacity>
</View>

{/* Fleet List */}
<Text className="text-lg font-bold text-gray-800 mb-3">Extracted Fleets</Text>
<FlatList
data={fleets}
renderItem={renderFleetItem}
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
onPress={() => router.push('/race-series-verification')}
>
<Text className="text-white font-bold">Continue</Text>
</TouchableOpacity>
</View>
</View>
</View>
);
}
