/**
 * API Configuration for KPATA AI Mobile App
 */

import Constants from 'expo-constants';

function getPackagerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  // hostUri looks like "192.168.0.24:8081" in LAN mode
  const host = hostUri.split(':')[0];
  return host || null;
}

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  const host = getPackagerHost();
  if (host) {
    return `http://${host}:3000`;
  }

  return envUrl || 'http://localhost:3000';
}

export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  mediaWorkerUrl: process.env.EXPO_PUBLIC_MEDIA_WORKER_URL || '',
  timeout: 30000,
};

export const ENDPOINTS = {
  // Auth
  sendOtp: '/auth/otp/send',
  verifyOtp: '/auth/otp/verify',
  phoneLink: '/auth/phone/link',
  authBootstrap: '/auth/bootstrap',
  
  // Profile
  me: '/me',
  termsAccept: '/terms/accept',
  
  // Jobs
  jobs: '/jobs',
  jobById: (id: string) => `/jobs/${id}`,
  
  // Mannequins
  mannequins: '/mannequins',
  mannequinMe: '/mannequins/me',
  
  // Payments
  packs: '/payments/packs',
  paymentInit: '/payments/init',
  payments: '/payments',
  
  // Content
  report: '/content/report',
  
  // Support
  tickets: '/support/tickets',
};
