import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import {
User,
Users,
Flag,
Shield,
FileText,
MessageCircle,
BarChart2,
Settings,
CreditCard,
ChevronRight,
LogOut,
HelpCircle,
MapPin,
Bell
} from "lucide-react-native";

export default function MoreScreen() {
const menuItems = [
{ icon: <User size={20} color="#1F2937" />, title: "Club Profile", screen: "ClubProfile" },
{ icon: <Users size={20} color="#1F2937" />, title: "Members", screen: "Members" },
{ icon: <Flag size={20} color="#1F2937" />, title: "Fleets", screen: "Fleets" },
{ icon: <Shield size={20} color="#1F2937" />, title: "Officials", screen: "Officials" },
{ icon: <FileText size={20} color="#1F2937" />, title: "Documents", screen: "Documents" },
{ icon: <MessageCircle size={20} color="#1F2937" />, title: "Communications", screen: "Communications" },
{ icon: <BarChart2 size={20} color="#1F2937" />, title: "Analytics", screen: "Analytics" },
{ icon: <Settings size={20} color="#1F2937" />, title: "Settings", screen: "Settings" },
{ icon: <CreditCard size={20} color="#1F2937" />, title: "Billing", screen: "Billing" },
];

return (
<View className="flex-1 bg-white">
{/* Header */}
<View className="bg-blue-600 pt-12 pb-6 px-4">
<View className="flex-row justify-between items-center mb-2">
<Text className="text-white text-2xl font-bold">RHKYC</Text>
<TouchableOpacity className="bg-blue-700 p-2 rounded-full">
<Bell color="white" size={24} />
</TouchableOpacity>
</View>
<Text className="text-blue-200">Victoria Harbour, Hong Kong</Text>
</View>

<ScrollView className="flex-1 px-4 py-6">
{/* Profile Section */}
<View className="mb-8">
<View className="items-center">
<View className="w-20 h-20 rounded-full bg-blue-100 mb-4 items-center justify-center">
<Text className="text-2xl font-bold text-blue-600">R</Text>
</View>
<Text className="text-xl font-bold text-gray-800">Royal Hong Kong Yacht Club</Text>
<View className="flex-row items-center mt-1">
<MapPin size={14} color="#6B7280" />
<Text className="text-gray-500 text-sm ml-1">Hong Kong</Text>
</View>
<TouchableOpacity className="mt-4 py-2 px-4 bg-blue-600 rounded-lg">
<Text className="text-white font-medium">Edit Club Profile</Text>
</TouchableOpacity>
</View>
</View>

{/* Menu Items */}
<View className="bg-white rounded-xl overflow-hidden shadow">
{menuItems.map((item, index) => (
<TouchableOpacity 
key={index}
className={`flex-row items-center py-4 px-4 ${index < menuItems.length - 1 ? 'border-b border-gray-100' : ''}`}
>
<View className="w-8 mr-3">
{item.icon}
</View>
<Text className="flex-1 text-gray-800 font-medium">{item.title}</Text>
<ChevronRight size={20} color="#9CA3AF" />
</TouchableOpacity>
))}
</View>

{/* Bottom Section */}
<View className="mt-8 items-center">
<Text className="text-gray-400 text-sm mb-6">Version 1.2.0</Text>

<TouchableOpacity className="flex-row items-center py-3 px-6 mb-4 bg-red-50 rounded-lg">
<LogOut size={20} color="#EF4444" className="mr-2" />
<Text className="text-red-500 font-medium">Sign Out</Text>
</TouchableOpacity>

<TouchableOpacity className="flex-row items-center py-3 px-6">
<HelpCircle size={20} color="#007AFF" className="mr-2" />
<Text className="text-blue-600 font-medium">Help & Support</Text>
</TouchableOpacity>
</View>
</ScrollView>
</View>
);
}