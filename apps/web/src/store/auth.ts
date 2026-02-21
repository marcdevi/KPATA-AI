'use client';

import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  profileId: string | null;
  phoneE164: string | null;
  email: string | null;
  role: string | null;
  hasAcceptedTerms: boolean;
  credits: number;
  token: string | null;

  setAuth: (data: { profileId: string | null; phoneE164?: string | null; email?: string | null; role: string | null; hasAcceptedTerms: boolean; token?: string | null }) => void;
  setCredits: (credits: number) => void;
  setTermsAccepted: (accepted: boolean) => void;
  logout: () => void;
  loadStoredAuth: () => void;
}

const STORAGE_KEY = 'kpata_auth';

export const useAuthStore = create<AuthState>((set, _get) => ({
  isAuthenticated: false,
  isLoading: true,
  profileId: null,
  phoneE164: null,
  email: null,
  role: null,
  hasAcceptedTerms: false,
  credits: 0,
  token: null,

  setAuth: (data) => {
    const state = {
      isAuthenticated: true,
      profileId: data.profileId,
      phoneE164: data.phoneE164 ?? null,
      email: data.email ?? null,
      role: data.role,
      hasAcceptedTerms: data.hasAcceptedTerms,
      token: data.token ?? null,
    };
    set(state);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  },

  setCredits: (credits) => set({ credits }),

  setTermsAccepted: (accepted) => {
    set({ hasAcceptedTerms: accepted });
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, hasAcceptedTerms: accepted }));
      }
    }
  },

  logout: () => {
    set({ isAuthenticated: false, profileId: null, phoneE164: null, email: null, role: null, hasAcceptedTerms: false, credits: 0, token: null });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  loadStoredAuth: () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }
    // Always set isLoading: true first to prevent premature redirect
    set({ isLoading: true });
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.token && data.profileId) {
          set({ ...data, isAuthenticated: true, isLoading: false });
        } else {
          localStorage.removeItem(STORAGE_KEY);
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      set({ isLoading: false });
    }
  },
}));
