/**
 * WhoStep Component
 *
 * Step 2 of the 4Q wizard: Who are you going to practice with?
 * - Add crew members
 * - Assign per-drill tasks to each member
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import {
  Users,
  Plus,
  X,
  User,
  ChevronDown,
  CheckCircle2,
  Anchor,
  Ship,
  Eye,
  GraduationCap,
} from 'lucide-react-native';
import { IOS_COLORS } from '@/components/cards/constants';
import {
  WhoStepMember,
  DrillTaskAssignment,
  PracticeMemberRole,
  Drill,
  WhatStepDrill,
  DRILL_CATEGORY_META,
} from '@/types/practice';

interface WhoStepProps {
  members: WhoStepMember[];
  drillTaskAssignments: DrillTaskAssignment[];
  drills: WhatStepDrill[];
  availableDrills: Drill[];
  onAddMember: (member: WhoStepMember) => void;
  onRemoveMember: (index: number) => void;
  onUpdateMember: (index: number, updates: Partial<WhoStepMember>) => void;
  onSetDrillTask: (
    drillId: string,
    memberIndex: number,
    task: string,
    isPrimary?: boolean
  ) => void;
  onRemoveDrillTask: (drillId: string, memberIndex: number) => void;
  onApplyDefaultTasks: () => void;
}

const ROLE_CONFIG: Record<PracticeMemberRole, { label: string; icon: typeof User }> = {
  organizer: { label: 'Organizer', icon: User },
  skipper: { label: 'Skipper', icon: Anchor },
  crew: { label: 'Crew', icon: Ship },
  coach: { label: 'Coach', icon: GraduationCap },
  observer: { label: 'Observer', icon: Eye },
};

const ROLES: PracticeMemberRole[] = ['skipper', 'crew', 'coach', 'observer'];

function MemberCard({
  member,
  onUpdate,
  onRemove,
}: {
  member: WhoStepMember;
  onUpdate: (updates: Partial<WhoStepMember>) => void;
  onRemove: () => void;
}) {
  const [showRolePicker, setShowRolePicker] = useState(false);
  const roleConfig = ROLE_CONFIG[member.role];
  const RoleIcon = roleConfig?.icon || User;

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View style={styles.memberAvatar}>
          <RoleIcon size={16} color={'#FFFFFF'} />
        </View>
        <View style={styles.memberInfo}>
          <TextInput
            style={styles.memberNameInput}
            value={member.displayName}
            onChangeText={(text) => onUpdate({ displayName: text })}
            placeholder="Name"
            placeholderTextColor={IOS_COLORS.gray3}
          />
          <TouchableOpacity
            style={styles.roleSelector}
            onPress={() => setShowRolePicker(true)}
          >
            <Text style={styles.roleText}>{roleConfig?.label || member.role}</Text>
            <ChevronDown size={14} color={IOS_COLORS.gray} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={8}>
          <X size={18} color={IOS_COLORS.gray3} />
        </TouchableOpacity>
      </View>

      {/* Role Picker Modal */}
      <Modal visible={showRolePicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowRolePicker(false)}
          activeOpacity={1}
        >
          <View style={styles.rolePickerSheet}>
            <Text style={styles.rolePickerTitle}>Select Role</Text>
            {ROLES.map((role) => {
              const config = ROLE_CONFIG[role];
              const Icon = config.icon;
              const isSelected = member.role === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    isSelected && styles.roleOptionSelected,
                  ]}
                  onPress={() => {
                    onUpdate({ role });
                    setShowRolePicker(false);
                  }}
                >
                  <Icon
                    size={18}
                    color={isSelected ? IOS_COLORS.indigo : IOS_COLORS.gray}
                  />
                  <Text
                    style={[
                      styles.roleOptionText,
                      isSelected && styles.roleOptionTextSelected,
                    ]}
                  >
                    {config.label}
                  </Text>
                  {isSelected && <CheckCircle2 size={18} color={IOS_COLORS.indigo} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function DrillTaskEditor({
  drill,
  members,
  assignment,
  onSetTask,
  onRemoveTask,
}: {
  drill: Drill;
  members: WhoStepMember[];
  assignment?: DrillTaskAssignment;
  onSetTask: (memberIndex: number, task: string, isPrimary?: boolean) => void;
  onRemoveTask: (memberIndex: number) => void;
}) {
  const categoryMeta = DRILL_CATEGORY_META[drill.category];

  const getMemberTask = (memberIndex: number) => {
    return assignment?.tasks.find((t) => t.memberIndex === memberIndex);
  };

  return (
    <View style={styles.drillTaskEditor}>
      <View style={styles.drillTaskHeader}>
        <Text style={styles.drillTaskName}>{drill.name}</Text>
        <Text style={styles.drillTaskMeta}>
          {categoryMeta?.label} · {drill.durationMinutes} min
        </Text>
      </View>

      {members.length === 0 ? (
        <Text style={styles.noMembersText}>Add crew members above to assign tasks</Text>
      ) : (
        <View style={styles.taskAssignments}>
          {members.map((member, memberIndex) => {
            const task = getMemberTask(memberIndex);
            const roleConfig = ROLE_CONFIG[member.role];

            return (
              <View key={memberIndex} style={styles.memberTaskRow}>
                <View style={styles.memberTaskInfo}>
                  <Text style={styles.memberTaskName}>
                    {member.displayName || roleConfig?.label}
                  </Text>
                </View>
                <TextInput
                  style={styles.taskInput}
                  value={task?.taskDescription || ''}
                  onChangeText={(text) => {
                    if (text) {
                      onSetTask(memberIndex, text, task?.isPrimary);
                    } else {
                      onRemoveTask(memberIndex);
                    }
                  }}
                  placeholder="Task for this drill..."
                  placeholderTextColor={IOS_COLORS.gray3}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function WhoStep({
  members,
  drillTaskAssignments,
  drills,
  availableDrills,
  onAddMember,
  onRemoveMember,
  onUpdateMember,
  onSetDrillTask,
  onRemoveDrillTask,
  onApplyDefaultTasks,
}: WhoStepProps) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<PracticeMemberRole>('crew');

  const handleAddMember = () => {
    if (newMemberName.trim()) {
      onAddMember({
        displayName: newMemberName.trim(),
        role: newMemberRole,
      });
      setNewMemberName('');
      setShowAddMember(false);
    }
  };

  const hasDefaultTasks = drillTaskAssignments.some((a) => a.tasks.length > 0);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Crew Members Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={18} color={IOS_COLORS.indigo} />
          <Text style={styles.sectionTitle}>Crew Members</Text>
          <Text style={styles.sectionCount}>{members.length}</Text>
        </View>

        <Text style={styles.sectionSubtext}>
          Who will be practicing with you?
        </Text>

        {/* Existing Members */}
        {members.map((member, index) => (
          <MemberCard
            key={index}
            member={member}
            onUpdate={(updates) => onUpdateMember(index, updates)}
            onRemove={() => onRemoveMember(index)}
          />
        ))}

        {/* Add Member Form */}
        {showAddMember ? (
          <View style={styles.addMemberForm}>
            <TextInput
              style={styles.addMemberInput}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder="Enter name"
              placeholderTextColor={IOS_COLORS.gray3}
              autoFocus
            />
            <View style={styles.addMemberRoles}>
              {ROLES.slice(0, 3).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.miniRoleChip,
                    newMemberRole === role && styles.miniRoleChipSelected,
                  ]}
                  onPress={() => setNewMemberRole(role)}
                >
                  <Text
                    style={[
                      styles.miniRoleText,
                      newMemberRole === role && styles.miniRoleTextSelected,
                    ]}
                  >
                    {ROLE_CONFIG[role].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.addMemberActions}>
              <TouchableOpacity
                style={styles.addMemberCancel}
                onPress={() => {
                  setShowAddMember(false);
                  setNewMemberName('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.addMemberConfirm,
                  !newMemberName.trim() && styles.addMemberConfirmDisabled,
                ]}
                onPress={handleAddMember}
                disabled={!newMemberName.trim()}
              >
                <Text style={styles.confirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addMemberButton}
            onPress={() => setShowAddMember(true)}
          >
            <Plus size={16} color={IOS_COLORS.indigo} />
            <Text style={styles.addMemberText}>Add crew member</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Per-Drill Tasks Section */}
      {drills.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Drill Tasks</Text>
            {hasDefaultTasks && (
              <TouchableOpacity onPress={onApplyDefaultTasks}>
                <Text style={styles.applyDefaultsText}>Apply defaults</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionSubtext}>
            Assign specific tasks to each crew member for each drill
          </Text>

          {drills.map((drillRef) => {
            const drill = availableDrills.find((d) => d.id === drillRef.drillId);
            if (!drill) return null;

            const assignment = drillTaskAssignments.find(
              (a) => a.drillId === drillRef.drillId
            );

            return (
              <DrillTaskEditor
                key={drillRef.drillId}
                drill={drill}
                members={members}
                assignment={assignment}
                onSetTask={(memberIndex, task, isPrimary) =>
                  onSetDrillTask(drillRef.drillId, memberIndex, task, isPrimary)
                }
                onRemoveTask={(memberIndex) =>
                  onRemoveDrillTask(drillRef.drillId, memberIndex)
                }
              />
            );
          })}
        </View>
      )}

      {/* Spacer */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  section: {
    backgroundColor: IOS_COLORS.systemBackground,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.indigo,
    backgroundColor: `${IOS_COLORS.indigo}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionSubtext: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    marginTop: 4,
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameInput: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    padding: 0,
    marginBottom: 2,
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleText: {
    fontSize: 13,
    color: IOS_COLORS.gray,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: IOS_COLORS.indigo,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  addMemberText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.indigo,
  },
  addMemberForm: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  addMemberInput: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemBackground,
    padding: 12,
    borderRadius: 8,
  },
  addMemberRoles: {
    flexDirection: 'row',
    gap: 8,
  },
  miniRoleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemBackground,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  miniRoleChipSelected: {
    backgroundColor: IOS_COLORS.indigo,
    borderColor: IOS_COLORS.indigo,
  },
  miniRoleText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  miniRoleTextSelected: {
    color: '#FFFFFF',
  },
  addMemberActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  addMemberCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  addMemberConfirm: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: IOS_COLORS.indigo,
    borderRadius: 8,
  },
  addMemberConfirmDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  rolePickerSheet: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  rolePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
    marginBottom: 16,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  roleOptionSelected: {
    backgroundColor: `${IOS_COLORS.indigo}10`,
  },
  roleOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  roleOptionTextSelected: {
    color: IOS_COLORS.indigo,
    fontWeight: '600',
  },
  applyDefaultsText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.indigo,
  },
  drillTaskEditor: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  drillTaskHeader: {
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
    paddingBottom: 10,
  },
  drillTaskName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  drillTaskMeta: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  noMembersText: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    fontStyle: 'italic',
  },
  taskAssignments: {
    gap: 8,
  },
  memberTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberTaskInfo: {
    width: 80,
  },
  memberTaskName: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  taskInput: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
});

export default WhoStep;
