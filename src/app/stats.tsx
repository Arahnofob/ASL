import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Heatmap } from '../components/Heatmap';
import { Row, Section, Screen } from '../components/ui';
import { useNow, useStore, useTheme } from '../lib/store';
import { dayEnd, dayKey, dayStart } from '../lib/util';

const DAY = 86_400_000;

export default function Stats() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { col } = useStore();
  const now = useNow();
  const t = useTheme();
  const h = col.settings.dayStartHour;

  const s = useMemo(() => {
    const start = dayStart(now, h);
    const reviews = deckId ? col.reviews.filter((r) => r.deckId === deckId) : col.reviews;
    const today = reviews.filter((r) => r.at >= start);
    const last30 = reviews.filter((r) => r.at >= start - 29 * DAY);
    const matureish = last30.filter((r) => r.state === 2);
    const retention = matureish.length ? matureish.filter((r) => r.rating > 1).length / matureish.length : null;

    const days = new Set(reviews.map((r) => dayKey(r.at, h)));
    let streak = 0;
    for (let d = days.has(dayKey(now, h)) ? now : now - DAY; days.has(dayKey(d, h)); d -= DAY) streak++;

    const cards = Object.values(col.cards).filter((c) => (!deckId || c.deckId === deckId) && !c.suspended);
    const byState = { new: 0, learning: 0, young: 0, mature: 0 };
    for (const c of cards) {
      if (c.s.state === 0) byState.new++;
      else if (c.s.state !== 2) byState.learning++;
      else if (c.s.scheduledDays >= 21) byState.mature++;
      else byState.young++;
    }

    const end = dayEnd(now, h);
    const forecast = Array.from({ length: 7 }, (_, i) => ({ label: i === 0 ? 'Today' : new Date(start + i * DAY + 12 * 3_600_000).toLocaleDateString(undefined, { weekday: 'short' }), n: 0 }));
    for (const c of cards) {
      if (c.s.state === 0) continue;
      const i = c.s.due < end ? 0 : Math.floor((c.s.due - end) / DAY) + 1;
      if (i < 7) forecast[i].n++;
    }

    const history = Array.from({ length: 14 }, (_, i) => {
      const from = start - (13 - i) * DAY;
      return reviews.filter((r) => r.at >= from && r.at < from + DAY).length;
    });

    return {
      todayCount: today.length,
      todayMinutes: Math.round(today.reduce((a, r) => a + r.ms, 0) / 60_000),
      todayAgain: today.filter((r) => r.rating === 1).length,
      retention,
      streak,
      total: reviews.length,
      byState,
      forecast,
      history,
      times: reviews.map((r) => r.at),
    };
  }, [col, deckId, h, now]);

  const maxF = Math.max(1, ...s.forecast.map((f) => f.n));
  const maxH = Math.max(1, ...s.history);

  return (
    <Screen>
      <Stack.Screen options={{ title: deckId ? `Stats · ${col.decks[deckId]?.name ?? ''}` : 'Statistics' }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[
          { label: 'Studied today', v: String(s.todayCount) },
          { label: 'Minutes today', v: String(s.todayMinutes) },
          { label: 'Day streak', v: String(s.streak) },
        ].map((x) => (
          <View key={x.label} style={{ flex: 1, backgroundColor: t.card, borderRadius: 12, padding: 14, gap: 2 }}>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: '700' }}>{x.v}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{x.label}</Text>
          </View>
        ))}
      </View>

      <Section title="Due in the next 7 days">
        <View style={{ padding: 16, gap: 8 }}>
          {s.forecast.map((f) => (
            <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: t.muted, width: 48, fontSize: 13 }}>{f.label}</Text>
              <View style={{ flex: 1, height: 14, backgroundColor: t.bg, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${(f.n / maxF) * 100}%`, height: '100%', backgroundColor: t.reviewC, borderRadius: 4 }} />
              </View>
              <Text style={{ color: t.text, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{f.n}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Study calendar">
        <Heatmap times={s.times} now={now} startHour={h} />
      </Section>

      <Section title="Reviews, last 14 days">
        <View style={{ padding: 16, height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
          {s.history.map((n, i) => (
            <View key={i} style={{ flex: 1, height: `${Math.max(2, (n / maxH) * 100)}%`, backgroundColor: i === 13 ? t.accent : t.newC, opacity: n ? 1 : 0.25, borderRadius: 3 }} />
          ))}
        </View>
      </Section>

      <Section title="Cards">
        <Row label="New" value={String(s.byState.new)} />
        <Row label="Learning" value={String(s.byState.learning)} />
        <Row label="Young (interval < 21 days)" value={String(s.byState.young)} />
        <Row label="Mature (interval ≥ 21 days)" value={String(s.byState.mature)} last />
      </Section>

      <Section title="Performance">
        <Row label="Retention, last 30 days" value={s.retention === null ? '—' : `${Math.round(s.retention * 100)}%`} sub="Share of review cards you remembered." />
        <Row label="Pressed Again today" value={String(s.todayAgain)} />
        <Row label="Total reviews" value={String(s.total)} last />
      </Section>
    </Screen>
  );
}
