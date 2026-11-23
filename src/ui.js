// DOM-Oberfläche: Bestellung (unter der Schale), Münzen, Knöpfe, Ofen-Balken, schwebende Texte, FPS.

import { soapCss } from './cabinet.js';
import { sndCoin as sndOk } from './audio.js';

const $ = (id) => document.getElementById(id);

export function createUI() {
  const el = {
    orderText: $('order-text'), orderProgress: $('order-progress'), coins: $('coin-count'),
    coinPill: $('coins'), hint: $('hint'),
    oven: $('oven'), cutBox: $('cut-progress'), cutLabel: $('cut-label'), cutBar: $('cut-bar'), ovenBar: $('oven-bar'), actions: $('actions'), popups: $('popups'), fps: $('fps'),
  };

  let covered = false, coverTimer = 0;   // Vollbild-Schrank verdeckt die Szene -> nicht rendern
  const WORDS = ['So satisfying!', 'Entspannend!', 'Wow!', 'Herrlich!', 'Perfekt!', 'Weiter so!', 'Mmmh!'];

  return {
    setOrder(order, cutIds) {
      $('order').classList.toggle('hidden', !order);
      if (!order) return;
      el.orderText.textContent = `${order.customer} möchte:`;
      el.orderProgress.innerHTML = order.soaps
        .map((s) => `<span class="${cutIds.has(s.id) ? 'done' : ''}">${cutIds.has(s.id) ? '✔' : '○'} ${s.emoji} ${s.name}</span>`)
        .join('');
    },
    setCoins(n, bump) {
      el.coins.textContent = n;
      if (bump) { el.coinPill.classList.add('bump'); setTimeout(() => el.coinPill.classList.remove('bump'), 200); }
    },
    /** Deko-Bonus auf dem Bestell-Zettel ('+15 🪙 Deko'). */
    setDeco(n) {
      const d = $('order-deco');
      d.textContent = n > 0 ? `+${n} 🪙 Deko` : '';
      d.classList.toggle('hidden', !(n > 0));
    },
    hint(text) { el.hint.textContent = text || ''; },
    /**
     * Auswahl-Sheet (Päckchen und Deko): unten, waagerecht scrollbar, Reiter je Kategorie.
     * items: [{ id, name, sub, thumb, unlocked, cost, bonus, cat, disabled }]
     * o: { title, cats, onSelect(item, ev), onHold(item, ev) (gedrückt halten), onBuy(item) -> bool, onClose, coins() }
     */
    openSheet(items, o) {
      const root = $('pkg-picker'), list = $('pkg-list'), tabs = $('pkg-tabs'), note = $('pkg-note');
      $('pkg-title').textContent = o.title;
      list.innerHTML = ''; tabs.innerHTML = '';
      const cats = (o.cats || []).filter((c) => items.some((it) => it.cat === c));
      const firstOf = {};
      const flash = (text) => {
        note.textContent = text; note.classList.add('show');
        clearTimeout(note._t); note._t = setTimeout(() => note.classList.remove('show'), 1300);
      };
      let closed = false;
      const close = (cancelled) => {
        if (closed) return; closed = true;
        root.classList.remove('open');
        root.onclick = null; $('pkg-close').onclick = null; list.onscroll = null;
        if (cancelled && o.onClose) o.onClose();
      };
      items.forEach((it) => {
        const b = document.createElement('button');
        b.className = 'pkg-card' + (it.unlocked ? '' : ' locked') + (it.disabled ? ' disabled' : '');
        b.innerHTML = `<img alt="" src="${it.thumb}"><span class="pkg-name">${it.name}</span>`
          + (it.unlocked ? `<span class="pkg-sub">${it.sub || ''}</span>` : `<span class="pkg-sub">🔒 ${it.cost} 🪙</span><span class="lock">🔒</span>`);
        b.dataset.cat = it.cat || '';
        if (it.cat && !(it.cat in firstOf)) firstOf[it.cat] = b;
        const locked = () => {
          this.openUnlock(it, o.coins(), () => {
            if (!o.onBuy(it)) return false;
            it.unlocked = true;
            b.classList.remove('locked');
            b.querySelector('.lock')?.remove();
            b.querySelector('.pkg-sub').textContent = it.sub || '';
            return true;
          });
        };
        // Gedrückt halten (Deko): nach kurzer Zeit ohne Wischen startet das Ziehen
        let hold = 0, sx = 0, sy = 0, held = false;
        b.addEventListener('pointerdown', (e) => {
          held = false;
          if (!o.onHold || !it.unlocked || it.disabled) return;
          sx = e.clientX; sy = e.clientY;
          clearTimeout(hold);
          hold = setTimeout(() => { held = true; close(false); o.onHold(it, e); }, 230);
        });
        b.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 10 && !held) clearTimeout(hold); });
        const cancelHold = () => clearTimeout(hold);
        b.addEventListener('pointerup', cancelHold); b.addEventListener('pointercancel', cancelHold);
        b.addEventListener('click', (e) => {
          clearTimeout(hold);
          if (held) return;
          if (!it.unlocked) { locked(); return; }
          if (it.disabled) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); flash(it.disabled); return; }
          close(false); o.onSelect(it, e);
        });
        list.appendChild(b);
      });
      // Reiter: springen zur Kategorie, markieren die sichtbare
      const tabEls = cats.map((c) => {
        const t = document.createElement('button');
        t.className = 'tab'; t.textContent = c;
        t.onclick = () => { list.scrollTo({ left: firstOf[c].offsetLeft - 4, behavior: 'smooth' }); };
        tabs.appendChild(t);
        return t;
      });
      tabs.style.display = cats.length > 1 ? '' : 'none';
      const mark = () => {
        let cur = 0;
        cats.forEach((c, k) => { if (firstOf[c].offsetLeft - 30 <= list.scrollLeft) cur = k; });
        if (list.scrollLeft + list.clientWidth >= list.scrollWidth - 4) cur = cats.length - 1;
        tabEls.forEach((t, k) => t.classList.toggle('on', k === cur));
      };
      list.onscroll = mark;
      $('pkg-close').onclick = () => close(true);
      root.onclick = (e) => { if (e.target === root) close(true); }; // Tipp neben das Fenster
      root.classList.add('open');
      list.scrollLeft = o.startCat && firstOf[o.startCat] ? Math.max(0, firstOf[o.startCat].offsetLeft - 4) : 0; mark();
      return { close };
    },
    /** Freischalt-Dialog: Kosten, Bonus und Knopf (geht nur mit genug Münzen). */
    openUnlock(it, coins, buy) {
      const root = $('unlock'), btn = $('unlock-buy');
      $('unlock-img').src = it.thumb;
      $('unlock-name').textContent = it.name;
      $('unlock-bonus').textContent = `+${it.bonus} 🪙 pro Verkauf`;
      $('unlock-have').textContent = `Du hast ${coins} 🪙`;
      const enough = coins >= it.cost;
      btn.disabled = !enough;
      btn.textContent = enough ? `Freischalten für ${it.cost} 🪙` : `Zu wenig Münzen (${it.cost} 🪙)`;
      const close = () => { root.classList.remove('open'); btn.onclick = null; root.onclick = null; };
      btn.onclick = () => { if (buy()) { sndOk(); close(); } };
      $('unlock-close').onclick = close;
      root.onclick = (e) => { if (e.target === root) close(); };
      root.classList.add('open');
    },
    /** Bestell-Zettel groß. canAccept=false -> nur lesen (Knopf gesperrt). */
    openNote(order, canAccept, onAccept) {
      const root = $('note-view'), btn = $('note-accept');
      $('note-customer').textContent = order.customer;
      $('note-soaps').innerHTML = order.soaps.map((s) =>
        `<div class="note-soap"><div class="bar-chip" style="background:${soapCss(s)}">${s.emoji}</div>${s.name}</div>`).join('');
      $('note-reward').textContent = `Belohnung: ${order.reward} 🪙`;
      btn.disabled = !canAccept;
      btn.textContent = canAccept ? 'Annehmen' : 'Erst aktuelle Bestellung fertig machen';
      const close = () => { root.classList.remove('open'); root.onclick = null; $('note-close').onclick = null; btn.onclick = null; };
      $('note-close').onclick = close;
      root.onclick = (e) => { if (e.target === root) close(); };
      btn.onclick = () => { if (!canAccept) return; close(); onAccept(); };
      root.classList.add('open');
    },
    sceneCovered() { return covered; },
    noteOpen() { return $('note-view').classList.contains('open'); },
    /**
     * Seifenschrank im Vollbild. layout: Schubladen (cabinet.js). marked(d): Schublade schon gewählt?
     * pick(d) -> Fehlertext (String) oder { find, done }: Schublade fährt raus und bleibt markiert;
     * done = Funktion -> alles gefunden, Schrank geht zu, danach done().
     */
    openCabinet(layout, findText, marked, pick, onClose) {
      const root = $('cabinet'), grid = $('cab-grid'), msg = $('cab-msg');
      if (!grid.childElementCount) {
        for (const d of layout) {
          const b = document.createElement('button');
          b.className = 'drawer ' + d.kind;
          const col = d.kind === 'soap' ? soapCss(d.soap) : d.kind === 'locked' ? d.color : 'transparent';
          const name = d.kind === 'soap' ? d.soap.name : d.kind === 'locked' ? d.name : 'leer';
          b.innerHTML = `<span class="soap-pop" style="background:${col}"></span><span class="lab"><span class="dot" style="background:${col}"></span><span class="nm${name.length > 8 ? ' long' : ''}">${name}</span></span><span class="pull"></span>`;
          b._d = d;
          grid.appendChild(b);
        }
      }
      for (const b of grid.children) { b.classList.remove('shake'); b.classList.toggle('out', marked(b._d)); }
      $('cab-find').textContent = findText;
      let busy = false;
      const shut = (then) => {
        root.classList.remove('open');
        covered = false; clearTimeout(coverTimer);
        grid.onclick = null; $('cab-close').onclick = null;
        setTimeout(() => { root.classList.remove('show'); then && then(); }, 480);
      };
      grid.onclick = (e) => {
        const b = e.target.closest('.drawer');
        if (!b || busy || b.classList.contains('out')) return;
        const r = pick(b._d);
        if (typeof r === 'string') {
          b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          msg.textContent = r; msg.classList.add('show');
          clearTimeout(msg._t); msg._t = setTimeout(() => msg.classList.remove('show'), 1300);
          return;
        }
        b.classList.add('out');
        $('cab-find').textContent = r.find;
        if (r.done) { busy = true; setTimeout(() => shut(r.done), 750); }
      };
      $('cab-close').onclick = () => { if (!busy) shut(onClose); };
      msg.classList.remove('show');
      grid.scrollTop = 0;
      root.classList.add('show');
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
      clearTimeout(coverTimer); coverTimer = setTimeout(() => { covered = true; }, 520);
    },
    showOven(show) { el.oven.classList.toggle('hidden', !show); document.body.classList.toggle('oven-open', show); },
    setOven(frac) { el.ovenBar.style.width = `${Math.round(frac * 100)}%`; },
    /** Knöpfe unten setzen: [{label, alt, onClick}] */
    actions(list) {
      el.actions.innerHTML = '';
      for (const a of list) {
        const b = document.createElement('button');
        b.className = 'btn' + (a.alt ? ' alt' : '');
        b.textContent = a.label;
        b.addEventListener('click', a.onClick);
        el.actions.appendChild(b);
      }
    },
    popup(text) {
      const d = document.createElement('div');
      d.className = 'popup';
      d.textContent = text || WORDS[(Math.random() * WORDS.length) | 0];
      // lange Texte (Deko-Namen) kleiner und mittig, damit nichts über den Rand ragt
      const long = d.textContent.length > 12;
      if (long) d.style.fontSize = `${Math.min(30, Math.floor(window.innerWidth * 1.5 / d.textContent.length))}px`;
      d.style.left = long ? '50%' : `${40 + Math.random() * 20}%`;
      el.popups.appendChild(d);
      setTimeout(() => d.remove(), 1150);
    },
    /** Schneide-Fortschritt der aktuellen Seife (0..1) oder null zum Ausblenden. Nur bei Änderung ins DOM schreiben. */
    setCut(frac, soap) {
      if (frac == null) { el.cutBox.classList.add('hidden'); this._cutPct = -1; return; }
      el.cutBox.classList.remove('hidden');
      const pct = Math.round(frac * 100);
      if (pct === this._cutPct) return;
      this._cutPct = pct;
      el.cutLabel.textContent = `${soap ? soap.emoji + ' ' : ''}Geschnitten: ${pct} %`;
      el.cutBar.style.width = `${pct}%`;
    },
    showFps(show) { el.fps.classList.toggle('hidden', !show); },
    setFps(text) { el.fps.textContent = text; },
  };
}
