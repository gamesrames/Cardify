import { createContext, useContext } from 'react';

// Mapa "id da carta → endereço da foto". Quem monta uma tela com cartas de foto
// envolve a árvore em <CardPhotosProvider>, e o CardView procura a foto sozinho pelo id.
// Assim a tela de partida não precisa saber de fotos (comparando com C#: é um serviço
// injetado por contexto em vez de um parâmetro passado por todo construtor).
const CardPhotosContext = createContext<Record<string, string>>({});

export const CardPhotosProvider = CardPhotosContext.Provider;

export function useCardPhoto(cardId: string): string | undefined {
  return useContext(CardPhotosContext)[cardId];
}
