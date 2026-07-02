/**
 * Verify Purchase Edge Function
 * Verifies in-app purchases from iOS App Store and Google Play Store
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Apple App Store verification
const APPLE_VERIFY_URL = Deno.env.get('APPLE_VERIFY_PRODUCTION') === 'true'
  ? 'https://buy.itunes.apple.com/verifyReceipt'
  : 'https://sandbox.itunes.apple.com/verifyReceipt';
const APPLE_SHARED_SECRET = Deno.env.get('APPLE_SHARED_SECRET') || '';

// Google Play verification
const GOOGLE_PACKAGE_NAME = 'com.betterat.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPurchaseRequest {
  platform: 'ios' | 'android';
  transactionId: string;
  productId: string;
  purchaseToken?: string; // Android
  receipt?: string;       // iOS
}

// Product ID to tier mapping
// Updated 2026-01-15: Map old product IDs to new tier names (free/basic/pro)
// Old "pro" products → "basic" tier ($120/year equivalent)
// Old "championship" products → "pro" tier ($360/year equivalent)
const PRODUCT_TIER_MAP: Record<string, string> = {
  'regattaflow_sailor_pro_monthly': 'basic',
  'regattaflow_sailor_pro_yearly': 'basic',
  'regattaflow_pro_yearly': 'basic',
  'regattaflow_championship_monthly': 'pro',
  'regattaflow_championship_yearly': 'pro',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: VerifyPurchaseRequest = await req.json();
    const { platform, transactionId, productId, purchaseToken, receipt } = body;

    let verified = false;
    let expiresAt: Date | null = null;
    let purchaseData: any = null;

    // Verify based on platform
    if (platform === 'ios') {
      const result = await verifyiOSPurchase(receipt || '', transactionId, productId);
      verified = result.verified;
      expiresAt = result.expiresAt;
      purchaseData = result.data;
    } else if (platform === 'android') {
      const result = await verifyAndroidPurchase(purchaseToken || '', productId);
      verified = result.verified;
      expiresAt = result.expiresAt;
      purchaseData = result.data;
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verified) {
      return new Response(
        JSON.stringify({ 
          verified: false, 
          error: 'Purchase verification failed' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine subscription tier
    const tier = PRODUCT_TIER_MAP[productId] || 'basic';

    // Update user subscription in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_tier: tier,
        subscription_platform: platform,
        subscription_product_id: productId,
        subscription_transaction_id: transactionId,
        subscription_expires_at: expiresAt?.toISOString(),
        subscription_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update user subscription:', updateError);
      return new Response(
        JSON.stringify({ 
          verified: true, 
          error: 'Failed to update subscription record' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record purchase in subscriptions table
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        tier,
        status: 'active',
        current_period_end: expiresAt?.toISOString(),
        metadata: {
          platform,
          productId,
          transactionId,
          purchaseData,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    return new Response(
      JSON.stringify({
        verified: true,
        tier,
        expiresAt: expiresAt?.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error verifying purchase:', error);
    
    return new Response(
      JSON.stringify({ 
        verified: false,
        error: 'Purchase verification failed',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Verify iOS App Store purchase
 */
async function verifyiOSPurchase(
  receipt: string,
  transactionId: string,
  productId: string
): Promise<{ verified: boolean; expiresAt: Date | null; data: any }> {
  try {
    const response = await fetch(APPLE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receipt,
        'password': APPLE_SHARED_SECRET,
        'exclude-old-transactions': true,
      }),
    });

    const data = await response.json();

    // Check status
    // 0 = valid, 21007 = sandbox receipt on production (retry on sandbox)
    if (data.status === 21007) {
      // Retry with sandbox URL
      const sandboxResponse = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receipt,
          'password': APPLE_SHARED_SECRET,
          'exclude-old-transactions': true,
        }),
      });
      const sandboxData = await sandboxResponse.json();
      return processAppleReceipt(sandboxData, productId);
    }

    return processAppleReceipt(data, productId);
  } catch (error) {
    console.error('iOS verification error:', error);
    return { verified: false, expiresAt: null, data: null };
  }
}

/**
 * Process Apple receipt response
 */
function processAppleReceipt(
  data: any,
  productId: string
): { verified: boolean; expiresAt: Date | null; data: any } {
  if (data.status !== 0) {
    console.error('Apple receipt invalid, status:', data.status);
    return { verified: false, expiresAt: null, data };
  }

  // Find the latest receipt for this product
  const latestReceipts = data.latest_receipt_info || [];
  const matchingReceipt = latestReceipts.find(
    (r: any) => r.product_id === productId
  );

  if (!matchingReceipt) {
    console.error('No matching receipt found for product:', productId);
    return { verified: false, expiresAt: null, data };
  }

  // Check expiration
  const expiresDateMs = parseInt(matchingReceipt.expires_date_ms, 10);
  const expiresAt = new Date(expiresDateMs);
  
  // Subscription is valid if expires in the future
  const isValid = expiresAt > new Date();

  return {
    verified: isValid,
    expiresAt,
    data: matchingReceipt,
  };
}

/**
 * Verify Android Google Play purchase
 */
async function verifyAndroidPurchase(
  purchaseToken: string,
  productId: string
): Promise<{ verified: boolean; expiresAt: Date | null; data: any }> {
  try {
    // For production, you would use Google Play Developer API
    // This requires OAuth2 authentication with a service account
    const GOOGLE_SERVICE_ACCOUNT = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    
    if (!GOOGLE_SERVICE_ACCOUNT) {
      // Fail closed. Previously this "mock" path returned verified:true for ANY
      // purchase token, so any authenticated caller could POST a fake Android
      // purchase and self-grant a paid tier. Real entitlements come from the
      // RevenueCat webhook; without a configured Google Play service account there
      // is no way to verify, so grant nothing.
      console.error('Google Play service account not configured — rejecting Android purchase verification');
      return {
        verified: false,
        expiresAt: null,
        data: { purchaseToken, productId, error: 'android_verification_unavailable' },
      };
    }

    // Parse service account credentials
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
    
    // Get access token using JWT
    const accessToken = await getGoogleAccessToken(credentials);
    
    // Verify subscription with Google Play API
    const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Play API error:', errorData);
      return { verified: false, expiresAt: null, data: errorData };
    }

    const data = await response.json();

    // Check if subscription is valid
    // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = deferred
    const isValid = [1, 2].includes(data.paymentState);
    const expiresAt = data.expiryTimeMillis 
      ? new Date(parseInt(data.expiryTimeMillis, 10))
      : null;

    return {
      verified: isValid && (expiresAt ? expiresAt > new Date() : false),
      expiresAt,
      data,
    };
  } catch (error) {
    console.error('Android verification error:', error);
    return { verified: false, expiresAt: null, data: null };
  }
}

/**
 * Get Google OAuth2 access token using service account
 */
async function getGoogleAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  
  // Create JWT claim
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // For production, implement proper JWT signing with RS256
  // This is a simplified version - in production use a proper JWT library
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createJWT(header, claim, credentials.private_key),
    }),
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Create JWT for Google OAuth (simplified - use proper library in production)
 */
function createJWT(header: any, payload: any, _privateKey: string): string {
  // In production, use a proper JWT library like jose
  // This is a placeholder that would need proper implementation
  const base64Header = btoa(JSON.stringify(header));
  const base64Payload = btoa(JSON.stringify(payload));
  
  // Note: Actual RS256 signing would require crypto library
  // For now, return placeholder - must implement proper signing
  return `${base64Header}.${base64Payload}.signature`;
}

