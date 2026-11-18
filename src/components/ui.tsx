import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/store';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Section({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {title ? <Text style={[styles.sectionTitle, { color: t.muted }]}>{title.toUpperCase()}</Text> : null}
      <View style={{ backgroundColor: t.card, borderRadius: 16, overflow: 'hidden' }}>{children}</View>
      {footer ? <Text style={{ color: t.muted, fontSize: 13, paddingHorizontal: 4 }}>{footer}</Text> : null}
    </View>
  );
}

export function Row({ label, value, onPress, right, danger, last, sub, icon, iconColor }: { label: string; value?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; last?: boolean; sub?: string; icon?: IconName; iconColor?: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? t.border : 'transparent' }]}
    >
      {icon ? (
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: (danger ? t.danger : (iconColor ?? t.accent)) + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={danger ? t.danger : (iconColor ?? t.accent)} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? t.danger : t.text, fontSize: 16 }}>{label}</Text>
        {sub ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {value !== undefined ? <Text style={{ color: t.muted, fontSize: 16 }}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={t.muted} /> : null}
    </Pressable>
  );
}

export function SwitchRow({ label, value, onChange, sub, last }: { label: string; value: boolean; onChange: (v: boolean) => void; sub?: string; last?: boolean }) {
  return <Row label={label} sub={sub} last={last} right={<Switch value={value} onValueChange={onChange} />} />;
}

export function Stepper({ label, value, onChange, step = 1, min = 0, max = 9999, format, sub, last }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string; sub?: string; last?: boolean }) {
  const t = useTheme();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  const btn = (txt: string, d: number) => (
    <Pressable onPress={() => onChange(clamp(value + d))} hitSlop={6} style={({ pressed }) => [styles.stepBtn, { backgroundColor: pressed ? t.border : t.bg }]}>
      <Text style={{ color: t.accent, fontSize: 20, fontWeight: '600' }}>{txt}</Text>
    </Pressable>
  );
  return (
    <Row
      label={label}
      sub={sub}
      last={last}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {btn('−', -step)}
          <Text style={{ color: t.text, fontSize: 16, minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{format ? format(value) : value}</Text>
          {btn('+', step)}
        </View>
      }
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: t.bg }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, on && { backgroundColor: t.card, shadowOpacity: 0.12 }]}>
            <Text style={{ color: on ? t.text : t.muted, fontWeight: on ? '600' : '400', fontSize: 14 }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SegmentRow<T extends string>({ label, sub, options, value, onChange, last }: { label: string; sub?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.rowCol, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <Text style={{ color: t.text, fontSize: 16 }}>{label}</Text>
      {sub ? <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text> : null}
      <Segmented options={options} value={value} onChange={onChange} />
    </View>
  );
}

export function Field({ label, last, ...props }: TextInputProps & { label?: string; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.rowCol, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      {label ? <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text> : null}
      <TextInput placeholderTextColor={t.muted} {...props} style={[{ color: t.text, fontSize: 16, paddingVertical: 4 }, props.style]} />
    </View>
  );
}

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button({ title, onPress, kind = 'primary', style, disabled, icon }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; style?: StyleProp<ViewStyle>; disabled?: boolean; icon?: IconName }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : t.accentSoft;
  const fg = kind === 'secondary' ? t.accent : kind === 'primary' ? t.accentText : '#fff';
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}>
      {icon ? <Ionicons name={icon} size={19} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

/** Header bar button: an icon (preferred, looks native on iOS) or a short text. */
export function HeaderButton({ title, icon, onPress }: { title?: string; icon?: IconName; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={title} style={{ paddingHorizontal: 6, minWidth: 30, alignItems: 'center' }}>
      {icon ? <Ionicons name={icon} size={22} color={t.accent} /> : <Text style={{ color: t.accent, fontSize: 17, fontWeight: '500' }}>{title}</Text>}
    </Pressable>
  );
}

/** Coloured pill like "20 new". */
export function Chip({ label, color, dim }: { label: string; color: string; dim?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: color + (dim ? '14' : '22') }}>
      <Text style={{ color, fontSize: 13, fontWeight: '600', opacity: dim ? 0.6 : 1 }}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export function Counts({ n, l, r, size = 15 }: { n: number; l: number; r: number; size?: number }) {
  const t = useTheme();
  const s = { fontSize: size, fontWeight: '600' as const, minWidth: size * 1.8, textAlign: 'right' as const, fontVariant: ['tabular-nums' as const] };
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Text style={[s, { color: n ? t.newC : t.muted, opacity: n ? 1 : 0.4 }]}>{n}</Text>
      <Text style={[s, { color: l ? t.learnC : t.muted, opacity: l ? 1 : 0.4 }]}>{l}</Text>
      <Text style={[s, { color: r ? t.reviewC : t.muted, opacity: r ? 1 : 0.4 }]}>{r}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 12, letterSpacing: 0.4, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, gap: 8 },
  rowCol: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  stepBtn: { width: 36, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2 },
  segmentItem: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0 },
  button: { borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
});
