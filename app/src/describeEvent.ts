import type { GameEvent, PlayerIndex } from './motor';
import { ELEMENT_INFO } from './theme';

export type Tone = 'info' | 'good' | 'bad' | 'neutral';

export interface LogLine {
  id: number;
  text: string;
  tone: Tone;
}

/** Texto do log para um evento do motor; null = não mostrar (ex.: cartas que o bot comprou são segredo). */
export function describeEvent(event: GameEvent, human: PlayerIndex): { text: string; tone: Tone } | null {
  const who = (p: PlayerIndex) => (p === human ? 'Você' : 'Bot');
  const tone = (p: PlayerIndex): Tone => (p === human ? 'good' : 'bad');
  switch (event.type) {
    case 'turn_start':
      return {
        text: `Turno ${event.turn}: ${event.player === human ? 'sua vez' : 'vez do bot'}`,
        tone: 'info',
      };
    case 'draw':
      if (event.player !== human) return null;
      return { text: `Você comprou ${event.card.name}`, tone: 'neutral' };
    case 'play':
      return {
        text: `${who(event.player)} jogou ${ELEMENT_INFO[event.card.element].emoji} ${event.card.name} na posição ${event.slot + 1}`,
        tone: tone(event.player),
      };
    case 'attack_creature': {
      const hint = event.multiplier > 1 ? ' (vantagem!)' : event.multiplier < 1 ? ' (desvantagem)' : '';
      return {
        text: `${who(event.player)}: posição ${event.slot + 1} causou ${event.damage}${hint}. Vida do alvo: ${Math.max(0, event.targetHealthAfter)}`,
        tone: tone(event.player),
      };
    }
    case 'attack_player': {
      const victim: PlayerIndex = event.player === 0 ? 1 : 0;
      return {
        text: `${who(event.player)}: posição ${event.slot + 1} atacou direto, -${event.damage}. Vida ${victim === human ? 'sua' : 'do bot'}: ${Math.max(0, event.hpAfter)}`,
        tone: tone(event.player),
      };
    }
    case 'creature_died':
      return {
        text: `${event.player === human ? 'Sua' : 'A'} ${event.card.name} ${event.player === human ? 'caiu' : 'do bot caiu'}`,
        tone: event.player === human ? 'bad' : 'good',
      };
    case 'game_over':
      if (event.reason === 'forfeit') {
        return {
          text: event.winner === human ? 'Fim de jogo: o bot desistiu, você venceu!' : 'Fim de jogo: você desistiu (derrota)',
          tone: 'info',
        };
      }
      return {
        text: event.winner === 'draw' ? 'Fim de jogo: empate' : `Fim de jogo: ${event.winner === human ? 'você venceu!' : 'o bot venceu'}`,
        tone: 'info',
      };
  }
}

export function describeEvents(events: readonly GameEvent[], human: PlayerIndex, firstId: number): LogLine[] {
  const lines: LogLine[] = [];
  for (const event of events) {
    const described = describeEvent(event, human);
    if (described) lines.push({ id: firstId + lines.length, ...described });
  }
  return lines;
}
