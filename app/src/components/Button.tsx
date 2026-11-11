import { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { playSfx } from '../sfx';
import { colors, fonts, radius } from '../theme';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /**
   * primary: a ação principal da tela (uma por tela). outline: segunda ação importante.
   * secondary: ações comuns. danger: ação destrutiva (desistir). ghost: ação discreta.
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  icon?: IconName;
  /** `md` é mais baixo, para barras com vários botões. */
  size?: 'lg' | 'md';
}

// Animações em transform/opacity rodam fora da thread de JavaScript no celular; no navegador não existe esse modo.
const NATIVE = Platform.OS !== 'web';

export function Button({ label, onPress, disabled = false, variant = 'primary', icon, size = 'lg' }: Props) {
  // useRef guarda o valor animado entre renderizações (como um campo privado da "instância" do componente).
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: NATIVE, speed: 40, bounciness: 0 }).start();
  const fg =
    variant === 'primary' ? colors.onAccent
    : variant === 'outline' ? colors.accent
    : variant === 'danger' ? colors.bad
    : variant === 'ghost' ? colors.textDim
    : colors.text;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={() => {
          playSfx('tap');
          onPress();
        }}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        disabled={disabled}
        style={[styles.base, size === 'md' && styles.md, styles[variant]]}
      >
        {icon && <Icon name={icon} size={size === 'md' ? 18 : 20} color={fg} />}
        <Text style={[variant === 'primary' || variant === 'outline' ? styles.labelDisplay : styles.label, { color: fg }]} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  md: { minHeight: 48, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md },
  primary: { backgroundColor: colors.accent },
  outline: { borderColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  danger: { backgroundColor: colors.surface, borderColor: colors.bad },
  ghost: { borderColor: colors.line },
  disabled: { opacity: 0.4 },
  labelDisplay: { fontFamily: fonts.display, fontSize: 14.5, textAlign: 'center', flexShrink: 1 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15.5, textAlign: 'center', flexShrink: 1 },
});
