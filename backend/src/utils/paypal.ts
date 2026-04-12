/**
 * PayPal Invoicing API service.
 * Modular — swap this file to change payment providers.
 */

const PAYPAL_BASE_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ─── Access Token ─────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal auth failed: ${response.status} ${body}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ─── Create Draft Invoice ─────────────────────────

interface CreateInvoiceParams {
  clientName: string;
  clientEmail?: string;
  description: string;
  amount: number;
  currency?: string;
}

interface PayPalInvoiceResult {
  invoiceId: string;
  paymentLink: string;
}

export async function createAndSendInvoice(params: CreateInvoiceParams): Promise<PayPalInvoiceResult> {
  const token = await getAccessToken();
  const currency = params.currency || 'GBP';

  // 1. Create draft invoice
  const invoiceBody: any = {
    detail: {
      currency_code: currency,
      note: params.description,
      payment_term: {
        term_type: 'NET_30',
      },
    },
    items: [
      {
        name: params.description.substring(0, 200),
        quantity: '1',
        unit_amount: {
          currency_code: currency,
          value: params.amount.toFixed(2),
        },
      },
    ],
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: params.clientName,
          },
          ...(params.clientEmail ? { email_address: params.clientEmail } : {}),
        },
      },
    ],
  };

  const createResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invoiceBody),
  });

  if (!createResponse.ok) {
    const errorBody = await createResponse.text();
    throw new Error(`PayPal create invoice failed: ${createResponse.status} ${errorBody}`);
  }

  // PayPal returns the invoice URL in the Location header
  const invoiceUrl = createResponse.headers.get('location') || '';
  const invoiceId = invoiceUrl.split('/').pop() || '';

  if (!invoiceId) {
    throw new Error('Failed to extract invoice ID from PayPal response');
  }

  // 2. Send the invoice (this generates the payment link)
  // If client email is provided, PayPal sends it directly
  // If not, we just generate the link for manual sharing
  if (params.clientEmail) {
    const sendResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        send_to_invoicer: false,
      }),
    });

    if (!sendResponse.ok) {
      const errorBody = await sendResponse.text();
      throw new Error(`PayPal send invoice failed: ${sendResponse.status} ${errorBody}`);
    }
  } else {
    // No email — just send with send_to_recipient: false to mark it as sent
    // so we can get the payment link
    const sendResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        send_to_invoicer: false,
        send_to_recipient: false,
      }),
    });

    if (!sendResponse.ok) {
      const errorBody = await sendResponse.text();
      throw new Error(`PayPal send invoice failed: ${sendResponse.status} ${errorBody}`);
    }
  }

  // 3. Get the invoice details to extract the payment link
  const detailResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!detailResponse.ok) {
    const errorBody = await detailResponse.text();
    throw new Error(`PayPal get invoice failed: ${detailResponse.status} ${errorBody}`);
  }

  const invoiceDetail = await detailResponse.json() as any;

  // Extract payment link from HATEOAS links
  const payerLink = invoiceDetail.detail?.metadata?.recipient_view_url
    || invoiceDetail.links?.find((l: any) => l.rel === 'payer-view')?.href
    || `https://www.${process.env.PAYPAL_MODE === 'live' ? '' : 'sandbox.'}paypal.com/invoice/p/#${invoiceId}`;

  return {
    invoiceId,
    paymentLink: payerLink,
  };
}

// ─── Cancel Invoice ───────────────────────────────

export async function cancelInvoice(invoiceId: string): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: 'Invoice cancelled',
      note: 'This invoice has been cancelled.',
      send_to_invoicer: false,
      send_to_recipient: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayPal cancel invoice failed: ${response.status} ${errorBody}`);
  }
}

// ─── Verify Webhook Signature ─────────────────────

interface WebhookVerifyParams {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: any;
}

export async function verifyWebhookSignature(params: WebhookVerifyParams): Promise<boolean> {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: params.authAlgo,
      cert_url: params.certUrl,
      transmission_id: params.transmissionId,
      transmission_sig: params.transmissionSig,
      transmission_time: params.transmissionTime,
      webhook_id: params.webhookId,
      webhook_event: params.webhookEvent,
    }),
  });

  if (!response.ok) {
    console.error('Webhook verification request failed:', response.status);
    return false;
  }

  const data = await response.json() as { verification_status: string };
  return data.verification_status === 'SUCCESS';
}
