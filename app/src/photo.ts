import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1280;

export interface PreparedPhoto {
  /** Foto como data URI, para mostrar na tela. */
  uri: string;
  /** JPEG em base64, sem prefixo. */
  base64: string;
}

/**
 * Reduz a foto e a regrava como JPEG. Regravar descarta o EXIF (localização, modelo
 * do celular...) e deixa o envio leve; o servidor ainda recodifica por garantia.
 * `width`/`height` vêm da câmera; só reduz se for maior que o limite (nunca amplia).
 */
export async function preparePhoto(uri: string, width: number): Promise<PreparedPhoto> {
  const actions = width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('Não consegui preparar a foto.');
  // data URI: aparece igual no celular e no navegador (o `uri` de arquivo/blob nem sempre carrega no web).
  return { uri: `data:image/jpeg;base64,${result.base64}`, base64: result.base64 };
}
