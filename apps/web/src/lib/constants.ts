export const CATEGORIES = [
  { id: 'clothing', label: 'Vêtements', icon: '👕' },
  { id: 'beauty', label: 'Beauté', icon: '💄' },
  { id: 'accessories', label: 'Accessoires', icon: '👜' },
  { id: 'shoes', label: 'Chaussures', icon: '👟' },
  { id: 'jewelry', label: 'Bijoux', icon: '💎' },
  { id: 'bags', label: 'Sacs', icon: '🛍️' },
] as const;

export const BACKGROUNDS = [
  { id: 'studio_white', label: 'Blanc Studio', previewUrl: '/backgrounds/imagebl.png' },
  { id: 'studio_gray', label: 'Gris Studio', previewUrl: '/backgrounds/grisstd.png' },
  { id: 'gradient_soft', label: 'Dégradé Doux', previewUrl: '/backgrounds/imagedeg.png' },
  { id: 'outdoor_street', label: 'Rue', previewUrl: '/backgrounds/imagerue.png' },
  { id: 'lifestyle_cafe', label: 'Café', previewUrl: '/backgrounds/imagecafe.png' },
] as const;

export const TEMPLATES = [
  { id: 'square_1x1', label: 'Carré 1:1' },
  { id: 'portrait_4x5', label: 'Portrait 4:5' },
  { id: 'story_9x16', label: 'Story 9:16' },
] as const;

export const JOB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued: { label: 'En attente', color: '#F59E0B' },
  processing: { label: 'En cours', color: '#3B82F6' },
  completed: { label: 'Terminé', color: '#10B981' },
  failed: { label: 'Échoué', color: '#EF4444' },
};
