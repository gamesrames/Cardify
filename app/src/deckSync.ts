// Sincronização do baralho entre o aparelho e a nuvem. Sem React Native: testável no Node.

export interface DeckSources {
  /** Baralho guardado neste aparelho para ESTE usuário (`null` = nunca salvou aqui). */
  local: readonly string[] | null;
  /** Baralho da fase 2, guardado sem dono (só existe em quem já usava o app antes da fase 3). */
  legacy: readonly string[] | null;
  /** Baralho da nuvem. `null` = o jogador ainda não tem um lá. */
  cloud: readonly string[] | null;
  /** `false` quando não deu para falar com o servidor (então `cloud` não vale nada). */
  cloudReachable: boolean;
}

export interface DeckResolution {
  ids: string[];
  /** Precisa enviar `ids` para a nuvem? (migração do baralho que só existia no aparelho). */
  uploadToCloud: boolean;
  /** O baralho sem dono da fase 2 já foi aproveitado e pode ser apagado do aparelho. */
  consumedLegacy: boolean;
}

/**
 * Regra: a nuvem manda (é o que vale em outro aparelho). Se ela ainda está vazia, o baralho do
 * aparelho sobe uma vez. Sem servidor, joga com o que tem aqui e não envia nada.
 */
export function resolveDeck({ local, legacy, cloud, cloudReachable }: DeckSources): DeckResolution {
  if (cloudReachable && cloud) return { ids: [...cloud], uploadToCloud: false, consumedLegacy: legacy !== null };
  const base = local ?? legacy ?? [];
  return {
    ids: [...base],
    uploadToCloud: cloudReachable && base.length > 0,
    consumedLegacy: cloudReachable && local === null && legacy !== null,
  };
}

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline';

/**
 * Fila de gravação na nuvem: nunca manda duas gravações ao mesmo tempo e, se o jogador marcar várias
 * cartas depressa, só a última versão é enviada (a de antes já não interessa).
 */
export function createSaveQueue(send: (ids: string[]) => Promise<void>, onState: (state: SyncState) => void) {
  let pending: string[] | null = null;
  let running = false;

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    let lastOk = true;
    while (pending) {
      const ids: string[] = pending;
      pending = null;
      onState('saving');
      try {
        await send(ids);
        lastOk = true;
      } catch {
        lastOk = false;
      }
    }
    running = false;
    onState(lastOk ? 'saved' : 'offline');
  }

  return {
    /** Agenda o envio de `ids` e devolve quando a fila esvaziar. */
    save(ids: readonly string[]): Promise<void> {
      pending = [...ids];
      return run();
    },
  };
}
