// SS-19: Holzschrank in der Seifenregal-Kachel (offene Fächer, Seifen auf dem Rücken liegend
// und gestapelt wie SS-18.3). Inhalt läuft als durchgehendes Brett seitlich, mit Schwung und
// Endlos-Loop. Scroll ist als .scroll-x markiert (globaler Touch-Blocker, touch-action: pan-x).
import { SOAP_LIST } from './soaps.js';
import { lookCanvas } from './soapLooks.js';

const ROWS = 2, FACE = new Map();
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * 255 * k)},${Math.round(c[1] * 255 * k)},${Math.round(c[2] * 255 * k)})`;
function faceOf(soap) {
  if (!FACE.has(soap.id)) FACE.set(soap.id, lookCanvas(soap, 180, 300));
  return FACE.get(soap.id);
}

/** Ein Stück flach auf dem Rücken: Motiv-Seite oben, schmale Vorderkante, leichte Perspektive. */
function drawPiece(g, soap, cx, floor, W, D, H) {
  const fb = floor, ft = floor - H, bt = floor - H - D * 0.58, bw = 0.88;
  const x0 = cx - W / 2, x1 = cx + W / 2, bx0 = cx - W / 2 * bw, bx1 = cx + W / 2 * bw;
  const r = Math.min(8, W * 0.1, H * 0.45);
  g.save();
  g.fillStyle = 'rgba(40, 22, 12, .22)';
  g.beginPath(); g.ellipse(cx, fb + 2, W * 0.48, D * 0.18, 0, 0, 7); g.fill();
  // Vorderkante (Dicke)
  g.fillStyle = rgb(soap.base, 0.78);
  g.beginPath();
  g.moveTo(x0 + r, ft); g.lineTo(x1 - r, ft); g.quadraticCurveTo(x1, ft, x1, ft + r);
  g.lineTo(x1, fb - 2); g.quadraticCurveTo(x1, fb, x1 - 3, fb);
  g.lineTo(x0 + 3, fb); g.quadraticCurveTo(x0, fb, x0, fb - 2);
  g.lineTo(x0, ft + r); g.quadraticCurveTo(x0, ft, x0 + r, ft);
  g.fill();
  g.fillStyle = rgb(soap.base, 0.62);
  g.fillRect(x0 + 1, ft + H * 0.45, W - 2, 1.5);
  // Oberseite mit Motiv
  g.beginPath();
  g.moveTo(x0 + r, ft); g.lineTo(x1 - r, ft); g.quadraticCurveTo(x1, ft, x1, ft - 1);
  g.lineTo(bx1, bt + 2); g.quadraticCurveTo(bx1, bt, bx1 - 4, bt);
  g.lineTo(bx0 + 4, bt); g.quadraticCurveTo(bx0, bt, bx0, bt + 2);
  g.lineTo(x0, ft - 1); g.quadraticCurveTo(x0, ft, x0 + r, ft);
  g.closePath();
  g.save(); g.clip();
  const face = faceOf(soap);
  const tw = x1 - x0, th = ft - bt + 4;
  g.drawImage(face, x0, bt - 1, tw, th);
  g.fillStyle = 'rgba(255,255,255,.16)';
  g.beginPath(); g.ellipse(cx - W * 0.12, bt + th * 0.35, W * 0.28, th * 0.18, -0.4, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(50, 28, 16, .28)'; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0 + r, ft); g.lineTo(x1 - r, ft); g.quadraticCurveTo(x1, ft, x1, ft - 1);
  g.lineTo(bx1, bt + 2); g.quadraticCurveTo(bx1, bt, bx1 - 4, bt);
  g.lineTo(bx0 + 4, bt); g.quadraticCurveTo(bx0, bt, bx0, bt + 2);
  g.lineTo(x0, ft - 1); g.quadraticCurveTo(x0, ft, x0 + r, ft);
  g.stroke();
  g.restore();
}

function drawStack(g, soap, cx, floor, n, unit) {
  const W = unit * 1.22, D = unit * 0.7, H = unit * 0.36, shown = Math.min(3, Math.max(0, n));
  for (let k = 0; k < shown; k++) drawPiece(g, soap, cx + (k === 1 ? -1 : k === 2 ? 1.5 : 0), floor - k * (H * 0.92), W, D, H);
}

function paintComp(cv, soap, n, dpr) {
  const w = cv.width, h = cv.height;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = w / dpr, H = h / dpr;
  g.clearRect(0, 0, W, H);
  const floor = H - 2, unit = Math.min(W * 0.7, (floor - 4) / 1.5);
  if (soap && n > 0) drawStack(g, soap, W / 2, floor, n, unit);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function defaultItems() { return SOAP_LIST.map((soap) => ({ soap, pieces: 2 })); }

/**
 * Baut den Schrank in den Container (Vollbild-Ansicht). getItems() liefert
 * { items: [{ soap, pieces }], caption } oder eine Liste; fehlt der Auftragvorrat,
 * gilt die Auslage aller Sorten (je 2 Stück).
 */
export function mountHomeShelf(cab, getItems) {
  cab.innerHTML = `<div class="hs-scroll scroll-x" tabindex="0" aria-label="Seifenregal, seitlich wischen">
      <div class="hs-track"></div>
    </div>`;
  const scroll = cab.querySelector('.hs-scroll'), track = cab.querySelector('.hs-track');
  let bayW = 0, wrapping = false, dragged = false, px = 0, py = 0;

  function pack() {
    const raw = (getItems && getItems()) || null;
    if (raw && raw.items) return raw;
    if (Array.isArray(raw) && raw.length) return { items: raw, caption: '' };
    return { items: defaultItems(), caption: 'Die Sorten der Manufaktur' };
  }

  function build() {
    const { items: list, caption } = pack();
    const msg = document.getElementById('shelf-msg');
    if (msg) msg.textContent = caption || '';
    const cols = Math.max(1, Math.ceil(list.length / ROWS));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = scroll.getBoundingClientRect();
    const cssW = Math.max(120, Math.round((box.width || 360) * 0.42));
    const cssH = Math.max(90, Math.round(((box.height || 400) / ROWS) - 44));
    const makeBay = () => {
      const bay = document.createElement('div'); bay.className = 'hs-bay';
      for (let r = 0; r < ROWS; r++) {
        const shelf = document.createElement('div'); shelf.className = 'hs-shelf';
        for (let c = 0; c < cols; c++) {
          const it = list[r * cols + c];
          const cell = document.createElement('div'); cell.className = 'hs-comp' + (it && it.pieces > 0 ? '' : ' empty');
          cell.style.width = cssW + 'px';
          const cv = document.createElement('canvas');
          cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
          cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
          if (it) paintComp(cv, it.soap, it.pieces, dpr);
          const lab = document.createElement('b');
          lab.textContent = it ? (it.pieces > 0 ? `${it.soap.name} ×${it.pieces}` : it.soap.name) : '';
          cell.appendChild(cv); cell.appendChild(lab); shelf.appendChild(cell);
        }
        bay.appendChild(shelf);
      }
      return bay;
    };
    track.innerHTML = '';
    const a = makeBay();
    track.appendChild(a);
    bayW = a.offsetWidth;
    const loop = bayW > (scroll.clientWidth + 8);
    if (loop) track.appendChild(makeBay());
    wrapping = true; scroll.scrollLeft = 0; wrapping = false;
    scroll.dataset.loop = loop ? '1' : '0';
  }

  scroll.addEventListener('scroll', () => {
    if (wrapping || !bayW || scroll.dataset.loop !== '1') return;
    if (scroll.scrollLeft >= bayW) { wrapping = true; scroll.scrollLeft -= bayW; wrapping = false; }
    else if (scroll.scrollLeft <= 0) { wrapping = true; scroll.scrollLeft += bayW; wrapping = false; }
  }, { passive: true });

  scroll.addEventListener('pointerdown', (e) => { dragged = false; px = e.clientX; py = e.clientY; }, { passive: true });
  scroll.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - px) > 8 || Math.abs(e.clientY - py) > 8) dragged = true;
  }, { passive: true });
  scroll.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  scroll.addEventListener('scroll', () => { dragged = true; }, { passive: true });

  if (window.ResizeObserver) new ResizeObserver(() => { const x = scroll.scrollLeft; build(); wrapping = true; scroll.scrollLeft = x; wrapping = false; }).observe(scroll);
  build();
  return { refresh() { const x = scroll.scrollLeft; build(); wrapping = true; scroll.scrollLeft = x; wrapping = false; }, el: scroll };
}
