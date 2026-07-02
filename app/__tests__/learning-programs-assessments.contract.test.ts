import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('learning, programs, and assessments workflow contracts', () => {
  it('keeps the programs hub split between institution programs and sailing race workflows', () => {
    const source = read('app/(tabs)/programs-experience.tsx');

    expect(source).toContain('const isRaceWorkspace =');
    expect(source).toContain('const isInstitutionWorkspace =');
    expect(source).toContain('const allowRaceWorkflows = isRaceWorkspace');
    expect(source).toContain('programService.listPrograms');
    expect(source).toContain('programService.listOrganizationProgramSessions');
    expect(source).toContain('programService.getProgramParticipantCounts');
    expect(source).toContain('programService.getOrganizationAssessmentSummary');
    expect(source).toContain('buildProgramAssessmentHref');
    expect(source).toContain('buildProgramCommunicationsHref');
    expect(source).toContain('getProgramUnreadCount');
  });

  it('creates institution programs with templates, optional first sessions, and canonical return routing', () => {
    const source = read('app/programs/create.tsx');

    expect(source).toContain('Programs require an institution organization');
    expect(source).toContain("activeDomain === 'sailing' ? 'generic' : activeDomain");
    expect(source).toContain("programService.listProgramTemplates(activeOrganization.id, domain, 'program', 50)");
    expect(source).toContain("programService.listProgramTemplates(activeOrganization.id, domain, 'session', 50)");
    expect(source).toContain('programService.createProgram');
    expect(source).toContain('programService.createProgramSession');
    expect(source).toContain("pathname: '/(tabs)/programs'");
    expect(source).toContain("action: 'created'");
    expect(source).toContain("Platform.OS === 'ios' ? 'padding' : undefined");
  });

  it('supports participant assignment, invite handoff, CSV export, and mutation return context', () => {
    const source = read('app/programs/assign.tsx');

    expect(source).toContain('Assignments require an institution organization');
    expect(source).toContain('organizationInviteRolePresetService.listPresets');
    expect(source).toContain('/settings/organization-access');
    expect(source).toContain('&autoInvite=1');
    expect(source).toContain('programService.createProgramParticipant');
    expect(source).toContain('programService.updateProgramParticipant');
    expect(source).toContain('programService.removeProgramParticipant');
    expect(source).toContain('buildProgramAssignmentsCsv');
    expect(source).toContain("Platform.OS === 'web'");
    expect(source).toContain('CSV export is currently available on web.');
    expect(source).toContain("pathname: '/(tabs)/programs'");
    expect(source).toContain('selectedProgramId');
  });

  it('persists session-builder planning fields into session metadata', () => {
    const source = read('app/programs/session-builder.tsx');

    expect(source).toContain('metadata.session_builder');
    expect(source).toContain('objectives');
    expect(source).toContain('checklist');
    expect(source).toContain('quick_notes');
    expect(source).toContain('attendance: attendanceByParticipantId');
    expect(source).toContain('programService.updateProgramSession(selectedSession.id');
  });

  it('loads assessment drilldowns, filters, templates, and create payload metadata', () => {
    const source = read('app/assessments.tsx');

    expect(source).toContain('parseAssessmentRouteState');
    expect(source).toContain('buildAssessmentQueryFilters');
    expect(source).toContain('buildClearDrillDownHref');
    expect(source).toContain('programService.getOrganizationAssessmentSummary');
    expect(source).toContain('programService.listOrganizationAssessmentRecords');
    expect(source).toContain("programService.listProgramTemplates(activeOrganization.id, activeDomain, 'assessment', 100)");
    expect(source).toContain('programService.listOrganizationProgramParticipantsByIds');
    expect(source).toContain('applyAssessmentTemplate');
    expect(source).toContain('programService.createAssessmentRecord');
    expect(source).toContain("{ template_id: selectedTemplateId }");
    expect(source).toContain("{ action_plan: newActionPlan.trim() }");
    expect(source).toContain("{ next_check_in_at: newNextCheckInAt.trim() }");
  });

  it('keeps library resource management searchable, groupable, editable, and course-to-timeline capable', () => {
    const managerSource = read('components/library-resources/LibraryManager.tsx');
    const timelineSource = read('components/library-resources/CourseToTimelineSheet.tsx');

    expect(managerSource).toContain('useLibraryResources');
    expect(managerSource).toContain('searchQuery.trim().toLowerCase()');
    expect(managerSource).toContain("const [groupMode, setGroupMode] = useState<GroupMode>('type')");
    expect(managerSource).toContain("groupMode === 'creator'");
    expect(managerSource).toContain('{(items as LibraryResourceRecord[]).length}');
    expect(managerSource).toContain('<AddResourceSheet');
    expect(managerSource).toContain('<EditResourceSheet');
    expect(managerSource).toContain('<CourseToTimelineSheet');
    expect(managerSource).toContain("resource.resource_type === 'online_course'");

    expect(timelineSource).toContain('getCourseMetadata(resource)');
    expect(timelineSource).toContain('getAllLessons(course_structure)');
    expect(timelineSource).toContain('useCreateStepsFromCourse');
    expect(timelineSource).toContain('selectedIds.size === 0');
    expect(timelineSource).toContain('spacingDays: parseInt(spacingDays, 10) || 0');
    expect(timelineSource).toContain("Platform.OS === 'ios' ? 'padding' : undefined");
  });

  it('keeps lesson playback access, progress, completion, and platform navigation behavior explicit', () => {
    const source = read('app/(tabs)/learn/[courseId]/player.tsx');

    expect(source).toContain('getCourseWithLessons(courseId)');
    expect(source).toContain('upsertLessonProgress(user.id, lessonId,');
    expect(source).toContain('CourseCatalogService.getCourseBySlug(courseId)');
    expect(source).toContain('LearningService.isEnrolled');
    expect(source).toContain('LearningService.checkSubscriptionAccess');
    expect(source).toContain('foundLesson.is_free_preview');
    expect(source).toContain('isCatalogOnlyCourse');
    expect(source).toContain('LessonProgressService.markLessonStarted');
    expect(source).toContain('LessonProgressService.markLessonCompleted');
    expect(source).toContain('LessonProgressService.recordInteraction');
    expect(source).toContain("if (Platform.OS === 'web')");
    expect(source).toContain('showAlertWithButtons');
    expect(source).toContain('<BetterAtLessonPlayer');
    expect(source).toContain('<LessonPlayer');
  });

  it('keeps competency self-assessment and faculty attestation payloads tied to selected competency evidence', () => {
    const selfAssessmentSource = read('app/self-assessment.tsx');
    const flowSource = read('components/competency/SelfAssessmentFlow.tsx');
    const facultySource = read('components/competency/FacultyAttestSheet.tsx');
    const serviceSource = read('services/competencyService.ts');

    expect(selfAssessmentSource).toContain('useLocalSearchParams');
    expect(selfAssessmentSource).toContain('competencyId');
    expect(selfAssessmentSource).toContain('setShowFlow(true)');
    expect(selfAssessmentSource).toContain('logNewAttempt(payload)');
    expect(selfAssessmentSource).toContain('router.back()');

    expect(flowSource).toContain('competency_id: competency.id');
    expect(flowSource).toContain("{ event_id: eventId }");
    expect(flowSource).toContain("{ clinical_context: clinicalContext.trim() }");
    expect(flowSource).toContain("{ self_notes: selfNotes.trim() }");
    expect(flowSource).toContain("{ preceptor_id: preceptorId.trim() }");
    expect(flowSource).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");

    expect(facultySource).toContain('useUserOrgCompetencies');
    expect(facultySource).toContain('useRecordCompetencyEvidence(stepId)');
    expect(facultySource).toContain('orgCompetencyId: selectedId');
    expect(facultySource).toContain("notes: notes.trim() ? notes.trim() : undefined");

    expect(serviceSource).toContain('export async function logAttempt');
    expect(serviceSource).toContain('betterat_competency_attempts');
    expect(serviceSource).toContain('export async function submitPreceptorValidation');
    expect(serviceSource).toContain('export async function submitFacultyReview');
  });
});
