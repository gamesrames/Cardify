import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { MAX_APP_WIDTH } from '../layout';
import { MatchError, isGame } from '../matchApi';
import type { MatchViewRow } from '../matchApi';
import { fetchOpenMatch, sendMatch } from '../matchClient';
import { colors } from '../theme';

interface Props {
  onOpenMatch: (matchId: string) => void;
  onBack: () => void;
}

/** Menu do 1x1 online: criar partida (recebe um código), entrar com o código do amigo, ou retomar a partida em aberto. */
export function OnlineScreen({ onOpenMatch, onBack }: Props) {
  const [open, setOpen] = useState<MatchViewRow | null>(null);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOpenMatch()
      .then((row) => !cancelled && setOpen(row))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(request: Parameters<typeof sendMatch>[0]) {
    setBusy(true);
    setError(null);
    try {
      const res = await sendMatch(request);
      onOpenMatch(res.matchId);
    } catch (e) {
      // Já está numa partida: em vez de só avisar, leva o jogador até ela.
      if (e instanceof MatchError && e.code === 'already_in_match' && typeof e.extra.matchId === 'string') {
        onOpenMatch(e.extra.matchId);
        return;
      }
      setError(e instanceof Error ? e.message : 'Algo deu errado.');
    } finally {
      setBusy(false);
    }
  }

  const normalized = code.trim().toUpperCase();
  const openGame = open && isGame(open.view) ? open.view : null;
  const openLabel =
    open?.status === 'waiting' && open.view.kind === 'waiting'
      ? `Você tem um convite esperando (código ${open.view.code}).`
      : openGame
        ? `Você tem uma partida em andamento contra ${openGame.foeName ?? 'um adversário'}.`
        : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Jogar online</Text>
      <Text style={styles.dim}>
        Partida 1x1 com um amigo. Os dois precisam ter o baralho de 7 cartas salvo em "Meu baralho". Um cria a partida e passa o
        código; o outro entra com ele.
      </Text>

      {checking && <ActivityIndicator color={colors.accent} />}

      {openLabel && (
        <View style={styles.box}>
          <Text style={styles.boxText}>{openLabel}</Text>
          <Button label="Continuar" onPress={() => onOpenMatch(open!.match_id)} />
        </View>
      )}

      <Button label="Criar partida (gera um código)" disabled={busy || checking} onPress={() => run({ op: 'create' })} />

      <View style={styles.box}>
        <Text style={styles.boxText}>Já tem um código?</Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
          placeholder="Código de 6 letras"
          placeholderTextColor={colors.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={styles.input}
        />
        <Button label="Entrar com código" disabled={busy || checking || normalized.length !== 6} onPress={() => run({ op: 'join', code: normalized })} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Voltar" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center', maxWidth: MAX_APP_WIDTH, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 32, fontWeight: '900', textAlign: 'center' },
  dim: { color: colors.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  box: { backgroundColor: colors.panel, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border },
  boxText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: {
    color: colors.text,
    backgroundColor: colors.panelAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
  },
  error: { color: colors.bad, fontSize: 14, textAlign: 'center' },
});
