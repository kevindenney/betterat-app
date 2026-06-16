import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Image } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useSailorOnboardingState } from '@/hooks/useSailorOnboardingState';
import { 
MapPin, Anchor, Users, Calendar, Circle, ChevronRight,
Download, Clock, CheckCircle2, XCircle, Edit3, CalendarDays,
Wifi, WifiOff, RefreshCw, Trophy, User, Mail, Phone, MessageCircle, Shield
} from 'lucide-react-native';

export default function ReviewScreen() {
const router = useRouter();
const { updateUserProfile } = useAuth();
const { state, saveToSupabase } = useSailorOnboardingState();
const [isCompleting, setIsCompleting] = useState(false);

// Mock data from previous screens
const [location] = useState({
name: 'Royal Hong Kong Yacht Club',
address: 'Repulse Bay, Hong Kong Island',
confidence: 92
});

const [boats] = useState([
{ id: 1, name: 'Dragon', status: 'confirmed' },
{ id: 2, name: 'International Dragon', status: 'confirmed' }
]);

const [fleets, setFleets] = useState([
{ 
id: 1, 
name: 'RHKYC Dragons', 
members: 42, 
notifications: true,
status: 'confirmed'
},
{ 
id: 5, 
name: 'RHKYC Wednesday Racing', 
members: 24, 
notifications: false,
status: 'suggested'
}
]);

const [clubs, setClubs] = useState([
{ 
id: '1', 
name: 'Royal Ocean Sailing Club', 
location: 'Santa Monica, CA', 
members: 1240, 
rating: 4.8, 
image: 'https://images.unsplash.com/photo-1627923316244-f4da80d8f281?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fEJvYXQlMjBzaGlwJTIwc2FpbGluZyUyMHdhdGVyJTIwbWFyaW5lfGVufDB8fDB8fHww',
status: 'confirmed'
}
]);

const [raceCalendarStatus, setRaceCalendarStatus] = useState<'imported' | 'pending' | 'none'>('imported'); // 'imported', 'pending', 'none'
const [isSyncing, setIsSyncing] = useState(false);

// Mock data for selected races
const [selectedRaces] = useState([
{ id: 'r1', name: 'Summer Series', club: 'Royal Ocean Sailing Club', date: '2023-07-15' },
{ id: 'r2', name: 'Friday Fleet Race', club: 'Marina Bay Sailing Association', date: '2023-07-21' }
]);

// Handle edit actions
const handleEditLocation = () => {
showAlert('Edit Location', 'Navigate to location selection screen');
};

const handleEditBoats = () => {
showAlert('Edit Boats', 'Navigate to boat selection screen');
};

const handleEditFleets = () => {
showAlert('Edit Fleets', 'Navigate to fleet selection screen');
};

const handleEditClubs = () => {
showAlert('Edit Clubs', 'Navigate to club selection screen');
};

const handleEditRaceCalendar = () => {
showAlert('Edit Race Calendar', 'Navigate to calendar import screen');
};

const handleEditRaces = () => {
showAlert('Edit Races', 'Navigate to race selection screen');
};

const handleEditCrew = () => {
router.push('/crew');
};

const handleImportCalendar = () => {
setRaceCalendarStatus('pending');
setIsSyncing(true);

// Simulate import process
setTimeout(() => {
setRaceCalendarStatus('imported');
setIsSyncing(false);
}, 2000);
};

const handleRetryImport = () => {
setRaceCalendarStatus('pending');
setIsSyncing(true);

// Simulate retry process
setTimeout(() => {
setRaceCalendarStatus('imported');
setIsSyncing(false);
}, 2000);
};

const handleCompleteSetup = async () => {
setIsCompleting(true);
try {
// Try to save onboarding data if we have a venue
if (state.venue) {
  try {
    const saveResult = await saveToSupabase();

    if (!saveResult.success) {
      console.warn('Failed to save onboarding data:', saveResult.error);
      // Don't block completion if save fails - user can add data later
    }
  } catch (saveError) {
    console.error('Error saving onboarding data:', saveError);
    // Continue anyway - don't block completion
  }
}

// Always mark onboarding as complete and navigate
try {
  await updateUserProfile({
    onboarding_completed: true,
  });
} catch (profileError) {
  console.error('Error updating user profile:', profileError);
  // Still try to navigate - the update might have succeeded
}

// Navigate to the main dashboard
router.replace('/(tabs)/dashboard');
} catch (error) {
console.error('Error completing setup:', error);
// Even on error, try to navigate to dashboard
try {
  await updateUserProfile({ onboarding_completed: true });
  router.replace('/(tabs)/dashboard');
} catch (finalError) {
  showAlert('Error', `Failed to complete setup: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
  setIsCompleting(false);
}
}
};

const handleRemoveClub = (clubId: string) => {
showConfirm(
'Remove Club',
'Are you sure you want to disconnect from this club?',
() => setClubs(clubs.filter(club => club.id !== clubId)),
{ destructive: true }
);
};

const toggleFleetNotification = (fleetId: number) => {
setFleets(fleets.map(fleet => 
fleet.id === fleetId 
? { ...fleet, notifications: !fleet.notifications } 
: fleet
));
};

return (
<View className="flex-1 bg-gray-50">
{/* Header */}
<View className="bg-blue-600 px-4 pt-12 pb-6">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-white text-lg font-semibold">Step 5 of 5</Text>
<Text className="text-white text-sm">1:15 remaining</Text>
</View>

{/* Progress Bar */}
<View className="h-2 bg-blue-400 rounded-full">
<View className="w-full h-2 bg-white rounded-full" />
</View>
</View>

{/* Main Content */}
<ScrollView className="flex-1 px-4 py-6">
<Text className="text-2xl font-bold text-gray-800 mb-2">
Review Your Selections
</Text>
<Text className="text-gray-500 mb-6">
Confirm your choices before finalizing your profile
</Text>

{/* Location Card */}
<View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-lg font-bold text-gray-800">Location</Text>
<TouchableOpacity 
className="flex-row items-center"
onPress={handleEditLocation}
>
<Edit3 size={18} color="#007AFF" />
<Text className="text-blue-600 font-medium ml-1">Edit</Text>
</TouchableOpacity>
</View>

<View className="flex-row items-start">
<View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
<MapPin size={24} color="#007AFF" />
</View>
<View className="flex-1">
<Text className="text-gray-800 font-semibold text-lg">{location.name}</Text>
<Text className="text-gray-600 text-sm mt-1">{location.address}</Text>
<View className="flex-row items-center mt-2">
<View className="h-2 flex-1 bg-gray-200 rounded-full mr-2">
<View 
className="h-2 bg-green-500 rounded-full" 
style={{ width: `${location.confidence}%` }}
/>
</View>
<Text className="text-gray-500 text-sm">{location.confidence}% match</Text>
</View>
</View>
</View>
</View>

{/* Boats Section */}
<View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-lg font-bold text-gray-800">Boats</Text>
<TouchableOpacity 
className="flex-row items-center"
onPress={handleEditBoats}
>
<Edit3 size={18} color="#007AFF" />
<Text className="text-blue-600 font-medium ml-1">Edit</Text>
</TouchableOpacity>
</View>

{boats.map((boat) => (
<View key={boat.id} className="flex-row items-center py-3 border-b border-gray-100 last:border-0">
<CheckCircle2 size={20} color="#10B981" className="mr-3" />
<View className="flex-row items-center flex-1">
<Anchor size={20} color="#6B7280" className="mr-3" />
<Text className="text-gray-800 font-medium">{boat.name}</Text>
</View>
<Text className="text-green-600 text-sm font-medium">Confirmed</Text>
</View>
))}
</View>

{/* Fleets Section */}
<View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-lg font-bold text-gray-800">Fleets</Text>
<TouchableOpacity 
className="flex-row items-center"
onPress={handleEditFleets}
>
<Edit3 size={18} color="#007AFF" />
<Text className="text-blue-600 font-medium ml-1">Edit</Text>
</TouchableOpacity>
</View>

{fleets.map((fleet) => (
<View key={fleet.id} className="flex-row items-center py-3 border-b border-gray-100 last:border-0">
{fleet.status === 'confirmed' ? (
<CheckCircle2 size={20} color="#10B981" className="mr-3" />
) : (
<Circle size={20} color="#6B7280" className="mr-3" />
)}
<View className="flex-row items-center flex-1">
<Users size={20} color="#6B7280" className="mr-3" />
<View>
<Text className="text-gray-800 font-medium">{fleet.name}</Text>
<Text className="text-gray-500 text-sm">{fleet.members} members</Text>
</View>
</View>
<TouchableOpacity 
className="ml-2"
onPress={() => toggleFleetNotification(fleet.id)}
>
{fleet.notifications ? (
<Wifi size={20} color="#007AFF" />
) : (
<WifiOff size={20} color="#9CA3AF" />
)}
</TouchableOpacity>
</View>
))}
</View>

{/* Clubs Section */}
<View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-lg font-bold text-gray-800">Clubs</Text>
<TouchableOpacity 
className="flex-row items-center"
onPress={handleEditClubs}
>
<Edit3 size={18} color="#007AFF" />
<Text className="text-blue-600 font-medium ml-1">Edit</Text>
</TouchableOpacity>
</View>

{clubs.map((club) => (
<View key={club.id} className="flex-row py-3 border-b border-gray-100 last:border-0">
<CheckCircle2 size={20} color="#10B981" className="mr-3 mt-1" />
<View className="flex-1">
<View className="flex-row">
<Image 
source={{ uri: club.image }} 
className="w-12 h-12 rounded-lg mr-3"
/>
<View className="flex-1">
<Text className="text-gray-800 font-medium">{club.name}</Text>
<View className="flex-row items-center mt-1">
<MapPin size={14} color="#6B7280" />
<Text className="text-gray-500 text-sm ml-1">{club.location}</Text>
</View>
<View className="flex-row items-center mt-1">
<Users size={14} color="#6B7280" />
<Text className="text-gray-500 text-sm ml-1">{club.members} members</Text>
<Text className="text-gray-500 text-sm mx-2">•</Text>
<Text className="text-gray-500 text-sm">★ {club.rating}</Text>
</View>
</View>
</View>
<View className="flex-row items-center justify-between mt-3">
<Text className="text-green-600 text-sm font-medium">Connected</Text>
<TouchableOpacity 
className="bg-red-50 px-3 py-1 rounded-full"
onPress={() => handleRemoveClub(club.id)}
>
<Text className="text-red-600 text-sm font-medium">Disconnect</Text>
</TouchableOpacity>
</View>
</View>
</View>
))}
</View>

{/* Selected Races Section */}
<View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-lg font-bold text-gray-800">Selected Races</Text>
<TouchableOpacity 
className="flex-row items-center"
onPress={handleEditRaces}
>
<Edit3 size={18} color="#007AFF" />
<Text className="text-blue-600 font-medium ml-1">Edit</Text>
</TouchableOpacity>
</View>

{selectedRaces.length > 0 ? (
selectedRaces.map((race) => (
<View key={race.id} className="flex-row items-center py-3 border-b border-gray-100 last:border-0">
<Trophy size={20} color="#F59E0B" className="mr-3" />
<View className="flex-1">
<Text className="text-gray-800 font-medium">{race.name}</Text>
<View className="flex-row items-center mt-1">
<Users size={14} color="#6B7280" />
<Text className="text-gray-500 text-sm ml-1">{race.club}</Text>
<Text className="text-gray-500 text-sm mx-2">•</Text>
<Calendar size={14} color="#6B7280" />
<Text className="text-gray-500 text-sm ml-1">{race.date}</Text>
</View>
</View>
</View>
))
) : (
<View className="flex-row items-center py-3">
<XCircle size={24} color="#EF4444" className="mr-3" />
<View className="flex-1">
<Text className="text-gray-800 font-medium">No Races Selected</Text>
<Text className="text-gray-500 text-sm mt-1">Add races to track and participate</Text>
</View>
<TouchableOpacity 
className="bg-blue-600 rounded-full px-3 py-1"
onPress={handleEditRaces}
>
<Text className="text-white text-sm font-medium">Add</Text>
</TouchableOpacity>
</View>
)}
</View>

{/* Crew Section */}
{state.crew && (
<View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-lg font-bold text-gray-800">Crew</Text>
<TouchableOpacity 
className="flex-row items-center"
onPress={handleEditCrew}
>
<Edit3 size={18} color="#007AFF" />
<Text className="text-blue-600 font-medium ml-1">Edit</Text>
</TouchableOpacity>
</View>

{state.crew.crewMembers && state.crew.crewMembers.length > 0 ? (
state.crew.crewMembers.map((member) => (
<View key={member.id} className="flex-row items-center py-3 border-b border-gray-100 last:border-0">
<CheckCircle2 size={20} color="#10B981" className="mr-3" />
<View className="flex-1">
<View className="flex-row items-center mb-1">
<User size={18} color="#6B7280" className="mr-2" />
<Text className="text-gray-800 font-medium">{member.name}</Text>
</View>
<Text className="text-blue-600 text-sm mb-2">{member.role}</Text>
<View className="flex-row flex-wrap gap-2">
{member.email && (
<View className="flex-row items-center bg-blue-50 rounded-full px-2 py-1">
<Mail size={12} color="#007AFF" />
<Text className="text-blue-600 text-xs ml-1">{member.email}</Text>
</View>
)}
{member.phone && (
<View className="flex-row items-center bg-blue-50 rounded-full px-2 py-1">
<Phone size={12} color="#007AFF" />
<Text className="text-blue-600 text-xs ml-1">{member.phone}</Text>
</View>
)}
{member.communicationMethods && member.communicationMethods.map((methodId) => {
const methodIcons: Record<string, any> = {
phone: Phone,
email: Mail,
whatsapp: MessageCircle,
signal: Shield,
};
const Icon = methodIcons[methodId] || User;
return (
<View key={methodId} className="flex-row items-center bg-green-50 rounded-full px-2 py-1">
<Icon size={12} color="#10B981" />
<Text className="text-green-600 text-xs ml-1 capitalize">{methodId}</Text>
</View>
);
})}
{member.hasAccess && (
<View className="flex-row items-center bg-purple-50 rounded-full px-2 py-1">
<Shield size={12} color="#8B5CF6" />
<Text className="text-purple-600 text-xs ml-1">Has Access</Text>
</View>
)}
</View>
</View>
</View>
))
) : (
<View className="flex-row items-center py-3">
<XCircle size={24} color="#EF4444" className="mr-3" />
<View className="flex-1">
<Text className="text-gray-800 font-medium">No Crew Members Added</Text>
<Text className="text-gray-500 text-sm mt-1">Add crew members to track your team</Text>
</View>
<TouchableOpacity 
className="bg-blue-600 rounded-full px-3 py-1"
onPress={handleEditCrew}
>
<Text className="text-white text-sm font-medium">Add</Text>
</TouchableOpacity>
</View>
)}
</View>
)}

{/* Race Calendar Section */}
<View className="bg-white rounded-xl p-5 mb-5 shadow-sm border border-gray-100">
<View className="flex-row items-center justify-between mb-4">
<Text className="text-lg font-bold text-gray-800">Race Calendar</Text>
<TouchableOpacity 
className="flex-row items-center"
onPress={handleEditRaceCalendar}
>
<Edit3 size={18} color="#007AFF" />
<Text className="text-blue-600 font-medium ml-1">Edit</Text>
</TouchableOpacity>
</View>

{raceCalendarStatus === 'imported' ? (
<View className="flex-row items-center py-3">
<CalendarDays size={24} color="#10B981" className="mr-3" />
<View className="flex-1">
<Text className="text-gray-800 font-medium">Race Calendar Imported</Text>
<Text className="text-gray-500 text-sm mt-1">Events from Royal Ocean Sailing Club</Text>
</View>
<TouchableOpacity 
className="flex-row items-center bg-blue-100 rounded-full px-3 py-1"
onPress={handleRetryImport}
disabled={isSyncing}
>
{isSyncing ? (
<RefreshCw size={16} color="#007AFF" className="mr-1 animate-spin" />
) : (
<RefreshCw size={16} color="#007AFF" className="mr-1" />
)}
<Text className="text-blue-600 text-sm font-medium">Sync</Text>
</TouchableOpacity>
</View>
) : raceCalendarStatus === 'pending' ? (
<View className="flex-row items-center py-3">
<Clock size={24} color="#F59E0B" className="mr-3" />
<View className="flex-1">
<Text className="text-gray-800 font-medium">Import Pending</Text>
<Text className="text-gray-500 text-sm mt-1">Waiting for confirmation</Text>
</View>
<TouchableOpacity 
className="bg-blue-100 rounded-full px-3 py-1 flex-row items-center"
onPress={handleRetryImport}
disabled={isSyncing}
>
{isSyncing ? (
<RefreshCw size={16} color="#007AFF" className="mr-1 animate-spin" />
) : (
<RefreshCw size={16} color="#007AFF" className="mr-1" />
)}
<Text className="text-blue-600 text-sm font-medium">Retry</Text>
</TouchableOpacity>
</View>
) : (
<View className="flex-row items-center py-3">
<XCircle size={24} color="#EF4444" className="mr-3" />
<View className="flex-1">
<Text className="text-gray-800 font-medium">No Calendar Imported</Text>
<Text className="text-gray-500 text-sm mt-1">Import calendar for race notifications</Text>
</View>
<TouchableOpacity 
className="bg-blue-600 rounded-full px-3 py-1 flex-row items-center"
onPress={handleImportCalendar}
disabled={isSyncing}
>
{isSyncing ? (
<RefreshCw size={16} color="white" className="mr-1 animate-spin" />
) : (
<Download size={16} color="white" className="mr-1" />
)}
<Text className="text-white text-sm font-medium">Import</Text>
</TouchableOpacity>
</View>
)}
</View>
</ScrollView>

{/* Bottom Action */}
<View className="px-4 py-4 border-t border-gray-200 bg-white">
<TouchableOpacity 
className={`rounded-xl py-4 flex-row items-center justify-center ${isCompleting ? 'bg-blue-400' : 'bg-blue-600'}`}
onPress={handleCompleteSetup}
disabled={isCompleting}
>
{isCompleting ? (
<>
<ActivityIndicator size="small" color="white" />
<Text className="text-white font-semibold text-lg ml-2">
Completing...
</Text>
</>
) : (
<>
<Text className="text-white font-semibold text-lg">
Complete Setup
</Text>
<ChevronRight size={20} color="white" className="ml-2" />
</>
)}
</TouchableOpacity>
</View>
</View>
);
}