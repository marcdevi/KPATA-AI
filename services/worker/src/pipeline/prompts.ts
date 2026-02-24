/**
 * Prompt Profiles for KPATA AI Worker
 * Style-specific prompts for AI generation
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

export interface PromptProfile {
  style: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  params: Record<string, unknown>;
}

// Default prompt profiles (fallback if DB not available)
export const DEFAULT_PROMPTS: Record<string, PromptProfile> = {
  studio_white: {
    style: 'studio_white',
    name: 'Studio Blanc Pro',
    prompt: 'Professional product photography on pure white background, soft studio lighting, high-end commercial quality, clean and minimal, fashion e-commerce style',
    negativePrompt: 'shadows, colored background, busy background, low quality, blurry, watermark, text',
    params: { guidance_scale: 7.5, num_inference_steps: 30 },
  },
  studio_gray: {
    style: 'studio_gray',
    name: 'Studio Gris Élégant',
    prompt: 'Professional product photography on neutral gray background, soft diffused lighting, elegant commercial style, fashion catalog quality',
    negativePrompt: 'harsh shadows, colored background, busy background, low quality, watermark',
    params: { guidance_scale: 7.5, num_inference_steps: 30 },
  },
  gradient_soft: {
    style: 'gradient_soft',
    name: 'Dégradé Doux',
    prompt: 'Product photography with soft gradient background, professional lighting, modern aesthetic, clean fashion presentation',
    negativePrompt: 'harsh colors, busy background, low quality, watermark',
    params: { guidance_scale: 7.0, num_inference_steps: 25 },
  },
  studio_clean_white: {
    style: 'studio_clean_white',
    name: 'Studio Clean White',
    prompt: 'Ultra clean white background product photography, perfect studio lighting, high-end fashion e-commerce, crisp details, professional catalog style, no shadows on background',
    negativePrompt: 'shadows on background, gray tones, colored background, busy background, low quality, blurry, watermark, text, artifacts',
    params: { guidance_scale: 8.0, num_inference_steps: 35 },
  },
  luxury_marble_velvet: {
    style: 'luxury_marble_velvet',
    name: 'Luxe Marbre & Velours',
    prompt: 'Luxury product photography on elegant marble surface with velvet fabric accents, sophisticated studio lighting, high-end boutique aesthetic, premium fashion presentation, rich textures',
    negativePrompt: 'cheap looking, plastic, low quality, blurry, watermark, text, busy background, cluttered',
    params: { guidance_scale: 7.5, num_inference_steps: 35 },
  },
  boutique_clean_store: {
    style: 'boutique_clean_store',
    name: 'Boutique Propre',
    prompt: 'Clean boutique store setting, minimalist retail display, soft natural lighting, modern fashion store aesthetic, light neutral background, professional retail photography',
    negativePrompt: 'cluttered, messy, dark, low quality, blurry, watermark, text, busy background, people',
    params: { guidance_scale: 7.0, num_inference_steps: 30 },
  },
};

/**
 * Get prompt profile from database or fallback to defaults
 */
export async function getPromptProfile(style: string): Promise<PromptProfile> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('prompt_profiles')
      .select('*')
      .eq('style', style)
      .eq('active', true)
      .single();

    if (error || !data) {
      // Fallback to default
      return DEFAULT_PROMPTS[style] || DEFAULT_PROMPTS.studio_white;
    }

    return {
      style: data.style,
      name: data.name,
      prompt: data.prompt,
      negativePrompt: data.negative_prompt || '',
      params: data.params_json || {},
    };
  } catch {
    // Fallback to default on any error
    return DEFAULT_PROMPTS[style] || DEFAULT_PROMPTS.studio_white;
  }
}

/**
 * Build full prompt with product context
 */
export function buildFullPrompt(
  basePrompt: string,
  category: string,
  additionalContext?: string
): string {
  const categoryContext = getCategoryContext(category);
  let fullPrompt = basePrompt;
  
  if (categoryContext) {
    fullPrompt = `${categoryContext}, ${basePrompt}`;
  }
  
  if (additionalContext) {
    fullPrompt = `${fullPrompt}, ${additionalContext}`;
  }
  
  return fullPrompt;
}

/**
 * Get category-specific context for prompts
 */
function getCategoryContext(category: string): string {
  const contexts: Record<string, string> = {
    clothing: 'fashion clothing item, apparel',
    beauty: 'beauty product, cosmetics',
    accessories: 'fashion accessory',
    shoes: 'footwear, shoes',
    jewelry: 'jewelry, fine accessories',
    bags: 'handbag, fashion bag',
    other: 'product',
  };
  
  return contexts[category] || contexts.other;
}
