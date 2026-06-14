import type { SocialNotification } from '@/services/NotificationService';

export interface NotificationGroup {
  key: string;
  latest: SocialNotification;
  count: number;
  ids: string[];
  // Every notification in the group, newest-first. `latest` is members[0].
  // Carried so digest UIs can render a per-item preview (e.g. the step
  // names behind a "15 new steps" thread) without re-querying.
  members: SocialNotification[];
  hasUnread: boolean;
  latestAt: string;
}

function getNotificationOrgId(notification: SocialNotification): string {
  const data = notification.data || {};
  const candidates = [
    data.organization_id,
    data.organizationId,
    data.org_id,
    data.orgId,
  ];
  const found = candidates.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
  return found ? String(found).trim() : '';
}

function getNotificationEntityType(notification: SocialNotification): string {
  const data = notification.data || {};
  const candidates = [data.entity_type, data.entityType, data.target_type, data.targetType];
  const found = candidates.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
  return found ? String(found).trim() : '';
}

function getNotificationEntityId(notification: SocialNotification): string {
  const data = notification.data || {};
  // blueprint_id keeps a burst keyed to its source blueprint, so the same
  // author publishing to two blueprints yields two digests, not one merged
  // (and mislabeled) thread. step_id is deliberately excluded — it's unique
  // per row and would defeat grouping entirely.
  const candidates = [
    data.entity_id,
    data.entityId,
    data.target_id,
    data.targetId,
    data.thread_id,
    data.threadId,
    data.blueprint_id,
    data.blueprintId,
    notification.regattaId,
  ];
  const found = candidates.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
  return found ? String(found).trim() : '';
}

export const buildNotificationDedupeKey = (notification: SocialNotification): string => {
  const type = String(notification.type || '').trim();
  const orgId = getNotificationOrgId(notification);
  const actorId = String(notification.actorId || '').trim();
  const entityType = getNotificationEntityType(notification);
  const entityId = getNotificationEntityId(notification);
  return `${type}|${orgId}|${actorId}|${entityType}|${entityId}`;
};

export const groupNotifications = (
  rows: SocialNotification[],
  options?: { windowHours?: number }
): { groups: NotificationGroup[]; unreadCount: number } => {
  const windowHours = options?.windowHours ?? 24;
  const windowMs = windowHours * 60 * 60 * 1000;
  const sorted = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const groups: NotificationGroup[] = [];
  const keyToGroupIndexes = new Map<string, number[]>();

  sorted.forEach((notification) => {
    const dedupeKey = buildNotificationDedupeKey(notification);
    const createdMs = new Date(notification.createdAt).getTime();
    const candidateIndexes = keyToGroupIndexes.get(dedupeKey) || [];
    const targetIndex = candidateIndexes.find((index) => {
      const latestMs = new Date(groups[index].latestAt).getTime();
      return latestMs - createdMs <= windowMs;
    });

    if (targetIndex === undefined) {
      const nextIndex = groups.length;
      groups.push({
        key: dedupeKey,
        latest: notification,
        count: 1,
        ids: [notification.id],
        members: [notification],
        hasUnread: !notification.isRead,
        latestAt: notification.createdAt,
      });
      keyToGroupIndexes.set(dedupeKey, [...candidateIndexes, nextIndex]);
      return;
    }

    const group = groups[targetIndex];
    group.count += 1;
    group.ids.push(notification.id);
    group.members.push(notification);
    group.hasUnread = group.hasUnread || !notification.isRead;
  });

  return {
    groups,
    unreadCount: groups.filter((group) => group.hasUnread).length,
  };
};
