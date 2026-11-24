// Startbildschirm (Spielen / Fortsetzen / Neu beginnen), Einstellungen (Ton, Fortschritt zurücksetzen),
// Sammlung (wie viel schon freigeschaltet ist) und Pause-Menü über den Knopf oben links.
// Hinter dem Startbildschirm laufen 3D-Seifen (startscene.js) – nur solange er offen ist.
import { ICON, rich } from './icons.js';
import { sound } from './sound.js';
import { PACKAGE_TYPES } from './decor.js';
import { DECO_ITEMS } from './decoItems.js';
import { ADDITIVES } from './additives.js';
import { SOAP_SHAPES } from './shapes.js';
import { sndWood } from './audio.js';
import { createStartScene } from './startscene.js';

const SAVE_KEY = 'seifen-save-v1';
const $ = (id) => document.getElementById(id);

function hasProgress() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    return !!d && (d.coins > 0 || (d.unlocked && d.unlocked.length > 0) || (d.stock && Object.keys(d.stock).length > 0));
  } catch { return false; }
}

function openModal(id) { const m = $(id); m.classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

export function createMenu({ getCoins }) {
  const start = $('start');
  let started = false, openedAt = 0, stopT = 0;
  const scene3d = createStartScene($('st-canvas'));

  function refreshStart() {
    const prog = hasProgress();
    const word = started ? 'Weiterspielen' : prog ? 'Fortsetzen' : 'Spielen';
    slide.txt.textContent = `Zum ${word} schieben`;
    slide.el.setAttribute('aria-label', `Zum ${word} schieben`);
    $('start-new').style.display = prog && !started ? '' : 'none';
    const p = $('st-progress');
    if (prog || started) {
      const n = PACKAGE_TYPES.filter((t) => t.unlocked).length + DECO_ITEMS.filter((t) => t.unlocked).length + ADDITIVES.filter((t) => t.unlocked).length + SOAP_SHAPES.filter((t) => t.unlocked).length;
      p.innerHTML = `<span class="chip">${ICON.coin}<b>${getCoins()}</b></span><span class="chip-sep"></span><span class="chip">${ICON.sparkle}<b>${n}</b>&nbsp;freigeschaltet</span>`;
      p.style.display = '';
    } else p.style.display = 'none';
    placeSoaps();
  }
  // 3D-Seifen mittig in den freien Raum zwischen Wortmarke und Menü setzen
  function placeSoaps() {
    const lg = start.querySelector('.tagline').getBoundingClientRect(), mn = start.querySelector('.st-menu > :not([style*="none"])').getBoundingClientRect();
    const h = window.innerHeight || 1;
    if (!lg.height || !mn.height) return;
    scene3d.layout(((lg.bottom + mn.top) / 2) / h, Math.max(0.12, (mn.top - lg.bottom) / h));
    $('st-canvas').style.setProperty('--fade-y', `${Math.round(mn.top)}px`);   // Schale läuft unten zum Regler hin aus
  }
  window.addEventListener('resize', () => { if (start.classList.contains('open')) placeSoaps(); });
  // Safe-Area/Schriften können das Layout nach dem ersten Messen verschieben -> neu einpassen
  if (window.ResizeObserver) new ResizeObserver(() => { if (start.classList.contains('open')) placeSoaps(); }).observe(start.querySelector('.st-inner'));
  window.addEventListener('load', () => { if (start.classList.contains('open')) placeSoaps(); });

  // ---------- Schieberegler (wie früher „Zum Entsperren schieben“): Fortschritt = Schnitttiefe ----------
  const slide = (() => {
    const el = $('start-play'), knob = el.querySelector('.sg-knob'), fill = el.querySelector('.sg-fill'), txt = el.querySelector('.sg-txt');
    knob.innerHTML = ICON.play;
    let p = 0, drag = null, anim = 0, busy = false;
    const range = () => Math.max(1, el.clientWidth - knob.offsetWidth - 2 * knob.offsetLeft);
    function set(v) {
      p = Math.max(0, Math.min(1, v));
      const x = p * range();
      knob.style.transform = `translateX(${x}px)`;
      fill.style.width = `${x + knob.offsetWidth + knob.offsetLeft}px`;
      txt.style.opacity = String(Math.max(0, 1 - p * 2.4));
      el.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      scene3d.setCut(p);
    }
    function animateTo(v, ms, ease, done) {
      cancelAnimationFrame(anim);
      const p0 = p, t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        set(p0 + (v - p0) * ease(t));
        if (t < 1) anim = requestAnimationFrame(tick); else if (done) done();
      };
      anim = requestAnimationFrame(tick);
    }
    const easeOut = (t) => 1 - (1 - t) ** 3;
    const springBack = (t) => 1 - (1 - t) ** 3 * Math.cos(t * 4.2);   // federt kurz nach (über das Ziel hinaus)
    function complete() {
      busy = true; el.classList.add('done');
      animateTo(1, 110, easeOut, () => {
        scene3d.finish();
        setTimeout(() => { hide(); }, 750);   // kurz den fallenden Würfeln zusehen, dann ins Spiel
      });
    }
    el.addEventListener('pointerdown', (e) => {
      if (busy || drag) return;
      const kr = knob.getBoundingClientRect();
      if (e.clientX > kr.right + 16) {   // Tipp auf die Rille: Griff zuckt kurz an (Hinweis „schieben“)
        if (p < 0.02) animateTo(0.14, 170, easeOut, () => animateTo(0, 420, springBack));
        return;
      }
      cancelAnimationFrame(anim);
      drag = { id: e.pointerId, x0: e.clientX - p * range() };
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      set((e.clientX - drag.x0) / range());
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null; el.classList.remove('drag');
      if (p >= 0.94) complete();
      else animateTo(0, 520, springBack);   // vor dem Ende losgelassen: Griff federt zurück, Messer hebt sich
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', (e) => {
      if (busy || !['Enter', ' ', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      animateTo(1, 650, (t) => t * t * (3 - 2 * t), complete);
    });
    return {
      el, txt,
      reset() { cancelAnimationFrame(anim); drag = null; busy = false; el.classList.remove('done', 'drag'); set(0); },
      get busy() { return busy; },
    };
  })();

  function show() {
    if (started) scene3d.reset();   // nach dem Spiel: frische Seife
    slide.reset();
    refreshStart();
    document.body.classList.add('menu-open');
    start.classList.remove('gone');
    placeSoaps();
    clearTimeout(stopT); scene3d.start();
    requestAnimationFrame(() => { start.classList.add('open'); openedAt = performance.now(); });
  }
  function hide() {
    started = true;
    start.classList.remove('open');
    document.body.classList.remove('menu-open');
    clearTimeout(stopT);
    stopT = setTimeout(() => { if (!start.classList.contains('open')) { start.classList.add('gone'); scene3d.stop(); } }, 650);
  }

  // ---------- Einstellungen ----------
  function syncSound() {
    const b = $('set-sound');
    b.classList.toggle('on', sound.on);
    b.setAttribute('aria-checked', String(sound.on));
    $('set-sound-ic').innerHTML = sound.on ? ICON.soundOn : ICON.soundOff;
  }
  $('set-sound').onclick = () => { sound.on = !sound.on; syncSound(); if (sound.on) sndWood(); };
  $('set-reset').onclick = () => openModal('confirm');
  $('confirm-no').onclick = () => closeModal('confirm');
  $('confirm-yes').onclick = () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* egal */ }
    location.reload();
  };

  // ---------- Sammlung ----------
  function fillCollection() {
    const rows = [
      ['Verpackungen', ICON.box, PACKAGE_TYPES, 'rose'],
      ['Dekoration', ICON.leaf, DECO_ITEMS, 'honey'],
      ['Zusätze', ICON.drop, ADDITIVES, 'mint'],
      ['Seifenformen', ICON.heart, SOAP_SHAPES, 'rose'],
    ];
    $('col-rows').innerHTML = rows.map(([name, ic, list, c]) => {
      const n = list.filter((x) => x.unlocked).length, all = list.length;
      return `<div class="col-row ${c}"><span class="col-ic">${ic}</span><span class="col-txt"><b>${name}</b><span class="col-bar"><i style="width:${Math.round(n / all * 100)}%"></i></span></span><span class="col-n">${n}<small>/${all}</small></span></div>`;
    }).join('') + `<div class="col-coins">${rich(`Guthaben ${getCoins()} 🪙`)}</div>`;
  }

  // ---------- Knöpfe ----------
  $('start-new').onclick = () => openModal('confirm');
  $('start-settings').onclick = () => { syncSound(); openModal('settings'); };
  $('start-collection').onclick = () => { fillCollection(); openModal('collection'); };
  $('menu-btn').onclick = () => show();
  for (const m of document.querySelectorAll('.modal')) {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.m-close')) m.classList.remove('open'); });
  }
  syncSound();

  // ?start=0 (Tests/Debug): direkt ins Spiel
  if (new URLSearchParams(location.search).get('start') === '0') { started = true; start.classList.add('gone'); document.body.classList.remove('menu-open'); }
  else show();

  return {
    show, hide,
    get open() { return start.classList.contains('open'); },
    /** Startbildschirm deckt das Spiel komplett ab (nach dem Einblenden) -> Spielszene nicht rendern. */
    covers() { return start.classList.contains('open') && performance.now() - openedAt > 600; },
  };
}
