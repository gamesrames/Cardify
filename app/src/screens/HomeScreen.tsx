import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { DEFAULT_RULES, ELEMENTS, hasAdvantage } from '../motor';
import { colors, ELEMENT_INFO } from '../theme';

interface Props {
  onPlay: () => void;
  onCreateCard: () => void;
  onMyDeck: () => void;
}

/** Ciclo de vantagens montado a partir do motor (nada de regra copiada aqui). */
function advantageCycle(): string {
  const parts: string[] = [];
  for (const attacker of ELEMENTS) {
    const defender = ELEMENTS.find((e) => hasAdvantage(attacker, e));
    if (defender) parts.push(`${ELEMENT_INFO[attacker].emoji} vence ${ELEMENT_INFO[defender].emoji}`);
  }
  return parts.join('  ·  ');
}

export function HomeScreen({ onPlay, onCreateCard, onMyDeck }: Props) {
  const r = DEFAULT_RULES;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cardify</Text>
      <Text style={styles.subtitle}>Protótipo · fases 1 e 2</Text>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Como jogar</Text>
        <Text style={styles.text}>
          • Cada um começa com {r.playerHp} de vida. Zerou a vida do outro, venceu.{'\n'}
          • Toque numa carta da sua mão e depois numa posição vazia do seu lado para jogá-la. Você tem {r.energyPerTurn}{' '}
          de energia por turno (⚡ no canto da carta é o custo).{'\n'}
          • Ao encerrar o turno, suas cartas atacam a carta da frente. Posição vazia na frente = dano direto na vida do
          adversário.{'\n'}
          • Elementos: {advantageCycle()}.
        </Text>
      </View>

      <Button label="Jogar contra o bot" onPress={onPlay} />
      <Button label="Meu baralho (com as suas fotos)" variant="secondary" onPress={onMyDeck} />
      <Button label="Criar carta com uma foto" variant="secondary" onPress={onCreateCard} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20, flexGrow: 1, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 44, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.textDim, fontSize: 15, textAlign: 'center' },
  box: { backgroundColor: colors.panel, borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.border },
  boxTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  text: { color: colors.textDim, fontSize: 15, lineHeight: 22 },
});
