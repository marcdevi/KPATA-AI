/**
 * Options Constants for KPATA AI Mobile App
 */

export const CATEGORIES = [
  { id: 'clothing', label: 'Vêtements', icon: '👕' },
  { id: 'beauty', label: 'Beauté', icon: '💄' },
  { id: 'accessories', label: 'Accessoires', icon: '👜' },
  { id: 'shoes', label: 'Chaussures', icon: '👟' },
  { id: 'jewelry', label: 'Bijoux', icon: '💎' },
  { id: 'bags', label: 'Sacs', icon: '🛍️' },
] as const;

export const BACKGROUNDS = [
  { id: 'studio_white', label: 'Blanc Studio', icon: '⬜' },
  { id: 'studio_gray', label: 'Gris Studio', icon: '◻️' },
  { id: 'gradient_soft', label: 'Dégradé Doux', icon: '🌈' },
  { id: 'outdoor_street', label: 'Rue', icon: '🏙️' },
  { id: 'lifestyle_cafe', label: 'Café', icon: '☕' },
] as const;

export const TEMPLATES = [
  { id: 'square_1x1', label: 'Carré 1:1', description: 'Format carré pour Instagram' },
  { id: 'portrait_4x5', label: 'Portrait 4:5', description: 'Format portrait pour feed' },
  { id: 'story_9x16', label: 'Story 9:16', description: 'Format vertical pour stories' },
] as const;

export const MANNEQUINS = [
  { id: 'none', label: 'Aucun', icon: '❌' },
  { id: 'ghost_mannequin', label: 'Mannequin Fantôme', icon: '👻' },
  { id: 'custom', label: 'Mon Mannequin', icon: '👤' },
  { id: 'virtual_model_female', label: 'Modèle Femme', icon: '👩' },
  { id: 'virtual_model_male', label: 'Modèle Homme', icon: '👨' },
] as const;

export const JOB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued: { label: 'En attente', color: '#F59E0B' },
  processing: { label: 'En cours', color: '#3B82F6' },
  completed: { label: 'Terminé', color: '#10B981' },
  failed: { label: 'Échoué', color: '#EF4444' },
};
