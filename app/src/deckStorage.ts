import AsyncStorage from '@react-native-async-storage/async-storage';

// O baralho também fica guardado no aparelho (cópia para jogar sem internet). Desde a fase 3 a chave é
// por usuário: quem entra com outra conta no mesmo aparelho não herda o baralho da conta anterior.
// A chave `v1` (fase 2) não tinha dono; é lida uma vez e migrada para a nuvem (veja `deckSync.ts`).
const LEGACY_KEY = 'cardify.meuBaralho.v1';
const keyFor = (userId: string) => `cardify.meuBaralho.v2.${userId}`;

function parseIds(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

async function read(key: string): Promise<string[] | null> {
  try {
    return parseIds(await AsyncStorage.getItem(key));
  } catch {
    return null;
  }
}

/** `null` = este usuário nunca salvou baralho neste aparelho. */
export const loadDeckIds = (userId: string) => read(keyFor(userId));
export const loadLegacyDeckIds = () => read(LEGACY_KEY);

export async function saveDeckIds(userId: string, ids: readonly string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(ids));
  } catch {
    // sem armazenamento: o baralho vale só até fechar o app
  }
}

export async function clearLegacyDeckIds(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // tudo bem: na próxima abertura o baralho é reaproveitado de novo e nada se perde
  }
}
