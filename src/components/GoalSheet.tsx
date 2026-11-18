import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALL } from '../lib/queue';
import { useStore, useTheme } from '../lib/store';
import { Segmented } from './ui';

const SESSION_SIZES = ['10', '20', '30', '50', '0'] as const;

/** Quick daily-goal controls, opened by tapping the counters while studying. */
export function GoalSheet({ visible, onClose, scope }: { visible: boolean; onClose: () => void; scope: string }) {
  const { col, mutate } = useStore();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = col.settings;

  // Raising the goal also lifts per-deck limits that would otherwise hold it back.
  const setNew = (v: number) =>
    mutate((c) => {
      c.settings.dailyNew = Math.max(0, Math.min(500, v));
      for (const d of Object.values(c.decks)) if ((scope === ALL || d.id === scope) && d.settings.newPerDay < c.settings.dailyNew) d.settings.newPerDay = c.settings.dailyNew;
    });
  const setReviews = (v: number) =>
    mutate((c) => {
      c.settings.dailyReviews = Math.max(0, Math.min(9999, v));
      for (const d of Object.values(c.decks)) if ((scope === ALL || d.id === scope) && d.settings.reviewsPerDay < c.settings.dailyReviews) d.settings.reviewsPerDay = c.settings.dailyReviews;
    });

  const row = (label: string, sub: string, value: number, step: number, on: (v: number) => void) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text>
      </View>
      <Pressable onPress={() => on(value - step)} hitSlop={6} style={({ pressed }) => [styles.step, { backgroundColor: pressed ? t.border : t.bg }]}>
        <Text style={{ color: t.accent, fontSize: 22, fontWeight: '600' }}>−</Text>
      </Pressable>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '700', minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Pressable onPress={() => on(value + step)} hitSlop={6} style={({ pressed }) => [styles.step, { backgroundColor: pressed ? t.border : t.bg }]}>
        <Text style={{ color: t.accent, fontSize: 22, fontWeight: '600' }}>+</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: t.text, fontSize: 20, fontWeight: '700' }}>Today’s study</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close-circle" size={28} color={t.muted} />
          </Pressable>
        </View>
        {row('New cards per day', 'All decks together', s.dailyNew, 5, setNew)}
        {row('Max reviews per day', 'All decks together', s.dailyReviews, 50, setReviews)}
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Cards per session</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>Take a break after this many cards — you can always continue.</Text>
          <Segmented
            value={String(s.sessionSize) as (typeof SESSION_SIZES)[number]}
            onChange={(v) =>
              mutate((c) => {
                c.settings.sessionSize = Number(v);
              })
            }
            options={SESSION_SIZES.map((v) => ({ value: v, label: v === '0' ? 'All' : v }))}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { width: 42, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
