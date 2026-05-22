/**
 * InterestTagRow — chip row on /library/items/[id] that surfaces and edits
 * the library_item_interests tags. Reading these tags scopes the
 * BeforeTheShiftCard picker on a step to items that match the step's
 * interest; an item with zero tags is treated as "everywhere."
 *
 * Tapping a chip toggles the tag inline. No modal — interest list comes
 * from the user's own interests via useInterest().
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useLibraryItemInterestTagsBinding } from '@/hooks/useLibraryItemInterestTags';

interface Props {
  libraryItemId: string;
  /** When the item id is a demo slug (e.g. 'aacn-sepsis'), suppress wiring
   *  since the demo rows aren't in the DB and the chips would no-op silently. */
  isDemo?: boolean;
}

export function InterestTagRow({ libraryItemId, isDemo }: Props) {
  const { userInterests } = useInterest();
  const { tagIds, onToggle } = useLibraryItemInterestTagsBinding(
    isDemo ? undefined : libraryItemId,
  );

  if (isDemo) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>RELEVANT FOR</Text>
        <Text style={styles.demoHint}>
          Interest tagging is on real captures — this is a demo card.
        </Text>
      </View>
    );
  }

  const tagSet = new Set(tagIds);
  const hint =
    tagIds.length === 0
      ? 'Untagged · shows in every interest. Tap to scope.'
      : `Scoped to ${tagIds.length} interest${tagIds.length === 1 ? '' : 's'}.`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>RELEVANT FOR</Text>
      <View style={styles.chips}>
        {userInterests.map((interest) => {
          const on = tagSet.has(interest.id);
          return (
            <TouchableOpacity
              key={interest.id}
              activeOpacity={0.7}
              onPress={() => onToggle(interest.id)}
              style={[styles.chip, on ? styles.chipOn : null]}
            >
              {on ? (
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              ) : null}
              <Text style={[styles.chipLabel, on ? styles.chipLabelOn : null]}>
                {interest.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    paddingVertical: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: IOS_COLORS.secondaryLabel,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.systemGray5,
  },
  chipOn: {
    backgroundColor: IOS_COLORS.label,
  },
  chipLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  chipLabelOn: {
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 11.5,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  demoHint: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
});
