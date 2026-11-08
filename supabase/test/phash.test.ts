import { describe, expect, it } from 'vitest';
import { decodePhoto } from '../src/create-card/image';
import { dhash, hammingDistance } from '../src/create-card/phash';
import { makePhoto } from './fixtures';

const hashOf = async (bytes: Uint8Array) => dhash((await decodePhoto(bytes)).gray);

describe('hash perceptual', () => {
  it('hamming conta bits diferentes', () => {
    expect(hammingDistance('0000', '0000')).toBe(0);
    expect(hammingDistance('0101', '1001')).toBe(2);
  });

  it('hash tem 64 bits', async () => {
    expect(await hashOf(await makePhoto(1))).toMatch(/^[01]{64}$/);
  });

  it('a mesma cena com ruído e outro tamanho fica abaixo do limiar (10)', async () => {
    const base = await hashOf(await makePhoto(5, { size: 192 }));
    const retaken = await hashOf(await makePhoto(5, { size: 320, noise: 12 }));
    expect(hammingDistance(base, retaken)).toBeLessThanOrEqual(10);
  });

  it('fotos diferentes ficam acima do limiar (10)', async () => {
    const hashes = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(async (p) => hashOf(await makePhoto(p))));
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) {
        expect(hammingDistance(hashes[i]!, hashes[j]!)).toBeGreaterThan(10);
      }
    }
  });

  it('o JPEG limpo guardado também é decodificável', async () => {
    const { cleanJpeg } = await decodePhoto(await makePhoto(3));
    expect(cleanJpeg.length).toBeGreaterThan(100);
    await expect(decodePhoto(cleanJpeg)).resolves.toBeDefined();
  });

  it('bytes que não são imagem são recusados', async () => {
    await expect(decodePhoto(new Uint8Array([1, 2, 3, 4]))).rejects.toBeDefined();
  });
});
