import { describe, expect, it } from 'vitest';
import {
  describeCause,
  formatDelta,
  progressErrorFrom,
  rewardFor,
  sortForUpgrade,
  upgradeOptions,
  upgradeProgress,
  type PhotoCardRow,
} from '../src/progress';

const card = (over: Partial<PhotoCardRow> = {}): PhotoCardRow => ({
  id: 'a', name: 'Galinha', element: 'terra', rarity: 'comum', attack: 3, health: 6, photo_path: 'x', upgrade_attack: 0, upgrade_health: 0, ...over,
});

describe('opções de melhoria', () => {
  it('mostra custo e se cabe: comum tem teto 2, vida custa 10 e ataque 20', () => {
    expect(upgradeOptions(card(), 100)).toEqual([
      { stat: 'health', label: '+1 vida', cost: 10, state: 'ok' },
      { stat: 'attack', label: '+1 ataque', cost: 20, state: 'ok' },
    ]);
  });

  it('sem saldo vira "essence"; sem espaço vira "cap" (ataque pede 2 pontos e só sobra 1)', () => {
    expect(upgradeOptions(card(), 15).map((o) => o.state)).toEqual(['ok', 'essence']);
    const half = card({ upgrade_health: 1, health: 7 });
    expect(upgradeOptions(half, 100).map((o) => o.state)).toEqual(['ok', 'cap']);
    expect(upgradeOptions(card({ upgrade_health: 2, health: 8 }), 100).map((o) => o.state)).toEqual(['cap', 'cap']);
  });

  it('progresso usado/teto e ordem: quem ainda pode melhorar vem primeiro', () => {
    expect(upgradeProgress(card({ upgrade_attack: 1 }))).toEqual({ used: 2, cap: 2 });
    const full = card({ id: 'cheia', upgrade_attack: 1 });
    const open = card({ id: 'aberta' });
    expect(sortForUpgrade([full, open]).map((c) => c.id)).toEqual(['aberta', 'cheia']);
  });
});

describe('erros e textos', () => {
  it('traduz os códigos da função do servidor', () => {
    expect(progressErrorFrom({ message: 'upgrade_cap' }, 'x').code).toBe('upgrade_cap');
    expect(progressErrorFrom({ message: 'not_enough_essence' }, 'x').message).toMatch(/Essência insuficiente/);
  });

  it('função ou tabela ausente = migração não aplicada; o resto usa o texto padrão', () => {
    expect(progressErrorFrom({ code: 'PGRST202', message: 'Could not find the function' }, 'x').code).toBe('not_deployed');
    expect(progressErrorFrom({ code: '42P01', message: 'relation does not exist' }, 'x').code).toBe('not_deployed');
    expect(progressErrorFrom({ code: '500', message: 'boom' }, 'Falhou').message).toBe('Falhou');
  });

  it('formata variação e motivo, e escolhe o lado certo do resultado', () => {
    expect([formatDelta(16), formatDelta(-16), formatDelta(0)]).toEqual(['+16', '−16', '0']);
    expect(describeCause('timeout')).toBe('tempo esgotado');
    const result = { rated: true, host_delta: 16, guest_delta: -16, host_essence: 30, guest_essence: 10 };
    expect(rewardFor(result, 0)).toEqual({ rated: true, rating: 16, essence: 30 });
    expect(rewardFor(result, 1)).toEqual({ rated: true, rating: -16, essence: 10 });
  });
});
