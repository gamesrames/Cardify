import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { loadDeckIds, saveDeckIds } from '../deckStorage';
import { buildPool, deckFromIds, deckStatus, toggleId } from '../myCards';
import type { CardRow } from '../myCards';
import { CARDS, DEFAULT_RULES } from '../motor';
import type { CardDef } from '../motor';
import { isSupabaseConfigured, listMyCards, signedPhotoUrls } from '../supabase';
import { MAX_APP_WIDTH } from '../layout';
import { colors } from '../theme';

const LIST_PADDING = 16;
const GRID_GAP = 8;

interface Props {
  /** `photos` é `id da carta → endereço da foto`, para a partida desenhar as fotos. */
  onPlay: (deck: CardDef[], photos: Record<string, string>) => void;
  onBack: () => void;
}

export function MyDeckScreen({ onPlay, onBack }: Props) {
  const [rows, setRows] = useState<CardRow[]>([]);
  const [photoById, setPhotoById] = useState<Record<string, string>>({});
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  // 3 cartas por linha, no máximo na largura do app (em janela larga fica centralizado, como no celular).
  const cardWidth = Math.floor((Math.min(windowWidth, MAX_APP_WIDTH) - 2 * LIST_PADDING - 2 * GRID_GAP) / 3);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedIds = await loadDeckIds();
      let myRows: CardRow[] = [];
      let byId: Record<string, string> = {};
      try {
        if (isSupabaseConfigured) {
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
      setRows(myRows);
      setPhotoById(byId);
      setIds(savedIds);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pool = useMemo(() => buildPool(rows), [rows]);
  const deck = useMemo(() => deckFromIds(pool, ids), [pool, ids]);
  const status = useMemo(() => deckStatus(deck), [deck]);
  const ownedCards = pool.slice(CARDS.length);
  const fixedCards = pool.slice(0, CARDS.length);

  function toggle(id: string) {
    const next = toggleId(ids, id);
    setIds(next);
    void saveDeckIds(next);
  }

  function renderCards(cards: CardDef[]) {
    return (
      <View style={styles.grid}>
        {cards.map((card) => (
          <CardView
            key={card.id}
            card={card}
            width={cardWidth}
            photoUri={photoById[card.id]}
            selected={ids.includes(card.id)}
            onPress={() => toggle(card.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        <Text style={styles.title}>Meu baralho</Text>
        <Text style={styles.hint}>
          Escolha {DEFAULT_RULES.deckSize} cartas. O poder total não pode passar de {DEFAULT_RULES.deckPowerLimit}. O
          baralho fica salvo neste aparelho.
        </Text>
        {loading && <ActivityIndicator color={colors.accent} />}
        {loadError && <Text style={styles.warn}>{loadError} Só as cartas fixas estão disponíveis.</Text>}

        <Text style={styles.section}>Suas cartas de foto ({ownedCards.length})</Text>
        {ownedCards.length > 0 ? (
          renderCards(ownedCards)
        ) : (
          !loading && <Text style={styles.hint}>Nenhuma ainda. Crie uma pelo menu: "Criar carta com uma foto".</Text>
        )}

        <Text style={styles.section}>Cartas fixas</Text>
        {renderCards(fixedCards)}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.count}>
          {deck.length}/{DEFAULT_RULES.deckSize} cartas · Poder {status.power}/{DEFAULT_RULES.deckPowerLimit}
        </Text>
        {deck.length > 0 && status.problems.map((p) => <Text key={p} style={styles.problem}>{p}</Text>)}
        <View style={styles.buttons}>
          <View style={{ flex: 1 }}>
            <Button label="Voltar" variant="secondary" onPress={onBack} />
          </View>
          <View style={{ flex: 2 }}>
            <Button label="Jogar contra o bot" disabled={!status.valid} onPress={() => onPlay(deck, photoById)} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center' },
  list: { padding: LIST_PADDING, gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  warn: { color: colors.warn, fontSize: 14 },
  section: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  footer: { width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel },
  count: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  problem: { color: colors.bad, fontSize: 12 },
  buttons: { flexDirection: 'row', gap: 10 },
});
