// Hash perceptual "dHash" de 64 bits: compara o brilho de pixels vizinhos numa
// grade 9×8. Fotos quase iguais dão hashes quase iguais (poucos bits diferentes),
// ao contrário de um SHA, que muda por inteiro com um pixel. Não define atributos
// de carta; só barra duplicatas.

export const HASH_COLS = 9;
export const HASH_ROWS = 8;

/** Reduz uma imagem RGBA a uma grade 9×8 de brilho (0 a 255), fazendo a média de cada bloco. */
export function grayGridFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  if (width < 1 || height < 1 || rgba.length < width * height * 4) {
    throw new Error('Imagem inválida para o hash.');
  }
  const grid = new Uint8Array(HASH_COLS * HASH_ROWS);
  for (let gy = 0; gy < HASH_ROWS; gy++) {
    const y0 = Math.floor((gy * height) / HASH_ROWS);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / HASH_ROWS));
    for (let gx = 0; gx < HASH_COLS; gx++) {
      const x0 = Math.floor((gx * width) / HASH_COLS);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / HASH_COLS));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          // luminância (pesos padrão ITU-R BT.601)
          sum += 0.299 * (rgba[i] as number) + 0.587 * (rgba[i + 1] as number) + 0.114 * (rgba[i + 2] as number);
          count++;
        }
      }
      grid[gy * HASH_COLS + gx] = Math.round(sum / count);
    }
  }
  return grid;
}

/** dHash como texto de 64 caracteres '0'/'1' (o Postgres lê direto como bit(64)). */
export function dhash(grid: Uint8Array): string {
  if (grid.length !== HASH_COLS * HASH_ROWS) throw new Error('Grade de hash com tamanho errado.');
  let bits = '';
  for (let row = 0; row < HASH_ROWS; row++) {
    for (let col = 0; col < HASH_COLS - 1; col++) {
      const left = grid[row * HASH_COLS + col] as number;
      const right = grid[row * HASH_COLS + col + 1] as number;
      bits += left > right ? '1' : '0';
    }
  }
  return bits;
}

/** Quantos bits diferem entre dois hashes. 0 = idênticos. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error('Hashes de tamanhos diferentes.');
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}
