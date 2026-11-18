import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { loadCollectionText, saveCollectionText } from './storage';
import { emptyCollection, normalizeCollection, type Collection } from './types';

interface Store {
  /** Current collection. A new object reference after every change, so it works as a memo dependency. */
  col: Collection;
  mutate: (fn: (c: Collection) => void) => void;
  replace: (c: Collection) => void;
  /** Writes pending changes to disk immediately. */
  flush: () => void;
}

const Ctx = createContext<Store | null>(null);

function load(): Collection {
  try {
    const text = loadCollectionText();
    if (text) return normalizeCollection(JSON.parse(text));
  } catch (e) {
    console.warn('Failed to load collection', e);
  }
  return emptyCollection();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [col, setCol] = useState(load);
  // Latest collection for synchronous access from event handlers.
  const latest = useRef(col);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    try {
      saveCollectionText(JSON.stringify(latest.current));
    } catch (e) {
      console.warn('Failed to save collection', e);
    }
  }, []);

  const mutate = useCallback(
    (fn: (c: Collection) => void) => {
      const cur = latest.current;
      fn(cur);
      const next = { ...cur };
      latest.current = next;
      setCol(next);
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  const replace = useCallback(
    (c: Collection) => {
      const next = normalizeCollection(c);
      latest.current = next;
      setCol(next);
      dirty.current = true;
      flush();
    },
    [flush],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  const value = useMemo(() => ({ col, mutate, replace, flush }), [col, mutate, replace, flush]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  /** Big "start studying" banner. */
  hero: string;
  heroText: string;
  red: string;
  /** Line colour for charts (validated against the card surface). */
  chart: string;
  danger: string;
  newC: string;
  learnC: string;
  reviewC: string;
  again: string;
  hard: string;
  good: string;
  easy: string;
}

// Colours from the app icon: deep teal and warm amber, on soft paper.
const light: Theme = {
  dark: false,
  bg: '#F5F3EE',
  card: '#FFFFFF',
  text: '#16213E',
  muted: '#6B7083',
  border: '#E6E2D9',
  accent: '#0E7468',
  accentSoft: '#DFF1EE',
  accentText: '#FFFFFF',
  hero: '#0B4A44',
  heroText: '#FFFFFF',
  red: '#E5383B',
  chart: '#0E7468',
  danger: '#D63A3A',
  newC: '#2A62C9',
  learnC: '#D9701A',
  reviewC: '#1E9E5A',
  again: '#D63A3A',
  hard: '#B7800B',
  good: '#1E9E5A',
  easy: '#2A62C9',
};

const dark: Theme = {
  dark: true,
  bg: '#0B1413',
  card: '#14211F',
  text: '#F1F2F8',
  muted: '#9AA0B8',
  border: '#263532',
  accent: '#5FD3C1',
  accentSoft: '#173A37',
  accentText: '#0A1A19',
  hero: '#0E6157',
  heroText: '#FFFFFF',
  red: '#FF5A5F',
  chart: '#4CC2B0',
  danger: '#FF6B6B',
  newC: '#8AA2FF',
  learnC: '#FFA552',
  reviewC: '#4CD38A',
  again: '#FF6B6B',
  hard: '#F2C14E',
  good: '#4CD38A',
  easy: '#8AA2FF',
};

/** Adds transparency to a #RRGGBB colour, e.g. for tinted button backgrounds. */
export function tint(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

export function useTheme(): Theme {
  const { col } = useStore();
  const system = useColorScheme();
  const pref = col.settings.theme;
  return (pref === 'system' ? system === 'dark' : pref === 'dark') ? dark : light;
}

/** Current time, refreshed every 30s so due counts stay current. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);
  return now;
}
