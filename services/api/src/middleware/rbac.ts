/**
 * RBAC Middleware for KPATA AI API
 * Role-based access control with permission mapping
 */

import { UserRole } from '@kpata/shared';
import { Request, Response, NextFunction } from 'express';

import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

/**
 * Permission definitions for admin operations
 */
export const PERMISSIONS = {
  // Credit operations
  CREDITS_VIEW: 'credits:view',
  CREDITS_ADJUST: 'credits:adjust',
  CREDITS_REFUND: 'credits:refund',

  // User management
  USERS_VIEW: 'users:view',
  USERS_EDIT: 'users:edit',
  USERS_BAN: 'users:ban',

  // Job management
  JOBS_VIEW: 'jobs:view',
  JOBS_CANCEL: 'jobs:cancel',
  JOBS_RETRY: 'jobs:retry',
  JOBS_MANAGE: 'jobs:manage',

  // Support
  TICKETS_VIEW: 'tickets:view',
  TICKETS_RESPOND: 'tickets:respond',
  TICKETS_CLOSE: 'tickets:close',
  TICKETS_MANAGE: 'tickets:manage',

  // Admin
  ADMIN_AUDIT_VIEW: 'admin:audit:view',
  ADMIN_CONFIG_VIEW: 'admin:config:view',
  ADMIN_CONFIG_EDIT: 'admin:config:edit',
  ADMIN_ROLES_MANAGE: 'admin:roles:manage',

  // Reports & Dashboard
  REPORTS_VIEW: 'reports:view',

  // Queue management
  QUEUE_VIEW: 'queue:view',
  QUEUE_MANAGE: 'queue:manage',

  // Pricing management
  PRICING_VIEW: 'pricing:view',
  PRICING_EDIT: 'pricing:edit',

  // Config (used by config.ts and pricing.ts routes)
  CONFIG_VIEW: 'config:view',
  CONFIG_EDIT: 'config:edit',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role to permissions mapping
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER_FREE]: [],
  [UserRole.USER_PRO]: [],
  [UserRole.RESELLER]: [
    PERMISSIONS.CREDITS_VIEW,
  ],
  [UserRole.SUPPORT_AGENT]: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.JOBS_VIEW,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_RESPOND,
    PERMISSIONS.TICKETS_CLOSE,
  ],
  [UserRole.ADMIN]: [
    PERMISSIONS.CREDITS_VIEW,
    PERMISSIONS.CREDITS_ADJUST,
    PERMISSIONS.CREDITS_REFUND,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.USERS_BAN,
    PERMISSIONS.JOBS_VIEW,
    PERMISSIONS.JOBS_CANCEL,
    PERMISSIONS.JOBS_RETRY,
    PERMISSIONS.JOBS_MANAGE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_RESPOND,
    PERMISSIONS.TICKETS_CLOSE,
    PERMISSIONS.TICKETS_MANAGE,
    PERMISSIONS.ADMIN_AUDIT_VIEW,
    PERMISSIONS.ADMIN_CONFIG_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.QUEUE_VIEW,
    PERMISSIONS.QUEUE_MANAGE,
    PERMISSIONS.PRICING_VIEW,
    PERMISSIONS.CONFIG_VIEW,
  ],
  [UserRole.SUPER_ADMIN]: Object.values(PERMISSIONS),
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        phone: string;
        email?: string | null;
        hasProfile?: boolean;
      };
    }
  }
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Middleware factory to require specific roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`Role ${req.user.role} is not authorized for this action`);
    }

    next();
  };
}

/**
 * Middleware factory to require specific permissions
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
}

/**
 * Middleware to require any admin role
 */
export const requireAdmin = requireRole(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN
);

/**
 * Middleware to require support or higher
 */
export const requireSupport = requireRole(
  UserRole.SUPPORT_AGENT,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN
);
