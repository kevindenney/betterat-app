import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Anchor } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

interface ProfileData {
  user: any;
  homeVenue: any;
  primaryBoat: any;
  boatClass: any;
  memberSince: string;
  phone: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfileData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      // Fetch user profile data
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();

      // Fetch primary location
      const { data: location } = await supabase
        .from('sailor_locations')
        .select('*, sailing_venues(*)')
        .eq('sailor_id', user?.id)
        .eq('is_primary', true)
        .maybeSingle();

      // Fetch primary boat
      const { data: boat, error: boatError } = await supabase
        .from('sailor_boats')
        .select('*')
        .eq('sailor_id', user?.id)
        .eq('is_primary', true)
        .eq('status', 'active')
        .maybeSingle();

      if (boatError) {
        console.error('Error loading primary boat:', boatError);
      }

      // Load related boat class & club details if needed
      const [boatClassResult, yachtClubResult] = await Promise.all([
        boat?.class_id
          ? supabase
              .from('boat_classes')
              .select('id,name')
              .eq('id', boat.class_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        boat?.home_club_id
          ? supabase
              .from('yacht_clubs')
              .select('id,name')
              .eq('id', boat.home_club_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (boatClassResult && 'error' in boatClassResult && boatClassResult.error) {
        console.error('Error loading boat class:', boatClassResult.error);
      }
      if (yachtClubResult && 'error' in yachtClubResult && yachtClubResult.error) {
        console.error('Error loading yacht club:', yachtClubResult.error);
      }

      const normalizedBoat = boat
        ? {
            ...boat,
            boat_classes: boatClassResult?.data ? { name: boatClassResult.data.name } : null,
            yacht_clubs: yachtClubResult?.data ? { name: yachtClubResult.data.name } : null,
          }
        : null;

      // Format member since date
      const memberSince = userData?.created_at
        ? new Date(userData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Recently joined';

      setProfileData({
        user: userData,
        homeVenue: location?.sailing_venues,
        primaryBoat: normalizedBoat,
        boatClass: normalizedBoat?.boat_classes,
        memberSince,
        phone: userData?.phone || null,
      });
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} className="mr-4">
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">Profile</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Avatar Section */}
        <View className="bg-white rounded-xl p-6 mb-4 items-center">
          <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-4">
            <User size={48} color="#007AFF" />
          </View>
          <Text className="text-lg font-bold text-gray-800 mb-2">
            {profileData?.user?.full_name || 'Sailor'}
          </Text>
          <TouchableOpacity className="py-2 px-4 bg-blue-600 rounded-lg">
            <Text className="text-white font-medium">Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-800 mb-4">Personal Information</Text>

          <View className="mb-4">
            <Text className="text-sm text-gray-500 mb-1">Email</Text>
            <View className="flex-row items-center">
              <Mail size={16} color="#6B7280" />
              <Text className="text-gray-800 ml-2">{user?.email || 'No email'}</Text>
            </View>
          </View>

          {profileData?.phone && (
            <View className="mb-4">
              <Text className="text-sm text-gray-500 mb-1">Phone</Text>
              <View className="flex-row items-center">
                <Phone size={16} color="#6B7280" />
                <Text className="text-gray-800 ml-2">{profileData.phone}</Text>
              </View>
            </View>
          )}

          {profileData?.homeVenue && (
            <View className="mb-4">
              <Text className="text-sm text-gray-500 mb-1">Home Venue</Text>
              <View className="flex-row items-center">
                <MapPin size={16} color="#6B7280" />
                <Text className="text-gray-800 ml-2">{profileData.homeVenue.name}</Text>
              </View>
            </View>
          )}

          <View>
            <Text className="text-sm text-gray-500 mb-1">Member Since</Text>
            <View className="flex-row items-center">
              <Calendar size={16} color="#6B7280" />
              <Text className="text-gray-800 ml-2">{profileData?.memberSince}</Text>
            </View>
          </View>
        </View>

        {/* Sailing Experience */}
        {(profileData?.primaryBoat || profileData?.boatClass) && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold text-gray-800 mb-4">Sailing Experience</Text>

            {profileData?.boatClass && (
              <View className="mb-3">
                <Text className="text-sm text-gray-500 mb-1">Primary Class</Text>
                <Text className="text-gray-800">{profileData.boatClass.name}</Text>
              </View>
            )}

            {profileData?.primaryBoat?.sail_number && (
              <View className="mb-3">
                <Text className="text-sm text-gray-500 mb-1">Sail Number</Text>
                <View className="flex-row items-center">
                  <Anchor size={16} color="#6B7280" />
                  <Text className="text-gray-800 ml-2">{profileData.primaryBoat.sail_number}</Text>
                </View>
              </View>
            )}

            {profileData?.primaryBoat?.yacht_clubs?.name && (
              <View className="mb-3">
                <Text className="text-sm text-gray-500 mb-1">Home Club</Text>
                <Text className="text-gray-800">{profileData.primaryBoat.yacht_clubs.name}</Text>
              </View>
            )}

            {profileData?.primaryBoat?.name && (
              <View>
                <Text className="text-sm text-gray-500 mb-1">Boat Name</Text>
                <Text className="text-gray-800">{profileData.primaryBoat.name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Subscription Info */}
        <View className="bg-white rounded-xl p-4">
          <Text className="text-lg font-bold text-gray-800 mb-4">Subscription</Text>
          <View className="mb-3">
            <Text className="text-sm text-gray-500 mb-1">Plan</Text>
            <Text className="text-gray-800">
              {profileData?.user?.subscription_tier || 'Free'}
            </Text>
          </View>
          {profileData?.user?.subscription_status && (
            <View>
              <Text className="text-sm text-gray-500 mb-1">Status</Text>
              <Text className="text-gray-800 capitalize">
                {profileData.user.subscription_status}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
