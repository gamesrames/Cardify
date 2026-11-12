import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MAX_APP_WIDTH } from '../layout';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';

interface Props {
  title: string;
  /** Com `onBack`, aparece a seta de voltar no cabeçalho. */
  onBack?: () => void;
  children: ReactNode;
  /** Barra fixa no rodapé (contadores, botões de ação). */
  footer?: ReactNode;
  /** Centraliza o conteúdo na vertical (telas curtas). */
  centered?: boolean;
}

/**
 * Moldura padrão das telas que não são a partida: cabeçalho com voltar + título, conteúdo com rolagem
 * e rodapé opcional. Em tela larga (navegador) tudo fica numa coluna central, como num celular.
 * A área segura (entalhe do iPhone, barra do Android) é tratada pelo SafeAreaView do App.tsx.
 */
export function Screen({ title, onBack, children, footer, centered = false }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8} style={styles.back}>
            <Icon name="chevron-left" size={28} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, centered && styles.centered]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 56 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 17, color: colors.text },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 8, gap: 16, flexGrow: 1 },
  centered: { justifyContent: 'center' },
  footer: { padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
});
