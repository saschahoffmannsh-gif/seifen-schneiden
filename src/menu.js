// Startbildschirm (Spielen / Fortsetzen / Neu beginnen), Einstellungen (Ton, Fortschritt zurücksetzen),
// Sammlung (wie viel schon freigeschaltet ist) und Pause-Menü über den Knopf oben links.
// Reines DOM, keine Dauer-Animationen außer ein paar CSS-Transforms (Seifenblasen) auf dem Startbildschirm.
import { ICON, rich } from './icons.js';
import { sound } from './sound.js';
import { PACKAGE_TYPES } from './decor.js';
import { DECO_ITEMS } from './decoItems.js';
import { ADDITIVES } from './additives.js';
import { sndPop } from './audio.js';

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
  let started = false;

  function refreshStart() {
    const prog = hasProgress();
    const playBtn = $('start-play');
    playBtn.innerHTML = ICON.play + `<span>${started ? 'Weiterspielen' : prog ? 'Fortsetzen' : 'Spielen'}</span>`;
    $('start-new').style.display = prog && !started ? '' : 'none';
    const p = $('st-progress');
    if (prog || started) {
      const n = PACKAGE_TYPES.filter((t) => t.unlocked).length + DECO_ITEMS.filter((t) => t.unlocked).length + ADDITIVES.filter((t) => t.unlocked).length;
      p.innerHTML = `<span class="chip">${ICON.coin}<b>${getCoins()}</b></span><span class="chip">${ICON.sparkle}<b>${n}</b> freigeschaltet</span>`;
      p.style.display = '';
    } else p.style.display = 'none';
  }

  function show() {
    refreshStart();
    document.body.classList.add('menu-open');
    start.classList.remove('gone');
    requestAnimationFrame(() => start.classList.add('open'));
  }
  function hide() {
    started = true;
    start.classList.remove('open');
    document.body.classList.remove('menu-open');
    setTimeout(() => { if (!start.classList.contains('open')) start.classList.add('gone'); }, 450);
  }

  // ---------- Einstellungen ----------
  function syncSound() {
    const b = $('set-sound');
    b.classList.toggle('on', sound.on);
    b.setAttribute('aria-checked', String(sound.on));
    $('set-sound-ic').innerHTML = sound.on ? ICON.soundOn : ICON.soundOff;
  }
  $('set-sound').onclick = () => { sound.on = !sound.on; syncSound(); if (sound.on) sndPop(); };
  $('set-reset').onclick = () => openModal('confirm');
  $('confirm-no').onclick = () => closeModal('confirm');
  $('confirm-yes').onclick = () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* egal */ }
    location.reload();
  };

  // ---------- Sammlung ----------
  function fillCollection() {
    const rows = [
      ['Päckchen', ICON.box, PACKAGE_TYPES, 'rose'],
      ['Deko', ICON.heart, DECO_ITEMS, 'honey'],
      ['Zusätze', ICON.sparkle, ADDITIVES, 'mint'],
    ];
    $('col-rows').innerHTML = rows.map(([name, ic, list, c]) => {
      const n = list.filter((x) => x.unlocked).length, all = list.length;
      return `<div class="col-row ${c}"><span class="col-ic">${ic}</span><span class="col-txt"><b>${name}</b><span class="col-bar"><i style="width:${Math.round(n / all * 100)}%"></i></span></span><span class="col-n">${n}<small>/${all}</small></span></div>`;
    }).join('') + `<div class="col-coins">${rich(`Du hast ${getCoins()} 🪙`)}</div>`;
  }

  // ---------- Knöpfe ----------
  $('start-play').onclick = () => { hide(); };
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

  return { show, hide, get open() { return start.classList.contains('open'); } };
}
