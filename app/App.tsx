import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PREBUILT_DECKS } from './src/motor';
import { DeckPickScreen } from './src/screens/DeckPickScreen';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/theme';

// Navegação mínima: um estado diz qual tela mostrar. Para 3 telas, uma biblioteca de
// navegação seria peso à toa; reavaliar quando houver coleção, câmera, etc. (fase 2).
type Screen =
  | { name: 'home' }
  | { name: 'decks' }
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

  function startGame(playerDeck: string) {
    setScreen({ name: 'game', playerDeck, botDeck: pickBotDeck(playerDeck), seed: newSeed() });
  }

  return (
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
        ) : (
          <SafeAreaView style={styles.root}>
            {screen.name === 'home' ? (
              <HomeScreen onPlay={() => setScreen({ name: 'decks' })} />
            ) : (
              <DeckPickScreen onStart={startGame} onBack={() => setScreen({ name: 'home' })} />
            )}
          </SafeAreaView>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
