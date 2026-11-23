// Inline-SVG-Icons (einheitlicher Strich, runde Enden, currentColor) + Münze/Stern in Farbe.
const S = (body, extra = '') => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

export const ICON = {
  play: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>`,
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.6"/>'),
  close: S('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', ' stroke-width="3.2"'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>', ' stroke-width="3"'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="currentColor" stroke="none"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  soundOn: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  box: S('<path d="M3.5 8.5L12 4l8.5 4.5v8L12 21l-8.5-4.5z"/><path d="M3.5 8.5L12 13l8.5-4.5M12 13v8"/>'),
  flame: S('<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.6-8.3.3-.9 1.4-1 1.9-.2C12.6 8.6 13 10 13 11c.8-.6 1.4-1.6 1.6-2.6.2-.8 1.2-1 1.7-.3 1.4 2 2.2 4 2.2 6.5 0 3.7-2.6 6.4-6.5 6.4z" fill="currentColor" stroke="none"/><path d="M12 18.5c-1.5 0-2.5-1-2.5-2.4 0-1.3 1-2 1.6-3.2.6 1 2.9 1.7 2.9 3.4 0 1.3-.9 2.2-2 2.2z" fill="#fff6d0" stroke="none"/>'),
  hand: S('<path d="M8 12.5V6.2a1.5 1.5 0 0 1 3 0V11M11 10.5V4.8a1.5 1.5 0 0 1 3 0v5.7M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.6 7-6.3 7-2.3 0-3.7-1-5-3l-2.4-3.8a1.4 1.4 0 0 1 2.2-1.7L8 14.5"/>'),
  sparkle: S('<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" fill="currentColor" stroke="none"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor" stroke="none"/>'),
  undo: S('<path d="M9 7.5L4.5 12 9 16.5"/><path d="M5 12h9a5 5 0 0 1 0 10h-2"/>'),
  lid: S('<rect x="3" y="7" width="18" height="4" rx="1.4"/><path d="M5 11v8.5h14V11M12 7v12.5M12 7c-1.5-3-5-3.5-5-1.5S10 7 12 7zm0 0c1.5-3 5-3.5 5-1.5S14 7 12 7z"/>'),
  menu: S('<path d="M5 7h14M5 12h14M5 17h14"/>', ' stroke-width="2.8"'),
  home: S('<path d="M4 11.5L12 4.5l8 7"/><path d="M6.5 10v9.5h11V10"/>'),
  reset: S('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  heart: S('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" fill="currentColor" stroke="none"/>'),
  coin: '<i class="coin" aria-hidden="true"></i>',
  star: '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" fill="currentColor" stroke="rgba(120,60,0,.55)" stroke-width="1.2" stroke-linejoin="round"/><path d="M8.6 9.4l2-.3" stroke="rgba(255,255,255,.8)" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

/** Text sicher ins HTML (escape) und 🪙 durch die gezeichnete Münze ersetzen. */
export function rich(text) {
  return String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/🪙/g, ICON.coin);
}

/** Aktions-Knopf: führendes Emoji -> Icon (Text bleibt gleich, nur ohne Emoji). */
const LEAD = [['🔥', 'flame'], ['✋', 'hand'], ['🪙', 'coin'], ['✨', 'sparkle'], ['↶', 'undo']];
export function buttonLabel(label) {
  for (const [e, k] of LEAD) if (label.startsWith(e)) return ICON[k] + `<span>${rich(label.slice(e.length).trim())}</span>`;
  if (/Deckel/.test(label)) return ICON.lid + `<span>${rich(label)}</span>`;
  return `<span>${rich(label)}</span>`;
}
