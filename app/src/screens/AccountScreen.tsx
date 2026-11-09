import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { changePassword, createAccount, signOut } from '../auth';
import { emailToHandle } from '../authText';
import { Button } from '../components/Button';
import { CredentialsForm } from '../components/CredentialsForm';
import { MAX_APP_WIDTH } from '../layout';
import { fetchDisplayName, saveDisplayName } from '../supabase';
import { colors } from '../theme';
import type { AuthUser } from '../useAuth';

interface Props {
  user: AuthUser;
  onBack: () => void;
}

export function AccountScreen({ user, onBack }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.column}>
        <Text style={styles.title}>Minha conta</Text>
        {user.isAnonymous ? <GuestSection /> : <AccountSection user={user} />}
        <Button label="Voltar" variant="secondary" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

/** Convidado: apelido + senha viram conta mantendo o mesmo jogador (cartas e baralho ficam). */
function GuestSection() {
  const [leaving, setLeaving] = useState(false);

  return (
    <>
      <Text style={styles.text}>
        Você está como <Text style={styles.bold}>convidado</Text>. Suas cartas ficam só neste aparelho: se desinstalar o
        app, elas se perdem. Crie uma conta para guardá-las e entrar de qualquer aparelho.
      </Text>
      <Text style={styles.warn}>
        Atenção: não existe recuperação de senha e o apelido é de quem pegar primeiro. Anote a senha.
      </Text>
      <CredentialsForm
        submitLabel="Criar conta"
        repeatPassword
        onSubmit={createAccount}
        // useAuth percebe a conta nova e a tela passa a mostrar a seção "conta".
        onDone={() => undefined}
      />
      <View style={styles.divider} />
      {leaving ? (
        <View style={styles.box}>
          <Text style={styles.warn}>
            Ao entrar numa conta que já existe, você deixa este convidado para trás: as cartas dele não vão para a
            outra conta. Se precisar delas, crie a conta aqui primeiro.
          </Text>
          <Button label="Entrar em outra conta mesmo assim" onPress={() => void signOut()} />
          <Button label="Cancelar" variant="secondary" onPress={() => setLeaving(false)} />
        </View>
      ) : (
        <Button label="Já tenho conta em outro aparelho" variant="secondary" onPress={() => setLeaving(true)} />
      )}
    </>
  );
}

function AccountSection({ user }: { user: AuthUser }) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let active = true;
    fetchDisplayName()
      .then((n) => {
        if (!active) return;
        setName(n ?? '');
        setSaved(n);
      })
      .catch(() => undefined); // sem rede: o campo fica vazio e o salvar avisa
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setMessage(null);
    try {
      await saveDisplayName(name);
      setSaved(name.trim());
      setMessage({ ok: true, text: 'Nome salvo.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Não consegui salvar o nome.' });
    }
  }

  const changed = name.trim() !== (saved ?? '');
  return (
    <>
      <Text style={styles.text}>
        Conta <Text style={styles.bold}>{emailToHandle(user.email) ?? user.email}</Text>. Suas cartas e o seu baralho
        ficam guardados nela: em outro aparelho, toque em "Já tenho conta" e entre com esse apelido e a senha.
      </Text>
      <View style={styles.box}>
        <Text style={styles.label}>Nome de jogador (2 a 20 letras)</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={20}
          placeholder="Como você quer aparecer"
          placeholderTextColor={colors.textDim}
        />
        <Button label="Salvar nome" disabled={!changed || name.trim().length < 2} onPress={() => void save()} />
        {message && <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text>}
      </View>
      <View style={styles.divider} />
      {changingPassword ? (
        <View style={styles.box}>
          <CredentialsForm passwordOnly submitLabel="Trocar senha" onSubmit={(_handle, password) => changePassword(password)} onDone={() => setChangingPassword(false)} />
          <Button label="Cancelar" variant="secondary" onPress={() => setChangingPassword(false)} />
        </View>
      ) : (
        <Button label="Trocar senha" variant="secondary" onPress={() => setChangingPassword(true)} />
      )}
      <Button label="Sair da conta" variant="secondary" onPress={() => void signOut()} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  column: { width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center', gap: 16 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  text: { color: colors.textDim, fontSize: 15, lineHeight: 22 },
  bold: { color: colors.text, fontWeight: '800' },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  box: { gap: 12 },
  divider: { height: 1, backgroundColor: colors.border },
  input: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  warn: { color: colors.warn, fontSize: 14, lineHeight: 20 },
  ok: { color: colors.good, fontSize: 14 },
  error: { color: colors.bad, fontSize: 14, lineHeight: 20 },
});
