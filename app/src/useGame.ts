import { useCallback, useEffect, useState } from 'react';
import { applyAction, createGame, getCards, greedyBot, PREBUILT_DECKS } from './motor';
import type { Action, GameState, PlayerIndex } from './motor';
import { describeEvents } from './describeEvent';
import type { LogLine } from './describeEvent';
import { getCustomDeck } from './customDeck';

/** O humano é sempre o jogador 0 e o bot o jogador 1. Quem COMEÇA é sorteado pelo motor. */
export const HUMAN: PlayerIndex = 0;
export const BOT: PlayerIndex = 1;

/** Pausa entre as jogadas do bot, para dar tempo de ver o que aconteceu. */
const BOT_DELAY_MS = 800;

interface Game {
  state: GameState;
  log: LogLine[];
}

function deckCards(name: string) {
  const custom = getCustomDeck(name);
  if (custom) return [...custom];
  const ids = PREBUILT_DECKS[name];
  if (!ids) throw new Error(`Baralho pronto desconhecido: ${name}`);
  return getCards(ids);
}

/**
 * Liga o motor à tela. Guarda o GameState (imutável: cada ação gera um novo) e o log de eventos,
 * e faz o bot jogar sozinho nos turnos dele. Nenhuma regra é decidida aqui: tudo vem do motor.
 * Comparando com C#: é como um "ViewModel" que só repassa comandos ao domínio.
 */
export function useGame(playerDeckName: string, botDeckName: string, seed: number) {
  const [game, setGame] = useState<Game>(() => {
    const created = createGame(deckCards(playerDeckName), deckCards(botDeckName), seed);
    return { state: created.state, log: describeEvents(created.events, HUMAN, 0) };
  });
  const { state } = game;

  const dispatch = useCallback((action: Action) => {
    setGame((prev) => {
      // Partida já acabou (ex.: o jogador desistiu enquanto um timer do bot estava pendente): ignora.
      if (prev.state.winner !== null) return prev;
      const result = applyAction(prev.state, action);
      return {
        state: result.state,
        log: [...prev.log, ...describeEvents(result.events, HUMAN, prev.log.length)],
      };
    });
  }, []);

  // Turno do bot: a cada mudança de estado, se ainda é a vez dele, joga UMA ação depois de uma pausa.
  // Como cada ação gera um estado novo, este efeito roda de novo até o bot encerrar o turno.
  useEffect(() => {
    if (state.winner !== null || state.active !== BOT) return;
    const timer = setTimeout(() => dispatch(greedyBot(state)), BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, dispatch]);

  return {
    state,
    log: game.log,
    isHumanTurn: state.winner === null && state.active === HUMAN,
    play: (handIndex: number, slot: number) => dispatch({ type: 'play', handIndex, slot }),
    endTurn: () => dispatch({ type: 'end' }),
    /** Desistir vale em qualquer momento, até na vez do bot. A regra (derrota do humano) vive no motor. */
    forfeit: () => dispatch({ type: 'forfeit', player: HUMAN }),
  };
}
