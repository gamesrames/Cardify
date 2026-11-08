import { describe, expect, it } from 'vitest';
import { cardWidthFor, MAX_APP_WIDTH, MIN_CARD_WIDTH, requiredHeight } from './layout';

// Regressão do bug "Encerrar turno some no navegador": numa janela larga (ex.: 1280x720)
// a carta crescia com a largura e a partida passava da altura da janela.
describe('tamanho das cartas', () => {
  const janelas: [string, number, number, number][] = [
    ['desktop 1920x900', 1920, 900, 0],
    ['desktop 1280x720', 1280, 720, 0],
    ['notebook 1366x768', 1366, 768, 0],
    ['iPhone 14 Pro Max', 430, 932, 91],
    ['Android 412x915', 412, 915, 48],
    ['celular pequeno 360x640', 360, 640, 48],
  ];

  it.each(janelas)('a partida cabe na altura da janela: %s', (_nome, w, h, insets) => {
    const largura = cardWidthFor(w, h, insets);
    expect(largura).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
    expect(requiredHeight(largura, insets)).toBeLessThanOrEqual(h);
  });

  it('em tela larga a carta não passa da coluna de no máximo 480 de largura', () => {
    expect(cardWidthFor(1920, 2000)).toBeLessThanOrEqual(MAX_APP_WIDTH / 3);
  });

  it('nunca devolve menos que o mínimo, mesmo em janela minúscula', () => {
    expect(cardWidthFor(300, 300)).toBe(MIN_CARD_WIDTH);
  });
});
