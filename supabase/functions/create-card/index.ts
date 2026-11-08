// GERADO por `npm run build` (supabase/build.mjs). Não edite: mude src/create-card/.


// src/create-card/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// src/create-card/types.ts
var ClassifierError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ClassifierError";
  }
  code;
};

// src/create-card/classifiers.ts
var FALLBACK_SLUG = "outro";
var ManualClassifier = class {
  async classify(_photo, categories, hint) {
    if (!hint || !categories.some((c2) => c2.slug === hint)) {
      throw new ClassifierError("invalid_category", "Categoria ausente ou desconhecida.");
    }
    return hint;
  }
};
var GeminiClassifier = class {
  constructor(options) {
    this.options = options;
    if (!options.apiKey) throw new Error("GEMINI_API_KEY n\xE3o configurada.");
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8e3;
  }
  options;
  fetchFn;
  timeoutMs;
  async classify(photo, categories) {
    const slugs = categories.map((c2) => c2.slug);
    const lista = categories.map((c2) => `${c2.slug} (${c2.nome})`).join(", ");
    const body = {
      contents: [
        {
          parts: [
            {
              text: `Esta foto vai virar uma carta de jogo. Escolha a categoria que melhor descreve o ASSUNTO PRINCIPAL da foto. Categorias permitidas: ${lista}. Se nenhuma servir, responda "${FALLBACK_SLUG}".`
            },
            { inline_data: { mime_type: photo.mime, data: toBase64(photo.bytes) } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { categoria: { type: "STRING", enum: slugs } },
          required: ["categoria"]
        },
        temperature: 0
      }
    };
    let response;
    try {
      response = await this.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent`,
        {
          method: "POST",
          // A chave vai no cabeçalho (não na URL) para não aparecer em logs de endereço.
          headers: { "content-type": "application/json", "x-goog-api-key": this.options.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      throw new ClassifierError("unavailable", "Gemini n\xE3o respondeu a tempo.");
    }
    if (!response.ok) {
      throw new ClassifierError("unavailable", `Gemini respondeu HTTP ${response.status}.`);
    }
    let slug;
    try {
      const json2 = await response.json();
      const text = json2.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      slug = JSON.parse(text).categoria;
    } catch {
      throw new ClassifierError("unavailable", "Resposta do Gemini ileg\xEDvel.");
    }
    if (typeof slug === "string" && slugs.includes(slug)) return slug;
    if (slugs.includes(FALLBACK_SLUG)) return FALLBACK_SLUG;
    throw new ClassifierError("invalid_category", "Gemini devolveu categoria fora da lista.");
  }
};
function toBase64(bytes) {
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ../engine/src/types.ts
var RARITIES = ["comum", "incomum", "rara", "epica", "lendaria"];

// ../engine/src/rules.ts
var DEFAULT_RULES = {
  playerHp: 20,
  handSize: 3,
  energyPerTurn: 3,
  slots: 3,
  deckSize: 7,
  deckPowerLimit: 110,
  maxTurns: 60,
  summoningSickness: false,
  secondPlayerBonusEnergy: 2,
  advantageMultiplier: 1.5,
  disadvantageMultiplier: 0.75,
  energyCost: { comum: 1, incomum: 2, rara: 2, epica: 3, lendaria: 3 },
  powerBudget: { comum: 9, incomum: 15, rara: 18, epica: 27, lendaria: 28 },
  photoBonusRatio: 0.1,
  upgradeRatio: 0.25
};
function photoBonusCap(rarity, rules) {
  return Math.max(1, Math.floor(rules.powerBudget[rarity] * rules.photoBonusRatio));
}

// ../engine/src/rng.ts
function nextRandom(state) {
  const next = state + 1831565813 | 0;
  let t = next;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return { value: ((t ^ t >>> 14) >>> 0) / 4294967296, next };
}
var Rng = class {
  state;
  constructor(seed) {
    this.state = seed | 0;
  }
  next() {
    const r = nextRandom(this.state);
    this.state = r.next;
    return r.value;
  }
  int(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }
  shuffle(items) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }
};

// ../engine/src/cards.ts
function c(id, name, element, rarity, attack, health) {
  return { id, name, element, rarity, attack, health };
}
var CARDS = [
  // Fogo
  c("fogo-formiga", "Formiga-de-fogo", "fogo", "comum", 3, 3),
  c("fogo-lagartixa", "Lagartixa", "fogo", "comum", 2, 5),
  c("fogo-raposa", "Raposa", "fogo", "incomum", 5, 5),
  c("fogo-tigre", "Tigre", "fogo", "rara", 6, 6),
  c("fogo-leao", "Le\xE3o", "fogo", "epica", 9, 9),
  c("fogo-fenix", "F\xEAnix", "fogo", "lendaria", 10, 8),
  // Planta
  c("planta-joaninha", "Joaninha", "planta", "comum", 2, 5),
  c("planta-lesma", "Lesma", "planta", "comum", 1, 7),
  c("planta-coelho", "Coelho", "planta", "incomum", 4, 7),
  c("planta-cervo", "Cervo", "planta", "rara", 5, 8),
  c("planta-urso", "Urso", "planta", "epica", 8, 11),
  c("planta-ent", "Ent", "planta", "lendaria", 9, 10),
  // Terra
  c("terra-minhoca", "Minhoca", "terra", "comum", 1, 7),
  c("terra-tatu", "Tatu", "terra", "comum", 3, 3),
  c("terra-texugo", "Texugo", "terra", "incomum", 5, 5),
  c("terra-javali", "Javali", "terra", "rara", 7, 4),
  c("terra-elefante", "Elefante", "terra", "epica", 7, 13),
  c("terra-golem", "Golem", "terra", "lendaria", 9, 10),
  // Ar
  c("ar-mosquito", "Mosquito", "ar", "comum", 4, 1),
  c("ar-pardal", "Pardal", "ar", "comum", 3, 3),
  c("ar-gaivota", "Gaivota", "ar", "incomum", 6, 3),
  c("ar-falcao", "Falc\xE3o", "ar", "rara", 7, 4),
  c("ar-aguia", "\xC1guia", "ar", "epica", 10, 7),
  c("ar-condor", "Condor", "ar", "lendaria", 10, 8),
  // Água
  c("agua-sapo", "Sapo", "agua", "comum", 2, 5),
  c("agua-peixe", "Peixe", "agua", "comum", 3, 3),
  c("agua-tartaruga", "Tartaruga", "agua", "incomum", 3, 9),
  c("agua-foca", "Foca", "agua", "rara", 5, 8),
  c("agua-tubarao", "Tubar\xE3o", "agua", "epica", 9, 9),
  c("agua-baleia", "Baleia", "agua", "lendaria", 9, 10)
];
var BY_ID = new Map(CARDS.map((card) => [card.id, card]));

// src/create-card/generator.ts
var RARITY_WEIGHTS = {
  comum: 60,
  incomum: 25,
  rara: 10,
  epica: 4,
  lendaria: 1
};
var MAX_CATEGORY_BONUS_PCT = 10;
var ATTACK_SHARE = { min: 0.3, max: 0.75 };
function rollRarity(rng) {
  const total = RARITIES.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  let roll = rng.next() * total;
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll < 0) return rarity;
  }
  return "comum";
}
function categoryBonusPoints(rarity, bonusPct, rules = DEFAULT_RULES) {
  const pct = Math.min(Math.max(bonusPct, 0), MAX_CATEGORY_BONUS_PCT);
  if (pct === 0) return 0;
  const raw = Math.max(1, Math.floor(rules.powerBudget[rarity] * pct / 100));
  return Math.min(raw, photoBonusCap(rarity, rules));
}
function generateCard(input, rules = DEFAULT_RULES) {
  const rng = new Rng(input.seed);
  const rarity = rollRarity(rng);
  const budget = rules.powerBudget[rarity];
  const bonusPoints = categoryBonusPoints(rarity, input.category.bonusPct, rules);
  const total = budget + bonusPoints;
  const share = ATTACK_SHARE.min + rng.next() * (ATTACK_SHARE.max - ATTACK_SHARE.min);
  const maxAttack = Math.floor((total - 1) / 2);
  const attack = Math.min(Math.max(Math.round(share * total / 2), 1), maxAttack);
  const health = total - attack * 2;
  return {
    name: input.category.nome,
    category: input.category.slug,
    element: input.category.element,
    rarity,
    attack,
    health,
    seed: input.seed >>> 0,
    // sem sinal: é o número que fica gravado no banco
    bonusPoints
  };
}

// src/create-card/phash.ts
var HASH_COLS = 9;
var HASH_ROWS = 8;
function grayGridFromRgba(rgba, width, height) {
  if (width < 1 || height < 1 || rgba.length < width * height * 4) {
    throw new Error("Imagem inv\xE1lida para o hash.");
  }
  const grid = new Uint8Array(HASH_COLS * HASH_ROWS);
  for (let gy = 0; gy < HASH_ROWS; gy++) {
    const y0 = Math.floor(gy * height / HASH_ROWS);
    const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * height / HASH_ROWS));
    for (let gx = 0; gx < HASH_COLS; gx++) {
      const x0 = Math.floor(gx * width / HASH_COLS);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * width / HASH_COLS));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
          count++;
        }
      }
      grid[gy * HASH_COLS + gx] = Math.round(sum / count);
    }
  }
  return grid;
}
function dhash(grid) {
  if (grid.length !== HASH_COLS * HASH_ROWS) throw new Error("Grade de hash com tamanho errado.");
  let bits = "";
  for (let row = 0; row < HASH_ROWS; row++) {
    for (let col = 0; col < HASH_COLS - 1; col++) {
      const left = grid[row * HASH_COLS + col];
      const right = grid[row * HASH_COLS + col + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits;
}

// src/create-card/handler.ts
var InsertRejected = class extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
  reason;
};
var MAX_PHOTO_BYTES = 4 * 1024 * 1024;
var ALLOWED_MIME = ["image/jpeg", "image/png"];
function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
var ERRORS = {
  unauthorized: [401, "Entre no app antes de criar cartas."],
  invalid_request: [400, "Pedido inv\xE1lido."],
  quota_exceeded: [429, "Voc\xEA j\xE1 usou todas as fotos de hoje."],
  duplicate_photo: [409, "Essa foto (ou uma quase igual) j\xE1 virou carta."],
  category_not_recognized: [422, "N\xE3o consegui identificar o que h\xE1 na foto."],
  classifier_unavailable: [502, "O reconhecimento de fotos est\xE1 indispon\xEDvel agora. Tente de novo."],
  internal: [500, "Erro interno ao criar a carta."]
};
function fail(code) {
  const [status, message] = ERRORS[code];
  return json(status, { error: code, message });
}
function decodeBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function handleCreateCard(req, deps2) {
  if (req.method !== "POST") return fail("invalid_request");
  const userId = await deps2.getUserId(req);
  if (!userId) return fail("unauthorized");
  let photoBytes;
  let mime;
  let hint;
  try {
    const body = await req.json();
    if (typeof body.photo !== "string" || typeof body.mime !== "string" || !ALLOWED_MIME.includes(body.mime)) {
      return fail("invalid_request");
    }
    if (body.photo.length > MAX_PHOTO_BYTES * 4 / 3 + 8) return fail("invalid_request");
    photoBytes = decodeBase64(body.photo);
    mime = body.mime;
    hint = typeof body.category === "string" ? body.category : void 0;
  } catch {
    return fail("invalid_request");
  }
  let photoPath = null;
  try {
    let decoded;
    try {
      decoded = await deps2.decodePhoto(photoBytes);
    } catch {
      return fail("invalid_request");
    }
    const hash = dhash(decoded.gray);
    const pre = await deps2.checkPhoto(userId, hash);
    if (pre !== "ok") return fail(pre === "quota_exceeded" ? "quota_exceeded" : "duplicate_photo");
    const categories = await deps2.listCategories();
    let slug;
    try {
      slug = await deps2.classifier.classify({ bytes: photoBytes, mime }, categories, hint);
    } catch (e) {
      if (e instanceof ClassifierError) {
        return fail(e.code === "invalid_category" ? "category_not_recognized" : "classifier_unavailable");
      }
      throw e;
    }
    const category = categories.find((c2) => c2.slug === slug);
    if (!category) return fail("category_not_recognized");
    const generated = generateCard({ seed: deps2.randomSeed(), category });
    const id = deps2.newId();
    photoPath = `${userId}/${id}.jpg`;
    await deps2.uploadPhoto(photoPath, decoded.cleanJpeg);
    let record;
    try {
      record = await deps2.insertCard({ ...generated, id, ownerId: userId, photoPath, photoHash: hash });
    } catch (e) {
      if (e instanceof InsertRejected) {
        await deps2.removePhoto(photoPath).catch(() => {
        });
        photoPath = null;
        return fail(e.reason === "quota_exceeded" ? "quota_exceeded" : "duplicate_photo");
      }
      throw e;
    }
    return json(201, { card: record });
  } catch {
    if (photoPath) await deps2.removePhoto(photoPath).catch(() => {
    });
    return fail("internal");
  }
}

// src/create-card/image.ts
import { Image } from "npm:imagescript@3.17.0";
var MAX_SIDE = 1280;
var JPEG_QUALITY = 85;
async function decodePhoto(bytes) {
  const decoded = await Image.decode(bytes);
  if (!(decoded instanceof Image)) throw new Error("Formato de imagem n\xE3o suportado.");
  let image = decoded;
  const longest = Math.max(image.width, image.height);
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest;
    image = image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
  }
  const gray = grayGridFromRgba(image.bitmap, image.width, image.height);
  const cleanJpeg = await image.encodeJPEG(JPEG_QUALITY);
  return { gray, cleanJpeg };
}

// src/create-card/index.ts
var admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false }
});
function makeClassifier() {
  if (Deno.env.get("CLASSIFIER") === "gemini") {
    return new GeminiClassifier({
      apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-lite-latest"
    });
  }
  return new ManualClassifier();
}
var classifier = makeClassifier();
var deps = {
  async getUserId(req) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async listCategories() {
    const { data, error } = await admin.from("categories").select("slug, nome, element, bonus_pct").eq("ativa", true);
    if (error) throw error;
    return (data ?? []).map((r) => ({ slug: r.slug, nome: r.nome, element: r.element, bonusPct: r.bonus_pct }));
  },
  async checkPhoto(userId, hash) {
    const { data, error } = await admin.rpc("photo_check", { p_user: userId, p_hash: hash });
    if (error) throw error;
    return data;
  },
  async insertCard(row) {
    const { data, error } = await admin.rpc("insert_card", {
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
      p_bonus_points: row.bonusPoints
    });
    if (error) {
      if (error.message.includes("quota_exceeded")) throw new InsertRejected("quota_exceeded");
      if (error.message.includes("duplicate")) throw new InsertRejected("duplicate");
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
      createdAt: data.created_at
    };
  },
  async uploadPhoto(path, jpeg) {
    const { error } = await admin.storage.from("card-photos").upload(path, jpeg, { contentType: "image/jpeg" });
    if (error) throw error;
  },
  async removePhoto(path) {
    await admin.storage.from("card-photos").remove([path]);
  },
  decodePhoto,
  classifier,
  randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0],
  newId: () => crypto.randomUUID()
};
var cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS"
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const res = await handleCreateCard(req, deps);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
});
