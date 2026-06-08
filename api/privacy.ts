import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - BetterAt</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #0a1832; }
        h2 { color: #0a1832; margin-top: 30px; }
        h3 { color: #374151; }
        .updated { color: #6b7280; font-size: 14px; }
        .delete-section {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 4px 20px 20px;
            margin-top: 30px;
            background: #f9fafb;
        }
        ol li { margin-bottom: 6px; }
    </style>
</head>
<body>
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: June 8, 2026</p>

    <h2>Introduction</h2>
    <p>BetterAt ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the BetterAt mobile application and related web services. BetterAt is a learning-and-doing platform that helps people make progress on the interests, programs, and goals they care about.</p>

    <h2>Information We Collect</h2>
    <h3>Personal Information</h3>
    <ul>
        <li>Account information (name, email address)</li>
        <li>Profile information (interests, organizations and programs you join, goals)</li>
        <li>Content you create (steps, notes, reflections, and photos you upload)</li>
        <li>Location data (approximate and precise, for place-based features such as nearby activity, venues, and weather)</li>
        <li>Purchase history (subscription status processed through Apple, Google Play, or Stripe)</li>
        <li>Fitness information (only if you choose to log training or fitness activity)</li>
    </ul>

    <h3>Automatically Collected Information</h3>
    <ul>
        <li>Device and other identifiers (device type, operating system, app and analytics IDs)</li>
        <li>Usage data (features used, session duration)</li>
        <li>Crash logs and diagnostics (to keep the app stable and performant)</li>
    </ul>

    <h2>How We Use Your Information</h2>
    <ul>
        <li>Provide and maintain our services</li>
        <li>Personalize your plans, steps, and recommendations</li>
        <li>Power AI-assisted features that help you plan and review your progress</li>
        <li>Send notifications about your activity, organizations, and programs</li>
        <li>Process subscriptions and account management</li>
        <li>Communicate updates and support</li>
    </ul>

    <h2>Data Sharing</h2>
    <p>We use trusted service providers (processors) that handle data on our behalf, including cloud hosting and database (Supabase), subscription management (RevenueCat, Apple, Google Play, Stripe), crash and performance monitoring (Sentry), and AI processing (Anthropic and Google) to deliver AI features. These providers act under our instructions and do not use your data for their own purposes.</p>
    <p>We may also share information with organizations or programs you choose to join (for example, a club, school, or cohort) so they can administer your participation, and with legal authorities when required by law.</p>
    <p>We do not sell your personal information to third parties.</p>

    <h2>Data Security</h2>
    <p>We implement industry-standard security measures to protect your data, including encryption in transit and at rest, and secure authentication.</p>

    <h2>Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
        <li>Access your personal data</li>
        <li>Correct inaccurate data</li>
        <li>Request deletion of your account and data (see below)</li>
        <li>Opt-out of marketing communications</li>
        <li>Export your data</li>
    </ul>

    <div class="delete-section" id="delete-account">
        <h2>Account and Data Deletion</h2>
        <p>You can request deletion of your BetterAt account and the personal data associated with it at any time, using either of the following methods:</p>
        <h3>Delete in the app</h3>
        <ol>
            <li>Open the BetterAt app and go to <strong>Settings</strong>.</li>
            <li>Tap <strong>Delete account</strong>.</li>
            <li>Type <strong>DELETE</strong> and enter your password to confirm.</li>
            <li>Confirm the final prompt. Your account and associated data are then permanently deleted.</li>
        </ol>
        <h3>Delete by email</h3>
        <p>If you cannot access the app, email <a href="mailto:info@better.at">info@better.at</a> from the address on your account and ask us to delete your account. We will verify your identity and complete the deletion.</p>
        <h3>What is deleted</h3>
        <p>Deleting your account permanently removes your data, including: your profile and personal information; all of your steps, history, and progress data; saved places, documents, and resources; connections, groups, and organization memberships; coaching sessions and saved plans; and AI-generated insights. Any active subscription is cancelled.</p>
        <h3>What may be retained</h3>
        <p>We delete your personal data promptly and purge it from routine backups within 30 days. We may retain a limited set of records (for example, transaction and tax records) where required to comply with legal obligations, and anonymized or aggregated data that can no longer identify you.</p>
    </div>

    <h2>Location Data</h2>
    <p>We collect location data to provide place-based features such as nearby activity, venue and weather intelligence, and mapping your steps. You can disable location services in your device settings at any time.</p>

    <h2>Children's Privacy</h2>
    <p>Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13.</p>

    <h2>Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>

    <h2>Contact Us</h2>
    <p>If you have questions about this Privacy Policy, please contact us at:</p>
    <p>
        Email: <a href="mailto:info@better.at">info@better.at</a><br>
        Website: <a href="https://better.at">https://better.at</a>
    </p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
