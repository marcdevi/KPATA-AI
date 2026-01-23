/**
 * Auth Store for KPATA AI Mobile App
 * Manages authentication state with Zustand
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  profileId: string | null;
  phoneE164: string | null;
  role: string | null;
  hasAcceptedTerms: boolean;
  credits: number;
  token: string | null;
  
  // Actions
  setAuth: (data: { profileId: string; phoneE164: string; role: string; hasAcceptedTerms: boolean; token?: string }) => void;
  setCredits: (credits: number) => void;
  setTermsAccepted: (accepted: boolean) => void;
  logout: () => void;
  loadStoredAuth: () => Promise<void>;
}

const STORAGE_KEY = 'kpata_auth';

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  profileId: null,
  phoneE164: null,
  role: null,
  hasAcceptedTerms: false,
  credits: 0,
  token: null,

  setAuth: (data) => {
    set({
      isAuthenticated: true,
      profileId: data.profileId,
      phoneE164: data.phoneE164,
      role: data.role,
      hasAcceptedTerms: data.hasAcceptedTerms,
      token: data.token || null,
    });
    
    // Persist to secure storage
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({
      profileId: data.profileId,
      phoneE164: data.phoneE164,
      role: data.role,
      hasAcceptedTerms: data.hasAcceptedTerms,
      token: data.token || null,
    }));
  },

  setCredits: (credits) => set({ credits }),

  setTermsAccepted: (accepted) => {
    set({ hasAcceptedTerms: accepted });
    const state = get();
    if (state.profileId) {
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({
        profileId: state.profileId,
        phoneE164: state.phoneE164,
        role: state.role,
        hasAcceptedTerms: accepted,
      }));
    }
  },

  logout: () => {
    set({
      isAuthenticated: false,
      profileId: null,
      phoneE164: null,
      role: null,
      hasAcceptedTerms: false,
      credits: 0,
      token: null,
    });
    SecureStore.deleteItemAsync(STORAGE_KEY);
  },

  loadStoredAuth: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          isAuthenticated: true,
          profileId: data.profileId,
          phoneE164: data.phoneE164,
          role: data.role,
          hasAcceptedTerms: data.hasAcceptedTerms,
          token: data.token || null,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
