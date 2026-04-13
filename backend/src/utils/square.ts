/**
 * Square Checkout API service.
 * Modular — swap this file to change payment providers.
 */

import crypto from 'crypto';

const SQUARE_BASE_URL = process.env.SQUARE_ENVIRONMENT === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com';

const SQUARE_VERSION = '2025-01-23';

function getAccessToken(): string {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('Square access token not configured');
  return token;
}

// ─── Location ID (cached) ────────────────────────

let cachedLocationId: string | null = null;

async function getLocationId(): Promise<string> {
  // Allow explicit override via env
  if (process.env.SQUARE_LOCATION_ID) return process.env.SQUARE_LOCATION_ID;
  if (cachedLocationId) return cachedLocationId;

  const token = getAccessToken();
  const response = await fetch(`${SQUARE_BASE_URL}/v2/locations`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Square list locations failed: ${response.status} ${body}`);
  }

  const data = await response.json() as any;
  const locations = data.locations || [];

  if (locations.length === 0) {
    throw new Error('No Square locations found. Create a location in your Square dashboard.');
  }

  // Use the first active location (or just the first one)
  const active = locations.find((l: any) => l.status === 'ACTIVE') || locations[0];
  cachedLocationId = active.id;
  return cachedLocationId!;
}

// ─── Create Payment Link ─────────────────────────

interface CreatePaymentLinkParams {
  clientName: string;
  clientEmail?: string;
  description: string;
  amount: number;       // In major currency units (e.g., 10.50 for £10.50)
  currency?: string;
}

interface SquarePaymentLinkResult {
  paymentLinkId: string;
  orderId: string;
  paymentLink: string;  // The checkout URL
}

export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<SquarePaymentLinkResult> {
  const token = getAccessToken();
  const locationId = await getLocationId();
  const currency = params.currency || 'GBP';

  // Square uses smallest currency unit (pence for GBP)
  const amountInSmallestUnit = Math.round(params.amount * 100);

  const body: any = {
    idempotency_key: crypto.randomUUID(),
    quick_pay: {
      name: params.description.substring(0, 200),
      price_money: {
        amount: amountInSmallestUnit,
        currency,
      },
      location_id: locationId,
    },
    checkout_options: {
      allow_tipping: false,
      enable_coupon: false,
    },
  };

  // Pre-populate buyer email if provided
  if (params.clientEmail) {
    body.pre_populated_data = {
      buyer_email: params.clientEmail,
    };
  }

  // Add a note with client name
  body.description = `Invoice for ${params.clientName}`;

  const response = await fetch(`${SQUARE_BASE_URL}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Square create payment link failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json() as any;
  const paymentLink = data.payment_link;

  return {
    paymentLinkId: paymentLink.id,
    orderId: paymentLink.order_id,
    paymentLink: paymentLink.url || paymentLink.long_url,
  };
}

// ─── Delete (Cancel) Payment Link ────────────────

export async function deletePaymentLink(paymentLinkId: string): Promise<void> {
  const token = getAccessToken();

  const response = await fetch(`${SQUARE_BASE_URL}/v2/online-checkout/payment-links/${paymentLinkId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Square delete payment link failed: ${response.status} ${errorBody}`);
  }
}

// ─── Verify Webhook Signature ────────────────────

export function verifyWebhookSignature(
  signatureHeader: string,
  body: string,
  notificationUrl: string,
  signatureKey: string,
): boolean {
  // Square HMAC-SHA256: hash(notificationUrl + body) using signature key
  const hmac = crypto
    .createHmac('sha256', signatureKey)
    .update(notificationUrl + body)
    .digest('base64');

  return hmac === signatureHeader;
}
