import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import { confirm } from '../components/confirm';
import { Row, Section, SegmentRow, Screen, Stepper, SwitchRow } from '../components/ui';
import { backupFileName, buildBackup, unusedMedia } from '../lib/backup';
import { allowReminders } from '../lib/reminders';
import { deleteMedia, listMedia, writeTempFile } from '../lib/storage';
import { useStore, useTheme } from '../lib/store';
import type { AppSettings } from '../lib/types';

export default function Settings() {
  const { col, mutate, flush } = useStore();
  const t = useTheme();
  const s = col.settings;
  const [css, setCss] = useState(s.globalCss);
  const [busy, setBusy] = useState(false);
  // Raising the overall goal also lifts per-deck limits that would otherwise hold it back.
  const setGoal = (key: 'dailyNew' | 'dailyReviews', deckKey: 'newPerDay' | 'reviewsPerDay', v: number) =>
    mutate((c) => {
      c.settings[key] = v;
      for (const d of Object.values(c.decks)) if (d.settings[deckKey] < v) d.settings[deckKey] = v;
    });
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    mutate((c) => {
      c.settings[k] = v;
    });

  const backup = async () => {
    setBusy(true);
    try {
      flush();
      const bytes = buildBackup(col);
      const uri = writeTempFile(backupFileName(), bytes);
      if (Platform.OS !== 'web') await Sharing.shareAsync(uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: 'Save backup' });
    } catch (e) {
      alert(`Backup failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const cleanMedia = () => {
    const unused = unusedMedia(col);
    if (!unused.length) return alert('No unused media files.');
    confirm('Delete unused media?', `${unused.length} video/audio/image files aren't used by any card.`, 'Delete', () => unused.forEach(deleteMedia));
  };

  const counts = { decks: Object.keys(col.decks).length, notes: Object.keys(col.notes).length, cards: Object.keys(col.cards).length, reviews: col.reviews.length };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Settings' }} />

      <Section title="Daily goal" footer="Shared by all decks — adding a new deck doesn’t add more cards to your day. Each deck can also have its own lower limit in Deck options.">
        <Stepper label="New cards per day" sub="All decks together" value={s.dailyNew} step={5} max={500} onChange={(v) => setGoal('dailyNew', 'newPerDay', v)} />
        <Stepper label="Max reviews per day" sub="All decks together" value={s.dailyReviews} step={50} max={9999} onChange={(v) => setGoal('dailyReviews', 'reviewsPerDay', v)} />
        <SegmentRow
          label="Cards per session"
          sub="Take a break after this many cards — you can always continue."
          value={String(s.sessionSize) as '10' | '20' | '30' | '50' | '0'}
          onChange={(v) => set('sessionSize', Number(v))}
          options={[
            { value: '10', label: '10' },
            { value: '20', label: '20' },
            { value: '30', label: '30' },
            { value: '50', label: '50' },
            { value: '0', label: 'All' },
          ]}
          last
        />
      </Section>

      <Section title="Daily reminder" footer="A notification at this time if you still have cards to study. It shows how many are waiting and your streak.">
        <SwitchRow
          label="Remind me to study"
          value={s.reminderOn}
          onChange={async (v) => {
            if (v && !(await allowReminders())) return alert('Notifications are turned off for Mano. Allow them in iPhone Settings → Notifications → Mano, then try again.');
            set('reminderOn', v);
          }}
          last={!s.reminderOn}
        />
        {s.reminderOn && (
          <>
            <Stepper label="Hour" value={s.reminderHour} min={0} max={23} format={(v) => `${v}:${String(s.reminderMinute).padStart(2, '0')}`} onChange={(v) => set('reminderHour', v)} />
            <Stepper label="Minutes" value={s.reminderMinute} step={5} min={0} max={55} format={(v) => String(v).padStart(2, '0')} onChange={(v) => set('reminderMinute', v)} last />
          </>
        )}
      </Section>

      <Section title="Appearance">
        <SegmentRow
          label="Theme"
          value={s.theme}
          onChange={(v) => set('theme', v)}
          options={[
            { value: 'system', label: 'Automatic' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Stepper label="Card text size" value={s.fontSize} min={12} max={48} onChange={(v) => set('fontSize', v)} />
        <SegmentRow
          label="Card text alignment"
          value={s.align}
          onChange={(v) => set('align', v)}
          options={[
            { value: 'center', label: 'Centered' },
            { value: 'left', label: 'Left' },
          ]}
        />
        <SegmentRow
          label="Card text position"
          value={s.cardPosition}
          onChange={(v) => set('cardPosition', v)}
          options={[
            { value: 'middle', label: 'Middle' },
            { value: 'top', label: 'Top' },
          ]}
          last
        />
      </Section>

      <Section title="Studying">
        <SwitchRow label="Show next interval on buttons" value={s.showIntervals} onChange={(v) => set('showIntervals', v)} />
        <SwitchRow label="Show remaining counts" value={s.showRemaining} onChange={(v) => set('showRemaining', v)} />
        <Stepper label="New day starts at" value={s.dayStartHour} min={0} max={23} format={(v) => `${v}:00`} onChange={(v) => set('dayStartHour', v)} last />
      </Section>

      <Section title="Sign videos" footer="You can also change the speed and mirror each video with the buttons under it while studying.">
        <SegmentRow
          label="Speed when a card opens"
          sub="Slow motion helps to see handshapes and movement."
          value={String(s.videoSpeed) as '1' | '0.75' | '0.5'}
          onChange={(v) => set('videoSpeed', Number(v))}
          options={[
            { value: '1', label: 'Normal' },
            { value: '0.75', label: '¾ speed' },
            { value: '0.5', label: '½ speed' },
          ]}
        />
        <SwitchRow label="Mirror videos" sub="Flips the signer like a mirror, so you can copy the movement with the same hand." value={s.videoMirror} onChange={(v) => set('videoMirror', v)} last />
      </Section>

      <Section title="Card style for all decks (CSS)" footer="Advanced. Each deck can also have its own CSS in Deck options.">
        <TextInput
          value={css}
          onChangeText={setCss}
          onBlur={() => set('globalCss', css)}
          onEndEditing={() => set('globalCss', css)}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="/* e.g. .q { font-weight: 600 } */"
          placeholderTextColor={t.muted}
          style={{ color: t.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14, minHeight: 80, padding: 16, textAlignVertical: 'top' }}
        />
      </Section>

      <Section title="Your data" footer="Back up regularly (e.g. to iCloud Drive). Restore a backup through Import.">
        <Row icon="cloud-upload-outline" label={busy ? 'Preparing backup…' : 'Back up everything'} onPress={busy ? undefined : backup} />
        <Row icon="download-outline" iconColor={t.reviewC} label="Import / restore" onPress={() => router.push('/import')} />
        <Row icon="trash-outline" iconColor={t.muted} label="Delete unused media" value={String(listMedia().length) + ' files'} onPress={cleanMedia} last />
      </Section>

      <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }}>
        {counts.decks} decks · {counts.notes} notes · {counts.cards} cards · {counts.reviews} reviews{'\n'}Version {Constants.expoConfig?.version ?? '?'}
      </Text>
    </Screen>
  );
}
