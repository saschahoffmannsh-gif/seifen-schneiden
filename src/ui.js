// DOM-Oberfläche: Bestellung (unter der Schale), Münzen, Knöpfe, schwebende Texte, FPS.

import { soapCss } from './cabinet.js';
import { sndCoins } from './audio.js';
import { shapeIconURL } from './shapes.js';
import { ICON, rich, buttonLabel } from './icons.js';

const $ = (id) => document.getElementById(id);

export function createUI() {
  const el = {
    orderText: $('order-text'), orderProgress: $('order-progress'), coins: $('coin-count'),
    coinPill: $('coins'), hint: $('hint'),
    cutBox: $('cut-progress'), cutLabel: $('cut-label'), cutBar: $('cut-bar'), actions: $('actions'), popups: $('popups'), fps: $('fps'),
  };

  let covered = false, coverTimer = 0;   // Vollbild-Schrank verdeckt die Szene -> nicht rendern
  const WORDS = ['Wunderbar', 'Herrlich', 'Sehr fein', 'Wie Butter', 'Schön gleichmäßig', 'Perfekt', 'So entspannend'];

  // Hinweis-Zeile folgt dem Zettel auch bei Höhenänderungen durch reine CSS-Zustände
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      const o = $('order');
      document.documentElement.style.setProperty('--order-h', o.classList.contains('hidden') ? '50px' : `${o.offsetHeight}px`);
    }).observe($('order'));
  }
  return {
    setOrder(order) {
      $('order').classList.toggle('hidden', !order);
      this._mixKey = '';
      if (!order) { this.layoutOrder(); return; }
      el.orderText.innerHTML = `<span class="avatar">${rich(order.customer[0])}</span><b>${rich(order.customer)}</b> wünscht sich`;
      this.setMix(order, null, 0, []);
    },
    /**
     * Mischungs-Anzeige im Bestell-Zettel: je Sorte ein Balken (jetzt in der Form) mit Ziel-Strich,
     * darunter die Füllung der Form (100 % = voll). pcts: { soapId: Prozent } oder null.
     * Schreibt ins DOM nur, wenn sich die gerundeten Werte ändern.
     */
    setMix(order, pcts, fill, adds, stockOf, takenOf) {
      if (!order) return;
      const key = order.id + '|' + order.mix.map((m) => Math.round(pcts ? pcts[m.soap.id] || 0 : 0) + (stockOf ? '/' + stockOf(m.soap.id) : '')).join(',') + '|' + Math.round(fill) + '|' + adds.map((a) => a.id).join(',') + '|' + (takenOf ? order.mix.map((m) => takenOf(m.soap.id)).join(',') : '');
      if (key === this._mixKey) return;
      this._mixKey = key;
      const row = (label, col, val, target, scale, cls = '') => {
        const w = Math.min(100, val / scale * 100), t = target / scale * 100;
        const near = Math.abs(val - target) <= 3 ? ' ok' : val > target + 3 ? ' over' : '';
        return `<div class="mx${cls}${near}"><span class="mx-n"><i class="sw" style="background:${col}"></i>${label}</span><span class="mx-bar"><i style="width:${w}%;background:${col}"></i><b style="left:${t}%"></b></span>`
          + `<span class="mx-v">${Math.round(val)}<small>/${target} %</small></span></div>`;
      };
      // mehr als ein Stück aus dem Schrank geholt: '×2' hinter dem Namen
      const tk = (m) => { const n = takenOf ? takenOf(m.soap.id) : 0; return n > 1 ? ` <em class="mx-x">×${n}</em>` : ''; };
      let h = order.mix.map((m) => row(rich(m.soap.name) + tk(m), soapCss(m.soap), pcts ? pcts[m.soap.id] || 0 : 0, m.pct, 100)).join('');
      h += row('Füllung', '#c9a27a', fill, 100, 125, ' total');
      if (adds.length || order.additive) {
        const need = order.additive;
        h += `<div class="mx-add">${ICON.drop}${need ? rich((adds.includes(need) ? '✔ ' : '') + need.name + (adds.includes(need) ? '' : ' gewünscht')) : ''}${rich(adds.filter((a) => a !== need).map((a) => (need ? ' · ' : '') + a.name).join(need ? '' : ' · '))}</div>`;
      }
      el.orderProgress.innerHTML = h;
      this.layoutOrder();
    },
    /** Hinweis-Zeile rutscht unter den (unterschiedlich hohen) Bestell-Zettel. */
    layoutOrder() {
      const o = $('order');
      document.documentElement.style.setProperty('--order-h', o.classList.contains('hidden') ? '50px' : `${o.offsetHeight}px`);
    },
    /** Nach dem Ausformen: statt der Balken nur noch eine Zeile mit dem Ergebnis. */
    setMixSummary(q) {
      el.orderProgress.innerHTML = `<div class="mx-sum"><span class="mini-stars">${[0, 1, 2].map((k) => `<span class="${k < q.stars ? 'on' : 'off'}">${ICON.star}</span>`).join('')}</span> Mischung ${q.accuracy} % genau</div>`;
      this._mixKey = '';
      this.layoutOrder();
    },
    setCoins(n, bump) {
      el.coins.textContent = n;
      if (bump) { el.coinPill.classList.add('bump'); setTimeout(() => el.coinPill.classList.remove('bump'), 200); }
    },
    /** Deko-Bonus auf dem Bestell-Zettel ('+15 🪙 Deko'). */
    setDeco(n) {
      const d = $('order-deco');
      d.innerHTML = n > 0 ? rich(`+${n} 🪙 Deko`) : '';
      d.classList.toggle('hidden', !(n > 0));
    },
    hint(text) { el.hint.innerHTML = rich(text || ''); },
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
        b.innerHTML = `<span class="pkg-thumb"><img alt="" src="${it.thumb}"></span><span class="pkg-name">${rich(it.name)}</span>`
          + (it.unlocked ? `<span class="pkg-sub">${rich(it.sub || '')}</span>` : `<span class="pkg-sub price">${ICON.coin}${it.cost}</span><span class="lock">${ICON.lock}</span>`);
        b.dataset.cat = it.cat || '';
        if (it.cat && !(it.cat in firstOf)) firstOf[it.cat] = b;
        const locked = () => {
          this.openUnlock(it, o.coins(), () => {
            if (!o.onBuy(it)) return false;
            it.unlocked = true;
            b.classList.remove('locked');
            b.querySelector('.lock')?.remove();
            const sub = b.querySelector('.pkg-sub'); sub.classList.remove('price'); sub.innerHTML = rich(it.sub || '');
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
    openUnlock(it, coins, buy, o = {}) {
      const root = $('unlock'), btn = $('unlock-buy');
      $('unlock-img').src = it.thumb;
      $('unlock-name').textContent = it.name;
      $('unlock-bonus').innerHTML = rich(o.line || `+${it.bonus} 🪙 pro Verkauf`);
      $('unlock-have').innerHTML = rich(`Guthaben ${coins} 🪙`);
      const enough = coins >= it.cost;
      btn.disabled = !enough;
      btn.innerHTML = rich(!it.cost ? (o.verb || 'Nehmen') : enough ? `${o.verb || 'Freischalten'} für ${it.cost} 🪙` : `Zu wenig Münzen · ${it.cost} 🪙`);
      const close = () => { root.classList.remove('open'); btn.onclick = null; root.onclick = null; };
      btn.onclick = () => { if (buy()) { if (it.cost) sndCoins(false); close(); } };
      $('unlock-close').onclick = close;
      root.onclick = (e) => { if (e.target === root) close(); };
      root.classList.add('open');
    },
    /** Bestell-Zettel groß. canAccept=false -> nur lesen (Knopf gesperrt). */
    openNote(order, canAccept, onAccept, o2 = {}) {
      const root = $('note-view'), btn = $('note-accept');
      $('note-customer').textContent = order.customer;
      // Mischung: Kuchen-Diagramm + Zeilen mit Prozent und Vorrat
      let acc = 0;
      const pie = order.mix.map((m) => { const a = acc; acc += m.pct; return `${soapCss(m.soap)} ${a}% ${acc}%`; }).join(',');
      const stock = o2.stockOf || (() => null);
      $('note-soaps').innerHTML = `<div class="note-pie" style="background:conic-gradient(${pie})"></div><div class="note-mix">`
        + order.mix.map((m) => {
          const st = stock(m.soap.id), need = m.pct / 10, low = st != null && st < need;
          return `<div class="note-row"><i class="sw" style="background:${soapCss(m.soap)}"></i><span class="nr-name">${rich(m.soap.name)}</span><b>${m.pct} %</b>`
            + (st != null ? `<small class="${low ? 'low' : ''}">Vorrat ${st}</small>` : '') + '</div>';
        }).join('')
        + (order.shape ? `<div class="note-row shape"><img class="sh-ic" src="${shapeIconURL(order.shape.id, 64)}" alt=""><span class="nr-name">Form</span><b>${rich(order.shape.name)}</b></div>` : '')
        + (order.additive ? `<div class="note-row add">${ICON.drop}mit ${rich(order.additive.name)}</div>` : '') + '</div>';
      $('note-reward').innerHTML = `<span class="reward-chip">Belohnung bis ${ICON.coin}<b>${Math.round(order.reward * 1.25)}</b></span>`;
      btn.disabled = !canAccept;
      btn.textContent = canAccept ? 'Bestellung annehmen' : 'Erst die aktuelle Bestellung abschließen';
      const close = () => { root.classList.remove('open'); root.onclick = null; $('note-close').onclick = null; btn.onclick = null; };
      $('note-close').onclick = close;
      root.onclick = (e) => { if (e.target === root) close(); };
      btn.onclick = () => { if (!canAccept) return; close(); onAccept(); };
      root.classList.add('open');
    },
    sceneCovered() { return covered; },
    refreshCabinet() { if (this._cabRefresh) this._cabRefresh(); },
    noteOpen() { return $('note-view').classList.contains('open'); },
    /**
     * Seifenschrank im Vollbild. layout: Schubladen (cabinet.js). marked(d): Schublade schon gewählt?
     * pick(d) -> Fehlertext (String) oder { find, done }: Schublade fährt raus und bleibt markiert;
     * done = Funktion -> alles gefunden, Schrank geht zu, danach done().
     */
    openCabinet(layout, findText, marked, pick, onClose, drawerStock, opt = {}) {
      const root = $('cabinet'), grid = $('cab-grid'), msg = $('cab-msg');
      if (!grid.childElementCount) {
        for (const d of layout) {
          const b = document.createElement('button');
          b.className = 'drawer ' + d.kind;
          const col = d.kind === 'soap' ? soapCss(d.soap) : d.kind === 'locked' ? d.color : 'transparent';
          const name = d.kind === 'soap' ? d.soap.name : d.kind === 'locked' ? d.name : 'leer';
          b.innerHTML = `<span class="soap-pop" style="background:${col}"></span><span class="lab"><span class="dot" style="background:${col}"></span><span class="nm${name.length > 8 ? ' long' : ''}">${name}</span>`
            + (d.kind === 'soap' ? '<span class="stk"><i></i></span>' : '') + '</span><span class="pull"></span>'
            + (d.kind === 'soap' ? '<span class="cnt" aria-live="polite"><small>×</small><b>0</b></span><span class="cnt-minus" role="button" aria-label="Ein Stück zurücklegen"></span>' : '');
          b._d = d;
          grid.appendChild(b);
        }
      }
      this._cabRefresh = () => {
        if (drawerStock) for (const x of grid.children) if (x._d.kind === 'soap') { const n = drawerStock(x._d); x.querySelector('.stk i').style.width = `${n * 10}%`; x.classList.toggle('bare', n === 0); x.title = `${n} Scheiben`; }
      };
      // Zähler am Fach: Badge (Anzahl, grün sobald das Rezept erfüllt ist), Minus nur solange man noch ändern darf
      const paint = (bump) => {
        for (const b of grid.children) {
          if (b._d.kind !== 'soap') continue;
          b.classList.toggle('out', marked(b._d));
          const n = opt.count ? opt.count(b._d) || 0 : 0, need = opt.need ? opt.need(b._d) : 0;
          b.classList.toggle('has-cnt', n > 0);
          b.classList.toggle('cnt-ok', n > 0 && n >= need);
          b.classList.toggle('cnt-edit', n > 0 && !!(opt.canEdit && opt.canEdit()));
          const c = b.querySelector('.cnt');
          if (n > 0) c.querySelector('b').textContent = n;
          c.setAttribute('aria-label', `${n} Stück`);
          if (bump === b) { c.classList.remove('bump', 'dip'); void c.offsetWidth; c.classList.add(bump._dir < 0 ? 'dip' : 'bump'); }
        }
        const done = opt.done ? opt.done() : null, btn = $('cab-done');
        $('cab-foot').classList.toggle('show', !!done);
        if (done) { btn.disabled = !done.ready; btn.textContent = done.label; btn.classList.toggle('ready', done.ready); }
      };
      for (const b of grid.children) {
        b.classList.remove('shake'); b.classList.toggle('out', marked(b._d));
        // Vorrat: wie viele Scheiben in dieser Schublade liegen (0..10)
        if (drawerStock && b._d.kind === 'soap') {
          const n = drawerStock(b._d);
          b.querySelector('.stk i').style.width = `${n * 10}%`;
          b.classList.toggle('bare', n === 0);
          b.title = `${n} Scheiben`;
        }
      }
      $('cab-find').textContent = findText;
      paint(null);
      let busy = false;
      const shut = (then) => {
        root.classList.remove('open');
        covered = false; clearTimeout(coverTimer);
        grid.onclick = null; $('cab-close').onclick = null; $('cab-done').onclick = null;
        setTimeout(() => { root.classList.remove('show'); then && then(); }, 480);
      };
      grid.onclick = (e) => {
        const b = e.target.closest('.drawer');
        if (!b || busy) return;
        // Minus am Zähler: ein Stück zurück in die Schublade
        if (e.target.closest('.cnt-minus') && b.classList.contains('cnt-edit')) {
          const r = opt.dec && opt.dec(b._d);
          if (r) { b._dir = -1; $('cab-find').textContent = r.find; paint(b); }
          return;
        }
        if (b.classList.contains('out') && !opt.count) return;
        const r = pick(b._d, b);
        if (r && r.refresh) return;
        if (typeof r === 'string') {
          b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          msg.textContent = r; msg.classList.add('show');
          clearTimeout(msg._t); msg._t = setTimeout(() => msg.classList.remove('show'), 1300);
          return;
        }
        b._dir = 1;
        $('cab-find').textContent = r.find;
        paint(b);
        if (r.done) { busy = true; setTimeout(() => shut(r.done), 750); }
      };
      $('cab-done').onclick = () => { if (busy || !opt.onDone) return; const d = opt.done && opt.done(); if (!d || !d.ready) return; busy = true; setTimeout(() => shut(opt.onDone), 160); };
      $('cab-close').onclick = () => { if (!busy) shut(onClose); };
      msg.classList.remove('show');
      grid.scrollTop = 0;
      root.classList.add('show');
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
      clearTimeout(coverTimer); coverTimer = setTimeout(() => { covered = true; }, 520);
    },
    /** Ergebnis-Karte nach dem Ausformen: Genauigkeit, Sterne, Zeilen, Preis. null = ausblenden. */
    showQuality(q) {
      const root = $('quality');
      if (!q) { root.classList.remove('show'); return; }
      $('q-stars').innerHTML = [0, 1, 2].map((k) => `<span class="qs ${k < q.stars ? 'on' : 'off'}" style="animation-delay:${0.25 + k * 0.18}s">${ICON.star}</span>`).join('');
      $('q-banner').textContent = q.stars === 3 ? 'Perfekt' : q.stars === 2 ? 'Sehr schön' : 'Geschafft';
      $('q-title').textContent = `Mischung ${q.accuracy} % genau`;
      $('q-rows').innerHTML = q.rows.map((r) => `<div class="q-row"><span>${rich(r.label)}</span><b class="${r.cls || ''}">${rich(r.value)}</b></div>`).join('');
      root.classList.add('show');
    },
    /** Knöpfe unten setzen: [{label, alt, onClick}] */
    actions(list) {
      el.actions.innerHTML = '';
      for (const a of list) {
        const b = document.createElement('button');
        b.className = 'btn' + (a.alt ? ' alt' : '');
        b.innerHTML = buttonLabel(a.label);
        b.addEventListener('click', a.onClick);
        el.actions.appendChild(b);
      }
      // mit Knöpfen unten wird der Zettel kompakter, damit Hinweis und Knöpfe nicht kollidieren
      document.body.classList.toggle('has-actions', list.length > 0);
      this.layoutOrder();
    },
    popup(text) {
      const d = document.createElement('div');
      d.className = 'popup';
      d.innerHTML = rich(text || WORDS[(Math.random() * WORDS.length) | 0]);
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
      el.cutLabel.textContent = `${soap ? soap.name + ' · ' : ''}${pct} % geschnitten`;
      el.cutBar.style.width = `${pct}%`;
    },
    showFps(show) { el.fps.classList.toggle('hidden', !show); },
    setFps(text) { el.fps.textContent = text; },
  };
}
