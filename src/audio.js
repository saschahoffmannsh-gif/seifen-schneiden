// Kleine, generierte Geräusche über WebAudio (keine Audiodateien nötig).
let ctx = null, noiseBuf = null, master = null;
let lastTick = 0;

/** Muss aus einer Nutzer-Geste heraus aufgerufen werden (iOS-Regel). */
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  // ein kurzer Rausch-Puffer, der für alle Knack-Geräusche wiederverwendet wird
  noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
}

function noiseBurst(freq, q, gain, dur) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}

/** Knuspriges Schneidegeräusch beim Lösen einer Reihe. */
export function sndCut() { noiseBurst(2200 + Math.random() * 1500, 1.2, 0.5, 0.08); }

/** Leises Klicken, wenn ein Würfel landet (gedrosselt). */
export function sndTick() {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastTick < 0.035) return;
  lastTick = now;
  noiseBurst(3500 + Math.random() * 2500, 6, 0.18, 0.03);
}

function tone(freq, dur, type = 'sine', gain = 0.25, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export function sndPop() { tone(660, 0.12, 'triangle', 0.2); tone(990, 0.15, 'triangle', 0.15, 0.06); }
export function sndCoin() { tone(1320, 0.1, 'square', 0.08); tone(1760, 0.25, 'square', 0.08, 0.08); }
export function sndDing() { tone(880, 0.4, 'sine', 0.2); tone(1320, 0.5, 'sine', 0.12, 0.05); }

/** Kurze Vibration (falls das Gerät es kann). */
export function haptic(ms = 10) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) { /* ignorieren */ } }
