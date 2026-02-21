import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ListTodo,
  MessageSquare,
  TrendingUp,
  Settings,
  CreditCard,
  LogOut,
  Menu,
} from 'lucide-react';
import { useState } from 'react';

import { useAuthStore } from '../stores/auth';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Utilisateurs', href: '/users', icon: Users },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Queue', href: '/queue', icon: ListTodo },
  { name: 'Tickets', href: '/tickets', icon: MessageSquare },
  { name: 'FinOps', href: '/finops', icon: TrendingUp },
  { name: 'Configuration', href: '/config', icon: Settings },
  { name: 'Tarification', href: '/pricing', icon: CreditCard },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navigation.filter((item) => {
    if (item.href === '/config' || item.href === '/pricing') {
      return isAdmin();
    }
    if (item.href === '/finops') {
      return isAdmin();
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar toggle */}
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-6 w-6" />
        </Button>
        <div className="flex-1">
          <span className="text-lg font-semibold text-primary">KPATA Admin</span>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 z-50 flex w-72 flex-col transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-card px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <span className="text-xl font-bold text-primary">KPATA Admin</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul className="-mx-2 space-y-1">
                  {filteredNav.map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                          location.pathname === item.href
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="flex items-center gap-x-4 px-2 py-3 text-sm">
                  <div className="flex-1 truncate">
                    <p className="font-semibold">{user?.name || user?.email || user?.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.role === 'super_admin'
                        ? 'Super Admin'
                        : user?.role === 'admin'
                          ? 'Admin'
                          : 'Support'}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={logout}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-72">
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
