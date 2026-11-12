// Arquivos das fontes do tema, para o `useFonts` do App.tsx. Ficam separados de index.ts porque
// `import` de .ttf só funciona no empacotador do Expo (Metro), não nos testes em Node.
// Cada peso é importado pelo seu caminho próprio: importar o pacote inteiro colocaria todos os
// pesos (18 arquivos da Inter) dentro do app.
// As chaves precisam ser iguais aos nomes em theme.fonts (arena.ts).
// Licença das duas famílias: SIL Open Font License (uso livre, inclusive comercial).
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Unbounded_700Bold } from '@expo-google-fonts/unbounded/700Bold';
import { Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded/800ExtraBold';

export const fontAssets = {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
};
