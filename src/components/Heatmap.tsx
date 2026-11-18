import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { tint, useTheme } from '../lib/store';
import { dayStart } from '../lib/util';

const DAY = 86_400_000;
const WEEKS = 17;
const GAP = 3;

/**
 * Study calendar: one square per day for the last 17 weeks (columns = weeks, Monday on top).
 * One hue, light → dark = fewer → more reviews. Tap a square to read its value.
 */
export function Heatmap({ times, now, startHour }: { times: number[]; now: number; startHour: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const { days, max, activeDays } = useMemo(() => {
    const today = dayStart(now, startHour);
    // Monday = 0 … Sunday = 6
    const weekday = (new Date(today + 12 * 3_600_000).getDay() + 6) % 7;
    const first = today - (weekday + (WEEKS - 1) * 7) * DAY;
    const counts = new Map<number, number>();
    for (const at of times) {
      if (at < first) continue;
      const i = Math.floor((dayStart(at, startHour) + 12 * 3_600_000 - first) / DAY);
      counts.set(i, (counts.get(i) ?? 0) + 1);
    }
    const total = (WEEKS - 1) * 7 + weekday + 1;
    const list = Array.from({ length: total }, (_, i) => ({ t: first + i * DAY, n: counts.get(i) ?? 0 }));
    return { days: list, max: Math.max(1, ...list.map((d) => d.n)), activeDays: list.filter((d) => d.n > 0).length };
  }, [times, now, startHour]);

  const cell = w > 0 ? Math.floor((w - (WEEKS - 1) * GAP) / WEEKS) : 0;
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const colour = (lv: number) => (lv === 0 ? t.border : tint(t.chart, [0, 0.3, 0.5, 0.75, 1][lv]));
  const fmt = (ts: number) => new Date(ts + 12 * 3_600_000).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const sel = picked !== null ? days[picked] : null;

  // Month label above the first week that starts in a new month.
  const months = Array.from({ length: WEEKS }, (_, c) => {
    const d = new Date(days[c * 7].t + 12 * 3_600_000);
    const prev = c > 0 ? new Date(days[(c - 1) * 7].t + 12 * 3_600_000) : null;
    return !prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString(undefined, { month: 'short' }) : '';
  });

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ color: sel ? t.text : t.muted, fontSize: 13, minHeight: 18 }}>
        {sel ? `${fmt(sel.t)} · ${sel.n} review${sel.n === 1 ? '' : 's'}` : `${activeDays} study day${activeDays === 1 ? '' : 's'} in the last ${WEEKS} weeks · tap a day`}
      </Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {cell > 0 && (
          <>
            <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 4 }}>
              {months.map((m, c) => (
                <View key={c} style={{ width: cell, height: 13 }}>
                  <Text numberOfLines={1} style={{ position: 'absolute', left: 0, top: 0, width: 44, color: t.muted, fontSize: 10 }}>
                    {m}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {Array.from({ length: WEEKS }, (_, c) => (
                <View key={c} style={{ gap: GAP }}>
                  {Array.from({ length: 7 }, (_, r) => {
                    const i = c * 7 + r;
                    const d = days[i];
                    if (!d) return <View key={r} style={{ width: cell, height: cell }} />;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setPicked(picked === i ? null : i)}
                        accessibilityLabel={`${fmt(d.t)}: ${d.n} reviews`}
                        style={{ width: cell, height: cell, borderRadius: 4, backgroundColor: colour(level(d.n)), borderWidth: picked === i ? 2 : 0, borderColor: t.text }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        <Text style={{ color: t.muted, fontSize: 11, marginRight: 2 }}>Less</Text>
        {[0, 1, 2, 3, 4].map((lv) => (
          <View key={lv} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colour(lv) }} />
        ))}
        <Text style={{ color: t.muted, fontSize: 11, marginLeft: 2 }}>More</Text>
      </View>
    </View>
  );
}
