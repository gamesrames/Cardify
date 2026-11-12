import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCardPhoto } from '../cardPhotos';
import { DEFAULT_RULES, energyCostOf } from '../motor';
import type { CardDef } from '../motor';
import { CARD_ASPECT } from '../layout';
import { colors, ELEMENT_INFO, fonts, RARITY_INFO, withAlpha } from '../theme';
import { Icon } from './Icon';

interface Props {
  card: CardDef;
  /** Largura em pixels; a altura sai da proporção da carta (ver layout.ts). */
  width: number;
  /** Vida atual, para criaturas em campo (o dano persiste entre turnos). Sem isso, mostra a vida da carta. */
  health?: number;
  selected?: boolean;
  dimmed?: boolean;
  /** Foto da carta (cartas criadas na fase 2). Sem ela, a carta mostra o ícone do elemento como arte. */
  photoUri?: string;
  /** Esconde o custo de energia (em campo ele já foi pago e só polui). */
  hideCost?: boolean;
  /** `false` = a carta escolhida ganha a moldura de seleção mas não sobe (grades, onde subir cobriria a vizinha). */
  liftOnSelect?: boolean;
  /** Entra com um "salto" ao aparecer (carta que acabou de ser jogada ou criada). */
  appear?: boolean;
  onPress?: () => void;
}

/** Largura de referência do desenho: todas as medidas abaixo foram pensadas para uma carta de 98 px. */
const BASE_WIDTH = 98;
const NATIVE = Platform.OS !== 'web';

/**
 * Desenha uma carta. Só mostra dados; nenhuma regra mora aqui.
 * Anatomia (direção "Arena"): foto na carta inteira, escurecido na base, custo no canto esquerdo,
 * elemento no direito, nome e ataque/vida embaixo. A raridade é a cor e o brilho da moldura.
 */
export function CardView({ card, width, health, selected = false, dimmed = false, photoUri, hideCost = false, liftOnSelect = true, appear = false, onPress }: Props) {
  const element = ELEMENT_INFO[card.element];
  const rarity = RARITY_INFO[card.rarity];
  const contextPhoto = useCardPhoto(card.id); // hook sempre chamado, na mesma ordem
  const art = photoUri ?? contextPhoto;
  const currentHealth = health ?? card.health;
  const damaged = currentHealth < card.health;
  const cost = energyCostOf(card, DEFAULT_RULES);

  // Tudo escala com a largura. `px(n)` = "n pixels numa carta de 98".
  const k = width / BASE_WIDTH;
  const px = (n: number) => Math.round(n * k * 10) / 10;
  const height = width / CARD_ASPECT;
  const big = width >= 140;
  const frame = px(selected ? 2.5 : 1.5);
  const outerRadius = px(10);

  // --- Animações (Animated do React Native: valores que mudam sem renderizar o componente de novo) ---
  const lift = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(appear ? 0 : 1)).current;
  const hit = useRef(new Animated.Value(0)).current;
  const previousHealth = useRef(currentHealth);
  const [lastDamage, setLastDamage] = useState(0);

  useEffect(() => {
    Animated.spring(lift, { toValue: selected && liftOnSelect ? 1 : 0, useNativeDriver: NATIVE, speed: 22, bounciness: 8 }).start();
  }, [selected, liftOnSelect, lift]);

  useEffect(() => {
    if (appear) Animated.spring(pop, { toValue: 1, useNativeDriver: NATIVE, speed: 14, bounciness: 10 }).start();
  }, [appear, pop]);

  // A vida caiu desde a última renderização: treme, pisca em vermelho e mostra o dano subindo.
  useEffect(() => {
    const lost = previousHealth.current - currentHealth;
    previousHealth.current = currentHealth;
    if (lost <= 0) return;
    setLastDamage(lost);
    hit.setValue(0);
    Animated.timing(hit, { toValue: 1, duration: 650, useNativeDriver: NATIVE }).start();
  }, [currentHealth, hit]);

  const transform = [
    { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -px(10)] }) },
    { translateX: hit.interpolate({ inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1], outputRange: [0, -px(5), px(5), -px(4), px(3), 0, 0] }) },
    { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
  ];

  const glow = selected
    ? liftOnSelect ? `0 ${px(8)}px ${px(18)}px rgba(0, 0, 0, 0.6)` : `0 0 ${px(10)}px ${withAlpha(colors.accent, 0.5)}`
    : rarity.glow > 0
      ? `0 0 ${px(12)}px ${withAlpha(rarity.color, rarity.glow)}`
      : undefined;
  const frameStyle = selected
    ? { backgroundColor: colors.accent }
    : rarity.frame
      ? { backgroundImage: `linear-gradient(135deg, ${rarity.frame.join(', ')})` }
      : { backgroundColor: rarity.color };

  return (
    <Animated.View style={[{ width, height, opacity: pop, transform }, dimmed && styles.dimmed]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${card.name}, ${rarity.label}, ${element.label}, custo ${cost}, ataque ${card.attack}, vida ${currentHealth}`}
        style={[styles.frame, { borderRadius: outerRadius, padding: frame, boxShadow: glow }, frameStyle]}
      >
        <View style={[styles.inner, { borderRadius: outerRadius - frame }]}>
          {art ? (
            <Image source={{ uri: art }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            // Carta fixa (sem foto): o elemento vira a arte.
            <View style={[StyleSheet.absoluteFill, styles.noArt, { backgroundImage: `linear-gradient(160deg, ${withAlpha(element.color, 0.55)}, ${withAlpha(element.color, 0.12)} 70%)` }]}>
              <View style={{ marginBottom: height * 0.26 }}>
                <Icon name={element.icon} size={width * 0.46} color={withAlpha(element.color, 0.9)} />
              </View>
            </View>
          )}
          <View style={[styles.scrim, { backgroundImage: `linear-gradient(to top, ${withAlpha(colors.bg, 0.96)} 0%, ${withAlpha(colors.bg, 0.82)} 40%, ${withAlpha(colors.bg, 0)} 100%)` }]} />

          {!hideCost && (
            <View style={[styles.cost, { top: px(5), left: px(5), height: px(20), borderRadius: px(6), paddingLeft: px(3), paddingRight: px(6) }]}>
              <Icon name="lightning-bolt" size={px(11)} color={colors.onAccent} />
              <Text style={[styles.costText, { fontSize: px(11), lineHeight: px(14) }]}>{cost}</Text>
            </View>
          )}
          <View style={[styles.element, { top: px(5), right: px(5), width: px(22), height: px(22), borderRadius: px(11), backgroundColor: element.color }]}>
            <Icon name={element.icon} size={px(14)} color={element.onColor} />
          </View>

          <View style={[styles.caption, { left: px(7), right: px(7), bottom: px(6), gap: px(big ? 5 : 3) }]}>
            {big && <Text style={[styles.rarity, { color: rarity.textColor, fontSize: px(6), letterSpacing: px(0.8) }]}>{rarity.label.toUpperCase()}</Text>}
            <Text style={[styles.name, { fontSize: px(big ? 12.5 : 11), lineHeight: px(big ? 15 : 14) }]} numberOfLines={1}>
              {card.name}
            </Text>
            <View style={styles.stats}>
              <View style={[styles.stat, { gap: px(3) }]}>
                <Icon name="sword" size={px(11)} color={colors.text} />
                <Text style={[styles.statText, { fontSize: px(12), lineHeight: px(15) }]}>{card.attack}</Text>
              </View>
              <View style={[styles.stat, { gap: px(3) }]}>
                <Icon name="heart" size={px(11)} color={damaged ? colors.bad : colors.badSoft} />
                <Text style={[styles.statText, { fontSize: px(12), lineHeight: px(15), color: damaged ? colors.bad : colors.badSoft }]}>{currentHealth}</Text>
              </View>
            </View>
          </View>

          {/* Dano recebido: clarão vermelho e o número subindo. `pointerEvents: none` deixa o toque passar. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.flash, { opacity: hit.interpolate({ inputRange: [0, 0.12, 0.6, 1], outputRange: [0, 0.6, 0, 0] }) }]}
          />
          {lastDamage > 0 && (
            <Animated.Text
              style={[
                styles.damage,
                {
                  fontSize: px(22),
                  top: height * 0.3,
                  opacity: hit.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [{ translateY: hit.interpolate({ inputRange: [0, 1], outputRange: [0, -px(22)] }) }],
                },
              ]}
            >
              -{lastDamage}
            </Animated.Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  inner: { flex: 1, overflow: 'hidden', backgroundColor: colors.surface },
  dimmed: { opacity: 0.4 },
  noArt: { alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  cost: { position: 'absolute', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent },
  costText: { fontFamily: fonts.displayHeavy, color: colors.onAccent },
  element: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute' },
  rarity: { fontFamily: fonts.display },
  name: { fontFamily: fonts.bodyBold, color: colors.text },
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stat: { flexDirection: 'row', alignItems: 'center' },
  statText: { fontFamily: fonts.display, color: colors.text },
  flash: { backgroundColor: colors.bad, pointerEvents: 'none' },
  damage: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.displayHeavy,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowRadius: 6,
    pointerEvents: 'none',
  },
});
