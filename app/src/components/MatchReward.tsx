import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDelta, rewardFor } from '../progress';
import type { RewardInfo } from '../progress';
import { fetchMatchResult } from '../progressClient';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { ui } from './ui';

interface Props {
  matchId: string;
  /** Meu lado na partida (0 = quem criou, 1 = quem entrou). */
  seat: 0 | 1;
}

const TRIES = 6;
const WAIT_MS = 1000;

/**
 * O que a partida rendeu (rating e Essência), na janela de fim de partida. O servidor pontua logo depois de
 * terminar a partida, então a primeira consulta pode chegar antes: tenta algumas vezes. Se a progressão não
 * existe no servidor (migração não aplicada) ou não aparece, não mostra nada: a partida em si não depende disto.
 */
export function MatchReward({ matchId, seat }: Props) {
  const [reward, setReward] = useState<RewardInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < TRIES && !cancelled; i++) {
        try {
          const result = await fetchMatchResult(matchId);
          if (result) {
            if (!cancelled) setReward(rewardFor(result, seat));
            return;
          }
        } catch {
          return; // sem progressão no servidor ou sem rede: some em silêncio
        }
        await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, seat]);

  if (!reward) return null;
  if (!reward.rated) {
    return <Text style={[ui.small, styles.center]}>Partida amistosa: vocês já jogaram o máximo de partidas pontuadas hoje.</Text>;
  }
  return (
    <View style={styles.row} accessibilityLabel={`Rating ${formatDelta(reward.rating)}, Essência ${reward.essence}`}>
      <View style={styles.item}>
        <Icon name="trophy" size={18} color={colors.textDim} />
        <Text style={styles.value}>{formatDelta(reward.rating)}</Text>
      </View>
      <View style={styles.item}>
        <Icon name="diamond-stone" size={18} color={colors.accent} />
        <Text style={[styles.value, { color: colors.accent }]}>{`+${reward.essence}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontFamily: fonts.displayHeavy, color: colors.text, fontSize: 18 },
});
