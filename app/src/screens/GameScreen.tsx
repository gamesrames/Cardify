import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { legalActions } from '../motor';
import type { Action, Creature, PlayerState } from '../motor';
import { CARD_ASPECT, cardWidthFor, MAX_APP_WIDTH } from '../layout';
import { colors } from '../theme';
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

export function GameScreen({ playerDeckName, botDeckName, seed, onRematch, onChangeDeck, onMenu }: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const cardWidth = cardWidthFor(window.width, window.height, insets.top + insets.bottom);
  const { state, log, isHumanTurn, play, endTurn } = useGame(playerDeckName, botDeckName, seed);
  const [selected, setSelected] = useState<number | null>(null);
  const logRef = useRef<ScrollViewInstance>(null);

  const me = state.players[HUMAN];
  const foe = state.players[BOT];
  const finished = state.winner !== null;

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

  useEffect(() => {
    logRef.current?.scrollToEnd({ animated: true });
  }, [log.length]);

  function confirmExit() {
    Alert.alert('Sair da partida?', 'O progresso desta partida será perdido.', [
      { text: 'Continuar jogando', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: onMenu },
    ]);
  }

  function tapHand(index: number) {
    if (!playableHand.has(index)) return;
    setSelected(selected === index ? null : index);
  }

  function tapMySlot(slot: number) {
    if (selected === null || !playableSlots.has(slot)) return;
    play(selected, slot);
    setSelected(null);
  }

  function handleEndTurn() {
    setSelected(null);
    endTurn();
  }

  const selectedCard = selected !== null ? me.hand[selected] : undefined;
  let status: string;
  if (finished) status = 'Fim de jogo';
  else if (!isHumanTurn) status = '🤖 Turno do bot…';
  else if (selectedCard) status = `Toque numa posição vazia para jogar ${selectedCard.name}`;
  else status = 'Sua vez: escolha uma carta da mão ou encerre o turno';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.column}>
      <PlayerBar title={`🤖 Bot · ${botDeckName}`} player={foe} extra={`🃏 ${foe.hand.length} na mão`} />
      <Lane field={foe.field} cardWidth={cardWidth} />

      <View style={styles.statusBar}>
        <Text style={styles.turn}>Turno {state.turn}</Text>
        <Text style={styles.status} numberOfLines={2}>
          {status}
        </Text>
      </View>

      <Lane field={me.field} cardWidth={cardWidth} mine selectedSlots={playableSlots} onTapSlot={tapMySlot} />
      <PlayerBar
        title={`🙂 Você · ${playerDeckName}`}
        player={me}
        extra={isHumanTurn ? `⚡ ${state.energy} de energia` : '⚡ —'}
      />

      <View style={styles.hand}>
        {me.hand.map((card, i) => (
          <CardView
            key={`${card.id}-${i}`}
            card={card}
            width={cardWidth}
            selected={selected === i}
            dimmed={isHumanTurn && !playableHand.has(i)}
            onPress={() => tapHand(i)}
          />
        ))}
        {Array.from({ length: Math.max(0, state.rules.handSize - me.hand.length) }, (_, i) => (
          <View key={`empty-${i}`} style={{ width: cardWidth, height: cardWidth / CARD_ASPECT }} />
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Encerrar turno" disabled={!isHumanTurn} onPress={handleEndTurn} />
      </View>

      <ScrollView ref={logRef} style={styles.log} contentContainerStyle={{ padding: 8 }}>
        {log.map((line) => (
          <Text key={line.id} style={[styles.logLine, line.tone === 'good' && { color: colors.good }, line.tone === 'bad' && { color: colors.bad }, line.tone === 'info' && { color: colors.warn }]}>
            {line.text}
          </Text>
        ))}
      </ScrollView>

      </View>

      {finished && (
        <View style={styles.overlay}>
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>
              {state.winner === 'draw' ? 'Empate' : state.winner === HUMAN ? '🏆 Você venceu!' : '💀 O bot venceu'}
            </Text>
            <Text style={styles.resultInfo}>
              Vida final: você {Math.max(0, me.hp)} · bot {Math.max(0, foe.hp)} · {state.turn} turnos
            </Text>
            <Text style={styles.seed}>Semente da partida: {seed}</Text>
            <Button label="Revanche (mesmo baralho)" onPress={onRematch} />
            <Button label="Escolher outro baralho" variant="secondary" onPress={onChangeDeck} />
            <Button label="Menu" variant="secondary" onPress={onMenu} />
          </View>
        </View>
      )}
    </View>
  );
}

function PlayerBar({ title, player, extra }: { title: string; player: PlayerState; extra: string }) {
  return (
    <View style={styles.playerBar}>
      <Text style={styles.playerTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.hp}>❤️ {Math.max(0, player.hp)}</Text>
      <Text style={styles.extra}>{extra}</Text>
    </View>
  );
}

function Lane({
  field,
  cardWidth,
  mine = false,
  selectedSlots,
  onTapSlot,
}: {
  field: (Creature | null)[];
  cardWidth: number;
  mine?: boolean;
  selectedSlots?: Set<number>;
  onTapSlot?: (slot: number) => void;
}) {
  return (
    <View style={styles.lane}>
      {field.map((creature, slot) =>
        creature ? (
          <CardView key={slot} card={creature.card} width={cardWidth} health={creature.health} />
        ) : (
          <EmptySlot
            key={slot}
            width={cardWidth}
            label={mine ? `Posição ${slot + 1}` : 'Vazia'}
            highlight={selectedSlots?.has(slot) ?? false}
            onPress={onTapSlot ? () => onTapSlot(slot) : undefined}
          />
        ),
      )}
    </View>
  );
}

function EmptySlot({ width, label, highlight, onPress }: { width: number; label: string; highlight: boolean; onPress?: () => void }) {
  return (
    <Pressable
      style={[styles.slot, { width, height: width / CARD_ASPECT }, highlight && styles.slotHighlight]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.slotText, highlight && { color: colors.good }]}>{highlight ? 'Jogar aqui' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Em tela larga (navegador) o jogo fica numa coluna centralizada, como num celular.
  column: { flex: 1, width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center' },
  playerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 10 },
  playerTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  hp: { color: colors.text, fontSize: 16, fontWeight: '800' },
  extra: { color: colors.textDim, fontSize: 13 },
  lane: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, justifyContent: 'center' },
  slot: {
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotHighlight: { borderColor: colors.good, backgroundColor: 'rgba(74, 222, 128, 0.1)' },
  slotText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panelAlt,
  },
  turn: { color: colors.warn, fontSize: 13, fontWeight: '800' },
  status: { flex: 1, color: colors.text, fontSize: 13 },
  hand: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8, justifyContent: 'center' },
  actions: { paddingHorizontal: 12, paddingVertical: 8 },
  log: { flex: 1, minHeight: 60, backgroundColor: colors.panel, marginHorizontal: 12, borderRadius: 8 },
  logLine: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultBox: { width: '100%', backgroundColor: colors.panel, borderRadius: 16, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.border },
  resultTitle: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  resultInfo: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  seed: { color: colors.textDim, fontSize: 11, textAlign: 'center' },
});
