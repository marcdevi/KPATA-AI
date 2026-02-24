/**
 * Stage Timing Helper for KPATA AI Worker
 * Tracks duration of each processing stage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

export interface StageDurations {
  [stage: string]: number;
}

/**
 * Stage timing context for a job
 */
export class StageTimer {
  private jobId: string;
  private correlationId: string;
  private durations: StageDurations = {};

  constructor(jobId: string, correlationId: string) {
    this.jobId = jobId;
    this.correlationId = correlationId;
  }

  /**
   * Execute a function and track its duration under a stage name
   */
  async withStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      this.durations[stage] = Date.now() - startTime;
      return result;
    } catch (error) {
      this.durations[stage] = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Get all recorded durations
   */
  getDurations(): StageDurations {
    return { ...this.durations };
  }

  /**
   * Get total duration across all stages
   */
  getTotalDuration(): number {
    return Object.values(this.durations).reduce((sum, d) => sum + d, 0);
  }

  /**
   * Save stage durations to the database
   */
  async saveDurations(): Promise<void> {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('jobs')
      .update({
        stage_durations: this.durations,
        duration_ms_total: this.getTotalDuration(),
      })
      .eq('id', this.jobId);

    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[${this.correlationId}] Failed to save stage durations:`, error);
    }
  }
}

/**
 * Create a stage timer for a job
 */
export function createStageTimer(jobId: string, correlationId: string): StageTimer {
  return new StageTimer(jobId, correlationId);
}
