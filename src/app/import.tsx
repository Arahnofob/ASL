import * as DocumentPicker from 'expo-document-picker';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { confirm } from '../components/confirm';
import { Button, HeaderButton, Section, SegmentRow, Screen, SwitchRow } from '../components/ui';
import { addNote, createDeck, noteKey, sortedDecks } from '../lib/collection';
import { readImportFile, type ImportResult } from '../lib/importers';
import { hasMedia, readPickedFile, saveMedia } from '../lib/storage';
import { useStore, useTheme } from '../lib/store';
import type { DirectionsSetting } from '../lib/types';
import { plural } from '../lib/util';

interface DeckChoice {
  name: string;
  /** '' = create a new deck */
  target: string;
  directions: DirectionsSetting;
}

export default function Import() {
  const { col, mutate, replace } = useStore();
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [choices, setChoices] = useState<DeckChoice[]>([]);
  const [skipDupes, setSkipDupes] = useState(true);
  const [done, setDone] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    setDone(null);
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setBusy(true);
    try {
      const bytes = await readPickedFile(asset.uri);
      const r = readImportFile(asset.name, bytes);
      setFileName(asset.name);
      setResult(r);
      if (r.kind === 'decks') setChoices(r.decks.map((d) => ({ name: d.name, target: '', directions: d.directions })));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = () => {
    if (!result) return;
    if (result.kind === 'backup') {
      confirm('Restore this backup?', 'Everything currently in the app will be replaced by the backup.', 'Restore', () => {
        for (const [name, bytes] of Object.entries(result.media)) saveMedia(name, bytes);
        replace(result.collection);
        router.dismissTo('/');
      });
      return;
    }
    setBusy(true);
    setTimeout(() => {
      try {
        let added = 0;
        let skipped = 0;
        for (const [name, bytes] of Object.entries(result.media)) if (!hasMedia(name)) saveMedia(name, bytes);
        mutate((c) => {
          result.decks.forEach((d, i) => {
            const ch = choices[i];
            const deck = ch.target && c.decks[ch.target] ? c.decks[ch.target] : createDeck(c, ch.name, { directions: ch.directions });
            const seen = new Set<string>();
            if (skipDupes) for (const n of Object.values(c.notes)) if (n.deckId === deck.id) seen.add(noteKey(n.front, n.back));
            let order = Math.max(0, ...Object.values(c.cards).filter((x) => x.deckId === deck.id).map((x) => x.order));
            for (const n of d.notes) {
              const key = noteKey(n.front, n.back);
              if (skipDupes && seen.has(key)) {
                skipped++;
                continue;
              }
              seen.add(key);
              addNote(c, deck.id, n.front, n.back, n.tags, ++order);
              added++;
            }
          });
        });
        setDone(`Imported ${plural(added, 'card')}${skipped ? ` (${skipped} duplicates skipped)` : ''}.`);
        setResult(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const decks = sortedDecks(col);
  const setChoice = (i: number, patch: Partial<DeckChoice>) => setChoices((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Screen>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Close" onPress={() => router.back()} /> }} />

      {!result && (
        <Section title="Supported files">
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>
              • <Text style={{ fontWeight: '600' }}>AnkiApp</Text> export (.zip or .xml) — open the deck in AnkiApp → Export → XML, save to Files.{'\n'}• <Text style={{ fontWeight: '600' }}>Text / CSV</Text> — one card per line: front, back, tags (tab, comma or semicolon separated). A video link as the front becomes the sign, e.g.  https://youtu.be/abc?t=30, mother, unit3{'\n'}• <Text style={{ fontWeight: '600' }}>Backups</Text> made by this app.
            </Text>
          </View>
        </Section>
      )}

      {done && (
        <View style={{ backgroundColor: t.card, borderRadius: 12, padding: 16, gap: 12 }}>
          <Text style={{ color: t.reviewC, fontSize: 17, fontWeight: '600' }}>✓ {done}</Text>
          <Button title="Go to decks" onPress={() => router.dismissTo('/')} />
        </View>
      )}

      {error && <Text style={{ color: t.danger, fontSize: 15 }}>{error}</Text>}

      {busy && <ActivityIndicator size="large" />}

      {!busy && !result && <Button title={done ? 'Import another file' : 'Choose file'} kind={done ? 'secondary' : 'primary'} onPress={pick} />}

      {!busy && result?.kind === 'backup' && (
        <>
          <Section title={`Backup: ${fileName}`}>
            <View style={{ padding: 16 }}>
              <Text style={{ color: t.text, fontSize: 15 }}>
                {Object.keys(result.collection.decks).length} decks · {Object.keys(result.collection.notes).length} notes · {result.collection.reviews.length} reviews · {Object.keys(result.media).length} media files
              </Text>
            </View>
          </Section>
          <Button title="Restore backup" kind="danger" onPress={doImport} />
          <Button title="Cancel" kind="secondary" onPress={() => setResult(null)} />
        </>
      )}

      {!busy && result?.kind === 'decks' && (
        <>
          <Text style={{ color: t.muted, fontSize: 14 }}>
            {fileName} · {result.source} · {Object.keys(result.media).length} media files
          </Text>
          {result.decks.map((d, i) => (
            <Section key={i} title={plural(d.notes.length, 'card')}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 4, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
                <Text style={{ color: t.muted, fontSize: 13 }}>Import into</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[{ id: '', name: '＋ New deck' }, ...decks].map((dk) => (
                    <Pressable key={dk.id} onPress={() => setChoice(i, { target: dk.id })} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: choices[i]?.target === dk.id ? t.accent : t.bg }}>
                      <Text style={{ color: choices[i]?.target === dk.id ? t.accentText : t.text }}>{dk.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {choices[i]?.target === '' && (
                <>
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 4, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
                    <Text style={{ color: t.muted, fontSize: 13 }}>Deck name</Text>
                    <TextInput value={choices[i].name} onChangeText={(v) => setChoice(i, { name: v })} style={{ color: t.text, fontSize: 17 }} />
                  </View>
                  <SegmentRow<DirectionsSetting>
                    label="Study direction"
                    value={choices[i].directions}
                    onChange={(v) => setChoice(i, { directions: v })}
                    options={[
                      { value: 'forward', label: 'Front → Back' },
                      { value: 'reverse', label: 'Back → Front' },
                      { value: 'both', label: 'Both' },
                    ]}
                    last
                  />
                </>
              )}
            </Section>
          ))}
          <Section>
            <SwitchRow label="Skip cards that already exist" value={skipDupes} onChange={setSkipDupes} last />
          </Section>
          {result.warnings.length > 0 && <Text style={{ color: t.muted, fontSize: 13 }}>{result.warnings.slice(0, 5).join('\n')}</Text>}
          <Button title="Import" onPress={doImport} />
          <Button title="Cancel" kind="secondary" onPress={() => setResult(null)} />
        </>
      )}
    </Screen>
  );
}
