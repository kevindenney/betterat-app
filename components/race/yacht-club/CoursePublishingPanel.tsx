import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { OfficialRaceCourse } from './YachtClubRaceBuilder';

interface CoursePublishingPanelProps {
  courses: OfficialRaceCourse[];
  onCoursePublish: (course: OfficialRaceCourse) => void;
  onCourseUpdate: (course: OfficialRaceCourse) => void;
}

interface PublicationTarget {
  id: string;
  name: string;
  type: 'club_members' | 'class_fleet' | 'open_entry' | 'invitation_only';
  status: 'pending' | 'published' | 'distributed' | 'failed';
  recipients: number;
  lastUpdated?: Date;
}

interface DistributionChannel {
  id: string;
  name: string;
  type: 'email' | 'app_notification' | 'website' | 'social_media' | 'external_api';
  enabled: boolean;
  deliveryRate: number;
}

export function CoursePublishingPanel({
  courses,
  onCoursePublish,
  onCourseUpdate
}: CoursePublishingPanelProps) {
  const [publishingTargets] = useState<PublicationTarget[]>([
    {
      id: 'club_members',
      name: 'Royal Hong Kong Yacht Club Members',
      type: 'club_members',
      status: 'pending',
      recipients: 1247
    },
    {
      id: 'dragon_fleet',
      name: 'Dragon Class Fleet',
      type: 'class_fleet',
      status: 'pending',
      recipients: 84
    },
    {
      id: 'open_entry',
      name: 'Open Entry (BetterAt Network)',
      type: 'open_entry',
      status: 'pending',
      recipients: 3421
    }
  ]);

  const [distributionChannels] = useState<DistributionChannel[]>([
    {
      id: 'email',
      name: 'Email Notifications',
      type: 'email',
      enabled: true,
      deliveryRate: 97.3
    },
    {
      id: 'app_push',
      name: 'App Push Notifications',
      type: 'app_notification',
      enabled: true,
      deliveryRate: 89.1
    },
    {
      id: 'club_website',
      name: 'Club Website Integration',
      type: 'website',
      enabled: true,
      deliveryRate: 100
    },
    {
      id: 'sailwave',
      name: 'SailWave Integration',
      type: 'external_api',
      enabled: false,
      deliveryRate: 95.8
    }
  ]);

  const draftCourses = courses.filter(c => c.status === 'draft');
  const publishedCourses = courses.filter(c => c.status === 'published');
  const activeCourses = courses.filter(c => c.status === 'active');

  const handlePublishCourse = (course: OfficialRaceCourse) => {
    if (!course.validationStatus.isValid) {
      showAlert(
        'Cannot Publish Course',
        `Course has ${course.validationStatus.errors.length} validation errors that must be resolved first.`
      );
      return;
    }

    showConfirm(
      'Publish Course',
      `Are you ready to publish "${course.name}"? This will distribute the course to all selected channels.`,
      () => onCoursePublish(course)
    );
  };

  const handleAmendCourse = (course: OfficialRaceCourse) => {
    showConfirm(
      'Amend Published Course',
      'Changes to published courses will immediately notify all participants. Continue?',
      () => {
        const amendedCourse: OfficialRaceCourse = {
          ...course,
          status: course.status === 'active' ? 'active' : 'published',
          publishedAt: new Date(),
        };
        onCourseUpdate(amendedCourse);
        showAlert('Amendment Sent', 'Course amendment distributed to all participants.');
      }
    );
  };

  const getStatusIcon = (status: OfficialRaceCourse['status']) => {
    switch (status) {
      case 'draft': return '📝';
      case 'published': return '📡';
      case 'active': return '🏁';
      case 'completed': return '✅';
      default: return '📋';
    }
  };

  const getStatusColor = (status: OfficialRaceCourse['status']) => {
    switch (status) {
      case 'draft': return '#6B7280';
      case 'published': return '#3B82F6';
      case 'active': return '#10B981';
      case 'completed': return '#059669';
      default: return '#6B7280';
    }
  };

  const renderCourseCard = (course: OfficialRaceCourse) => (
    <View key={course.id} style={styles.courseCard}>
      <View style={styles.courseHeader}>
        <View style={styles.courseInfo}>
          <ThemedText type="defaultSemiBold" style={styles.courseName}>
            {getStatusIcon(course.status)} {course.name}
          </ThemedText>
          <ThemedText style={[styles.courseStatus, { color: getStatusColor(course.status) }]}>
            {course.status.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText style={styles.courseType}>
          {course.type} • {course.marks.length} marks
        </ThemedText>
      </View>

      <View style={styles.courseDetails}>
        <View style={styles.courseMetric}>
          <ThemedText style={styles.metricLabel}>Venue:</ThemedText>
          <ThemedText style={styles.metricValue}>{course.venue}</ThemedText>
        </View>

        <View style={styles.courseMetric}>
          <ThemedText style={styles.metricLabel}>Validation:</ThemedText>
          <ThemedText style={[
            styles.metricValue,
            { color: course.validationStatus.isValid ? '#10B981' : '#EF4444' }
          ]}>
            {course.validationStatus.isValid ? '✅ Valid' : `❌ ${course.validationStatus.errors.length} errors`}
          </ThemedText>
        </View>

        {course.publishedAt && (
          <View style={styles.courseMetric}>
            <ThemedText style={styles.metricLabel}>Published:</ThemedText>
            <ThemedText style={styles.metricValue}>
              {course.publishedAt.toLocaleDateString()}
            </ThemedText>
          </View>
        )}

        {course.participants && (
          <View style={styles.courseMetric}>
            <ThemedText style={styles.metricLabel}>Participants:</ThemedText>
            <ThemedText style={styles.metricValue}>{course.participants} boats</ThemedText>
          </View>
        )}
      </View>

      <View style={styles.courseActions}>
        {course.status === 'draft' && (
          <>
            <Button
              variant={course.validationStatus.isValid ? "default" : "outline"}
              onPress={() => course.validationStatus.isValid ? handlePublishCourse(course) : null}
              style={[
                styles.actionButton,
                !course.validationStatus.isValid && styles.disabledButton
              ]}
              disabled={!course.validationStatus.isValid}
            >
              <ThemedText style={[
                styles.actionButtonText,
                !course.validationStatus.isValid && styles.disabledButtonText
              ]}>
                📡 Publish Course
              </ThemedText>
            </Button>
            <Button
              variant="outline"
              onPress={() => onCourseUpdate(course)}
              style={styles.actionButton}
            >
              <ThemedText style={styles.outlineButtonText}>✏️ Edit</ThemedText>
            </Button>
          </>
        )}

        {(course.status === 'published' || course.status === 'active') && (
          <>
            <Button
              variant="outline"
              onPress={() => handleAmendCourse(course)}
              style={styles.actionButton}
            >
              <ThemedText style={styles.outlineButtonText}>📝 Amend</ThemedText>
            </Button>
            <Button
              variant="outline"
              onPress={() => onCourseUpdate(course)}
              style={styles.actionButton}
            >
              <ThemedText style={styles.outlineButtonText}>👁️ View</ThemedText>
            </Button>
          </>
        )}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText type="title">📡 Course Publishing</ThemedText>
          <ThemedText type="subtitle">
            Distribute race courses to sailors and officials
          </ThemedText>
        </View>

        {/* Publication Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <ThemedText style={styles.statValue}>{draftCourses.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Draft</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={styles.statValue}>{publishedCourses.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Published</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={styles.statValue}>{activeCourses.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Active</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Distribution Channels Status */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            📤 Distribution Channels
          </ThemedText>
          <View style={styles.channelsContainer}>
            {distributionChannels.map((channel) => (
              <View key={channel.id} style={styles.channelCard}>
                <View style={styles.channelInfo}>
                  <ThemedText style={styles.channelName}>{channel.name}</ThemedText>
                  <ThemedText style={[
                    styles.channelStatus,
                    { color: channel.enabled ? '#10B981' : '#6B7280' }
                  ]}>
                    {channel.enabled ? '✅ Active' : '⏸️ Disabled'}
                  </ThemedText>
                </View>
                <ThemedText style={styles.deliveryRate}>
                  {channel.deliveryRate}% delivery rate
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {/* Draft Courses */}
        {draftCourses.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              📝 Draft Courses ({draftCourses.length})
            </ThemedText>
            <ThemedText style={styles.sectionSubtext}>
              Ready to publish courses to participants
            </ThemedText>
            {draftCourses.map(renderCourseCard)}
          </View>
        )}

        {/* Published Courses */}
        {publishedCourses.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              📡 Published Courses ({publishedCourses.length})
            </ThemedText>
            <ThemedText style={styles.sectionSubtext}>
              Distributed to participants, ready for racing
            </ThemedText>
            {publishedCourses.map(renderCourseCard)}
          </View>
        )}

        {/* Active Courses */}
        {activeCourses.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              🏁 Active Courses ({activeCourses.length})
            </ThemedText>
            <ThemedText style={styles.sectionSubtext}>
              Currently racing or scheduled
            </ThemedText>
            {activeCourses.map(renderCourseCard)}
          </View>
        )}

        {/* Publication Targets */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            🎯 Publication Targets
          </ThemedText>
          <ThemedText style={styles.sectionSubtext}>
            Configure who receives course publications
          </ThemedText>

          {publishingTargets.map((target) => (
            <View key={target.id} style={styles.targetCard}>
              <View style={styles.targetHeader}>
                <View style={styles.targetInfo}>
                  <ThemedText style={styles.targetName}>{target.name}</ThemedText>
                  <ThemedText style={styles.targetType}>{target.type.replace('_', ' ')}</ThemedText>
                </View>
                <ThemedText style={styles.targetRecipients}>
                  {target.recipients.toLocaleString()} recipients
                </ThemedText>
              </View>

              <View style={styles.targetActions}>
                <Button variant="outline" style={styles.targetButton}>
                  <ThemedText style={styles.outlineButtonText}>⚙️ Configure</ThemedText>
                </Button>
                <Button variant="outline" style={styles.targetButton}>
                  <ThemedText style={styles.outlineButtonText}>📊 Analytics</ThemedText>
                </Button>
              </View>
            </View>
          ))}
        </View>

        {/* Empty State */}
        {courses.length === 0 && (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyStateTitle}>
              📡 No Courses to Publish
            </ThemedText>
            <ThemedText style={styles.emptyStateSubtext}>
              Create race courses in the Course Design tab to get started with publishing.
            </ThemedText>
            <Button variant="outline" style={styles.emptyStateButton}>
              <ThemedText style={styles.outlineButtonText}>🎨 Create Course</ThemedText>
            </Button>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    gap: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  courseCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    boxShadow: '0px 1px',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    marginBottom: 4,
  },
  courseStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  courseType: {
    fontSize: 12,
    color: '#6B7280',
  },
  courseDetails: {
    marginBottom: 16,
  },
  courseMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  courseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  outlineButtonText: {
    color: '#0066CC',
    fontSize: 12,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  channelsContainer: {
    gap: 8,
  },
  channelCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  channelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  channelName: {
    fontWeight: '600',
  },
  channelStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  deliveryRate: {
    fontSize: 12,
    color: '#6B7280',
  },
  targetCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  targetInfo: {
    flex: 1,
  },
  targetName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  targetType: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  targetRecipients: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0066CC',
  },
  targetActions: {
    flexDirection: 'row',
    gap: 8,
  },
  targetButton: {
    flex: 1,
    paddingVertical: 6,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyStateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});
