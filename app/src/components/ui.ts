import { StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

// Estilos de texto e de caixas repetidos em várias telas. Tela nova? Use estes antes de criar
// um estilo próprio, para o app inteiro ficar com a mesma cara.
export const ui = StyleSheet.create({
  /** Título grande no meio da tela (boas-vindas, estados de espera). */
  hero: { fontFamily: fonts.displayHeavy, color: colors.text, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  /** Título de seção dentro de uma tela. */
  section: { fontFamily: fonts.display, color: colors.text, fontSize: 14, lineHeight: 20 },
  /** Rótulo pequeno em maiúsculas (cabeçalho de grupo, "TURNO 4"). */
  overline: { fontFamily: fonts.display, color: colors.textDim, fontSize: 10.5, letterSpacing: 1.2 },
  body: { fontFamily: fonts.body, color: colors.text, fontSize: 15, lineHeight: 22 },
  dim: { fontFamily: fonts.body, color: colors.textDim, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.body, color: colors.textDim, fontSize: 13, lineHeight: 19 },
  strong: { fontFamily: fonts.bodyBold, color: colors.text },
  label: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 15 },
  link: { fontFamily: fonts.bodyBold, color: colors.accent, fontSize: 14 },
  ok: { fontFamily: fonts.bodySemi, color: colors.good, fontSize: 14, lineHeight: 20 },
  warn: { fontFamily: fonts.bodySemi, color: colors.warn, fontSize: 14, lineHeight: 20 },
  error: { fontFamily: fonts.bodySemi, color: colors.badSoft, fontSize: 14, lineHeight: 20 },
  /** Caixa com borda (painel). */
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  input: {
    fontFamily: fonts.bodySemi,
    backgroundColor: colors.raised,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  divider: { height: 1, backgroundColor: colors.line },
});
