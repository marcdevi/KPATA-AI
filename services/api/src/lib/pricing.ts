/**
 * Pricing Configuration for KPATA AI
 * Reads pricing_config from database
 */

import { getSupabaseClient } from './supabase.js';

export interface PricingConfig {
  creditsPerJob: number;
  maxJobsPerMinute: number;
  freeCreditsOnSignup: number;
  marginAlertThreshold: number;
}

const DEFAULT_CONFIG: PricingConfig = {
  creditsPerJob: 1,
  maxJobsPerMinute: 6,
  freeCreditsOnSignup: 2,
  marginAlertThreshold: 0.2,
};

let cachedConfig: PricingConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get pricing configuration from database with caching
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  const now = Date.now();
  
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('pricing_config')
    .select('key, value');

  if (error || !data) {
    return DEFAULT_CONFIG;
  }

  const config: PricingConfig = { ...DEFAULT_CONFIG };

  for (const row of data) {
    const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    
    switch (row.key) {
      case 'credits_per_job':
        config.creditsPerJob = Number(value) || DEFAULT_CONFIG.creditsPerJob;
        break;
      case 'max_jobs_per_minute':
        config.maxJobsPerMinute = Number(value) || DEFAULT_CONFIG.maxJobsPerMinute;
        break;
      case 'free_credits_on_signup':
        config.freeCreditsOnSignup = Number(value) || DEFAULT_CONFIG.freeCreditsOnSignup;
        break;
      case 'margin_alert_threshold':
        config.marginAlertThreshold = Number(value) || DEFAULT_CONFIG.marginAlertThreshold;
        break;
    }
  }

  cachedConfig = config;
  cacheExpiry = now + CACHE_TTL_MS;

  return config;
}

/**
 * Get credits per job (convenience function)
 */
export async function getCreditsPerJob(): Promise<number> {
  const config = await getPricingConfig();
  return config.creditsPerJob;
}

/**
 * Clear pricing config cache (for testing or admin updates)
 */
export function clearPricingCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}
