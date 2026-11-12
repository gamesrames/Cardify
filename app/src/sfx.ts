import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import hit from '../assets/sfx/hit.wav';
import lose from '../assets/sfx/lose.wav';
import play from '../assets/sfx/play.wav';
import reveal from '../assets/sfx/reveal.wav';
import select from '../assets/sfx/select.wav';
import tap from '../assets/sfx/tap.wav';
import turn from '../assets/sfx/turn.wav';
import win from '../assets/sfx/win.wav';

// Efeitos sonoros e vibração. Regras deste arquivo:
// - Som é enfeite: se o aparelho ou o navegador recusar, o jogo segue. Por isso todo `try/catch`.
// - Os arquivos são gerados por scripts/gerar-sons.py (síntese própria, sem licença de terceiros).
// - No iPhone o expo-audio respeita a chave de silencioso (padrão `playsInSilentMode: false`).

const SOURCES = { tap, select, play, hit, turn, reveal, win, lose };
export type SfxName = keyof typeof SOURCES;

const STORAGE_KEY = 'cardify.sound.v1';
// Um tocador por som, criado na primeira vez que o som toca (como um Lazy<T> do C#).
const players: Partial<Record<SfxName, AudioPlayer>> = {};
let muted = false;
const listeners = new Set<(muted: boolean) => void>();

export function playSfx(name: SfxName): void {
  if (muted) return;
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      players[name] = player;
    }
    // Volta ao início para poder tocar de novo logo em seguida (dois danos seguidos, por exemplo).
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // sem som neste aparelho: ignora
  }
}

export type HapticKind = 'light' | 'medium' | 'success' | 'error';

/** Vibração curta. No navegador não faz nada. */
export function haptic(kind: HapticKind): void {
  if (muted || Platform.OS === 'web') return;
  try {
    const done =
      kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'error' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      : Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    void done.catch(() => undefined);
  } catch {
    // aparelho sem vibração: ignora
  }
}

export function isMuted(): boolean {
  return muted;
}

/** Liga/desliga som e vibração e guarda a escolha no aparelho. */
export function setMuted(value: boolean): void {
  muted = value;
  listeners.forEach((listener) => listener(value));
  void AsyncStorage.setItem(STORAGE_KEY, value ? 'off' : 'on').catch(() => undefined);
}

/** Lê a escolha guardada. Chamado uma vez quando o app abre. */
export async function loadSoundPreference(): Promise<void> {
  try {
    muted = (await AsyncStorage.getItem(STORAGE_KEY)) === 'off';
    listeners.forEach((listener) => listener(muted));
  } catch {
    // sem armazenamento: fica com som ligado
  }
}

/** Avisa quando o som é ligado/desligado. Devolve a função que cancela a inscrição. */
export function onMutedChange(listener: (muted: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
