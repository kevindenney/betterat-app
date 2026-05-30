/**
 * BeatsList — time-stamped sub-events on a step's Do tab.
 *
 * Each beat is a {time_label, title, body} row. Inline-editable: tap a row
 * to expand the title/body inputs; the time-label sits to the right and
 * is also inline-editable. The add footer appends a new timed beat row.
 *
 * Per-interest lexicon (sectionLabel, placeholders, empty hint) comes from
 * getInterestBeatsConfig — same pattern as INTEREST_DO_TAB_CONFIG.
 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import {
  getInterestBeatsConfig,
  type InterestBeatsConfig,
} from '@/lib/interest-config';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useDragReorder } from '@/components/ios-register/timeline-zoom/useDragReorder';
import type { StepBeat } from '@/hooks/useStepBeats';
import { RowAnnotations, RowPlusButton, type SubStepCaptureKind } from './RowAnnotations';
import type { BeforeShiftItem } from '@/components/step/v2/plan/BeforeTheShiftCard';
import type { DoCaptureItem } from './doCaptureModel';

interface Props {
  beats: StepBeat[];
  readOnly?: boolean;
  interestSlug?: string | null;
  interestName?: string | null;
  interestId?: string | null;
  onAdd: (input: { title: string; time_label?: string | null; body?: string | null }) => void;
  onEdit: (
    id: string,
    patch: { title?: string; time_label?: string | null; body?: string | null },
  ) => void;
  onDelete: (id: string) => void;
  onToggleDone?: (id: string, done: boolean) => void;
  /** When provided, beats can be long-press-dragged to reorder. */
  onReorder?: (orderedIds: string[]) => void;
  /** Library pins anchored to each beat, keyed by beat id. */
  refsByBeat?: Record<string, BeforeShiftItem[]>;
  /** Saved captures anchored to each beat, keyed by beat id. */
  capturesByBeat?: Record<string, DoCaptureItem[]>;
  onOpenLibraryRef?: (libraryItemId: string) => void;
  onRemoveLibraryRef?: (rowId: string) => void;
  onAttachLibrary?: (beatId: string) => void;
  onBeatCapture?: (beatId: string, kind: SubStepCaptureKind) => void;
}

export function BeatsList({
  beats,
  readOnly,
  interestSlug,
  interestName,
  interestId,
  onAdd,
  onEdit,
  onDelete,
  onToggleDone,
  onReorder,
  refsByBeat,
  capturesByBeat,
  onOpenLibraryRef,
  onRemoveLibraryRef,
  onAttachLibrary,
  onBeatCapture,
}: Props) {
  const config = getInterestBeatsConfig({ interestSlug, interestName, interestId });
  const dragEnabled = !readOnly && !!onReorder && beats.length > 1;

  const drag = useDragReorder<StepBeat>({
    items: beats,
    enabled: dragEnabled,
    axis: 'vertical',
    onReorder: (_itemId, from, to) => {
      if (!onReorder) return;
      const ids = beats.map((b) => b.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      onReorder(ids);
    },
  });

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{config.sectionLabel}</Text>

      {beats.length === 0 ? (
        <Text style={styles.emptyHint}>{config.emptyHint}</Text>
      ) : (
        <View style={styles.list}>
          {beats.map((beat, index) => (
            <DraggableBeat
              key={beat.id}
              beat={beat}
              index={index}
              dragEnabled={dragEnabled}
              isLifted={drag.liftedId === beat.id}
              showDropBefore={drag.dropTargetIndex === index && drag.liftedId !== beat.id}
              liftedTranslateY={drag.liftedTranslate}
              buildGesture={drag.buildItemGesture}
              registerRowLayout={drag.registerRowLayout}
              readOnly={readOnly}
              config={config}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleDone={onToggleDone}
              refs={refsByBeat?.[beat.id]}
              captures={capturesByBeat?.[beat.id]}
              onOpenLibraryRef={onOpenLibraryRef}
              onRemoveLibraryRef={onRemoveLibraryRef}
              onAttachLibrary={onAttachLibrary}
              onBeatCapture={onBeatCapture}
            />
          ))}
        </View>
      )}

      {!readOnly ? <AddBeatRow config={config} onAdd={onAdd} /> : null}
    </View>
  );
}

interface DraggableBeatProps extends BeatRowProps {
  index: number;
  dragEnabled: boolean;
  isLifted: boolean;
  showDropBefore: boolean;
  liftedTranslateY: number;
  buildGesture: ReturnType<typeof useDragReorder>['buildItemGesture'];
  registerRowLayout: ReturnType<typeof useDragReorder>['registerRowLayout'];
}

function DraggableBeat({
  index,
  dragEnabled,
  isLifted,
  showDropBefore,
  liftedTranslateY,
  buildGesture,
  registerRowLayout,
  ...rowProps
}: DraggableBeatProps) {
  const gesture = useMemo(
    () => buildGesture(rowProps.beat.id, index),
    [buildGesture, rowProps.beat.id, index],
  );

  const liftStyle = useAnimatedStyle(() => {
    if (!isLifted) return { transform: [] as never[] };
    return {
      transform: [{ translateY: liftedTranslateY }, { scale: 1.02 }],
      zIndex: 10,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    };
  }, [isLifted, liftedTranslateY]);

  const body = (
    <Animated.View
      style={liftStyle}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        registerRowLayout(rowProps.beat.id, { start: y, length: height });
      }}
    >
      <BeatRow {...rowProps} dragHandle={dragEnabled} />
    </Animated.View>
  );

  return (
    <View>
      {showDropBefore ? <View style={styles.dropIndicator} /> : null}
      {dragEnabled ? <GestureDetector gesture={gesture}>{body}</GestureDetector> : body}
    </View>
  );
}

interface BeatRowProps {
  beat: StepBeat;
  readOnly?: boolean;
  config: InterestBeatsConfig;
  onEdit: (
    id: string,
    patch: { title?: string; time_label?: string | null; body?: string | null },
  ) => void;
  onDelete: (id: string) => void;
  onToggleDone?: (id: string, done: boolean) => void;
  /** Show a grip glyph hinting the row is long-press-draggable. */
  dragHandle?: boolean;
  refs?: BeforeShiftItem[];
  captures?: DoCaptureItem[];
  onOpenLibraryRef?: (libraryItemId: string) => void;
  onRemoveLibraryRef?: (rowId: string) => void;
  onAttachLibrary?: (beatId: string) => void;
  onBeatCapture?: (beatId: string, kind: SubStepCaptureKind) => void;
}

function BeatRow({
  beat,
  readOnly,
  config,
  onEdit,
  onDelete,
  onToggleDone,
  dragHandle,
  refs,
  captures,
  onOpenLibraryRef,
  onRemoveLibraryRef,
  onAttachLibrary,
  onBeatCapture,
}: BeatRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [title, setTitle] = useState(beat.title);
  const [time, setTime] = useState(beat.time_label ?? '');
  const [body, setBody] = useState(beat.body ?? '');
  const hasMenu = !readOnly && Boolean(onAttachLibrary || onBeatCapture);

  const commit = () => {
    if (readOnly) return;
    const patch: { title?: string; time_label?: string | null; body?: string | null } = {};
    if (title.trim() !== beat.title) patch.title = title.trim();
    if ((time.trim() || null) !== beat.time_label) patch.time_label = time;
    if ((body.trim() || null) !== beat.body) patch.body = body;
    if (Object.keys(patch).length > 0) onEdit(beat.id, patch);
  };

  const handleDelete = () => {
    showConfirm(
      'Delete beat',
      `Remove "${beat.title}" from this step?`,
      () => onDelete(beat.id),
      { destructive: true, confirmText: 'Delete' },
    );
  };

  return (
    <View style={styles.beat}>
      <View style={styles.beatHead}>
        {dragHandle ? (
          <Ionicons
            name="reorder-three-outline"
            size={16}
            color={IOS_COLORS.tertiaryLabel}
            style={styles.grip}
          />
        ) : null}
        <Pressable
          hitSlop={6}
          onPress={onToggleDone ? () => onToggleDone(beat.id, !beat.done) : undefined}
          disabled={readOnly || !onToggleDone}
          style={[styles.check, beat.done ? styles.checkDone : null]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: beat.done }}
          accessibilityLabel={`Mark "${beat.title}" ${beat.done ? 'not done' : 'done'}`}
        >
          {beat.done ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
        </Pressable>
        <Pressable
          style={styles.beatHeadLeft}
          onPress={() => setExpanded((p) => !p)}
          disabled={readOnly}
        >
          <Text
            style={[styles.beatTitle, beat.done ? styles.beatTitleDone : null]}
            numberOfLines={expanded ? undefined : 1}
          >
            {beat.title}
          </Text>
          {beat.body && !expanded ? (
            <Text style={styles.beatBody} numberOfLines={2}>
              {beat.body}
            </Text>
          ) : null}
        </Pressable>
        {beat.time_label ? (
          <Text style={styles.beatTime}>{beat.time_label}</Text>
        ) : null}
        {hasMenu ? (
          <RowPlusButton open={menuOpen} onPress={() => setMenuOpen((v) => !v)} />
        ) : null}
      </View>

      <RowAnnotations
        readOnly={readOnly}
        menuOpen={menuOpen}
        onCloseMenu={() => setMenuOpen(false)}
        refs={refs ?? []}
        captures={captures ?? []}
        onOpenLibraryRef={onOpenLibraryRef}
        onRemoveLibraryRef={onRemoveLibraryRef}
        onAttachLibrary={onAttachLibrary ? () => onAttachLibrary(beat.id) : undefined}
        onCapture={onBeatCapture ? (kind) => onBeatCapture(beat.id, kind) : undefined}
      />

      {expanded && !readOnly ? (
        <View style={styles.beatEdit}>
          <View style={styles.beatEditRow}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              onBlur={commit}
              placeholder={config.titlePlaceholder}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={[styles.input, styles.inputTitle]}
            />
            <TextInput
              value={time}
              onChangeText={setTime}
              onBlur={commit}
              placeholder={config.timePlaceholder}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={[styles.input, styles.inputTime]}
            />
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            onBlur={commit}
            placeholder="Notes (optional)"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            style={[styles.input, styles.inputBody]}
            multiline
          />
          <Pressable hitSlop={8} onPress={handleDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={14} color="#FF3B30" />
            <Text style={styles.deleteText}>Delete beat</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function AddBeatRow({
  config,
  onAdd,
}: {
  config: InterestBeatsConfig;
  onAdd: Props['onAdd'];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');

  const reset = () => {
    setOpen(false);
    setTitle('');
    setTime('');
  };

  const submit = () => {
    if (!title.trim()) {
      reset();
      return;
    }
    onAdd({ title, time_label: time || null });
    reset();
  };

  if (!open) {
    return (
      <Pressable style={styles.addRow} onPress={() => setOpen(true)} hitSlop={6}>
        <Ionicons name="add" size={14} color="#007AFF" />
        <Text style={styles.addText}>{config.addLabel}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.addOpen}>
      <View style={styles.beatEditRow}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={config.titlePlaceholder}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          style={[styles.input, styles.inputTitle]}
          autoFocus
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder={config.timePlaceholder}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          style={[styles.input, styles.inputTime]}
        />
      </View>
      <View style={styles.addActions}>
        <Pressable hitSlop={8} onPress={reset}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={submit}
          disabled={!title.trim()}
        >
          <Text
            style={[
              styles.saveText,
              !title.trim() ? styles.saveTextDisabled : null,
            ]}
          >
            Add
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    padding: IOS_SPACING.sm,
    gap: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  emptyHint: {
    fontSize: 12.5,
    color: IOS_COLORS.tertiaryLabel,
    paddingHorizontal: 4,
    paddingVertical: 6,
    lineHeight: 17,
  },
  list: {
    gap: 6,
  },
  dropIndicator: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#007AFF',
    marginVertical: 2,
  },
  grip: {
    marginTop: 1,
  },
  beat: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: 10,
  },
  beatHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  beatHeadLeft: {
    flex: 1,
    minWidth: 0,
  },
  beatTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  beatTitleDone: {
    color: IOS_COLORS.secondaryLabel,
    textDecorationLine: 'line-through',
  },
  beatBody: {
    fontSize: 12.5,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
    lineHeight: 17,
  },
  beatTime: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.2,
  },
  beatEdit: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
  },
  beatEditRow: {
    flexDirection: 'row',
    gap: 6,
  },
  input: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13.5,
    color: IOS_COLORS.label,
  },
  inputTitle: {
    flex: 1,
  },
  inputTime: {
    width: 110,
  },
  inputBody: {
    minHeight: 48,
    textAlignVertical: 'top',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  addText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#007AFF',
  },
  addOpen: {
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    paddingTop: 2,
  },
  cancelText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  saveTextDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },
});
