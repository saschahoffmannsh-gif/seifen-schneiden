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
