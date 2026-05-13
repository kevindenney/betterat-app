/**
 * Onboarding Pricing Screen
 *
 * Updated: 2026-03-30
 * Pricing: Plus $9/mo ($89/yr) / Pro $29/mo ($249/yr)
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Zap } from 'lucide-react-native';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PricingScreen() {
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState<'plus' | 'pro' | null>('plus');
    const [loading, setLoading] = useState(false);

    const handleContinue = async () => {
        if (!selectedPlan) return;

        setLoading(true);
        // Store the selected plan and proceed to registration
        // After registration, user will be taken to profile-setup
        setTimeout(() => {
            setLoading(false);
            router.push({
                pathname: '/(auth)/signup',
                params: { plan: selectedPlan }
            } as any);
        }, 500);
    };

    const handleSkip = () => {
        router.push({
            pathname: '/(auth)/signup',
            params: { plan: 'free' }
        } as any);
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    <View style={styles.topBar}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="arrow-back" size={20} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/(auth)/login')}
                        >
                            <Text style={styles.signInText}>Already have an account? <Text style={styles.signInLink}>Sign in</Text></Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.header}>
                        <Text style={styles.title}>Choose Your Plan</Text>
                        <Text style={styles.subtitle}>Unlock the full potential of BetterAt.</Text>
                    </View>

                    <View style={styles.cardsContainer}>
                        {/* Plus Plan */}
                        <TouchableOpacity
                            style={[
                                styles.planCard,
                                selectedPlan === 'plus' && styles.selectedCard
                            ]}
                            onPress={() => setSelectedPlan('plus')}
                            activeOpacity={0.9}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
                                    <Zap size={24} color="#3B82F6" />
                                </View>
                                {selectedPlan === 'plus' && (
                                    <View style={styles.checkCircle}>
                                        <Ionicons name="checkmark" size={16} color="#FFF" />
                                    </View>
                                )}
                            </View>
                            <View style={styles.popularBadge}>
                                <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                            </View>
                            <Text style={styles.planName}>Plus</Text>
                            <Text style={styles.planPrice}>$9<Text style={styles.period}>/month</Text></Text>
                            <Text style={styles.annualPrice}>$89/year when billed annually</Text>
                            <Text style={styles.planDesc}>AI-powered learning with 50,000 AI tokens per month.</Text>
                        </TouchableOpacity>

                        {/* Pro Plan */}
                        <TouchableOpacity
                            style={[
                                styles.planCard,
                                selectedPlan === 'pro' && styles.selectedCard
                            ]}
                            onPress={() => setSelectedPlan('pro')}
                            activeOpacity={0.9}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconContainer, { backgroundColor: '#F3E8FF' }]}>
                                    <Zap size={24} color="#9333EA" />
                                </View>
                                {selectedPlan === 'pro' && (
                                    <View style={styles.checkCircle}>
                                        <Ionicons name="checkmark" size={16} color="#FFF" />
                                    </View>
                                )}
                            </View>
                            <Text style={styles.planName}>Pro</Text>
                            <Text style={styles.planPrice}>$29<Text style={styles.period}>/month</Text></Text>
                            <Text style={styles.annualPrice}>$249/year when billed annually</Text>
                            <Text style={styles.planDesc}>Power user AI with 500,000 tokens per month. Priority support.</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.featuresList}>
                        <Text style={styles.featuresTitle}>Both plans include:</Text>
                        <View style={styles.featureItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.featureText}>Unlimited Interests & Steps</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.featureText}>AI Insights & Suggestions</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.featureText}>Telegram Assistant</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.featureText}>Progress Analytics</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.featureText}>Offline Mode</Text>
                        </View>
                    </View>

                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={handleContinue}
                        disabled={loading}
                    >
                        <Text style={styles.continueButtonText}>
                            {loading ? 'Processing...' : `Start ${selectedPlan === 'plus' ? 'Plus' : 'Pro'} Plan`}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handleSkip}
                    >
                        <Text style={styles.skipButtonText}>Start with Free plan</Text>
                    </TouchableOpacity>
                </View>

            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    safeArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    signInText: {
        fontSize: 14,
        color: '#64748B',
    },
    signInLink: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    header: {
        marginTop: 12,
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
    },
    cardsContainer: {
        gap: 16,
        marginBottom: 32,
    },
    planCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        borderWidth: 2,
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    selectedCard: {
        borderColor: '#3B82F6',
        backgroundColor: '#F0F9FF',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    popularBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 8,
    },
    popularBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    planName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    period: {
        fontSize: 16,
        fontWeight: '500',
        color: '#64748B',
    },
    annualPrice: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 8,
    },
    planDesc: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    featuresList: {
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    featuresTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    featureText: {
        fontSize: 16,
        color: '#334155',
    },
    footer: {
        padding: 24,
        backgroundColor: '#F8FAFC',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    continueButton: {
        backgroundColor: '#0F172A',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    continueButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    skipButtonText: {
        color: '#64748B',
        fontSize: 16,
        fontWeight: '600',
    },
});
