import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import { mediaUri } from './storage';

let player: AudioPlayer | null = null;
let voice: AudioPlayer | null = null;
let voiceDone: (() => void) | null = null;
let configured = false;

/**
 * Lets audio (and speech) play even when the silent switch is on, and keeps the audio
 * session active so the first syllable isn't cut off while iOS switches audio on.
 */
export function configureAudio(force = false) {
  if (configured && !force) return;
  configured = true;
  setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false })
    .then(() => setIsAudioActiveAsync(true))
    .catch(() => {});
}

function play(p: AudioPlayer | null, uri: string): AudioPlayer {
  const pl = p ?? createAudioPlayer({ uri });
  if (p) pl.replace({ uri });
  pl.seekTo(0).catch(() => {});
  pl.play();
  return pl;
}

/** Plays any local audio file (e.g. a recording of the user). */
export function playUri(uri: string) {
  try {
    configureAudio();
    stopVoice();
    player = play(player, uri);
  } catch (e) {
    console.warn('Audio failed', e);
  }
}

/** Plays a media file by name. */
export function playSound(file: string) {
  const uri = mediaUri(file);
  if (uri) playUri(uri);
}

export function stopSound() {
  try {
    player?.pause();
  } catch {
    // ignore
  }
}

/** Plays a pronunciation MP3 at a given speed (pitch kept natural); calls onDone when finished. */
export function playVoice(uri: string, rate: number, onDone: () => void) {
  try {
    configureAudio();
    stopSound();
    if (!voice) {
      voice = createAudioPlayer({ uri });
      voice.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) {
          const cb = voiceDone;
          voiceDone = null;
          cb?.();
        }
      });
    } else {
      voice.replace({ uri });
    }
    voiceDone = onDone;
    voice.shouldCorrectPitch = true;
    voice.setPlaybackRate(rate, 'high');
    voice.seekTo(0).catch(() => {});
    voice.play();
  } catch (e) {
    console.warn('Voice playback failed', e);
    onDone();
  }
}

export function stopVoice() {
  try {
    voice?.pause();
  } catch {
    // ignore
  }
  const cb = voiceDone;
  voiceDone = null;
  cb?.();
}
