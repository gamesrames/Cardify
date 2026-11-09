import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PREBUILT_DECKS } from './src/motor';
import type { CardDef } from './src/motor';
import { CardPhotosProvider } from './src/cardPhotos';
import { CUSTOM_DECK_NAME, setCustomDeck } from './src/customDeck';
import { emailToHandle } from './src/authText';
import { useAuth } from './src/useAuth';
import { AccountScreen } from './src/screens/AccountScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { MyDeckScreen } from './src/screens/MyDeckScreen';
import { CreateCardScreen } from './src/screens/CreateCardScreen';
import { DeckPickScreen } from './src/screens/DeckPickScreen';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/theme';

// Navegação mínima: um estado diz qual tela mostrar. Para 3 telas, uma biblioteca de
// navegação seria peso à toa; reavaliar quando houver coleção, câmera, etc. (fase 2).
type Screen =
  | { name: 'home' }
  | { name: 'decks' }
  | { name: 'create' }
  | { name: 'mydeck' }
  | { name: 'account' }
  | { name: 'game'; playerDeck: string; botDeck: string; seed: number };

/** A semente é sorteada AQUI (camada de tela). O motor em si nunca usa Math.random. */
function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** O bot joga com um baralho pronto diferente do escolhido pelo jogador. */
function pickBotDeck(playerDeck: string): string {
  const others = Object.keys(PREBUILT_DECKS).filter((name) => name !== playerDeck);
  return others[Math.floor(Math.random() * others.length)] ?? playerDeck;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  // Fotos das cartas do jogador (id da carta → endereço), lidas pelo CardView via contexto.
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const auth = useAuth();
  const userId = auth.status === 'in' ? auth.user.id : null;

  // Trocou de jogador (saiu, entrou em outra conta): volta ao menu e esquece as fotos do anterior.
  useEffect(() => {
    setPhotos({});
    setScreen({ name: 'home' });
  }, [userId]);

  function startGame(playerDeck: string) {
    setScreen({ name: 'game', playerDeck, botDeck: pickBotDeck(playerDeck), seed: newSeed() });
  }

  function playMyDeck(deck: CardDef[], deckPhotos: Record<string, string>) {
    setCustomDeck(deck);
    setPhotos(deckPhotos);
    startGame(CUSTOM_DECK_NAME);
  }

  // Sem sessão: boas-vindas (entrar ou começar como convidado). Sem servidor configurado (modo offline da
  // fase 1), `status` é 'off' e o app abre direto no menu.
  if (auth.status === 'loading' || auth.status === 'out') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SafeAreaView style={styles.root}>
          {auth.status === 'loading' ? <ActivityIndicator style={styles.loading} color={colors.accent} /> : <WelcomeScreen />}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  const user = auth.status === 'in' ? auth.user : null;

  return (
    <CardPhotosProvider value={photos}>
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {screen.name === 'game' ? (
          // key diferente = tela nova do zero (é assim que a revanche reinicia a partida).
          <GameScreen
            key={screen.seed}
            playerDeckName={screen.playerDeck}
            botDeckName={screen.botDeck}
            seed={screen.seed}
            onRematch={() => setScreen({ ...screen, seed: newSeed() })}
            onChangeDeck={() => setScreen({ name: 'decks' })}
            onMenu={() => setScreen({ name: 'home' })}
          />
        ) : screen.name === 'mydeck' ? (
          <SafeAreaView style={styles.root}>
            <MyDeckScreen userId={user?.id ?? null} isGuest={user?.isAnonymous ?? false} onPlay={playMyDeck} onBack={() => setScreen({ name: 'home' })} />
          </SafeAreaView>
        ) : screen.name === 'account' && user ? (
          <SafeAreaView style={styles.root}>
            <AccountScreen user={user} onBack={() => setScreen({ name: 'home' })} />
          </SafeAreaView>
        ) : screen.name === 'create' ? (
          // Tela cheia (a câmera ocupa tudo); o Layout interno cuida do resto.
          <SafeAreaView style={styles.root}>
            <CreateCardScreen onBack={() => setScreen({ name: 'home' })} />
          </SafeAreaView>
        ) : (
          <SafeAreaView style={styles.root}>
            {screen.name === 'home' ? (
              <HomeScreen
                onPlay={() => setScreen({ name: 'decks' })}
                onCreateCard={() => setScreen({ name: 'create' })}
                onMyDeck={() => setScreen({ name: 'mydeck' })}
                onAccount={user ? () => setScreen({ name: 'account' }) : undefined}
                accountLabel={user ? (user.isAnonymous ? 'Convidado · criar conta' : `Conta: ${emailToHandle(user.email) ?? user.email ?? 'minha conta'}`) : undefined}
              />
            ) : (
              <DeckPickScreen onStart={startGame} onBack={() => setScreen({ name: 'home' })} />
            )}
          </SafeAreaView>
        )}
      </View>
    </SafeAreaProvider>
    </CardPhotosProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1 },
});
