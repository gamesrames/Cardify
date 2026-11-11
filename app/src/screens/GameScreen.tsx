import { useEffect, useState } from 'react';
import { Alert, BackHandler, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BattleTable } from '../components/BattleTable';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { ui } from '../components/ui';
import { legalActions } from '../motor';
import type { Action } from '../motor';
import { cardWidthFor } from '../layout';
import { playSfx } from '../sfx';
import { BOT, HUMAN, useGame } from '../useGame';

interface Props {
  playerDeckName: string;
  botDeckName: string;
  seed: number;
  onRematch: () => void;
  onChangeDeck: () => void;
  onMenu: () => void;
}

type PlayAction = Extract<Action, { type: 'play' }>;

/** Partida contra o bot. O motor roda no próprio aparelho (useGame); o desenho da mesa é o BattleTable. */
export function GameScreen({ playerDeckName, botDeckName, seed, onRematch, onChangeDeck, onMenu }: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const cardWidth = cardWidthFor(window.width, window.height, insets.top + insets.bottom);
  const { state, log, isHumanTurn, play, endTurn, forfeit } = useGame(playerDeckName, botDeckName, seed);
  const [selected, setSelected] = useState<number | null>(null);
  // Confirmação de "Desistir" feita na própria tela (Alert.alert não funciona no navegador).
  const [confirmingForfeit, setConfirmingForfeit] = useState(false);

  const me = state.players[HUMAN];
  const foe = state.players[BOT];
  const finished = state.winner !== null;
  const forfeited = state.endReason === 'forfeit';

  // Jogadas permitidas vêm do motor. A tela nunca decide sozinha o que é legal.
  const plays = isHumanTurn ? legalActions(state).filter((a): a is PlayAction => a.type === 'play') : [];
  const playableHand = new Set(plays.map((a) => a.handIndex));
  const playableSlots = new Set(plays.filter((a) => a.handIndex === selected).map((a) => a.slot));

  // Botão voltar do Android: pede confirmação em vez de perder a partida.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!finished) confirmExit();
      else onMenu();
      return true;
    });
    return () => sub.remove();
  });

  function confirmExit() {
    Alert.alert('Sair da partida?', 'O progresso desta partida será perdido.', [
      { text: 'Continuar jogando', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: onMenu },
    ]);
  }

  function tapHand(index: number) {
    if (!playableHand.has(index)) return;
    playSfx('select');
    setSelected(selected === index ? null : index);
  }

  function tapMySlot(slot: number) {
    if (selected === null || !playableSlots.has(slot)) return;
    play(selected, slot);
    setSelected(null);
  }

  function handleForfeit() {
    setConfirmingForfeit(false);
    setSelected(null);
    forfeit();
  }

  function handleEndTurn() {
    setSelected(null);
    endTurn();
  }

  const selectedCard = selected !== null ? me.hand[selected] : undefined;
  let status: string;
  if (finished) status = 'Fim de jogo';
  else if (!isHumanTurn) status = 'Vez do bot…';
  else if (selectedCard) status = `Toque numa posição vazia para jogar ${selectedCard.name}`;
  else status = 'Sua vez: escolha uma carta da mão ou encerre o turno';

  const won = state.winner === HUMAN;
  const draw = state.winner === 'draw';

  return (
    <BattleTable
      cardWidth={cardWidth}
      turn={state.turn}
      status={status}
      foe={{ name: `Bot · ${botDeckName}`, icon: 'robot', hp: foe.hp, handCount: foe.hand.length, field: foe.field }}
      me={{ name: `Você · ${playerDeckName}`, hp: me.hp, field: me.field, hand: me.hand }}
      energy={isHumanTurn ? state.energy : null}
      energyPerTurn={state.rules.energyPerTurn}
      handSize={state.rules.handSize}
      myTurn={isHumanTurn}
      finished={finished}
      outcome={finished ? (draw ? 'draw' : won ? 'win' : 'lose') : null}
      selected={selected}
      playableHand={playableHand}
      playableSlots={playableSlots}
      onTapHand={tapHand}
      onTapSlot={tapMySlot}
      onEndTurn={handleEndTurn}
      onForfeit={() => setConfirmingForfeit(true)}
      log={log}
    >
      {confirmingForfeit && !finished && (
        <Dialog title="Desistir?" icon="flag-variant">
          <Text style={[ui.dim, { textAlign: 'center' }]}>A partida termina agora e conta como derrota.</Text>
          <Button label="Desistir" variant="danger" onPress={handleForfeit} />
          <Button label="Continuar jogando" variant="secondary" onPress={() => setConfirmingForfeit(false)} />
        </Dialog>
      )}

      {finished && (
        <Dialog
          title={forfeited ? 'Você desistiu' : draw ? 'Empate' : won ? 'Você venceu!' : 'O bot venceu'}
          icon={forfeited ? 'flag-variant' : draw ? 'handshake' : won ? 'trophy' : 'skull'}
          tone={draw ? 'neutral' : won ? 'good' : 'bad'}
        >
          {forfeited && <Text style={[ui.dim, { textAlign: 'center' }]}>Desistência conta como derrota.</Text>}
          <Text style={[ui.dim, { textAlign: 'center' }]}>
            Vida final: você {Math.max(0, me.hp)} · bot {Math.max(0, foe.hp)} · {state.turn} turnos
          </Text>
          <Text style={[ui.small, { textAlign: 'center', fontSize: 11 }]}>Semente da partida: {seed}</Text>
          <Button label="Revanche (mesmo baralho)" onPress={onRematch} />
          <Button label="Escolher outro baralho" variant="secondary" onPress={onChangeDeck} />
          <Button label="Menu" variant="secondary" onPress={onMenu} />
        </Dialog>
      )}
    </BattleTable>
  );
}
