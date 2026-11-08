import AsyncStorage from '@react-native-async-storage/async-storage';

// O baralho do jogador fica só neste aparelho por enquanto (ids das cartas).
// Na fase 3 vai para o servidor, junto com a coleção.
const KEY = 'cardify.meuBaralho.v1';

export async function loadDeckIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveDeckIds(ids: readonly string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // sem armazenamento: o baralho vale só até fechar o app
  }
}
