// Ponto de entrada da Edge Function `create-card` (roda no Deno, no Supabase).
// Só liga as peças reais ao handler; a lógica está em handler.ts e é testada
// com versões falsas. Os imports 'imagescript' e '@supabase/supabase-js' viram
// `npm:` no build (veja build.mjs).
import { createClient } from '@supabase/supabase-js';
import { GeminiClassifier, ManualClassifier } from './classifiers';
import { handleCreateCard, InsertRejected } from './handler';
import type { CardRecord, Deps } from './handler';
import { decodePhoto } from './image';
import type { Category, Classifier } from './types';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** CLASSIFIER=gemini liga o Gemini; qualquer outro valor (ou vazio) usa o classificador manual. */
function makeClassifier(): Classifier {
  if (Deno.env.get('CLASSIFIER') === 'gemini') {
    return new GeminiClassifier({
      apiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
      model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-lite-latest',
    });
  }
  return new ManualClassifier();
}
const classifier = makeClassifier();

const deps: Deps = {
  async getUserId(req) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  async listCategories() {
    const { data, error } = await admin.from('categories').select('slug, nome, element, bonus_pct').eq('ativa', true);
    if (error) throw error;
    return (data ?? []).map((r): Category => ({ slug: r.slug, nome: r.nome, element: r.element, bonusPct: r.bonus_pct }));
  },
  async checkPhoto(userId, hash) {
    const { data, error } = await admin.rpc('photo_check', { p_user: userId, p_hash: hash });
    if (error) throw error;
    return data;
  },
  async insertCard(row) {
    const { data, error } = await admin.rpc('insert_card', {
      p_id: row.id,
      p_owner: row.ownerId,
      p_photo_path: row.photoPath,
      p_photo_hash: row.photoHash,
      p_name: row.name,
      p_category: row.category,
      p_element: row.element,
      p_rarity: row.rarity,
      p_attack: row.attack,
      p_health: row.health,
      p_seed: row.seed,
      p_bonus_points: row.bonusPoints,
    });
    if (error) {
      if (error.message.includes('quota_exceeded')) throw new InsertRejected('quota_exceeded');
      if (error.message.includes('duplicate')) throw new InsertRejected('duplicate');
      throw error;
    }
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      element: data.element,
      rarity: data.rarity,
      attack: data.attack,
      health: data.health,
      bonusPoints: data.bonus_points,
      photoPath: data.photo_path,
      createdAt: data.created_at,
    } satisfies CardRecord;
  },
  async uploadPhoto(path, jpeg) {
    const { error } = await admin.storage.from('card-photos').upload(path, jpeg, { contentType: 'image/jpeg' });
    if (error) throw error;
  },
  async removePhoto(path) {
    await admin.storage.from('card-photos').remove([path]);
  },
  decodePhoto,
  classifier,
  randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] as number,
  newId: () => crypto.randomUUID(),
};

// CORS só para testar pelo navegador (Expo web); o app nativo não precisa.
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const res = await handleCreateCard(req, deps);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
});
