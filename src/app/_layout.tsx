import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { configureAudio } from '../lib/audio';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { scheduleReminders } from '../lib/reminders';
import { StoreProvider, useStore, useTheme } from '../lib/store';

function ThemedStack() {
  const t = useTheme();
  const { col } = useStore();
  // Keep the daily reminder up to date: when settings change and whenever the app is left.
  const latest = useRef(col);
  useEffect(() => {
    latest.current = col;
  }, [col]);
  const { reminderOn, reminderHour, reminderMinute } = col.settings;
  useEffect(() => {
    scheduleReminders(latest.current);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') scheduleReminders(latest.current);
    });
    return () => sub.remove();
  }, [reminderOn, reminderHour, reminderMinute]);
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.accent,
          headerTitleStyle: { color: t.text, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          headerBackButtonDisplayMode: 'minimal',
          headerTransparent: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Signs', headerShown: false }} />
        <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal', title: 'Import' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Warm up audio at launch so the first card doesn't start late or clipped.
  useEffect(() => {
    configureAudio();
  }, []);
  return (
    <StoreProvider>
      <ThemedStack />
    </StoreProvider>
  );
}
