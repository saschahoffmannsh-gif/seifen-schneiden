// Leise, natürliche Foley-Geräusche, komplett prozedural über WebAudio (keine Audiodateien):
// gefiltertes Rauschen + kurze Resonanzen (Holz, Karton, Keramik, Metall). Keine Synth-Pieptöne.
// Alles läuft über einen gemeinsamen Bus (sanfter Tiefpass + Kompressor) in ctx.destination –
// der Ton-Schalter (sound.js) sitzt dahinter und schaltet damit alles stumm.
let ctx = null, bus = null, bright = null, noiseBuf = null;

/** Muss aus einer Nutzer-Geste heraus aufgerufen werden (iOS-Regel). */
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  init(new AC());
}

function init(c) {
  ctx = c;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500; lp.Q.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -26; comp.knee.value = 16; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
  const out = ctx.createGain(); out.gain.value = 0.8;
  lp.connect(comp); comp.connect(out); out.connect(ctx.destination);
  bus = lp;
  // heller Zweig für Metall (Münzen): gleiche Dynamik, aber Höhen bis ~12 kHz
  const lpB = ctx.createBiquadFilter(); lpB.type = 'lowpass'; lpB.frequency.value = 12000; lpB.Q.value = 0.5;
  lpB.connect(comp); bright = lpB;
  // 2 s weißes Rauschen, wird mit zufälligem Startpunkt für alle Geräusche wiederverwendet
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  rain = null; slide = null; slideQuiet = 0; voices.length = 0; lastGrain = -1; lastCut = -1; rate = 0; rateT = 0;
}

/** Nur für Tests/Aufnahmen: eigenen (z. B. Offline-)Kontext verwenden. */
export function _useAudioContext(c) { init(c); }

const rnd = (a, b) => a + Math.random() * (b - a);

/** Gefiltertes Rauschen mit weicher Hüllkurve (Anstieg a, Abklingen d). */
function noise({ t = 0, type = 'bandpass', f = 800, q = 0.8, f2 = 0, gain = 0.1, a = 0.004, d = 0.08, lp = 0 }) {
  const t0 = ctx.currentTime + t;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + a + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain * rnd(0.85, 1.1), t0 + a);   // leichte Variation
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d * rnd(0.9, 1.12));
  let node = fl;
  src.connect(fl);
  if (lp) { const l2 = ctx.createBiquadFilter(); l2.type = 'lowpass'; l2.frequency.value = lp; fl.connect(l2); node = l2; }
  node.connect(g); g.connect(bus);
  src.start(t0, Math.random() * 1.6); src.stop(t0 + a + d + 0.05);
}

/** Kurze, gedämpfte Resonanzen (Holz/Karton/Keramik/Metall): je Mode eine abklingende Sinusschwingung. */
function modes(list, { t = 0, gain = 0.05, a = 0.002 } = {}) {
  const t0 = ctx.currentTime + t, v = rnd(0.85, 1.1), p = rnd(0.96, 1.04);   // Lautstärke + Tonhöhe je Anschlag leicht variiert
  for (const [f, d, k = 1] of list) {
    const o = ctx.createOscillator(); o.frequency.value = f * p * rnd(0.985, 1.015);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain * k * v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + a + d + 0.03);
  }
}

// ---------- Foley ----------
/** Papier: Bestellzettel annehmen – zwei, drei feine Raschel-Körner. */
export function sndPaper() {
  if (!ctx) return;
  const n = 3 + (Math.random() * 2 | 0);
  for (let i = 0; i < n; i++) noise({ t: i * rnd(0.03, 0.06), f: rnd(2000, 3200), q: 1.2, gain: rnd(0.02, 0.04), a: 0.008, d: rnd(0.03, 0.07), lp: 4200 });
  noise({ t: 0, type: 'lowpass', f: 900, gain: 0.02, a: 0.02, d: 0.12 });
}
/** Holz: Schublade auf – kurzes Gleiten, dann ein dumpfes Klopfen. */
export function sndDrawer() {
  if (!ctx) return;
  noise({ type: 'bandpass', f: 520, f2: 950, q: 0.9, gain: 0.04, a: 0.05, d: 0.13 });   // Holz gleitet
  sndWood(0.16, 0.75);                                                                   // Anschlag
}
/** Holz-Klopfen (Seifen aufs Brett, Ton-Schalter). */
export function sndWood(t = 0, k = 1) {
  if (!ctx) return;
  noise({ t, type: 'bandpass', f: 900, q: 0.8, gain: 0.04 * k, a: 0.003, d: 0.03 });
  modes([[330, 0.11], [620, 0.07, 0.55], [1080, 0.045, 0.25]], { t, gain: 0.034 * k, a: 0.003 });
}
/** Weiches Ablegen (Seife auf Tisch / aus der Form): dumpfer, gedämpfter Aufsatz. */
export function sndThump(k = 1) {
  if (!ctx) return;
  noise({ type: 'lowpass', f: 750, gain: 0.07 * k, a: 0.006, d: 0.09 });
  modes([[255, 0.09], [470, 0.06, 0.45]], { gain: 0.03 * k, a: 0.005 });
}
/** Karton: Päckchen setzt auf – hohler, kurzer Klang. */
export function sndCardboard(k = 1, t = 0) {
  if (!ctx) return;
  noise({ t, type: 'lowpass', f: 1000, gain: 0.06 * k, a: 0.004, d: 0.08 });
  modes([[260, 0.1], [510, 0.065, 0.5], [880, 0.04, 0.25]], { t, gain: 0.03 * k, a: 0.004 });
}
/** Karton-Deckel: Luftstoß beim Aufsetzen + Aufsatz. */
export function sndLid() {
  if (!ctx) return;
  noise({ type: 'lowpass', f: 900, f2: 250, gain: 0.04, a: 0.01, d: 0.1 });
  sndCardboard(0.9, 0.015);
}
/** Stoff/Band/Blüten: weiches, kurzes Rascheln. */
export function sndFabric() {
  if (!ctx) return;
  noise({ f: rnd(1400, 2000), q: 0.7, gain: 0.035, a: 0.04, d: 0.14, lp: 3000 });
  noise({ t: 0.07, f: rnd(1100, 1600), q: 0.7, gain: 0.025, a: 0.03, d: 0.1, lp: 3000 });
}
/** Glas/Keramik: kleines Fläschchen wird abgestellt (Zusätze) – leises, kurzes „Tock“. */
export function sndGlass() {
  if (!ctx) return;
  noise({ type: 'highpass', f: 1800, gain: 0.02, a: 0.001, d: 0.012 });
  modes([[1650, 0.16], [2480, 0.11, 0.5], [3900, 0.07, 0.25]], { gain: 0.018 });
}
/** Keramik: Schmelztopf fertig – Deckel wird leise abgesetzt. */
export function sndCeramic() {
  if (!ctx) return;
  noise({ type: 'lowpass', f: 2500, gain: 0.03, a: 0.002, d: 0.02 });
  modes([[820, 0.18], [1330, 0.12, 0.5], [2150, 0.08, 0.25]], { gain: 0.025 });
}
/**
 * Knarrende Holztür (Schrank öffnen): Stick-Slip-Reibung im Scharnier als unregelmäßige
 * Impulsfolge, deren Rate mit der Türbewegung steigt und am Ende abbremst; die Impulse regen
 * gedämpfte Holzresonanzen an (Bandpässe 300–1500 Hz), oben weich begrenzt -> warm, nicht schrill.
 * Vorweg ein leises Klicken des Schnappers.
 */
export function sndCreak() {
  if (!ctx) return;
  const SR = ctx.sampleRate, dur = rnd(0.55, 0.66), n = Math.round(SR * dur);
  const buf = ctx.createBuffer(1, n, SR), d = buf.getChannelData(0);
  const base = rnd(0.9, 1.1);
  let t = 0.03 * SR, k = 0;
  while (t < n) {
    const x = t / n;                                         // 0..1 über die Bewegung
    const env = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 0.7;
    const rate = base * (26 + 70 * Math.sin(Math.PI * Math.min(1, x * 1.25)) ** 1.4); // Impulse/s
    const amp = (0.55 + 0.45 * env) * env * rnd(0.6, 1);
    const i0 = t | 0;
    for (let j = 0; j < 90 && i0 + j < n; j++) d[i0 + j] += amp * Math.exp(-j / 9) * (j % 2 ? -0.6 : 1) * (0.8 + Math.random() * 0.4);
    t += SR / rate * rnd(0.82, 1.2);                          // unregelmäßig wie echtes Holz
    k++;
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rnd(0.96, 1.04);
  const out = ctx.createGain(); out.gain.value = 0.8;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4;
  const t0 = ctx.currentTime;
  for (const [f, q, g] of [[340, 6, 1], [610, 9, 0.85], [980, 10, 0.55], [1460, 12, 0.3]]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * rnd(0.95, 1.05); bp.Q.value = q;
    bp.frequency.setValueAtTime(f, t0); bp.frequency.linearRampToValueAtTime(f * 1.06, t0 + dur * 0.6);  // Holz spannt sich
    const gg = ctx.createGain(); gg.gain.value = g;
    src.connect(bp); bp.connect(gg); gg.connect(lp);
  }
  lp.connect(out); out.connect(bus);
  src.start(t0 + 0.04);
  // Schnapper/Scharnier: leiser, kurzer Holzklick vorweg
  noise({ type: 'bandpass', f: 1300, q: 1.4, gain: 0.03, a: 0.001, d: 0.018 });
  modes([[420, 0.05], [890, 0.03, 0.5]], { gain: 0.012 });
}

/**
 * Ein Münz-Anschlag: kurzer Metall-Klick + inharmonische Resonanzen einer dünnen Metallscheibe
 * (je Mode zwei leicht verstimmte Schwinger -> Schwebung/Schimmer), gedämpft durch Kontakt.
 */
const COIN_RATIOS = [[1, 1, 1], [1.505, 0.75, 0.8], [2.08, 0.5, 0.6], [2.76, 0.32, 0.45], [3.58, 0.2, 0.32]];
function coinHit(t, f0, gain, ring) {
  const t0 = ctx.currentTime + t;
  noise({ t, type: 'highpass', f: 3800, q: 0.7, gain: gain * 0.55, a: 0.0008, d: 0.005 });
  for (const [r, k, dk] of COIN_RATIOS) {
    for (const det of [0.9985, 1.0018]) {
      const o = ctx.createOscillator(); o.frequency.value = f0 * r * det;
      const g = ctx.createGain(), d = ring * dk * rnd(0.85, 1.15);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain * k * 0.5, t0 + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.0015 + d);
      o.connect(g); g.connect(bright); o.start(t0); o.stop(t0 + d + 0.03);
    }
  }
}
/**
 * Münzgeklimper: mehrere Münzen fallen nacheinander in die Kasse und aufeinander –
 * schnelle, unregelmäßige Anschläge, verschiedene Münzgrößen, zuletzt eine Münze, die nachklingt.
 * big = Einnahme (Verkauf, mehr Münzen), sonst Bezahlen (Freischalten/Nachkaufen, weniger).
 */
const COIN_F = [2380, 2860, 3350, 3980];
export function sndCoins(big = true) {
  if (!ctx) return;
  const n = big ? 7 + (Math.random() * 3 | 0) : 4 + (Math.random() * 2 | 0);
  // in die Schale: ein dezenter, tieferer Teller-Klang beim ersten Aufprall
  modes([[880, 0.22], [1420, 0.16, 0.45], [2310, 0.1, 0.25]], { gain: 0.008 });
  let t = 0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const f0 = COIN_F[(Math.random() * COIN_F.length) | 0] * rnd(0.97, 1.03);
    const g = 0.016 * rnd(0.6, 1) * (i === 0 ? 1 : 0.85);
    coinHit(t, f0, g, last ? rnd(0.5, 0.7) : rnd(0.14, 0.32));
    if (Math.random() < 0.35 && !last) coinHit(t + rnd(0.008, 0.02), f0 * rnd(1.08, 1.2), g * 0.45, 0.1);   // kurzes Nachprellen
    t += i < 2 ? rnd(0.05, 0.09) : rnd(0.025, 0.075);
  }
}

// ---------- Schneiden + fallende Würfel ----------
// Harte Obergrenze gleichzeitiger Einzelstimmen und Mindestabstand; viele Aufpralle verschmelzen
// zu EINEM durchgehenden, in der Lautstärke modulierten Rieseln (eine Rauschquelle, ein Filter).
const MAX_VOICES = 2;
const voices = [];
let rain = null, rainTimer = 0, lastGrain = -1, lastCut = -1, rate = 0, rateT = 0;

function freeVoice(now, len) {
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i] <= now) voices.splice(i, 1);
  if (voices.length >= MAX_VOICES) return false;
  voices.push(now + len);
  return true;
}

function rainNode() {
  if (rain) return rain;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bus);
  src.start();
  rain = { src, g };
  return rain;
}

/** Ein Würfel landet: speist das gemeinsame Rieseln; nur selten ein einzelnes, dumpfes Korn. */
export function sndTick() {
  if (!ctx) return;
  const now = ctx.currentTime;
  rate = rate * Math.exp(-(now - rateT) * 3) + 1; rateT = now;      // ~Aufpralle pro 1/3 s
  const r = rainNode();
  const level = 0.03 * (1 - Math.exp(-rate / 10));                   // sättigt: viele Würfel = nicht lauter
  r.g.gain.cancelScheduledValues(now);
  r.g.gain.setTargetAtTime(level, now, 0.025);
  // an die Aufpralle gekoppelt: ohne neuen Aufprall nach ~0.45 s verstummt (-40 dB)
  r.g.gain.setTargetAtTime(0, now + 0.05, 0.075);
  clearTimeout(rainTimer);
  rainTimer = setTimeout(() => { if (rain) { try { rain.src.stop(); } catch { /* schon gestoppt */ } rain = null; } }, 700);
  // einzelnes Korn nur bei wenig Betrieb, mit Mindestabstand und Stimmenlimit
  if (rate < 6 && now - lastGrain > 0.09 && freeVoice(now, 0.07)) {
    lastGrain = now;
    noise({ type: 'bandpass', f: rnd(450, 800), q: 1.2, gain: 0.03, a: 0.004, d: rnd(0.04, 0.06), lp: 1200 });
  }
}

/**
 * Würfel rutschen über die schräge Seife: ganz leises, weiches Schaben (eine Rauschquelle, Pegel folgt
 * der Anzahl rutschender Würfel, sättigt). Pro Bild aufgerufen; ohne Rutschen verstummt es und stoppt.
 */
let slide = null, slideQuiet = 0;
export function sndSlide(n) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (n <= 0) {
    if (!slide) return;
    if (!slideQuiet) { slideQuiet = now; slide.g.gain.setTargetAtTime(0, now, 0.06); }
    else if (now - slideQuiet > 0.5) { try { slide.src.stop(); } catch { /* schon gestoppt */ } slide = null; slideQuiet = 0; }
    return;
  }
  slideQuiet = 0;
  if (!slide) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bus);
    src.start();
    slide = { src, g, bp };
  }
  const level = 0.0042 * (1 - Math.exp(-n / 60));             // deutlich unter Schnitt und Rieseln
  slide.g.gain.setTargetAtTime(level, now, 0.05);
  slide.bp.frequency.setTargetAtTime(1150 + Math.min(n, 200) * 1.5, now, 0.1);   // mehr Würfel = minimal heller
}

/** Messer löst eine Reihe: weiches, dumpfes „Schff“ – mit Mindestabstand und Stimmenlimit. */
export function sndCut() {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastCut < 0.09 || !freeVoice(now, 0.13)) return;
  lastCut = now;
  noise({ type: 'bandpass', f: rnd(600, 850), q: 0.8, gain: 0.075, a: 0.016, d: rnd(0.09, 0.12), lp: 1300 });
}

/** Kurze Vibration (falls das Gerät es kann). */
export function haptic(ms = 10) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) { /* ignorieren */ } }
