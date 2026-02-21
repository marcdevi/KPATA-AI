import crypto from 'crypto';

type PaystackInitResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string;
    channel?: string;
    metadata?: Record<string, unknown>;
  };
};

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('Missing PAYSTACK_SECRET_KEY');
  }
  return key;
}

export function verifyPaystackSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const secret = getPaystackSecretKey();
  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}

export async function paystackInitializeTransaction(input: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const secret = getPaystackSecretKey();

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  const json = (await res.json()) as PaystackInitResponse;
  if (!res.ok || !json.status || !json.data?.authorization_url) {
    throw new Error(json.message || 'Paystack initialize failed');
  }

  return {
    authorizationUrl: json.data.authorization_url,
    reference: json.data.reference,
  };
}

export async function paystackVerifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
  const secret = getPaystackSecretKey();

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });

  const json = (await res.json()) as PaystackVerifyResponse;
  if (!res.ok || !json.status) {
    throw new Error(json.message || 'Paystack verify failed');
  }

  return json;
}
