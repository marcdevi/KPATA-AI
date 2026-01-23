/**
 * Types for KPATA AI Telegram Bot
 */

import { Context, SessionFlavor } from 'grammy';

// User session state
export interface SessionData {
  // User identification
  profileId?: string;
  phoneE164?: string;
  
  // Onboarding state
  hasAcceptedTerms: boolean;
  awaitingPhone: boolean;
  awaitingTermsAcceptance: boolean;
  
  // Job creation flow
  currentFlow?: 'new_visual';
  flowStep?: 'category' | 'background' | 'template' | 'mannequin' | 'photo';
  
  // Job options (stored per conversation)
  jobOptions: {
    category?: string;
    backgroundStyle?: string;
    templateLayout?: string;
    mannequinMode?: string;
  };
  
  // Pending job
  pendingJobId?: string;
  
  // Rate limiting
  commandCount: number;
  commandWindowStart: number;
  cooldownUntil?: number;
}

// Default session
export function createInitialSession(): SessionData {
  return {
    hasAcceptedTerms: false,
    awaitingPhone: false,
    awaitingTermsAcceptance: false,
    jobOptions: {},
    commandCount: 0,
    commandWindowStart: Date.now(),
  };
}

// Bot context with session
export type BotContext = Context & SessionFlavor<SessionData>;

// Callback data types
export type CallbackAction = 
  | 'accept_terms'
  | 'decline_terms'
  | 'new_visual'
  | 'my_gallery'
  | 'my_credits'
  | 'support'
  | `category_${string}`
  | `background_${string}`
  | `template_${string}`
  | `mannequin_${string}`
  | `regenerate_${string}`
  | 'cancel_flow';

// Menu options
export const CATEGORIES = [
  { id: 'clothing', label: '👕 Vêtements' },
  { id: 'beauty', label: '💄 Beauté' },
  { id: 'accessories', label: '👜 Accessoires' },
  { id: 'shoes', label: '👟 Chaussures' },
  { id: 'jewelry', label: '💎 Bijoux' },
  { id: 'bags', label: '🛍️ Sacs' },
] as const;

export const BACKGROUNDS = [
  { id: 'studio_clean_white', label: '⬜ Blanc Studio' },
  { id: 'luxury_marble_velvet', label: '✨ Luxe Marbre' },
  { id: 'boutique_clean_store', label: '🏪 Boutique' },
] as const;

export const TEMPLATES = [
  { id: 'A', label: '📐 Template A' },
  { id: 'B', label: '📏 Template B' },
  { id: 'C', label: '📊 Template C' },
] as const;

export const MANNEQUINS = [
  { id: 'none', label: '❌ Aucun' },
  { id: 'ghost_mannequin', label: '👻 Mannequin Fantôme' },
  { id: 'virtual_model_female', label: '👩 Modèle Femme' },
  { id: 'virtual_model_male', label: '👨 Modèle Homme' },
] as const;
