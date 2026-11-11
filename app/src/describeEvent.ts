import type { GameEvent, PlayerIndex } from './motor';
import { ELEMENT_INFO } from './theme';

export type Tone = 'info' | 'good' | 'bad' | 'neutral';

export interface LogLine {
  id: number;
  text: string;
  tone: Tone;
}

/** Quem joga do outro lado e por que a partida acabou (só o online sabe ser por tempo ou ausência). */
export interface DescribeOptions {
  /** Nome do adversário. Padrão: o bot da partida offline. */
  foeName?: string;
  /** Motivo do fim quando o motor diz `forfeit` mas foi por tempo (`timeout`) ou ausência (`abandoned`). */
  endCause?: string | null;
}

/** Texto do log para um evento do motor; null = não mostrar (ex.: cartas que o adversário comprou são segredo). */
export function describeEvent(event: GameEvent, human: PlayerIndex, options: DescribeOptions = {}): { text: string; tone: Tone } | null {
  const foe = options.foeName ?? 'Bot';
  const offline = options.foeName === undefined;
  const who = (p: PlayerIndex) => (p === human ? 'Você' : foe);
  const tone = (p: PlayerIndex): Tone => (p === human ? 'good' : 'bad');
  switch (event.type) {
    case 'turn_start':
      return {
        text: `Turno ${event.turn}: ${event.player === human ? 'sua vez' : offline ? 'vez do bot' : `vez de ${foe}`}`,
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
        text: `${who(event.player)}: posição ${event.slot + 1} atacou direto, -${event.damage}. Vida ${victim === human ? 'sua' : offline ? 'do bot' : `de ${foe}`}: ${Math.max(0, event.hpAfter)}`,
        tone: tone(event.player),
      };
    }
    case 'creature_died':
      return {
        text: `${event.player === human ? 'Sua' : 'A'} ${event.card.name} ${event.player === human ? 'caiu' : offline ? 'do bot caiu' : `de ${foe} caiu`}`,
        tone: event.player === human ? 'bad' : 'good',
      };
    case 'game_over':
      if (event.reason === 'forfeit') {
        const won = event.winner === human;
        if (options.endCause === 'timeout') {
          return { text: won ? `Fim de jogo: ${foe} perdeu por tempo, você venceu!` : 'Fim de jogo: o seu tempo estourou (derrota)', tone: 'info' };
        }
        if (options.endCause === 'abandoned') {
          return { text: won ? `Fim de jogo: ${foe} sumiu, você venceu!` : 'Fim de jogo: você ficou ausente (derrota)', tone: 'info' };
        }
        return {
          text: won ? `Fim de jogo: ${offline ? 'o bot' : foe} desistiu, você venceu!` : 'Fim de jogo: você desistiu (derrota)',
          tone: 'info',
        };
      }
      return {
        text: event.winner === 'draw' ? 'Fim de jogo: empate' : `Fim de jogo: ${event.winner === human ? 'você venceu!' : offline ? 'o bot venceu' : `${foe} venceu`}`,
        tone: 'info',
      };
  }
}

export function describeEvents(events: readonly GameEvent[], human: PlayerIndex, firstId: number, options: DescribeOptions = {}): LogLine[] {
  const lines: LogLine[] = [];
  for (const event of events) {
    const described = describeEvent(event, human, options);
    if (described) lines.push({ id: firstId + lines.length, ...described });
  }
  return lines;
}
