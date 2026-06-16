import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Image } from '@/components/ui';
import { createLogger } from '@/lib/utils/logger';
import {
  MapPin,
  Calendar,
  Users,
  Hash,
  Image as ImageIcon,
  X,
  Smile,
  Navigation,
  Trophy,
  MessageCircle,
  Heart,
  Share2,
  MoreHorizontal,
} from 'lucide-react-native';

const logger = createLogger('post-update');
const { width } = Dimensions.get('window');

const PostUpdateScreen = () => {
  const [postText, setPostText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [location, setLocation] = useState('Royal Hong Kong Yacht Club');
  const [raceEvent, setRaceEvent] = useState('RHKYC Spring Series R1');

  // Mock data for recent posts
  const recentPosts = [
    {
      id: 1,
      user: 'Sarah Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dXNlcnxlbnwwfHwwfHx8MA%3D%3D',
      time: '2h ago',
      content: 'Just finished tuning our Dragon for the upcoming series! The new jib setup is working really well in these conditions. #DragonClass #Tuning',
      images: [
        'https://images.unsplash.com/photo-1627923316244-f4da80d8f281?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fEJvYXQlMjBzaGlwJTIwc2FpbGluZyUyMHdhdGVyJTIwbWFyaW5lfGVufDB8fDB8fHww',
      ],
      likes: 24,
      comments: 5,
      location: 'Victoria Harbour',
      event: 'Dragon Winter Series',
    },
    {
      id: 2,
      user: 'Michael Torres',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTF8fHVzZXJ8ZW58MHx8MHx8fDA%3D',
      time: '4h ago',
      content: 'What an incredible race today! Started poorly but managed to claw back to 3rd place in the last two legs. Conditions were challenging with 15kt winds and choppy seas.',
      images: [
        'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8b2NlYW58ZW58MHx8MHx8fDA%3D',
      ],
      likes: 42,
      comments: 8,
      location: 'RHKYC Marina',
      event: 'RHKYC Spring Series R1',
    },
  ];

  const handleAddImage = (imageUri: string) => {
    if (selectedImages.length < 4) {
      setSelectedImages([...selectedImages, imageUri]);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...selectedImages];
    newImages.splice(index, 1);
    setSelectedImages(newImages);
  };

  const handlePost = () => {
    // In a real app, this would send the post to a backend
    logger.debug('Posting:', { postText, selectedImages, location, raceEvent });
    setPostText('');
    setSelectedImages([]);
    // Reset to default values
    setLocation('Royal Hong Kong Yacht Club');
    setRaceEvent('RHKYC Spring Series R1');
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-4 px-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-bold">Post Update</Text>
          <TouchableOpacity onPress={handlePost} className="bg-white px-4 py-2 rounded-full">
            <Text className="text-blue-600 font-bold">Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Post Section */}
      <View className="bg-white m-4 rounded-xl shadow-sm">
        <View className="p-4 border-b border-gray-100">
          <View className="flex-row items-center mb-3">
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzJ8fHVzZXJ8ZW58MHx8MHx8fDA%3D' }}
              className="w-10 h-10 rounded-full"
            />
            <View className="ml-3">
              <Text className="font-bold text-gray-800">Bram Johnson</Text>
              <Text className="text-gray-500 text-sm">Post to Fleet & Friends</Text>
            </View>
          </View>

          <TextInput
            value={postText}
            onChangeText={setPostText}
            placeholder="Share your sailing experience, thoughts, or updates..."
            multiline
            className="text-gray-800 text-base mb-3 h-24"
          />

          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <View className="flex-row flex-wrap mb-3">
              {selectedImages.map((image, index) => (
                <View key={index} className="relative w-1/2 h-40 mb-2 pr-2">
                  <Image
                    source={{ uri: image }}
                    className="w-full h-full rounded-lg"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => handleRemoveImage(index)}
                    className="absolute top-2 right-2 bg-gray-800 bg-opacity-50 rounded-full p-1"
                  >
                    <X color="white" size={16} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Post Options */}
          <View className="flex-row justify-between items-center py-2">
            <TouchableOpacity
              onPress={() => handleAddImage('https://images.unsplash.com/photo-1627923316244-f4da80d8f281?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fEJvYXQlMjBzaGlwJTIwc2FpbGluZyUyMHdhdGVyJTIwbWFyaW5lfGVufDB8fDB8fHww')}
              className="flex-row items-center"
            >
              <ImageIcon color="#007AFF" size={20} />
              <Text className="text-blue-600 ml-2">Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center">
              <MapPin color="#6B7280" size={20} />
              <Text className="text-gray-600 ml-2">{location}</Text>
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center">
              <Trophy color="#F59E0B" size={20} />
              <Text className="text-gray-600 ml-2">{raceEvent}</Text>
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center">
              <Smile color="#6B7280" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Add to Post Options */}
        <View className="p-4">
          <Text className="font-bold text-gray-800 mb-2">Add to your post</Text>
          <View className="flex-row flex-wrap">
            <TouchableOpacity className="flex-row items-center bg-blue-50 px-3 py-2 rounded-full mr-2 mb-2">
              <Hash color="#007AFF" size={16} />
              <Text className="text-blue-600 ml-1 text-sm">Hashtag</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center bg-blue-50 px-3 py-2 rounded-full mr-2 mb-2">
              <Users color="#007AFF" size={16} />
              <Text className="text-blue-600 ml-1 text-sm">Tag Crew</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center bg-blue-50 px-3 py-2 rounded-full mr-2 mb-2">
              <Calendar color="#007AFF" size={16} />
              <Text className="text-blue-600 ml-1 text-sm">Event</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center bg-blue-50 px-3 py-2 rounded-full mr-2 mb-2">
              <Navigation color="#007AFF" size={16} />
              <Text className="text-blue-600 ml-1 text-sm">Venue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Recent Posts */}
      <View className="flex-1 px-4">
        <Text className="font-bold text-gray-800 text-lg mb-3">Recent Fleet Activity</Text>
        <ScrollView>
          {recentPosts.map((post) => (
            <View key={post.id} className="bg-white rounded-xl shadow-sm mb-4">
              <View className="p-4">
                <View className="flex-row items-center mb-3">
                  <Image
                    source={{ uri: post.avatar }}
                    className="w-10 h-10 rounded-full"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="font-bold text-gray-800">{post.user}</Text>
                    <View className="flex-row items-center">
                      <Text className="text-gray-500 text-sm">{post.time}</Text>
                      <Text className="text-gray-300 mx-2">•</Text>
                      <MapPin color="#9CA3AF" size={12} />
                      <Text className="text-gray-500 text-sm ml-1">{post.location}</Text>
                    </View>
                  </View>
                  <TouchableOpacity>
                    <MoreHorizontal color="#9CA3AF" size={20} />
                  </TouchableOpacity>
                </View>

                <Text className="text-gray-800 mb-3">{post.content}</Text>

                {post.images && post.images.length > 0 && (
                  <View className="mb-3">
                    <Image
                      source={{ uri: post.images[0] }}
                      style={{ width: width - 72, height: 200 }}
                      className="rounded-lg"
                      resizeMode="cover"
                    />
                  </View>
                )}

                <View className="flex-row items-center mb-3">
                  <View className="flex-row items-center mr-4">
                    <Heart color="#9CA3AF" size={16} />
                    <Text className="text-gray-500 ml-1">{post.likes}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <MessageCircle color="#9CA3AF" size={16} />
                    <Text className="text-gray-500 ml-1">{post.comments} comments</Text>
                  </View>
                </View>

                <View className="flex-row border-t border-gray-100 pt-3">
                  <TouchableOpacity className="flex-row items-center flex-1 justify-center">
                    <Heart color="#9CA3AF" size={20} />
                    <Text className="text-gray-600 ml-2">Like</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-row items-center flex-1 justify-center">
                    <MessageCircle color="#9CA3AF" size={20} />
                    <Text className="text-gray-600 ml-2">Comment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-row items-center flex-1 justify-center">
                    <Share2 color="#9CA3AF" size={20} />
                    <Text className="text-gray-600 ml-2">Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

export default PostUpdateScreen;