import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { Upload, File, Plus, Camera, FileText, Award, Calendar } from 'lucide-react-native';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('upload-documents');
const UploadDocumentsScreen = () => {
  const [documents] = useState([
    {
      id: '1',
      name: 'Sailing Certification',
      type: 'certification',
      date: '2023-05-15',
      status: 'verified',
    },
    {
      id: '2',
      name: 'Boat Registration',
      type: 'registration',
      date: '2023-06-22',
      status: 'pending',
    },
    {
      id: '3',
      name: 'Race Entry Form',
      type: 'race-entry',
      date: '2023-07-10',
      status: 'submitted',
    },
  ]);

  const [recentUploads] = useState([
    {
      id: '1',
      name: 'Safety Certificate',
      type: 'certification',
      date: '2023-07-18',
    },
    {
      id: '2',
      name: 'Insurance Document',
      type: 'insurance',
      date: '2023-07-15',
    },
  ]);

  const handleUpload = () => {
    showAlertWithButtons(
      'Upload Document',
      'Select document source',
      [
        {
          text: 'Camera',
          onPress: () => logger.debug('Camera pressed'),
        },
        {
          text: 'Photo Library',
          onPress: () => logger.debug('Photo Library pressed'),
        },
        {
          text: 'Files',
          onPress: () => logger.debug('Files pressed'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'certification':
        return <Award size={24} color="#007AFF" />;
      case 'race-entry':
        return <Calendar size={24} color="#007AFF" />;
      case 'registration':
        return <FileText size={24} color="#007AFF" />;
      default:
        return <File size={24} color="#007AFF" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <Text className="text-white text-2xl font-bold">Document Upload</Text>
        <Text className="text-blue-100 mt-1">Manage your sailing documents and certifications</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Upload Section */}
        <View className="bg-blue-50 rounded-xl p-6 mb-6">
          <View className="items-center mb-4">
            <View className="bg-blue-100 rounded-full p-4 mb-3">
              <Upload size={32} color="#007AFF" />
            </View>
            <Text className="text-lg font-semibold text-gray-800">Upload Documents</Text>
            <Text className="text-gray-600 text-center mt-1">
              Add certifications, race entries, and other sailing documents
            </Text>
          </View>

          <TouchableOpacity
            className="bg-blue-600 py-3 rounded-lg items-center"
            onPress={handleUpload}
          >
            <Text className="text-white font-medium">Select Document</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-4">
            <TouchableOpacity className="flex-row items-center mr-6">
              <Camera size={20} color="#007AFF" className="mr-1" />
              <Text className="text-blue-600">Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center">
              <File size={20} color="#007AFF" className="mr-1" />
              <Text className="text-blue-600">Files</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Document Categories */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Document Types</Text>
          <View className="flex-row flex-wrap gap-3">
            <TouchableOpacity className="flex-row items-center bg-white border border-gray-200 rounded-lg px-4 py-3 flex-1 min-w-[45%]">
              <Award size={20} color="#007AFF" className="mr-2" />
              <Text className="text-gray-700">Certifications</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center bg-white border border-gray-200 rounded-lg px-4 py-3 flex-1 min-w-[45%]">
              <FileText size={20} color="#007AFF" className="mr-2" />
              <Text className="text-gray-700">Race Entries</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center bg-white border border-gray-200 rounded-lg px-4 py-3 flex-1 min-w-[45%]">
              <Calendar size={20} color="#007AFF" className="mr-2" />
              <Text className="text-gray-700">Insurance</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center bg-white border border-gray-200 rounded-lg px-4 py-3 flex-1 min-w-[45%]">
              <File size={20} color="#007AFF" className="mr-2" />
              <Text className="text-gray-700">Other</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Uploads */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-gray-800">Recent Uploads</Text>
            <TouchableOpacity>
              <Text className="text-blue-600">View All</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-white rounded-xl border border-gray-200">
            {recentUploads.map((doc) => (
              <View key={doc.id} className="flex-row items-center p-4 border-b border-gray-100 last:border-b-0">
                <View className="bg-blue-100 rounded-lg p-2 mr-3">
                  <File size={20} color="#007AFF" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-gray-800">{doc.name}</Text>
                  <Text className="text-gray-500 text-sm">{doc.date}</Text>
                </View>
                <TouchableOpacity className="bg-blue-50 px-3 py-1 rounded-full">
                  <Text className="text-blue-600 text-sm">View</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Document List */}
        <View>
          <Text className="text-lg font-semibold text-gray-800 mb-3">Your Documents</Text>
          {documents.map((doc) => (
            <View key={doc.id} className="bg-white rounded-xl border border-gray-200 mb-3">
              <View className="flex-row items-center p-4">
                <View className="bg-blue-100 rounded-lg p-2 mr-3">
                  {getDocumentIcon(doc.type)}
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-gray-800">{doc.name}</Text>
                  <Text className="text-gray-500 text-sm">{doc.date}</Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${getStatusColor(doc.status)}`}>
                  <Text className="text-xs font-medium">{doc.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-blue-600 rounded-full p-4 shadow-lg"
        onPress={handleUpload}
      >
        <Plus size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default UploadDocumentsScreen;