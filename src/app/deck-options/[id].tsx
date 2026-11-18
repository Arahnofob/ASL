import { confirm } from '../../components/confirm';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { NameModal } from '../../components/NameModal';
import { Row, Section, SegmentRow, Screen, Stepper, SwitchRow } from '../../components/ui';
import { applyDirections, deleteDeck } from '../../lib/collection';
import { parseSteps, resetCard } from '../../lib/scheduler';
import { useStore, useTheme } from '../../lib/store';
import type { DeckSettings, DirectionsSetting } from '../../lib/types';


function StepsField({ label, value, onSave, sub, last }: { label: string; value: string; onSave: (v: string) => void; sub: string; last?: boolean }) {
  const t = useTheme();
  const [text, setText] = useState(value);
  const valid = parseSteps(text) !== null && text.trim() !== '';
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 4, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: t.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>{label}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={() => (valid ? onSave(text.trim().split(/[\s,]+/).join(' ')) : setText(value))}
          onBlur={() => (valid ? onSave(text.trim().split(/[\s,]+/).join(' ')) : setText(value))}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ color: valid ? t.text : t.danger, fontSize: 16, minWidth: 120, textAlign: 'right' }}
        />
      </View>
      <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text>
    </View>
  );
}

export default function DeckOptions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { col, mutate } = useStore();
  const t = useTheme();
  const deck = col.decks[id];
  const [renaming, setRenaming] = useState(false);
  const [css, setCss] = useState(deck?.settings.css ?? '');
  if (!deck) return null;
  const s = deck.settings;
  const set = <K extends keyof DeckSettings>(k: K, v: DeckSettings[K]) =>
    mutate((c) => {
      c.decks[id].settings[k] = v;
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Deck options' }} />

      <Section>
        <Row label="Name" value={deck.name} onPress={() => setRenaming(true)} last />
      </Section>

      <Section title="Daily limits for this deck" footer="The daily goal for all decks (Settings → Daily goal) also applies, so adding decks doesn’t add more cards per day.">
        <Stepper label="New cards / day" value={s.newPerDay} step={5} max={9999} onChange={(v) => set('newPerDay', v)} />
        <Stepper label="Max reviews / day" value={s.reviewsPerDay} step={50} max={99999} onChange={(v) => set('reviewsPerDay', v)} last />
      </Section>

      <Section title="Cards" footer="Recognise: watch the sign, recall the English. Produce: see the English, sign it yourself, then check the video. Switching later keeps progress — unused cards are just suspended.">
        <SegmentRow<DirectionsSetting>
          label="Practise"
          value={s.directions}
          onChange={(v) => mutate((c) => applyDirections(c, id, v))}
          options={[
            { value: 'forward', label: 'Recognise' },
            { value: 'reverse', label: 'Produce' },
            { value: 'both', label: 'Both' },
          ]}
        />
        <SegmentRow
          label="New card order"
          value={s.newOrder}
          onChange={(v) => set('newOrder', v)}
          options={[
            { value: 'added', label: 'In order added' },
            { value: 'random', label: 'Random' },
          ]}
        />
        <SegmentRow
          label="Show new cards"
          value={s.newMix}
          onChange={(v) => set('newMix', v)}
          options={[
            { value: 'mixed', label: 'Mixed' },
            { value: 'after', label: 'After reviews' },
            { value: 'before', label: 'Before' },
          ]}
        />
        <SwitchRow label="Play audio automatically" value={s.autoplayAudio} onChange={(v) => set('autoplayAudio', v)} last />
      </Section>

      <Section title="Scheduling (FSRS)" footer="Higher retention = you remember more but see cards more often. 90% is a good default.">
        <Stepper label="Desired retention" value={s.retention} step={0.01} min={0.7} max={0.99} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('retention', v)} />
        <StepsField label="Learning steps" value={s.learningSteps} onSave={(v) => set('learningSteps', v)} sub="Delays for new cards before they graduate, e.g. 1m 10m (m/h/d)." />
        <StepsField label="Relearning steps" value={s.relearningSteps} onSave={(v) => set('relearningSteps', v)} sub="Delays after pressing Again on a review card." />
        <Stepper label="Maximum interval (days)" value={s.maxIntervalDays} step={30} min={1} max={36500} onChange={(v) => set('maxIntervalDays', v)} />
        <SwitchRow label="Add a little randomness" sub="Spreads out cards so they don't all come due together." value={s.fuzz} onChange={(v) => set('fuzz', v)} last />
      </Section>

      <Section title="Card style (CSS)" footer="Advanced: CSS for this deck’s cards, e.g.  .a { color: #c2255c }  or  body { font-family: Georgia }">
        <TextInput
          value={css}
          onChangeText={setCss}
          onBlur={() => set('css', css)}
          onEndEditing={() => set('css', css)}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="/* custom CSS */"
          placeholderTextColor={t.muted}
          style={{ color: t.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14, minHeight: 90, padding: 16, textAlignVertical: 'top' }}
        />
      </Section>

      <Section title="Danger zone">
        <Row
          label="Reset progress of all cards"
          onPress={() =>
            confirm('Reset all progress?', 'Every card in this deck becomes new again.', 'Reset', () =>
              mutate((c) => {
                for (const card of Object.values(c.cards)) if (card.deckId === id) resetCard(card);
                c.reviews = c.reviews.filter((r) => r.deckId !== id);
              }),
            )
          }
        />
        <Row
          label="Delete deck"
          danger
          last
          onPress={() =>
            confirm(`Delete “${deck.name}”?`, 'All its cards and history will be deleted. This cannot be undone.', 'Delete', () => {
              router.dismissTo('/');
              setTimeout(() => mutate((c) => deleteDeck(c, id)), 50);
            })
          }
        />
      </Section>

      <NameModal
        visible={renaming}
        title="Rename deck"
        initial={deck.name}
        onCancel={() => setRenaming(false)}
        onSubmit={(name) => {
          setRenaming(false);
          mutate((c) => {
            c.decks[id].name = name;
          });
        }}
      />
    </Screen>
  );
}
