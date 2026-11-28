// SS-19: Holzschrank in der Vollbild-Seifenregal-Ansicht. Offene, flache Bretter
// (keine tiefen Nischen), Seifen auf dem Rücken liegend und gestapelt, abgerundet
// mit Glanzlicht. Inhalt läuft seitlich mit Schwung und Endlos-Loop, wenn er
// breiter ist als der Schirm. Scroll ist als .scroll-x markiert.
import { SOAP_LIST } from './soaps.js';
import { lookCanvas } from './soapLooks.js';

const FACE = new Map();
const PREFER_ROWS = 3;
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * 255 * k)},${Math.round(c[1] * 255 * k)},${Math.round(c[2] * 255 * k)})`;
function faceOf(soap) {
  if (!FACE.has(soap.id)) FACE.set(soap.id, lookCanvas(soap, 160, 220));
  return FACE.get(soap.id);
}

function rr(g, x, y, w, h, r) {
  const k = Math.max(0.5, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

/** Ein Stück flach auf dem Rücken: weich abgerundete Kanten, Motiv oben, Glanzlicht. */
function drawPiece(g, soap, cx, floor, W, D, H) {
  const fb = floor, ft = floor - H;
  const x0 = cx - W / 2;
  const rFront = Math.min(W * 0.3, H * 0.95);
  const inset = Math.max(2.2, W * 0.05);
  const tw = W - inset * 2;
  const rTop = Math.min(tw * 0.32, D * 0.44);
  g.save();
  g.fillStyle = 'rgba(40, 22, 12, .2)';
  g.beginPath();
  g.ellipse(cx, fb + 1.5, W * 0.46, Math.max(2.5, H * 0.2), 0, 0, 7);
  g.fill();

  // Dicke: weich gerundeter Körper, Rand um die Motivseite bleibt sichtbar
  rr(g, x0, ft - 1, W, H + 1, rFront);
  g.fillStyle = rgb(soap.base, 0.74);
  g.fill();
  g.save();
  rr(g, x0, ft - 1, W, H + 1, rFront);
  g.clip();
  const lip = g.createLinearGradient(0, ft, 0, fb);
  lip.addColorStop(0, 'rgba(255,255,255,.3)');
  lip.addColorStop(0.28, 'rgba(255,255,255,.08)');
  lip.addColorStop(0.7, rgb(soap.base, 0.62));
  lip.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = lip;
  g.fillRect(x0, ft - 1, W, H + 1);
  g.restore();

  // Oberseite: stärker abgerundet, Motiv etwas eingesunken, Glanzlicht
  g.save();
  g.translate(cx, ft + 0.4);
  rr(g, -tw / 2, -D, tw, D, rTop);
  g.save();
  g.clip();
  g.drawImage(faceOf(soap), -tw / 2, -D, tw, D);
  const gloss = g.createRadialGradient(-tw * 0.2, -D * 0.62, 2, 0, -D * 0.35, tw * 0.62);
  gloss.addColorStop(0, 'rgba(255,255,255,.42)');
  gloss.addColorStop(0.4, 'rgba(255,255,255,.12)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gloss;
  g.fillRect(-tw / 2, -D, tw, D);
  g.strokeStyle = 'rgba(255,255,255,.32)';
  g.lineWidth = Math.max(1.2, tw * 0.028);
  rr(g, -tw / 2 + 2, -D + 2, tw - 4, D - 4, Math.max(2, rTop - 2));
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(50, 28, 16, .2)';
  g.lineWidth = 1.1;
  rr(g, -tw / 2, -D, tw, D, rTop);
  g.stroke();
  g.restore();
  g.restore();
}

function drawStack(g, soap, cx, floor, n, unit) {
  const W = unit * 1.16, D = unit * 0.74, H = unit * 0.3, shown = Math.min(3, Math.max(0, n));
  for (let k = 0; k < shown; k++) {
    drawPiece(g, soap, cx + (k === 1 ? -1.2 : k === 2 ? 1.4 : 0), floor - k * (H * 0.84), W, D, H);
  }
}

function paintComp(cv, soap, n, dpr) {
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cv.width / dpr, H = cv.height / dpr;
  g.clearRect(0, 0, W, H);
  const floor = H - 3, unit = Math.min(W * 0.82, (floor - 2) / 1.55);
  if (soap && n > 0) drawStack(g, soap, W / 2, floor, n, unit);
}

function rowCount(n) {
  if (n <= 2) return Math.max(1, n);
  if (n === 4) return 2;
  return Math.min(PREFER_ROWS, n);
}

function defaultItems() { return SOAP_LIST.map((soap) => ({ soap, pieces: 3 })); }

/**
 * Baut den Schrank in den Container (Vollbild-Ansicht). getItems() liefert
 * { items: [{ soap, pieces }], caption } oder eine Liste; fehlt der Auftragvorrat,
 * gilt die Auslage aller Sorten (je 3 Stück).
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
    const rows = rowCount(list.length);
    const cols = Math.max(1, Math.ceil(list.length / rows));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = scroll.getBoundingClientRect();
    const cssW = Math.max(88, Math.round((box.width || 360) * 0.3));
    const labelH = 28, boardH = 14, gap = 10, pad = 12;
    const avail = Math.max(80, (box.height || 400) - pad - rows * (labelH + boardH) - (rows - 1) * gap);
    const cap = Math.round(cssW * 1.05);
    const cssH = Math.max(56, Math.min(cap, Math.floor(avail / rows)));
    const makeBay = () => {
      const bay = document.createElement('div'); bay.className = 'hs-bay';
      for (let r = 0; r < rows; r++) {
        const shelf = document.createElement('div'); shelf.className = 'hs-shelf';
        for (let c = 0; c < cols; c++) {
          const it = list[r * cols + c];
          if (!it) continue;
          const cell = document.createElement('div'); cell.className = 'hs-comp';
          cell.style.width = cssW + 'px';
          const cv = document.createElement('canvas');
          cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
          cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
          paintComp(cv, it.soap, it.pieces, dpr);
          const lab = document.createElement('b');
          lab.textContent = it.pieces > 0 ? `${it.soap.name} ×${it.pieces}` : it.soap.name;
          cell.appendChild(cv); cell.appendChild(lab); shelf.appendChild(cell);
        }
        if (shelf.childElementCount) bay.appendChild(shelf);
      }
      return bay;
    };
    track.innerHTML = '';
    const a = makeBay();
    track.appendChild(a);
    if (a.offsetWidth < scroll.clientWidth) a.style.minWidth = scroll.clientWidth + 'px';
    bayW = a.offsetWidth;
    const loop = bayW > (scroll.clientWidth + 8);
    if (loop) track.appendChild(makeBay());
    wrapping = true; scroll.scrollLeft = 0; wrapping = false;
    scroll.dataset.loop = loop ? '1' : '0';
    scroll.dataset.rows = String(rows);
    scroll.dataset.cols = String(cols);
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
