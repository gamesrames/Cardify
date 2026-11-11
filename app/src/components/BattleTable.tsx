import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { EnergyPips, Lane, PlayerBar } from './Board';
import { CardView } from './CardView';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { LogLine } from '../describeEvent';
import { CARD_ASPECT, CARD_GAP, MAX_APP_WIDTH, SIDE_PADDING } from '../layout';
import type { CardDef, Creature } from '../motor';
import { haptic, playSfx } from '../sfx';
import { colors, fonts, radius } from '../theme';

// A mesa da partida, igual para o jogo contra o bot e para o online. As duas telas (GameScreen e
// OnlineGameScreen) cuidam de ONDE vem o estado (motor local ou servidor) e entregam tudo pronto
// aqui; este componente só desenha, anima e toca os sons. Nenhuma regra mora aqui.
// Mudou a altura de alguma faixa? Confira NON_CARD_HEIGHT em layout.ts (o teste acusa se faltar espaço).

export interface BattleTableProps {
  cardWidth: number;
  turn: number;
  /** Frase da faixa do meio ("Sua vez: ..."). `statusIsError` pinta de vermelho (erro do servidor). */
  status: string;
  statusIsError?: boolean;
  /** Relógio do turno (só online). `urgent` = últimos segundos. */
  clock?: { text: string; urgent: boolean } | null;
  /** Aviso extra abaixo da faixa (ex.: tempo estourado). */
  warning?: string | null;
  foe: { name: string; icon: IconName; hp: number; handCount: number; field: (Creature | null)[] };
  me: { name: string; hp: number; field: (Creature | null)[]; hand: readonly CardDef[] };
  /** Energia disponível agora; `null` quando não é a minha vez. */
  energy: number | null;
  energyPerTurn: number;
  handSize: number;
  myTurn: boolean;
  /** Esperando o servidor responder: trava os toques. */
  busy?: boolean;
  finished: boolean;
  /** Resultado para o som final: definido quando `finished`. */
  outcome?: 'win' | 'lose' | 'draw' | null;
  selected: number | null;
  playableHand: Set<number>;
  playableSlots: Set<number>;
  onTapHand: (index: number) => void;
  onTapSlot: (slot: number) => void;
  onEndTurn: () => void;
  onForfeit: () => void;
  log: readonly LogLine[];
  /** Janelas por cima da mesa (resultado, confirmação). */
  children?: ReactNode;
}

export function BattleTable(props: BattleTableProps) {
  const { cardWidth, foe, me, myTurn, finished, selected, playableHand, playableSlots, log } = props;
  const insets = useSafeAreaInsets();
  const logRef = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    logRef.current?.scrollToEnd({ animated: true });
  }, [log.length]);
  useBattleFx(props);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.column}>
        <PlayerBar name={foe.name} icon={foe.icon} hp={foe.hp} detail={`${foe.handCount} ${foe.handCount === 1 ? 'carta' : 'cartas'} na mão`} />
        <Lane field={foe.field} cardWidth={cardWidth} />

        <View style={styles.statusBar}>
          <Text style={styles.turn}>TURNO {props.turn}</Text>
          <Text style={[styles.status, props.statusIsError && { color: colors.badSoft }]} numberOfLines={2}>
            {props.status}
          </Text>
          {props.clock && (
            <View style={styles.clock}>
              <Icon name="timer-outline" size={15} color={props.clock.urgent ? colors.bad : colors.warn} />
              <Text style={[styles.clockText, props.clock.urgent && { color: colors.bad }]}>{props.clock.text}</Text>
            </View>
          )}
        </View>
        {props.warning && <Text style={styles.warning}>{props.warning}</Text>}

        <Lane field={me.field} cardWidth={cardWidth} selectedSlots={playableSlots} onTapSlot={props.onTapSlot} />
        <PlayerBar name={me.name} icon="account" hp={me.hp} detail={<EnergyPips energy={props.energy} perTurn={props.energyPerTurn} />} />

        <View style={styles.hand}>
          {me.hand.map((card, i) => (
            <CardView
              key={`${card.id}-${i}`}
              card={card}
              width={cardWidth}
              selected={selected === i}
              dimmed={myTurn && !playableHand.has(i)}
              onPress={() => props.onTapHand(i)}
            />
          ))}
          {Array.from({ length: Math.max(0, props.handSize - me.hand.length) }, (_, i) => (
            <View key={`empty-${i}`} style={{ width: cardWidth, height: cardWidth / CARD_ASPECT }} />
          ))}
        </View>

        <View style={styles.actions}>
          <View style={styles.endTurn}>
            <Button label="Encerrar turno" disabled={!myTurn || props.busy} onPress={props.onEndTurn} />
          </View>
          {/* Discreto de propósito: não é a ação principal e não deve ser tocado por engano. */}
          <Button label="Desistir" variant="ghost" icon="flag-variant" disabled={finished} onPress={props.onForfeit} />
        </View>

        <ScrollView ref={logRef} style={styles.log} contentContainerStyle={styles.logContent}>
          {log.map((line) => (
            <Text
              key={line.id}
              style={[styles.logLine, line.tone === 'good' && { color: colors.good }, line.tone === 'bad' && { color: colors.badSoft }, line.tone === 'info' && { color: colors.warn }]}
            >
              {line.text}
            </Text>
          ))}
        </ScrollView>
      </View>
      {props.children}
    </View>
  );
}

/**
 * Sons e vibração da partida, decididos comparando o estado de agora com o da renderização anterior
 * (carta nova na mesa, vida que caiu, vez que chegou, fim de jogo). Assim serve tanto para o motor
 * local quanto para a visão que chega do servidor, sem depender do formato dos eventos.
 */
function useBattleFx({ foe, me, myTurn, finished, outcome }: BattleTableProps) {
  const previous = useRef<{ foeHp: number; myHp: number; foeField: (Creature | null)[]; myField: (Creature | null)[]; myTurn: boolean; finished: boolean } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = { foeHp: foe.hp, myHp: me.hp, foeField: foe.field, myField: me.field, myTurn, finished };
    if (!before) return; // primeira renderização: nada mudou ainda

    const played = arrived(before.myField, me.field) || arrived(before.foeField, foe.field);
    const iWasHit = me.hp < before.myHp;
    const damage = iWasHit || foe.hp < before.foeHp || wounded(before.myField, me.field) || wounded(before.foeField, foe.field);

    if (finished && !before.finished) {
      playSfx(outcome === 'win' ? 'win' : 'lose');
      haptic(outcome === 'win' ? 'success' : 'error');
      return;
    }
    if (damage) {
      playSfx('hit');
      if (iWasHit) haptic('medium');
    } else if (played) {
      playSfx('play');
      haptic('light');
    }
    if (myTurn && !before.myTurn && !finished) playSfx('turn');
  }, [foe.hp, me.hp, foe.field, me.field, myTurn, finished, outcome]);
}

/** Alguma posição que estava vazia (ou com outra carta) agora tem uma criatura nova? */
function arrived(before: (Creature | null)[], now: (Creature | null)[]): boolean {
  return now.some((creature, i) => creature !== null && before[i]?.card.id !== creature.card.id);
}

/** Alguma criatura perdeu vida ou saiu da mesa? */
function wounded(before: (Creature | null)[], now: (Creature | null)[]): boolean {
  return before.some((creature, i) => {
    if (!creature) return false;
    const current = now[i];
    return !current || current.card.id !== creature.card.id || current.health < creature.health;
  });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Em tela larga (navegador) o jogo fica numa coluna centralizada, como num celular.
  column: { flex: 1, width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 40,
    marginVertical: 8,
    marginHorizontal: SIDE_PADDING + 4,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  turn: { fontFamily: fonts.display, color: colors.accent, fontSize: 10.5, letterSpacing: 0.5 },
  status: { flex: 1, fontFamily: fonts.bodySemi, color: colors.text, fontSize: 12.5, lineHeight: 16 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clockText: { fontFamily: fonts.display, color: colors.warn, fontSize: 13 },
  warning: { fontFamily: fonts.bodySemi, color: colors.warn, fontSize: 12, lineHeight: 16, paddingHorizontal: SIDE_PADDING + 4, marginTop: -2, marginBottom: 6 },
  // paddingTop = espaço para a carta escolhida subir sem cobrir a barra de cima.
  hand: { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: SIDE_PADDING, paddingTop: 12, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SIDE_PADDING + 4, paddingVertical: 10 },
  endTurn: { flex: 1 },
  log: { flex: 1, minHeight: 52, marginHorizontal: SIDE_PADDING + 4, marginBottom: 8, borderRadius: radius.md, backgroundColor: colors.surface },
  logContent: { paddingHorizontal: 12, paddingVertical: 8 },
  logLine: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, lineHeight: 17 },
});
