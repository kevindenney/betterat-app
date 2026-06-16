/**
 * RaceInfoCards - Beautiful info cards for race details
 * Displays Time Limits, Entry Info, Race Office, and VHF Channels
 * in a consistent, visually appealing card format
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Linking,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface VHFChannel {
  channel: string;
  purpose?: string;
  classes?: string[];
}

interface CutOffPoint {
  location: string;
  time: string;
}

interface RaceInfoCardsProps {
  // Time Limits
  absoluteTimeLimit?: string;
  cutOffPoints?: CutOffPoint[];
  
  // Entry Info
  entryFees?: string;
  entryDeadline?: string;
  eligibleClasses?: string[];
  
  // Race Office
  raceOfficeLocation?: string;
  raceOfficePhone?: string;
  raceOfficeEmail?: string;
  
  // VHF Channels
  vhfChannels?: VHFChannel[];
  vhfChannel?: string; // Legacy single channel
  vhfBackupChannel?: string;
  safetyChannel?: string;
  
  // Documents
  sailingInstructionsUrl?: string;
  noticeOfRaceUrl?: string;
  
  // Penalty System
  penaltySystem?: string;
  ocsPolicy?: string;
  
  // Scoring
  scoringSystem?: string;
  handicapSystem?: string;
}

// Removed getShadowStyle - using Platform.select directly in styles

export function RaceInfoCards({
  absoluteTimeLimit,
  cutOffPoints,
  entryFees,
  entryDeadline,
  eligibleClasses,
  raceOfficeLocation,
  raceOfficePhone,
  raceOfficeEmail,
  vhfChannels,
  vhfChannel,
  vhfBackupChannel,
  safetyChannel,
  sailingInstructionsUrl,
  noticeOfRaceUrl,
  penaltySystem,
  ocsPolicy,
  scoringSystem,
  handicapSystem,
}: RaceInfoCardsProps) {
  const hasTimeLimits = absoluteTimeLimit || (cutOffPoints && cutOffPoints.length > 0);
  const hasEntryInfo = entryFees || entryDeadline || (eligibleClasses && eligibleClasses.length > 0);
  const hasRaceOffice = raceOfficeLocation || raceOfficePhone || raceOfficeEmail;
  const hasVHF = (vhfChannels && vhfChannels.length > 0) || vhfChannel || safetyChannel;
  const hasDocuments = sailingInstructionsUrl || noticeOfRaceUrl;
  const hasRules = penaltySystem || ocsPolicy || scoringSystem || handicapSystem;

  // Don't render anything if no data
  if (!hasTimeLimits && !hasEntryInfo && !hasRaceOffice && !hasVHF && !hasDocuments && !hasRules) {
    return null;
  }

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#64748B" />
        <Text style={styles.sectionTitle}>Race Information</Text>
      </View>

      {/* Time Limits Card */}
      {hasTimeLimits && (
        <View style={[styles.card, styles.timeLimitsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.timeLimitsIcon]}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#D97706" />
            </View>
            <Text style={styles.cardTitle}>Time Limits</Text>
          </View>
          
          {absoluteTimeLimit && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Absolute Time Limit</Text>
              <Text style={[styles.infoValue, styles.timeLimitsText]}>{absoluteTimeLimit}</Text>
            </View>
          )}
          
          {cutOffPoints && cutOffPoints.length > 0 && (
            <View style={styles.cutOffSection}>
              <Text style={styles.subLabel}>Cut-off Points</Text>
              {cutOffPoints.map((point, index) => (
                <View key={index} style={styles.cutOffRow}>
                  <MaterialCommunityIcons name="map-marker" size={14} color="#D97706" />
                  <Text style={styles.cutOffText}>
                    <Text style={styles.cutOffLocation}>{point.location}</Text>
                    <Text style={styles.cutOffTime}> by {point.time}</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* VHF Channels Card */}
      {hasVHF && (
        <View style={[styles.card, styles.vhfCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.vhfIcon]}>
              <MaterialCommunityIcons name="radio-handheld" size={20} color="#007AFF" />
            </View>
            <Text style={styles.cardTitle}>VHF Channels</Text>
          </View>
          
          {vhfChannels && vhfChannels.length > 0 ? (
            <View style={styles.vhfChannelsList}>
              {vhfChannels.map((vhf, index) => (
                <View key={index} style={styles.vhfChannelItem}>
                  <View style={styles.vhfChannelBadge}>
                    <Text style={styles.vhfChannelNumber}>CH {vhf.channel}</Text>
                  </View>
                  <View style={styles.vhfChannelInfo}>
                    {vhf.purpose && (
                      <Text style={styles.vhfPurpose}>{vhf.purpose}</Text>
                    )}
                    {vhf.classes && vhf.classes.length > 0 && (
                      <Text style={styles.vhfClasses}>{vhf.classes.join(', ')}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.legacyVhf}>
              {vhfChannel && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Primary Channel</Text>
                  <Text style={[styles.infoValue, styles.vhfText]}>VHF {vhfChannel}</Text>
                </View>
              )}
              {vhfBackupChannel && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Backup Channel</Text>
                  <Text style={[styles.infoValue, styles.vhfText]}>VHF {vhfBackupChannel}</Text>
                </View>
              )}
              {safetyChannel && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Safety Watch</Text>
                  <Text style={[styles.infoValue, styles.vhfText]}>{safetyChannel}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Race Office Card */}
      {hasRaceOffice && (
        <View style={[styles.card, styles.raceOfficeCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.raceOfficeIcon]}>
              <MaterialCommunityIcons name="office-building-marker" size={20} color="#059669" />
            </View>
            <Text style={styles.cardTitle}>Race Office</Text>
          </View>
          
          {raceOfficeLocation && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#059669" />
              <Text style={[styles.infoValue, styles.raceOfficeText]}>{raceOfficeLocation}</Text>
            </View>
          )}
          
          {raceOfficePhone && (
            <TouchableOpacity style={styles.contactRow} onPress={() => handleCall(raceOfficePhone)}>
              <MaterialCommunityIcons name="phone" size={16} color="#059669" />
              <Text style={[styles.infoValue, styles.linkText]}>{raceOfficePhone}</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#059669" />
            </TouchableOpacity>
          )}
          
          {raceOfficeEmail && (
            <TouchableOpacity style={styles.contactRow} onPress={() => handleEmail(raceOfficeEmail)}>
              <MaterialCommunityIcons name="email-outline" size={16} color="#059669" />
              <Text style={[styles.infoValue, styles.linkText]}>{raceOfficeEmail}</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#059669" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Entry Info Card */}
      {hasEntryInfo && (
        <View style={[styles.card, styles.entryCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.entryIcon]}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.cardTitle}>Entry Information</Text>
          </View>
          
          {entryDeadline && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Entry Deadline</Text>
              <Text style={[styles.infoValue, styles.entryText]}>{entryDeadline}</Text>
            </View>
          )}
          
          {entryFees && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Entry Fees</Text>
              <Text style={[styles.infoValue, styles.entryText]}>{entryFees}</Text>
            </View>
          )}
          
          {eligibleClasses && eligibleClasses.length > 0 && (
            <View style={styles.classesSection}>
              <Text style={styles.subLabel}>Eligible Classes</Text>
              <View style={styles.classTags}>
                {eligibleClasses.slice(0, 6).map((cls, index) => (
                  <View key={index} style={styles.classTag}>
                    <Text style={styles.classTagText}>{cls}</Text>
                  </View>
                ))}
                {eligibleClasses.length > 6 && (
                  <View style={[styles.classTag, styles.moreTag]}>
                    <Text style={styles.moreTagText}>+{eligibleClasses.length - 6} more</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Rules & Scoring Card */}
      {hasRules && (
        <View style={[styles.card, styles.rulesCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.rulesIcon]}>
              <MaterialCommunityIcons name="scale-balance" size={20} color="#DC2626" />
            </View>
            <Text style={styles.cardTitle}>Rules & Scoring</Text>
          </View>
          
          {penaltySystem && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Penalty System</Text>
              <Text style={[styles.infoValue, styles.rulesText]}>{penaltySystem}</Text>
            </View>
          )}
          
          {ocsPolicy && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>OCS Policy</Text>
              <Text style={[styles.infoValue, styles.rulesText]}>{ocsPolicy}</Text>
            </View>
          )}
          
          {scoringSystem && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Scoring</Text>
              <Text style={[styles.infoValue, styles.rulesText]}>{scoringSystem}</Text>
            </View>
          )}
          
          {handicapSystem && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Handicap</Text>
              <Text style={[styles.infoValue, styles.rulesText]}>{handicapSystem}</Text>
            </View>
          )}
        </View>
      )}

      {/* Documents Card */}
      {hasDocuments && (
        <View style={[styles.card, styles.documentsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.documentsIcon]}>
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#0891B2" />
            </View>
            <Text style={styles.cardTitle}>Race Documents</Text>
          </View>
          
          {sailingInstructionsUrl && (
            <TouchableOpacity 
              style={styles.documentRow} 
              onPress={() => handleOpenUrl(sailingInstructionsUrl)}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={20} color="#DC2626" />
              <Text style={styles.documentText}>Sailing Instructions</Text>
              <MaterialCommunityIcons name="open-in-new" size={16} color="#0891B2" />
            </TouchableOpacity>
          )}
          
          {noticeOfRaceUrl && (
            <TouchableOpacity 
              style={styles.documentRow} 
              onPress={() => handleOpenUrl(noticeOfRaceUrl)}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={20} color="#DC2626" />
              <Text style={styles.documentText}>Notice of Race</Text>
              <MaterialCommunityIcons name="open-in-new" size={16} color="#0891B2" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  
  // Time Limits Card
  timeLimitsCard: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  timeLimitsIcon: {
    backgroundColor: '#FEF3C7',
  },
  timeLimitsText: {
    color: '#92400E',
  },
  
  // VHF Card
  vhfCard: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  vhfIcon: {
    backgroundColor: '#DBEAFE',
  },
  vhfText: {
    color: '#1E40AF',
  },
  
  // Race Office Card
  raceOfficeCard: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  raceOfficeIcon: {
    backgroundColor: '#D1FAE5',
  },
  raceOfficeText: {
    color: '#065F46',
  },
  
  // Entry Card
  entryCard: {
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
  },
  entryIcon: {
    backgroundColor: '#EDE9FE',
  },
  entryText: {
    color: '#5B21B6',
  },
  
  // Rules Card
  rulesCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  rulesIcon: {
    backgroundColor: '#FEE2E2',
  },
  rulesText: {
    color: '#991B1B',
  },
  
  // Documents Card
  documentsCard: {
    borderColor: '#A5F3FC',
    backgroundColor: '#ECFEFF',
  },
  documentsIcon: {
    backgroundColor: '#CFFAFE',
  },
  
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  subLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  
  // Cut-off Points
  cutOffSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  cutOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  cutOffText: {
    flex: 1,
    fontSize: 13,
  },
  cutOffLocation: {
    fontWeight: '600',
    color: '#92400E',
  },
  cutOffTime: {
    color: '#B45309',
  },
  
  // VHF Channels
  vhfChannelsList: {
    gap: 8,
  },
  vhfChannelItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vhfChannelBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  vhfChannelNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  vhfChannelInfo: {
    flex: 1,
    paddingVertical: 4,
  },
  vhfPurpose: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  vhfClasses: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  legacyVhf: {
    gap: 4,
  },
  
  // Contact rows
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
  },
  linkText: {
    color: '#059669',
    textDecorationLine: 'underline',
    flex: 1,
    textAlign: 'left',
  },
  
  // Classes section
  classesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#DDD6FE',
  },
  classTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  classTag: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  classTagText: {
    fontSize: 12,
    color: '#6D28D9',
    fontWeight: '600',
  },
  moreTag: {
    backgroundColor: '#C4B5FD',
  },
  moreTagText: {
    fontSize: 12,
    color: '#5B21B6',
    fontWeight: '600',
  },
  
  // Documents
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#A5F3FC',
  },
  documentText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0E7490',
  },
});

export default RaceInfoCards;



