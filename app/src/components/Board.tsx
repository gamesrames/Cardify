import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CardView } from './CardView';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { CARD_ASPECT, CARD_GAP, SIDE_PADDING } from '../layout';
import type { Creature } from '../motor';
import { colors, fonts, withAlpha } from '../theme';

// Peças do tabuleiro compartilhadas entre a partida contra o bot (GameScreen) e a online (OnlineGameScreen).
// Só desenham dados; nenhuma regra mora aqui.

const NATIVE = Platform.OS !== 'web';
/** Altura fixa da barra de jogador. Entra na conta de NON_CARD_HEIGHT (layout.ts). */
export const PLAYER_BAR_HEIGHT = 48;

interface PlayerBarProps {
  name: string;
  icon: IconName;
  hp: number;
  /** Linha de baixo: texto simples ("3 cartas na mão") ou um componente (os raios de energia). */
  detail: ReactNode;
}

export function PlayerBar({ name, icon, hp, detail }: PlayerBarProps) {
  const shownHp = Math.max(0, hp);
  // A vida caiu: o número "pulsa" para chamar o olho.
  const pulse = useRef(new Animated.Value(0)).current;
  const previous = useRef(shownHp);
  useEffect(() => {
    const lost = previous.current > shownHp;
    previous.current = shownHp;
    if (!lost) return;
    pulse.setValue(1);
    Animated.timing(pulse, { toValue: 0, duration: 500, useNativeDriver: NATIVE }).start();
  }, [shownHp, pulse]);

  return (
    <View style={styles.playerBar}>
      <View style={styles.avatar}>
        <Icon name={icon} size={18} color={colors.textDim} />
      </View>
      <View style={styles.playerText}>
        <Text style={styles.playerName} numberOfLines={1}>
          {name}
        </Text>
        {typeof detail === 'string' ? (
          <Text style={styles.playerDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : (
          detail
        )}
      </View>
      <Animated.View
        style={[styles.hp, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }]}
        accessibilityLabel={`Vida: ${shownHp}`}
      >
        <Icon name="heart" size={18} color={colors.badSoft} />
        <Text style={styles.hpText}>{shownHp}</Text>
      </Animated.View>
    </View>
  );
}

/** Raios de energia: cheios = energia disponível agora. `null` = não é a sua vez. */
export function EnergyPips({ energy, perTurn }: { energy: number | null; perTurn: number }) {
  const total = Math.max(perTurn, energy ?? 0);
  return (
    <View style={styles.pips} accessibilityLabel={energy === null ? 'Energia: aguardando a sua vez' : `Energia: ${energy}`}>
      {Array.from({ length: total }, (_, i) => {
        const filled = energy !== null && i < energy;
        return <Icon key={i} name={filled ? 'lightning-bolt' : 'lightning-bolt-outline'} size={15} color={filled ? colors.accent : colors.textFaint} />;
      })}
      <Text style={[styles.pipsText, energy === null && { color: colors.textFaint }]}>{energy === null ? 'aguarde a sua vez' : `${energy} de energia`}</Text>
    </View>
  );
}

export function Lane({
  field,
  cardWidth,
  selectedSlots,
  onTapSlot,
}: {
  field: (Creature | null)[];
  cardWidth: number;
  selectedSlots?: Set<number>;
  onTapSlot?: (slot: number) => void;
}) {
  return (
    <View style={styles.lane}>
      {field.map((creature, slot) =>
        creature ? (
          // A chave inclui a carta: criatura nova na posição = componente novo, que entra com a animação.
          <CardView key={`${slot}-${creature.card.id}`} card={creature.card} width={cardWidth} health={creature.health} hideCost appear />
        ) : (
          <EmptySlot
            key={`empty-${slot}`}
            width={cardWidth}
            number={slot + 1}
            highlight={selectedSlots?.has(slot) ?? false}
            onPress={onTapSlot ? () => onTapSlot(slot) : undefined}
          />
        ),
      )}
    </View>
  );
}

function EmptySlot({ width, number, highlight, onPress }: { width: number; number: number; highlight: boolean; onPress?: () => void }) {
  // Posição onde dá para jogar: a borda "respira" para mostrar que é tocável.
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!highlight) {
      breathe.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 0.55, duration: 650, useNativeDriver: NATIVE }),
        Animated.timing(breathe, { toValue: 1, duration: 650, useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [highlight, breathe]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || !highlight}
      accessibilityRole={highlight ? 'button' : undefined}
      accessibilityLabel={highlight ? `Jogar na posição ${number}` : `Posição ${number} vazia`}
      style={{ width, height: width / CARD_ASPECT }}
    >
      <Animated.View style={[styles.slot, { borderRadius: (width / 98) * 10 }, highlight && styles.slotHighlight, { opacity: breathe }]}>
        {highlight ? <Text style={styles.slotPlay}>Jogar aqui</Text> : <Text style={styles.slotNumber}>{number}</Text>}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playerBar: { height: PLAYER_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIDE_PADDING + 4, gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerText: { flex: 1, gap: 1 },
  playerName: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 14, lineHeight: 18 },
  playerDetail: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, lineHeight: 16 },
  hp: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hpText: { fontFamily: fonts.displayHeavy, color: colors.badSoft, fontSize: 20, lineHeight: 26 },
  pips: { flexDirection: 'row', alignItems: 'center', height: 16 },
  pipsText: { fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 12, lineHeight: 16, marginLeft: 5 },
  lane: { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: SIDE_PADDING, justifyContent: 'center' },
  slot: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotHighlight: { borderWidth: 2, borderColor: colors.accent, backgroundColor: withAlpha(colors.accent, 0.1) },
  slotNumber: { fontFamily: fonts.display, color: colors.textFaint, fontSize: 20 },
  slotPlay: { fontFamily: fonts.bodyBold, color: colors.accent, fontSize: 12, textAlign: 'center' },
});
