import { Image } from 'imagescript';
import { Rng } from '../src/motor';

/**
 * "Foto" sintética: blocos de cor sorteados a partir de `pattern`. Padrões
 * diferentes = fotos diferentes; mesmo padrão com `noise`/tamanho diferentes =
 * a mesma cena fotografada de novo (pequenas variações).
 */
export async function makePhoto(pattern: number, opts: { size?: number; noise?: number } = {}): Promise<Uint8Array> {
  const size = opts.size ?? 192;
  const noise = opts.noise ?? 0;
  const rng = new Rng(pattern);
  const blocks = 6;
  const colors = Array.from({ length: blocks * blocks }, () => [rng.int(256), rng.int(256), rng.int(256)] as const);
  const noiseRng = new Rng(pattern + 99991);
  const image = new Image(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colors[Math.floor((y * blocks) / size) * blocks + Math.floor((x * blocks) / size)]!;
      const n = noise ? Math.round((noiseRng.next() - 0.5) * 2 * noise) : 0;
      const clamp = (v: number) => Math.min(255, Math.max(0, v + n));
      image.setPixelAt(x, y, Image.rgbToColor(clamp(r), clamp(g), clamp(b)));
    }
  }
  return image.encodeJPEG(90);
}
