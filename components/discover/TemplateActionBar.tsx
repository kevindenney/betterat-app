/**
 * TemplateActionBar Component
 *
 * Fixed bottom action bar for the sailor race journey screen.
 * Provides options to:
 * - Apply this sailor's setup as a template to an existing race
 * - Copy the race with all preparation to user's timeline
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Sparkles } from 'lucide-react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { templateService } from '@/services/TemplateService';
import { RaceData } from '@/hooks/usePublicSailorRaceJourney';
import { SailorRacePreparation } from '@/services/SailorRacePreparationService';
import { RaceIntentions } from '@/types/raceIntentions';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

interface TemplateActionBarProps {
  sailorId: string;
  raceId: string;
  race: RaceData;
  preparation: SailorRacePreparation | null;
  intentions: RaceIntentions | null;
}

export function TemplateActionBar({
  sailorId,
  raceId,
  race,
  preparation,
  intentions,
}: TemplateActionBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isGuest } = useAuth();
  const [isCopying, setIsCopying] = useState(false);

  // Handle "Use as Template" - apply setup to existing race
  const handleUseAsTemplate = useCallback(async () => {
    if (isGuest || !user) {
      showAlert(
        'Sign In Required',
        'Please sign in to use this feature.'
      );
      return;
    }

    // For now, show a simple confirmation since we need to implement race picker
    showConfirm(
      'Use as Template',
      'This will copy the strategy, rig settings, and sail selection to one of your races.\n\nWould you like to proceed?',
      () => {
        router.push({
          pathname: '/(tabs)/practice',
          params: { templateSourceRaceId: raceId },
        });
      }
    );
  }, [user, isGuest, raceId, router]);

  // Handle "Copy Race & Prep" - create new race with all data
  const handleCopyRace = useCallback(async () => {
    if (isGuest || !user) {
      showAlert(
        'Sign In Required',
        'Please sign in to copy this race.'
      );
      return;
    }

    setIsCopying(true);

    try {
      const result = await templateService.copyRaceWithPreparation(
        user.id,
        raceId,
        sailorId,
        race,
        preparation,
        intentions
      );

      if (result.success && result.raceId) {
        // Invalidate queries to ensure fresh data is loaded
        await queryClient.invalidateQueries({ queryKey: ['regattas'] });
        await queryClient.invalidateQueries({ queryKey: ['enrichedRaces'] });
        await queryClient.invalidateQueries({ queryKey: ['sailorRacePreparation'] });

        // Navigate to the races tab with the new race selected
        router.replace({
          pathname: '/(tabs)/practice',
          params: { selected: result.raceId },
        });
      } else {
        throw new Error(result.error || 'Failed to copy race');
      }
    } catch (error) {
      console.error('[TemplateActionBar] Copy failed:', error);
      showAlert(
        'Copy Failed',
        'Unable to copy this race. Please try again.'
      );
    } finally {
      setIsCopying(false);
    }
  }, [user, isGuest, raceId, sailorId, race, preparation, intentions, router, queryClient]);

  // Check if there's any content worth copying
  const hasPreparation = Boolean(
    preparation ||
    intentions ||
    race.prep_notes ||
    race.tuning_settings
  );

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <View style={styles.content}>
        {/* Primary CTA - Copy Race */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isCopying && styles.buttonDisabled,
          ]}
          onPress={handleCopyRace}
          disabled={isCopying}
          activeOpacity={0.8}
        >
          {isCopying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Copy size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Copy to My Races</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Secondary CTA - Use as Template */}
        {hasPreparation && (
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              isCopying && styles.buttonDisabled,
            ]}
            onPress={handleUseAsTemplate}
            disabled={isCopying}
            activeOpacity={0.8}
          >
            <>
              <Sparkles size={18} color={IOS_COLORS.systemBlue} />
              <Text style={styles.secondaryButtonText}>Use Setup</Text>
            </>
          </TouchableOpacity>
        )}
      </View>

      {/* Helper text */}
      <Text style={styles.helperText}>
        Copy this race to your timeline with all preparation included
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    paddingTop: 12,
    paddingHorizontal: 16,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.systemBlue}15`,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  helperText: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default TemplateActionBar;
