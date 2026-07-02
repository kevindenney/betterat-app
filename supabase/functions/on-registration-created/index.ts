/**
 * On Registration Created - Webhook Handler
 * Automatically sends confirmation email when someone registers for an event
 * Triggered by database webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://better.at';

interface WebhookPayload {
  type: 'INSERT';
  table: 'race_entries';
  record: {
    id: string;
    regatta_id: string;
    sailor_id: string;
    sail_number: string;
    boat_name?: string;
    entry_class?: string;
    division?: string;
    entry_number?: string;
    status: string;
    created_at: string;
  };
}

serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();
    
    // Only handle INSERT events
    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const registration = payload.record;
    
    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get full registration data with relations
    const { data: fullRegistration, error: regError } = await supabase
      .from('race_entries')
      .select(`
        *,
        sailor:sailor_id (
          id,
          email,
          full_name,
          phone
        ),
        regatta:regatta_id (
          id,
          name,
          location,
          venue_name,
          start_date,
          end_date,
          nor_url,
          si_url,
          club:club_id (
            id,
            name,
            logo_url,
            email,
            website
          )
        )
      `)
      .eq('id', registration.id)
      .single();

    if (regError || !fullRegistration) {
      console.error('Failed to fetch registration details:', regError);
      return new Response(
        JSON.stringify({ error: 'Registration not found' }),
        { status: 404 }
      );
    }

    const { sailor, regatta } = fullRegistration;
    const club = regatta.club;

    // Format dates
    const startDate = new Date(regatta.start_date);
    const endDate = regatta.end_date ? new Date(regatta.end_date) : startDate;
    const dateFormatter = new Intl.DateTimeFormat('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    
    const regattaDates = startDate.getTime() === endDate.getTime()
      ? dateFormatter.format(startDate)
      : `${dateFormatter.format(startDate)} - ${dateFormatter.format(endDate)}`;

    // Check if user needs temp password (new account)
    let tempPassword: string | undefined;
    let isNewAccount = false;
    
    // Check if this is their first registration (they might not have set up their account yet)
    const { count } = await supabase
      .from('race_entries')
      .select('*', { count: 'exact', head: true })
      .eq('sailor_id', sailor.id);
    
    if (count === 1) {
      // This is their first registration - they might need credentials
      // Generate a temp password if they haven't logged in before
      const { data: authUser } = await supabase.auth.admin.getUserById(sailor.id);
      if (authUser && !authUser.user?.last_sign_in_at) {
        tempPassword = generateTempPassword();
        await supabase.auth.admin.updateUserById(sailor.id, {
          password: tempPassword
        });
        isNewAccount = true;
      }
    }

    // Build email data
    const emailData = {
      sailor_name: sailor.full_name || 'Sailor',
      sailor_email: sailor.email,
      sailor_phone: sailor.phone,
      
      registration_id: fullRegistration.id,
      entry_number: fullRegistration.entry_number,
      sail_number: fullRegistration.sail_number,
      boat_name: fullRegistration.boat_name,
      boat_class: fullRegistration.entry_class,
      division: fullRegistration.division,
      
      regatta_id: regatta.id,
      regatta_name: regatta.name,
      regatta_dates: regattaDates,
      regatta_location: regatta.location,
      regatta_venue: regatta.venue_name,
      
      club_name: club?.name || 'Organizing Authority',
      club_logo_url: club?.logo_url,
      club_email: club?.email,
      club_website: club?.website,
      
      sailor_portal_url: `${APP_URL}/my-events`,
      regatta_url: `${APP_URL}/regatta/${regatta.id}`,
      nor_url: regatta.nor_url,
      si_url: regatta.si_url,
      
      payment_status: fullRegistration.payment_status || 'pending',
      entry_fee: fullRegistration.entry_fee,
      
      temp_password: tempPassword,
      is_new_account: isNewAccount,
    };

    // Generate the email HTML (simplified version for edge function)
    const emailHtml = generateEmailHtml(emailData);
    const emailText = generateEmailText(emailData);

    // Send the email
    const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        to: sailor.email,
        subject: `✅ Registration Confirmed - ${regatta.name}`,
        html: emailHtml,
        text: emailText,
        replyTo: club?.email,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error('Failed to send confirmation email:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { status: 500 }
      );
    }

    // Log the email
    await supabase.from('email_logs').insert({
      registration_id: fullRegistration.id,
      email_type: 'confirmation',
      recipient_email: sailor.email,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, email_sent: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateEmailHtml(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px 24px; text-align: center; }
    .header h1 { color: white; font-size: 24px; margin: 0 0 8px 0; }
    .header p { color: rgba(255,255,255,0.9); font-size: 14px; margin: 0; }
    .badge { display: inline-block; background: #10b981; color: white; padding: 8px 20px; border-radius: 50px; font-size: 14px; font-weight: 600; margin-top: 16px; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 18px; margin-bottom: 16px; }
    .detail-card { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .detail-card h3 { font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-size: 14px; }
    .value { color: #0f172a; font-weight: 600; font-size: 14px; }
    .sail-num { font-family: monospace; background: #1e293b; color: white; padding: 4px 12px; border-radius: 6px; }
    .btn { display: inline-block; background: #0ea5e9; color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; margin: 8px 4px; }
    .btn.secondary { background: #f1f5f9; color: #1e293b !important; }
    .btn-row { text-align: center; margin: 24px 0; }
    .creds { background: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .creds h3 { color: #dc2626; font-size: 15px; margin: 0 0 12px 0; }
    .cred-row { background: white; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .cred-label { font-size: 12px; color: #64748b; }
    .cred-value { font-family: monospace; font-size: 16px; color: #0f172a; font-weight: 600; }
    .features { margin: 32px 0; }
    .features h3 { font-size: 16px; margin-bottom: 16px; }
    .feature { display: flex; margin-bottom: 12px; }
    .feature-icon { width: 24px; height: 24px; background: #dbeafe; border-radius: 6px; text-align: center; line-height: 24px; margin-right: 12px; }
    .feature-text { color: #64748b; font-size: 14px; }
    .docs { background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .docs h3 { color: #166534; font-size: 15px; margin: 0 0 12px 0; }
    .doc-link { display: block; color: #15803d; font-size: 14px; margin-bottom: 8px; }
    .checklist { background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .checklist h3 { color: #92400e; font-size: 15px; margin: 0 0 12px 0; }
    .check-item { display: flex; align-items: center; margin-bottom: 8px; color: #78350f; font-size: 14px; }
    .checkbox { width: 18px; height: 18px; border: 2px solid #d97706; border-radius: 4px; margin-right: 10px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #64748b; font-size: 13px; margin: 4px 0; }
    .footer a { color: #0ea5e9; }
    @media (max-width: 600px) { .wrapper { padding: 12px; } .content { padding: 24px 16px; } .btn { display: block; margin: 8px 0; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        ${data.club_logo_url ? `<img src="${data.club_logo_url}" alt="" style="width:80px;height:80px;border-radius:16px;margin-bottom:16px;background:white;">` : ''}
        <h1>${data.regatta_name}</h1>
        <p>${data.regatta_dates} • ${data.regatta_location}</p>
        <div class="badge">✓ Registration Confirmed</div>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${data.sailor_name.split(' ')[0]}! 👋</p>
        <p style="color:#64748b;">Great news - you're officially registered for <strong>${data.regatta_name}</strong>!</p>
        
        <div class="detail-card">
          <h3>📋 Your Registration</h3>
          <div class="row"><span class="label">Entry #</span><span class="value">${data.entry_number || 'TBD'}</span></div>
          <div class="row"><span class="label">Sail Number</span><span class="sail-num">${data.sail_number}</span></div>
          ${data.boat_name ? `<div class="row"><span class="label">Boat</span><span class="value">${data.boat_name}</span></div>` : ''}
          ${data.division ? `<div class="row"><span class="label">Division</span><span class="value">${data.division}</span></div>` : ''}
          <div class="row"><span class="label">Payment</span><span class="value" style="color:${data.payment_status === 'paid' ? '#10b981' : '#f59e0b'}">${data.payment_status === 'paid' ? '✓ Paid' : '⏳ Pending'}</span></div>
        </div>
        
        <div class="btn-row">
          <a href="${data.sailor_portal_url}" class="btn">Open My Portal</a>
          <a href="${data.regatta_url}" class="btn secondary">View Regatta</a>
        </div>
        
        ${data.is_new_account && data.temp_password ? `
        <div class="creds">
          <h3>🔐 Your Login Credentials</h3>
          <p style="color:#7f1d1d;font-size:13px;margin-bottom:12px;">Save these - you'll need them to access your Sailor Portal</p>
          <div class="cred-row"><div class="cred-label">Email</div><div class="cred-value">${data.sailor_email}</div></div>
          <div class="cred-row"><div class="cred-label">Password</div><div class="cred-value">${data.temp_password}</div></div>
          <p style="color:#7f1d1d;font-size:12px;margin-top:12px;">⚠️ Please change your password after first login</p>
        </div>
        ` : ''}
        
        <div class="features">
          <h3>🎯 Your Sailor Portal</h3>
          <div class="feature"><div class="feature-icon">📄</div><span class="feature-text">View registration & download receipts</span></div>
          <div class="feature"><div class="feature-icon">📊</div><span class="feature-text">Track results and standings</span></div>
          <div class="feature"><div class="feature-icon">⚠️</div><span class="feature-text">Check Rule 42 infractions</span></div>
          <div class="feature"><div class="feature-icon">⚖️</div><span class="feature-text">File protests & view hearings</span></div>
          <div class="feature"><div class="feature-icon">📡</div><span class="feature-text">Live race signals</span></div>
        </div>
        
        ${(data.nor_url || data.si_url) ? `
        <div class="docs">
          <h3>📚 Documents</h3>
          ${data.nor_url ? `<a href="${data.nor_url}" class="doc-link">📄 Notice of Race</a>` : ''}
          ${data.si_url ? `<a href="${data.si_url}" class="doc-link">📄 Sailing Instructions</a>` : ''}
        </div>
        ` : ''}
        
        <div class="checklist">
          <h3>📝 Before the Regatta</h3>
          <div class="check-item"><div class="checkbox"></div>Read the Notice of Race</div>
          <div class="check-item"><div class="checkbox"></div>Check measurement certificate</div>
          <div class="check-item"><div class="checkbox"></div>Confirm insurance coverage</div>
          <div class="check-item"><div class="checkbox"></div>Book accommodation</div>
        </div>
        
        <p style="color:#64748b;font-size:14px;text-align:center;">Questions? <a href="mailto:${data.club_email}">${data.club_email}</a></p>
      </div>
      
      <div class="footer">
        <p><strong>${data.club_name}</strong></p>
        ${data.club_website ? `<p><a href="${data.club_website}">${data.club_website.replace('https://', '')}</a></p>` : ''}
        <p style="margin-top:16px;font-size:12px;">Powered by <a href="https://better.at">BetterAt</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateEmailText(data: any): string {
  return `
Registration Confirmed - ${data.regatta_name}

Hi ${data.sailor_name.split(' ')[0]}!

You're registered for ${data.regatta_name}!

📋 REGISTRATION
Entry #: ${data.entry_number || 'TBD'}
Sail: ${data.sail_number}
${data.boat_name ? `Boat: ${data.boat_name}` : ''}
${data.division ? `Division: ${data.division}` : ''}

📅 EVENT
${data.regatta_dates}
${data.regatta_location}

🔗 LINKS
Portal: ${data.sailor_portal_url}
Regatta: ${data.regatta_url}
${data.nor_url ? `NOR: ${data.nor_url}` : ''}

${data.is_new_account && data.temp_password ? `
🔐 LOGIN
Email: ${data.sailor_email}
Password: ${data.temp_password}
` : ''}

Questions? ${data.club_email}

---
${data.club_name}
Powered by BetterAt`;
}
