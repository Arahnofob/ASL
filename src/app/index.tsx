import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NameModal } from '../components/NameModal';
import { Chip, ProgressBar, type IconName } from '../components/ui';
import { createDeck, sortedDecks } from '../lib/collection';
import { ALL, MISTAKES, buildQueue, mistakeCards } from '../lib/queue';
import { deckProgress, estimateMinutes, streakDays } from '../lib/stats';
import { useNow, useStore, useTheme, type Theme } from '../lib/store';
import { dayStart, plural } from '../lib/util';

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

function greeting(now: number) {
  const h = new Date(now).getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { col, mutate } = useStore();
  const t = useTheme();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const [naming, setNaming] = useState(false);

  // One queue for all decks (shared daily goal); each deck shows its share of it.
  const allQ = useMemo(() => buildQueue(col, ALL, now), [col, now]);
  const decks = useMemo(() => {
    const share = (list: { deckId: string }[], id: string) => list.filter((c) => c.deckId === id).length;
    return sortedDecks(col).map((d) => ({
      deck: d,
      counts: { newCount: share(allQ.news, d.id), learnCount: share(allQ.learnNow, d.id) + share(allQ.learnLater, d.id), reviewCount: share(allQ.reviews, d.id) },
    }));
  }, [col, allQ]);
  const progress = useMemo(() => deckProgress(col), [col]);
  const mistakes = useMemo(() => ({ total: mistakeCards(col, now).length, today: mistakeCards(col, now, true).length }), [col, now]);
  const streak = useMemo(() => streakDays(col, now), [col, now]);
  const today = useMemo(() => {
    const start = dayStart(now, col.settings.dayStartHour);
    let n = 0;
    for (let i = col.reviews.length - 1; i >= 0 && col.reviews[i].at >= start; i--) n++;
    return n;
  }, [col, now]);

  // Today's total across all decks, with the shared daily goal applied.
  const due = allQ.news.length + allQ.learnNow.length + allQ.learnLater.length + allQ.reviews.length;
  const firstDue = decks.find((d) => d.counts.newCount + d.counts.learnCount + d.counts.reviewCount > 0);
  const study = (id: string) => router.push({ pathname: '/study/[id]', params: { id } });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false, title: 'Mano' }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 18 }}>
        {/* Title row */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.muted, fontSize: 15 }}>{greeting(now)} 🤟</Text>
            <Text style={{ color: t.text, fontSize: 34, fontWeight: '700', fontFamily: SERIF }}>Mano</Text>
          </View>
          <RoundButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>

        {/* Hero: what to do now */}
        {decks.length === 0 ? (
          <View style={[styles.hero, { backgroundColor: t.hero }]}>
            <FlagStripe />
            <Text style={[styles.heroTitle, { color: t.heroText }]}>Welcome!</Text>
            <Text style={{ color: t.heroText, opacity: 0.85, fontSize: 16, lineHeight: 22 }}>
              Make a deck for your class — one per unit works well — then add each new sign with its video.
            </Text>
            <HeroButton icon="add-circle-outline" title="Create a deck" onPress={() => setNaming(true)} t={t} />
            <Pressable onPress={() => router.push('/import')} hitSlop={8}>
              <Text style={{ color: t.heroText, textAlign: 'center', fontSize: 16, fontWeight: '600', opacity: 0.9 }}>or import cards / restore a backup</Text>
            </Pressable>
          </View>
        ) : due > 0 && firstDue ? (
          <View style={[styles.hero, { backgroundColor: t.hero }]}>
            <FlagStripe />
            <Text style={{ color: t.heroText, opacity: 0.8, fontSize: 15, fontWeight: '600' }}>TODAY</Text>
            <Text style={[styles.heroTitle, { color: t.heroText }]}>{plural(due, 'card')} to study</Text>
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              <HeroStat icon="time-outline" text={`≈ ${estimateMinutes(due)} min`} t={t} />
              <HeroStat icon="flame-outline" text={streak ? `${streak}-day streak` : 'Start a streak!'} t={t} />
              {today > 0 && <HeroStat icon="checkmark-circle-outline" text={`${today} done today`} t={t} />}
            </View>
            <HeroButton icon="play" title={decks.length > 1 ? 'Study all decks' : 'Start studying'} onPress={() => study(decks.length > 1 ? ALL : firstDue.deck.id)} t={t} />
            <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ color: t.heroText, opacity: 0.85, fontSize: 14 }}>
                Daily goal: {col.settings.dailyNew} new cards · <Text style={{ textDecorationLine: 'underline' }}>change</Text>
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.hero, { backgroundColor: t.hero }]}>
            <FlagStripe />
            <Text style={[styles.heroTitle, { color: t.heroText }]}>All done for today 🎉</Text>
            <Text style={{ color: t.heroText, opacity: 0.85, fontSize: 16 }}>
              {today ? `You studied ${plural(today, 'card')} today.` : 'Nothing due right now.'} {streak ? `🔥 ${streak}-day streak.` : ''}
            </Text>
            <HeroButton icon="add-circle-outline" title="Learn more new cards" onPress={() => router.push({ pathname: '/deck/[id]', params: { id: decks[0].deck.id } })} t={t} />
          </View>
        )}

        {/* Decks */}
        {decks.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: t.text, fontSize: 20, fontWeight: '700' }}>Your decks</Text>
              <Pressable onPress={() => setNaming(true)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="add" size={20} color={t.accent} />
                <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>New deck</Text>
              </Pressable>
            </View>
            {decks.map(({ deck, counts }) => {
              const p = progress[deck.id] ?? { total: 0, seen: 0, mature: 0 };
              const dueHere = counts.newCount + counts.learnCount + counts.reviewCount;
              return (
                <Pressable
                  key={deck.id}
                  onPress={() => router.push({ pathname: '/deck/[id]', params: { id: deck.id } })}
                  style={({ pressed }) => [styles.deck, { backgroundColor: t.card, opacity: pressed ? 0.85 : 1, shadowColor: t.dark ? '#000' : '#1E2D6B' }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
                        {deck.name}
                      </Text>
                      <Text style={{ color: t.muted, fontSize: 13 }}>
                        {p.total} cards · {p.total ? Math.round((p.seen / p.total) * 100) : 0}% started
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => (dueHere ? study(deck.id) : router.push({ pathname: '/deck/[id]', params: { id: deck.id } }))}
                      hitSlop={6}
                      accessibilityLabel={`Study ${deck.name}`}
                      style={({ pressed }) => [styles.play, { backgroundColor: dueHere ? t.accent : t.accentSoft, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Ionicons name={dueHere ? 'play' : 'checkmark'} size={22} color={dueHere ? t.accentText : t.accent} style={{ marginLeft: dueHere ? 3 : 0 }} />
                    </Pressable>
                  </View>
                  <ProgressBar value={p.total ? p.seen / p.total : 0} color={t.reviewC} />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Chip label={`${counts.newCount} new`} color={t.newC} dim={!counts.newCount} />
                    <Chip label={`${counts.learnCount} learning`} color={t.learnC} dim={!counts.learnCount} />
                    <Chip label={`${counts.reviewCount} to review`} color={t.reviewC} dim={!counts.reviewCount} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Automatic list of recently missed cards */}
        {mistakes.total > 0 && (
          <Pressable
            onPress={() => mistakes.today > 0 && study(MISTAKES)}
            style={({ pressed }) => [styles.deck, { backgroundColor: t.card, opacity: pressed ? 0.85 : 1, shadowColor: t.dark ? '#000' : '#1E2D6B' }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.again + '1F', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="refresh" size={22} color={t.again} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Mistakes</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  {plural(mistakes.total, 'card')} you missed recently{mistakes.today ? '' : ' · practised today ✓'}
                </Text>
              </View>
              <View style={[styles.play, { backgroundColor: mistakes.today ? t.again : t.accentSoft }]}>
                <Ionicons name={mistakes.today ? 'play' : 'checkmark'} size={22} color={mistakes.today ? '#fff' : t.accent} style={{ marginLeft: mistakes.today ? 3 : 0 }} />
              </View>
            </View>
            <Text style={{ color: t.muted, fontSize: 12 }}>Extra practice — it doesn’t change your schedule. A card leaves the list after you get it right twice.</Text>
          </Pressable>
        )}

        {/* Quick actions */}
        {decks.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Tile icon="add-circle" label="Add card" color={t.accent} onPress={() => router.push('/edit')} />
            <Tile icon="search" label="Browse" color={t.reviewC} onPress={() => router.push('/browse')} />
            <Tile icon="stats-chart" label="Statistics" color={t.learnC} onPress={() => router.push('/stats')} />
            <Tile icon="download" label="Import" color={t.red} onPress={() => router.push('/import')} />
          </View>
        )}
      </ScrollView>

      <NameModal
        visible={naming}
        title="New deck"
        confirm="Create"
        onCancel={() => setNaming(false)}
        onSubmit={(name) => {
          setNaming(false);
          mutate((c) => createDeck(c, name));
        }}
      />
    </View>
  );
}

function FlagStripe() {
  return (
    <View style={{ flexDirection: 'row', width: 42, height: 6, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ flex: 1, backgroundColor: '#5FD3C1' }} />
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
      <View style={{ flex: 1, backgroundColor: '#F2B544' }} />
    </View>
  );
}

function HeroStat({ icon, text, t }: { icon: IconName; text: string; t: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={17} color={t.heroText} style={{ opacity: 0.85 }} />
      <Text style={{ color: t.heroText, fontSize: 15, opacity: 0.9 }}>{text}</Text>
    </View>
  );
}

function HeroButton({ icon, title, onPress, t }: { icon: IconName; title: string; onPress: () => void; t: Theme }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroBtn, { opacity: pressed ? 0.8 : 1 }]}>
      <Ionicons name={icon} size={20} color={t.dark ? '#1E2D6B' : t.hero} />
      <Text style={{ color: t.dark ? '#1E2D6B' : t.hero, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.round, { backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={22} color={t.text} />
    </Pressable>
  );
}

function Tile({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: t.card, opacity: pressed ? 0.8 : 1 }]}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: 20, gap: 10 },
  heroTitle: { fontSize: 28, fontWeight: '700' },
  deck: { borderRadius: 20, padding: 16, gap: 12, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroBtn: { marginTop: 6, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: 18, padding: 14, gap: 10 },
});
