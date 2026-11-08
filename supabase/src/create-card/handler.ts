import { generateCard } from './generator';
import { dhash } from './phash';
import { ClassifierError } from './types';
import type { Category, Classifier, GeneratedCard } from './types';
import type { DecodedPhoto } from './image';

/** Tudo que o handler precisa do mundo externo. Nos testes entram versões falsas. */
export interface Deps {
  /** Id do usuário a partir do cabeçalho Authorization (ou null se inválido). */
  getUserId(req: Request): Promise<string | null>;
  listCategories(): Promise<Category[]>;
  /** Confere cota diária e duplicata sem gravar nada. */
  checkPhoto(userId: string, hash: string): Promise<'ok' | 'quota_exceeded' | 'duplicate'>;
  /** Grava a carta de forma atômica (refaz as conferências dentro da transação). */
  insertCard(row: InsertCard): Promise<CardRecord>;
  uploadPhoto(path: string, jpeg: Uint8Array): Promise<void>;
  removePhoto(path: string): Promise<void>;
  decodePhoto(bytes: Uint8Array): Promise<DecodedPhoto>;
  classifier: Classifier;
  /** Semente de 32 bits sorteada com aleatoriedade criptográfica. */
  randomSeed(): number;
  newId(): string;
}

export interface InsertCard extends GeneratedCard {
  id: string;
  ownerId: string;
  photoPath: string;
  photoHash: string;
}

export interface CardRecord {
  id: string;
  name: string;
  category: string;
  element: string;
  rarity: string;
  attack: number;
  health: number;
  bonusPoints: number;
  photoPath: string;
  createdAt: string;
}

/** Erro lançado por `insertCard` quando a transação recusa (cota ou duplicata). */
export class InsertRejected extends Error {
  constructor(public readonly reason: 'quota_exceeded' | 'duplicate') {
    super(reason);
  }
}

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png'];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const ERRORS = {
  unauthorized: [401, 'Entre no app antes de criar cartas.'],
  invalid_request: [400, 'Pedido inválido.'],
  quota_exceeded: [429, 'Você já usou todas as fotos de hoje.'],
  duplicate_photo: [409, 'Essa foto (ou uma quase igual) já virou carta.'],
  category_not_recognized: [422, 'Não consegui identificar o que há na foto.'],
  classifier_unavailable: [502, 'O reconhecimento de fotos está indisponível agora. Tente de novo.'],
  internal: [500, 'Erro interno ao criar a carta.'],
} as const;

function fail(code: keyof typeof ERRORS): Response {
  const [status, message] = ERRORS[code];
  return json(status, { error: code, message });
}

function decodeBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Corpo esperado (JSON): { photo: <base64>, mime: 'image/jpeg', category?: <slug> }.
 * `category` só é usado pelo classificador manual.
 */
export async function handleCreateCard(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return fail('invalid_request');

  const userId = await deps.getUserId(req);
  if (!userId) return fail('unauthorized');

  let photoBytes: Uint8Array;
  let mime: string;
  let hint: string | undefined;
  try {
    const body = (await req.json()) as { photo?: unknown; mime?: unknown; category?: unknown };
    if (typeof body.photo !== 'string' || typeof body.mime !== 'string' || !ALLOWED_MIME.includes(body.mime)) {
      return fail('invalid_request');
    }
    // base64 ocupa ~4/3 do tamanho original: barra antes de decodificar.
    if (body.photo.length > (MAX_PHOTO_BYTES * 4) / 3 + 8) return fail('invalid_request');
    photoBytes = decodeBase64(body.photo);
    mime = body.mime;
    hint = typeof body.category === 'string' ? body.category : undefined;
  } catch {
    return fail('invalid_request');
  }

  let photoPath: string | null = null;
  try {
    let decoded: DecodedPhoto;
    try {
      decoded = await deps.decodePhoto(photoBytes);
    } catch {
      return fail('invalid_request');
    }
    const hash = dhash(decoded.gray);

    // Confere antes de gastar chamada de IA e upload; a transação confere de novo no fim.
    const pre = await deps.checkPhoto(userId, hash);
    if (pre !== 'ok') return fail(pre === 'quota_exceeded' ? 'quota_exceeded' : 'duplicate_photo');

    const categories = await deps.listCategories();
    let slug: string;
    try {
      slug = await deps.classifier.classify({ bytes: photoBytes, mime }, categories, hint);
    } catch (e) {
      if (e instanceof ClassifierError) {
        return fail(e.code === 'invalid_category' ? 'category_not_recognized' : 'classifier_unavailable');
      }
      throw e;
    }
    const category = categories.find((c) => c.slug === slug);
    if (!category) return fail('category_not_recognized');

    // O servidor sorteia a semente; o cliente nunca influencia o resultado.
    const generated = generateCard({ seed: deps.randomSeed(), category });
    const id = deps.newId();
    photoPath = `${userId}/${id}.jpg`;
    await deps.uploadPhoto(photoPath, decoded.cleanJpeg);

    let record: CardRecord;
    try {
      record = await deps.insertCard({ ...generated, id, ownerId: userId, photoPath, photoHash: hash });
    } catch (e) {
      if (e instanceof InsertRejected) {
        await deps.removePhoto(photoPath).catch(() => {});
        photoPath = null;
        return fail(e.reason === 'quota_exceeded' ? 'quota_exceeded' : 'duplicate_photo');
      }
      throw e;
    }
    return json(201, { card: record });
  } catch {
    if (photoPath) await deps.removePhoto(photoPath).catch(() => {});
    return fail('internal');
  }
}
