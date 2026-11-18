import { useMemo } from 'react';
import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mediaBaseUri, mediaUri } from '../lib/storage';
import { useTheme } from '../lib/store';
import type { AppSettings } from '../lib/types';
import { needsYouTube } from '../lib/video';
import { cardHtml } from './cardHtml';

export interface CardViewProps {
  question: string;
  answer: string | null;
  settings: AppSettings;
  deckCss: string;
  onTap?: () => void;
  onSound?: (file: string) => void;
}

/**
 * YouTube's player refuses to play inside a page with no web address (error 153), so cards with a
 * YouTube link are loaded as if they came from this address. Nothing is fetched from it.
 * Saved files are then referenced by their full file:// address instead of relative names.
 */
const WEB_BASE = 'https://arahnofob.github.io/asl/';

export function openExternal(url: string) {
  if (/^https?:\/\//i.test(url)) Linking.openURL(url).catch(() => {});
}

export function CardView({ question, answer, settings, deckCss, onTap, onSound }: CardViewProps) {
  const theme = useTheme();
  const youtube = needsYouTube(question + (answer ?? ''));
  const base = useMemo(() => mediaBaseUri(), []);
  const html = useMemo(
    () => cardHtml({ question, answer, settings, deckCss, theme, resolveSrc: youtube ? mediaUri : undefined }),
    [question, answer, settings, deckCss, theme, youtube],
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: youtube ? WEB_BASE : base }}
        allowingReadAccessToURL={base}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsAirPlayForMediaPlayback={false}
        style={{ flex: 1, backgroundColor: theme.card }}
        containerStyle={{ backgroundColor: theme.card }}
        bounces={false}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        dataDetectorTypes="none"
        textInteractionEnabled={false}
        onShouldStartLoadWithRequest={(req) => {
          // Links tapped inside a card (or inside YouTube's player) open in Safari, not on the card.
          if (req.isTopFrame === false) return true;
          if (/^https?:\/\//i.test(req.url) && !req.url.startsWith(WEB_BASE)) {
            openExternal(req.url);
            return false;
          }
          return true;
        }}
        onMessage={(e) => {
          const m = e.nativeEvent.data;
          if (m === 'tap') onTap?.();
          else if (m.startsWith('snd:')) onSound?.(m.slice(4));
          else if (m.startsWith('open:')) openExternal(m.slice(5));
        }}
      />
    </View>
  );
}
