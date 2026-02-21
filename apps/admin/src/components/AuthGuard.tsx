import { Navigate } from 'react-router-dom';
import { UserRole } from '@kpata/shared';

import { useAuthStore } from '../stores/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

const STAFF_ROLES = [UserRole.SUPPORT_AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN];

export function AuthGuard({ children, requiredRoles = STAFF_ROLES }: AuthGuardProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!requiredRoles.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Accès refusé</h1>
          <p className="mt-2 text-muted-foreground">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
