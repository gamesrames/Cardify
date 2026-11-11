import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { ui } from '../components/ui';
import { clearLegacyDeckIds, loadDeckIds, loadLegacyDeckIds, saveDeckIds } from '../deckStorage';
import { createSaveQueue, resolveDeck } from '../deckSync';
import type { SyncState } from '../deckSync';
import { buildPool, deckFromIds, deckStatus, toggleId } from '../myCards';
import type { CardRow } from '../myCards';
import { CARDS, DEFAULT_RULES } from '../motor';
import type { CardDef } from '../motor';
import { fetchCloudDeck, isSupabaseConfigured, listMyCards, saveCloudDeck, signedPhotoUrls } from '../supabase';
import { MAX_APP_WIDTH } from '../layout';
import { playSfx } from '../sfx';
import { colors, fonts } from '../theme';

/** Igual ao padding lateral do conteúdo do componente Screen. */
const LIST_PADDING = 20;
const GRID_GAP = 8;

interface Props {
  /** Jogador logado (`null` só no modo offline, sem servidor). */
  userId: string | null;
  /** Convidado: o baralho vai para a nuvem, mas só volta em outro aparelho depois de criar a conta. */
  isGuest: boolean;
  /** `photos` é `id da carta → endereço da foto`, para a partida desenhar as fotos. */
  onPlay: (deck: CardDef[], photos: Record<string, string>) => void;
  onBack: () => void;
}

export function MyDeckScreen({ userId, isGuest, onPlay, onBack }: Props) {
  const localKey = userId ?? 'offline';
  const [rows, setRows] = useState<CardRow[]>([]);
  const [photoById, setPhotoById] = useState<Record<string, string>>({});
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');
  // Fila de gravação na nuvem: uma de cada vez, só a versão mais nova (veja deckSync.ts).
  const queue = useRef(createSaveQueue(saveCloudDeck, setSync));
  const { width: windowWidth } = useWindowDimensions();
  // 3 cartas por linha, no máximo na largura do app (em janela larga fica centralizado, como no celular).
  const cardWidth = Math.floor((Math.min(windowWidth, MAX_APP_WIDTH) - 2 * LIST_PADDING - 2 * GRID_GAP) / 3);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadDeckIds(localKey);
      const legacy = await loadLegacyDeckIds();
      let cloud: string[] | null = null;
      let cloudReachable = false;
      let myRows: CardRow[] = [];
      let byId: Record<string, string> = {};
      try {
        if (isSupabaseConfigured) {
          try {
            cloud = await fetchCloudDeck();
            cloudReachable = true;
          } catch {
            // sem rede: segue com o baralho guardado no aparelho e avisa no rodapé
          }
          myRows = await listMyCards();
          const urls = await signedPhotoUrls(myRows.map((r) => r.photo_path));
          for (const r of myRows) {
            const url = urls[r.photo_path];
            if (url) byId[r.id] = url;
          }
        }
      } catch (e) {
        // Sem rede ou sem servidor: dá para montar o baralho só com as cartas fixas.
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Não consegui carregar as suas cartas.');
      }
      if (cancelled) return;
      // A nuvem manda; se ainda estiver vazia, o baralho do aparelho sobe (inclusive o da fase 2).
      const resolved = resolveDeck({ local, legacy, cloud, cloudReachable });
      setRows(myRows);
      setPhotoById(byId);
      setIds(resolved.ids);
      setSync(isSupabaseConfigured && !cloudReachable ? 'offline' : 'idle');
      setLoading(false);
      void saveDeckIds(localKey, resolved.ids); // cópia local para jogar sem internet
      if (resolved.uploadToCloud) void queue.current.save(resolved.ids);
      if (resolved.consumedLegacy) void clearLegacyDeckIds();
    })();
    return () => {
      cancelled = true;
    };
  }, [localKey]);

  const syncNote =
    sync === 'saving' ? 'Salvando na nuvem...'
    : sync === 'offline' ? 'Sem conexão: o baralho está salvo só neste aparelho e sobe quando você mexer nele de novo.'
    : sync === 'saved' && isGuest ? 'Salvo. Para ver este baralho em outro aparelho, crie uma conta em "Minha conta".'
    : sync === 'saved' ? 'Salvo na nuvem.'
    : null;

  const pool = useMemo(() => buildPool(rows), [rows]);
  const deck = useMemo(() => deckFromIds(pool, ids), [pool, ids]);
  const status = useMemo(() => deckStatus(deck), [deck]);
  const ownedCards = pool.slice(CARDS.length);
  const fixedCards = pool.slice(0, CARDS.length);

  function toggle(id: string) {
    const next = toggleId(ids, id);
    if (next.length !== ids.length) playSfx('select');
    setIds(next);
    void saveDeckIds(localKey, next);
    if (isSupabaseConfigured) void queue.current.save(next);
  }

  function renderCards(cards: CardDef[]) {
    return (
      <View style={styles.grid}>
        {cards.map((card) => {
          const chosen = ids.includes(card.id);
          return (
            <View key={card.id}>
              <CardView card={card} width={cardWidth} photoUri={photoById[card.id]} selected={chosen} liftOnSelect={false} onPress={() => toggle(card.id)} />
              {chosen && (
                // Marca de "está no baralho". `pointerEvents: none` deixa o toque chegar na carta.
                <View style={styles.check}>
                  <Icon name="check-circle" size={22} color={colors.accent} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  const full = deck.length === DEFAULT_RULES.deckSize;
  return (
    <Screen
      title="Meu baralho"
      onBack={onBack}
      footer={
        <>
          <View style={styles.counters}>
            <Text style={[styles.count, full && { color: colors.accent }]}>
              {deck.length}/{DEFAULT_RULES.deckSize} cartas
            </Text>
            <Text style={[styles.count, status.power > DEFAULT_RULES.deckPowerLimit && { color: colors.badSoft }]}>
              Poder {status.power}/{DEFAULT_RULES.deckPowerLimit}
            </Text>
          </View>
          {deck.length > 0 && status.problems.map((p) => <Text key={p} style={ui.error}>{p}</Text>)}
          <Button label="Jogar contra o bot" icon="robot" disabled={!status.valid} onPress={() => onPlay(deck, photoById)} />
        </>
      }
    >
      <Text style={ui.dim}>
        Escolha {DEFAULT_RULES.deckSize} cartas. O poder total não pode passar de {DEFAULT_RULES.deckPowerLimit}. O
        baralho é salvo na sua conta.
      </Text>
      {syncNote && (
        <View style={styles.sync}>
          <Icon name={sync === 'offline' ? 'cloud-off-outline' : 'cloud-check-outline'} size={18} color={sync === 'offline' ? colors.warn : colors.textDim} />
          <Text style={[sync === 'offline' ? ui.warn : ui.small, styles.syncText]}>{syncNote}</Text>
        </View>
      )}
      {loading && <ActivityIndicator color={colors.accent} />}
      {loadError && <Text style={ui.warn}>{loadError} Só as cartas fixas estão disponíveis.</Text>}

      <Text style={ui.section}>Suas cartas de foto ({ownedCards.length})</Text>
      {ownedCards.length > 0 ? (
        renderCards(ownedCards)
      ) : (
        !loading && <Text style={ui.dim}>Nenhuma ainda. Crie uma pelo menu: "Criar carta".</Text>
      )}

      <Text style={ui.section}>Cartas fixas</Text>
      {renderCards(fixedCards)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  check: { position: 'absolute', top: -7, alignSelf: 'center', backgroundColor: colors.bg, borderRadius: 11, pointerEvents: 'none' },
  sync: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  syncText: { flex: 1 },
  counters: { flexDirection: 'row', justifyContent: 'space-between' },
  count: { fontFamily: fonts.display, color: colors.text, fontSize: 13 },
});
