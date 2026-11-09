import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthFlowError } from '../auth';
import { cleanCode, isValidCode, isValidEmail, normalizeEmail } from '../authText';
import { colors } from '../theme';
import { Button } from './Button';

interface Props {
  /** Texto do botão da primeira etapa. */
  sendLabel: string;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  /** Chamado depois que o código foi aceito. */
  onDone: () => void;
}

/** Duas etapas na mesma tela: digitar o e-mail, depois digitar o código que chegou nele. */
export function EmailCodeForm({ sendLabel, sendCode, verifyCode, onDone }: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof AuthFlowError ? e.message : 'Não deu certo. Tente de novo em instantes.');
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      const normalized = normalizeEmail(email);
      await sendCode(normalized);
      setSentTo(normalized);
      setCode('');
    });

  const confirm = () =>
    run(async () => {
      await verifyCode(sentTo as string, cleanCode(code));
      onDone();
    });

  return (
    <View style={styles.box}>
      {sentTo === null ? (
        <>
          <Text style={styles.label}>Seu e-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="voce@exemplo.com"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            editable={!busy}
            onSubmitEditing={() => isValidEmail(email) && !busy && void send()}
          />
          <Button label={sendLabel} disabled={busy || !isValidEmail(email)} onPress={() => void send()} />
        </>
      ) : (
        <>
          <Text style={styles.label}>Código enviado para {sentTo}</Text>
          <Text style={styles.hint}>Abra o e-mail, copie o código de {'6'} dígitos e digite aqui. Olhe o spam se não chegar.</Text>
          <TextInput
            style={[styles.input, styles.code]}
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={12}
            editable={!busy}
            onSubmitEditing={() => isValidCode(cleanCode(code)) && !busy && void confirm()}
          />
          <Button label="Confirmar código" disabled={busy || !isValidCode(cleanCode(code))} onPress={() => void confirm()} />
          <Button label="Usar outro e-mail" variant="secondary" disabled={busy} onPress={() => setSentTo(null)} />
        </>
      )}
      {busy && <ActivityIndicator color={colors.accent} />}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
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
  code: { textAlign: 'center', letterSpacing: 6, fontSize: 22 },
  error: { color: colors.bad, fontSize: 14, lineHeight: 20 },
});
