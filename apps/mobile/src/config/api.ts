/**
 * API Configuration for KPATA AI Mobile App
 */

export const API_CONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  mediaWorkerUrl: process.env.EXPO_PUBLIC_MEDIA_WORKER_URL || '',
  timeout: 30000,
};

export const ENDPOINTS = {
  // Auth
  sendOtp: '/auth/otp/send',
  verifyOtp: '/auth/otp/verify',
  phoneLink: '/auth/phone/link',
  
  // Profile
  me: '/me',
  termsAccept: '/terms/accept',
  
  // Jobs
  jobs: '/jobs',
  jobById: (id: string) => `/jobs/${id}`,
  
  // Payments
  packs: '/payments/packs',
  paymentInit: '/payments/init',
  payments: '/payments',
  
  // Content
  report: '/content/report',
  
  // Support
  tickets: '/support/tickets',
};
