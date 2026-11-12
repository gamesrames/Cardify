import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** A marca do app: uma cartinha na cor de ação, inclinada, ao lado do nome. */
export function Wordmark() {
  return (
    <View style={styles.wordmark}>
      <View style={styles.card} />
      <Text style={styles.title} accessibilityRole="header">
        Cardify
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  card: { width: 21, height: 29, borderRadius: 5, backgroundColor: colors.accent, transform: [{ rotate: '-10deg' }] },
  title: { fontFamily: fonts.displayHeavy, color: colors.text, fontSize: 36, lineHeight: 46, letterSpacing: -1 },
});
