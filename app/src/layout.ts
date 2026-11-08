// Tamanho das cartas. O tamanho vem da JANELA, não só da largura: antes a carta tinha
// altura proporcional à largura, e numa janela larga (navegador no PC) ela ficava enorme e
// empurrava o botão "Encerrar turno" para fora da tela, sem como rolar até ele.
// Funções puras para poderem ser testadas sem celular nem navegador (ver layout.test.ts).

/** Largura / altura de uma carta. */
export const CARD_ASPECT = 0.72;
/** Linhas de cartas empilhadas na partida: campo do bot, meu campo e minha mão. */
export const CARD_ROWS = 3;
/** Largura máxima da área de jogo; em tela larga o jogo fica centralizado, como num celular. */
export const MAX_APP_WIDTH = 480;
/** Margem lateral e espaço entre cartas. */
export const SIDE_PADDING = 12;
export const CARD_GAP = 8;
/**
 * Altura de tudo que NÃO é carta: barras dos jogadores, barra de status, botão, log (mínimo)
 * e as margens. Se mudar o layout da GameScreen, confira este valor (o teste e o script
 * de navegador descritos em docs/app.md acusam se estiver curto demais).
 */
export const NON_CARD_HEIGHT = 340;
/** Abaixo disso a carta fica ilegível; prefere-se ficar justo a ficar minúsculo. */
export const MIN_CARD_WIDTH = 56;

/** Maior largura de carta que cabe na janela (sem estourar nem a largura nem a altura). */
export function cardWidthFor(windowWidth: number, windowHeight: number, verticalInsets = 0): number {
  const usableWidth = Math.min(windowWidth, MAX_APP_WIDTH) - 2 * SIDE_PADDING - 2 * CARD_GAP;
  const byWidth = usableWidth / 3;
  const cardHeight = (windowHeight - verticalInsets - NON_CARD_HEIGHT) / CARD_ROWS;
  const byHeight = cardHeight * CARD_ASPECT;
  return Math.max(MIN_CARD_WIDTH, Math.floor(Math.min(byWidth, byHeight)));
}

/** Altura total que a partida ocupa para uma dada largura de carta. */
export function requiredHeight(cardWidth: number, verticalInsets = 0): number {
  return CARD_ROWS * (cardWidth / CARD_ASPECT) + NON_CARD_HEIGHT + verticalInsets;
}
