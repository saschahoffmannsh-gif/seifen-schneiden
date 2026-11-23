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

// Schneiden + fallende Würfel: eigener, gedämpfter Bus (Tiefpass + sanfter Kompressor), damit viele
// gleichzeitige Würfel zu einem weichen Rieseln verschmelzen statt zu klackern.
let soft = null, density = 0, densityT = 0;
function softBus() {
  if (soft || !ctx) return soft;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -30; comp.knee.value = 18; comp.ratio.value = 10; comp.attack.value = 0.004; comp.release.value = 0.25;
  const out = ctx.createGain(); out.gain.value = 0.9;
  lp.connect(comp); comp.connect(out); out.connect(master);
  soft = lp;
  return soft;
}

/** Weicher Rausch-Hauch: sanfter Anstieg (keine Klick-Transiente), Tiefpass-gefiltert. */
function softBurst(freq, q, gain, attack, dur) {
  if (!ctx || !softBus()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.6 + Math.random() * 0.25;   // langsamer abgespielt = dunkler, weicher
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  src.connect(f); f.connect(g); g.connect(soft);
  src.start(t); src.stop(t + attack + dur + 0.03);
}

/** Leises, gedämpftes Schneidegeräusch beim Lösen einer Reihe. */
export function sndCut() { softBurst(650 + Math.random() * 350, 0.8, 0.22, 0.014, 0.13); }

/** Feines Rieseln, wenn Würfel landen: gedrosselt, je mehr gleichzeitig, desto leiser. */
export function sndTick() {
  if (!ctx) return;
  const now = ctx.currentTime;
  density = density * Math.exp(-(now - densityT) * 4) + 1; densityT = now;   // Würfel pro ~0,25 s
  if (now - lastTick < 0.045 + Math.random() * 0.03) return;
  lastTick = now;
  const g = 0.07 / Math.sqrt(1 + density * 0.6);
  softBurst(520 + Math.random() * 420, 1.4, g, 0.005, 0.05 + Math.random() * 0.03);
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
