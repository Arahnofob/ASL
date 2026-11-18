import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardView } from '../../components/CardView';
import { Button, Chip, HeaderButton } from '../../components/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoalSheet } from '../../components/GoalSheet';
import { ProgressPie } from '../../components/ProgressPie';
import { playSound, stopSound } from '../../lib/audio';
import { soundsIn } from '../../lib/html';
import { videosIn } from '../../lib/video';
import { ALL, MISTAKES, deckCounts, nextCard, type Next } from '../../lib/queue';
import { answerCard, practiceMistake, previewDue, undoAnswer, type UndoEntry } from '../../lib/scheduler';
import { tint, useStore, useTheme } from '../../lib/store';
import type { Card, Collection, Rating } from '../../lib/types';
import { dayKey, fmtInterval } from '../../lib/util';

/** Applies an answer to the collection; returns the undo entry and the answer time. */
function recordAnswer(mutate: (fn: (c: Collection) => void) => void, cardId: string, rating: Rating, shownAt: number) {
  const now = Date.now();
  let undo: UndoEntry | undefined;
  mutate((c) => {
    undo = answerCard(c, c.cards[cardId], rating, now, now - shownAt);
  });
  return { undo: undo!, now };
}

function recordPractice(mutate: (fn: (c: Collection) => void) => void, cardId: string, ok: boolean) {
  const now = Date.now();
  mutate((c) => practiceMistake(c, c.cards[cardId], ok, now));
  return now;
}

const LABELS: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
export default function Study() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { col, mutate } = useStore();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isMistakes = id === MISTAKES;
  // Scopes that span decks: all decks together, or the Mistakes list.
  const isAll = id === ALL || isMistakes;
  const deck = isAll ? undefined : col.decks[id];

  const [cardId, setCardId] = useState<string | null>(null);
  const [nextLearnAt, setNextLearnAt] = useState<number | undefined>();
  /** When the current card was shown (also the clock used for counts). */
  const [shownAt, setShownAt] = useState(() => Date.now());
  /** When the answer was revealed, or null while hidden. */
  const [revealedAt, setRevealedAt] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [goalOpen, setGoalOpen] = useState(false);
  /** Value of `answered` when the current session started ("Continue" starts a new one). */
  const [sessionStart, setSessionStart] = useState(0);
  const sessionSize = col.settings.sessionSize;
  const inSession = answered - sessionStart;
  const lastId = useRef<string | undefined>(undefined);
  const revealed = revealedAt !== null;

  const show = useCallback((n: Next) => {
    setCardId(n.card?.id ?? null);
    setNextLearnAt(n.card ? undefined : n.nextLearnAt);
    setRevealedAt(null);
    setMenu(false);
    setShownAt(Date.now());
  }, []);

  const pick = useCallback(() => show(nextCard(col, id, Date.now(), answered, lastId.current)), [col, id, answered, show]);

  // Pick a card when opening the screen, and again if the current one was deleted/suspended elsewhere.
  useFocusEffect(
    useCallback(() => {
      if (!cardId || !col.cards[cardId] || col.cards[cardId].suspended) pick();
    }, [cardId, col, pick]),
  );

  // When waiting for a learning card, check again once it becomes due.
  useEffect(() => {
    if (cardId || !nextLearnAt) return;
    const ms = Math.max(1000, nextLearnAt - Date.now() - 20 * 60_000);
    const timer = setTimeout(pick, Math.min(ms, 60_000));
    return () => clearTimeout(timer);
  }, [cardId, nextLearnAt, pick]);

  useEffect(
    () => () => {
      stopSound();
    },
    [],
  );

  const card = cardId ? col.cards[cardId] : undefined;
  const note = card ? col.notes[card.noteId] : undefined;
  // Settings come from the card's own deck (matters when studying all decks).
  const cardDeck = card ? col.decks[card.deckId] : undefined;
  const question = note ? (card!.dir === 'forward' ? note.front : note.back) : '';
  const answer = note ? (card!.dir === 'forward' ? note.back : note.front) : '';
  // What to do with this card: name the sign shown, or sign the word yourself.
  const prompt = videosIn(question).length ? 'What does this sign mean?' : videosIn(answer).length ? 'Sign it yourself, then check' : null;

  const autoplay = !!cardDeck?.settings.autoplayAudio;
  const sideHtml = revealed ? answer : question;
  useEffect(() => {
    if (!cardId) return;
    // Nothing should play behind the "Session complete" screen.
    if (sessionSize > 0 && inSession >= sessionSize) return;
    const files = soundsIn(sideHtml);
    if (autoplay && files.length) playSound(files[0]);
    else stopSound();
    // Only re-run when the card or the visible side changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, revealed]);

  const counts = useMemo(() => deckCounts(col, id, shownAt), [col, id, shownAt]);
  // Pie progress: this session (if a size is set), otherwise everything due today.
  const remaining = counts.newCount + counts.learnCount + counts.reviewCount;
  const progressTotal = sessionSize > 0 ? Math.min(sessionSize, inSession + remaining) : answered + remaining;
  const progressDone = sessionSize > 0 ? inSession : answered;
  const due = useMemo(() => (card && cardDeck && revealedAt !== null ? previewDue(card, cardDeck.settings, revealedAt) : null), [card, cardDeck, revealedAt]);

  const reveal = () => setRevealedAt(Date.now());

  const answerWith = (rating: Rating) => {
    if (!card) return;
    if (isMistakes) {
      // Extra practice: doesn't touch the schedule. Anything but "Again" counts as "Got it".
      const at = recordPractice(mutate, card.id, rating !== 1);
      lastId.current = card.id;
      setAnswered(answered + 1);
      show(nextCard(col, id, at, answered + 1, card.id));
      return;
    }
    const { undo: u, now } = recordAnswer(mutate, card.id, rating, shownAt);
    setUndoStack((s) => [...s.slice(-49), u]);
    lastId.current = card.id;
    setAnswered(answered + 1);
    show(nextCard(col, id, now, answered + 1, card.id));
  };

  const undo = () => {
    const u = undoStack[undoStack.length - 1];
    if (!u) return;
    mutate((c) => undoAnswer(c, u));
    setUndoStack((s) => s.slice(0, -1));
    setAnswered((a) => Math.max(0, a - 1));
    show({ card: col.cards[u.cardId] });
  };

  const hideCard = (fn: (c: Card) => void) => {
    if (!card) return;
    mutate((c) => fn(c.cards[card.id]));
    lastId.current = card.id;
    show(nextCard(col, id, Date.now(), answered, card.id));
  };
  const bury = () => hideCard((c) => (c.buriedUntil = dayKey(Date.now(), col.settings.dayStartHour)));
  const suspend = () => hideCard((c) => (c.suspended = true));

  if (!deck && !isAll) return null;

  const header = (
    <Stack.Screen
      options={{
        title: isMistakes ? 'Mistakes' : isAll ? 'All decks' : (deck?.name ?? ''),
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {undoStack.length > 0 && <HeaderButton icon="arrow-undo" title="Undo" onPress={undo} />}
            {card && <HeaderButton icon="ellipsis-horizontal" title="More" onPress={() => setMenu((m) => !m)} />}
          </View>
        ),
      }}
    />
  );

  const goalSheet = <GoalSheet visible={goalOpen} onClose={() => setGoalOpen(false)} scope={id} />;

  // Session finished: short break screen, then continue or stop.
  if (card && note && sessionSize > 0 && inSession >= sessionSize) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: 'center', gap: 16 }}>
        {header}
        {goalSheet}
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', textAlign: 'center' }}>Session complete 🎉</Text>
        <Text style={{ color: t.muted, fontSize: 16, textAlign: 'center', lineHeight: 22 }}>
          You studied {inSession} cards. {counts.newCount + counts.learnCount + counts.reviewCount} left for today.
        </Text>
        <Button title={`Continue · ${sessionSize} more`} icon="play" onPress={() => setSessionStart(answered)} />
        <Button title="Done for now" kind="secondary" onPress={() => router.back()} />
        <Pressable onPress={() => setGoalOpen(true)} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={{ color: t.accent, fontSize: 15, fontWeight: '600' }}>Change session size</Text>
        </Pressable>
      </View>
    );
  }

  if (!card || !note) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: 'center', gap: 16 }}>
        {header}
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', textAlign: 'center' }}>🎉 Well done!</Text>
        <Text style={{ color: t.muted, fontSize: 16, textAlign: 'center', lineHeight: 22 }}>
          {nextLearnAt
            ? `You've finished for now. ${counts.learnCount} learning card${counts.learnCount === 1 ? '' : 's'} will be ready in ${fmtInterval(nextLearnAt - shownAt)}.`
            : `You've finished ${isMistakes ? 'practising your mistakes for today' : isAll ? 'your daily goal' : 'this deck for today'}${answered ? ` — ${answered} card${answered === 1 ? '' : 's'} studied` : ''}.`}
        </Text>
        <Button title={isAll ? 'Back home' : 'Back to deck'} onPress={() => router.back()} />
      </View>
    );
  }

  const ratingColor: Record<Rating, string> = { 1: t.again, 2: t.hard, 3: t.good, 4: t.easy };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 50} style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      {goalSheet}
      {prompt && !revealed ? <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', textAlign: 'center', paddingBottom: 6 }}>{prompt}</Text> : null}
      {isAll && cardDeck ? <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center', paddingBottom: 6 }}>{cardDeck.name}</Text> : null}
      <Pressable
        onPress={() => setGoalOpen(true)}
        accessibilityLabel="Change daily goal and session size"
        style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 10, opacity: pressed ? 0.6 : 1 })}
      >
        {isMistakes && <Chip label={`${counts.learnCount} to practise`} color={t.again} dim={!counts.learnCount} />}
        {col.settings.showRemaining && !isMistakes && (
          <>
            <Chip label={`${counts.newCount} new`} color={t.newC} dim={!counts.newCount} />
            <Chip label={`${counts.learnCount} learning`} color={t.learnC} dim={!counts.learnCount} />
            <Chip label={`${counts.reviewCount} review`} color={t.reviewC} dim={!counts.reviewCount} />
          </>
        )}
        <ProgressPie done={progressDone} total={progressTotal} />
        <Ionicons name="options-outline" size={18} color={t.muted} />
      </Pressable>
      {menu && (
        <View style={[styles.menu, { backgroundColor: t.card, borderColor: t.border }]}>
          <MenuItem label="Edit" onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { noteId: note.id } }); }} />
          <MenuItem label="Bury (hide until tomorrow)" onPress={bury} />
          <MenuItem label="Suspend (hide until unsuspended)" onPress={suspend} />
          <MenuItem label="Card info" onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { noteId: note.id, info: '1' } }); }} />
        </View>
      )}
      <View style={[styles.cardWrap, { backgroundColor: t.card, shadowColor: t.dark ? '#000' : '#1E2D6B' }]}>
        <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden' }}>
          <CardView
            question={question}
            answer={revealed ? answer : null}
            settings={col.settings}
            deckCss={cardDeck?.settings.css ?? ''}
            onTap={() => (menu ? setMenu(false) : !revealed && reveal())}
            onSound={playSound}
          />
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
        {!revealed ? <Button title="Show answer" icon="eye-outline" onPress={reveal} style={{ paddingVertical: 18, borderRadius: 16 }} /> : null}
        {!revealed ? null : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(isMistakes ? [1, 3] : [1, 2, 3, 4]).map((n) => n as Rating).map((r) => (
              <Pressable
                key={r}
                onPress={() => answerWith(r)}
                style={({ pressed }) => [
                  styles.grade,
                  { backgroundColor: tint(ratingColor[r], t.dark ? 0.2 : 0.12), opacity: pressed ? 0.6 : 1 },
                ]}
              >
                {col.settings.showIntervals && due && !isMistakes ? <Text style={{ color: ratingColor[r], fontSize: 13, opacity: 0.8 }}>{fmtInterval(due[r] - (revealedAt ?? shownAt))}</Text> : null}
                <Text style={{ color: ratingColor[r], fontSize: 17, fontWeight: '700' }}>{isMistakes && r === 3 ? 'Got it' : LABELS[r]}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, { borderBottomColor: t.border, backgroundColor: pressed ? t.border : 'transparent' }]}>
      <Text style={{ color: t.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grade: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 2 },
  cardWrap: { flex: 1, marginHorizontal: 14, borderRadius: 24, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  menu: { position: 'absolute', top: 4, right: 12, zIndex: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', minWidth: 260, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
