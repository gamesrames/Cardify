// Cliente do Supabase e login anônimo. A sessão fica guardada no aparelho
// (AsyncStorage), então o mesmo "usuário anônimo" volta a cada abertura do app
// e as cartas dele continuam dele. Desinstalar o app perde a sessão (fase 3 resolve com login de verdade).
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabaseUrl = url ?? '';
export const supabaseKey = key ?? '';
export const isSupabaseConfigured = Boolean(url && key);
/** Mostra a lista de categorias? Só com o classificador manual no servidor. */
export const manualCategory = process.env.EXPO_PUBLIC_MANUAL_CATEGORY !== 'false';

const client = isSupabaseConfigured
  ? createClient(url as string, key as string, {
      auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

function requireClient() {
  if (!client) throw new Error('Supabase não configurado. Veja app/.env.example.');
  return client;
}

/** Sessão atual, entrando como anônimo na primeira vez. */
export async function ensureSession(): Promise<Session> {
  const supabase = requireClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const result = await supabase.auth.signInAnonymously();
  if (result.error || !result.data.session) {
    throw new Error(
      'Não consegui entrar como anônimo. Ligue "Allow anonymous sign-ins" no painel do Supabase (Authentication → Sign In / Providers).',
    );
  }
  return result.data.session;
}

export interface CategoryOption {
  slug: string;
  nome: string;
  element: string;
}

export async function listCategories(): Promise<CategoryOption[]> {
  const supabase = requireClient();
  await ensureSession();
  const { data, error } = await supabase.from('categories').select('slug, nome, element').order('nome');
  if (error) throw new Error('Não consegui carregar as categorias.');
  return data ?? [];
}

import type { CardRow } from './myCards';

/** Cartas criadas pelo usuário atual (a RLS do servidor só devolve as dele), mais novas primeiro. */
export async function listMyCards(): Promise<CardRow[]> {
  const supabase = requireClient();
  await ensureSession();
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, element, rarity, attack, health, photo_path')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Não consegui carregar as suas cartas.');
  return (data ?? []) as CardRow[];
}

/** Endereços temporários (1 h) das fotos, que ficam num bucket privado. Devolve `caminho → URL`. */
export async function signedPhotoUrls(paths: readonly string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = requireClient();
  const { data, error } = await supabase.storage.from('card-photos').createSignedUrls([...paths], 3600);
  if (error) throw new Error('Não consegui carregar as fotos.');
  const urls: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}
