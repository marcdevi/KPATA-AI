import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '@kpata/shared';

interface User {
  id: string;
  phone?: string;
  email?: string;
  role: UserRole;
  name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  isSupport: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        localStorage.setItem('admin_token', token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('admin_token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      hasRole: (...roles) => {
        const { user } = get();
        return user ? roles.includes(user.role) : false;
      },

      isSuperAdmin: () => get().hasRole(UserRole.SUPER_ADMIN),

      isAdmin: () => get().hasRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),

      isSupport: () =>
        get().hasRole(UserRole.SUPPORT_AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    }),
    {
      name: 'kpata-admin-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
