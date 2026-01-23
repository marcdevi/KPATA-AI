/**
 * Supabase Client for KPATA AI API
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    _client = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _client;
}

/**
 * Get Supabase client with correlation ID for tracing
 * Note: Supabase doesn't natively support custom headers per-request
 * We'll pass correlation_id as a parameter to RPC calls instead
 */
export function getSupabaseClientWithCorrelation(_correlationId: string): SupabaseClient {
  return getSupabaseClient();
}

export { SupabaseClient };
