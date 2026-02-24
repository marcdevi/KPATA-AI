/**
 * OpenRouter AI Generation for KPATA AI Worker
 * Configurable model routing with fallback
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

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

export interface ModelRouting {
  provider: string;
  model: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  imageBase64?: string;
  width?: number;
  height?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
}

export interface GenerationResult {
  imageBase64: string;
  modelUsed: string;
  providerUsed: string;
  costActual?: number;
  durationMs: number;
  usedFallback: boolean;
}

/**
 * Get model routing configuration from database
 */
export async function getModelRouting(category: string): Promise<ModelRouting> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('model_routing')
      .select('*')
      .eq('category', category)
      .eq('active', true)
      .single();

    if (error || !data) {
      // Default routing
      return {
        provider: 'openrouter',
        model: 'anthropic/claude-3-haiku',
        fallbackProvider: 'openrouter',
        fallbackModel: 'openai/gpt-4o-mini',
        maxRetries: 3,
        timeoutMs: 30000,
      };
    }

    return {
      provider: data.provider,
      model: data.model,
      fallbackProvider: data.fallback_provider,
      fallbackModel: data.fallback_model,
      maxRetries: data.max_retries || 3,
      timeoutMs: data.timeout_ms || 30000,
    };
  } catch {
    // Default on error
    return {
      provider: 'openrouter',
      model: 'anthropic/claude-3-haiku',
      maxRetries: 3,
      timeoutMs: 30000,
    };
  }
}

/**
 * Generate image using OpenRouter API
 */
export async function generateWithOpenRouter(
  request: GenerationRequest,
  routing: ModelRouting,
  correlationId: string
): Promise<GenerationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  const startTime = Date.now();
  let currentProvider = routing.provider;
  let currentModel = routing.model;

  // Try primary model
  try {
    const result = await callOpenRouter(apiKey, currentModel, request, routing.timeoutMs);
    return {
      ...result,
      providerUsed: currentProvider,
      modelUsed: currentModel,
      durationMs: Date.now() - startTime,
      usedFallback: false,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`[${correlationId}] Primary model failed, trying fallback: ${error}`);

    // Try fallback if available
    if (routing.fallbackProvider && routing.fallbackModel) {
      currentProvider = routing.fallbackProvider;
      currentModel = routing.fallbackModel;

      try {
        const result = await callOpenRouter(apiKey, currentModel, request, routing.timeoutMs);
        return {
          ...result,
          providerUsed: currentProvider,
          modelUsed: currentModel,
          durationMs: Date.now() - startTime,
          usedFallback: true,
        };
      } catch (fallbackError) {
        throw new Error(`Both primary and fallback models failed: ${fallbackError}`);
      }
    }

    throw error;
  }
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(
  _apiKey: string,
  _model: string,
  _request: GenerationRequest,
  timeoutMs: number
): Promise<{ imageBase64: string; costActual?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // For MVP: This is a placeholder for actual OpenRouter image generation
    // In production, this would call the actual API
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // For MVP, return a placeholder
    // In production: actual API call to OpenRouter
    /*
    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kpata.ai',
        'X-Title': 'KPATA AI',
      },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        negative_prompt: request.negativePrompt,
        width: request.width || 1024,
        height: request.height || 1024,
        guidance_scale: request.guidanceScale || 7.5,
        num_inference_steps: request.numInferenceSteps || 30,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      imageBase64: data.data[0].b64_json,
      costActual: data.usage?.total_cost,
    };
    */

    // Placeholder return for MVP
    return {
      imageBase64: '', // Would be actual generated image
      costActual: 0.001,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
