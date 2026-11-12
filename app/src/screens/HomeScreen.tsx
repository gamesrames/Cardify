import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { ui } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { MAX_APP_WIDTH } from '../layout';
import { DEFAULT_RULES, ELEMENTS, getCard, hasAdvantage } from '../motor';
import type { Element } from '../motor';
import { isMuted, onMutedChange, playSfx, setMuted } from '../sfx';
import { colors, ELEMENT_INFO, fonts, radius } from '../theme';

interface Props {
  onPlay: () => void;
  onCreateCard: () => void;
  onMyDeck: () => void;
  /** Sem servidor configurado (modo offline) não há partida online: o botão some. */
  onOnline?: () => void;
  /** Sem servidor configurado (modo offline) não há conta: o botão some. */
  onAccount?: () => void;
  accountLabel?: string;
}

/** Pares "quem vence quem", montados a partir do motor (nada de regra copiada aqui). */
function advantagePairs(): [Element, Element][] {
  const pairs: [Element, Element][] = [];
  for (const attacker of ELEMENTS) {
    const defender = ELEMENTS.find((e) => hasAdvantage(attacker, e));
    if (defender) pairs.push([attacker, defender]);
  }
  return pairs;
}

// Cartas de enfeite do leque da tela inicial (três das 30 fixas, de elementos e raridades diferentes).
const SHOWCASE = [getCard('planta-cervo'), getCard('fogo-fenix'), getCard('agua-tubarao')] as const;

export function HomeScreen({ onPlay, onCreateCard, onMyDeck, onOnline, onAccount, accountLabel }: Props) {
  const r = DEFAULT_RULES;
  const window = useWindowDimensions();
  const [showRules, setShowRules] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  useEffect(() => onMutedChange(setMutedState), []);

  // O leque encolhe em telas baixas para os botões caberem sem rolar.
  const centerWidth = Math.max(84, Math.min(156, (window.height - 600) / 1.75));
  const sideWidth = centerWidth * 0.9;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.top}>
          <Pressable
            onPress={() => {
              setMuted(!muted);
              if (muted) playSfx('tap');
            }}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Ligar som e vibração' : 'Desligar som e vibração'}
            hitSlop={8}
            style={styles.iconButton}
          >
            <Icon name={muted ? 'volume-off' : 'volume-high'} size={22} color={colors.textDim} />
          </Pressable>
        </View>

        <View style={styles.brand}>
          <Wordmark />
          <Text style={ui.dim}>Suas fotos viram cartas.</Text>
        </View>

        <View style={[styles.fan, { height: centerWidth / 0.72 + 16 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ transform: [{ rotate: '-9deg' }, { translateX: centerWidth * 0.22 }, { translateY: 14 }] }}>
            <CardView card={SHOWCASE[0]} width={sideWidth} />
          </View>
          <View style={{ zIndex: 1 }}>
            <CardView card={SHOWCASE[1]} width={centerWidth} />
          </View>
          <View style={{ transform: [{ rotate: '9deg' }, { translateX: -centerWidth * 0.22 }, { translateY: 14 }] }}>
            <CardView card={SHOWCASE[2]} width={sideWidth} />
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Jogar contra o bot" icon="robot" onPress={onPlay} />
          {onOnline && <Button label="Jogar online com um amigo" icon="account-multiple" variant="outline" onPress={onOnline} />}
          <View style={styles.tiles}>
            <Tile label="Meu baralho" icon="cards-outline" onPress={onMyDeck} />
            <Tile label="Criar carta" icon="camera" onPress={onCreateCard} />
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => setShowRules(true)} accessibilityRole="button" style={styles.footerLink}>
            <Icon name="help-circle-outline" size={18} color={colors.textDim} />
            <Text style={styles.footerText}>Como jogar</Text>
          </Pressable>
          {onAccount && (
            <Pressable onPress={onAccount} accessibilityRole="button" style={styles.footerLink}>
              <Icon name="account-circle" size={18} color={colors.textDim} />
              <Text style={styles.footerText} numberOfLines={1}>
                {accountLabel ?? 'Minha conta'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {showRules && (
        <Dialog title="Como jogar">
          <Text style={ui.dim}>
            Cada um começa com <Text style={ui.strong}>{r.playerHp} de vida</Text>. Zerou a vida do outro, venceu.
          </Text>
          <Text style={ui.dim}>
            Toque numa carta da sua mão e depois numa posição vazia do seu lado. Você tem{' '}
            <Text style={ui.strong}>{r.energyPerTurn} de energia</Text> por turno; o raio no canto da carta é o custo.
          </Text>
          <Text style={ui.dim}>
            Ao encerrar o turno, suas cartas atacam a carta da frente. Posição vazia na frente é dano direto na vida do
            adversário.
          </Text>
          <View style={styles.cycle}>
            {advantagePairs().map(([attacker, defender]) => (
              <View key={attacker} style={styles.pair}>
                <ElementDot element={attacker} />
                <Text style={styles.pairText}>vence</Text>
                <ElementDot element={defender} />
              </View>
            ))}
          </View>
          <Button label="Entendi" onPress={() => setShowRules(false)} />
        </Dialog>
      )}
    </View>
  );
}

function Tile({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        playSfx('tap');
        onPress();
      }}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
    >
      <Icon name={icon} size={26} color={colors.accent} />
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  );
}

function ElementDot({ element }: { element: Element }) {
  const info = ELEMENT_INFO[element];
  return (
    <View style={[styles.dot, { backgroundColor: info.color }]} accessibilityLabel={info.label}>
      <Icon name={info.icon} size={15} color={info.onColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: 24, paddingTop: 8, gap: 20, flexGrow: 1, width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 6 },
  fan: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start' },
  actions: { gap: 12 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    minHeight: 88,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
  },
  tileText: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 15, textAlign: 'center' },
  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, flexShrink: 1 },
  footerText: { fontFamily: fonts.bodySemi, color: colors.textDim, fontSize: 14, flexShrink: 1 },
  cycle: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  pairText: { fontFamily: fonts.bodySemi, color: colors.textDim, fontSize: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
