import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { CreateCardError, requestCard, toCardDef } from '../cardApi';
import type { CreatedCard } from '../cardApi';
import { preparePhoto } from '../photo';
import type { PreparedPhoto } from '../photo';
import {
  ensureSession,
  isSupabaseConfigured,
  listCategories,
  manualCategory,
  supabaseKey,
  supabaseUrl,
} from '../supabase';
import type { CategoryOption } from '../supabase';
import { colors, ELEMENT_INFO } from '../theme';
import type { Element } from '../motor';

interface Props {
  onBack: () => void;
}

// Estados da tela, um de cada vez (como um enum em C#):
type Step =
  | { kind: 'idle' }
  | { kind: 'camera' }
  | { kind: 'category'; photo: PreparedPhoto }
  | { kind: 'sending'; photo: PreparedPhoto }
  | { kind: 'done'; photo: PreparedPhoto; card: CreatedCard }
  | { kind: 'error'; photo: PreparedPhoto | null; category?: string; message: string; code: string };

export function CreateCardScreen({ onBack }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  // A lista de categorias só é necessária com o classificador manual.
  useEffect(() => {
    if (!isSupabaseConfigured || !manualCategory) return;
    listCategories()
      .then(setCategories)
      .catch((e: Error) => setStep({ kind: 'error', photo: null, message: e.message, code: 'categories' }));
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <Layout onBack={onBack} title="Criar carta">
        <Text style={styles.text}>
          O app ainda não sabe onde fica o servidor. Copie <Text style={styles.bold}>app/.env.example</Text> para{' '}
          <Text style={styles.bold}>app/.env.local</Text>, preencha a URL e a chave pública do Supabase e reinicie com{' '}
          <Text style={styles.bold}>npx expo start -c</Text>.
        </Text>
      </Layout>
    );
  }

  async function send(photo: PreparedPhoto, category?: string) {
    setStep({ kind: 'sending', photo });
    try {
      const session = await ensureSession();
      const card = await requestCard({
        baseUrl: supabaseUrl,
        apiKey: supabaseKey,
        accessToken: session.access_token,
        photoBase64: photo.base64,
        category,
      });
      setStep({ kind: 'done', photo, card });
    } catch (e) {
      const code = e instanceof CreateCardError ? e.code : 'unknown';
      setStep({ kind: 'error', photo, category, code, message: e instanceof Error ? e.message : 'Algo deu errado.' });
    }
  }

  function afterPhoto(photo: PreparedPhoto) {
    if (manualCategory) setStep({ kind: 'category', photo });
    else void send(photo);
  }

  async function takePicture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      // exif: false já não pede os metadados; preparePhoto regrava o JPEG por garantia.
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.8, exif: false });
      afterPhoto(await preparePhoto(picture.uri, picture.width));
    } catch {
      setStep({ kind: 'error', photo: null, code: 'camera', message: 'Não consegui tirar a foto. Tente de novo.' });
    } finally {
      setCapturing(false);
    }
  }

  // Só no navegador (para testar no computador sem câmera): escolhe um arquivo.
  async function pickFileForWebTest() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    afterPhoto(await preparePhoto(asset.uri, asset.width));
  }

  async function openCamera() {
    if (!permission?.granted) {
      const answer = await requestPermission();
      if (!answer.granted) return;
    }
    setStep({ kind: 'camera' });
  }

  if (step.kind === 'camera') {
    return (
      <View style={styles.cameraRoot}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraBar}>
          <Button label="Cancelar" variant="secondary" onPress={() => setStep({ kind: 'idle' })} />
          <Pressable
            accessibilityLabel="Tirar foto"
            onPress={takePicture}
            disabled={capturing}
            style={[styles.shutter, capturing && { opacity: 0.4 }]}
          />
        </View>
      </View>
    );
  }

  return (
    <Layout onBack={onBack} title="Criar carta">
      {step.kind === 'idle' && (
        <>
          <Text style={styles.text}>
            Tire uma foto de algo real (um bicho, uma planta, um objeto). O servidor sorteia a raridade e os atributos, e
            a foto vira a sua carta. Fotos quase iguais a uma já usada são recusadas.
          </Text>
          <Button label="Abrir a câmera" onPress={openCamera} />
          {permission && !permission.granted && !permission.canAskAgain && (
            <Text style={styles.warn}>A câmera está bloqueada. Libere nas configurações do celular para este app.</Text>
          )}
          {Platform.OS === 'web' && <Button label="Escolher arquivo (só teste no computador)" variant="secondary" onPress={pickFileForWebTest} />}
        </>
      )}

      {step.kind === 'category' && (
        <>
          <Image source={{ uri: step.photo.uri }} style={styles.photo} />
          <Text style={styles.subtitle}>O que tem na foto?</Text>
          <View style={styles.chips}>
            {categories.map((c) => (
              <Pressable key={c.slug} style={styles.chip} onPress={() => void send(step.photo, c.slug)}>
                <Text style={styles.chipText}>
                  {ELEMENT_INFO[c.element as Element]?.emoji ?? ''} {c.nome}
                </Text>
              </Pressable>
            ))}
          </View>
          {categories.length === 0 && <ActivityIndicator color={colors.accent} />}
          <Button label="Cancelar" variant="secondary" onPress={() => setStep({ kind: 'idle' })} />
        </>
      )}

      {step.kind === 'sending' && (
        <>
          <Image source={{ uri: step.photo.uri }} style={styles.photo} />
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.text}>Criando a carta...</Text>
        </>
      )}

      {step.kind === 'done' && (
        <>
          <Image source={{ uri: step.photo.uri }} style={styles.photo} />
          <View style={styles.cardBox}>
            <CardView card={toCardDef(step.card)} />
          </View>
          {step.card.bonusPoints > 0 && (
            <Text style={styles.good}>Bônus da categoria: +{step.card.bonusPoints} de poder</Text>
          )}
          <Button label="Criar outra carta" onPress={() => setStep({ kind: 'idle' })} />
        </>
      )}

      {step.kind === 'error' && (
        <>
          <Text style={styles.bad}>{step.message}</Text>
          {step.photo && ['network', 'classifier_unavailable', 'internal', 'unexpected', 'unknown'].includes(step.code) && (
            <Button label="Tentar de novo" onPress={() => void send(step.photo as PreparedPhoto, step.category)} />
          )}
          <Button label="Voltar" variant="secondary" onPress={() => setStep({ kind: 'idle' })} />
        </>
      )}
    </Layout>
  );
}

function Layout({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
      <Button label="Menu" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  text: { color: colors.textDim, fontSize: 15, lineHeight: 22 },
  bold: { color: colors.text, fontWeight: '700' },
  warn: { color: colors.warn, fontSize: 14 },
  bad: { color: colors.bad, fontSize: 16, textAlign: 'center' },
  good: { color: colors.good, fontSize: 15, textAlign: 'center' },
  photo: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.panel },
  cardBox: { width: 160, alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { backgroundColor: colors.panelAlt, borderColor: colors.border, borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { color: colors.text, fontSize: 15 },
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  cameraBar: { position: 'absolute', bottom: 32, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.35)' },
});
