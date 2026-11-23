// DOM-Oberfläche: Bestellung (unter der Schale), Münzen, Knöpfe, Ofen-Balken, schwebende Texte, FPS.

import { soapCss } from './cabinet.js';

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
    hint(text) { el.hint.textContent = text || ''; },
    /**
     * Päckchen-Auswahl (Bottom-Sheet, waagerecht scrollbar). types: [{id,name,unlocked,cost}],
     * thumbs: Vorschaubilder (data-URLs). onSelect(type) bei freigeschalteter Sorte, onClose beim Schließen.
     */
    openPicker(types, thumbs, onSelect, onClose) {
      const root = $('pkg-picker'), list = $('pkg-list');
      list.innerHTML = '';
      types.forEach((t, i) => {
        const b = document.createElement('button');
        b.className = 'pkg-card' + (t.unlocked ? '' : ' locked');
        b.innerHTML = `<img alt="" src="${thumbs[i]}"><span class="pkg-name">${t.name}</span>`
          + (t.unlocked ? '<span class="pkg-sub">Standard</span>' : `<span class="pkg-sub">🔒 ${t.cost} 🪙</span><span class="lock">🔒</span>`);
        b.addEventListener('click', () => {
          if (!t.unlocked) {
            b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
            note.textContent = 'Noch gesperrt'; note.classList.add('show');
            clearTimeout(note._t); note._t = setTimeout(() => note.classList.remove('show'), 1200);
            return;
          }
          close(false); onSelect(t);
        });
        list.appendChild(b);
      });
      const note = $('pkg-note');
      const close = (cancelled) => {
        root.classList.remove('open');
        root.onclick = null; $('pkg-close').onclick = null;
        if (cancelled && onClose) onClose();
      };
      $('pkg-close').onclick = () => close(true);
      root.onclick = (e) => { if (e.target === root) close(true); }; // Tipp neben das Fenster
      list.scrollLeft = 0;
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
      d.style.left = `${40 + Math.random() * 20}%`;
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
