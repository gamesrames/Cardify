import { arena } from './arena';
import type { Theme } from './types';

export type { ElementIcon, ElementStyle, Palette, RarityStyle, Theme } from './types';

// ÚNICO lugar que escolhe a identidade do app. Para trocar de direção visual, crie outro arquivo
// no formato de arena.ts e troque esta linha (e as fontes em fontAssets.ts, se mudarem).
// Este arquivo não importa nada do React Native de propósito: os testes (Node) passam por ele.
export const theme: Theme = arena;

export const fonts = theme.fonts;
export const radius = theme.radius;
export const space = theme.space;

/**
 * Cores do tema. `panel`, `panelAlt` e `border` são os nomes antigos (fases 1 a 4) de
 * `surface`, `raised` e `line`; continuam valendo para as telas que já os usam.
 */
export const colors = {
  ...theme.colors,
  panel: theme.colors.surface,
  panelAlt: theme.colors.raised,
  border: theme.colors.line,
};

export const ELEMENT_INFO = theme.elements;
export const RARITY_INFO = theme.rarities;

/** `#RRGGBB` + opacidade → `rgba(...)`. Para brilhos e véus derivados das cores do tema. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
