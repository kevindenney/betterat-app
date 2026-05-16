import fs from 'fs';
import path from 'path';

const draftSource = fs.readFileSync(
  path.join(__dirname, '..', 'PlanDraftPreviewCard.tsx'),
  'utf8',
);
const interiorSource = fs.readFileSync(
  path.join(__dirname, '..', 'PlanTabInterior.tsx'),
  'utf8',
);
const conversationalSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'ConversationalCapture.tsx'),
  'utf8',
);

describe('AI Coach conversational flow · canonical contract', () => {
  it('draft preview card exposes the canonical accept / refine actions', () => {
    expect(draftSource).toContain('Accept &amp; add to plan');
    expect(draftSource).toContain('Keep refining');
    expect(draftSource).toContain('DRAFT');
  });

  it('conversational capture surfaces the Frame 2 context strip', () => {
    expect(conversationalSource).toContain('Refining the plan for');
    // Draft my plan replaces the legacy "Create Step from Conversation" button.
    expect(conversationalSource).toContain('Draft my plan');
    expect(conversationalSource).not.toContain('Create Step from Conversation');
    // Frame 3 wires the draft preview component into the conversation.
    expect(conversationalSource).toContain('PlanDraftPreviewCard');
  });

  it('PlanTabInterior wires the Frame 4 success toast', () => {
    expect(interiorSource).toContain('Plan drafted with AI Coach');
    expect(interiorSource).toContain('refine anytime');
    // Frame 2 modal header carries the Plan-context subtitle.
    expect(interiorSource).toContain('coachSubtitle');
  });
});
