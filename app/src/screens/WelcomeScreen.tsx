import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { signIn } from '../auth';
import { Button } from '../components/Button';
import { CredentialsForm } from '../components/CredentialsForm';
import { MAX_APP_WIDTH } from '../layout';
import { startGuestSession } from '../supabase';
import { colors } from '../theme';

/**
 * Primeira tela de quem não tem sessão (app novo, outro aparelho, depois de sair).
 * Quando o login der certo, `useAuth` percebe a sessão nova e o App troca de tela sozinho.
 */
export function WelcomeScreen() {
  const [mode, setMode] = useState<'choice' | 'signin'>('choice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function playAsGuest() {
    setBusy(true);
    setError(null);
    try {
      await startGuestSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui entrar como convidado.');
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.column}>
        <Text style={styles.title}>Cardify</Text>
        {mode === 'choice' ? (
          <>
            <Text style={styles.text}>
              Entre na sua conta para ter suas cartas e seu baralho em qualquer aparelho, ou comece como convidado e
              crie a conta depois (as cartas que você fizer vão junto).
            </Text>
            <Button label="Já tenho conta" onPress={() => setMode('signin')} />
            <Button label="Começar como convidado" variant="secondary" disabled={busy} onPress={() => void playAsGuest()} />
            {busy && <ActivityIndicator color={colors.accent} />}
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        ) : (
          <>
            <Text style={styles.text}>Entre com o apelido e a senha da sua conta.</Text>
            {/* Quando o login der certo, useAuth percebe a sessão e o App troca de tela sozinho. */}
            <CredentialsForm submitLabel="Entrar" onSubmit={async (handle, password) => void (await signIn(handle, password))} onDone={() => undefined} />
            <Button label="Voltar" variant="secondary" onPress={() => setMode('choice')} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  column: { width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center', gap: 16 },
  title: { color: colors.text, fontSize: 44, fontWeight: '900', textAlign: 'center' },
  text: { color: colors.textDim, fontSize: 15, lineHeight: 22 },
  error: { color: colors.bad, fontSize: 14, lineHeight: 20 },
});
