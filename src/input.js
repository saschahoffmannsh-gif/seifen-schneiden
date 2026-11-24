// Eingabe: Touch und Maus über Pointer Events. Liefert nur Zustand, keine Spiellogik.
export function createInput(el, onFirstGesture) {
  const state = { down: false, x: 0, y: 0, id: -1, downX: 0, downY: 0, seq: 0 };   // downX/Y: wo der Finger aufgesetzt hat
  const setPos = (e) => {
    const r = el.getBoundingClientRect();
    state.x = ((e.clientX - r.left) / r.width) * 2 - 1;   // NDC -1..1
    state.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  };
  el.addEventListener('pointerdown', (e) => {
    if (state.down) return;
    state.down = true; state.id = e.pointerId; setPos(e); state.downX = state.x; state.downY = state.y; state.seq++;
    el.setPointerCapture?.(e.pointerId);
    onFirstGesture?.();
    e.preventDefault();
  }, { passive: false });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== state.id && state.down) return;
    setPos(e);
  });
  const up = (e) => { if (e.pointerId === state.id) { state.down = false; state.id = -1; } };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  // iOS: kein Doppeltipp-Zoom / Scrollen
  // (außer in scrollbaren Listen wie der Päckchen-Auswahl)
  document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.scroll-x, .scroll-y')) e.preventDefault(); }, { passive: false });
  return state;
}
