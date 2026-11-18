import { confirm } from '../components/confirm';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CardView } from '../components/CardView';
import { Button, HeaderButton, Row, Section, type IconName } from '../components/ui';
import { addNote, cardsOfNote, deleteNote, moveNote, sortedDecks } from '../lib/collection';
import { htmlToMarkup, markupToHtml } from '../lib/html';
import { videoFromCamera, videoFromFiles, videoFromPhotos } from '../lib/pickVideo';
import { resetCard } from '../lib/scheduler';
import { deleteMedia } from '../lib/storage';
import { useStore, useTheme } from '../lib/store';
import { fmtInterval } from '../lib/util';
import { isUrl, parseVideo, videoToken } from '../lib/video';

type TextInputRef = ComponentRef<typeof TextInput>;

const STATE = ['New', 'Learning', 'Review', 'Relearning'];

/** Splits the sign side's markup into its first video and any other text. */
function splitFront(markup: string): { video: string; extra: string } {
  const m = /\[video:([^\]]+)\]/.exec(markup);
  if (!m) return { video: '', extra: markup };
  return { video: m[1].trim(), extra: (markup.slice(0, m.index) + markup.slice(m.index + m[0].length)).trim() };
}

function joinFront(video: string, extra: string): string {
  return [video ? videoToken(video) : '', extra.trim()].filter(Boolean).join('\n');
}


/** Text box with a small formatting toolbar (bold / italic / underline). */
function MarkupInput({ label, value, onChange, autoFocus, inputRef }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; inputRef?: RefObject<TextInputRef | null> }) {
  const t = useTheme();
  const sel = useRef({ start: value.length, end: value.length });
  const wrap = (mark: string) => {
    const { start, end } = sel.current;
    const inner = value.slice(start, end) || 'text';
    onChange(value.slice(0, start) + mark + inner + mark + value.slice(end));
  };
  const tool = (txt: string, style: object, mark: string) => (
    <Pressable onPress={() => wrap(mark)} hitSlop={6} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: pressed ? t.border : t.bg })}>
      <Text style={[{ color: t.text, fontSize: 15 }, style]}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: t.muted, fontSize: 13, flex: 1 }}>{label.toUpperCase()}</Text>
        {tool('B', { fontWeight: '800' }, '**')}
        {tool('I', { fontStyle: 'italic' }, '*')}
        {tool('U', { textDecorationLine: 'underline' }, '__')}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onSelectionChange={(e) => (sel.current = e.nativeEvent.selection)}
        multiline
        autoFocus={autoFocus}
        placeholder={label}
        placeholderTextColor={t.muted}
        style={{ color: t.text, fontSize: 18, minHeight: 70, textAlignVertical: 'top' }}
      />
    </View>
  );
}

/** Tags of the last card added, kept for the next one while the app is open. */
let lastTags = '';

function SourceButton({ icon, label, onPress, disabled, active }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 12, backgroundColor: active ? t.accent : t.accentSoft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={22} color={active ? t.accentText : t.accent} />
      <Text style={{ color: active ? t.accentText : t.accent, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function Edit() {
  const params = useLocalSearchParams<{ noteId?: string; deckId?: string; info?: string }>();
  const { col, mutate } = useStore();
  const t = useTheme();
  const existing = params.noteId ? col.notes[params.noteId] : undefined;
  const decks = sortedDecks(col);

  const [deckId, setDeckId] = useState(existing?.deckId ?? params.deckId ?? decks[0]?.id);
  const [initial] = useState(() => splitFront(existing ? htmlToMarkup(existing.front) : ''));
  const [video, setVideo] = useState(initial.video);
  const [front, setFront] = useState(initial.extra);
  const [back, setBack] = useState(() => (existing ? htmlToMarkup(existing.back) : ''));
  // New cards keep the last lesson tag, so a whole class unit can be added in one go.
  const [tags, setTags] = useState(() => existing?.tags.join(' ') ?? lastTags);
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const backRef = useRef<TextInputRef>(null);
  const original = useRef({ front: joinFront(initial.video, initial.extra), back });

  const cards = useMemo(() => (existing ? cardsOfNote(col, existing.id) : []), [col, existing]);
  const reviews = useMemo(() => {
    const ids = new Set(cards.map((c) => c.id));
    return col.reviews.filter((r) => ids.has(r.cardId));
  }, [col, cards]);

  if (!deckId) {
    return (
      <View style={{ flex: 1, padding: 24, backgroundColor: t.bg }}>
        <Text style={{ color: t.text }}>Create a deck first.</Text>
      </View>
    );
  }

  const tagList = () => tags.split(/[\s,]+/).filter(Boolean);
  const canSave = video !== '' || front.trim() !== '' || back.trim() !== '';
  const frontMarkup = joinFront(video, front);

  /** Deletes a saved video that was replaced or removed before the card was saved. */
  const dropUnsaved = (name: string) => {
    if (name && !isUrl(name) && name !== initial.video) deleteMedia(name);
  };
  const setVideoFile = (name: string) => {
    dropUnsaved(video);
    setVideo(name);
  };
  const pick = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    try {
      const name = await fn();
      if (name) {
        setVideoFile(name);
        setLinkOpen(false);
        backRef.current?.focus();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const applyLink = () => {
    const url = link.trim();
    const v = isUrl(url) ? parseVideo(url) : null;
    if (!v) return alert('Paste a full link, starting with https://');
    setVideoFile(url);
    setLink('');
    setLinkOpen(false);
    backRef.current?.focus();
  };

  const save = () => {
    if (!canSave) return;
    // Keep the original HTML when a side wasn't touched, so nothing is lost.
    const toHtml = (text: string, orig: string, html?: string) => (html !== undefined && text === orig ? html : markupToHtml(text));
    if (existing) {
      mutate((c) => {
        const n = c.notes[existing.id];
        n.front = toHtml(frontMarkup, original.current.front, existing.front);
        n.back = toHtml(back, original.current.back, existing.back);
        n.tags = tagList();
        n.modifiedAt = Date.now();
        if (deckId !== n.deckId) moveNote(c, n.id, deckId);
      });
      router.back();
    } else {
      mutate((c) => addNote(c, deckId, markupToHtml(frontMarkup), markupToHtml(back), tagList()));
      lastTags = tags;
      setVideo('');
      setFront('');
      setBack('');
      setAdded((a) => a + 1);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: existing ? 'Edit card' : 'Add card',
          headerLeft: () => <HeaderButton title={existing ? 'Cancel' : 'Close'} onPress={() => router.back()} />,
          headerRight: () => <HeaderButton title={existing ? 'Save' : 'Add'} onPress={save} />,
        }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {decks.map((d) => (
          <Pressable key={d.id} onPress={() => setDeckId(d.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: d.id === deckId ? t.accent : t.card }}>
            <Text style={{ color: d.id === deckId ? t.accentText : t.text, fontWeight: '500' }}>{d.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ backgroundColor: t.card, borderRadius: 12, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>SIGN VIDEO</Text>
          {video ? (
            <>
              <View style={{ height: 300, borderRadius: 12, overflow: 'hidden' }}>
                <CardView key={video} question={videoToken(video)} answer={null} settings={{ ...col.settings, fontSize: 16 }} deckCss="" />
              </View>
              {isUrl(video) ? (
                <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={2}>
                  {parseVideo(video)?.kind === 'page' ? 'This site can’t play inside the app — the card will show a button that opens it. ' : 'Plays from the link (needs internet). '}
                  {video}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 16, paddingBottom: 10 }}>
                <Pressable onPress={() => setVideoFile('')} hitSlop={8}>
                  <Text style={{ color: t.danger, fontSize: 15, fontWeight: '600' }}>Remove video</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {!video || busy ? (
            <View style={{ flexDirection: 'row', gap: 8, paddingBottom: linkOpen ? 0 : 12 }}>
              <SourceButton icon="images-outline" label="Photos" onPress={() => pick(videoFromPhotos)} disabled={busy} />
              {Platform.OS !== 'web' ? <SourceButton icon="videocam-outline" label="Camera" onPress={() => pick(videoFromCamera)} disabled={busy} /> : null}
              <SourceButton icon="folder-open-outline" label="Files" onPress={() => pick(videoFromFiles)} disabled={busy} />
              <SourceButton icon="link-outline" label="Link" onPress={() => setLinkOpen((o) => !o)} disabled={busy} active={linkOpen} />
            </View>
          ) : null}
          {busy ? <Text style={{ color: t.muted, fontSize: 13, paddingBottom: 10 }}>Saving video…</Text> : null}
          {linkOpen && !video ? (
            <View style={{ gap: 8, paddingBottom: 12 }}>
              <TextInput
                value={link}
                onChangeText={setLink}
                onSubmitEditing={applyLink}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                placeholder="Paste a YouTube or video link"
                placeholderTextColor={t.muted}
                style={{ color: t.text, fontSize: 16, backgroundColor: t.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
              />
              <Text style={{ color: t.muted, fontSize: 12 }}>
                YouTube links play right on the card (add a start time like ?t=1m05s to jump to the sign). Other sites open in Safari.
              </Text>
              <Button title="Use this link" onPress={applyLink} disabled={!link.trim()} />
            </View>
          ) : null}
        </View>
        <View style={{ height: 1, backgroundColor: t.border, marginLeft: 16 }} />
        <MarkupInput label="English" value={back} onChange={setBack} inputRef={backRef} />
        <View style={{ height: 1, backgroundColor: t.border, marginLeft: 16 }} />
        <MarkupInput label="Notes on the sign (optional)" value={front} onChange={setFront} />
        <View style={{ height: 1, backgroundColor: t.border, marginLeft: 16 }} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 4 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>LESSON / TAGS</Text>
          <TextInput value={tags} onChangeText={setTags} placeholder="e.g. unit3 (space separated)" placeholderTextColor={t.muted} autoCapitalize="none" style={{ color: t.text, fontSize: 16 }} />
        </View>
      </View>

      <Text style={{ color: t.muted, fontSize: 13, paddingHorizontal: 4 }}>
        Notes are shown with the video, e.g. a handshape hint. With “Produce” cards they’re only shown with the answer.
      </Text>

      {!existing ? <Button title="Add card" icon="add" onPress={save} disabled={!canSave || busy} /> : null}

      {!existing && added > 0 && <Text style={{ color: t.reviewC, textAlign: 'center' }}>✓ {added} card{added === 1 ? '' : 's'} added</Text>}

      {existing && (
        <>
          <Section title="Progress">
            {cards.map((c, i) => (
              <Row
                key={c.id}
                label={c.dir === 'forward' ? 'Recognise (sign → English)' : 'Produce (English → sign)'}
                sub={
                  c.s.state === 0
                    ? `New${c.suspended ? ' · suspended' : ''}`
                    : `${STATE[c.s.state]} · due ${new Date(c.s.due).toLocaleDateString()} · interval ${fmtInterval(c.s.scheduledDays * 86_400_000)} · ${c.s.reps} reviews, ${c.s.lapses} lapses${c.suspended ? ' · suspended' : ''}`
                }
                last={i === cards.length - 1}
                right={
                  <Pressable onPress={() => mutate((col2) => { const cc = col2.cards[c.id]; cc.suspended = !cc.suspended; cc.autoSuspended = undefined; })} hitSlop={8}>
                    <Text style={{ color: t.accent }}>{c.suspended ? 'Unsuspend' : 'Suspend'}</Text>
                  </Pressable>
                }
              />
            ))}
          </Section>
          {params.info ? (
            <Section title={`Review history (${reviews.length})`}>
              {reviews.length === 0 ? <Row label="No reviews yet" last /> : null}
              {reviews.slice(-30).reverse().map((r, i, arr) => (
                <Row key={r.at} label={new Date(r.at).toLocaleString()} value={['', 'Again', 'Hard', 'Good', 'Easy'][r.rating]} sub={`${STATE[r.state]} → next in ${r.ivl}d`} last={i === arr.length - 1} />
              ))}
            </Section>
          ) : null}
          <Section>
            <Row label="Reset progress (make new again)" onPress={() => confirm('Reset progress?', 'The card will be treated as new.', 'Reset', () => mutate((c) => cardsOfNote(c, existing.id).forEach(resetCard)))} />
            <Row
              label="Delete card"
              danger
              last
              onPress={() =>
                confirm('Delete this card?', 'This cannot be undone.', 'Delete', () => {
                  mutate((c) => deleteNote(c, existing.id));
                  router.back();
                })
              }
            />
          </Section>
        </>
      )}
    </ScrollView>
  );
}
