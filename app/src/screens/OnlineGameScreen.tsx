import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BattleTable } from '../components/BattleTable';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { MatchReward } from '../components/MatchReward';
import { ui } from '../components/ui';
import { CardPhotosProvider } from '../cardPhotos';
import { describeEvents } from '../describeEvent';
import { cardWidthFor, MAX_APP_WIDTH } from '../layout';
import { clockOffsetMs, describeOutcome, formatClock, isGame, msLeft, shouldClaimTimeout } from '../matchApi';
import { playSfx } from '../sfx';
import { useMatchPhotos } from '../useMatchPhotos';
import { useOnlineMatch } from '../useOnlineMatch';
import { colors, fonts, radius } from '../theme';

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
  const log = useMemo(
    () => (game ? describeEvents(game.log, game.game.seat, game.logStart, { foeName: game.foeName ?? 'Adversário', endCause: game.endCause }) : []),
    [game],
  );
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
        <Text style={ui.hero}>{loading ? 'Carregando a partida…' : 'Partida não encontrada'}</Text>
        {error && <Text style={[ui.error, styles.center]}>{error}</Text>}
        <Button label="Voltar" variant="secondary" onPress={onExit} />
      </Centered>
    );
  }

  if (!game) {
    // Convite aguardando o adversário (ou cancelado/vencido).
    if (row.status === 'finished') {
      return (
        <Centered>
          <Text style={ui.hero}>Convite encerrado</Text>
          <Text style={[ui.dim, styles.center]}>O convite foi cancelado ou venceu. Crie outro em "Jogar online".</Text>
          <Button label="Voltar ao menu" onPress={onExit} />
        </Centered>
      );
    }
    const code = view.kind === 'waiting' ? view.code : '';
    return (
      <Centered>
        <Text style={ui.hero}>Esperando o adversário</Text>
        <Text style={[ui.dim, styles.center]}>Passe este código ao seu amigo. Ele entra em "Jogar online" → "Entrar com código". Vale por 15 minutos.</Text>
        <Text selectable style={styles.code}>
          {code}
        </Text>
        <Text style={[ui.dim, styles.center]}>A partida começa sozinha quando ele entrar.</Text>
        {error && <Text style={[ui.error, styles.center]}>{error}</Text>}
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
  else if (!myTurn) status = `Vez de ${foeName}…`;
  else if (selectedCard) status = `Toque numa posição vazia para jogar ${selectedCard.name}`;
  else status = 'Sua vez: escolha uma carta da mão ou encerre o turno';

  function tapHand(index: number) {
    if (busy || !playableHand.has(index)) return;
    playSfx('select');
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
  const won = finished && g.winner === g.seat;

  return (
    <CardPhotosProvider value={photoUrls}>
      <BattleTable
        cardWidth={cardWidth}
        turn={g.turn}
        status={error ?? status}
        statusIsError={error !== null}
        clock={left !== null && !finished ? { text: formatClock(left), urgent: left <= 10_000 } : null}
        warning={myTurn && myMissed > 0 ? `Seu tempo já estourou ${myMissed}x seguida(s). Com ${game.maxMissedTurns} você perde por tempo.` : null}
        foe={{ name: foeName, icon: 'account', hp: g.foe.hp, handCount: g.foe.handCount, field: g.foe.field }}
        me={{ name: game.myName ?? 'Você', hp: g.me.hp, field: g.me.field, hand: g.me.hand }}
        energy={myTurn ? g.energy : null}
        energyPerTurn={g.rules.energyPerTurn}
        handSize={g.rules.handSize}
        myTurn={myTurn}
        busy={busy}
        finished={finished}
        outcome={finished ? (g.winner === 'draw' ? 'draw' : won ? 'win' : 'lose') : null}
        selected={selected}
        playableHand={playableHand}
        playableSlots={playableSlots}
        onTapHand={tapHand}
        onTapSlot={tapMySlot}
        onEndTurn={endTurn}
        onForfeit={() => setConfirmingForfeit(true)}
        log={log}
      >
        {confirmingForfeit && !finished && (
          <Dialog title="Desistir?" icon="flag-variant">
            <Text style={[ui.dim, styles.center]}>A partida termina agora e conta como derrota.</Text>
            <Button label="Desistir" variant="danger" onPress={forfeit} />
            <Button label="Continuar jogando" variant="secondary" onPress={() => setConfirmingForfeit(false)} />
          </Dialog>
        )}

        {outcome && (
          <Dialog
            title={outcome.title}
            tone={outcome.tone}
            icon={outcome.tone === 'good' ? 'trophy' : outcome.tone === 'neutral' ? 'handshake' : game.endCause === 'forfeit' ? 'flag-variant' : game.endCause === 'timeout' || game.endCause === 'abandoned' ? 'timer-outline' : 'skull'}
          >
            <Text style={[ui.dim, styles.center]}>{outcome.detail}</Text>
            <Text style={[ui.dim, styles.center]}>
              Vida final: você {Math.max(0, g.me.hp)} · {foeName} {Math.max(0, g.foe.hp)} · {g.turn} turnos
            </Text>
            <MatchReward matchId={matchId} seat={g.seat} />
            <Button label="Menu" onPress={onExit} />
          </Dialog>
        )}
      </BattleTable>
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
  centered: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center', maxWidth: MAX_APP_WIDTH, width: '100%', alignSelf: 'center' },
  center: { textAlign: 'center' },
  // O código do convite é o centro da tela de espera: grande, espaçado e fácil de ditar.
  code: {
    fontFamily: fonts.displayHeavy,
    color: colors.accent,
    fontSize: 40,
    letterSpacing: 6,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
