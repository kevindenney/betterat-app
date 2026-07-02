import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('transactional email branding contracts', () => {
  it('keeps shared transactional email senders and templates BetterAt-branded', () => {
    const emailService = readSource('services/EmailService.ts');
    const sendEmailFunction = readSource('supabase/functions/send-email/index.ts');
    const sailorOnboardingFunction = readSource('supabase/functions/send-sailor-onboarding-emails/index.ts');
    const stripeWebhookFunction = readSource('supabase/functions/stripe-webhooks/index.ts');

    expect(sendEmailFunction).toContain("Deno.env.get('FROM_EMAIL') || 'BetterAt <noreply@better.at>'");
    expect(sendEmailFunction).toContain('Handles transactional emails for BetterAt');

    expect(emailService).toContain("const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@better.at';");
    expect(emailService).toContain("const SENDGRID_FROM_NAME = 'BetterAt';");
    expect(emailService).toContain('https://better.at/races/entries/${data.entry_number}');
    expect(emailService).toContain('https://better.at/coaching/sessions');
    expect(emailService).toContain('https://better.at/coach/dashboard');
    expect(emailService).toContain('https://better.at/club/dashboard');
    expect(emailService).toContain('BetterAt - Your Complete Sailing Competition Platform');
    expect(emailService).toContain('BetterAt Coach Marketplace');
    expect(emailService).toContain('BetterAt Club Management');
    expect(emailService).toContain('BetterAt - Your Sailing Performance Platform');

    expect(sailorOnboardingFunction).toContain("Deno.env.get('FROM_EMAIL') || 'BetterAt <noreply@better.at>'");
    expect(sailorOnboardingFunction).toContain("Deno.env.get('APP_URL') || 'https://better.at'");
    expect(sailorOnboardingFunction).toContain('Welcome to BetterAt!');
    expect(sailorOnboardingFunction).toContain('finish setting up BetterAt');
    expect(sailorOnboardingFunction).toContain("payload.reply_to || 'info@better.at'");

    expect(stripeWebhookFunction).toContain('https://better.at/learn/${courseId}');
    expect(stripeWebhookFunction).toContain('Thank you for choosing BetterAt!');
    expect(stripeWebhookFunction).toContain("subject: 'Payment Failed - BetterAt Subscription'");
    expect(stripeWebhookFunction).toContain('your BetterAt subscription');
    expect(stripeWebhookFunction).toContain('https://better.at/settings/billing');

    for (const source of [emailService, sendEmailFunction, sailorOnboardingFunction, stripeWebhookFunction]) {
      expect(source).not.toContain('RegattaFlow');
      expect(source).not.toContain('regattaflow.com');
      expect(source).not.toContain('app.regattaflow.com');
      expect(source).not.toContain('support@regattaflow.com');
      expect(source).not.toContain('noreply@regattaflow.com');
    }
  });
});
