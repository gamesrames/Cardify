import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Lane, PlayerBar } from '../components/Board';
import { CardView } from '../components/CardView';
import { CardPhotosProvider } from '../cardPhotos';
import { describeEvents } from '../describeEvent';
import { CARD_ASPECT, cardWidthFor, MAX_APP_WIDTH } from '../layout';
import { clockOffsetMs, describeOutcome, formatClock, isGame, msLeft, shouldClaimTimeout } from '../matchApi';
import type { GameViewData } from '../matchApi';
import { useMatchPhotos } from '../useMatchPhotos';
import { useOnlineMatch } from '../useOnlineMatch';
import { colors } from '../theme';

interface Props {
  matchId: string;
  /** Volta ao menu (a partida continua valendo no servidor; dá para retomar por "Jogar online"). */
  onExit: () => void;
}

type PlayAction = { type: 'play'; handIndex: number; slot: number };

/**
 * Partida 1x1 online. A tela só mostra a visão que o servidor mandou e PEDE ações; quem decide é o servidor.
 * Cada jogador vê a própria mão e só a quantidade de cartas da mão do outro.
 */
export function OnlineGameScreen({ matchId, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { row, receivedAt, loading, error, busy, act } = useOnlineMatch(matchId);
  const view = row?.view;
  const game = isGame(view) ? view : null;
  const photoUrls = useMatchPhotos(game?.photos);

  // Relógio da tela (só enquanto há um prazo correndo).
  const [now, setNow] = useState(() => Date.now());
  const running = game !== null && game.game.winner === null;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [running]);
  const offset = game ? clockOffsetMs(game.serverNowMs, receivedAt) : 0;

  // Pede ao servidor que aplique o estouro quando o prazo do ADVERSÁRIO vence. O servidor confere o relógio
  // dele; se o prazo ainda não venceu de verdade (relógios diferentes), responde que não e tentamos de novo.
  const lastClaim = useRef({ version: -1, at: 0 });
  useEffect(() => {
    if (!game || !shouldClaimTimeout(game, offset, now)) return;
    if (busy || (lastClaim.current.version === game.version && now - lastClaim.current.at < 4000)) return;
    lastClaim.current = { version: game.version, at: now };
    void act({ op: 'timeout', matchId }, { silent: true });
  }, [game, offset, now, busy, act, matchId]);

  const [selected, setSelected] = useState<number | null>(null);
  const [confirmingForfeit, setConfirmingForfeit] = useState(false);
  const logRef = useRef<ScrollViewInstance>(null);
  const log = useMemo(
    () => (game ? describeEvents(game.log, game.game.seat, game.logStart, { foeName: game.foeName ?? 'Adversário', endCause: game.endCause }) : []),
    [game],
  );
  useEffect(() => {
    logRef.current?.scrollToEnd({ animated: true });
  }, [log.length]);
  // A mão mudou (outra versão da partida): a seleção antiga pode apontar para outra carta.
  const version = game?.version;
  useEffect(() => setSelected(null), [version]);

  const finished = game !== null && game.game.winner !== null;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (game && !finished) {
        Alert.alert('Sair da tela da partida?', 'A partida continua valendo e o tempo do turno corre. Volte por "Jogar online" no menu.', [
          { text: 'Ficar', style: 'cancel' },
          { text: 'Sair', onPress: onExit },
        ]);
      } else onExit();
      return true;
    });
    return () => sub.remove();
  });

  if (!row || !view) {
    return (
      <Centered>
        <Text style={styles.big}>{loading ? 'Carregando a partida…' : 'Partida não encontrada'}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Voltar" variant="secondary" onPress={onExit} />
      </Centered>
    );
  }

  if (!game) {
    // Convite aguardando o adversário (ou cancelado/vencido).
    if (row.status === 'finished') {
      return (
        <Centered>
          <Text style={styles.big}>Convite encerrado</Text>
          <Text style={styles.dim}>O convite foi cancelado ou venceu. Crie outro em "Jogar online".</Text>
          <Button label="Voltar ao menu" onPress={onExit} />
        </Centered>
      );
    }
    const code = view.kind === 'waiting' ? view.code : '';
    return (
      <Centered>
        <Text style={styles.big}>Esperando o adversário</Text>
        <Text style={styles.dim}>Passe este código ao seu amigo. Ele entra em "Jogar online" → "Entrar com código". Vale por 15 minutos.</Text>
        <Text selectable style={styles.code}>
          {code}
        </Text>
        <Text style={styles.dim}>A partida começa sozinha quando ele entrar.</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button
          label="Cancelar convite"
          variant="secondary"
          disabled={busy}
          onPress={async () => {
            if (await act({ op: 'cancel', matchId })) onExit();
          }}
        />
        <Button label="Voltar ao menu (o convite continua)" variant="secondary" onPress={onExit} />
      </Centered>
    );
  }

  const g = game.game;
  const myTurn = !finished && g.active === g.seat;
  const cardWidth = cardWidthFor(window.width, window.height, insets.top + insets.bottom);
  const plays = myTurn ? g.legal.filter((a): a is PlayAction => a.type === 'play') : [];
  const playableHand = new Set(plays.map((a) => a.handIndex));
  const playableSlots = new Set(plays.filter((a) => a.handIndex === selected).map((a) => a.slot));
  const foeName = game.foeName ?? 'Adversário';
  const left = msLeft(game.deadlineMs, offset, now);
  const selectedCard = selected !== null ? g.me.hand[selected] : undefined;
  const myMissed = game.missed[0];

  let status: string;
  if (finished) status = 'Fim de jogo';
  else if (!myTurn) status = `⏳ Vez de ${foeName}…`;
  else if (selectedCard) status = `Toque numa posição vazia para jogar ${selectedCard.name}`;
  else status = 'Sua vez: escolha uma carta da mão ou encerre o turno';

  function tapHand(index: number) {
    if (busy || !playableHand.has(index)) return;
    setSelected(selected === index ? null : index);
  }
  function tapMySlot(slot: number) {
    if (busy || selected === null || !playableSlots.has(slot)) return;
    const handIndex = selected;
    setSelected(null);
    void act({ op: 'play', matchId, version: game!.version, handIndex, slot });
  }
  function endTurn() {
    setSelected(null);
    void act({ op: 'end', matchId, version: game!.version });
  }
  async function forfeit() {
    setConfirmingForfeit(false);
    setSelected(null);
    await act({ op: 'forfeit', matchId });
  }

  const outcome = finished ? describeOutcome(game) : null;

  return (
    <CardPhotosProvider value={photoUrls}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.column}>
          <PlayerBar title={`🆚 ${foeName}`} hp={g.foe.hp} extra={`🃏 ${g.foe.handCount} na mão`} />
          <Lane field={g.foe.field} cardWidth={cardWidth} />

          <View style={styles.statusBar}>
            <Text style={styles.turn}>Turno {g.turn}</Text>
            <Text style={styles.status} numberOfLines={2}>
              {error ?? status}
            </Text>
            {left !== null && !finished && (
              <Text style={[styles.clock, left <= 10_000 && { color: colors.bad }]}>⏱ {formatClock(left)}</Text>
            )}
          </View>
          {myTurn && myMissed > 0 && (
            <Text style={styles.warn}>
              ⚠️ Seu tempo já estourou {myMissed}x seguida(s). Com {game.maxMissedTurns} você perde por tempo.
            </Text>
          )}

          <Lane field={g.me.field} cardWidth={cardWidth} mine selectedSlots={playableSlots} onTapSlot={tapMySlot} />
          <PlayerBar title={`🙂 ${game.myName ?? 'Você'}`} hp={g.me.hp} extra={myTurn ? `⚡ ${g.energy} de energia` : '⚡ —'} />

          <View style={styles.hand}>
            {g.me.hand.map((card, i) => (
              <CardView
                key={`${card.id}-${i}`}
                card={card}
                width={cardWidth}
                selected={selected === i}
                dimmed={myTurn && !playableHand.has(i)}
                onPress={() => tapHand(i)}
              />
            ))}
            {Array.from({ length: Math.max(0, g.rules.handSize - g.me.hand.length) }, (_, i) => (
              <View key={`empty-${i}`} style={{ width: cardWidth, height: cardWidth / CARD_ASPECT }} />
            ))}
          </View>

          <View style={styles.actions}>
            <View style={styles.endTurn}>
              <Button label="Encerrar turno" disabled={!myTurn || busy} onPress={endTurn} />
            </View>
            <Pressable
              style={styles.forfeit}
              onPress={() => setConfirmingForfeit(true)}
              disabled={finished}
              accessibilityRole="button"
              accessibilityLabel="Desistir da partida"
            >
              <Text style={styles.forfeitText}>🏳️ Desistir</Text>
            </Pressable>
          </View>

          <ScrollView ref={logRef} style={styles.log} contentContainerStyle={{ padding: 8 }}>
            {log.map((line) => (
              <Text
                key={line.id}
                style={[styles.logLine, line.tone === 'good' && { color: colors.good }, line.tone === 'bad' && { color: colors.bad }, line.tone === 'info' && { color: colors.warn }]}
              >
                {line.text}
              </Text>
            ))}
          </ScrollView>
        </View>

        {confirmingForfeit && !finished && (
          <View style={styles.overlay}>
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>Desistir?</Text>
              <Text style={styles.resultInfo}>A partida termina agora e conta como derrota.</Text>
              <Button label="Desistir" onPress={forfeit} />
              <Button label="Continuar jogando" variant="secondary" onPress={() => setConfirmingForfeit(false)} />
            </View>
          </View>
        )}

        {outcome && (
          <View style={styles.overlay}>
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>{outcome.title}</Text>
              <Text style={styles.resultInfo}>{outcome.detail}</Text>
              <Text style={styles.resultInfo}>
                Vida final: você {Math.max(0, g.me.hp)} · {foeName} {Math.max(0, g.foe.hp)} · {g.turn} turnos
              </Text>
              <Button label="Menu" onPress={onExit} />
            </View>
          </View>
        )}
      </View>
    </CardPhotosProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.centered}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center' },
  centered: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center', maxWidth: MAX_APP_WIDTH, width: '100%', alignSelf: 'center' },
  big: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  dim: { color: colors.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  error: { color: colors.bad, fontSize: 14, textAlign: 'center' },
  code: {
    color: colors.accent,
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: colors.panel,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
  clock: { color: colors.warn, fontSize: 15, fontWeight: '800' },
  warn: { color: colors.warn, fontSize: 12, paddingHorizontal: 12, marginBottom: 4 },
  hand: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  endTurn: { flex: 1 },
  forfeit: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  forfeitText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
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
});
