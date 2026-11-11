import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthFlowError } from '../auth';
import { isValidHandle, isValidPassword, normalizeHandle } from '../authText';
import { colors } from '../theme';
import { Button } from './Button';
import { ui } from './ui';

interface Props {
  submitLabel: string;
  /** Recebe o apelido já normalizado. Lança `AuthFlowError` (mensagem em português) se não der certo. */
  onSubmit: (handle: string, password: string) => Promise<void>;
  /** Pedir a senha duas vezes (criar conta: não há recuperação, então errar a digitação sai caro). */
  repeatPassword?: boolean;
  /** Pede só a senha (trocar senha). */
  passwordOnly?: boolean;
  /** Chamado depois que o servidor aceitou. */
  onDone: () => void;
}

/** Apelido + senha na mesma tela, com botão de mostrar a senha. */
export function CredentialsForm({ submitLabel, onSubmit, repeatPassword = false, passwordOnly = false, onDone }: Props) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = repeatPassword && repeat.length > 0 && repeat !== password;
  const ready =
    (passwordOnly || isValidHandle(handle)) && isValidPassword(password) && (!repeatPassword || repeat === password);

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(normalizeHandle(handle), password);
      onDone();
    } catch (e) {
      setError(e instanceof AuthFlowError ? e.message : 'Não deu certo. Tente de novo em instantes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.box}>
      {!passwordOnly && (
        <>
          <Text style={ui.label}>Apelido</Text>
          <TextInput
            style={ui.input}
            value={handle}
            onChangeText={setHandle}
            placeholder="ex.: rames_01"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            editable={!busy}
          />
          <Text style={ui.small}>3 a 20 caracteres: letras sem acento, números e "_".</Text>
        </>
      )}
      <Text style={ui.label}>{passwordOnly ? 'Nova senha' : 'Senha'}</Text>
      <TextInput
        style={ui.input}
        value={password}
        onChangeText={setPassword}
        placeholder="mínimo 6 caracteres"
        placeholderTextColor={colors.textDim}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={72}
        editable={!busy}
        onSubmitEditing={() => void submit()}
      />
      {repeatPassword && (
        <TextInput
          style={ui.input}
          value={repeat}
          onChangeText={setRepeat}
          placeholder="repita a senha"
          placeholderTextColor={colors.textDim}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={72}
          editable={!busy}
          onSubmitEditing={() => void submit()}
        />
      )}
      <Pressable onPress={() => setShow((v) => !v)} accessibilityRole="button" hitSlop={10}>
        <Text style={ui.link}>{show ? 'Esconder a senha' : 'Mostrar a senha'}</Text>
      </Pressable>
      {mismatch && <Text style={ui.error}>As senhas não são iguais.</Text>}
      <Button label={submitLabel} disabled={busy || !ready} onPress={() => void submit()} />
      {busy && <ActivityIndicator color={colors.accent} />}
      {error && <Text style={ui.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12 },
});
