import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { DEFAULT_RULES, deckPower, getCards, PREBUILT_DECKS } from '../motor';
import { colors, ELEMENT_INFO } from '../theme';

interface Props {
  onStart: (deckName: string) => void;
  onBack: () => void;
}

export function DeckPickScreen({ onStart, onBack }: Props) {
  const names = Object.keys(PREBUILT_DECKS);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.title}>Escolha seu baralho</Text>
        <Text style={styles.hint}>O bot joga com outro baralho, sorteado.</Text>
        {names.map((name) => {
          const cards = getCards(PREBUILT_DECKS[name] ?? []);
          const isSelected = name === selected;
          return (
            <Pressable key={name} onPress={() => setSelected(name)} style={[styles.deck, isSelected && styles.deckSelected]}>
              <View style={styles.deckHeader}>
                <Text style={styles.deckName}>{name}</Text>
                <Text style={styles.power}>
                  Poder {deckPower(cards)}/{DEFAULT_RULES.deckPowerLimit}
                </Text>
              </View>
              <View style={styles.cards}>
                {cards.map((card) => (
                  <Text key={card.id} style={styles.chip}>
                    {ELEMENT_INFO[card.element].emoji} {card.name} {card.attack}/{card.health}
                  </Text>
                ))}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Button label="Voltar" variant="secondary" onPress={onBack} />
        </View>
        <View style={{ flex: 2 }}>
          <Button label="Jogar" disabled={selected === null} onPress={() => selected && onStart(selected)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: 14 },
  deck: { backgroundColor: colors.panel, borderRadius: 14, padding: 14, gap: 10, borderWidth: 2, borderColor: colors.border },
  deckSelected: { borderColor: colors.accent, backgroundColor: colors.panelAlt },
  deckHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deckName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  power: { color: colors.textDim, fontSize: 13 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  footer: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
});
