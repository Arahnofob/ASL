import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HeaderButton, Segmented } from '../components/ui';
import { cardsOfNote } from '../lib/collection';
import { plainText } from '../lib/html';
import { useNow, useStore, useTheme } from '../lib/store';
import type { Note } from '../lib/types';
import { fmtInterval } from '../lib/util';

type Filter = 'all' | 'new' | 'due' | 'suspended';

export default function Browse() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { col } = useStore();
  const now = useNow();
  const t = useTheme();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const index = useMemo(() => {
    const byNote = new Map<string, { suspended: boolean; isNew: boolean; due: number }>();
    for (const c of Object.values(col.cards)) {
      const e = byNote.get(c.noteId) ?? { suspended: true, isNew: true, due: Infinity };
      e.suspended = e.suspended && !!c.suspended;
      e.isNew = e.isNew && c.s.state === 0;
      if (!c.suspended && c.s.state !== 0) e.due = Math.min(e.due, c.s.due);
      byNote.set(c.noteId, e);
    }
    return Object.values(col.notes)
      .filter((n) => !deckId || n.deckId === deckId)
      .map((n) => ({ note: n, front: plainText(n.front), back: plainText(n.back), meta: byNote.get(n.id) }))
      .sort((a, b) => a.note.createdAt - b.note.createdAt);
  }, [col, deckId]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return index.filter((r) => {
      if (needle && !(r.front.toLowerCase().includes(needle) || r.back.toLowerCase().includes(needle) || r.note.tags.some((x) => x.toLowerCase().includes(needle)))) return false;
      if (filter === 'new') return r.meta?.isNew && !r.meta.suspended;
      if (filter === 'due') return r.meta && r.meta.due <= now + 86_400_000;
      if (filter === 'suspended') return r.meta?.suspended;
      return true;
    });
  }, [index, q, filter, now]);

  const deckName = deckId ? col.decks[deckId]?.name : undefined;

  const describe = (n: Note) => {
    const cards = cardsOfNote(col, n.id);
    if (cards.every((c) => c.suspended)) return 'suspended';
    const active = cards.filter((c) => !c.suspended);
    if (active.every((c) => c.s.state === 0)) return 'new';
    const next = Math.min(...active.filter((c) => c.s.state !== 0).map((c) => c.s.due));
    const diff = next - now;
    return diff <= 0 ? 'due now' : `due in ${fmtInterval(diff)}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: deckName ?? 'All cards',
          headerRight: () => <HeaderButton icon="add" title="Add card" onPress={() => router.push({ pathname: '/edit', params: deckId ? { deckId } : {} })} />,
        }}
      />
      <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 10 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={t.muted}
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={{ backgroundColor: t.card, color: t.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16 }}
        />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'new', label: 'New' },
            { value: 'due', label: 'Due' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <Text style={{ color: t.muted, fontSize: 13 }}>{rows.length} cards</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.note.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/edit', params: { noteId: item.note.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.border : t.card, borderBottomColor: t.border }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.text, fontSize: 16 }} numberOfLines={2}>
                {item.front || '—'}
              </Text>
              <Text style={{ color: t.muted, fontSize: 14 }} numberOfLines={1}>
                {item.back}
              </Text>
            </View>
            <Text style={{ color: t.muted, fontSize: 12 }}>{describe(item.note)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
