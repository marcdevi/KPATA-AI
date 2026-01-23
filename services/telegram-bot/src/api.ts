/**
 * API Client for KPATA AI Telegram Bot
 * Communicates with the main API service
 */

import { config } from './config.js';

interface ApiResponse<T> {
  data?: T;
  error?: { message: string; code: string };
}

/**
 * Make API request
 */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json() as T | { error: { message: string; code: string } };

    if (!response.ok) {
      const errorData = data as { error: { message: string; code: string } };
      return { error: errorData.error || { message: 'Unknown error', code: 'UNKNOWN' } };
    }

    return { data: data as T };
  } catch (error) {
    return { error: { message: String(error), code: 'NETWORK_ERROR' } };
  }
}

/**
 * Link phone number to profile (get or create)
 */
export async function linkPhone(phoneE164: string): Promise<{
  profileId?: string;
  isNew?: boolean;
  error?: string;
}> {
  const result = await apiRequest<{ profile: { id: string }; isNew: boolean }>(
    'POST',
    '/auth/phone/link',
    { phoneE164 }
  );

  if (result.error) {
    return { error: result.error.message };
  }

  return {
    profileId: result.data?.profile.id,
    isNew: result.data?.isNew,
  };
}

/**
 * Accept terms of service
 */
export async function acceptTerms(profileId: string): Promise<{ success: boolean; error?: string }> {
  const result = await apiRequest<{ accepted: boolean }>(
    'POST',
    '/terms/accept',
    { version: '1.0.0' },
    { 'x-profile-id': profileId }
  );

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  return { success: true };
}

/**
 * Get user profile with credits
 */
export async function getProfile(profileId: string): Promise<{
  profile?: {
    id: string;
    credits: number;
    role: string;
  };
  error?: string;
}> {
  const result = await apiRequest<{
    profile: { id: string };
    credits: { balance: number };
    plan: { role: string };
  }>(
    'GET',
    '/me',
    undefined,
    { 'x-profile-id': profileId }
  );

  if (result.error) {
    return { error: result.error.message };
  }

  return {
    profile: {
      id: result.data?.profile.id || profileId,
      credits: result.data?.credits.balance || 0,
      role: result.data?.plan.role || 'user_free',
    },
  };
}

/**
 * Create a job
 */
export async function createJob(
  profileId: string,
  options: {
    sourceMessageId: string;
    category: string;
    backgroundStyle: string;
    templateLayout: string;
    mannequinMode: string;
  }
): Promise<{
  jobId?: string;
  creditsRemaining?: number;
  error?: string;
  errorCode?: string;
}> {
  const result = await apiRequest<{
    job: { id: string };
    creditsRemaining: number;
  }>(
    'POST',
    '/jobs',
    {
      sourceChannel: 'telegram_bot',
      sourceMessageId: options.sourceMessageId,
      category: options.category,
      backgroundStyle: options.backgroundStyle,
      templateLayout: options.templateLayout,
      mannequinMode: options.mannequinMode,
    },
    { 'x-profile-id': profileId }
  );

  if (result.error) {
    return { error: result.error.message, errorCode: result.error.code };
  }

  return {
    jobId: result.data?.job.id,
    creditsRemaining: result.data?.creditsRemaining,
  };
}

/**
 * Get job status
 */
export async function getJobStatus(
  profileId: string,
  jobId: string
): Promise<{
  status?: string;
  error?: string;
}> {
  const result = await apiRequest<{ job: { status: string } }>(
    'GET',
    `/jobs/${jobId}`,
    undefined,
    { 'x-profile-id': profileId }
  );

  if (result.error) {
    return { error: result.error.message };
  }

  return { status: result.data?.job.status };
}
