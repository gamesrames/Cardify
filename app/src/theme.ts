import type { Element, Rarity } from './motor';

export const colors = {
  bg: '#0f1220',
  panel: '#1a1f36',
  panelAlt: '#232944',
  border: '#343b5e',
  text: '#f2f4ff',
  textDim: '#9aa3c7',
  accent: '#6c7bff',
  good: '#4ade80',
  bad: '#f87171',
  warn: '#fbbf24',
};

export const ELEMENT_INFO: Record<Element, { label: string; emoji: string; color: string }> = {
  fogo: { label: 'Fogo', emoji: '🔥', color: '#f97316' },
  planta: { label: 'Planta', emoji: '🌿', color: '#22c55e' },
  terra: { label: 'Terra', emoji: '⛰️', color: '#a16207' },
  ar: { label: 'Ar', emoji: '💨', color: '#7dd3fc' },
  agua: { label: 'Água', emoji: '💧', color: '#3b82f6' },
};

export const RARITY_INFO: Record<Rarity, { label: string; color: string }> = {
  comum: { label: 'Comum', color: '#9ca3af' },
  incomum: { label: 'Incomum', color: '#4ade80' },
  rara: { label: 'Rara', color: '#60a5fa' },
  epica: { label: 'Épica', color: '#c084fc' },
  lendaria: { label: 'Lendária', color: '#fbbf24' },
};
