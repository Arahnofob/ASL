import { createElement, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { mediaUri } from '../lib/storage';
import { useTheme } from '../lib/store';
import type { CardViewProps } from './CardView';
import { cardHtml } from './cardHtml';

export function CardView({ question, answer, settings, deckCss, onTap, onSound }: CardViewProps) {
  const theme = useTheme();
  const html = useMemo(() => cardHtml({ question, answer, settings, deckCss, theme, resolveSrc: mediaUri }), [question, answer, settings, deckCss, theme]);
  useEffect(() => {
    const h = (e: MessageEvent) => {
      const m = e.data?.flashcards;
      if (typeof m !== 'string') return;
      if (m === 'tap') onTap?.();
      else if (m.startsWith('snd:')) onSound?.(m.slice(4));
      else if (m.startsWith('open:') && /^https?:\/\//i.test(m.slice(5))) window.open(m.slice(5), '_blank', 'noopener');
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [onTap, onSound]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      {createElement('iframe', { srcDoc: html, title: 'card', allow: 'autoplay; encrypted-media', style: { border: 0, width: '100%', height: '100%', background: theme.card } })}
    </View>
  );
}
