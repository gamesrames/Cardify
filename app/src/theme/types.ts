import type { Element, Rarity } from '../motor';

// Formato de um tema. Trocar a identidade do app = escrever outro arquivo com este formato
// (como arena.ts) e apontar para ele em index.ts. As telas não guardam cor nem fonte própria.
// Comparando com C#: `Theme` é uma interface e `arena` é a implementação registrada.

export interface Palette {
  /** Fundo do app. */
  bg: string;
  /** Painéis e caixas sobre o fundo. */
  surface: string;
  /** Um degrau acima do painel (campos de texto, itens dentro de caixas). */
  raised: string;
  /** Linhas e bordas discretas. */
  line: string;
  text: string;
  /** Texto secundário. Precisa passar de 4,5:1 de contraste sobre `bg` e `surface`. */
  textDim: string;
  /** Detalhes apagados (ícone desligado, número de posição vazia). Não usar em texto que precisa ser lido. */
  textFaint: string;
  /** Cor de ação: botão principal, seleção, energia. */
  accent: string;
  /** Texto e ícone em cima de `accent`. */
  onAccent: string;
  good: string;
  bad: string;
  /** Vermelho mais claro para números de vida sobre fundo escuro. */
  badSoft: string;
  warn: string;
  /** Véu atrás das janelas (resultado, confirmação). */
  overlay: string;
}

/** Nomes de ícone do conjunto MaterialCommunityIcons usados para os elementos. */
export type ElementIcon = 'fire' | 'leaf' | 'terrain' | 'weather-windy' | 'water';

export interface ElementStyle {
  label: string;
  icon: ElementIcon;
  color: string;
  /** Cor do ícone/texto em cima de `color`. */
  onColor: string;
  /** Mantido para o log e para telas antigas; a interface nova usa `icon`. */
  emoji: string;
}

export interface RarityStyle {
  label: string;
  /** Cor da moldura. */
  color: string;
  /** Cor para escrever o nome da raridade sobre fundo escuro (pode ser mais clara que a moldura). */
  textColor: string;
  /** Força do brilho em volta da carta, de 0 (nenhum) a 1. */
  glow: number;
  /** Se presente, a moldura é um degradê com estas cores (ex.: lendária furta-cor). */
  frame?: readonly string[];
}

export interface Theme {
  name: string;
  colors: Palette;
  elements: Record<Element, ElementStyle>;
  rarities: Record<Rarity, RarityStyle>;
  /** Nomes das fontes carregadas em fontAssets.ts. Use `fontFamily`, nunca `fontWeight`, com elas. */
  fonts: {
    /** Títulos, botões principais e números. */
    display: string;
    displayHeavy: string;
    body: string;
    bodySemi: string;
    bodyBold: string;
  };
  radius: { sm: number; md: number; lg: number; pill: number };
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
}
