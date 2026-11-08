import { ClassifierError } from './types';
import type { Category, Classifier, Photo } from './types';

/** Slug da categoria genérica usada quando nada serve (precisa existir em `categories`). */
export const FALLBACK_SLUG = 'outro';

/**
 * Classificador "manual": o app manda o slug escolhido pelo jogador. Serve para
 * testar o pipeline sem IA e como plano B se a cota do Gemini acabar.
 */
export class ManualClassifier implements Classifier {
  async classify(_photo: Photo, categories: readonly Category[], hint?: string): Promise<string> {
    if (!hint || !categories.some((c) => c.slug === hint)) {
      throw new ClassifierError('invalid_category', 'Categoria ausente ou desconhecida.');
    }
    return hint;
  }
}

export interface GeminiOptions {
  /** Chave da API. Vem SEMPRE de segredo/variável de ambiente, nunca do código. */
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** Classifica a foto com a API do Gemini (plano grátis), restrito à nossa lista de categorias. */
export class GeminiClassifier implements Classifier {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: GeminiOptions) {
    if (!options.apiKey) throw new Error('GEMINI_API_KEY não configurada.');
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  async classify(photo: Photo, categories: readonly Category[]): Promise<string> {
    const slugs = categories.map((c) => c.slug);
    const lista = categories.map((c) => `${c.slug} (${c.nome})`).join(', ');
    const body = {
      contents: [
        {
          parts: [
            {
              text:
                'Esta foto vai virar uma carta de jogo. Escolha a categoria que melhor descreve o ASSUNTO PRINCIPAL da foto. ' +
                `Categorias permitidas: ${lista}. Se nenhuma servir, responda "${FALLBACK_SLUG}".`,
            },
            { inline_data: { mime_type: photo.mime, data: toBase64(photo.bytes) } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { categoria: { type: 'STRING', enum: slugs } },
          required: ['categoria'],
        },
        temperature: 0,
      },
    };

    let response: Response;
    try {
      response = await this.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent`,
        {
          method: 'POST',
          // A chave vai no cabeçalho (não na URL) para não aparecer em logs de endereço.
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.options.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch {
      throw new ClassifierError('unavailable', 'Gemini não respondeu a tempo.');
    }
    // Mensagens de erro nunca incluem corpo da resposta nem cabeçalhos (evita vazar a chave).
    if (!response.ok) {
      throw new ClassifierError('unavailable', `Gemini respondeu HTTP ${response.status}.`);
    }

    let slug: unknown;
    try {
      const json = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      slug = (JSON.parse(text) as { categoria?: unknown }).categoria;
    } catch {
      throw new ClassifierError('unavailable', 'Resposta do Gemini ilegível.');
    }
    if (typeof slug === 'string' && slugs.includes(slug)) return slug;
    if (slugs.includes(FALLBACK_SLUG)) return FALLBACK_SLUG;
    throw new ClassifierError('invalid_category', 'Gemini devolveu categoria fora da lista.');
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
