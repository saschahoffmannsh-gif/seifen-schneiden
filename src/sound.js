// Ton an/aus, ohne audio.js zu verändern: Der AudioContext (wird in audio.js erst beim ersten
// Antippen erzeugt) bekommt eine eigene "destination" mit Lautstärke-Regler davor.
const KEY = 'seifen-settings-v1';
const settings = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
let gainNode = null;

const AC = window.AudioContext || window.webkitAudioContext;
if (AC) {
  class MutableAudioContext extends AC {
    constructor(...a) {
      super(...a);
      this._mute = this.createGain();
      this._mute.gain.value = settings.mute ? 0 : 1;
      this._mute.connect(super.destination);
      gainNode = this._mute;
    }
    get destination() { return this._mute || super.destination; }
  }
  window.AudioContext = MutableAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = MutableAudioContext;
}

export const sound = {
  get on() { return !settings.mute; },
  set on(v) {
    settings.mute = !v;
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* egal */ }
    if (gainNode) gainNode.gain.value = v ? 1 : 0;
  },
};
