import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Image } from '@/components/ui';
import { ChevronLeft, Globe, Shield, Download, Zap, Check, Search, Copy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { ClubVerificationService, ClubExtractedData } from '@/services/ClubVerificationService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

const ClubOnboardingWebsiteVerification = () => {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ClubExtractedData | null>(null);
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [showVerificationInstructions, setShowVerificationInstructions] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const handleGenerateToken = async () => {
    if (!userId) {
      showAlert('Error', 'User not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      const token = await ClubVerificationService.generateVerificationToken(userId);
      setVerificationToken(token);
      setShowVerificationInstructions(true);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to generate verification token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyWebsite = async () => {
    if (!websiteUrl.trim()) {
      showAlert('Validation Error', 'Please enter a website URL');
      return;
    }

    if (!websiteUrl.includes('.') || !websiteUrl.startsWith('http')) {
      showAlert('Validation Error', 'Please enter a valid website URL (e.g., https://www.yourclub.com)');
      return;
    }

    if (!userId) {
      showAlert('Error', 'User not authenticated');
      return;
    }

    setIsLoading(true);

    try {
      // Verify website using meta tag
      const result = await ClubVerificationService.verifyMetaTag(websiteUrl, userId);

      if (result.success) {
        setIsVerified(true);

        // Extract club data
        const data = await ClubVerificationService.extractClubData(websiteUrl);
        setExtractedData(data);

        // Check if URL matches a known yacht club
        const yachtClubId = await ClubVerificationService.findMatchingYachtClub(websiteUrl);

        // Update club profile with website URL and extracted data
        const { error: profileError } = await supabase.from('club_profiles').upsert({
          user_id: userId,
          website_url: websiteUrl,
          club_name: data?.clubName || 'Unknown Club',
          established_year: data?.established,
          extracted_data: data || {},
          yacht_club_id: yachtClubId,
        }, {
          onConflict: 'user_id',
        });
        if (profileError) throw profileError;

        showAlert(
          'Website Verified',
          'We successfully verified and extracted information from your website. Please review the details.'
        );
      } else {
        showAlert('Verification Failed', result.error || 'Unable to verify website');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to verify website');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (_text: string) => {
    // In React Native, we'd use @react-native-clipboard/clipboard
    // For now, just show an alert
    showAlert('Copied', 'Verification code copied to clipboard');
  };

  const handleContinue = () => {
    if (!isVerified) {
      showAlert('Verification Required', 'Please verify your website first');
      return;
    }

    if (!consentGiven) {
      showAlert('Consent Required', 'Please grant permission to extract racing data');
      return;
    }

    // Free club claim — paid upgrades happen later via org billing (Stripe Checkout)
    router.push('/club-dashboard');
  };

  return (
    <View testID="onboarding-club" className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity className="p-2 -ml-2" onPress={() => router.back()}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold flex-1 text-center">Club Setup</Text>
          <View className="w-8" /> {/* Spacer for alignment */}
        </View>
        
        <View className="h-2 bg-blue-500 rounded-full mb-4">
          <View className="h-2 bg-white rounded-full w-[14.3%]" />
        </View>
        <Text className="text-white text-center">Step 1 of 7</Text>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
            <Globe size={32} color="#007AFF" />
          </View>
          <Text className="text-gray-800 text-2xl font-bold text-center mb-2">Club Website Verification</Text>
          <Text className="text-gray-600 text-center">Verify your club's website to automatically import racing management data</Text>
        </View>

        {/* Website Verification Card */}
        <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <Text className="text-gray-800 font-bold text-lg mb-3">Website Verification</Text>

          <View className="mb-4">
            <Text className="text-gray-700 mb-2">Club Website URL</Text>
            <View className="flex-row">
              <TextInput
                className="flex-1 border border-gray-300 rounded-l-xl p-4 bg-gray-50"
                placeholder="https://www.yourclub.com"
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                keyboardType="url"
                editable={!isVerified}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                className={`bg-blue-600 py-4 px-6 rounded-r-xl items-center justify-center ${isVerified ? 'bg-green-600' : ''}`}
                onPress={handleVerifyWebsite}
                disabled={isLoading || !websiteUrl}
              >
                {isLoading ? (
                  <Text className="text-white font-bold">...</Text>
                ) : isVerified ? (
                  <Check size={20} color="#FFFFFF" />
                ) : (
                  <Search size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {!isVerified && !showVerificationInstructions && (
            <>
              <View className="bg-blue-50 p-4 rounded-xl mb-3">
                <Text className="text-blue-800 font-medium">Why verify your website?</Text>
                <Text className="text-blue-700 text-sm mt-1">
                  We can automatically extract your club's racing calendar, fleet information,
                  and membership details to streamline your setup process.
                </Text>
              </View>

              <TouchableOpacity
                className="bg-gray-100 p-3 rounded-xl items-center"
                onPress={handleGenerateToken}
                disabled={isLoading}
              >
                <Text className="text-gray-800 font-medium">
                  Show Verification Instructions
                </Text>
              </TouchableOpacity>
            </>
          )}

          {showVerificationInstructions && !isVerified && verificationToken && (
            <View className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <Text className="text-amber-800 font-medium mb-2">Verification Instructions</Text>
              <Text className="text-amber-700 text-sm mb-3">
                Add this meta tag to your website's HTML {'<head>'} section:
              </Text>

              <View className="bg-white p-3 rounded-lg border border-amber-300 mb-2">
                <Text className="text-xs font-mono text-gray-800" selectable>
                  {'<meta name="regattaflow-verification" content="' + verificationToken + '">'}
                </Text>
              </View>

              <TouchableOpacity
                className="flex-row items-center justify-center bg-amber-100 p-2 rounded-lg"
                onPress={() => copyToClipboard(verificationToken)}
              >
                <Copy size={16} color="#B45309" />
                <Text className="text-amber-800 ml-2 font-medium">Copy Token</Text>
              </TouchableOpacity>

              <Text className="text-amber-600 text-xs mt-3">
                After adding the meta tag, click the verify button above.
              </Text>
            </View>
          )}

          {isVerified && (
            <View className="bg-green-50 p-4 rounded-xl border border-green-200">
              <Text className="text-green-800 font-medium">Website Verified Successfully!</Text>
              <Text className="text-green-700 text-sm mt-1">
                We've extracted data from your website. Please review the information below.
              </Text>
            </View>
          )}
        </View>

        {/* Extracted Data Preview */}
        {isVerified && extractedData && (
          <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
            <Text className="text-gray-800 font-bold text-lg mb-4">Extracted Information</Text>

            {extractedData.clubName && (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-1">Club Name</Text>
                <Text className="text-gray-800">{extractedData.clubName}</Text>
              </View>
            )}

            {extractedData.established && (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-1">Established</Text>
                <Text className="text-gray-800">{extractedData.established}</Text>
              </View>
            )}

            {extractedData.fleets && extractedData.fleets.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-1">Fleets</Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {extractedData.fleets.map((fleet, index) => (
                    <View key={index} className="bg-blue-100 px-3 py-1 rounded-full">
                      <Text className="text-blue-800 text-sm">{fleet.name} ({fleet.boats} boats)</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {extractedData.races && extractedData.races.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-1">Race Series</Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {extractedData.races.map((race, index) => (
                    <View key={index} className="bg-green-100 px-3 py-1 rounded-full">
                      <Text className="text-green-800 text-sm">{race.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {extractedData.regattas && extractedData.regattas.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-1">Major Regattas</Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {extractedData.regattas.map((regatta, index) => (
                    <View key={index} className="bg-amber-100 px-3 py-1 rounded-full">
                      <Text className="text-amber-800 text-sm">{regatta}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {extractedData.adminUsers && extractedData.adminUsers.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-1">Admin Users Found</Text>
                {extractedData.adminUsers.map((email, index) => (
                  <View key={index} className="flex-row items-center mt-2">
                    <View className="w-6 h-6 rounded-full bg-gray-200 items-center justify-center mr-2">
                      <Text className="text-gray-600 text-xs">{index + 1}</Text>
                    </View>
                    <Text className="text-gray-800">{email}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Data Extraction Permissions */}
        {isVerified && (
          <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
            <Text className="text-gray-800 font-bold text-lg mb-3">Racing Data Extraction</Text>
            
            <View className="flex-row items-start mb-4">
              <Shield size={20} color="#007AFF" className="mt-1 mr-3" />
              <Text className="text-gray-700 flex-1">
                <Text className="font-bold">Secure Data Access:</Text> We only extract publicly available 
                racing management information from your website.
              </Text>
            </View>
            
            <View className="flex-row items-start mb-4">
              <Download size={20} color="#007AFF" className="mt-1 mr-3" />
              <Text className="text-gray-700 flex-1">
                <Text className="font-bold">What We Extract:</Text> Race calendars, fleet details, 
                event information, and sailing instructions.
              </Text>
            </View>
            
            <View className="flex-row items-start mb-4">
              <Zap size={20} color="#007AFF" className="mt-1 mr-3" />
              <Text className="text-gray-700 flex-1">
                <Text className="font-bold">How It Helps:</Text> Automatically populate your racing 
                management system with existing data.
              </Text>
            </View>
            
            <View className="flex-row items-center mt-4">
              <TouchableOpacity 
                className="flex-row items-center"
                onPress={() => setConsentGiven(!consentGiven)}
              >
                <View className={`w-6 h-6 rounded-lg border items-center justify-center mr-3 ${consentGiven ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {consentGiven && <Check size={16} color="white" />}
                </View>
                <Text className="text-gray-800">
                  I grant permission to extract racing data from my website
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Website Preview */}
        {isVerified && (
          <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
            <View className="bg-gray-800 p-3">
              <View className="flex-row items-center">
                <View className="flex-row">
                  <View className="w-3 h-3 rounded-full bg-red-500 mr-2"></View>
                  <View className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></View>
                  <View className="w-3 h-3 rounded-full bg-green-500 mr-2"></View>
                </View>
                <Text className="text-gray-300 text-sm ml-4 flex-1">www.rhkyc.org.hk</Text>
              </View>
            </View>
            
            <Image 
              source={{ uri: "https://images.unsplash.com/photo-1627923316244-f4da80d8f281?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fEJvYXQlMjBzaGlwJTIwc2FpbGluZyUyMHdhdGVyJTIwbWFyaW5lfGVufDB8fDB8fHww" }} 
              className="h-40 w-full"
              resizeMode="cover"
            />
            
            <View className="p-4">
              <Text className="text-gray-800 font-bold text-lg">{extractedData?.clubName}</Text>
              <Text className="text-gray-600 mt-1">Established {extractedData?.established} • 2,400 Members</Text>
              
              <View className="flex-row mt-3">
                <View className="bg-blue-100 px-3 py-1 rounded-full mr-2">
                  <Text className="text-blue-700 text-sm">Race Calendar</Text>
                </View>
                <View className="bg-green-100 px-3 py-1 rounded-full mr-2">
                  <Text className="text-green-700 text-sm">12 Fleets</Text>
                </View>
                <View className="bg-amber-100 px-3 py-1 rounded-full">
                  <Text className="text-amber-700 text-sm">Events</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View className="px-4 pb-6">
        <TouchableOpacity
          testID="next-club"
          className={`py-4 rounded-2xl items-center mb-4 ${isVerified && consentGiven ? 'bg-blue-600' : 'bg-gray-300'}`}
          onPress={handleContinue}
          disabled={!isVerified || !consentGiven}
        >
          <Text className={`font-bold text-lg ${isVerified && consentGiven ? 'text-white' : 'text-gray-500'}`}>
            Finish Club Setup
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="py-3 items-center"
          onPress={() => router.push('/club-dashboard')}
        >
          <Text className="text-blue-600 font-bold">Complete later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ClubOnboardingWebsiteVerification;
