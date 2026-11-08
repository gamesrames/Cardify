import { Image } from 'imagescript';
import { grayGridFromRgba } from './phash';

export interface DecodedPhoto {
  /** Grade 9×8 de brilho, entrada do dHash. */
  gray: Uint8Array;
  /** JPEG recodificado: some o EXIF (localização etc.) mesmo que o app não tenha tirado. */
  cleanJpeg: Uint8Array;
}

const MAX_SIDE = 1280;
const JPEG_QUALITY = 85;

/** Decodifica a foto (JPEG/PNG), gera a grade do hash e um JPEG limpo para guardar. */
export async function decodePhoto(bytes: Uint8Array): Promise<DecodedPhoto> {
  const decoded = await Image.decode(bytes);
  // Image.decode também aceita GIF animado, que não tem .bitmap; recusamos.
  if (!(decoded instanceof Image)) throw new Error('Formato de imagem não suportado.');
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
