import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { MAX_APP_WIDTH } from '../layout';
import { colors, fonts, radius } from '../theme';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface Props {
  title: string;
  /** Ícone grande acima do título (troféu, bandeira...). */
  icon?: IconName;
  /** Cor do ícone: resultado bom, ruim ou neutro. */
  tone?: 'good' | 'bad' | 'neutral';
  /** Texto e botões da janela. */
  children: ReactNode;
}

const NATIVE = Platform.OS !== 'web';

/**
 * Janela por cima da tela (resultado da partida, confirmações). Feita na própria tela porque o
 * `Alert.alert` do React Native não existe no navegador. Entra com um leve "salto".
 */
export function Dialog({ title, icon, tone = 'neutral', children }: Props) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(shown, { toValue: 1, useNativeDriver: NATIVE, speed: 16, bounciness: 6 }).start();
  }, [shown]);
  const iconColor = tone === 'good' ? colors.accent : tone === 'bad' ? colors.badSoft : colors.textDim;

  return (
    <Animated.View style={[styles.overlay, { opacity: shown }]} accessibilityViewIsModal>
      <Animated.View style={[styles.box, { transform: [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
        {icon && (
          <View style={styles.icon}>
            <Icon name={icon} size={44} color={iconColor} />
          </View>
        )}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: MAX_APP_WIDTH - 48,
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  icon: { alignItems: 'center' },
  title: { fontFamily: fonts.displayHeavy, color: colors.text, fontSize: 22, lineHeight: 30, textAlign: 'center' },
});
