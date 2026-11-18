import { decodeEntities, escapeHtml, renderSounds } from '../lib/html';
import type { Theme } from '../lib/store';
import type { AppSettings } from '../lib/types';
import { parseVideo } from '../lib/video';

/** Speeds offered by the speed button, in the order it cycles through them. */
export const VIDEO_SPEEDS = [1, 0.75, 0.5];

/** Turns each [video:…] token into a player with replay / speed / mirror buttons. */
export function renderVideos(html: string, resolveSrc?: (name: string) => string): string {
  return html.replace(/\[video:([^\]]+)\]/g, (_m, raw: string) => {
    const v = parseVideo(decodeEntities(raw));
    if (!v) return '';
    if (v.kind === 'page') {
      return `<div class="sign"><button class="open" data-open="${escapeHtml(v.url)}">▶︎ Watch the sign on ${escapeHtml(v.host)} ↗</button></div>`;
    }
    let frame: string;
    if (v.kind === 'youtube') {
      frame = `<div class="frame yt-frame"><div class="yt" data-id="${escapeHtml(v.id)}" data-start="${v.start ?? 0}" data-end="${v.end ?? 0}"></div></div>`;
    } else {
      const src = v.kind === 'file' ? (resolveSrc ? resolveSrc(v.name) : v.name) : v.url;
      frame = `<div class="frame"><video src="${escapeHtml(src)}" playsinline webkit-playsinline muted autoplay loop preload="auto"></video></div>`;
    }
    const open = v.kind === 'youtube' ? `<button class="link" data-open="${escapeHtml(v.url)}" aria-label="Open on YouTube">↗</button>` : '';
    return `<div class="sign">${frame}<div class="ctl">
<button data-act="play" aria-label="Pause">❚❚</button>
<button data-act="replay" aria-label="Replay">↺</button>
<button data-act="speed" aria-label="Speed">1×</button>
<button data-act="mirror" aria-label="Mirror">⇋</button>${open}</div><div class="err"></div></div>`;
  });
}

/** Builds the full HTML page for a card. `answer` is null while the answer is hidden. */
export function cardHtml(opts: {
  question: string;
  answer: string | null;
  settings: AppSettings;
  deckCss: string;
  theme: Theme;
  resolveSrc?: (name: string) => string;
}): string {
  const { question, answer, settings, deckCss, theme, resolveSrc } = opts;
  const fix = (h: string) => {
    let s = renderVideos(renderSounds(h), resolveSrc);
    if (resolveSrc) s = s.replace(/<img src="([^"]+)">/g, (_m, f: string) => `<img src="${resolveSrc(f)}">`);
    return s;
  };
  const body = `<div class="q">${fix(question)}</div>` + (answer !== null ? `<hr id="answer"><div class="a">${fix(answer)}</div>` : '');
  const hasYouTube = /class="yt"/.test(body);
  const speed = VIDEO_SPEEDS.includes(settings.videoSpeed) ? settings.videoSpeed : 1;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;padding:0;background:${theme.card};}
body{color:${theme.text};font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",system-ui,sans-serif;font-size:${settings.fontSize}px;line-height:1.4;
 text-align:${settings.align};padding:0;-webkit-text-size-adjust:100%;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
 word-wrap:break-word;overflow-wrap:anywhere;}
.wrap{min-height:100vh;box-sizing:border-box;padding:28px 22px;display:flex;flex-direction:column;
 justify-content:${settings.cardPosition === 'top' ? 'flex-start' : 'center'};}
p,div{margin:0 0 .35em;} p:last-child{margin-bottom:0} div.wrap{margin:0}
img{max-width:100%;height:auto;border-radius:8px}
hr#answer{border:none;border-top:1px solid ${theme.border};margin:22px 0;}
.a{color:${theme.text}}
b,strong{font-weight:650}
button.snd{font-size:.8em;border:none;border-radius:999px;width:2.2em;height:2.2em;background:${theme.bg};color:${theme.accent};
 cursor:pointer;vertical-align:middle;margin:2px 4px;padding:0;}
.sign{margin:0 0 .5em;text-align:center}
.sign .frame{margin:0 auto;border-radius:14px;overflow:hidden;background:#000;max-width:100%;}
.sign video{display:block;width:100%;max-height:52vh;object-fit:contain;background:#000;margin:0 auto}
.sign .yt-frame{position:relative;width:100%;aspect-ratio:16/9;}
.sign .yt-frame iframe,.sign .yt-frame .yt{position:absolute;inset:0;width:100%;height:100%;border:0;margin:0}
.sign .frame.mirror video,.sign .frame.mirror iframe{transform:scaleX(-1)}
.sign .ctl{display:flex;justify-content:center;gap:8px;margin:8px 0 0}
.sign .ctl button{font:600 15px -apple-system,system-ui,sans-serif;min-width:46px;height:36px;padding:0 12px;border:none;border-radius:999px;
 background:${theme.bg};color:${theme.accent};cursor:pointer}
.sign .ctl button.on{background:${theme.accent};color:${theme.accentText}}
.sign .err{font-size:14px;color:${theme.muted};margin:6px 0 0}
.sign .err:empty{display:none}
button.open{font:600 17px -apple-system,system-ui,sans-serif;padding:14px 18px;border:none;border-radius:14px;background:${theme.accent};color:${theme.accentText};cursor:pointer}
${settings.globalCss}
${deckCss}
</style></head><body><div class="wrap">${body}</div>
<script>
(function(){
  function post(m){ if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(m);} else if(window.parent!==window){window.parent.postMessage({flashcards:m},'*');} }
  var SPEEDS=${JSON.stringify(VIDEO_SPEEDS)}, speed=${speed}, mirror=${settings.videoMirror ? 'true' : 'false'};
  function label(r){ return (r===0.75?'¾':r===0.5?'½':'1')+'×'; }
  // One controller per sign: { play, pause, replay, rate, paused }.
  function setup(sign, ctl){
    sign._ctl = ctl;
    var frame = sign.querySelector('.frame');
    var bSpeed = sign.querySelector('[data-act=speed]'), bMirror = sign.querySelector('[data-act=mirror]'), bPlay = sign.querySelector('[data-act=play]');
    sign._rate = speed;
    function show(){ bSpeed.textContent = label(sign._rate); bSpeed.classList.toggle('on', sign._rate!==1);
      frame.classList.toggle('mirror', !!sign._mirror); bMirror.classList.toggle('on', !!sign._mirror); }
    sign._mirror = mirror;
    sign._show = show;
    sign._playBtn = function(p){ bPlay.textContent = p ? '▶︎' : '❚❚'; bPlay.setAttribute('aria-label', p ? 'Play' : 'Pause'); };
    show();
  }
  function fail(sign, msg){ var e = sign.querySelector('.err'); if (e) e.textContent = msg; }

  document.querySelectorAll('.sign video').forEach(function(v){
    var sign = v.closest('.sign');
    setup(sign, {
      play: function(){ var p = v.play(); if (p && p.catch) p.catch(function(){}); },
      pause: function(){ v.pause(); },
      replay: function(){ v.currentTime = 0; this.play(); },
      rate: function(r){ v.playbackRate = r; v.defaultPlaybackRate = r; },
      paused: function(){ return v.paused; }
    });
    v.playbackRate = sign._rate; v.defaultPlaybackRate = sign._rate;
    v.addEventListener('play', function(){ sign._playBtn(false); });
    v.addEventListener('pause', function(){ sign._playBtn(true); });
    v.addEventListener('error', function(){ fail(sign, 'This video can’t be played. It may have been deleted, or there’s no internet connection.'); });
    v.addEventListener('click', function(e){ e.stopPropagation(); if (v.paused) sign._ctl.play(); else sign._ctl.pause(); });
  });

  ${
    hasYouTube
      ? `
  window.onYouTubeIframeAPIReady = function(){
    document.querySelectorAll('.sign .yt').forEach(function(el){
      var sign = el.closest('.sign'), start = +el.getAttribute('data-start') || 0, end = +el.getAttribute('data-end') || 0;
      var player, ready = false, state = -1;
      setup(sign, {
        play: function(){ if (ready) player.playVideo(); },
        pause: function(){ if (ready) player.pauseVideo(); },
        replay: function(){ if (ready) { player.seekTo(start, true); player.playVideo(); } },
        rate: function(r){ if (ready) player.setPlaybackRate(r); },
        paused: function(){ return state !== 1 && state !== 3; }
      });
      var vars = { playsinline: 1, autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0, start: start };
      if (end) vars.end = end;
      if (location.origin && location.origin !== 'null') vars.origin = location.origin;
      player = new YT.Player(el, {
        videoId: el.getAttribute('data-id'),
        playerVars: vars,
        events: {
          onReady: function(e){ ready = true; e.target.mute(); e.target.setPlaybackRate(sign._rate); e.target.playVideo(); },
          onStateChange: function(e){
            state = e.data;
            if (e.data === 0) { e.target.seekTo(start, true); e.target.playVideo(); } // loop the sign
            sign._playBtn(e.data === 2);
          },
          onError: function(){ fail(sign, 'YouTube won’t play this video here. Tap ↗ to watch it on YouTube.'); }
        }
      });
    });
  };
  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function(){ document.querySelectorAll('.sign .yt').forEach(function(el){ fail(el.closest('.sign'), 'No internet connection — YouTube videos need the internet.'); }); };
  document.head.appendChild(s);`
      : ''
  }

  document.addEventListener('click', function(e){
    var t = e.target;
    var b = t.closest ? t.closest('[data-snd]') : null;
    if (b) { e.stopPropagation(); post('snd:' + b.getAttribute('data-snd')); return; }
    var o = t.closest ? t.closest('[data-open]') : null;
    if (o) { e.stopPropagation(); post('open:' + o.getAttribute('data-open')); return; }
    var a = t.closest ? t.closest('[data-act]') : null;
    if (a) {
      e.stopPropagation();
      var sign = a.closest('.sign'), c = sign && sign._ctl;
      if (!c) return;
      var act = a.getAttribute('data-act');
      if (act === 'play') { if (c.paused()) c.play(); else c.pause(); }
      else if (act === 'replay') c.replay();
      else if (act === 'speed') { sign._rate = SPEEDS[(SPEEDS.indexOf(sign._rate) + 1) % SPEEDS.length]; c.rate(sign._rate); sign._show(); }
      else if (act === 'mirror') { sign._mirror = !sign._mirror; sign._show(); }
      return;
    }
    if (t.closest && t.closest('.ctl')) return;
    if (t.closest && t.closest('a')) return;
    post('tap');
  });
})();
</script></body></html>`;
}
