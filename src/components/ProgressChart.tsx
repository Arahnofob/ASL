import { useState } from 'react';
import { Platform, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { ProgressPoint } from '../lib/progress';
import { useTheme } from '../lib/store';

const H = 170;
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined;
const PAD = { l: 34, r: 14, t: 18, b: 22 };

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const pct = (v: number) => `${v < 0.1 && v > 0 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;

/** Single-series progress line: solid = actual, dashed = projection at the planned pace. */
export function ProgressChart({ history, projection }: { history: ProgressPoint[]; projection: ProgressPoint[] }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<ProgressPoint & { projected: boolean } | null>(null);

  const all = [...history, ...projection];
  const t0 = all[0]?.t ?? 0;
  const t1 = Math.max(all[all.length - 1]?.t ?? 1, t0 + 1);
  const today = history[history.length - 1];
  const iw = Math.max(1, w - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const x = (tt: number) => PAD.l + ((tt - t0) / (t1 - t0)) * iw;
  const y = (v: number) => PAD.t + (1 - v) * ih;
  const path = (pts: ProgressPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  const scrub = (e: GestureResponderEvent) => {
    const px = e.nativeEvent.locationX;
    const tt = t0 + ((px - PAD.l) / iw) * (t1 - t0);
    let best: (ProgressPoint & { projected: boolean }) | null = null;
    for (const p of history) if (!best || Math.abs(p.t - tt) < Math.abs(best.t - tt)) best = { ...p, projected: false };
    for (const p of projection) if (!best || Math.abs(p.t - tt) < Math.abs(best.t - tt)) best = { ...p, projected: p.t > today.t };
    setHover(best);
  };

  return (
    <View>
      <Text style={{ color: hover ? t.text : t.muted, fontSize: 13, minHeight: 18 }}>
        {hover ? `${fmtDate(hover.t)} · ${pct(hover.v)} started${hover.projected ? ' (projected)' : ''}` : 'Tap or drag on the chart to see a day'}
      </Text>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={scrub}
        onResponderMove={scrub}
        onResponderRelease={() => setTimeout(() => setHover(null), 1500)}
        style={{ height: H }}
      >
        {w > 0 && today ? (
          <Svg width={w} height={H}>
            {/* Recessive grid: 0 / 50 / 100% */}
            {[0, 0.5, 1].map((g) => (
              <Line key={g} x1={PAD.l} x2={w - PAD.r} y1={y(g)} y2={y(g)} stroke={t.border} strokeWidth={1} strokeDasharray={g === 1 ? '4 4' : undefined} />
            ))}
            {[0, 0.5, 1].map((g) => (
              <SvgText key={`l${g}`} x={PAD.l - 6} y={y(g) + 4} fontSize={11} fontFamily={FONT} fill={t.muted} textAnchor="end">
                {`${g * 100}%`}
              </SvgText>
            ))}
            {/* Today marker */}
            <Line x1={x(today.t)} x2={x(today.t)} y1={PAD.t} y2={H - PAD.b} stroke={t.muted} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            {projection.length > 1 && <Path d={path(projection)} stroke={t.chart} strokeWidth={2} strokeDasharray="6 5" fill="none" strokeLinecap="round" opacity={0.7} />}
            <Path d={path(history)} stroke={t.chart} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(today.t)} cy={y(today.v)} r={5} fill={t.chart} stroke={t.card} strokeWidth={2} />
            {/* Direct label on today's value */}
            <SvgText x={x(today.t) - 8} y={Math.max(y(today.v) - 10, 12)} fontSize={12} fontWeight="600" fill={t.text} textAnchor="end" fontFamily={FONT}>
              {pct(today.v)}
            </SvgText>
            {hover && (
              <>
                <Line x1={x(hover.t)} x2={x(hover.t)} y1={PAD.t} y2={H - PAD.b} stroke={t.text} strokeWidth={1} opacity={0.35} />
                <Circle cx={x(hover.t)} cy={y(hover.v)} r={5} fill={t.card} stroke={t.chart} strokeWidth={2} />
              </>
            )}
            {/* X axis: start, today, finish */}
            <SvgText x={PAD.l} y={H - 4} fontSize={11} fontFamily={FONT} fill={t.muted} textAnchor="start">
              {fmtDate(t0)}
            </SvgText>
            <SvgText x={x(today.t)} y={H - 4} fontSize={11} fontFamily={FONT} fill={t.muted} textAnchor={projection.length > 1 ? 'middle' : 'end'}>
              Today
            </SvgText>
            {projection.length > 1 && (
              <SvgText x={w - PAD.r} y={H - 4} fontSize={11} fontFamily={FONT} fill={t.muted} textAnchor="end">
                {fmtDate(t1)}
              </SvgText>
            )}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}
