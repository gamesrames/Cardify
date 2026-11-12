import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { ui } from '../components/ui';
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
import { haptic, playSfx } from '../sfx';
import { colors, ELEMENT_INFO, fonts, radius } from '../theme';
import type { Element } from '../motor';

/** Largura da carta no resultado (a altura sai da proporção em layout.ts). */
const CARD_WIDTH = 210;

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

  // Carta pronta: som e vibração de "revelação" (uma vez por carta).
  const createdId = step.kind === 'done' ? step.card.id : null;
  useEffect(() => {
    if (!createdId) return;
    playSfx('reveal');
    haptic('success');
  }, [createdId]);

  if (!isSupabaseConfigured) {
    return (
      <Layout onBack={onBack} title="Criar carta">
        <Text style={ui.dim}>
          O app ainda não sabe onde fica o servidor. Copie <Text style={ui.strong}>app/.env.example</Text> para{' '}
          <Text style={ui.strong}>app/.env.local</Text>, preencha a URL e a chave pública do Supabase e reinicie com{' '}
          <Text style={ui.strong}>npx expo start -c</Text>.
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
        {/* Guia no formato da carta: o que fica dentro é o que aparece nela. Não bloqueia o toque. */}
        <View style={styles.guideLayer}>
          <View style={styles.guide} />
          <Text style={styles.guideText}>Enquadre aqui o que vai virar carta</Text>
        </View>
        <View style={styles.cameraBar}>
          <View style={styles.cameraSide}>
            <Button label="Cancelar" variant="secondary" size="md" onPress={() => setStep({ kind: 'idle' })} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tirar foto"
            onPress={takePicture}
            disabled={capturing}
            style={[styles.shutter, capturing && { opacity: 0.4 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.cameraSide} />
        </View>
      </View>
    );
  }

  return (
    <Layout onBack={onBack} title="Criar carta">
      {step.kind === 'idle' && (
        <>
          <View style={styles.placeholder}>
            <Icon name="image-plus" size={44} color={colors.accent} />
            <Text style={styles.placeholderText}>Sua foto aqui</Text>
          </View>
          <Text style={[ui.dim, styles.center]}>
            Tire uma foto de algo real (um bicho, uma planta, um objeto). O servidor sorteia a raridade e os atributos, e
            a foto vira a sua carta. Fotos quase iguais a uma já usada são recusadas.
          </Text>
          <Button label="Abrir a câmera" icon="camera" onPress={openCamera} />
          {permission && !permission.granted && !permission.canAskAgain && (
            <Text style={ui.warn}>A câmera está bloqueada. Libere nas configurações do celular para este app.</Text>
          )}
          {Platform.OS === 'web' && <Button label="Escolher arquivo (só teste no computador)" variant="secondary" onPress={pickFileForWebTest} />}
        </>
      )}

      {step.kind === 'category' && (
        <>
          <Image source={{ uri: step.photo.uri }} style={styles.photo} />
          <Text style={[ui.section, styles.center]}>O que tem na foto?</Text>
          <View style={styles.chips}>
            {categories.map((c) => {
              const element = ELEMENT_INFO[c.element as Element];
              return (
                <Pressable key={c.slug} accessibilityRole="button" style={styles.chip} onPress={() => void send(step.photo, c.slug)}>
                  {element && (
                    <View style={[styles.chipDot, { backgroundColor: element.color }]}>
                      <Icon name={element.icon} size={12} color={element.onColor} />
                    </View>
                  )}
                  <Text style={styles.chipText}>{c.nome}</Text>
                </Pressable>
              );
            })}
          </View>
          {categories.length === 0 && <ActivityIndicator color={colors.accent} />}
          <Button label="Cancelar" variant="secondary" onPress={() => setStep({ kind: 'idle' })} />
        </>
      )}

      {step.kind === 'sending' && (
        <>
          <Image source={{ uri: step.photo.uri }} style={styles.photo} />
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[ui.dim, styles.center]}>Criando a carta...</Text>
        </>
      )}

      {step.kind === 'done' && (
        <>
          <View style={styles.cardBox}>
            {/* key = id da carta: carta nova entra com a animação de novo. */}
            <CardView key={step.card.id} card={toCardDef(step.card)} width={CARD_WIDTH} photoUri={step.photo.uri} appear />
          </View>
          {step.card.bonusPoints > 0 && (
            <Text style={[ui.ok, styles.center]}>Bônus da categoria: +{step.card.bonusPoints} de poder</Text>
          )}
          <Button label="Criar outra carta" onPress={() => setStep({ kind: 'idle' })} />
        </>
      )}

      {step.kind === 'error' && (
        <>
          <View style={styles.centerBox}>
            <Icon name="alert-circle-outline" size={44} color={colors.badSoft} />
          </View>
          <Text style={[ui.body, styles.center]}>{step.message}</Text>
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
    <Screen title={title} onBack={onBack} centered>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  centerBox: { alignItems: 'center' },
  placeholder: {
    alignSelf: 'center',
    width: 150,
    height: 150 / 0.72,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { fontFamily: fonts.bodySemi, color: colors.textDim, fontSize: 13 },
  photo: { width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: colors.surface },
  cardBox: { alignSelf: 'center', paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    backgroundColor: colors.raised,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
  },
  chipDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  guideLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 110, pointerEvents: 'none' },
  guide: { width: '72%', maxWidth: 320, aspectRatio: 0.72, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.85)' },
  guideText: { fontFamily: fonts.bodySemi, color: '#FFFFFF', fontSize: 13, textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowRadius: 4 },
  cameraBar: { position: 'absolute', bottom: 28, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraSide: { flex: 1, alignItems: 'flex-start' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent },
});
