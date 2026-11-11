import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { ui } from '../components/ui';
import { DEFAULT_RULES, deckPower, getCards, PREBUILT_DECKS } from '../motor';
import { playSfx } from '../sfx';
import { colors, ELEMENT_INFO, fonts, radius, withAlpha } from '../theme';

interface Props {
  onStart: (deckName: string) => void;
  onBack: () => void;
}

export function DeckPickScreen({ onStart, onBack }: Props) {
  const names = Object.keys(PREBUILT_DECKS);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Screen
      title="Escolha seu baralho"
      onBack={onBack}
      footer={<Button label="Jogar" disabled={selected === null} onPress={() => selected && onStart(selected)} />}
    >
      <Text style={ui.dim}>O bot joga com outro baralho, sorteado.</Text>
      {names.map((name) => {
        const cards = getCards(PREBUILT_DECKS[name] ?? []);
        const isSelected = name === selected;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              playSfx('select');
              setSelected(name);
            }}
            style={[styles.deck, isSelected && styles.deckSelected]}
          >
            <View style={styles.deckHeader}>
              <Text style={styles.deckName}>{name}</Text>
              <Text style={ui.small}>
                Poder {deckPower(cards)}/{DEFAULT_RULES.deckPowerLimit}
              </Text>
            </View>
            <View style={styles.cards}>
              {cards.map((card) => {
                const element = ELEMENT_INFO[card.element];
                return (
                  <View key={card.id} style={styles.chip}>
                    <View style={[styles.chipDot, { backgroundColor: element.color }]}>
                      <Icon name={element.icon} size={11} color={element.onColor} />
                    </View>
                    <Text style={styles.chipText}>
                      {card.name} {card.attack}/{card.health}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  deck: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, borderWidth: 1.5, borderColor: colors.line },
  deckSelected: { borderColor: colors.accent, backgroundColor: withAlpha(colors.accent, 0.07) },
  deckHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  deckName: { fontFamily: fonts.display, color: colors.text, fontSize: 15, flexShrink: 1 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.raised,
    paddingLeft: 4,
    paddingRight: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 12 },
});
