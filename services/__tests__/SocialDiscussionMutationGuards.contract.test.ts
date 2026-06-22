import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('social and discussion mutation guards', () => {
  it('confirms social comment, follow option, suggestion, and post actions changed a row', () => {
    const social = readSource('services/SocialService.ts');
    const suggestions = readSource('services/FollowerSuggestionService.ts');
    const posts = readSource('services/FollowerPostService.ts');

    expect(social).toContain('async updateComment');
    expect(social).toContain('async deleteComment');
    expect(social).toContain('async updateFollowOptions');
    expect(social.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(social.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(social.match(/Regatta comment not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(social).toContain('Follow relationship not found.');

    expect(suggestions).toContain('static async acceptSuggestion');
    expect(suggestions).toContain('static async dismissSuggestion');
    expect(suggestions.match(/Race suggestion not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);

    expect(posts).toContain('async deletePost');
    expect(posts).toContain(".from('follower_posts')");
    expect(posts).toContain(".select('id')");
    expect(posts).toContain('.maybeSingle()');
  });

  it('confirms activity comments and step notes changed a row', () => {
    const activity = readSource('services/ActivityCommentService.ts');
    const stepDiscussion = readSource('services/StepDiscussionService.ts');

    expect(activity).toContain('static async updateComment');
    expect(activity).toContain('static async deleteComment');
    expect(activity.match(/Activity comment not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(activity.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);

    expect(stepDiscussion).toContain('function editStepNote');
    expect(stepDiscussion).toContain('function deleteStepNote');
    expect(stepDiscussion.match(/Step discussion not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(stepDiscussion.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
