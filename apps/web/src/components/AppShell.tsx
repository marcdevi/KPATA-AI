'use client';

import { Camera, Image, Wallet, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/home', label: 'Créer', icon: Camera },
  { href: '/gallery', label: 'Galerie', icon: Image },
  { href: '/credits', label: 'Crédits', icon: Wallet },
  { href: '/profile', label: 'Profil', icon: User },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-20">{children}</div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-200 flex z-50">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <Icon size={22} />
              <span className="text-xs font-bold">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
