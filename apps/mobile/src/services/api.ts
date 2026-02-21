/**
 * API Service for KPATA AI Mobile App
 */

import { API_CONFIG, ENDPOINTS } from '../config/api';
import { useAuthStore } from '../store/auth';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiResponse<T> {
  data?: T;
  error?: { message: string; code: string };
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const { token } = useAuthStore.getState();

  const url = `${API_CONFIG.baseUrl}${endpoint}`;

  console.log('[API] Request:', method, endpoint, 'URL:', url, 'Token:', token ? 'present' : 'missing');
  if (body && endpoint === '/jobs') {
    console.log('[API] Job creation body:', JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('[API] Error response:', JSON.stringify(data, null, 2));
      return { error: data.error || { message: 'Unknown error', code: 'UNKNOWN' } };
    }

    return { data };
  } catch (error) {
    console.log('[API] Network error:', error);
    return {
      error: {
        message: `Network request failed (${method} ${url})`,
        code: 'NETWORK_ERROR',
      },
    };
  }
}

// Auth
export async function sendOtp(phoneE164: string, channel: 'sms' | 'whatsapp' = 'sms') {
  return request<{ sent: boolean }>('POST', ENDPOINTS.sendOtp, { phoneE164, channel });
}

export async function verifyOtp(phoneE164: string, code: string) {
  return request<{ profile: { id: string }; isNew: boolean; hasAcceptedTerms: boolean }>(
    'POST',
    ENDPOINTS.verifyOtp,
    { phoneE164, code }
  );
}

export async function linkPhone(phoneE164: string) {
  return request<{ profile: { id: string }; isNew: boolean }>('POST', ENDPOINTS.phoneLink, { phoneE164 });
}

export async function authBootstrap() {
  return request<{ ok: boolean; profile: { id: string; email: string | null; role: string; termsAcceptedAt: string | null } }>(
    'POST',
    ENDPOINTS.authBootstrap
  );
}

// Profile
export async function getProfile() {
  return request<{
    profile: {
      id: string;
      phone: string | null;
      email: string | null;
      role: string;
      displayName: string | null;
      avatarUrl: string | null;
      termsAcceptedAt: string | null;
      termsVersion: string | null;
      createdAt: string;
      updatedAt: string;
    };
    credits: { balance: number };
    plan: { id: string; name: string };
    capabilities: string[];
  }>('GET', ENDPOINTS.me);
}

export async function acceptTerms(version = '1.0.0') {
  return request<{ accepted: boolean }>('POST', ENDPOINTS.termsAccept, { version });
}

// Jobs
export async function createJob(options: {
  category: string;
  backgroundStyle: string;
  templateLayout: string;
  mannequinMode: string;
  clientRequestId?: string;
  imageBase64?: string;
}) {
  return request<{ job: { id: string }; creditsRemaining: number; wasCreated: boolean }>(
    'POST',
    ENDPOINTS.jobs,
    {
      sourceChannel: 'mobile_app',
      ...options,
    }
  );
}

export async function getJobs(limit = 20, offset = 0) {
  return request<{
    jobs: Array<{
      id: string;
      status: string;
      category: string;
      background_style: string;
      template_layout: string;
      created_at: string;
      completed_at?: string;
      thumbnail_url?: string | null;
    }>;
    pagination: { total: number; limit: number; offset: number };
  }>('GET', `${ENDPOINTS.jobs}?limit=${limit}&offset=${offset}`);
}

export async function getJob(jobId: string) {
  return request<{
    job: {
      id: string;
      status: string;
      category: string;
      background_style: string;
      template_layout: string;
      created_at: string;
      completed_at?: string;
    };
    assets: Array<{
      id: string;
      type: string;
      width: number;
      height: number;
      metadata?: {
        format?: string;
        variant?: string;
        url?: string;
      };
    }>;
  }>('GET', ENDPOINTS.jobById(jobId));
}

// Payments
export async function getCreditPacks() {
  return request<{
    packs: Array<{
      id: string;
      code: string;
      name: string;
      credits: number;
      price_xof: number;
      active: boolean;
    }>;
  }>('GET', ENDPOINTS.packs);
}

export async function initPayment(packCode: string, provider: 'orange_money' | 'mtn_momo' | 'wave' | 'paystack') {
  return request<{ payment: { id: string; providerRef: string }; redirectUrl?: string }>('POST', ENDPOINTS.paymentInit, {
    packCode,
    provider,
  });
}

export async function verifyPaystack(reference: string) {
  return request<{ ok: boolean; status: string; paymentId: string; creditsAdded?: number }>(
    'GET',
    `/payments/verify/${encodeURIComponent(reference)}`
  );
}

// Content
export async function reportContent(data: {
  jobId?: string;
  assetId?: string;
  profileId?: string;
  reason: string;
  description?: string;
}) {
  return request<{ report: { id: string } }>('POST', ENDPOINTS.report, data);
}

// Mannequins
export async function createMannequin(data: {
  faceImageBase64: string;
  bodyImageBase64: string;
  isCelebrityConfirmed: boolean;
}) {
  return request<{ mannequin: { id: string; faceImageUrl: string; bodyImageUrl: string } }>(
    'POST',
    ENDPOINTS.mannequins,
    data
  );
}

export async function getMannequin() {
  return request<{
    mannequin: {
      id: string;
      faceImageUrl: string;
      bodyImageUrl: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    } | null;
  }>('GET', ENDPOINTS.mannequinMe);
}

export async function deleteMannequin() {
  return request<{ deleted: boolean }>('DELETE', ENDPOINTS.mannequinMe);
}

// Support
export async function createTicket(subject: string, message: string) {
  return request<{ ticket: { id: string } }>('POST', ENDPOINTS.tickets, { subject, message });
}

// Dev
export async function devLogin() {
  return request<{
    token: string;
    profile: {
      id: string;
      phone: string;
      role: string;
      displayName: string;
      termsAcceptedAt: string;
      termsVersion: string;
    };
    capabilities: Record<string, unknown>;
    credits: number;
  }>('POST', '/dev/login');
}
