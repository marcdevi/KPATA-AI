/**
 * Plans & Entitlements for KPATA AI
 * Defines capabilities per user plan
 */

import { UserRole } from '@kpata/shared';

export interface PlanCapabilities {
  maxJobsPerDay: number;
  maxJobsPerMonth: number;
  availableStyles: string[];
  availableBackgrounds: string[];
  priorityQueue: boolean;
  watermark: boolean;
  hdOutput: boolean;
  batchProcessing: boolean;
  apiAccess: boolean;
}

export interface Plan {
  id: string;
  name: string;
  role: UserRole;
  capabilities: PlanCapabilities;
}

/**
 * All available styles
 */
export const ALL_STYLES = [
  'casual',
  'formal',
  'business',
  'streetwear',
  'elegant',
  'sporty',
  'vintage',
  'minimalist',
  'bohemian',
  'preppy',
] as const;

/**
 * All available backgrounds
 */
export const ALL_BACKGROUNDS = [
  'studio_white',
  'studio_gray',
  'outdoor_urban',
  'outdoor_nature',
  'indoor_modern',
  'indoor_classic',
  'gradient',
  'custom',
] as const;

/**
 * Free tier styles (limited)
 */
export const FREE_STYLES = ['casual', 'formal', 'business'] as const;

/**
 * Free tier backgrounds (limited)
 */
export const FREE_BACKGROUNDS = ['studio_white', 'studio_gray'] as const;

/**
 * Plan configurations
 */
export const PLANS: Record<string, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    role: UserRole.USER_FREE,
    capabilities: {
      maxJobsPerDay: 3,
      maxJobsPerMonth: 30,
      availableStyles: [...FREE_STYLES],
      availableBackgrounds: [...FREE_BACKGROUNDS],
      priorityQueue: false,
      watermark: true,
      hdOutput: false,
      batchProcessing: false,
      apiAccess: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    role: UserRole.USER_PRO,
    capabilities: {
      maxJobsPerDay: 50,
      maxJobsPerMonth: 1000,
      availableStyles: [...ALL_STYLES],
      availableBackgrounds: [...ALL_BACKGROUNDS],
      priorityQueue: true,
      watermark: false,
      hdOutput: true,
      batchProcessing: true,
      apiAccess: true,
    },
  },
  reseller: {
    id: 'reseller',
    name: 'Reseller',
    role: UserRole.RESELLER,
    capabilities: {
      maxJobsPerDay: 200,
      maxJobsPerMonth: 5000,
      availableStyles: [...ALL_STYLES],
      availableBackgrounds: [...ALL_BACKGROUNDS],
      priorityQueue: true,
      watermark: false,
      hdOutput: true,
      batchProcessing: true,
      apiAccess: true,
    },
  },
};

/**
 * Get plan by role
 */
export function getPlanByRole(role: UserRole): Plan {
  switch (role) {
    case UserRole.USER_PRO:
      return PLANS.pro;
    case UserRole.RESELLER:
      return PLANS.reseller;
    case UserRole.SUPPORT_AGENT:
    case UserRole.ADMIN:
    case UserRole.SUPER_ADMIN:
      return PLANS.pro; // Staff get pro capabilities
    default:
      return PLANS.free;
  }
}

/**
 * Get capabilities for a user role
 */
export function getCapabilities(role: UserRole): PlanCapabilities {
  return getPlanByRole(role).capabilities;
}

/**
 * Check if a style is available for a role
 */
export function isStyleAvailable(role: UserRole, style: string): boolean {
  const capabilities = getCapabilities(role);
  return capabilities.availableStyles.includes(style);
}

/**
 * Check if a background is available for a role
 */
export function isBackgroundAvailable(role: UserRole, background: string): boolean {
  const capabilities = getCapabilities(role);
  return capabilities.availableBackgrounds.includes(background);
}
