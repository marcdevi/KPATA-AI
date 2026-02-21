'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/auth';

const PUBLIC_ROUTES = ['/login'];
const TERMS_ROUTE = '/terms';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasAcceptedTerms = useAuthStore((s) => s.hasAcceptedTerms);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_ROUTES.includes(pathname);
    const isTerms = pathname === TERMS_ROUTE;

    if (!isAuthenticated && !isPublic) {
      router.replace('/login');
      return;
    }

    if (isAuthenticated && !hasAcceptedTerms && !isTerms) {
      router.replace('/terms');
      return;
    }

    if (isAuthenticated && hasAcceptedTerms && (isPublic || isTerms)) {
      router.replace('/home');
      return;
    }
  }, [isLoading, isAuthenticated, hasAcceptedTerms, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isTerms = pathname === TERMS_ROUTE;

  if (!isAuthenticated && !isPublic) return null;
  if (!isAuthenticated && isTerms) return null;
  if (isAuthenticated && !hasAcceptedTerms && !isTerms) return null;

  return <>{children}</>;
}
