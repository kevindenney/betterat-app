/**
 * Race Screen Styles
 *
 * Consolidated StyleSheet definitions for the races screen.
 * Follows Tufte/Apple design principles: minimal chrome, typography-first.
 */

import { StyleSheet, Platform } from 'react-native';

// =============================================================================
// ADD RACE TIMELINE CARD STYLES
// =============================================================================

export const addRaceTimelineStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 400,
    marginRight: 16,
  },
  timelineColumn: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  timelineBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timelineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.5,
  },
  timelineBar: {
    width: 6,
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#10B981',
    ...Platform.select({
      web: {
        boxShadow: '0px 0px 8px rgba(5, 150, 105, 0.35)',
      },
      default: {
        shadowColor: '#059669',
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
    }),
  },
  card: {
    width: 240,
    height: '100%',
    backgroundColor: '#F8FFFB',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    marginLeft: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 12px rgba(15, 23, 42, 0.08)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 12,
        elevation: 4,
      },
    }),
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#042F2E',
    marginTop: 6,
  },
  copy: {
    fontSize: 13,
    color: '#0F172A',
    marginTop: 8,
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  chip: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    paddingVertical: 11,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Simplified card styles - matching RaceCard dimensions
  cardSimple: {
    width: 160,
    height: 180,
    backgroundColor: '#F8FFFB',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(15, 23, 42, 0.06)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  titleSimple: {
    fontSize: 15,
    fontWeight: '700',
    color: '#042F2E',
    marginBottom: 4,
    paddingRight: 20,
  },
  copySimple: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonSimple: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 4,
  },
  primaryButtonTextSimple: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButtonSimple: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#FFFFFF',
  },
  compactCard: {
    width: 100,
    height: 100,
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
});

// =============================================================================
// DOCUMENT TYPE PICKER STYLES
// =============================================================================

export const documentTypePickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#475467',
    marginTop: 4,
    marginBottom: 12,
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  lastOption: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
});

// =============================================================================
// ADD RACE SHEET STYLES (Tufte-style)
// =============================================================================

export const addRaceSheetStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },
  closeButton: {
    padding: 4,
  },
});

// =============================================================================
// ADD RACE HEADER STYLES (Horizontal flex row)
// =============================================================================

export const addRaceHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countText: {
    fontSize: 14,
    color: '#6B7280',
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

// =============================================================================
// FLOATING HEADER STYLES (Apple/Tufte: invisible bar, typography-first)
// =============================================================================

export const floatingHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    zIndex: 10,
    elevation: 10, // Android requires elevation for z-index to work
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  raceCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nextInfo: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  addText: {
    fontSize: 18,
    fontWeight: '400',
    color: '#6B7280',
  },
});

// =============================================================================
// DEMO NOTICE STYLES (Dismissable, single row)
// =============================================================================

export const demoNoticeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    color: '#6B7280',
  },
  link: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 4,
  },
});

// =============================================================================
// ADD RACE FAMILY BUTTON STYLES
// =============================================================================

export const addRaceFamilyButtonStyles = StyleSheet.create({
  triggerLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#047857',
    marginTop: 4,
  },
});

// =============================================================================
// RIG PLANNER STYLES
// =============================================================================

export const rigPlannerStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  warningText: {
    fontSize: 12,
    color: '#D97706',
    marginTop: 4,
  },
  addGuideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  addGuideText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  presetButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  presetButtonInactive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: '#FFFFFF',
  },
  presetButtonTextInactive: {
    color: '#1D4ED8',
  },
  detailsPanel: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  detailsNotes: {
    fontSize: 11,
    color: '#1E3A8A',
    marginTop: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#334155',
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  detailValue: {
    fontSize: 12,
    color: '#1E40AF',
    textAlign: 'right',
    marginLeft: 12,
    flex: 1,
  },
});
