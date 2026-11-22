# 🧼 Seifen-Schneiden

Ein entspannendes Handy-Spiel im Browser: Seifen aus dem Schrank nehmen, in feine Würfel schneiden
(wie bei „Seifenschneidespaß“), im Ofen zusammenschmelzen und die fertige marmorierte Seife verkaufen.

**Direkt spielen:** https://saschahoffmannsh-gif.github.io/seifen-schneiden/
(mit FPS-Anzeige: https://saschahoffmannsh-gif.github.io/seifen-schneiden/?fps=1)

![Schneiden](docs/screenshot-schneiden.png)

## So wird gespielt

1. **Bestellung lesen** – oben steht, was die Kundschaft möchte, z. B. „Anna möchte: Erdbeere + Vanille“.
2. **Seife aus dem Schrank nehmen** – unten im Schrank auf eine Sorte tippen (gewünschte Sorten sind gelb umrandet).
3. **Schneiden** – den Finger einfach **hin und her (links ↔ rechts)** über die Seife wischen.
   Das Messer folgt dem Finger, jeder Wisch (jeder Richtungswechsel) schneidet eine Schicht ab,
   und das Messer geht mit jedem Zug ein Stück tiefer. Die Schicht zerfällt in kleine Würfel,
   die in die Schale purzeln.
4. **Zweite Seife** – nächste Sorte aus dem Schrank nehmen und in dieselbe Schale schneiden.
5. **🔥 In den Ofen** – die Würfel schmelzen zusammen (Fortschrittsbalken).
6. **✨ Aus der Form nehmen** – die fertige Seife ist marmoriert, die Farben und Anteile kommen
   aus den Würfeln, die du hineingeschnitten hast.
7. **🪙 Verkaufen** – passt die Seife zur Bestellung, gibt es mehr Münzen.

Funktioniert mit Touch (Handy, Hochformat) und mit der Maus.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) 18 oder neuer.

```bash
npm install
npm run dev        # Entwicklungsserver, auch im WLAN erreichbar (fürs Handy)
npm run build      # statische Version in dist/
npm run preview    # gebaute Version ansehen
```

Bei jedem Push auf `main` baut eine GitHub Action das Spiel und veröffentlicht es auf GitHub Pages.

## Aufbau des Codes

| Datei | Aufgabe |
| --- | --- |
| `src/main.js` | Startet alles, Hauptschleife (Delta-Time + fester Physik-Zeitschritt), FPS-Anzeige |
| `src/game.js` | Spielablauf: Schrank → Schneiden → Ofen → Herausnehmen → Verkaufen, Messer-Steuerung |
| `src/soapBlock.js` | Intakter Seifenblock aus Voxeln (ein `InstancedMesh`) |
| `src/looseCubes.js` | Lose Würfel: Pool, eigene Mini-Physik, Höhenfeld zum Stapeln |
| `src/soaps.js` | Seifensorten, Farben und Innenmuster |
| `src/scene.js` | Renderer, Kamera, Licht, Schale, Gitter, Fake-Schatten |
| `src/knife.js` | Gezacktes Messer |
| `src/marble.js` | Marmor-Textur für die fertige Seife |
| `src/confetti.js` | Konfetti-Partikel |
| `src/input.js` | Touch-/Maus-Eingabe |
| `src/ui.js` | Bestellung, Münzen, Schrank, Knöpfe, „So satisfying!“-Texte |
| `src/audio.js` | Generierte Geräusche (WebAudio) und Vibration |
| `src/config.js` | Alle Zahlen zum Feintuning an einer Stelle |

## Technik: warum es nicht ruckelt

- **Instancing:** Alle losen Würfel (bis zu 4000) sind *ein* `InstancedMesh` = ein Draw Call.
  Der intakte Block ist ebenfalls ein `InstancedMesh`. Insgesamt ca. 10 Draw Calls.
- **Nichts wird zur Laufzeit erzeugt:** Pool fest reserviert, geschnittene Würfel werden nur
  versteckt bzw. aus dem Pool aktiviert. Ist der Pool voll, wird der älteste Würfel recycelt.
- **Eigene, billige Physik statt Physik-Engine:** Schwerkraft, Abprallen an Block, Schalenwand
  und Boden. Gestapelt wird über ein Höhenfeld (keine Würfel-gegen-Würfel-Kollision).
  Liegende Würfel werden **eingefroren** und gar nicht mehr berechnet.
- **Fester Zeitschritt** (120 Hz) für die Physik, Animationen über Delta-Time (begrenzt auf 50 ms),
  dadurch auf 60- und 120-Hz-Displays gleich schnell und ohne Sprünge.
- **Kein Speicher-Müll im Frame:** Vektoren und Matrizen werden wiederverwendet, Daten liegen in
  typisierten Arrays. Zur GPU wird nur der geänderte Bereich der Matrizen hochgeladen.
- **Günstiges Licht:** Lambert-Materialien, keine Schatten-Maps (weicher Fake-Schatten als Textur),
  Pixeldichte auf max. 2 begrenzt.
- **Oberfläche in HTML/CSS** mit Animationen nur über `transform`/`opacity` (läuft auf dem Compositor).
- Gemessen: ein Physik-Schritt mit 2000 gleichzeitig fliegenden Würfeln braucht ca. 0,3 ms CPU.

## Bekannte Grenzen (Prototyp)

- Würfel kollidieren nicht untereinander, sondern stapeln sich über ein Höhenfeld.
- Während der Ofen läuft, kann man noch nichts anderes machen (nur Fortschrittsbalken).
- Keine Speicherstände, keine Level, keine versteckten Gegenstände in der Seife.
