import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../lib/store';

/** Small pie that fills up as the session progresses, with "done/total" next to it. */
export function ProgressPie({ done, total, size = 22 }: { done: number; total: number; size?: number }) {
  const t = useTheme();
  const f = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const r = size / 2;
  const inner = r - 2;
  const angle = f * 2 * Math.PI;
  const x = r + inner * Math.sin(angle);
  const y = r - inner * Math.cos(angle);
  const wedge = f >= 1 ? null : `M${r},${r} L${r},${r - inner} A${inner},${inner} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)} Z`;
  return (
    <View accessibilityLabel={`${done} of ${total} cards done`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={r - 1} fill={t.accentSoft} stroke={t.accent} strokeWidth={1.5} />
        {f >= 1 ? <Circle cx={r} cy={r} r={inner} fill={t.accent} /> : f > 0 && wedge ? <Path d={wedge} fill={t.accent} /> : null}
      </Svg>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {Math.min(done, total)}/{total}
      </Text>
    </View>
  );
}
