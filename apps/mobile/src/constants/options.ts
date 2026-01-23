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
  { id: 'studio_clean_white', label: 'Blanc Studio', icon: '⬜' },
  { id: 'luxury_marble_velvet', label: 'Luxe Marbre', icon: '✨' },
  { id: 'boutique_clean_store', label: 'Boutique', icon: '🏪' },
] as const;

export const TEMPLATES = [
  { id: 'A', label: 'Template A', description: 'Produit centré, prix en bas' },
  { id: 'B', label: 'Template B', description: 'Produit en haut, infos centrées' },
  { id: 'C', label: 'Template C', description: 'Style moderne asymétrique' },
] as const;

export const MANNEQUINS = [
  { id: 'none', label: 'Aucun', icon: '❌' },
  { id: 'ghost_mannequin', label: 'Mannequin Fantôme', icon: '👻' },
  { id: 'user_mannequin', label: 'Mon Mannequin', icon: '👤' },
  { id: 'virtual_model_female', label: 'Modèle Femme', icon: '👩' },
  { id: 'virtual_model_male', label: 'Modèle Homme', icon: '👨' },
] as const;

export const JOB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued: { label: 'En attente', color: '#F59E0B' },
  processing: { label: 'En cours', color: '#3B82F6' },
  completed: { label: 'Terminé', color: '#10B981' },
  failed: { label: 'Échoué', color: '#EF4444' },
};
