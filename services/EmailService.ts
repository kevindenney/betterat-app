/**
 * Email Service
 * Handles transactional email sending via SendGrid
 * Includes templates for race registrations, coach bookings, reminders, and notifications
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

// SendGrid configuration

const logger = createLogger('EmailService');
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@regattaflow.com';
const SENDGRID_FROM_NAME = 'RegattaFlow';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface RaceEntryConfirmationData {
  sailor_name: string;
  sailor_email: string;
  regatta_name: string;
  entry_number: string;
  boat_name: string;
  sail_number: string;
  entry_class: string;
  start_date: string;
  venue_name: string;
  entry_fee_amount: number;
  entry_fee_currency: string;
  payment_status: string;
  crew_members: { name: string; role: string }[];
  documents_complete: boolean;
}

export interface CoachBookingConfirmationData {
  sailor_name: string;
  sailor_email: string;
  coach_name: string;
  coach_email: string;
  session_type: string;
  scheduled_date: string;
  duration_minutes: number;
  location: string;
  fee_amount: number;
  currency: string;
  calendar_attachment?: string; // .ics file content
}

export interface RaceReminderData {
  sailor_name: string;
  sailor_email: string;
  regatta_name: string;
  start_date: string;
  venue_name: string;
  entry_number: string;
  weather_forecast?: {
    wind_speed: number;
    wind_direction: string;
    conditions: string;
  };
  course_info?: string;
}

export interface CoachNotificationData {
  coach_name: string;
  coach_email: string;
  notification_type: 'new_booking' | 'cancellation' | 'payment_received' | 'analysis_shared';
  sailor_name?: string;
  session_date?: string;
  amount?: number;
  currency?: string;
  message?: string;
  race_name?: string;
  regatta_name?: string;
  analysis_summary?: string;
  highlights?: string[];
  analysis_url?: string;
}

export interface ClubNotificationData {
  club_name: string;
  club_email: string;
  notification_type: 'new_registration' | 'payment_received' | 'member_joined';
  sailor_name?: string;
  regatta_name?: string;
  entry_number?: string;
  amount?: number;
  currency?: string;
  member_details?: {
    name: string;
    email: string;
    boat_class?: string;
  };
}

export class EmailService {
  /**
   * Send email via SendGrid
   */
  private async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments?: { content: string; filename: string; type: string }[];
    emailType: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // SendGrid API integration
      if (SENDGRID_API_KEY) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: params.to }],
            }],
            from: {
              email: SENDGRID_FROM_EMAIL,
              name: SENDGRID_FROM_NAME,
            },
            subject: params.subject,
            content: [
              { type: 'text/plain', value: params.text },
              { type: 'text/html', value: params.html },
            ],
            attachments: params.attachments,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`SendGrid error: ${JSON.stringify(errorData)}`);
        }
      } else {
        logger.debug('SendGrid not configured. Email would be sent:', params);
      }

      // Log email in database
      await supabase.from('email_logs').insert({
        to_email: params.to,
        subject: params.subject,
        html_body: params.html,
        text_body: params.text,
        email_type: params.emailType,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to send ${params.emailType} email:`, error);

      // Log failed email
      await supabase.from('email_logs').insert({
        to_email: params.to,
        subject: params.subject,
        html_body: params.html,
        text_body: params.text,
        email_type: params.emailType,
        status: 'failed',
        error_message: error.message,
        sent_at: new Date().toISOString(),
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send race entry confirmation email
   */
  async sendRaceEntryConfirmation(
    data: RaceEntryConfirmationData
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.buildConfirmationEmail(data);
    return this.sendEmail({
      to: data.sailor_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      emailType: 'race_entry_confirmation',
    });
  }

  /**
   * Send coach booking confirmation to sailor
   */
  async sendCoachBookingConfirmationToSailor(
    data: CoachBookingConfirmationData
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.buildCoachBookingConfirmation(data, 'sailor');
    const attachments = data.calendar_attachment ? [{
      content: Buffer.from(data.calendar_attachment).toString('base64'),
      filename: 'session.ics',
      type: 'text/calendar',
    }] : undefined;

    return this.sendEmail({
      to: data.sailor_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments,
      emailType: 'coach_booking_confirmation_sailor',
    });
  }

  /**
   * Send coach booking confirmation to coach
   */
  async sendCoachBookingConfirmationToCoach(
    data: CoachBookingConfirmationData
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.buildCoachBookingConfirmation(data, 'coach');
    const attachments = data.calendar_attachment ? [{
      content: Buffer.from(data.calendar_attachment).toString('base64'),
      filename: 'session.ics',
      type: 'text/calendar',
    }] : undefined;

    return this.sendEmail({
      to: data.coach_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments,
      emailType: 'coach_booking_confirmation_coach',
    });
  }

  /**
   * Send race reminder (24 hours before)
   */
  async sendRaceReminder(
    data: RaceReminderData
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.buildRaceReminder(data);
    return this.sendEmail({
      to: data.sailor_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      emailType: 'race_reminder',
    });
  }

  /**
   * Send coach notification
   */
  async sendCoachNotification(
    data: CoachNotificationData
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.buildCoachNotification(data);
    return this.sendEmail({
      to: data.coach_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      emailType: `coach_notification_${data.notification_type}`,
    });
  }

  /**
   * Send club notification
   */
  async sendClubNotification(
    data: ClubNotificationData
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.buildClubNotification(data);
    return this.sendEmail({
      to: data.club_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      emailType: `club_notification_${data.notification_type}`,
    });
  }

  /**
   * Build race entry confirmation email template
   */
  private buildConfirmationEmail(data: RaceEntryConfirmationData): EmailTemplate {
    const subject = `Race Entry Confirmed - ${data.regatta_name} - ${data.entry_number}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #fff;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .entry-number {
              background: #f3f4f6;
              padding: 20px;
              text-align: center;
              border-radius: 8px;
              margin: 20px 0;
            }
            .entry-number h2 {
              margin: 0;
              color: #667eea;
              font-size: 32px;
            }
            .details {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #6b7280;
            }
            .value {
              color: #111827;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
            }
            .status-confirmed {
              background: #d1fae5;
              color: #059669;
            }
            .status-pending {
              background: #fef3c7;
              color: #d97706;
            }
            .crew-list {
              margin: 10px 0;
            }
            .crew-member {
              padding: 8px;
              background: #f3f4f6;
              margin: 4px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #6b7280;
              font-size: 14px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🏆 Race Entry Confirmed!</h1>
            <p>${data.regatta_name}</p>
          </div>

          <div class="content">
            <p>Hi ${data.sailor_name},</p>

            <p>Your race entry has been successfully confirmed! Here are your registration details:</p>

            <div class="entry-number">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Entry Number</p>
              <h2>${data.entry_number}</h2>
            </div>

            <div class="details">
              <div class="detail-row">
                <span class="label">Event</span>
                <span class="value">${data.regatta_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Venue</span>
                <span class="value">${data.venue_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date</span>
                <span class="value">${new Date(data.start_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div class="detail-row">
                <span class="label">Boat</span>
                <span class="value">${data.boat_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Sail Number</span>
                <span class="value">${data.sail_number}</span>
              </div>
              <div class="detail-row">
                <span class="label">Class</span>
                <span class="value">${data.entry_class}</span>
              </div>
              <div class="detail-row">
                <span class="label">Payment Status</span>
                <span class="value">
                  <span class="status-badge ${data.payment_status === 'paid' ? 'status-confirmed' : 'status-pending'}">
                    ${data.payment_status === 'paid' ? 'Paid' : 'Pending Payment'}
                  </span>
                </span>
              </div>
              ${data.payment_status !== 'paid' ? `
                <div class="detail-row">
                  <span class="label">Amount Due</span>
                  <span class="value">${data.entry_fee_currency} ${data.entry_fee_amount.toFixed(2)}</span>
                </div>
              ` : ''}
            </div>

            ${data.crew_members.length > 0 ? `
              <h3>Crew Members</h3>
              <div class="crew-list">
                ${data.crew_members.map(crew => `
                  <div class="crew-member">
                    <strong>${crew.name}</strong> - ${crew.role}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <h3>Next Steps</h3>
            <ul>
              ${data.payment_status !== 'paid' ? '<li>Complete your payment to confirm your entry</li>' : ''}
              ${!data.documents_complete ? '<li>Upload any remaining required documents</li>' : ''}
              <li>Download sailing instructions when available</li>
              <li>Review race schedule and course information</li>
              <li>Prepare your boat and equipment</li>
              <li>Confirm crew availability</li>
            </ul>

            <div style="text-align: center;">
              <a href="https://regattaflow.com/races/entries/${data.entry_number}" class="button">
                View Entry Details
              </a>
            </div>
          </div>

          <div class="footer">
            <p>Questions? Contact the race organizers or reply to this email.</p>
            <p style="font-size: 12px; color: #9ca3af;">
              RegattaFlow - Your Complete Sailing Competition Platform<br>
              © ${new Date().getFullYear()} RegattaFlow. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
RACE ENTRY CONFIRMED

${data.regatta_name}

Entry Number: ${data.entry_number}

REGISTRATION DETAILS:
- Event: ${data.regatta_name}
- Venue: ${data.venue_name}
- Date: ${new Date(data.start_date).toLocaleDateString()}
- Boat: ${data.boat_name}
- Sail Number: ${data.sail_number}
- Class: ${data.entry_class}
- Payment Status: ${data.payment_status}
${data.payment_status !== 'paid' ? `- Amount Due: ${data.entry_fee_currency} ${data.entry_fee_amount.toFixed(2)}` : ''}

${data.crew_members.length > 0 ? `
CREW MEMBERS:
${data.crew_members.map(crew => `- ${crew.name} (${crew.role})`).join('\n')}
` : ''}

NEXT STEPS:
${data.payment_status !== 'paid' ? '- Complete your payment to confirm your entry' : ''}
${!data.documents_complete ? '- Upload any remaining required documents' : ''}
- Download sailing instructions when available
- Review race schedule and course information
- Prepare your boat and equipment
- Confirm crew availability

View your entry details at: https://regattaflow.com/races/entries/${data.entry_number}

Questions? Contact the race organizers or reply to this email.

RegattaFlow - Your Complete Sailing Competition Platform
© ${new Date().getFullYear()} RegattaFlow. All rights reserved.
    `;

    return { subject, html, text };
  }

  /**
   * Build coach booking confirmation email template
   */
  private buildCoachBookingConfirmation(
    data: CoachBookingConfirmationData,
    recipient: 'sailor' | 'coach'
  ): EmailTemplate {
    const recipientName = recipient === 'sailor' ? data.sailor_name : data.coach_name;
    const otherName = recipient === 'sailor' ? data.coach_name : data.sailor_name;
    const subject = `Coaching Session Confirmed - ${new Date(data.scheduled_date).toLocaleDateString()}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎯 Coaching Session Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${recipientName},</p>
            <p>Your coaching session ${recipient === 'sailor' ? 'with' : 'for'} ${otherName} has been confirmed!</p>
            <div class="details">
              <div class="detail-row"><span><strong>Session Type</strong></span><span>${data.session_type}</span></div>
              <div class="detail-row"><span><strong>Date & Time</strong></span><span>${new Date(data.scheduled_date).toLocaleString()}</span></div>
              <div class="detail-row"><span><strong>Duration</strong></span><span>${data.duration_minutes} minutes</span></div>
              <div class="detail-row"><span><strong>Location</strong></span><span>${data.location}</span></div>
              ${recipient === 'sailor' ? `<div class="detail-row"><span><strong>Fee</strong></span><span>${data.currency} ${data.fee_amount.toFixed(2)}</span></div>` : ''}
            </div>
            <p><strong>📅 Calendar Event:</strong> A calendar invite (.ics file) is attached to this email for your convenience.</p>
            ${recipient === 'sailor' ? `
              <h3>Before Your Session:</h3>
              <ul>
                <li>Review any specific goals or areas you want to focus on</li>
                <li>Prepare any questions you have</li>
                <li>Bring necessary equipment and clothing</li>
                <li>Arrive 10 minutes early if meeting on-water</li>
              </ul>
            ` : `
              <h3>Session Prep:</h3>
              <ul>
                <li>Review ${data.sailor_name}'s profile and goals</li>
                <li>Prepare session materials and drills</li>
                <li>Check weather conditions for on-water sessions</li>
                <li>Confirm equipment availability</li>
              </ul>
            `}
            <div style="text-align: center;">
              <a href="https://regattaflow.com/coaching/sessions" class="button">View Session Details</a>
            </div>
          </div>
          <div class="footer">
            <p>Need to reschedule? Please contact ${otherName} at least 24 hours in advance.</p>
            <p>RegattaFlow Coach Marketplace<br>© ${new Date().getFullYear()} RegattaFlow. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `COACHING SESSION CONFIRMED

Hi ${recipientName},

Your coaching session ${recipient === 'sailor' ? 'with' : 'for'} ${otherName} has been confirmed!

SESSION DETAILS:
- Type: ${data.session_type}
- Date & Time: ${new Date(data.scheduled_date).toLocaleString()}
- Duration: ${data.duration_minutes} minutes
- Location: ${data.location}
${recipient === 'sailor' ? `- Fee: ${data.currency} ${data.fee_amount.toFixed(2)}` : ''}

A calendar invite is attached for your convenience.

View details: https://regattaflow.com/coaching/sessions

RegattaFlow Coach Marketplace
© ${new Date().getFullYear()} RegattaFlow. All rights reserved.`;

    return { subject, html, text };
  }

  /**
   * Build race reminder email template
   */
  private buildRaceReminder(data: RaceReminderData): EmailTemplate {
    const subject = `Race Tomorrow: ${data.regatta_name}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .highlight { background: #FEF3C7; padding: 20px; border-left: 4px solid #F59E0B; margin: 20px 0; border-radius: 4px; }
            .weather { background: #DBEAFE; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .checklist { background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>⏰ Race Tomorrow!</h1>
            <p style="font-size: 20px; margin: 0;">${data.regatta_name}</p>
          </div>
          <div class="content">
            <p>Hi ${data.sailor_name},</p>
            <p>Your race is tomorrow! Here's everything you need to know:</p>
            <div class="highlight">
              <h3 style="margin-top: 0;">📍 Race Details</h3>
              <p><strong>Event:</strong> ${data.regatta_name}</p>
              <p><strong>Start Time:</strong> ${new Date(data.start_date).toLocaleString()}</p>
              <p><strong>Venue:</strong> ${data.venue_name}</p>
              <p><strong>Entry #:</strong> ${data.entry_number}</p>
            </div>
            ${data.weather_forecast ? `
              <div class="weather">
                <h3 style="margin-top: 0;">🌤️ Weather Forecast</h3>
                <p><strong>Wind:</strong> ${data.weather_forecast.wind_speed} kts from ${data.weather_forecast.wind_direction}</p>
                <p><strong>Conditions:</strong> ${data.weather_forecast.conditions}</p>
              </div>
            ` : ''}
            ${data.course_info ? `
              <div class="highlight">
                <h3 style="margin-top: 0;">🗺️ Course Information</h3>
                <p>${data.course_info}</p>
              </div>
            ` : ''}
            <div class="checklist">
              <h3 style="margin-top: 0;">✅ Pre-Race Checklist</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Review sailing instructions and course layout</li>
                <li>Check latest weather forecast and tide tables</li>
                <li>Prepare boat and equipment</li>
                <li>Confirm crew availability and arrival times</li>
                <li>Plan travel and parking at venue</li>
                <li>Pack food, water, and sunscreen</li>
                <li>Charge GPS, cameras, and communication devices</li>
              </ul>
            </div>
            <p style="text-align: center; font-size: 18px; color: #D97706; font-weight: bold;">Good luck out there! ⛵</p>
          </div>
          <div class="footer">
            <p>View full race details and strategy in RegattaFlow</p>
            <p>RegattaFlow - Your Complete Sailing Platform<br>© ${new Date().getFullYear()} RegattaFlow. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `RACE TOMORROW: ${data.regatta_name}

Hi ${data.sailor_name},

Your race is tomorrow! Here's everything you need to know:

RACE DETAILS:
- Event: ${data.regatta_name}
- Start Time: ${new Date(data.start_date).toLocaleString()}
- Venue: ${data.venue_name}
- Entry #: ${data.entry_number}

${data.weather_forecast ? `WEATHER FORECAST:
- Wind: ${data.weather_forecast.wind_speed} kts from ${data.weather_forecast.wind_direction}
- Conditions: ${data.weather_forecast.conditions}
` : ''}

PRE-RACE CHECKLIST:
☐ Review sailing instructions and course layout
☐ Check latest weather forecast and tide tables
☐ Prepare boat and equipment
☐ Confirm crew availability
☐ Plan travel and parking
☐ Pack food, water, and sunscreen
☐ Charge devices

Good luck out there! ⛵

RegattaFlow - Your Complete Sailing Platform
© ${new Date().getFullYear()} RegattaFlow. All rights reserved.`;

    return { subject, html, text };
  }

  /**
   * Build coach notification email template
   */
  private buildCoachNotification(data: CoachNotificationData): EmailTemplate {
    let subject = '';
    let content = '';

    switch (data.notification_type) {
      case 'new_booking':
        subject = `New Booking Request from ${data.sailor_name}`;
        content = `
          <p>You have a new booking request!</p>
          <p><strong>From:</strong> ${data.sailor_name}</p>
          <p><strong>Session Date:</strong> ${data.session_date ? new Date(data.session_date).toLocaleString() : 'To be confirmed'}</p>
          ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ''}
          <p>Please review and respond to this booking request in your coach dashboard.</p>
        `;
        break;
      case 'cancellation':
        subject = `Session Cancelled - ${data.sailor_name}`;
        content = `
          <p>${data.sailor_name} has cancelled their coaching session.</p>
          <p><strong>Session Date:</strong> ${data.session_date ? new Date(data.session_date).toLocaleString() : 'N/A'}</p>
          ${data.message ? `<p><strong>Reason:</strong> ${data.message}</p>` : ''}
          <p>The session has been removed from your calendar and the payment has been refunded according to your cancellation policy.</p>
        `;
        break;
      case 'payment_received':
        subject = `Payment Received - ${data.amount} ${data.currency}`;
        content = `
          <p>You've received a payment for a coaching session!</p>
          <p><strong>Amount:</strong> ${data.currency} ${data.amount?.toFixed(2)}</p>
          <p><strong>Client:</strong> ${data.sailor_name}</p>
          <p><strong>Session:</strong> ${data.session_date ? new Date(data.session_date).toLocaleString() : 'N/A'}</p>
          <p>The payment will be transferred to your connected account according to your payout schedule.</p>
        `;
        break;
      case 'analysis_shared': {
        subject = `New Race Analysis from ${data.sailor_name || 'your sailor'}`;
        const summary = data.analysis_summary || data.message;
        const highlights = (data.highlights || []).filter(Boolean);
        const highlightList = highlights.length
          ? `<ul>${highlights.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '';
        content = `
          <p>${data.sailor_name || 'Your sailor'} just shared a fresh post-race analysis${data.race_name ? ` for <strong>${data.race_name}</strong>` : ''}.</p>
          ${data.regatta_name ? `<p><strong>Regatta:</strong> ${data.regatta_name}</p>` : ''}
          ${summary ? `<p><strong>Summary:</strong> ${summary}</p>` : ''}
          ${highlightList}
          <p>Log in to review the AI insights and respond with coaching feedback.</p>
        `;
        break;
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>👨‍🏫 Coach Notification</h1>
          </div>
          <div class="content">
            <p>Hi ${data.coach_name},</p>
            ${content}
            <div style="text-align: center;">
              <a href="https://regattaflow.com/coach/dashboard" class="button">View Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>RegattaFlow Coach Marketplace<br>© ${new Date().getFullYear()} RegattaFlow. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = content
      .replace(/<li>/g, '- ')
      .replace(/<\/li>/g, '\n')
      .replace(/<\/ul>/g, '\n')
      .replace(/<ul>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ');

    const text = `COACH NOTIFICATION

Hi ${data.coach_name},

${textContent}

View Dashboard: https://regattaflow.com/coach/dashboard

RegattaFlow Coach Marketplace
© ${new Date().getFullYear()} RegattaFlow. All rights reserved.`;

    return { subject, html, text };
  }

  /**
   * Build club notification email template
   */
  private buildClubNotification(data: ClubNotificationData): EmailTemplate {
    let subject = '';
    let content = '';

    switch (data.notification_type) {
      case 'new_registration':
        subject = `New Registration - ${data.regatta_name}`;
        content = `
          <p>A new sailor has registered for your event!</p>
          <p><strong>Event:</strong> ${data.regatta_name}</p>
          <p><strong>Sailor:</strong> ${data.sailor_name}</p>
          <p><strong>Entry #:</strong> ${data.entry_number}</p>
          <p>Review the registration details in your club dashboard.</p>
        `;
        break;
      case 'payment_received':
        subject = `Payment Received - ${data.entry_number}`;
        content = `
          <p>Payment received for a race entry!</p>
          <p><strong>Amount:</strong> ${data.currency} ${data.amount?.toFixed(2)}</p>
          <p><strong>Sailor:</strong> ${data.sailor_name}</p>
          <p><strong>Entry #:</strong> ${data.entry_number}</p>
          <p><strong>Event:</strong> ${data.regatta_name}</p>
          <p>The entry is now confirmed. Funds will be available in your account according to your payout schedule.</p>
        `;
        break;
      case 'member_joined':
        subject = `New Member - ${data.member_details?.name}`;
        content = `
          <p>A new member has joined ${data.club_name}!</p>
          <p><strong>Name:</strong> ${data.member_details?.name}</p>
          <p><strong>Email:</strong> ${data.member_details?.email}</p>
          ${data.member_details?.boat_class ? `<p><strong>Boat Class:</strong> ${data.member_details.boat_class}</p>` : ''}
          <p>Welcome them to the club and help them get started!</p>
        `;
        break;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; padding: 12px 24px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>⛵ ${data.club_name}</h1>
            <p>Club Notification</p>
          </div>
          <div class="content">
            ${content}
            <div style="text-align: center;">
              <a href="https://regattaflow.com/club/dashboard" class="button">View Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>RegattaFlow Club Management<br>© ${new Date().getFullYear()} RegattaFlow. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `CLUB NOTIFICATION - ${data.club_name}

${content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')}

View Dashboard: https://regattaflow.com/club/dashboard

RegattaFlow Club Management
© ${new Date().getFullYear()} RegattaFlow. All rights reserved.`;

    return { subject, html, text };
  }

  // ============================================================================
  // Coaching Session Email Templates (NEW)
  // ============================================================================

  /**
   * Send session completion notification to sailor
   */
  async sendSessionCompletionNotification(data: {
    sailor_name: string;
    sailor_email: string;
    coach_name: string;
    session_type: string;
    session_date: string;
    session_notes?: string;
    homework?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const template = this.generateSessionCompletionTemplate(data);
    return this.sendEmail({
      to: data.sailor_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      emailType: 'session_completion',
    });
  }

  /**
   * Send feedback request email
   */
  async sendFeedbackRequest(data: {
    sailor_name: string;
    sailor_email: string;
    coach_name: string;
    session_id: string;
  }): Promise<{ success: boolean; error?: string }> {
    const template = this.generateFeedbackRequestTemplate(data);
    return this.sendEmail({
      to: data.sailor_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      emailType: 'feedback_request',
    });
  }

  /**
   * Send 24-hour session reminder
   */
  async sendSessionReminder(data: {
    participant_name: string;
    participant_email: string;
    coach_name?: string;
    sailor_name?: string;
    session_type: string;
    session_date: string;
    location?: string;
    preparation_notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const template = this.generateSessionReminderTemplate(data);
    return this.sendEmail({
      to: data.participant_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      emailType: 'session_reminder',
    });
  }

  /**
   * Generate session completion email template
   */
  private generateSessionCompletionTemplate(data: {
    sailor_name: string;
    coach_name: string;
    session_type: string;
    session_date: string;
    session_notes?: string;
    homework?: string;
  }): EmailTemplate {
    const subject = `Session Complete: ${data.session_type} with ${data.coach_name}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007AFF; color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f9f9f9; padding: 30px 20px; }
            .section { margin-bottom: 25px; }
            .section h2 { color: #007AFF; font-size: 20px; margin-bottom: 10px; }
            .notes { background: #E8F4FD; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #007AFF; }
            .homework { background: #FFF7ED; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #F59E0B; }
            .button { display: inline-block; background: #007AFF; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⛵ Session Complete!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.sailor_name},</p>
              <p>Your coaching session with <strong>${data.coach_name}</strong> has been completed. Great work!</p>

              <div class="section">
                <h2>Session Details</h2>
                <p>
                  <strong>Type:</strong> ${data.session_type.replace('_', ' ')}<br>
                  <strong>Date:</strong> ${new Date(data.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>

              ${data.session_notes ? `
                <div class="notes">
                  <h2>📝 Session Notes</h2>
                  <p>${data.session_notes}</p>
                </div>
              ` : ''}

              ${data.homework ? `
                <div class="homework">
                  <h2>📚 Homework & Next Steps</h2>
                  <p>${data.homework}</p>
                </div>
              ` : ''}

              <div class="section">
                <p>We'd love to hear about your experience!</p>
                <a href="${process.env.EXPO_PUBLIC_APP_URL}/feedback?type=session" class="button">
                  Leave Feedback
                </a>
              </div>
            </div>
            <div class="footer">
              <p>RegattaFlow - Your Sailing Performance Platform<br>© ${new Date().getFullYear()} RegattaFlow. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Session Complete!

Hi ${data.sailor_name},

Your coaching session with ${data.coach_name} has been completed.

Session Details:
- Type: ${data.session_type.replace('_', ' ')}
- Date: ${new Date(data.session_date).toLocaleDateString()}

${data.session_notes ? `Session Notes:\n${data.session_notes}\n\n` : ''}
${data.homework ? `Homework & Next Steps:\n${data.homework}\n\n` : ''}

We'd love to hear about your experience. Please leave feedback at:
${process.env.EXPO_PUBLIC_APP_URL}/feedback?type=session

RegattaFlow - Your Sailing Performance Platform
    `;

    return { subject, html, text };
  }

  /**
   * Generate feedback request template
   */
  private generateFeedbackRequestTemplate(data: {
    sailor_name: string;
    coach_name: string;
    session_id: string;
  }): EmailTemplate {
    const subject = `How was your session with ${data.coach_name}?`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #7C3AED; color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f9f9f9; padding: 30px 20px; }
            .stars { font-size: 40px; text-align: center; margin: 25px 0; letter-spacing: 5px; }
            .button { display: inline-block; background: #7C3AED; color: white !important; padding: 16px 32px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; font-size: 16px; }
            .note { font-size: 14px; color: #666; margin-top: 25px; padding: 15px; background: #f3f4f6; border-radius: 6px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⭐ Rate Your Session</h1>
            </div>
            <div class="content">
              <p>Hi ${data.sailor_name},</p>
              <p>Thank you for completing your session with <strong>${data.coach_name}</strong>!</p>
              <p>Your feedback helps us maintain quality coaching and helps other sailors find the right coach.</p>

              <div class="stars">⭐⭐⭐⭐⭐</div>

              <div style="text-align: center;">
                <a href="${process.env.EXPO_PUBLIC_APP_URL}/coach/session/${data.session_id}/feedback" class="button">
                  Leave Feedback
                </a>
              </div>

              <p class="note">
                Your feedback will be visible to other sailors and will help ${data.coach_name} improve their coaching services.
              </p>
            </div>
            <div class="footer">
              <p>RegattaFlow - Your Sailing Performance Platform<br>© ${new Date().getFullYear()} RegattaFlow. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Rate Your Session

Hi ${data.sailor_name},

Thank you for completing your session with ${data.coach_name}!

Your feedback helps us maintain quality coaching and helps other sailors find the right coach.

Please leave your feedback at:
${process.env.EXPO_PUBLIC_APP_URL}/coach/session/${data.session_id}/feedback

RegattaFlow - Your Sailing Performance Platform
    `;

    return { subject, html, text };
  }

  /**
   * Generate session reminder template
   */
  private generateSessionReminderTemplate(data: {
    participant_name: string;
    coach_name?: string;
    sailor_name?: string;
    session_type: string;
    session_date: string;
    location?: string;
    preparation_notes?: string;
  }): EmailTemplate {
    const otherParty = data.coach_name || data.sailor_name || 'your session partner';
    const subject = `⏰ Reminder: Coaching session tomorrow with ${otherParty}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F59E0B; color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f9f9f9; padding: 30px 20px; }
            .reminder-box { background: #FFF7ED; border-left: 4px solid #F59E0B; padding: 20px; margin: 20px 0; border-radius: 6px; }
            .reminder-box h2 { color: #F59E0B; margin-top: 0; }
            .prep-notes { background: #E8F4FD; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .button { display: inline-block; background: #007AFF; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; }
            .note { font-size: 14px; color: #666; margin-top: 25px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Session Reminder</h1>
            </div>
            <div class="content">
              <p>Hi ${data.participant_name},</p>
              <p>This is a friendly reminder about your upcoming coaching session:</p>

              <div class="reminder-box">
                <h2>Session Details</h2>
                <p>
                  <strong>With:</strong> ${otherParty}<br>
                  <strong>Type:</strong> ${data.session_type.replace('_', ' ')}<br>
                  <strong>When:</strong> ${new Date(data.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}<br>
                  ${data.location ? `<strong>Location:</strong> ${data.location}<br>` : ''}
                </p>
              </div>

              ${data.preparation_notes ? `
                <div class="prep-notes">
                  <h2 style="margin-top: 0;">📋 Preparation Notes</h2>
                  <p>${data.preparation_notes}</p>
                </div>
              ` : ''}

              <div style="text-align: center;">
                <a href="${process.env.EXPO_PUBLIC_APP_URL}/coach/sessions" class="button">
                  View Session Details
                </a>
              </div>

              <p class="note">
                Need to reschedule? Please contact ${otherParty} as soon as possible.
              </p>
            </div>
            <div class="footer">
              <p>RegattaFlow - Your Sailing Performance Platform<br>© ${new Date().getFullYear()} RegattaFlow. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Session Reminder

Hi ${data.participant_name},

This is a friendly reminder about your upcoming coaching session:

Session Details:
- With: ${otherParty}
- Type: ${data.session_type.replace('_', ' ')}
- When: ${new Date(data.session_date).toLocaleDateString()}
${data.location ? `- Location: ${data.location}` : ''}

${data.preparation_notes ? `Preparation Notes:\n${data.preparation_notes}\n\n` : ''}

View session details at:
${process.env.EXPO_PUBLIC_APP_URL}/coach/sessions

Need to reschedule? Please contact ${otherParty} as soon as possible.

RegattaFlow - Your Sailing Performance Platform
    `;

    return { subject, html, text };
  }
}

export const emailService = new EmailService();
