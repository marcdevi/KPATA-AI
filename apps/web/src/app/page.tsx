'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuthStore } from '@/store/auth';

export default function RootPage() {
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
    if (!hasAcceptedTerms) { router.replace('/terms'); return; }
    router.replace('/home');
  }, [isLoading, isAuthenticated, hasAcceptedTerms, router]);

  return <LoadingScreen />;
}
