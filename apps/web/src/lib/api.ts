import { useAuthStore } from '@/store/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiResponse<T> {
  data?: T;
  error?: { message: string; code: string };
}

async function request<T>(method: HttpMethod, endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  const { token } = useAuthStore.getState();
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || { message: 'Erreur inconnue', code: 'UNKNOWN' } };
    }

    return { data };
  } catch {
    return { error: { message: `Erreur réseau (${method} ${url})`, code: 'NETWORK_ERROR' } };
  }
}

export async function authBootstrap() {
  return request<{ ok: boolean; profile: { id: string; email: string | null; role: string; termsAcceptedAt: string | null } }>(
    'POST', '/auth/bootstrap'
  );
}

export async function getProfile() {
  return request<{
    profile: { id: string; phone: string | null; email: string | null; role: string; displayName: string | null; avatarUrl: string | null; termsAcceptedAt: string | null; termsVersion: string | null; createdAt: string; updatedAt: string };
    credits: { balance: number };
    plan: { id: string; name: string };
    capabilities: string[];
  }>('GET', '/me');
}

export async function acceptTerms(version = '1.0.0') {
  return request<{ accepted: boolean }>('POST', '/terms/accept', { version });
}

export async function createJob(options: {
  category: string;
  backgroundStyle: string;
  templateLayout: string;
  mannequinMode: string;
  clientRequestId?: string;
  imageBase64?: string;
}) {
  return request<{ job: { id: string }; creditsRemaining: number; wasCreated: boolean }>(
    'POST', '/jobs', { sourceChannel: 'web_app', ...options }
  );
}

export async function getJobs(limit = 20, offset = 0) {
  return request<{
    jobs: Array<{ id: string; status: string; category: string; background_style: string; template_layout: string; created_at: string; completed_at?: string; thumbnail_url?: string | null }>;
    pagination: { total: number; limit: number; offset: number };
  }>('GET', `/jobs?limit=${limit}&offset=${offset}`);
}

export async function getJob(jobId: string) {
  return request<{
    job: { id: string; status: string; category: string; background_style: string; template_layout: string; created_at: string; completed_at?: string };
    assets: Array<{ id: string; type: string; width: number; height: number; metadata?: { format?: string; variant?: string; url?: string } }>;
  }>('GET', `/jobs/${jobId}`);
}

export async function getCreditPacks() {
  return request<{
    packs: Array<{ id: string; code: string; name: string; credits: number; price_xof: number; active: boolean }>;
  }>('GET', '/payments/packs');
}

export async function initPayment(packCode: string, provider: 'paystack') {
  return request<{ payment: { id: string; providerRef: string }; redirectUrl?: string }>(
    'POST', '/payments/init', { packCode, provider }
  );
}

export async function verifyPaystack(reference: string) {
  return request<{ ok: boolean; status: string; paymentId: string; creditsAdded?: number }>(
    'GET', `/payments/verify/${encodeURIComponent(reference)}`
  );
}

export async function getMannequin() {
  return request<{
    mannequin: { id: string; faceImageUrl: string; bodyImageUrl: string; status: string; createdAt: string; updatedAt: string } | null;
  }>('GET', '/mannequins/me');
}

export async function createMannequin(data: { faceImageBase64: string; bodyImageBase64: string; isCelebrityConfirmed: boolean }) {
  return request<{ mannequin: { id: string; faceImageUrl: string; bodyImageUrl: string } }>('POST', '/mannequins', data);
}

export async function createTicket(subject: string, message: string) {
  return request<{ ticket: { id: string } }>('POST', '/support/tickets', { subject, message });
}

export async function reportContent(data: { jobId?: string; reason: string; description?: string }) {
  return request<{ report: { id: string } }>('POST', '/content/report', data);
}

export async function analyzeVoice(data: { transcript: string; hasImage?: boolean; hasMannequin?: boolean }) {
  return request<{
    prompt: string;
    category: string;
    backgroundStyle: string;
    mannequinMode: string;
    summary: string;
  }>('POST', '/voice/analyze', data);
}
