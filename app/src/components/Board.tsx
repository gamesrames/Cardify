import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardView } from './CardView';
import { CARD_ASPECT } from '../layout';
import type { Creature } from '../motor';
import { colors } from '../theme';

// Peças do tabuleiro compartilhadas entre a partida contra o bot (GameScreen) e a online (OnlineGameScreen).
// Só desenham dados; nenhuma regra mora aqui.

export function PlayerBar({ title, hp, extra }: { title: string; hp: number; extra: string }) {
  return (
    <View style={styles.playerBar}>
      <Text style={styles.playerTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.hp}>❤️ {Math.max(0, hp)}</Text>
      <Text style={styles.extra}>{extra}</Text>
    </View>
  );
}

export function Lane({
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
});
