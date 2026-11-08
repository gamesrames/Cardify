import { describe, expect, it } from 'vitest';
import { GeminiClassifier, ManualClassifier } from '../src/create-card/classifiers';
import { ClassifierError } from '../src/create-card/types';
import type { Category } from '../src/create-card/types';

const categories: Category[] = [
  { slug: 'galinha', nome: 'Galinha', element: 'terra', bonusPct: 5 },
  { slug: 'outro', nome: 'Misterioso', element: 'ar', bonusPct: 0 },
];
const photo = { bytes: new Uint8Array([1, 2, 3]), mime: 'image/jpeg' };
const SECRET = 'chave-super-secreta-de-teste';

function geminiReplying(text: string, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status });
  }) as unknown as typeof fetch;
  return { calls, classifier: new GeminiClassifier({ apiKey: SECRET, model: 'modelo-x', fetchFn }) };
}

describe('ManualClassifier', () => {
  it('aceita um slug da lista', async () => {
    await expect(new ManualClassifier().classify(photo, categories, 'galinha')).resolves.toBe('galinha');
  });
  it('recusa slug ausente ou desconhecido', async () => {
    await expect(new ManualClassifier().classify(photo, categories)).rejects.toMatchObject({ code: 'invalid_category' });
    await expect(new ManualClassifier().classify(photo, categories, 'dragao')).rejects.toBeInstanceOf(ClassifierError);
  });
});

describe('GeminiClassifier', () => {
  it('devolve a categoria da resposta e manda a chave só no cabeçalho', async () => {
    const { classifier, calls } = geminiReplying('{"categoria":"galinha"}');
    await expect(classifier.classify(photo, categories)).resolves.toBe('galinha');
    expect(calls[0]!.url).not.toContain(SECRET);
    expect((calls[0]!.init.headers as Record<string, string>)['x-goog-api-key']).toBe(SECRET);
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.generationConfig.responseSchema.properties.categoria.enum).toEqual(['galinha', 'outro']);
  });

  it('categoria fora da lista cai em "outro"', async () => {
    await expect(geminiReplying('{"categoria":"dragao"}').classifier.classify(photo, categories)).resolves.toBe('outro');
  });

  it('HTTP de erro vira "unavailable" sem vazar a chave', async () => {
    const err = await geminiReplying('x', 429).classifier.classify(photo, categories).catch((e) => e);
    expect(err).toMatchObject({ code: 'unavailable' });
    expect(String(err.message)).not.toContain(SECRET);
  });

  it('resposta ilegível ou falha de rede viram "unavailable"', async () => {
    await expect(geminiReplying('não é json').classifier.classify(photo, categories)).rejects.toMatchObject({ code: 'unavailable' });
    const boom = new GeminiClassifier({ apiKey: SECRET, model: 'm', fetchFn: (async () => { throw new Error(`falhou ${SECRET}`); }) as unknown as typeof fetch });
    const err = await boom.classify(photo, categories).catch((e) => e);
    expect(err).toMatchObject({ code: 'unavailable' });
    expect(String(err.message)).not.toContain(SECRET);
  });

  it('exige a chave', () => {
    expect(() => new GeminiClassifier({ apiKey: '', model: 'm' })).toThrow();
  });
});
