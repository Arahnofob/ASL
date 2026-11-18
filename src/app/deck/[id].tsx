import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressChart } from '../../components/ProgressChart';
import { Row, Section, Screen } from '../../components/ui';
import { deckPlan } from '../../lib/progress';
import { deckCounts } from '../../lib/queue';
import { estimateMinutes } from '../../lib/stats';
import { useNow, useStore, useTheme } from '../../lib/store';
import { dayKey, plural } from '../../lib/util';

export default function DeckOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { col, mutate } = useStore();
  const t = useTheme();
  const now = useNow();
  const deck = col.decks[id];
  const counts = useMemo(() => (deck ? deckCounts(col, id, now) : null), [col, now, id, deck]);
  const plan = useMemo(() => deckPlan(col, id, now), [col, id, now]);
  const [planOpen, setPlanOpen] = useState(false);
  const stats = useMemo(() => {
    let total = 0;
    let fresh = 0;
    let suspended = 0;
    for (const c of Object.values(col.cards)) {
      if (c.deckId !== id) continue;
      total++;
      if (c.suspended) suspended++;
      else if (c.s.state === 0) fresh++;
    }
    return { total, fresh, suspended };
  }, [col, id]);

  if (!deck || !counts)
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Text style={{ color: t.muted }}>Deck not found.</Text>
      </Screen>
    );

  const due = counts.newCount + counts.learnCount + counts.reviewCount;
  const setPace = (n: number) =>
    mutate((c) => {
      c.decks[id].settings.newPerDay = Math.max(0, Math.min(500, n));
    });

  const extraNew = (n: number) =>
    mutate((c) => {
      const d = c.decks[id];
      const today = dayKey(Date.now(), c.settings.dayStartHour);
      const prev = d.extraNew?.day === today ? d.extraNew.count : 0;
      d.extraNew = { day: today, count: prev + n };
    });

  const askExtra = () => {
    if (Platform.OS === 'web') return extraNew(10);
    Alert.alert('Learn more today', 'Add extra new cards to today’s limit.', [
      { text: '+5 new cards', onPress: () => extraNew(5) },
      { text: '+10 new cards', onPress: () => extraNew(10) },
      { text: '+20 new cards', onPress: () => extraNew(20) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const heroText = '#FFFFFF';
  return (
    <Screen>
      <Stack.Screen options={{ title: deck.name }} />

      <View style={[styles.hero, { backgroundColor: t.hero }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[
            { label: 'New', v: counts.newCount },
            { label: 'Learning', v: counts.learnCount },
            { label: 'To review', v: counts.reviewCount },
          ].map((x) => (
            <View key={x.label} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: heroText, fontSize: 34, fontWeight: '700', opacity: x.v ? 1 : 0.45, fontVariant: ['tabular-nums'] }}>{x.v}</Text>
              <Text style={{ color: heroText, fontSize: 13, opacity: 0.8 }}>{x.label}</Text>
            </View>
          ))}
        </View>
        {due > 0 ? (
          <Pressable onPress={() => router.push({ pathname: '/study/[id]', params: { id } })} style={({ pressed }) => [styles.heroBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="play" size={20} color="#1E2D6B" />
            <Text style={{ color: '#1E2D6B', fontSize: 18, fontWeight: '700' }}>Study now · ≈ {estimateMinutes(due)} min</Text>
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={{ color: heroText, textAlign: 'center', fontSize: 17, fontWeight: '600' }}>🎉 All done for today!</Text>
            {stats.fresh > 0 && (
              <Pressable onPress={askExtra} style={({ pressed }) => [styles.heroBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <Ionicons name="add-circle-outline" size={20} color="#1E2D6B" />
                <Text style={{ color: '#1E2D6B', fontSize: 17, fontWeight: '700' }}>Learn more new cards</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <View style={[styles.panel, { backgroundColor: t.card }]}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.muted, fontSize: 13 }}>Progress</Text>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: '700' }}>{plan.total ? fmtPct(plan.started / plan.total) : '0%'}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>
              {plan.started} of {plan.total} cards started
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.muted, fontSize: 13 }}>Reviews today</Text>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: '700' }}>{plan.reviewsToday}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>Recent pace: {plan.recentPace} new/day</Text>
          </View>
        </View>

        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: 4 }}>Estimated completion</Text>
        <ProgressChart history={plan.history} projection={plan.projection} />
        <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>
          {plan.daysLeft === 0
            ? '🎉 Every card in this deck has been started.'
            : plan.finishAt
              ? `At ${plan.pace} new cards a day, you'll have studied every card by ${new Date(plan.finishAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} (${plural(plan.daysLeft ?? 0, 'day')}).`
              : 'New cards are set to 0 per day, so no finish date.'}
        </Text>

        <Pressable onPress={() => setPlanOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} hitSlop={6}>
          <Ionicons name={planOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>Adjust plan</Text>
        </Pressable>
        {planOpen && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>New cards per day</Text>
              <StepBtn label="−" onPress={() => setPace(plan.pace - 5)} />
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '600', minWidth: 36, textAlign: 'center' }}>{plan.pace}</Text>
              <StepBtn label="+" onPress={() => setPace(plan.pace + 5)} />
            </View>
            <Text style={{ color: t.muted, fontSize: 13 }}>Or finish all {plan.total - plan.started} remaining cards in:</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1, 2, 3, 6].map((m) => {
                const perDay = Math.max(1, Math.ceil((plan.total - plan.started) / (m * 30)));
                return (
                  <Pressable key={m} onPress={() => setPace(perDay)} style={({ pressed }) => [styles.chip, { backgroundColor: perDay === plan.pace ? t.accent : t.accentSoft, opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={{ color: perDay === plan.pace ? t.accentText : t.accent, fontWeight: '600', fontSize: 14 }}>
                      {m} month{m > 1 ? 's' : ''} · {perDay}/day
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: t.muted, fontSize: 12 }}>More new cards per day also means more reviews later — roughly 5–10 reviews per new card over the first month.</Text>
          </View>
        )}
      </View>

      <Section>
        <Row icon="add-circle-outline" label="Add cards" onPress={() => router.push({ pathname: '/edit', params: { deckId: id } })} />
        <Row icon="search-outline" iconColor={t.reviewC} label="Browse & edit cards" value={String(stats.total)} onPress={() => router.push({ pathname: '/browse', params: { deckId: id } })} />
        <Row icon="stats-chart-outline" iconColor={t.learnC} label="Statistics" onPress={() => router.push({ pathname: '/stats', params: { deckId: id } })} />
        {due > 0 && stats.fresh > 0 ? <Row icon="sparkles-outline" iconColor={t.hard} label="Learn extra new cards today" onPress={askExtra} /> : null}
        <Row icon="options-outline" iconColor={t.muted} label="Deck options" sub="Daily limits, direction, style…" onPress={() => router.push({ pathname: '/deck-options/[id]', params: { id } })} last />
      </Section>
    </Screen>
  );
}

const fmtPct = (v: number) => `${v > 0 && v < 0.1 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 38, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.border : t.bg })}>
      <Text style={{ color: t.accent, fontSize: 20, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 20, padding: 16, gap: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  hero: { borderRadius: 24, padding: 20, gap: 18 },
  heroBtn: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
