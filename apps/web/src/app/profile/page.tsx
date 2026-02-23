'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/AppShell';
import LoadingScreen from '@/components/LoadingScreen';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuthStore } from '@/store/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuthGuard();
  const { email, phoneE164, role, logout } = useAuthStore();

  const handleLogout = () => {
    if (!confirm('Es-tu sûr de vouloir te déconnecter ?')) return;
    logout();
    router.replace('/login');
  };

  const menuItems = [
    { icon: '👕', label: 'Mon Mannequin', href: '/mannequin' },
    { icon: '💬', label: 'Support', href: '/support' },
  ];

  if (authLoading) return <LoadingScreen />;

  return (
    <AppShell>
      <div className="pb-6">
        {/* Header */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-gray-100">
          <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
            <span className="text-4xl">👤</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{email || phoneE164 || 'Utilisateur'}</p>
          <div className="mt-2 bg-indigo-50 px-3 py-1 rounded-xl">
            <p className="text-indigo-600 font-semibold text-sm">{role === 'user_pro' ? '⭐ PRO' : '🆓 Gratuit'}</p>
          </div>
        </div>

        {/* Menu */}
        <div className="px-4 pt-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => item.href !== '#' ? router.push(item.href) : alert('Fonctionnalité en développement')}
              className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="flex-1 text-left text-base text-gray-900">{item.label}</span>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="px-4 mt-4">
          <button
            onClick={handleLogout}
            className="w-full p-4 bg-red-50 rounded-xl text-red-600 font-semibold hover:bg-red-100 transition-colors"
          >
            🚪 Déconnexion
          </button>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">KPATA AI v1.0.0</p>
      </div>
    </AppShell>
  );
}
