// Feine Linien-Icons (einheitlich 1.7 px Strich, runde Enden, currentColor) + Münze/Stern.
// rich(): Text sicher ins HTML; 🪙 -> gezeichnete Münze, ✔ -> Haken, übrige Emojis entfallen
// (im edlen Stil keine Emojis im Fließtext).
const S = (body, extra = '') => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

export const ICON = {
  play: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.2v11.6a.9.9 0 0 0 1.37.77l9.2-5.8a.9.9 0 0 0 0-1.54l-9.2-5.8A.9.9 0 0 0 8.5 6.2z" fill="currentColor"/></svg>`,
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.4h4l.5-2.4a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z"/>'),
  close: S('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', ' stroke-width="1.9"'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>', ' stroke-width="2"'),
  lock: S('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.4"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.2v2.2"/>'),
  soundOn: S('<path d="M4.5 9.5h3L12 6v12l-4.5-3.5h-3z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
  soundOff: S('<path d="M4.5 9.5h3L12 6v12l-4.5-3.5h-3z"/><path d="M16 9.8l4.4 4.4M20.4 9.8L16 14.2"/>'),
  box: S('<path d="M3.8 8.2L12 4l8.2 4.2v8L12 20.4l-8.2-4.2z"/><path d="M3.8 8.2L12 12.4l8.2-4.2M12 12.4v8"/>'),
  flame: S('<path d="M12 20.5c-3.5 0-6-2.4-6-5.7 0-3.2 2.4-5 3.4-7.8.3-.8 1.3-.9 1.8-.2 1.2 1.7 1.6 3 1.6 4 .8-.6 1.3-1.4 1.5-2.4.2-.7 1.1-.9 1.6-.3 1.3 1.8 2.1 3.8 2.1 6.2 0 3.6-2.5 6.2-6 6.2z"/><path d="M12 18c-1.3 0-2.2-.9-2.2-2.1 0-1.2.9-1.8 1.5-2.9.6.9 2.9 1.5 2.9 3 0 1.2-.9 2-2.2 2z"/>'),
  hand: S('<path d="M8 12.5V6.4a1.4 1.4 0 0 1 2.8 0V11M10.8 10.5V5a1.4 1.4 0 0 1 2.8 0v5.5M13.6 10.5V6.4a1.4 1.4 0 0 1 2.8 0v7.3c0 3.9-2.5 6.8-6.1 6.8-2.2 0-3.6-1-4.8-2.9l-2.3-3.7a1.3 1.3 0 0 1 2.1-1.6L8 14.4"/>'),
  sparkle: S('<path d="M12 3.8l1.6 4.8 4.8 1.6-4.8 1.6L12 16.6l-1.6-4.8-4.8-1.6 4.8-1.6z"/><path d="M18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>'),
  undo: S('<path d="M9 7.5L4.5 12 9 16.5"/><path d="M5 12h9.5a4.8 4.8 0 0 1 0 9.6H12"/>'),
  lid: S('<rect x="3.5" y="7.5" width="17" height="3.8" rx="1.2"/><path d="M5.2 11.3v8.2h13.6v-8.2M12 7.5v12M12 7.5c-1.4-2.8-4.6-3.2-4.6-1.4S10.2 7.5 12 7.5zm0 0c1.4-2.8 4.6-3.2 4.6-1.4S13.8 7.5 12 7.5z"/>'),
  menu: S('<path d="M5 8h14M5 12h14M5 16h9"/>', ' stroke-width="1.8"'),
  home: S('<path d="M4 11.5L12 4.5l8 7"/><path d="M6.5 10v9.5h11V10"/>'),
  reset: S('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  heart: S('<path d="M12 19.5s-7-4.3-7-9.5A4 4 0 0 1 12 7.8 4 4 0 0 1 19 10c0 5.2-7 9.5-7 9.5z"/>'),
  leaf: S('<path d="M5 19c0-8 5-13 14-14-.5 9-5.5 14-13 14"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>'),
  drop: S('<path d="M12 3.8c3 3.6 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.5-6.4 5.5-10z"/>'),
  bag: S('<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
  coin: '<i class="coin" aria-hidden="true"></i>',
  star: '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.9l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.95l-5.5 2.9 1.05-6.1L3.1 9.4l6.15-.9z" fill="currentColor" stroke-linejoin="round"/></svg>',
};

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
/** Text sicher ins HTML; Münze und Haken als Icon, sonstige Emojis/Pfeile werden entfernt. */
export function rich(text) {
  return String(text ?? '')
    .replace(/[&<>"]/g, (c) => ESC[c])
    .replace(/✔\uFE0F?/g, '\u0001').replace(/🪙/g, '\u0002')
    .replace(/(\p{Extended_Pictographic}|[\u2194\u21B6\u2190-\u2193])\uFE0F?/gu, '')
    .replace(/[ \u00A0]{2,}/g, ' ').replace(/^ | $/g, '')
    .replace(/\u0001 ?/g, '<span class="ok-ic">' + ICON.check + '</span>').replace(/\u0002/g, ICON.coin);
}

/** Aktions-Knopf: führendes Emoji -> Icon (Text bleibt gleich, nur ohne Emoji). */
const LEAD = [['🔥', 'flame'], ['✋', 'hand'], ['🪙', 'coin'], ['✨', 'sparkle'], ['↶', 'undo']];
export function buttonLabel(label) {
  for (const [e, k] of LEAD) if (label.startsWith(e)) return ICON[k] + `<span>${rich(label.slice(e.length).trim())}</span>`;
  if (/Deckel/.test(label)) return ICON.lid + `<span>${rich(label)}</span>`;
  return `<span>${rich(label)}</span>`;
}
