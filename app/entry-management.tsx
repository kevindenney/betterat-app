import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, FlatList } from 'react-native';
import { 
  Search, 
  ChevronDown, 
  Plus, 
  Upload, 
  MoreHorizontal, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Eye, 
  Edit, 
  Mail, 
  User, 
  Phone, 
  MapPin, 
  Calendar,
  CreditCard,
  Users,
  Shield
} from 'lucide-react-native';

const EntryManagementScreen = () => {
  const [filter] = useState('All Regattas');
  const [searchQuery, setSearchQuery] = useState('');
  const [event] = useState('Spring Series R1');
  const [expandedEntries, setExpandedEntries] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  // Mock data for entries
  const entries = [
    {
      id: 1,
      boatClass: 'J/70',
      sailNumber: 'NYYC 1234',
      helmsman: 'James Wilson',
      status: 'confirmed',
      entryDate: 'Mar 1, 2024',
      fee: '$150',
      crew: ['Sarah Johnson', 'Michael Chen'],
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=900&auto=format&fit=crop&q=60'
    },
    {
      id: 2,
      boatClass: 'Laser',
      sailNumber: 'L321098',
      helmsman: 'Emma Rodriguez',
      status: 'pending',
      entryDate: 'Mar 3, 2024',
      fee: '$75',
      crew: ['David Kim'],
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&auto=format&fit=crop&q=60'
    },
    {
      id: 3,
      boatClass: '420',
      sailNumber: '420-8765',
      helmsman: 'Robert Thompson',
      status: 'issue',
      entryDate: 'Mar 5, 2024',
      fee: '$100',
      crew: ['Alex Morgan', 'Taylor Swift'],
      avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=900&auto=format&fit=crop&q=60'
    },
    {
      id: 4,
      boatClass: 'J/105',
      sailNumber: 'J105-4567',
      helmsman: 'Jennifer Lee',
      status: 'confirmed',
      entryDate: 'Mar 7, 2024',
      fee: '$200',
      crew: ['Chris Evans', 'Scarlett Johansson'],
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=900&auto=format&fit=crop&q=60'
    },
    {
      id: 5,
      boatClass: 'Optimist',
      sailNumber: 'OPT-9876',
      helmsman: 'Thomas Anderson',
      status: 'pending',
      entryDate: 'Mar 8, 2024',
      fee: '$50',
      crew: [],
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900&auto=format&fit=crop&q=60'
    },
    {
      id: 6,
      boatClass: 'C420',
      sailNumber: 'C420-1122',
      helmsman: 'Sophie Turner',
      status: 'confirmed',
      entryDate: 'Mar 9, 2024',
      fee: '$125',
      crew: ['John Smith', 'Jane Doe'],
      avatar: 'https://images.unsplash.com/photo-1578445714074-946b536079aa?w=900&auto=format&fit=crop&q=60'
    }
  ];

  const toggleExpand = (id: number) => {
    if (expandedEntries.includes(id)) {
      setExpandedEntries(expandedEntries.filter(item => item !== id));
    } else {
      setExpandedEntries([...expandedEntries, id]);
    }
  };

  const openEntryDetail = (entry: any) => {
    setSelectedEntry(entry);
    setModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'border-green-500 bg-green-50';
      case 'pending': return 'border-orange-500 bg-orange-50';
      case 'issue': return 'border-red-500 bg-red-50';
      default: return 'border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle color="#10B981" size={16} />;
      case 'pending': return <AlertTriangle color="#F97316" size={16} />;
      case 'issue': return <XCircle color="#EF4444" size={16} />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed & Paid';
      case 'pending': return 'Payment Pending';
      case 'issue': return 'Issue/Incomplete';
      default: return '';
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-blue-600 px-4 py-6">
        <Text className="text-white text-2xl font-bold">Entry Management</Text>
      </View>

      {/* Top Controls */}
      <View className="p-4 bg-white border-b border-gray-200">
        <View className="flex-row justify-between mb-4">
          <TouchableOpacity className="flex-row items-center bg-gray-100 px-3 py-2 rounded-lg">
            <Text className="font-medium text-gray-800">{filter}</Text>
            <ChevronDown color="#6B7280" size={16} className="ml-1" />
          </TouchableOpacity>
          
          <View className="flex-row">
            <TouchableOpacity className="bg-blue-600 px-4 py-2 rounded-lg flex-row items-center mr-2">
              <Plus color="white" size={16} />
              <Text className="text-white font-medium ml-1">Add Manual Entry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="bg-gray-100 px-3 py-2 rounded-lg flex-row items-center">
              <Upload color="#6B7280" size={16} />
              <Text className="text-gray-800 font-medium ml-1">Export</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View className="flex-row mb-4">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
            <Search color="#6B7280" size={16} />
            <TextInput
              className="flex-1 ml-2 text-gray-800"
              placeholder="Search entries..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
        
        <View className="flex-row">
          <TouchableOpacity className="flex-row items-center bg-gray-100 px-3 py-2 rounded-lg">
            <Text className="font-medium text-gray-800">{event}</Text>
            <ChevronDown color="#6B7280" size={16} className="ml-1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Regatta Header */}
      <View className="p-4 bg-blue-50 border-b border-gray-200">
        <Text className="text-xl font-bold text-gray-800">Spring Series R1 (March 15)</Text>
        <Text className="text-gray-600 mt-1">15 entries • 2 pending • Entry open</Text>
      </View>

      {/* Entry List */}
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View className={`border rounded-xl p-4 mb-3 mx-4 ${getStatusColor(item.status)}`}>
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-lg font-bold text-gray-800">{item.boatClass}</Text>
                  <Text className="text-lg font-bold text-gray-800 ml-2">• {item.sailNumber}</Text>
                </View>
                
                <View className="flex-row items-center mt-1">
                  <User color="#6B7280" size={14} />
                  <Text className="text-gray-700 ml-1">{item.helmsman}</Text>
                </View>
                
                <View className="flex-row items-center mt-2">
                  {getStatusIcon(item.status)}
                  <Text className="text-gray-700 ml-1">{getStatusText(item.status)}</Text>
                </View>
                
                <View className="flex-row items-center mt-2">
                  <Calendar color="#6B7280" size={14} />
                  <Text className="text-gray-600 text-sm ml-1">{item.entryDate}</Text>
                  <Text className="text-gray-600 text-sm mx-2">•</Text>
                  <CreditCard color="#6B7280" size={14} />
                  <Text className="text-gray-600 text-sm ml-1">{item.fee}</Text>
                </View>
                
                {item.crew.length > 0 && (
                  <View className="flex-row items-center mt-2">
                    <Users color="#6B7280" size={14} />
                    <Text className="text-gray-600 text-sm ml-1">{item.crew.join(', ')}</Text>
                  </View>
                )}
              </View>
              
              <View className="flex-row">
                <TouchableOpacity 
                  onPress={() => openEntryDetail(item)}
                  className="p-2"
                >
                  <Eye color="#007AFF" size={18} />
                </TouchableOpacity>
                <TouchableOpacity className="p-2">
                  <Edit color="#007AFF" size={18} />
                </TouchableOpacity>
                <TouchableOpacity className="p-2">
                  <Mail color="#007AFF" size={18} />
                </TouchableOpacity>
                <TouchableOpacity className="p-2">
                  <MoreHorizontal color="#6B7280" size={18} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={() => (
          <View className="p-4">
            <TouchableOpacity 
              className="flex-row items-center justify-center py-3"
              onPress={() => toggleExpand(0)}
            >
              <Text className="text-blue-600 font-medium">
                {expandedEntries.includes(0) ? "Show less entries" : `+ ${entries.length - 5} more entries`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Bottom Actions */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row justify-between">
          <TouchableOpacity className="bg-blue-600 px-4 py-3 rounded-lg flex-row items-center">
            <Plus color="white" size={16} />
            <Text className="text-white font-medium ml-1">Add Manual Entry</Text>
          </TouchableOpacity>
          
          <View className="flex-row">
            <TouchableOpacity className="bg-gray-100 px-4 py-3 rounded-lg flex-row items-center mr-2">
              <Upload color="#6B7280" size={16} />
              <Text className="text-gray-800 font-medium ml-1">Export</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="bg-green-600 px-4 py-3 rounded-lg flex-row items-center mr-2">
              <Mail color="white" size={16} />
              <Text className="text-white font-medium ml-1">Send Confirmations</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="bg-red-600 px-4 py-3 rounded-lg flex-row items-center">
              <XCircle color="white" size={16} />
              <Text className="text-white font-medium ml-1">Close Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Entry Detail Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-white">
          {/* Modal Header */}
          <View className="bg-blue-600 px-4 py-6">
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-xl font-bold">Entry Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <XCircle color="white" size={24} />
              </TouchableOpacity>
            </View>
          </View>

          {selectedEntry && (
            <ScrollView className="flex-1 p-4">
              {/* Sailor Information */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-800 mb-3">Sailor Information</Text>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="flex-row items-center mb-4">
                    <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
                      <User color="#007AFF" size={24} />
                    </View>
                    <View>
                      <Text className="font-bold text-gray-800 text-lg">{selectedEntry.helmsman}</Text>
                      <Text className="text-gray-600">Member #12345</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row items-center mb-2">
                    <Mail color="#6B7280" size={16} />
                    <Text className="text-gray-700 ml-2">james.wilson@email.com</Text>
                  </View>
                  
                  <View className="flex-row items-center mb-2">
                    <Phone color="#6B7280" size={16} />
                    <Text className="text-gray-700 ml-2">+1 (555) 123-4567</Text>
                  </View>
                  
                  <View className="flex-row items-center">
                    <MapPin color="#6B7280" size={16} />
                    <Text className="text-gray-700 ml-2">New York Yacht Club</Text>
                  </View>
                </View>
              </View>

              {/* Boat Information */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-800 mb-3">Boat Information</Text>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="flex-row justify-between mb-3">
                    <View>
                      <Text className="font-bold text-gray-800">{selectedEntry.boatClass}</Text>
                      <Text className="text-gray-600">{selectedEntry.sailNumber}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-bold text-gray-800">Boat Name</Text>
                      <Text className="text-gray-600">Sea Breeze</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="text-gray-600">Builder</Text>
                      <Text className="text-gray-800">J/Boats</Text>
                    </View>
                    <View>
                      <Text className="text-gray-600">Country</Text>
                      <Text className="text-gray-800">USA</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Crew List */}
              {selectedEntry.crew.length > 0 && (
                <View className="mb-6">
                  <Text className="text-lg font-bold text-gray-800 mb-3">Crew</Text>
                  <View className="bg-gray-50 rounded-xl p-4">
                    {selectedEntry.crew.map((crewMember: string, index: number) => (
                      <View key={index} className="flex-row items-center mb-2">
                        <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3">
                          <User color="#007AFF" size={16} />
                        </View>
                        <Text className="text-gray-800">{crewMember}</Text>
                        <Text className="text-gray-500 ml-auto">Crew</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Entry Details */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-800 mb-3">Entry Details</Text>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="flex-row justify-between mb-3">
                    <View>
                      <Text className="text-gray-600">Entry Date</Text>
                      <Text className="text-gray-800">{selectedEntry.entryDate}</Text>
                    </View>
                    <View>
                      <Text className="text-gray-600">Fee</Text>
                      <Text className="text-gray-800">{selectedEntry.fee}</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row justify-between mb-3">
                    <View>
                      <Text className="text-gray-600">Payment Status</Text>
                      <View className="flex-row items-center">
                        {getStatusIcon(selectedEntry.status)}
                        <Text className="text-gray-800 ml-1">{getStatusText(selectedEntry.status)}</Text>
                      </View>
                    </View>
                    <View>
                      <Text className="text-gray-600">Payment Method</Text>
                      <Text className="text-gray-800">Credit Card</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="text-gray-600">Emergency Contact</Text>
                      <Text className="text-gray-800">+1 (555) 987-6543</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Special Requirements */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-800 mb-3">Special Requirements</Text>
                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="text-gray-700">Dietary restrictions: None</Text>
                  <Text className="text-gray-700 mt-1">Accessibility needs: Wheelchair access required</Text>
                </View>
              </View>

              {/* Insurance */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-800 mb-3">Insurance</Text>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="flex-row items-center">
                    <Shield color="#10B981" size={16} />
                    <Text className="text-green-600 font-medium ml-2">Verified</Text>
                  </View>
                  <Text className="text-gray-700 mt-1">Valid until: Dec 31, 2024</Text>
                </View>
              </View>

              {/* Race History */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-800 mb-3">Race History</Text>
                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="text-gray-700">Participated in 12 races at this club</Text>
                  <Text className="text-gray-700 mt-1">Last race: March 10, 2024 - J/70 Fleet</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row justify-between mb-6">
                <TouchableOpacity className="bg-blue-600 px-4 py-3 rounded-lg flex-row items-center flex-1 mr-2">
                  <Edit color="white" size={16} />
                  <Text className="text-white font-medium ml-1">Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity className="bg-gray-100 px-4 py-3 rounded-lg flex-row items-center flex-1 mx-2">
                  <Mail color="#6B7280" size={16} />
                  <Text className="text-gray-800 font-medium ml-1">Send Email</Text>
                </TouchableOpacity>
                
                <TouchableOpacity className="bg-red-100 px-4 py-3 rounded-lg flex-row items-center flex-1 ml-2">
                  <XCircle color="#EF4444" size={16} />
                  <Text className="text-red-600 font-medium ml-1">Remove</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

export default EntryManagementScreen;