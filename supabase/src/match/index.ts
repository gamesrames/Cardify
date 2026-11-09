// Ponto de entrada da Edge Function `match` (roda no Deno, no Supabase). Só liga as peças reais ao
// handler; a lógica está em handler.ts e é testada com um banco de verdade em memória.
import { createClient } from '@supabase/supabase-js';
import { CODE_ALPHABET, handleMatch } from './handler';
import type { Deps } from './handler';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const deps: Deps = {
  async getUserId(req) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  async rpc(fn, args) {
    const { data, error } = await admin.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  },
  now: () => new Date(),
  randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] as number,
  newId: () => crypto.randomUUID(),
  newCode: () => {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    // 256 não é múltiplo de 32? É (8 x 32): o resto não enviesa o sorteio.
    return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  },
};

// CORS só para testar pelo navegador (Expo web); o app nativo não precisa.
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const res = await handleMatch(req, deps);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
});
