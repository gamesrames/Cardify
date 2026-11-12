import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { ui } from '../components/ui';
import { DEFAULT_RULES } from '../motor';
import { describeCause, EMPTY_STATS, formatDelta, rowToCardDef, sortForUpgrade, upgradeOptions, upgradeProgress } from '../progress';
import type { HistoryRow, LeaderboardRow, PhotoCardRow, PlayerStats } from '../progress';
import { fetchHistory, fetchLeaderboard, fetchPhotoCards, fetchStats, upgradeCard } from '../progressClient';
import { signedPhotoUrls } from '../supabase';
import { colors, fonts, radius } from '../theme';

interface Props {
  onBack: () => void;
}

type Tab = 'upgrade' | 'ranking';

/**
 * Progressão e ranking (fase 5): saldo de Essência, melhorar cartas de foto e o ranking com o histórico.
 * Tudo que vale (custo, teto, saldo, rating) é decidido pelo servidor; a tela pede e mostra.
 */
export function ProgressScreen({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('upgrade');
  const [stats, setStats] = useState<PlayerStats>(EMPTY_STATS);
  const [cards, setCards] = useState<PhotoCardRow[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, c, b, h] = await Promise.all([fetchStats(), fetchPhotoCards(), fetchLeaderboard(), fetchHistory()]);
      setStats(s);
      setCards(c);
      setBoard(b);
      setHistory(h);
      const urls = await signedPhotoUrls(c.map((x) => x.photo_path)).catch(() => ({}) as Record<string, string>);
      setPhotos(Object.fromEntries(c.flatMap((x) => (urls[x.photo_path] ? [[x.id, urls[x.photo_path] as string]] : []))));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function buy(card: PhotoCardRow, stat: 'attack' | 'health') {
    setBusy(`${card.id}:${stat}`);
    setError(null);
    try {
      const r = await upgradeCard(card.id, stat);
      setCards((all) =>
        all.map((c) => (c.id === card.id ? { ...c, attack: r.attack, health: r.health, upgrade_attack: r.upgrade_attack, upgrade_health: r.upgrade_health } : c)),
      );
      setStats((s) => ({ ...s, essence: r.essence }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui melhorar a carta.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen title="Progressão" onBack={onBack}>
      <View style={styles.summary}>
        <Stat icon="diamond-stone" tint={colors.accent} value={String(stats.essence)} label="Essência" />
        <Stat icon="trophy" tint={colors.warn} value={String(stats.rating)} label="Rating" />
        <Stat icon="cards-outline" tint={colors.textDim} value={`${stats.wins}-${stats.losses}-${stats.draws}`} label="V-D-E" />
      </View>

      <View style={styles.tabs}>
        <View style={styles.tab}>
          <Button label="Melhorar cartas" size="md" variant={tab === 'upgrade' ? 'outline' : 'secondary'} onPress={() => setTab('upgrade')} />
        </View>
        <View style={styles.tab}>
          <Button label="Ranking" size="md" icon="podium" variant={tab === 'ranking' ? 'outline' : 'secondary'} onPress={() => setTab('ranking')} />
        </View>
      </View>

      {loading && <ActivityIndicator color={colors.accent} />}
      {error && <Text style={ui.error}>{error}</Text>}

      {!loading && tab === 'upgrade' && <UpgradeTab cards={cards} photos={photos} essence={stats.essence} busy={busy} onBuy={buy} />}
      {!loading && tab === 'ranking' && <RankingTab board={board} history={history} />}
    </Screen>
  );
}

function Stat({ icon, tint, value, label }: { icon: 'diamond-stone' | 'trophy' | 'cards-outline'; tint: string; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={20} color={tint} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={ui.small}>{label}</Text>
    </View>
  );
}

function UpgradeTab({
  cards,
  photos,
  essence,
  busy,
  onBuy,
}: {
  cards: PhotoCardRow[];
  photos: Record<string, string>;
  essence: number;
  busy: string | null;
  onBuy: (card: PhotoCardRow, stat: 'attack' | 'health') => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(110, Math.floor(width * 0.28));
  const sorted = useMemo(() => sortForUpgrade(cards), [cards]);
  return (
    <View style={styles.list}>
      <Text style={ui.dim}>
        Ganhe Essência em partidas online e gaste aqui. As melhorias contam no limite de poder do baralho ({DEFAULT_RULES.deckPowerLimit}); se passar, ajuste em
        "Meu baralho". Só cartas de foto melhoram.
      </Text>
      {cards.length === 0 && <Text style={ui.dim}>Você ainda não tem cartas de foto. Crie uma pelo menu.</Text>}
      {sorted.map((card) => {
        const progress = upgradeProgress(card);
        return (
          <View key={card.id} style={[ui.box, styles.cardRow]}>
            <CardView card={rowToCardDef(card)} width={cardWidth} photoUri={photos[card.id]} />
            <View style={styles.cardInfo}>
              <Text style={ui.label} numberOfLines={1}>
                {card.name}
              </Text>
              <Text style={ui.small}>{`Melhoria ${progress.used}/${progress.cap}`}</Text>
              {upgradeOptions(card, essence).map((o) => (
                <Button
                  key={o.stat}
                  size="md"
                  variant="secondary"
                  icon="plus"
                  label={o.state === 'cap' ? `${o.label} (limite)` : `${o.label} · ${o.cost}`}
                  disabled={o.state !== 'ok' || busy !== null}
                  onPress={() => onBuy(card, o.stat)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RankingTab({ board, history }: { board: LeaderboardRow[]; history: HistoryRow[] }) {
  return (
    <View style={styles.list}>
      <Text style={ui.section}>RANKING</Text>
      {board.length === 0 && <Text style={ui.dim}>Ninguém jogou uma partida online pontuada ainda. Seja o primeiro.</Text>}
      {board.map((r) => (
        <View key={`${r.rank}-${r.display_name}`} style={[styles.rankRow, r.is_me && styles.rankMe]}>
          <Text style={styles.rank}>{r.rank}</Text>
          <Text style={[ui.label, { flex: 1 }]} numberOfLines={1}>
            {r.display_name}
          </Text>
          <Text style={ui.small}>{`${r.wins}-${r.losses}-${r.draws}`}</Text>
          <Text style={styles.rating}>{r.rating}</Text>
        </View>
      ))}

      <Text style={[ui.section, { marginTop: 8 }]}>SUAS ÚLTIMAS PARTIDAS</Text>
      {history.length === 0 && <Text style={ui.dim}>Nenhuma partida online ainda.</Text>}
      {history.map((h) => (
        <View key={h.match_id} style={styles.rankRow}>
          <Icon name={h.result === 'win' ? 'trophy' : h.result === 'draw' ? 'handshake' : 'skull'} size={20} color={h.result === 'win' ? colors.accent : h.result === 'draw' ? colors.textDim : colors.badSoft} />
          <View style={{ flex: 1 }}>
            <Text style={ui.label} numberOfLines={1}>{`contra ${h.foe_name}`}</Text>
            <Text style={ui.small}>{h.rated ? describeCause(h.cause) : `${describeCause(h.cause)} · amistosa`}</Text>
          </View>
          <Text style={ui.small}>{h.rated ? `${formatDelta(h.rating_delta)} · +${h.essence}` : '—'}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingVertical: 12 },
  statValue: { fontFamily: fonts.displayHeavy, color: colors.text, fontSize: 20 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1 },
  list: { gap: 12 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardInfo: { flex: 1, gap: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, paddingHorizontal: 12, minHeight: 48 },
  rankMe: { borderColor: colors.accent },
  rank: { fontFamily: fonts.displayHeavy, color: colors.textDim, fontSize: 15, width: 28 },
  rating: { fontFamily: fonts.displayHeavy, color: colors.text, fontSize: 16, minWidth: 48, textAlign: 'right' },
});
