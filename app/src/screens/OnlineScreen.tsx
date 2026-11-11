import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { ui } from '../components/ui';
import { MatchError, isGame } from '../matchApi';
import type { MatchViewRow } from '../matchApi';
import { fetchOpenMatch, sendMatch } from '../matchClient';
import { colors, fonts } from '../theme';

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
    <Screen title="Jogar online" onBack={onBack}>
      <Text style={ui.dim}>
        Partida 1x1 com um amigo. Os dois precisam ter o baralho de 7 cartas salvo em "Meu baralho". Um cria a partida e passa o
        código; o outro entra com ele.
      </Text>

      {checking && <ActivityIndicator color={colors.accent} />}

      {openLabel && (
        <View style={[ui.box, styles.resume]}>
          <Text style={ui.label}>{openLabel}</Text>
          <Button label="Continuar" onPress={() => onOpenMatch(open!.match_id)} />
        </View>
      )}

      <Button label="Criar partida (gera um código)" variant={openLabel ? 'secondary' : 'primary'} disabled={busy || checking} onPress={() => run({ op: 'create' })} />

      <View style={ui.box}>
        <Text style={ui.label}>Já tem um código?</Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Código de 6 letras"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={[ui.input, styles.code]}
        />
        <Button label="Entrar com código" variant="outline" disabled={busy || checking || normalized.length !== 6} onPress={() => run({ op: 'join', code: normalized })} />
      </View>

      {error && <Text style={[ui.error, { textAlign: 'center' }]}>{error}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  resume: { borderColor: colors.accent },
  code: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 6, textAlign: 'center', paddingVertical: 14 },
});
