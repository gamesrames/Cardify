import { describe, expect, it } from 'vitest';
import { createSaveQueue, resolveDeck } from '../src/deckSync';
import type { SyncState } from '../src/deckSync';

describe('resolveDeck (nuvem x aparelho)', () => {
  it('a nuvem manda: em outro aparelho aparece o baralho salvo na conta', () => {
    const r = resolveDeck({ local: ['velho'], legacy: null, cloud: ['a', 'b'], cloudReachable: true });
    expect(r).toEqual({ ids: ['a', 'b'], uploadToCloud: false, consumedLegacy: false });
  });

  it('aparelho novo, sem nada local, pega o da nuvem', () => {
    const r = resolveDeck({ local: null, legacy: null, cloud: ['a'], cloudReachable: true });
    expect(r.ids).toEqual(['a']);
  });

  it('migração da fase 2: baralho sem dono sobe para a nuvem uma vez e é consumido', () => {
    const r = resolveDeck({ local: null, legacy: ['x', 'y'], cloud: null, cloudReachable: true });
    expect(r).toEqual({ ids: ['x', 'y'], uploadToCloud: true, consumedLegacy: true });
  });

  it('baralho do próprio usuário no aparelho sobe se a nuvem estiver vazia', () => {
    const r = resolveDeck({ local: ['x'], legacy: null, cloud: null, cloudReachable: true });
    expect(r).toEqual({ ids: ['x'], uploadToCloud: true, consumedLegacy: false });
  });

  it('o baralho local do usuário vence o sem dono (que é de outra época)', () => {
    const r = resolveDeck({ local: ['novo'], legacy: ['velho'], cloud: null, cloudReachable: true });
    expect(r.ids).toEqual(['novo']);
    expect(r.consumedLegacy).toBe(false);
  });

  it('sem servidor: joga com o que tem no aparelho e não envia nem apaga nada', () => {
    const r = resolveDeck({ local: null, legacy: ['x'], cloud: null, cloudReachable: false });
    expect(r).toEqual({ ids: ['x'], uploadToCloud: false, consumedLegacy: false });
  });

  it('nada em lugar nenhum: baralho vazio e nada a enviar', () => {
    expect(resolveDeck({ local: null, legacy: null, cloud: null, cloudReachable: true })).toEqual({
      ids: [],
      uploadToCloud: false,
      consumedLegacy: false,
    });
  });
});

describe('createSaveQueue', () => {
  it('manda uma gravação e termina em "saved"', async () => {
    const sent: string[][] = [];
    const states: SyncState[] = [];
    const queue = createSaveQueue(async (ids) => void sent.push(ids), (s) => states.push(s));
    await queue.save(['a']);
    expect(sent).toEqual([['a']]);
    expect(states).toEqual(['saving', 'saved']);
  });

  it('várias gravações seguidas: nunca duas ao mesmo tempo e só a mais nova depois da primeira', async () => {
    const sent: string[][] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const queue = createSaveQueue(
      async (ids) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        sent.push(ids);
        inFlight--;
      },
      () => undefined,
    );
    await Promise.all([queue.save(['1']), queue.save(['1', '2']), queue.save(['1', '2', '3']), queue.save(['9'])]);
    expect(maxInFlight).toBe(1);
    expect(sent[0]).toEqual(['1']); // a primeira já estava no ar
    expect(sent[sent.length - 1]).toEqual(['9']); // a última é a que vale
    expect(sent).toHaveLength(2); // as do meio foram descartadas
  });

  it('falha de rede vira "offline" e a próxima tentativa volta a funcionar', async () => {
    let fail = true;
    const states: SyncState[] = [];
    const queue = createSaveQueue(
      async () => {
        if (fail) throw new Error('sem rede');
      },
      (s) => states.push(s),
    );
    await queue.save(['a']);
    expect(states[states.length - 1]).toBe('offline');
    fail = false;
    await queue.save(['a', 'b']);
    expect(states[states.length - 1]).toBe('saved');
  });
});
