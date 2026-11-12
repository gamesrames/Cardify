import type { Theme } from './types';

// Direção "Arena" (aprovada em 2026-11-11, ver docs/design.md): escura e moderna, a foto ocupa a
// carta inteira, a raridade aparece na cor e no brilho da moldura, e uma única cor de ação (lima).

const ink = '#0C0E13';

export const arena: Theme = {
  name: 'Arena',
  colors: {
    bg: ink,
    surface: '#161922',
    raised: '#1F2430',
    line: '#2C3240',
    text: '#F2F4F8',
    textDim: '#9AA1B2',
    textFaint: '#5A6275',
    accent: '#C8F031',
    onAccent: ink,
    good: '#43D17A',
    bad: '#FF5D5D',
    badSoft: '#FF8A8A',
    warn: '#FFC53D',
    overlay: 'rgba(5, 6, 9, 0.82)',
  },
  elements: {
    fogo: { label: 'Fogo', icon: 'fire', color: '#FF6A3D', onColor: ink, emoji: '🔥' },
    planta: { label: 'Planta', icon: 'leaf', color: '#43D17A', onColor: ink, emoji: '🌿' },
    terra: { label: 'Terra', icon: 'terrain', color: '#D49A5B', onColor: ink, emoji: '⛰️' },
    ar: { label: 'Ar', icon: 'weather-windy', color: '#8FD8FF', onColor: ink, emoji: '💨' },
    agua: { label: 'Água', icon: 'water', color: '#4C86FF', onColor: ink, emoji: '💧' },
  },
  rarities: {
    comum: { label: 'Comum', color: '#8D94A5', textColor: '#9AA1B2', glow: 0 },
    incomum: { label: 'Incomum', color: '#43D17A', textColor: '#43D17A', glow: 0.35 },
    rara: { label: 'Rara', color: '#4C86FF', textColor: '#7FA8FF', glow: 0.5 },
    epica: { label: 'Épica', color: '#B26BFF', textColor: '#C08CFF', glow: 0.6 },
    lendaria: {
      label: 'Lendária',
      color: '#FFC53D',
      textColor: '#FFC53D',
      glow: 0.6,
      frame: ['#FFC53D', '#FF8A5C', '#B26BFF', '#4C86FF', '#43D17A', '#FFC53D'],
    },
  },
  fonts: {
    display: 'Unbounded_700Bold',
    displayHeavy: 'Unbounded_800ExtraBold',
    body: 'Inter_500Medium',
    bodySemi: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
};
