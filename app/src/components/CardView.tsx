import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_RULES, energyCostOf } from '../motor';
import type { CardDef } from '../motor';
import { colors, ELEMENT_INFO, RARITY_INFO } from '../theme';

interface Props {
  card: CardDef;
  /** Vida atual, para criaturas em campo (o dano persiste entre turnos). Sem isso, mostra a vida da carta. */
  health?: number;
  selected?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
}

/** Desenha uma carta. Só mostra dados; nenhuma regra mora aqui. */
export function CardView({ card, health, selected = false, dimmed = false, onPress }: Props) {
  const element = ELEMENT_INFO[card.element];
  const rarity = RARITY_INFO[card.rarity];
  const currentHealth = health ?? card.health;
  const damaged = currentHealth < card.health;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.card,
        { borderColor: selected ? colors.accent : rarity.color, backgroundColor: colors.panel },
        selected && styles.selected,
        dimmed && styles.dimmed,
      ]}
    >
      <View style={[styles.header, { backgroundColor: element.color }]}>
        <Text style={styles.cost}>⚡{energyCostOf(card, DEFAULT_RULES)}</Text>
        <Text style={styles.emoji}>{element.emoji}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {card.name}
      </Text>
      <Text style={[styles.rarity, { color: rarity.color }]} numberOfLines={1}>
        {rarity.label}
      </Text>
      <View style={styles.stats}>
        <Text style={styles.stat}>⚔️ {card.attack}</Text>
        <Text style={[styles.stat, damaged && { color: colors.bad }]}>❤️ {currentHealth}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 0.72,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
  },
  selected: { transform: [{ translateY: -6 }] },
  dimmed: { opacity: 0.4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cost: { color: '#fff', fontSize: 12, fontWeight: '800' },
  emoji: { fontSize: 26 },
  name: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4, paddingHorizontal: 2 },
  rarity: { fontSize: 10, textAlign: 'center', fontWeight: '600' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 'auto', paddingBottom: 6 },
  stat: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
