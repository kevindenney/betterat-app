/**
 * ConceptLinkSheet — link a step to the concepts it tested.
 *
 * Opened from a step's ⋮ menu. Lists the owner's concepts for the step's
 * interest, pre-checked against the step's existing links. Toggling rows and
 * confirming diffs the selection: newly checked concepts are linked (which
 * flips a forming/seed concept to "testing", surfacing it on the public face),
 * unchecked ones are unlinked.
 *
 * Concept authoring lives in the Library — this sheet only wires existing
 * concepts to a step, it does not create them.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import {
  usePlaybook,
  usePlaybookConcepts,
  useStepConceptLinks,
  useLinkConceptToStep,
  useUnlinkConceptFromStep,
  useForkOrGetConcept,
} from '@/hooks/usePlaybook';

interface ConceptLinkSheetProps {
  visible: boolean;
  stepId: string;
  interestId: string | null | undefined;
  onDismiss: () => void;
}

const STATE_LABELS: Record<string, string> = {
  seed: 'Seed',
  forming: 'Forming',
  testing: 'Testing',
  settled: 'Settled',
};

export function ConceptLinkSheet({
  visible,
  stepId,
  interestId,
  onDismiss,
}: ConceptLinkSheetProps) {
  const { user } = useAuth();
  const { data: playbook } = usePlaybook(interestId ?? undefined);
  const { data: concepts, isLoading: conceptsLoading } = usePlaybookConcepts(
    playbook?.id,
    interestId ?? undefined,
  );
  const { data: links, isLoading: linksLoading } = useStepConceptLinks(
    visible ? stepId : undefined,
  );
  const linkMutation = useLinkConceptToStep();
  const unlinkMutation = useUnlinkConceptFromStep();
  const forkMutation = useForkOrGetConcept();

  // Collapse a baseline and its fork into one row: when an owned concept forks
  // a baseline (source_concept_id), drop the shared baseline and keep the fork
  // — otherwise the same title appears twice (catalog row + adopted copy).
  const displayConcepts = useMemo(() => {
    const all = concepts ?? [];
    const forkedSourceIds = new Set(
      all.map((c) => c.source_concept_id).filter(Boolean) as string[],
    );
    return all
      .filter((c) => !(c.playbook_id == null && forkedSourceIds.has(c.id)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [concepts]);

  // Depend on the query's data ref (stable: undefined while loading, then the
  // fetched array) — not a fresh `[]` default, which would give linkedIds a new
  // identity every render and spin the seed-selection effect into a loop.
  const linkedIds = useMemo(
    () => new Set((links ?? []).map((l) => l.concept_id)),
    [links],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Seed the selection from the persisted links each time the sheet opens or
  // the links resolve, so the checkmarks reflect current state.
  useEffect(() => {
    if (visible) setSelected(new Set(linkedIds));
  }, [visible, linkedIds]);

  const loading = conceptsLoading || linksLoading;
  const saving =
    linkMutation.isPending || unlinkMutation.isPending || forkMutation.isPending;

  const toggle = (conceptId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) next.delete(conceptId);
      else next.add(conceptId);
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (selected.size !== linkedIds.size) return true;
    for (const id of selected) if (!linkedIds.has(id)) return true;
    return false;
  }, [selected, linkedIds]);

  const handleSave = async () => {
    const toLink = [...selected].filter((id) => !linkedIds.has(id));
    const toUnlink = [...linkedIds].filter((id) => !selected.has(id));
    const ctx = { interestId: interestId ?? undefined, userId: user?.id };
    const byId = new Map(displayConcepts.map((c) => [c.id, c]));

    // A baseline row has no owner, so it can never surface on the public face.
    // Forking it into the playbook (reusing an existing fork) yields an owned
    // copy; linking the step to that copy is what flips it to "testing".
    const linkOne = async (rowId: string) => {
      const concept = byId.get(rowId);
      let targetId = rowId;
      if (concept && concept.playbook_id == null && playbook?.id) {
        const fork = await forkMutation.mutateAsync({
          playbookId: playbook.id,
          sourceConceptId: concept.id,
          interestId: interestId ?? undefined,
        });
        targetId = fork.id;
      }
      await linkMutation.mutateAsync({ stepId, conceptId: targetId, ...ctx });
    };

    await Promise.all([
      ...toLink.map(linkOne),
      ...toUnlink.map((conceptId) =>
        unlinkMutation.mutateAsync({ stepId, conceptId, ...ctx }),
      ),
    ]);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={styles.host}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Link to a concept</Text>
            <Text style={styles.subtitle}>
              Mark the concepts this step tested. Concepts you own move into
              “testing” and surface on your public face.
            </Text>
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={IOS_REGISTER.label} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
          </View>
        ) : displayConcepts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="bulb-outline"
              size={28}
              color={IOS_REGISTER.labelTertiary}
            />
            <Text style={styles.emptyText}>
              No concepts yet for this interest. Create one in your Library,
              then come back to link it.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {displayConcepts.map((concept) => {
              const checked = selected.has(concept.id);
              const stateLabel =
                STATE_LABELS[concept.state ?? 'forming'] ?? 'Forming';
              return (
                <Pressable
                  key={concept.id}
                  style={styles.row}
                  onPress={() => toggle(concept.id)}
                  disabled={saving}
                >
                  <View
                    style={[
                      styles.checkbox,
                      checked && styles.checkboxOn,
                    ]}
                  >
                    {checked && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {concept.title}
                    </Text>
                    <Text style={styles.rowState}>{stateLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {displayConcepts.length > 0 && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!dirty || saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Done</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.25,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.labelTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  rowState: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },
  saveBtn: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConceptLinkSheet;
