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
  const { profileId } = useAuthStore.getState();

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(profileId ? { 'x-profile-id': profileId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || { message: 'Unknown error', code: 'UNKNOWN' } };
    }

    return { data };
  } catch (error) {
    return { error: { message: String(error), code: 'NETWORK_ERROR' } };
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

// Profile
export async function getProfile() {
  return request<{
    profile: { id: string; phone_e164: string };
    credits: { balance: number };
    plan: { role: string; capabilities: string[] };
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
    }>;
    pagination: { total: number; limit: number; offset: number };
  }>('GET', `${ENDPOINTS.jobs}?limit=${limit}&offset=${offset}`);
}

export async function getJob(jobId: string) {
  return request<{ job: { id: string; status: string } }>('GET', ENDPOINTS.jobById(jobId));
}

// Payments
export async function getCreditPacks() {
  return request<{
    packs: Array<{
      id: string;
      name: string;
      credits: number;
      price_xof: number;
      active: boolean;
    }>;
  }>('GET', ENDPOINTS.packs);
}

export async function initPayment(packId: string, provider: 'orange_money' | 'mtn_momo' | 'wave') {
  return request<{ payment: { id: string }; redirectUrl?: string }>('POST', ENDPOINTS.paymentInit, {
    packId,
    provider,
  });
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
