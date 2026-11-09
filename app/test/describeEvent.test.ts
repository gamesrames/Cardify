import { describe, expect, it } from 'vitest';
import { describeEvent } from '../src/describeEvent';

describe('describeEvent: fim de jogo', () => {
  it('desistência do humano aparece como derrota', () => {
    const line = describeEvent({ type: 'game_over', winner: 1, reason: 'forfeit' }, 0);
    expect(line?.text).toMatch(/você desistiu/);
  });
  it('desistência do bot aparece como vitória', () => {
    const line = describeEvent({ type: 'game_over', winner: 0, reason: 'forfeit' }, 0);
    expect(line?.text).toMatch(/bot desistiu/);
  });
  it('fim normal continua igual', () => {
    expect(describeEvent({ type: 'game_over', winner: 0, reason: 'hp_zero' }, 0)?.text).toBe('Fim de jogo: você venceu!');
  });
});
