'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/auth';

export function useAuthGuard() {
  const router = useRouter();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasAcceptedTerms = useAuthStore((s) => s.hasAcceptedTerms);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    // loadStoredAuth sets isLoading: true synchronously before reading localStorage,
    // so the redirect effect below will never fire with stale isAuthenticated=false
    loadStoredAuth();
  }, []); // eslint-disable-line

  useEffect(() => {
    // Only evaluate after loadStoredAuth has finished (isLoading: false)
    if (isLoading) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (!hasAcceptedTerms) { router.replace('/terms'); return; }
  }, [isLoading, isAuthenticated, hasAcceptedTerms, router]);

  return { isLoading, isAuthenticated, hasAcceptedTerms };
}

export function useTermsGuard() {
  const router = useRouter();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasAcceptedTerms = useAuthStore((s) => s.hasAcceptedTerms);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (hasAcceptedTerms) { router.replace('/home'); return; }
  }, [isLoading, isAuthenticated, hasAcceptedTerms, router]);

  return { isLoading, isAuthenticated, hasAcceptedTerms };
}
