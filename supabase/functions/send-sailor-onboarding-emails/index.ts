/**
 * Supabase Edge Function: send-sailor-onboarding-emails
 * Processes pending email sequences and sends onboarding emails
 * Designed to run as a cron job every 5-15 minutes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Email provider configuration (using Resend as example)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'BetterAt <noreply@better.at>'
const APP_URL = Deno.env.get('APP_URL') || 'https://better.at'

interface EmailSequence {
  id: string
  user_id: string
  email_type: string
  metadata: Record<string, any>
  persona: 'sailor' | 'coach' | 'club'
  user_email: string
  user_name: string
  subscription_tier: string
  subscription_status: string
  onboarding_completed: boolean
  last_active_at: string | null
}

interface EmailPayload {
  from: string
  to: string
  subject: string
  html: string
  text: string
  reply_to?: string
}

// Email template generator - handles all personas
function generateEmailContent(
  emailType: string,
  persona: 'sailor' | 'coach' | 'club',
  data: {
    userName: string
    userEmail: string
    subscriptionTier: string
    appUrl: string
    dashboardUrl: string
    upgradeUrl: string
  }
): { subject: string; html: string; text: string } {
  const firstName = data.userName.split(' ')[0] || getPersonaGreeting(persona)

  // Generate persona-specific welcome email
  if (emailType === 'welcome') {
    return generateWelcomeEmail(firstName, persona, data)
  }

  // Generate persona-specific quick start email
  if (emailType === 'quick_start') {
    return generateQuickStartEmail(firstName, persona, data)
  }

  // Generate persona-specific feature tip email
  if (emailType === 'feature_tip') {
    return generateFeatureTipEmail(firstName, persona, data)
  }

  // Trial reminder emails (shared across personas)
  switch (emailType) {
    case 'trial_reminder_5':
    case 'trial_reminder_2':
      const daysLeft = emailType === 'trial_reminder_5' ? 5 : 2
      return generateTrialReminderEmail(firstName, daysLeft, data)

    case 'trial_ending':
      return generateTrialEndingEmail(firstName, data)

    case 'trial_ended':
      return generateTrialEndedEmail(firstName, data)

    case 're_engagement':
      return generateReEngagementEmail(firstName, persona, data)

    default:
      return {
        subject: `BetterAt Update`,
        html: `<p>Hi ${firstName}, check out what's new in BetterAt!</p>`,
        text: `Hi ${firstName}, check out what's new in BetterAt!`,
      }
  }
}

function getPersonaGreeting(persona: string): string {
  switch (persona) {
    case 'coach': return 'Coach'
    case 'club': return 'there'
    default: return 'Sailor'
  }
}

function generateWelcomeEmail(firstName: string, persona: string, data: any) {
  const configs: Record<string, { emoji: string; tagline: string; steps: string[]; gradient: string }> = {
    sailor: {
      emoji: '⛵',
      tagline: 'the AI-powered platform built by sailors, for sailors',
      steps: ['Set your home sailing venue', 'Add your boat details', 'Join your first race'],
      gradient: 'linear-gradient(135deg, #0ea5e9, #0369a1)'
    },
    coach: {
      emoji: '🎯',
      tagline: 'the AI-powered coaching platform to elevate your athletes',
      steps: ['Set up your coaching profile', 'Add your first athlete', 'Schedule a coaching session'],
      gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
    },
    club: {
      emoji: '🏠',
      tagline: 'the complete platform for yacht club management',
      steps: ['Configure your club settings', 'Create your first regatta', 'Invite your members'],
      gradient: 'linear-gradient(135deg, #10b981, #059669)'
    }
  }

  const config = configs[persona] || configs.sailor

  return {
    subject: `${config.emoji} Welcome aboard, ${firstName}!`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${config.gradient}; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to BetterAt!</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hi ${firstName}! 👋</p>
          <p>Welcome to BetterAt — ${config.tagline}.</p>
          <h3>🎯 Get started in 2 minutes:</h3>
          <ol>
            ${config.steps.map(step => `<li>${step}</li>`).join('\n            ')}
          </ol>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.dashboardUrl}" style="background: #0ea5e9; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Get Started →</a>
          </div>
          <p style="background: #fef3c7; padding: 12px; border-radius: 8px; color: #92400e;">
            <strong>🎁 You have 7 days of full access</strong> — explore all premium features!
          </p>
        </div>
      </div>
    `,
    text: `Welcome to BetterAt, ${firstName}!\n\n${config.tagline}\n\nGet started:\n${config.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nVisit: ${data.dashboardUrl}`,
  }
}

function generateQuickStartEmail(firstName: string, persona: string, data: any) {
  const configs: Record<string, { features: string[]; gradient: string }> = {
    sailor: {
      features: ['AI-powered race strategy analysis', 'Local venue intelligence & conditions', 'Weather integration for your location', 'Equipment optimization tips'],
      gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
    },
    coach: {
      features: ['Athlete performance tracking', 'Session planning tools', 'Video analysis integration', 'Progress reports for athletes'],
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)'
    },
    club: {
      features: ['Regatta management dashboard', 'Member communication tools', 'Race result publishing', 'Online registration system'],
      gradient: 'linear-gradient(135deg, #10b981, #059669)'
    }
  }

  const config = configs[persona] || configs.sailor

  return {
    subject: `⏰ ${firstName}, finish setting up BetterAt`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${config.gradient}; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Quick Start Guide</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hi ${firstName},</p>
          <p>We noticed you started setting up BetterAt but haven't finished yet. Let's get you ready!</p>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #8b5cf6;">
            <h3 style="color: #6d28d9; margin: 0 0 12px 0;">🚀 What you're missing:</h3>
            <ul style="color: #475569; margin: 0; padding-left: 20px; line-height: 1.8;">
              ${config.features.map(f => `<li>${f}</li>`).join('\n              ')}
            </ul>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.dashboardUrl}" style="background: #8b5cf6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Continue Setup</a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nFinish setting up BetterAt to access:\n${config.features.map(f => `- ${f}`).join('\n')}\n\nContinue: ${data.dashboardUrl}`,
  }
}

function generateFeatureTipEmail(firstName: string, persona: string, data: any) {
  const configs: Record<string, { title: string; description: string; features: string[]; cta: string; ctaUrl: string; gradient: string }> = {
    sailor: {
      title: '🤖 AI Race Analysis',
      description: 'Upload your race documents (NOR, Sailing Instructions) and get:',
      features: ['Strategic recommendations based on course layout', 'Key rule interpretations', 'Weather-integrated tactical suggestions', 'Mark rounding priorities'],
      cta: 'Try AI Analysis →',
      ctaUrl: `${data.appUrl}/add-race`,
      gradient: 'linear-gradient(135deg, #10b981, #059669)'
    },
    coach: {
      title: '📊 Athlete Performance Dashboard',
      description: 'Track your athletes\' progress with:',
      features: ['Race-by-race performance trends', 'Skill development tracking', 'Session notes and feedback', 'Comparative analysis'],
      cta: 'View Dashboard →',
      ctaUrl: `${data.appUrl}/athletes`,
      gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
    },
    club: {
      title: '📋 Regatta Management',
      description: 'Streamline your events with:',
      features: ['Online registration system', 'Automated document distribution', 'Real-time results publishing', 'Member communications'],
      cta: 'Create Regatta →',
      ctaUrl: `${data.appUrl}/regattas/new`,
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)'
    }
  }

  const config = configs[persona] || configs.sailor

  return {
    subject: `💡 Pro tip: ${config.title.replace(/[🤖📊📋]/g, '').trim()}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${config.gradient}; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Feature Spotlight</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hi ${firstName},</p>
          <p>Here's a feature you might have missed:</p>
          <div style="background: #ecfdf5; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <h2 style="color: #059669; margin: 0 0 12px 0;">${config.title}</h2>
            <p style="color: #065f46; margin: 0 0 16px 0;">${config.description}</p>
            <ul style="color: #065f46; margin: 0; padding-left: 20px; line-height: 1.8;">
              ${config.features.map(f => `<li>${f}</li>`).join('\n              ')}
            </ul>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${config.ctaUrl}" style="background: #10b981; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">${config.cta}</a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\n${config.title}\n\n${config.description}\n${config.features.map(f => `- ${f}`).join('\n')}\n\nTry it: ${config.ctaUrl}`,
  }
}

function generateTrialReminderEmail(firstName: string, daysLeft: number, data: any) {
  return {
    subject: `📅 ${firstName}, ${daysLeft} days left in your trial`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">${daysLeft} Days Left</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hi ${firstName},</p>
          <p>Your premium trial ends in <strong>${daysLeft} days</strong>. Keep all your features for just $9.99/month.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.upgradeUrl}" style="background: #f59e0b; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Upgrade Now</a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nYour trial ends in ${daysLeft} days. Upgrade to keep all features: ${data.upgradeUrl}`,
  }
}

function generateTrialEndingEmail(firstName: string, data: any) {
  return {
    subject: `⚡ ${firstName}, your trial ends TODAY`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Trial Ends Today</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hi ${firstName},</p>
          <p>Your premium trial ends <strong>today</strong>. Don't lose access!</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.upgradeUrl}" style="background: #ef4444; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 18px;">Upgrade Now — $9.99/mo</a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nYour trial ends TODAY. Upgrade now: ${data.upgradeUrl}`,
  }
}

function generateTrialEndedEmail(firstName: string, data: any) {
  return {
    subject: `📦 ${firstName}, you're now on the Free plan`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6b7280, #4b5563); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to Free</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hi ${firstName},</p>
          <p>Your trial has ended. You're on our Free plan with limited features.</p>
          <p>Ready to upgrade? All your data is safe and waiting.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.upgradeUrl}" style="background: #3b82f6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Upgrade to Pro</a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nYour trial has ended. Upgrade anytime: ${data.upgradeUrl}`,
  }
}

function generateReEngagementEmail(firstName: string, persona: string, data: any) {
  const messages: Record<string, string> = {
    sailor: 'Racing season is always around the corner — are you ready for your next regatta?',
    coach: 'Your athletes are waiting! Ready to plan your next coaching session?',
    club: 'Your members are counting on you! Ready to organize your next event?'
  }

  return {
    subject: `🌊 ${firstName}, we miss you!`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Time to Get Back?</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hi ${firstName},</p>
          <p>It's been a while since you've used BetterAt. ${messages[persona] || messages.sailor}</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.dashboardUrl}" style="background: #3b82f6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Get Back to It</a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nIt's been a while! ${messages[persona] || messages.sailor}\n\nGet back to it: ${data.dashboardUrl}`,
  }
}

// Check if email should be sent based on conditions
function shouldSendEmail(email: EmailSequence): boolean {
  const conditions = email.metadata?.condition
  
  if (!conditions) return true
  
  switch (conditions) {
    case 'onboarding_incomplete':
      return !email.onboarding_completed
      
    case 'is_trialing':
      return email.subscription_status === 'trialing'
      
    case 'trial_ended_not_converted':
      return email.subscription_status !== 'active' && email.subscription_tier === 'free'
      
    case 'inactive_7_days':
      if (!email.last_active_at) return true
      const lastActive = new Date(email.last_active_at)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return lastActive < sevenDaysAgo
      
    default:
      return true
  }
}

// Send email via Resend
async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return false
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.reply_to || 'info@better.at',
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('Resend API error:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

serve(async (req) => {
  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get pending emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .rpc('get_pending_emails_to_send')
    
    if (fetchError) {
      console.error('Error fetching pending emails:', fetchError)
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending emails', processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    let skipped = 0
    let failed = 0
    
    for (const email of pendingEmails as EmailSequence[]) {
      // Check conditions
      if (!shouldSendEmail(email)) {
        // Cancel this email since conditions aren't met
        await supabase.rpc('mark_email_failed', {
          p_email_id: email.id,
          p_error: 'Conditions not met',
        })
        skipped++
        continue
      }
      
      // Generate email content (use persona, default to 'sailor' for backwards compatibility)
      const content = generateEmailContent(email.email_type, email.persona || 'sailor', {
        userName: email.user_name,
        userEmail: email.user_email,
        subscriptionTier: email.subscription_tier,
        appUrl: APP_URL,
        dashboardUrl: `${APP_URL}/dashboard`,
        upgradeUrl: `${APP_URL}/subscription`,
      })
      
      // Send email
      const success = await sendEmail({
        from: FROM_EMAIL,
        to: email.user_email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      })
      
      if (success) {
        await supabase.rpc('mark_email_sent', { p_email_id: email.id })
        sent++
      } else {
        await supabase.rpc('mark_email_failed', {
          p_email_id: email.id,
          p_error: 'Send failed',
        })
        failed++
      }
    }
    
    return new Response(
      JSON.stringify({
        message: 'Email processing complete',
        processed: pendingEmails.length,
        sent,
        skipped,
        failed,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

