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
import icoOrders from './assets/home/orders.webp';
import icoShelf from './assets/home/shelf.webp';
import icoKitchen from './assets/home/kitchen.webp';
import icoPack from './assets/home/pack.webp';
const HOME_ICONS = { orders: icoOrders, shelf: icoShelf, kitchen: icoKitchen, pack: icoPack };
import avatarSheet from './assets/avatars/kunden.webp';
import { soapCss } from './cabinet.js';
import { shapeIconURL, DEFAULT_SHAPE } from './shapes.js';
// Kunden-Porträts (4×4-Blatt, generiert): Name -> Zelle
const AVATAR = { Anna: 0, Lea: 1, Clara: 2, Mila: 3, Greta: 4, Ida: 5, Frieda: 6, Sophie: 7, Emil: 8, Ben: 9, Paul: 10, Jonas: 11, Oskar: 12, Theo: 14 };
const CARD_COLORS = ['c-mint', 'c-sun', 'c-lilac', 'c-peach', 'c-sky'];

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

export function createMenu({ getCoins, board = null }) {
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
    // Hauptmenü: Fortschrittsleiste (Münzen links, Freigeschaltetes als Leiste bis zum Stern)
    const lists = [PACKAGE_TYPES, DECO_ITEMS, ADDITIVES, SOAP_SHAPES];
    const un = lists.reduce((a, l) => a + l.filter((t) => t.unlocked).length, 0), all = lists.reduce((a, l) => a + l.length, 0);
    $('home-bar').innerHTML = `<span class="hb-coin">${ICON.coin}<b>${getCoins()}</b></span><span class="hb-track"><i style="width:${Math.max(6, Math.round(un / all * 100))}%"></i><em>${un}/${all}</em></span><span class="hb-star">${ICON.star}</span>`;
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
        setTimeout(() => { goHome(); }, 750);   // kurz den fallenden Würfeln zusehen, dann ins Hauptmenü
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

  // Hauptmenü (nach dem Schieben bzw. aus dem Spiel): Werkstatt-Hintergrund, 2×2 Kacheln; 3D-Szene aus
  let homeT = 0;
  function goHome() {
    refreshStart();
    start.classList.add('home');
    clearTimeout(homeT);
    homeT = setTimeout(() => { if (start.classList.contains('home')) scene3d.stop(); }, 700);
  }
  for (const b of start.querySelectorAll('.tile')) {
    b.querySelector('img').src = HOME_ICONS[b.dataset.tile];
    b.addEventListener('click', () => {
      b.classList.remove('wob'); void b.offsetWidth; b.classList.add('wob');   // kleiner Wackler (noch ohne eigene Seite)
      if (b.dataset.tile === 'kitchen') setTimeout(() => { if (start.classList.contains('open')) hide(); }, 320);   // Küche = bisheriges Spiel
      if (b.dataset.tile === 'orders' && board) setTimeout(openOrders, 220);
    });
    b.addEventListener('animationend', () => b.classList.remove('wob'));
  }

  // ---------- Bestellungen: die echten Aufträge vom Brett (game.notes.orders), je Seife ein Schüssel-Slot ----------
  // Schüsselinhalt als SVG: Grundfarbe = größte Sorte, die anderen als verwirbelte Spiralbänder (Farben der echten Sorten)
  function spiral(turn, r0, r1, rot) {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40, a = rot + t * turn * Math.PI * 2, r = r0 + (r1 - r0) * t;
      pts.push(`${(50 + Math.cos(a) * r * 50).toFixed(1)},${(20 + Math.sin(a) * r * 20).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }
  function bowlMix(mix) {
    const [first, ...rest] = mix;
    let svg = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><rect width="100" height="40" fill="${soapCss(first.soap)}"/>`;
    rest.forEach((m, k) => {
      const w = 4 + m.pct * 0.22, rot = (k + 1) * 2.4;
      svg += `<path d="${spiral(1.6, 0.08, 0.95, rot)}" fill="none" stroke="${soapCss(m.soap)}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
    });
    return svg + '</svg>';
  }
  function orderCard(o, i, st) {
    const items = o.items || [o];
    const slots = items.map((it, k) => {
      const ext = [];
      if (it.shape && it.shape !== DEFAULT_SHAPE) ext.push(`<span><img src="${shapeIconURL(it.shape.id, 48)}" alt="">${rich(it.shape.name)}</span>`);
      if (it.additive) ext.push(`<span>${ICON.drop}${rich(it.additive.name)}</span>`);
      return `<div class="oc-slot"><div class="bowl"><i>${bowlMix(it.mix)}</i></div>`
        + `<div class="oc-mix">${it.mix.map((m) => `<span><i style="background:${soapCss(m.soap)}"></i>${rich(m.soap.name)} <b>${m.pct}&nbsp;%</b></span>`).join('')}</div>`
        + (ext.length ? `<div class="oc-ext">${ext.join('')}</div>` : '')
        + `<div class="oc-chip"><i class="bar"></i>${items.length > 1 ? `Seife ${k + 1}` : '1 Seife'}</div></div>`;
    }).join('');
    const av = AVATAR[o.customer] ?? (o.customer.length % 16);
    const live = st.active === o;
    return `<button class="ord-card ${CARD_COLORS[i % CARD_COLORS.length]}${live ? ' live' : ''}${!live && !st.canAccept ? ' wait' : ''}" data-i="${i}">`
      + `<div class="oc-who"><span class="oc-av" style="background-image:url(${avatarSheet});background-position:${(av % 4) / 3 * 100}% ${Math.floor(av / 4) / 3 * 100}%"></span><b>${rich(o.customer)}</b></div>`
      + `<div class="oc-slots n${Math.min(items.length, 2)}">${slots}</div>`
      + `<div class="oc-reward"><small>bis</small>${ICON.coin}<b>${Math.round((o.total || o.reward) * 1.25)}</b></div>`
      + (live ? '<div class="oc-badge">Läuft gerade</div>' : '') + '</button>';
  }
  function renderOrders() {
    const st = board();
    const list = st.orders.map((o, i) => (o ? orderCard(o, i, st) : '')).join('');
    $('ord-list').innerHTML = list || '<div class="ord-empty">Gerade keine Bestellungen – gleich kommen neue!</div>';
    $('ord-msg').textContent = st.active ? 'Eine Bestellung läuft gerade – tippe sie an, um weiterzumachen.' : st.canAccept ? 'Tippe eine Bestellung an, um sie anzunehmen.' : '';
    for (const c of $('ord-list').querySelectorAll('.ord-card')) {
      c.onclick = () => {
        const i = +c.dataset.i, s2 = board();
        c.classList.remove('wob'); void c.offsetWidth; c.classList.add('wob');
        if (s2.active && s2.orders[i] === s2.active) { setTimeout(() => hide(), 260); return; }   // laufende Bestellung: zurück ins Spiel
        if (!s2.canAccept) { $('ord-msg').textContent = 'Erst die laufende Bestellung abschließen.'; return; }
        setTimeout(() => { hide(); s2.accept(i); }, 260);   // annehmen -> Spiel startet mit dieser Bestellung (Regal)
      };
      c.addEventListener('animationend', () => c.classList.remove('wob'));
    }
  }
  function openOrders() { renderOrders(); $('ord-list').scrollTop = 0; start.classList.add('orders'); }
  function closeOrders() { start.classList.remove('orders'); refreshStart(); }
  $('ord-back').onclick = closeOrders;

  function show() {
    start.classList.remove('orders');
    const home = started;   // aus dem Spiel zurück: direkt ins Hauptmenü
    slide.reset();
    start.classList.toggle('home', home);
    refreshStart();
    document.body.classList.add('menu-open');
    start.classList.remove('gone');
    placeSoaps();
    clearTimeout(stopT);
    if (!home) scene3d.start();
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
