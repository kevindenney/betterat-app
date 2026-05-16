import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatClockTime,
  formatRelativeAgo,
  type DoCaptureItem,
} from './doCaptureModel';
import {
  PhotoCapturePreview,
  QuickNoteCapturePreview,
  VoiceCapturePreview,
} from './DoCapturePreview';

const IOS_BLUE = '#007AFF';
const GREEN = '#34C759';
const GREEN_SOFT = 'rgba(52, 199, 89, 0.22)';
const GREEN_WASH = 'rgba(52, 199, 89, 0.06)';
const GREEN_DEEP = '#248A3D';
const GRAY_6 = '#F2F2F7';
const GRAY_5 = '#E5E5EA';
const GRAY_4 = '#D1D1D6';
const GRAY_3 = '#C7C7CC';
const GRAY_2 = '#AEAEB2';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';
const LABEL_4 = 'rgba(60, 60, 67, 0.30)';
const SCRIM = 'rgba(15, 14, 12, 0.42)';
const SHEET_BG = '#FFFFFF';
const FOOTER_BG = '#FAFAFC';

/** Three-step evidence strength selector value. */
export type EvidenceStrength = 'noting' | 'solid' | 'breakthrough';

/**
 * Capability shown in the multi-select list. Presentational shape — callers
 * adapt their blueprint/capability data to this view model.
 */
export interface EvidenceCapabilityOption {
  /** Stable capability id (used for selection toggles). */
  id: string;
  /** Capability name. */
  name: string;
  /** One-line description rendered under the name. */
  description: string;
  /** Completed milestones for this capability (typically 0..5). */
  progressDone: number;
  /** Total milestones for this capability (typically 5). */
  progressTotal: number;
  /** Stage label rendered above the bar (e.g. "Building", "Early", "Strong"). */
  stageLabel: string;
  /** Stage completion fill 0..1 — drives the inline progress bar width. */
  stagePercent: number;
}

export interface MarkAsEvidenceSheetProps {
  /** Sheet visibility. */
  visible: boolean;
  /** Dismiss callback (X tap, scrim tap, hardware back). */
  onClose: () => void;
  /** The capture being promoted to evidence. */
  capture: DoCaptureItem | null;
  /** Active blueprint title shown in the eyebrow ("From your active blueprint · ..."). */
  blueprintTitle?: string;
  /** Capability rows. */
  capabilities: EvidenceCapabilityOption[];
  /** Controlled selection — capability ids currently selected. */
  selectedCapabilityIds: string[];
  /** Toggle a single capability id on/off. */
  onToggleCapability: (capabilityId: string) => void;
  /** Currently selected strength (null = none chosen, the section is optional). */
  strength: EvidenceStrength | null;
  /** Strength selection callback. */
  onChangeStrength: (strength: EvidenceStrength) => void;
  /** Save CTA callback — disabled until at least one capability is selected. */
  onSave: () => void;
  /** Optional explicit Cancel callback; defaults to onClose. */
  onCancel?: () => void;
  /** Now-anchor for the capture preview "ago" label — pass for deterministic tests. */
  nowMs?: number;
  /** Voice play callback forwarded to the inline waveform. */
  onPressPlayVoice?: (captureId: string) => void;
}

const STRENGTH_OPTIONS: { value: EvidenceStrength; label: string }[] = [
  { value: 'noting', label: 'Worth noting' },
  { value: 'solid', label: 'Solid' },
  { value: 'breakthrough', label: 'Breakthrough' },
];

/**
 * Phase B.7 · Frame 4 — Mark as evidence bottom sheet.
 *
 * Presentational. Slides up over the dimmed post-activity state and promotes
 * a capture into evidence of capability. The header carries a plain "Mark as
 * evidence" title; below it sits a green-washed preview of the capture being
 * promoted; below that, a multi-select list of capabilities from the active
 * blueprint; below that, an optional three-step strength rating; and the
 * footer's iOS-blue Save CTA carries the selected-count pill.
 */
export function MarkAsEvidenceSheet({
  visible,
  onClose,
  capture,
  blueprintTitle,
  capabilities,
  selectedCapabilityIds,
  onToggleCapability,
  strength,
  onChangeStrength,
  onSave,
  onCancel,
  nowMs,
  onPressPlayVoice,
}: MarkAsEvidenceSheetProps) {
  const selectedCount = selectedCapabilityIds.length;
  const canSave = selectedCount > 0;
  const handleCancel = onCancel ?? onClose;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Dismiss mark as evidence"
        onPress={onClose}
        style={styles.scrim}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
          style={styles.sheet}
        >
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.head}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Mark as evidence</Text>
              <Text style={styles.sub}>
                Tag this capture as proof you&apos;re getting better.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.dismiss}
              hitSlop={8}
            >
              <Ionicons name="close" size={15} color={LABEL_2} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {capture ? (
              <MomentSection
                capture={capture}
                nowMs={nowMs}
                onPressPlayVoice={onPressPlayVoice}
              />
            ) : null}

            <ScrollView
              style={styles.capsScroll}
              contentContainerStyle={styles.capsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.capsEyebrow}>
                <Text style={styles.eyebrowLbl}>
                  Evidence for which capabilities
                </Text>
                <View style={styles.selectedCount}>
                  <Ionicons
                    name={selectedCount > 0 ? 'checkmark-circle' : 'ellipse-outline'}
                    size={12}
                    color={selectedCount > 0 ? GREEN_DEEP : LABEL_3}
                  />
                  <Text
                    style={[
                      styles.selectedCountText,
                      selectedCount === 0 && styles.selectedCountTextEmpty,
                    ]}
                  >
                    {selectedCount} selected
                  </Text>
                </View>
              </View>
              {blueprintTitle ? (
                <Text style={styles.blueprintLine}>
                  <Text>From your active blueprint · </Text>
                  <Text style={styles.blueprintEm}>{blueprintTitle}</Text>
                </Text>
              ) : null}

              <View style={styles.capList}>
                {capabilities.map((cap) => (
                  <CapabilityRow
                    key={cap.id}
                    capability={cap}
                    selected={selectedCapabilityIds.includes(cap.id)}
                    onToggle={onToggleCapability}
                  />
                ))}
              </View>
            </ScrollView>

            <View style={styles.strengthSection} accessibilityLabel="Evidence strength">
              <View style={styles.strengthRow1}>
                <Text style={styles.eyebrowLbl}>How strong is this evidence?</Text>
                <Text style={styles.optional}>Optional</Text>
              </View>
              <View style={styles.strengthSeg}>
                {STRENGTH_OPTIONS.map((opt) => {
                  const active = strength === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                      accessibilityState={{ selected: active }}
                      onPress={() => onChangeStrength(opt.value)}
                      style={[styles.segBtn, active && styles.segBtnOn]}
                      hitSlop={4}
                    >
                      <View style={[styles.segIco, active && styles.segIcoOn]} />
                      <Text style={[styles.segLbl, active && styles.segLblOn]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.foot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save evidence"
                accessibilityState={{ disabled: !canSave }}
                disabled={!canSave}
                onPress={canSave ? onSave : undefined}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && canSave && styles.saveBtnPressed,
                  !canSave && styles.saveBtnDisabled,
                ]}
              >
                <Ionicons name="bookmark" size={17} color="#FFFFFF" />
                <Text style={styles.saveLbl}>Save evidence</Text>
                {canSave ? (
                  <View style={styles.savePill}>
                    <Text style={styles.savePillText}>{selectedCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={handleCancel}
                style={styles.cancelBtn}
                hitSlop={6}
              >
                <Text style={styles.cancelLbl}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The "promoting this capture" preview that sits at the top of the sheet.
 * Inline-rendered (rather than reusing {@link DoCaptureRow}) so we can paint
 * the gray category chip and the green wash framing the canonical specifies.
 */
function MomentSection({
  capture,
  nowMs,
  onPressPlayVoice,
}: {
  capture: DoCaptureItem;
  nowMs?: number;
  onPressPlayVoice?: (captureId: string) => void;
}) {
  const clock = formatClockTime(capture.capturedAt);
  const ago = formatRelativeAgo(capture.capturedAt, nowMs);
  const isVoice = capture.kind === 'voice';
  const isPhoto = capture.kind === 'photo' || capture.kind === 'video';
  const typeMeta = TYPE_META[capture.kind] ?? TYPE_META.note;

  return (
    <View style={styles.momentSection}>
      <View style={styles.momentEyebrow}>
        <Ionicons name="bookmark" size={11} color={GREEN_DEEP} />
        <Text style={styles.momentEyebrowText}>PROMOTING THIS CAPTURE</Text>
        {clock ? (
          <>
            <View style={styles.momentEyebrowDot} />
            <Text style={styles.momentEyebrowMeta}>
              {clock}
              {capture.beatLabel ? ` · ${capture.beatLabel}` : ''}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.momentCap}>
        <View style={styles.momentTopRow}>
          <View style={styles.momentTsCol}>
            {clock ? <Text style={styles.momentTs}>{clock}</Text> : null}
            {ago ? <Text style={styles.momentAgo}>{ago}</Text> : null}
          </View>
          <View style={styles.momentBodyCol}>
            {capture.body ? (
              <Text style={[styles.momentBody, isVoice && styles.momentBodyVoice]}>
                {capture.body}
              </Text>
            ) : null}
          </View>
          {capture.chipLabel ? (
            <View style={styles.momentChip}>
              <Text style={styles.momentChipText}>{capture.chipLabel}</Text>
            </View>
          ) : null}
        </View>

        {isVoice ? (
          <VoiceCapturePreview capture={capture} onPressPlay={onPressPlayVoice} />
        ) : null}
        {isPhoto ? <PhotoCapturePreview capture={capture} /> : null}
        {!isVoice && !isPhoto && capture.kind === 'note' ? (
          <QuickNoteCapturePreview capture={capture} />
        ) : null}

        <View style={styles.momentMeta}>
          <View style={styles.momentMetaType}>
            <Ionicons name={typeMeta.icon} size={11} color={LABEL_3} />
            <Text style={styles.momentMetaText}>{typeMeta.label}</Text>
          </View>
          {capture.beatLabel ? (
            <>
              <Text style={styles.momentMetaSep}>·</Text>
              <Text style={[styles.momentMetaText, styles.momentMetaBeat]}>
                {capture.beatLabel}
              </Text>
            </>
          ) : null}
          {capture.metaSubtitle ? (
            <>
              <Text style={styles.momentMetaSep}>·</Text>
              <Text style={styles.momentMetaText}>{capture.metaSubtitle}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const TYPE_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  voice: { icon: 'mic', label: 'Voice' },
  note: { icon: 'create-outline', label: 'Quick note' },
  photo: { icon: 'camera-outline', label: 'Photo' },
  video: { icon: 'videocam-outline', label: 'Video' },
  media_link: { icon: 'link-outline', label: 'Link' },
  flag: { icon: 'flag', label: 'Flag' },
};

function CapabilityRow({
  capability,
  selected,
  onToggle,
}: {
  capability: EvidenceCapabilityOption;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const pips = Array.from(
    { length: Math.max(0, capability.progressTotal) },
    (_, i) => i < capability.progressDone,
  );
  const fillPercent = Math.max(0, Math.min(1, capability.stagePercent));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={capability.name}
      accessibilityState={{ checked: selected }}
      onPress={() => onToggle(capability.id)}
      style={[styles.capRow, selected && styles.capRowOn]}
    >
      <View style={[styles.capCheck, selected && styles.capCheckOn]}>
        {selected ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
      </View>
      <View style={styles.capInfo}>
        <View style={styles.capNameRow}>
          <Text style={styles.capName}>{capability.name}</Text>
          <View style={styles.capProgressMeta}>
            <View style={styles.capPipWrap}>
              {pips.map((on, i) => (
                <View
                  key={i}
                  style={[styles.capPip, on && styles.capPipOn]}
                />
              ))}
            </View>
            <Text style={styles.capProgressText}>
              {capability.progressDone} of {capability.progressTotal}
            </Text>
          </View>
        </View>
        <Text style={styles.capDesc}>{capability.description}</Text>
        <View style={styles.capStageRow}>
          <Text style={styles.capStageLbl}>{capability.stageLabel.toUpperCase()}</Text>
          <View style={styles.capStageBar}>
            <View
              style={[
                styles.capStageFill,
                selected && styles.capStageFillOn,
                { width: `${fillPercent * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -10 },
    maxHeight: '85%',
  },
  grabberWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: GRAY_4,
    opacity: 0.55,
  },
  head: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  titleWrap: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.32,
    color: LABEL,
    lineHeight: 22,
  },
  sub: {
    fontSize: 12,
    letterSpacing: -0.05,
    color: LABEL_3,
    lineHeight: 16,
  },
  dismiss: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GRAY_6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexShrink: 1,
  },

  // Moment section
  momentSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: GREEN_WASH,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  momentEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 9,
  },
  momentEyebrowText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: GREEN_DEEP,
    letterSpacing: 0.7,
  },
  momentEyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GREEN,
    marginHorizontal: 2,
  },
  momentEyebrowMeta: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: LABEL_3,
  },
  momentCap: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    borderLeftWidth: 2.5,
    borderLeftColor: IOS_BLUE,
    borderRadius: 12,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 11,
    paddingLeft: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  momentTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  momentTsCol: {
    width: 40,
    paddingTop: 1,
  },
  momentTs: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    color: LABEL_3,
    fontVariant: ['tabular-nums'],
  },
  momentAgo: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: LABEL_4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  momentBodyCol: {
    flex: 1,
    minWidth: 0,
  },
  momentBody: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    color: LABEL,
  },
  momentBodyVoice: {
    fontStyle: 'italic',
  },
  momentChip: {
    alignSelf: 'flex-start',
    paddingTop: 2,
    paddingRight: 8,
    paddingBottom: 3,
    paddingLeft: 8,
    borderRadius: 999,
    backgroundColor: GRAY_6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  momentChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: LABEL_2,
  },
  momentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  momentMetaType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  momentMetaText: {
    fontSize: 10,
    letterSpacing: -0.02,
    color: LABEL_3,
  },
  momentMetaSep: {
    fontSize: 10,
    color: LABEL_4,
  },
  momentMetaBeat: {
    fontWeight: '500',
  },

  // Capabilities section
  capsScroll: {
    flexGrow: 0,
  },
  capsScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  capsEyebrow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  eyebrowLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  selectedCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectedCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: GREEN_DEEP,
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  selectedCountTextEmpty: {
    color: LABEL_3,
  },
  blueprintLine: {
    fontSize: 11,
    color: LABEL_3,
    letterSpacing: -0.05,
    lineHeight: 15,
    marginHorizontal: 2,
    marginTop: -2,
    marginBottom: 4,
  },
  blueprintEm: {
    fontWeight: '600',
    color: LABEL_2,
  },
  capList: {
    gap: 8,
  },
  capRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 11,
    paddingRight: 13,
    paddingBottom: 12,
    paddingLeft: 13,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  capRowOn: {
    backgroundColor: GREEN_WASH,
    borderColor: GREEN_SOFT,
  },
  capCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: GRAY_3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  capCheckOn: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  capInfo: {
    flex: 1,
    minWidth: 0,
  },
  capNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  capName: {
    fontSize: 14,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.2,
    lineHeight: 18,
    flexShrink: 1,
  },
  capProgressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  capPipWrap: {
    flexDirection: 'row',
    gap: 2,
  },
  capPip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GRAY_4,
  },
  capPipOn: {
    backgroundColor: GREEN,
  },
  capProgressText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: LABEL_3,
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  capDesc: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.05,
    color: LABEL_3,
    marginTop: 3,
  },
  capStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 7,
  },
  capStageLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: LABEL_3,
    letterSpacing: 0.3,
  },
  capStageBar: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: GRAY_5,
    overflow: 'hidden',
  },
  capStageFill: {
    height: 3,
    backgroundColor: GRAY_2,
  },
  capStageFillOn: {
    backgroundColor: GREEN,
  },

  // Strength
  strengthSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: FOOTER_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
  },
  strengthRow1: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optional: {
    fontSize: 11,
    color: LABEL_3,
    letterSpacing: -0.05,
    fontStyle: 'italic',
  },
  strengthSeg: {
    flexDirection: 'row',
    backgroundColor: GRAY_6,
    borderRadius: 9,
    padding: 2,
  },
  segBtn: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 9,
    paddingHorizontal: 6,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  segBtnOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  segIco: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GRAY_4,
  },
  segIcoOn: {
    backgroundColor: GREEN,
  },
  segLbl: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LABEL_2,
    letterSpacing: -0.1,
    textAlign: 'center',
    lineHeight: 14,
  },
  segLblOn: {
    fontWeight: '600',
    color: LABEL,
  },

  // Footer
  foot: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    gap: 8,
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: IOS_BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: IOS_BLUE,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  saveLbl: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  savePill: {
    marginLeft: 4,
    paddingTop: 2,
    paddingBottom: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  savePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  cancelLbl: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: LABEL_2,
  },
});
