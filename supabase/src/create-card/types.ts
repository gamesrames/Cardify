import type { Element, Rarity } from '../motor';

/** Linha da tabela `categories`: o que a foto pode ser e o que isso dá à carta. */
export interface Category {
  slug: string;
  nome: string;
  element: Element;
  /** Bônus em % do orçamento de poder da raridade (0 a 10). */
  bonusPct: number;
}

/** Resultado do gerador: tudo que define uma carta, menos id/dono/foto. */
export interface GeneratedCard {
  name: string;
  category: string;
  element: Element;
  rarity: Rarity;
  attack: number;
  health: number;
  seed: number;
  /** Pontos de poder acima do orçamento da raridade, vindos da categoria. */
  bonusPoints: number;
}

export interface Photo {
  bytes: Uint8Array;
  mime: string;
}

/**
 * Descobre o que há na foto. É uma interface (como em C#): o handler só conhece
 * isto, e dá para trocar a implementação (manual, Gemini...) sem mexer nele.
 */
export interface Classifier {
  /** Devolve o `slug` de uma das `categories`. Lança ClassifierError se não der. */
  classify(photo: Photo, categories: readonly Category[], hint?: string): Promise<string>;
}

export type ClassifierErrorCode = 'invalid_category' | 'unavailable';

export class ClassifierError extends Error {
  constructor(
    public readonly code: ClassifierErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ClassifierError';
  }
}
