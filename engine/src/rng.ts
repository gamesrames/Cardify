// Gerador mulberry32. O estado é um único número inteiro, fácil de guardar
// dentro do GameState. Mesma semente => mesma partida, sempre.

export function nextRandom(state: number): { value: number; next: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next };
}

/** Versão com estado interno, para bots e simulador. */
export class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed | 0;
  }
  next(): number {
    const r = nextRandom(this.state);
    this.state = r.next;
    return r.value;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = a[i] as T;
      a[i] = a[j] as T;
      a[j] = tmp;
    }
    return a;
  }
}
