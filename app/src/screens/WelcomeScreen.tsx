import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { signIn } from '../auth';
import { Button } from '../components/Button';
import { CredentialsForm } from '../components/CredentialsForm';
import { ui } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.column}>
        <View style={styles.brand}>
          <Wordmark />
          <Text style={ui.dim}>Suas fotos viram cartas.</Text>
        </View>
        {mode === 'choice' ? (
          <>
            <Text style={ui.dim}>
              Entre na sua conta para ter suas cartas e seu baralho em qualquer aparelho, ou comece como convidado e
              crie a conta depois (as cartas que você fizer vão junto).
            </Text>
            <Button label="Começar como convidado" disabled={busy} onPress={() => void playAsGuest()} />
            <Button label="Já tenho conta" variant="secondary" onPress={() => setMode('signin')} />
            {busy && <ActivityIndicator color={colors.accent} />}
            {error && <Text style={ui.error}>{error}</Text>}
          </>
        ) : (
          <>
            <Text style={ui.dim}>Entre com o apelido e a senha da sua conta.</Text>
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
  brand: { alignItems: 'center', gap: 6, marginBottom: 12 },
});
