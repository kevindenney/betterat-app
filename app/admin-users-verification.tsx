import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Check, X, Edit3, User, Shield, Search, ChevronLeft } from 'lucide-react-native';

type AdminUser = {
id: string;
name: string;
email: string;
role: 'admin' | 'editor' | 'viewer';
status: 'verified' | 'pending' | 'needs-review';
notes?: string;
avatar?: string;
};

export default function AdminUsersVerificationScreen() {
const [users, setUsers] = useState<AdminUser[]>([
{
id: '1',
name: 'Alex Morgan',
email: 'alex@rowingclub.org',
role: 'admin',
status: 'verified',
notes: 'Club President'
},
{
id: '2',
name: 'Jamie Smith',
email: 'jamie@rowingclub.org',
role: 'editor',
status: 'pending',
notes: 'Extracted from website team page'
},
{
id: '3',
name: 'Taylor Johnson',
email: 'taylor@rowingclub.org',
role: 'viewer',
status: 'needs-review',
notes: 'Email domain mismatch'
},
{
id: '4',
name: 'Jordan Williams',
email: 'jordan@rowingclub.org',
role: 'editor',
status: 'pending',
notes: 'Newly added to website'
}
]);

const [editingId, setEditingId] = useState<string | null>(null);
const [editForm, setEditForm] = useState<Partial<AdminUser>>({});
const [searchQuery, setSearchQuery] = useState('');
const [filterStatus, setFilterStatus] = useState<'all' | AdminUser['status']>('all');
const [filterRole, setFilterRole] = useState<'all' | AdminUser['role']>('all');

const handleEdit = (user: AdminUser) => {
setEditingId(user.id);
setEditForm({ ...user });
};

const handleSave = () => {
if (!editingId) return;

setUsers(prev => 
prev.map(user => 
user.id === editingId ? { ...user, ...editForm } as AdminUser : user
)
);
setEditingId(null);
};

const handleCancel = () => {
setEditingId(null);
};

const getStatusColor = (status: AdminUser['status']) => {
switch (status) {
case 'verified': return 'bg-green-100 border-green-500';
case 'pending': return 'bg-yellow-100 border-yellow-500';
case 'needs-review': return 'bg-red-100 border-red-500';
default: return 'bg-gray-100 border-gray-500';
}
};

const getStatusText = (status: AdminUser['status']) => {
switch (status) {
case 'verified': return 'Verified';
case 'pending': return 'Pending Review';
case 'needs-review': return 'Needs Review';
default: return 'Unknown';
}
};

const getRoleColor = (role: AdminUser['role']) => {
switch (role) {
case 'admin': return 'bg-blue-100 text-blue-800';
case 'editor': return 'bg-purple-100 text-purple-800';
case 'viewer': return 'bg-gray-100 text-gray-800';
default: return 'bg-gray-100 text-gray-800';
}
};

const getRoleText = (role: AdminUser['role']) => {
switch (role) {
case 'admin': return 'Administrator';
case 'editor': return 'Editor';
case 'viewer': return 'Viewer';
default: return 'Unknown';
}
};

const filteredUsers = users.filter(user => {
const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
user.email.toLowerCase().includes(searchQuery.toLowerCase());
const matchesStatusFilter = filterStatus === 'all' || user.status === filterStatus;
const matchesRoleFilter = filterRole === 'all' || user.role === filterRole;
return matchesSearch && matchesStatusFilter && matchesRoleFilter;
});

const renderRoleSelector = () => (
<View className="flex-row mb-3">
<TouchableOpacity 
className={`flex-1 items-center py-2 rounded-lg mr-2 ${filterRole === 'all' ? 'bg-blue-100 border border-blue-300' : 'bg-gray-100'}`}
onPress={() => setFilterRole('all')}
>
<Text className={filterRole === 'all' ? 'text-blue-600 font-medium' : 'text-gray-600'}>All</Text>
</TouchableOpacity>
<TouchableOpacity 
className={`flex-1 items-center py-2 rounded-lg mx-1 ${filterRole === 'admin' ? 'bg-blue-100 border border-blue-300' : 'bg-gray-100'}`}
onPress={() => setFilterRole('admin')}
>
<Text className={filterRole === 'admin' ? 'text-blue-600 font-medium' : 'text-gray-600'}>Admin</Text>
</TouchableOpacity>
<TouchableOpacity 
className={`flex-1 items-center py-2 rounded-lg mx-1 ${filterRole === 'editor' ? 'bg-purple-100 border border-purple-300' : 'bg-gray-100'}`}
onPress={() => setFilterRole('editor')}
>
<Text className={filterRole === 'editor' ? 'text-purple-600 font-medium' : 'text-gray-600'}>Editor</Text>
</TouchableOpacity>
<TouchableOpacity 
className={`flex-1 items-center py-2 rounded-lg ml-2 ${filterRole === 'viewer' ? 'bg-gray-100 border border-gray-300' : 'bg-gray-100'}`}
onPress={() => setFilterRole('viewer')}
>
<Text className={filterRole === 'viewer' ? 'text-gray-600 font-medium' : 'text-gray-600'}>Viewer</Text>
</TouchableOpacity>
</View>
);

const renderItem = ({ item }: { item: AdminUser }) => {
if (editingId === item.id) {
return (
<View className="bg-white rounded-xl p-4 mb-4 border border-gray-200 shadow-sm">
<View className="mb-3">
<Text className="text-gray-500 text-sm mb-1">Full Name</Text>
<TextInput
className="border border-gray-300 rounded-lg p-3 bg-gray-50"
value={editForm.name || ''}
onChangeText={(text) => setEditForm({ ...editForm, name: text })}
/>
</View>

<View className="mb-3">
<Text className="text-gray-500 text-sm mb-1">Email Address</Text>
<TextInput
className="border border-gray-300 rounded-lg p-3 bg-gray-50"
value={editForm.email || ''}
onChangeText={(text) => setEditForm({ ...editForm, email: text })}
keyboardType="email-address"
/>
</View>

<View className="mb-3">
<Text className="text-gray-500 text-sm mb-1">Role</Text>
<View className="flex-row">
{(['admin', 'editor', 'viewer'] as AdminUser['role'][]).map((role) => (
<TouchableOpacity
key={role}
className={`flex-1 items-center py-2 mx-1 rounded-lg ${editForm.role === role ? getRoleColor(role).replace('text', 'border') : 'bg-gray-100'}`}
onPress={() => setEditForm({ ...editForm, role })}
>
<Text className={editForm.role === role ? getRoleColor(role).split(' ')[1] : 'text-gray-600'}>
{getRoleText(role)}
</Text>
</TouchableOpacity>
))}
</View>
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
<User size={20} color="#007AFF" />
</View>
<View>
<Text className="text-lg font-bold text-gray-800">{item.name}</Text>
<Text className="text-gray-600">{item.email}</Text>
</View>
</View>
<View className={`px-3 py-1 rounded-full border ${getStatusColor(item.status)}`}>
<Text className="text-xs font-medium">
{getStatusText(item.status)}
</Text>
</View>
</View>

<View className="flex-row justify-between items-center mb-3">
<View className={`px-3 py-1 rounded-full ${getRoleColor(item.role)}`}>
<Text className="text-xs font-medium">
{getRoleText(item.role)}
</Text>
</View>
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
<View className="h-2 bg-white rounded-full w-[57.1%]" />
</View>
<Text className="text-white text-center">Step 4 of 7</Text>
</View>

{/* Content */}
<View className="bg-white pt-4 pb-2 px-4 shadow-sm">
<View className="flex-row justify-between items-center mb-2">
<Text className="text-2xl font-bold text-gray-800">Admin Users Verification</Text>
<Shield size={28} color="#007AFF" />
</View>
<Text className="text-gray-600">
Review and customize admin users extracted from your website
</Text>
</View>

{/* Search and Filter */}
<View className="px-4 py-3 bg-white mb-4">
<View className="flex-row mb-3">
<View className="flex-row items-center flex-1 bg-gray-100 rounded-lg px-3 py-2">
<Search size={20} color="#9CA3AF" />
<TextInput
className="flex-1 ml-2 text-gray-700"
placeholder="Search users..."
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

{renderRoleSelector()}
</View>

{/* Stats Summary */}
<View className="flex-row px-4 pb-4 bg-white">
<View className="flex-1 items-center">
<Text className="text-2xl font-bold text-blue-600">{users.length}</Text>
<Text className="text-gray-600 text-sm">Total Users</Text>
</View>
<View className="flex-1 items-center">
<Text className="text-2xl font-bold text-green-600">
{users.filter(u => u.status === 'verified').length}
</Text>
<Text className="text-gray-600 text-sm">Verified</Text>
</View>
<View className="flex-1 items-center">
<Text className="text-2xl font-bold text-yellow-600">
{users.filter(u => u.status === 'pending').length}
</Text>
<Text className="text-gray-600 text-sm">Pending</Text>
</View>
<View className="flex-1 items-center">
<Text className="text-2xl font-bold text-red-600">
{users.filter(u => u.status === 'needs-review').length}
</Text>
<Text className="text-gray-600 text-sm">Needs Review</Text>
</View>
</View>

{/* Users List */}
<ScrollView className="flex-1 px-4">
<Text className="text-lg font-bold text-gray-800 mb-3">
{filteredUsers.length} User{filteredUsers.length !== 1 ? 's' : ''} Found
</Text>
<FlatList
data={filteredUsers}
renderItem={renderItem}
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