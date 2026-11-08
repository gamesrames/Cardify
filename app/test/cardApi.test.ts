import { describe, expect, it } from 'vitest';
import { CreateCardError, requestCard, toCardDef } from '../src/cardApi';

const base = { baseUrl: 'https://x.supabase.co', apiKey: 'pub', accessToken: 'tok', photoBase64: 'AAAA', category: 'galinha' };
const card = { id: 'c1', name: 'Galinha', category: 'galinha', element: 'terra', rarity: 'comum', attack: 3, health: 7, bonusPoints: 1, photoPath: 'u/c1.jpg', createdAt: 'agora' };

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe('requestCard', () => {
  it('manda foto, categoria e os cabeçalhos certos, e devolve a carta', async () => {
    const { fetchFn, calls } = fakeFetch(201, { card });
    await expect(requestCard({ ...base, fetchFn })).resolves.toEqual(card);
    expect(calls[0]!.url).toBe('https://x.supabase.co/functions/v1/create-card');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok');
    expect(headers.apikey).toBe('pub');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ photo: 'AAAA', mime: 'image/jpeg', category: 'galinha' });
  });

  it.each([
    [429, 'quota_exceeded'],
    [409, 'duplicate_photo'],
    [502, 'classifier_unavailable'],
  ])('erro %i do servidor vira CreateCardError(%s) com a mensagem em português', async (status, code) => {
    const { fetchFn } = fakeFetch(status, { error: code, message: 'texto do servidor' });
    await expect(requestCard({ ...base, fetchFn })).rejects.toMatchObject({ code, message: 'texto do servidor' });
  });

  it('resposta que não é nossa (gateway) vira "unexpected" com o status', async () => {
    const { fetchFn } = fakeFetch(401, 'Invalid JWT');
    const err = await requestCard({ ...base, fetchFn }).catch((e) => e);
    expect(err).toBeInstanceOf(CreateCardError);
    expect(err).toMatchObject({ code: 'unexpected' });
    expect(err.message).toContain('401');
  });

  it('falha de rede vira "network"', async () => {
    const fetchFn = (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;
    await expect(requestCard({ ...base, fetchFn })).rejects.toMatchObject({ code: 'network' });
  });
});

describe('toCardDef', () => {
  it('converte para o formato do motor', () => {
    expect(toCardDef(card as never)).toEqual({ id: 'c1', name: 'Galinha', element: 'terra', rarity: 'comum', attack: 3, health: 7 });
  });
});
