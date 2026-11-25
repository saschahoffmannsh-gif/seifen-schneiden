// Kunden-Porträts (4 x 4 Kacheln in einem Bild): gemeinsam für Bestellungen-Ansicht und Geschenktheke.
import avatarSheet from './assets/avatars/kunden.webp';

const AVATAR = { Anna: 0, Lea: 1, Clara: 2, Mila: 3, Greta: 4, Ida: 5, Frieda: 6, Sophie: 7, Emil: 8, Ben: 9, Paul: 10, Jonas: 11, Oskar: 12, Theo: 14 };

/** CSS für ein Element mit dem Porträt der Kundin/des Kunden (background-size: 400 % im CSS). */
export function avatarStyle(name) {
  const av = AVATAR[name] ?? (name.length % 16);
  return `background-image:url(${avatarSheet});background-position:${(av % 4) / 3 * 100}% ${Math.floor(av / 4) / 3 * 100}%`;
}
