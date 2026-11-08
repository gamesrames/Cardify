// Fala com a Edge Function `create-card` (contrato em docs/backend.md).
// Sem imports do React Native de propósito: dá para testar no Node (npm test).
import type { CardDef, Element, Rarity } from './motor';

export interface CreatedCard {
  id: string;
  name: string;
  category: string;
  element: Element;
  rarity: Rarity;
  attack: number;
  health: number;
  bonusPoints: number;
  photoPath: string;
  createdAt: string;
}

/** Erro com o código do servidor (`quota_exceeded`, `duplicate_photo`...) e texto pronto para mostrar. */
export class CreateCardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CreateCardError';
  }
}

export interface RequestCardOptions {
  /** Ex.: https://xxxx.supabase.co (sem barra no fim). */
  baseUrl: string;
  /** Chave pública do projeto (a "publishable"), exigida pelo gateway do Supabase. */
  apiKey: string;
  /** Token do login anônimo. */
  accessToken: string;
  /** JPEG em base64, sem o prefixo `data:`. */
  photoBase64: string;
  /** Só vale com o classificador manual do servidor. */
  category?: string;
  fetchFn?: typeof fetch;
}

export async function requestCard(options: RequestCardOptions): Promise<CreatedCard> {
  const doFetch = options.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${options.baseUrl}/functions/v1/create-card`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${options.accessToken}`,
        apikey: options.apiKey,
      },
      body: JSON.stringify({ photo: options.photoBase64, mime: 'image/jpeg', category: options.category }),
    });
  } catch {
    throw new CreateCardError('network', 'Sem conexão com o servidor. Confira a internet e tente de novo.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 201 && isRecord(body) && isRecord(body.card)) {
    return body.card as unknown as CreatedCard;
  }
  if (isRecord(body) && typeof body.error === 'string') {
    throw new CreateCardError(body.error, typeof body.message === 'string' ? body.message : 'Não deu para criar a carta.');
  }
  // Resposta que não é nossa (ex.: o gateway recusou o login): mensagem genérica com o status.
  throw new CreateCardError('unexpected', `Resposta inesperada do servidor (HTTP ${response.status}).`);
}

/** A carta criada no formato que o motor e o `CardView` entendem. */
export function toCardDef(card: CreatedCard): CardDef {
  return {
    id: card.id,
    name: card.name,
    element: card.element,
    rarity: card.rarity,
    attack: card.attack,
    health: card.health,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
