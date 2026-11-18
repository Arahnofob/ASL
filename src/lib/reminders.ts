import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ALL, buildQueue } from './queue';
import { streakDays } from './stats';
import type { Collection } from './types';
import { plural } from './util';

const DAY = 86_400_000;
const DAYS_AHEAD = 7;

/** Asks iOS for permission to show notifications. */
export async function allowReminders(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const now = await Notifications.getPermissionsAsync();
    if (now.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * (Re)schedules the daily reminder for the next week. Called whenever the app goes to the
 * background, so today's reminder shows the real number of cards left (and is skipped when
 * everything is done). Local notifications only — no server or push setup involved.
 */
export async function scheduleReminders(col: Collection, now = Date.now()): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const s = col.settings;
    if (!s.reminderOn) return;
    const q = buildQueue(col, ALL, now);
    const due = q.news.length + q.learnNow.length + q.learnLater.length + q.reviews.length;
    const streak = streakDays(col, now);
    const d = new Date(now);
    const first = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.reminderHour, s.reminderMinute, 0, 0).getTime();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const at = first + i * DAY;
      if (at <= now + 60_000) continue;
      const today = i === 0;
      if (today && due === 0) continue; // already finished today
      await Notifications.scheduleNotificationAsync({
        content: today
          ? { title: `${plural(due, 'sign')} waiting 🤟`, body: streak ? `Keep your ${streak}-day streak going!` : 'A few minutes of signing today?' }
          : { title: 'Time to practise your signs 🤟', body: 'Your cards are waiting — a few minutes keeps your streak alive.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  } catch (e) {
    console.warn('Could not schedule reminders', e);
  }
}
