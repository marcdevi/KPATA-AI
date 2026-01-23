import { UserRole } from '../enums/index.js';

export interface AdminAuditLog {
  id: string;
  actorId?: string;
  actorRole: UserRole;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface AuditLogCreateInput {
  actorId?: string;
  actorRole: UserRole;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
