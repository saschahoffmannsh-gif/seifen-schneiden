// DOM-Oberfläche: Bestellung (unter der Schale), Münzen, Knöpfe, Ofen-Balken, schwebende Texte, FPS.

const $ = (id) => document.getElementById(id);

export function createUI() {
  const el = {
    orderText: $('order-text'), orderProgress: $('order-progress'), coins: $('coin-count'),
    coinPill: $('coins'), hint: $('hint'),
    oven: $('oven'), cutBox: $('cut-progress'), cutLabel: $('cut-label'), cutBar: $('cut-bar'), ovenBar: $('oven-bar'), actions: $('actions'), popups: $('popups'), fps: $('fps'),
  };

  const WORDS = ['So satisfying!', 'Entspannend!', 'Wow!', 'Herrlich!', 'Perfekt!', 'Weiter so!', 'Mmmh!'];

  return {
    setOrder(order, cutIds) {
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
