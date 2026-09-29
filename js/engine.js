// ═══════════════════════════════════════════════════════════════════════════════
// Engine — the game-agnostic parts: sound, screens, overlays, timers, the
// pass-the-phone gate and the interstitial beat. Loaded before game.js.
// Nothing in here knows what the game is. Everything the game owns lives in
// js/game.js — never put game rules or game state in this file.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Sound state (the only things kept in localStorage besides settings) ──────
// Keys are prefixed per game: games hosted under one username.github.io share storage.
let isMuted      = safeGet('dma-muted') === 'true';
let masterVolume = parseFloat(safeGet('dma-volume') ?? '0.6');
let audioCtx     = null;

function safeGet(k)    { try { return localStorage.getItem(k); } catch (_) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

// ── Web Audio — every sound is synthesised; there are no audio files ─────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone({ type = 'sine', freq, startTime, duration, gain = 0.3 }) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.connect(env);
  env.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(gain * masterVolume, startTime);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Correct / match — bright ascending chime C5 → E5 → G5
function playSuccess() {
  if (isMuted) return;
  const now = getAudioCtx().currentTime;
  playTone({ type: 'triangle', freq: 523, startTime: now,        duration: 0.12, gain: 0.22 });
  playTone({ type: 'triangle', freq: 659, startTime: now + 0.08, duration: 0.12, gain: 0.22 });
  playTone({ type: 'triangle', freq: 784, startTime: now + 0.16, duration: 0.18, gain: 0.22 });
}

// Wrong / penalty — cartoon descending boing
function playBoing() {
  if (isMuted) return;
  const ctx = getAudioCtx(), now = ctx.currentTime;
  const osc = ctx.createOscillator(), env = ctx.createGain();
  osc.connect(env); env.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(280, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.20);
  env.gain.setValueAtTime(0.18 * masterVolume, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.start(now); osc.stop(now + 0.23);
}

// Skip / swish
function playWhoosh() {
  if (isMuted) return;
  const ctx = getAudioCtx(), now = ctx.currentTime;
  const osc = ctx.createOscillator(), env = ctx.createGain();
  osc.connect(env); env.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(350, now);
  osc.frequency.exponentialRampToValueAtTime(700, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(250, now + 0.18);
  env.gain.setValueAtTime(0.14 * masterVolume, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
  osc.start(now); osc.stop(now + 0.21);
}

// Settings pill / toggle — tactile micro-pop
function playPillClick() {
  if (isMuted) return;
  playTone({ freq: 900, startTime: getAudioCtx().currentTime, duration: 0.025, gain: 0.08 });
}

// Close / confirm an overlay — G4 → C5
function playDone() {
  if (isMuted) return;
  const now = getAudioCtx().currentTime;
  playTone({ freq: 392, startTime: now,        duration: 0.09, gain: 0.18 });
  playTone({ freq: 523, startTime: now + 0.07, duration: 0.12, gain: 0.18 });
}

// Big CTAs (Play, Start, I'm Ready)
function playLaunch() {
  if (isMuted) return;
  const now = getAudioCtx().currentTime;
  playTone({ type: 'triangle', freq: 330, startTime: now,        duration: 0.10, gain: 0.20 });
  playTone({ type: 'triangle', freq: 392, startTime: now + 0.07, duration: 0.10, gain: 0.20 });
  playTone({ type: 'triangle', freq: 494, startTime: now + 0.14, duration: 0.15, gain: 0.20 });
}

// Destructive confirm (quit, restart) — gentle fall
function playExit() {
  if (isMuted) return;
  const now = getAudioCtx().currentTime;
  playTone({ freq: 247, startTime: now,        duration: 0.10, gain: 0.15 });
  playTone({ freq: 196, startTime: now + 0.08, duration: 0.14, gain: 0.12 });
}

// Countdown tick
function playTick() {
  if (isMuted) return;
  playTone({ freq: 440, startTime: getAudioCtx().currentTime, duration: 0.05, gain: 0.15 });
}

// Timer expiry — three-pulse blip
function playAlarm() {
  if (isMuted) return;
  const now = getAudioCtx().currentTime;
  [0, 0.22, 0.44].forEach(o => playTone({ type: 'square', freq: 880, startTime: now + o, duration: 0.12, gain: 0.18 }));
}

// Volume slider feedback — deliberately ignores mute so the slider is always audible
function playSliderTick(value = 50) {
  const t = value / 100, ctx = getAudioCtx(), now = ctx.currentTime;
  const osc = ctx.createOscillator(), env = ctx.createGain();
  osc.connect(env); env.connect(ctx.destination);
  osc.frequency.value = 700 + t * 900;
  env.gain.setValueAtTime(0.02 + t * 0.12, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  osc.start(now); osc.stop(now + 0.018);
}

// ── Screens ───────────────────────────────────────────────────────────────────
// Every <section id="screen-…"> is a screen. The list is read from the page, so
// a new screen needs no registration — add the section and showScreen() it.
function showScreen(id) {
  document.querySelectorAll('section[id^="screen-"]').forEach(s => { s.style.display = 'none'; });
  const el = document.getElementById(id);
  el.style.display = 'flex';
  el.classList.remove('screen-enter');
  void el.offsetWidth;                    // force reflow so the entrance replays
  el.classList.add('screen-enter');
  window.scrollTo(0, 0);
}

// ── Overlays ──────────────────────────────────────────────────────────────────
// Every overlay's id ends in "-overlay". openOverlay resets a data sheet's scroll
// so its title is the first thing seen.
function openOverlay(id) {
  const el = document.getElementById(id);
  const sheet = el.querySelector('.overlay-data-inner');
  if (sheet) sheet.scrollTop = 0;
  el.style.display = 'flex';
}
function closeOverlay(id) { document.getElementById(id).style.display = 'none'; }
function closeAllOverlays() {
  document.querySelectorAll('[id$="-overlay"]').forEach(o => { o.style.display = 'none'; });
}

// Tapping an overlay's dead space presses its own neutral button (an id ending in
// -cancel / -close / -done / -ok), so that button's cleanup runs exactly as if it
// had been tapped. An overlay with no neutral button (a real decision) stays put.
const OVERLAY_DISMISS_RE = /(?:^|-)(cancel|close|done|ok|dismiss)(?:$|-)/i;
document.addEventListener('click', e => {
  const el = e.target;
  if (!el.id || !el.id.endsWith('-overlay') || !el.classList.contains('fixed')) return;
  const neutral = [...el.querySelectorAll('button[id]')]
    .find(b => OVERLAY_DISMISS_RE.test(b.id) && b.offsetParent !== null);
  if (neutral) neutral.click();
});

// ── Timers ────────────────────────────────────────────────────────────────────
// Every game timer goes through these, so quitting can never leave one running
// against the next screen. resetToMenu() clears them all.
const _timers = new Set();
function gameTimeout(fn, ms) {
  const h = setTimeout(() => { _timers.delete(h); fn(); }, ms);
  _timers.add(h);
  return h;
}
function gameInterval(fn, ms) {
  const h = setInterval(fn, ms);
  _timers.add(h);
  return h;
}
function clearGameTimer(h) { clearTimeout(h); clearInterval(h); _timers.delete(h); }
function clearGameTimers()  { _timers.forEach(h => { clearTimeout(h); clearInterval(h); }); _timers.clear(); }

// ── Pass-the-phone gate ───────────────────────────────────────────────────────
// Before ANY screen that shows one player's private information, name who should
// be holding the phone and wait for them to tap. No back button: it can't be skipped.
function showPassGate({ heading, subtext = 'Everyone else, look away!', ctaLabel = "I'm Ready", onConfirm }) {
  document.getElementById('gate-heading').textContent = heading;
  document.getElementById('gate-subtext').textContent = subtext;
  const btn = document.getElementById('btn-gate-confirm');
  btn.textContent = ctaLabel;
  btn.onclick = () => { playLaunch(); onConfirm(); };
  showScreen('screen-pass-gate');
}

// ── Interstitial beat ─────────────────────────────────────────────────────────
// A short auto-advancing screen: a round intro, a reveal, a "the night falls"
// moment. One line of scene-setting plus one line of what to do next. It has no
// buttons, so it needs no 🔊 / ✕ — keep it at ~5 s or less.
function showInterstitial({ emoji = '✨', heading = '', sub = '', ms = 4000, onDone }) {
  document.getElementById('beat-emoji').textContent   = emoji;
  document.getElementById('beat-heading').textContent = heading;
  document.getElementById('beat-sub').textContent     = sub;
  showScreen('screen-interstitial');
  gameTimeout(onDone, ms);
}

// ── Sound overlay ─────────────────────────────────────────────────────────────
function syncSoundUI() {
  const icon = isMuted ? '🔇' : '🔊';
  document.querySelectorAll('.btn-open-sound').forEach(b => { b.textContent = icon; });
  const t = document.getElementById('global-mute-toggle');
  t.textContent = isMuted ? 'ON' : 'OFF';
  t.className   = isMuted ? 'toggle-on' : 'toggle-off';
  document.getElementById('global-volume-group').style.display = isMuted ? 'none' : '';
}
function toggleMute() {
  isMuted = !isMuted;
  safeSet('dma-muted', isMuted);
  syncSoundUI();
}

document.getElementById('global-sound-volume').value = Math.round(masterVolume * 100);
document.getElementById('global-volume-label').textContent = `${Math.round(masterVolume * 100)}%`;
syncSoundUI();

document.getElementById('global-mute-toggle').addEventListener('click', toggleMute);
document.getElementById('global-sound-volume').addEventListener('input', e => {
  masterVolume = parseInt(e.target.value, 10) / 100;
  safeSet('dma-volume', masterVolume);
  document.getElementById('global-volume-label').textContent = `${e.target.value}%`;
  playSliderTick(parseInt(e.target.value, 10));
});
document.getElementById('btn-sound-done').addEventListener('click', () => { playDone(); closeOverlay('sound-overlay'); });
// Tap a 🔊 to open the sound settings; press and hold it to mute straight away.
document.querySelectorAll('.btn-open-sound').forEach(b => {
  let held = false;
  bindHold(b, () => { held = true; toggleMute(); playSliderTick(isMuted ? 15 : 70); });
  b.addEventListener('click', () => {
    if (held) { held = false; return; }
    openOverlay('sound-overlay');
  });
});

// ── Small helpers ─────────────────────────────────────────────────────────────
// Press-and-hold (500 ms). A scroll that starts on the element is not a hold.
function bindHold(el, onHold, ms = 500) {
  let timer = null;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const start  = () => { cancel(); timer = setTimeout(() => { timer = null; onHold(); }, ms); };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchmove', cancel, { passive: true });
  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(ev => el.addEventListener(ev, cancel));
  el.addEventListener('mousedown', start);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

// Replay a CSS animation on the same element (the reflow line is required).
function replayAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// ── Reset ─────────────────────────────────────────────────────────────────────
// The one way back to the menu. Stops every timer, closes every overlay, lets
// the game clear its own round state, then shows the menu. Settings are kept.
function resetToMenu() {
  clearGameTimers();
  closeAllOverlays();
  if (typeof gameReset === 'function') gameReset();
  showScreen('screen-menu');
}

// ── Offline support ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
