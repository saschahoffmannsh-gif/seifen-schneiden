// Headless-Test einer kompletten Runde + Screenshots. Aufruf: node tests/round.cjs <url> <outdir>
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const url = process.argv[2] || 'http://localhost:4173/seifen-schneiden/';
const out = process.argv[3] || '/workspace/seifen-shots';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const [VW, VH] = (process.env.VIEW || '420x860').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  // Safe-Area simulieren (iPhone): SAFE=oben,unten in px, z. B. SAFE=47,34
  if (process.env.SAFE) { const [st, sb] = process.env.SAFE.split(',').map(Number); await p.addInitScript(([st, sb]) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.setProperty('--sa-top', st + 'px'); document.documentElement.style.setProperty('--sa-bottom', sb + 'px'); }); }, [st, sb]); }
  const errs = []; const note = (t) => { errs.push(t); console.log('PAGE-ERROR', t); }; p.on('pageerror', e => note(e.message)); p.on('console', m => m.type() === 'error' && note(m.text()));
  await p.goto(url + '?fps=1');
  await p.waitForTimeout(2500);
  // Startbildschirm: sichtbar, Spielen-Button, dann ins Spiel
  console.log('start screen ->', await p.evaluate(() => document.getElementById('start').classList.contains('open')), await p.textContent('#start-play'));
  await p.screenshot({ path: out + '/0-start.png' });
  await p.click('#start-play'); await p.waitForTimeout(800);
  console.log('start hidden ->', await p.evaluate(() => !document.getElementById('start').classList.contains('open')));
  await p.screenshot({ path: out + '/1-regal.png' });
  // Mitten auf den Tisch tippen darf nichts auswählen
  await p.mouse.click(VW / 2, VH * 0.8); await p.waitForTimeout(300);
  console.log('tap on table ->', await p.evaluate(() => window.__game.state));
  const g = () => p.evaluate(() => window.__game.state);
  // Layout-Prüfung: kein sichtbares UI-Element darf Seife/Schale/Päckchen/Deckel überdecken
  const overlaps = [];
  const chk = async (label) => {
    // Ruhelage abwarten: das Bild gleitet weich aus dem Weg (viewShift gedämpft), geprüft wird der Endzustand
    await p.waitForFunction(() => { const g = window.__game; return Math.abs((g.viewShift || 0) - (g.viewShiftTarget || 0)) < 1; }, null, { timeout: 4000 }).catch(() => {});
    const r = await p.evaluate(() => {
      const f = window.__game.focusRects();
      const sel = ['#coins', '#menu-btn', '#order', '#hint', '#actions', '#quality', '#cut-progress'];
      const ui = [];
      for (const s of sel) {
        const e = document.querySelector(s); if (!e) continue;
        const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
        const b = e.getBoundingClientRect(); if (b.width < 2 || b.height < 2 || !e.textContent.trim() && s === '#hint') continue;
        if (s === '#actions' && !e.children.length) continue;
        ui.push({ s, x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
      }
      const hits = [];
      for (const a of f) for (const u of ui) {
        const ox = Math.min(a.x1, u.x1) - Math.max(a.x0, u.x0), oy = Math.min(a.y1, u.y1) - Math.max(a.y0, u.y0);
        if (ox > 2 && oy > 2) hits.push(`${u.s} über ${a.name} (${Math.round(ox)}×${Math.round(oy)} px)`);
      }
      return { state: window.__game.state, focus: f.map((a) => a.name).join('+'), hits };
    });
    if (r.hits.length) overlaps.push(`${label} [${r.state}]: ${r.hits.join(', ')}`);
    console.log('overlap', label, r.state, r.focus || '-', r.hits.length ? 'ÜBERLAPPUNG ' + r.hits.join(', ') : 'frei');
  };
  let midShot = false;
  const noteAt = (i) => p.evaluate((i) => { const v = window.__game.notes.screenPos(i, window.__game.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, i);
  console.log('notes', JSON.stringify(await p.evaluate(() => window.__game.notes.orders.map((o) => [o.customer, o.soaps.map((s) => s.name).join('+'), o.reward]))));
  for (let i = 0; i < 3; i++) console.log('note', i, JSON.stringify(await noteAt(i)));
  // Schrank zu (ohne Bestellung): öffnen geht, Picken sagt "Erst eine Bestellung annehmen"
  await p.mouse.click(VW / 2, 12); await p.waitForTimeout(700);
  console.log('cabinet w/o order', await g(), await p.$eval('#cab-find', (e) => e.textContent));
  await p.click('#cab-grid .drawer.soap >> nth=0'); await p.waitForTimeout(200);
  console.log(' pick ->', await p.$eval('#cab-msg', (e) => e.textContent));
  await p.click('#cab-close'); await p.waitForTimeout(700);
  console.log(' closed ->', await g(), await p.$eval('#hint', (e) => e.textContent));
  // Zettel antippen -> groß
  let np = await noteAt(0);
  await p.mouse.click(np.x, np.y); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/14-zettel-gross.png' });
  await p.mouse.click(VW / 2, VH - 30); await p.waitForTimeout(400); // daneben tippen schließt
  console.log('note open after outside tap', await p.evaluate(() => document.getElementById('note-view').classList.contains('open')), await g());
  await p.mouse.click(np.x, np.y); await p.waitForTimeout(450);
  await p.click('#note-accept'); await p.waitForTimeout(500);
  console.log('accepted', await g(), await p.$eval('#hint', (e) => e.textContent), await p.$eval('#order', (e) => e.textContent.trim()));
  await p.screenshot({ path: out + '/15-bestellung-aktiv.png' }); await chk('auswahl');
  np = await noteAt(1);
  await p.mouse.click(np.x, np.y); await p.waitForTimeout(450);
  console.log('read-only', await p.$eval('#note-accept', (e) => [e.disabled, e.textContent]));
  await p.screenshot({ path: out + '/16-zettel-nur-lesen.png' });
  await p.click('#note-close'); await p.waitForTimeout(400);
  const order = await p.evaluate(() => window.__game.order.soaps.map((s) => s.name));
  // Schrank antippen -> Vollbild; alle Seifen der Bestellung in den Schubladen finden
  await p.mouse.click(VW / 2, 12);
  await p.waitForFunction(() => document.getElementById('cabinet').classList.contains('open'));
  await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/17-schrank-offen.png' });
  { const sc = await p.evaluate(() => { const gr = document.getElementById('cab-grid'), n = gr.querySelectorAll('.drawer').length, names = [...gr.querySelectorAll('.drawer')].map((b) => b.querySelector('.nm').textContent);
      const sorted = names.slice().sort(new Intl.Collator('de', { sensitivity: 'base' }).compare);
      const r0 = gr.scrollLeft; gr.scrollLeft = 1e5; const r1 = gr.scrollLeft; gr.scrollLeft = r0;
      return { n, scrollW: gr.scrollWidth, w: gr.clientWidth, canScroll: r1 > 0, az: names.join() === sorted.join(), more: getComputedStyle(document.querySelector('.cab-more.right')).opacity }; });
    console.log('cabinet scroll', JSON.stringify(sc)); if (!sc.canScroll || !sc.az) note('Schrank scroll/A–Z ' + JSON.stringify(sc)); }
  const wrong = await p.evaluate(() => { const g = window.__game; return [...document.querySelectorAll('#cab-grid .drawer.soap')].findIndex((b) => !g.order.soaps.includes(b._d.soap)); });
  await p.click(`#cab-grid .drawer.soap >> nth=${wrong}`); await p.waitForTimeout(150);
  console.log('wrong drawer ->', await p.$eval('#cab-msg', (e) => e.textContent));
  await p.screenshot({ path: out + '/18-schublade-falsch.png' });
  // Zähler am Fach: Wert der Plakette, Zustand im Spiel, Knopf unten
  const cnt = (idx) => p.evaluate((idx) => { const b = document.querySelectorAll('#cab-grid .drawer')[idx], g = window.__game; return { badge: b.classList.contains('has-cnt') ? b.querySelector('.cnt b').textContent : '', minus: getComputedStyle(b.querySelector('.cnt-minus')).display !== 'none', take: g.take.get(b._d.soap.id) || 0, ok: b.classList.contains('cnt-ok'), done: document.getElementById('cab-done').disabled ? 'aus' : 'an', msg: document.getElementById('cab-msg').classList.contains('show') ? document.getElementById('cab-msg').textContent : '' }; }, idx);
  const expect = (label, got, want) => { const ok = Object.keys(want).every((k) => got[k] === want[k]); console.log('counter', label, JSON.stringify(got), ok ? 'ok' : 'FEHLER erwartet ' + JSON.stringify(want)); if (!ok) note('Zähler ' + label); };
  for (let s = 0; s < order.length; s++) {
    const idx = await p.evaluate((name) => [...document.querySelectorAll('#cab-grid .drawer')].findIndex((b) => b._d.kind === 'soap' && b._d.soap.name === name), order[s]);
    await p.$eval(`#cab-grid .drawer:nth-child(${idx + 1})`, (e) => e.scrollIntoView({ block: 'center' }));
    await p.click(`#cab-grid .drawer >> nth=${idx}`); await p.waitForTimeout(500);
    console.log('picked', order[s], '->', await p.$eval('#cab-find', (e) => e.textContent));
    if (s === 0) {
      await p.screenshot({ path: out + '/19-schublade-gefunden.png' });
      expect('1x', await cnt(idx), { badge: '1', take: 1, minus: true, done: 'an' });
      // Schrank ist unendlich: kein Maximum aus dem Vorrat, weiter tippen zählt hoch
      await p.click(`#cab-grid .drawer >> nth=${idx}`); await p.waitForTimeout(500);
      await p.screenshot({ path: out + '/19b-zaehler-2.png' });
      expect('2x', await cnt(idx), { badge: '2', take: 2 });
      await p.click(`#cab-grid .drawer >> nth=${idx}`); await p.waitForTimeout(400);
      expect('3x', await cnt(idx), { badge: '3', take: 3, msg: '' });
      for (let k = 3; k > 1; k--) { await p.click(`#cab-grid .drawer >> nth=${idx} >> .cnt-minus`); await p.waitForTimeout(350); }
      expect('minus', await cnt(idx), { badge: '1', take: 1 });
      await p.click(`#cab-grid .drawer >> nth=${idx} >> .cnt-minus`); await p.waitForTimeout(350);
      expect('null', await cnt(idx), { badge: '', take: 0, minus: false });
      await p.click(`#cab-grid .drawer >> nth=${idx}`); await p.waitForTimeout(500);
      expect('wieder 1x', await cnt(idx), { badge: '1', take: 1 });
    }
  }
  expect('alles', await cnt(await p.evaluate(() => [...document.querySelectorAll('#cab-grid .drawer')].findIndex((b) => b.classList.contains('has-cnt')))), { done: 'an' });
  await p.screenshot({ path: out + '/19c-schrank-bereit.png' });
  await p.click('#cab-done');
  await p.waitForFunction(() => window.__game.state === 'shelf', null, { timeout: 60000 });
  await p.waitForTimeout(600);
  console.log('stocked', await p.$eval('#hint', (e) => e.textContent), await p.evaluate(() => window.__game.shelf.soaps.map((s) => s.name)));
  await p.screenshot({ path: out + '/20-regal-bestueckt.png' }); await chk('regal');
  // Zettel bleiben antippbar, Seifen auch (kein Konflikt)
  np = await noteAt(2);
  await p.mouse.click(np.x, np.y); await p.waitForTimeout(400);
  console.log('note tap while stocked ->', await p.evaluate(() => document.getElementById('note-view').classList.contains('open')));
  await p.click('#note-close'); await p.waitForTimeout(400);
  // Mischung schneiden: je Sorte genau die bestellten Scheiben (10 % = 1 Scheibe); bei der zweiten
  // Sorte mitten in der letzten Scheibe aufhören -> angefangene Scheibe ist Verschnitt, Rest bleibt im Vorrat
  const mix = await p.evaluate(() => window.__game.order.mix.map((m) => m.pct / 10));
  const shelfPt = (i) => p.evaluate((i) => { const g = window.__game; const v = g.shelf.home[i].clone().project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, i);
  for (let s = 0; s < order.length; s++) {
    if (s === 0) {
      const pt = await shelfPt(s);
      await p.mouse.click(pt.x, pt.y);
    }
    await p.waitForFunction((id) => window.__game.state === 'cutting' && window.__game.block.soap.name === id, order[s], { timeout: 30000 });
    // Kamera fährt heran, Seife kippt nach hinten: erst danach schneiden
    await p.waitForFunction(() => { const c = window.__game.testCutPx(); return c.zoom >= 1 && c.tilt >= 1; }, null, { timeout: 30000 });
    await p.waitForTimeout(300);
    if (s === 0) await p.screenshot({ path: out + '/2-seife-intakt.png' }); await chk('schneiden-start');
    const stopAt = s === 1 ? mix[s] - 0.4 : mix[s];
    // je Wisch: Ruhelage des Messers, Ober- und Unterkante der aktuellen Scheibe (Pixel)
    let n = 0;
    for (;;) {
      const st = await p.evaluate(() => { const g = window.__game; return [g.state, g.slicesCut + (g.returning ? 0 : g.sliceProgress), g.returning, g.sliceProgress]; });
      if (st[0] !== 'cutting' || st[1] >= stopAt - 1e-3 || n > 200) break;
      if (st[2]) { await p.waitForTimeout(80); continue; }
      const rem = stopAt - st[1], depth = rem >= 1 - st[3] ? 1.08 : st[3] + rem;
      const geo = await p.evaluate(() => window.__game.testCutPx());
      // Wisch von oben nach unten: Finger irgendwo greifen, Messer folgt 1:1
      const x = geo.x, lx = (yy) => geo.restX + (geo.botX - geo.restX) * (yy - geo.rest) / (geo.bot - geo.rest), mv = (yy, o) => p.mouse.move(lx(yy), yy, o), y0 = geo.rest - 12, dy = (geo.top - geo.rest) + depth * (geo.bot - geo.top);
      await mv(y0); await p.mouse.down();
      if (n === 0 && s === 0) {
        // halb runter, dann hoch: Messer geht mit hoch, schneidet dabei aber nicht; dann weiter runter
        await mv(y0 + dy * 0.55, { steps: 6 }); await p.waitForTimeout(150);
        const b = await p.evaluate(() => [window.__game.sliceProgress, window.__game.knifeY]);
        await mv(y0 + dy * 0.2, { steps: 4 }); await p.waitForTimeout(200);
        const a = await p.evaluate(() => [window.__game.sliceProgress, window.__game.knifeY]);
        await p.screenshot({ path: out + '/3a-messer-hoch.png' });
        console.log('knife up: progress', b[0].toFixed(3), '->', a[0].toFixed(3), 'knifeY', b[1].toFixed(3), '->', a[1].toFixed(3));
      }
      await mv(y0 + dy, { steps: 8 });
      if (s === 1 && !midShot && st[1] > 1.2) { await mv(y0 + dy * 0.6, { steps: 2 }); await p.waitForTimeout(150); await p.screenshot({ path: out + '/3-schneiden-mitte.png' }); await chk('schneiden-mitte'); midShot = true; }
      await p.mouse.up(); await p.waitForTimeout(120);
      n++;
    }
    if (s === 0) { await p.waitForTimeout(1200); await p.screenshot({ path: out + '/4-haufen.png' }); }
    if (s === 0) {
      // Seife wechseln: andere Seife im Regal antippen (aktuelle fliegt zurück)
      const pt = await shelfPt(1);
      await p.mouse.click(pt.x, pt.y);
      await p.waitForTimeout(250);
      await p.screenshot({ path: out + '/4b-seife-wechseln.png' });
      console.log('switch ->', await g(), await p.evaluate(() => window.__game.shelf.back));
    } else {
      console.log('before finish', await g(), await p.$$eval('#actions button', (b) => b.map((x) => x.textContent)), await p.evaluate(() => [window.__game.slicesCut, window.__game.sliceProgress, window.__game.returning]));
      if (await g() === 'cutting') await p.locator('#actions button', { hasText: 'Fertig' }).click();
      await p.waitForFunction(() => window.__game.state === 'shelf', null, { timeout: 30000 }); await p.waitForTimeout(400);
    }
    console.log('soap', order[s], 'swipes', n, 'mix', await p.evaluate(() => { const g = window.__game; return g.order.mix.map((m) => `${m.soap.name} ${g.pcts[m.soap.id].toFixed(1)}%/${m.pct} Regal ${g.slicesLeft(m.soap.id)} Scheiben`).join(', ') + ` Form ${g.fillPct.toFixed(1)}`; }));
  }
  for (let k = 0; k < 60 && await p.evaluate(() => window.__game.loose.activeCount) > 0; k++) await p.waitForTimeout(1000);
  await p.screenshot({ path: out + '/6-haufen-beide.png' });
  const spread = await p.evaluate(() => { const l = window.__game.loose; return { used: l.used, active: l.activeCount, fps: document.getElementById('fps').textContent }; });
  console.log('pile', JSON.stringify(spread));
  // Schrank ist nach „Ins Regal stellen“ für diesen Auftrag zu: sanfter Hinweis, kein Öffnen
  await p.mouse.click(VW / 2, 12); await p.waitForTimeout(700);
  { const lk = await p.evaluate(() => [document.getElementById('cabinet').classList.contains('open'), window.__game.state, document.getElementById('hint').textContent]);
    console.log('cabinet locked after cut', JSON.stringify(lk)); if (lk[0] || !/Erst nach diesem Auftrag/.test(lk[2])) note('Schrank nicht gesperrt ' + JSON.stringify(lk)); }
  await p.screenshot({ path: out + '/27-schrank-zu.png' });
  // Zusätze: Perlen freischalten (Test-Münzen) und zusammen mit Lavendelöl in die Masse
  await p.evaluate(() => { const g = window.__game; g.coins += 300; g.ui.setCoins(g.coins); });
  await p.locator('#actions button', { hasText: 'Zusätze' }).click(); await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/28-zusaetze.png' });
  const addCard = (nm) => p.locator('#pkg-list .pkg-card', { hasText: nm }).first();
  await addCard('Perlen in der Seife').scrollIntoViewIfNeeded(); await addCard('Perlen in der Seife').click(); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/29-zusatz-freischalten.png' });
  await p.click('#unlock-buy'); await p.waitForTimeout(300);
  await addCard('Perlen in der Seife').click(); await p.waitForTimeout(500);
  await p.locator('#actions button', { hasText: 'Zusätze' }).click(); await p.waitForTimeout(900);
  await addCard('Lavendelöl').scrollIntoViewIfNeeded(); await addCard('Lavendelöl').click(); await p.waitForTimeout(500);
  console.log('additives', await p.evaluate(() => window.__game.additives.map((a) => a.id)), 'coins', await p.evaluate(() => window.__game.coins));
  await p.locator('#actions button', { hasText: 'Schmelzen' }).click(); await p.waitForTimeout(400);
  if (await g() === 'addSheet') { await p.click('#pkg-close'); await p.waitForTimeout(300); await p.locator('#actions button', { hasText: 'Schmelzen' }).click(); }
  await p.waitForTimeout(1500); await p.screenshot({ path: out + '/5a-schmelzen.png' }); await chk('schmelzen');
  for (let k = 0; k < 150 && (await g()) !== 'reveal'; k++) await p.waitForTimeout(1000);
  console.log('state', await g());
  // Ausformen: Seifenform wählen (gewünschte Form der Bestellung)
  await p.click('#actions button');
  await p.waitForFunction(() => document.getElementById('pkg-picker').classList.contains('open')); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/5c-form-auswahl.png' });
  { const want = await p.evaluate(() => window.__game.order.shape.name);
    const names = await p.$$eval('#pkg-list .pkg-card .pkg-name', (n) => n.map((x) => x.textContent));
    console.log('shapes', names.join(','), 'want', want, 'locked', await p.$$eval('#pkg-list .pkg-card.locked', (c) => c.length));
    await p.locator('#pkg-list .pkg-card').nth(names.indexOf(want)).click(); }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/5-fertig.png' }); await chk('praesentation');
  console.log('quality', await p.evaluate(() => { const q = window.__game.quality; return [q.accuracy, q.stars, q.price, q.fill]; }), await p.$eval('#q-title', (e) => e.textContent), 'pearls', await p.evaluate(() => window.__game.pearlMesh.count));
  // Präsentation: mit dem Finger drehen (Gieren + Nicken), Schwung danach
  { const y0 = await p.evaluate(() => window.__game.showcase.yaw); const cx = VW / 2, cy = VH * 0.45;
    await p.mouse.move(cx - 70, cy); await p.mouse.down();
    for (let k = 1; k <= 8; k++) { await p.mouse.move(cx - 70 + k * 18, cy + k * 4); await p.waitForTimeout(30); }
    await p.screenshot({ path: out + '/5b-praesentation-drehen.png' }); await chk('praesentation-drehen'); await p.mouse.up();
    console.log('showcase', await p.evaluate(() => [window.__game.showcase.active, document.getElementById('vignette').className]), 'yaw', y0, '->', await p.evaluate(() => window.__game.showcase.yaw), 'state', await g()); }
  // Verkaufen -> Schale weg, Seife auf den Tisch
  const waitState = (st) => p.waitForFunction((st) => window.__game.state === st, st, { timeout: 60000 });
  const screenOf = (expr) => p.evaluate((expr) => { const g = window.__game; const v = eval(expr).clone().project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, expr);
  await p.click('#actions button');
  await waitState('pickPkg'); await p.waitForTimeout(400);
  console.log('bowl visible', await p.evaluate(() => window.__game.bowl.visible), 'coins', await p.evaluate(() => window.__game.coins));
  await p.screenshot({ path: out + '/7-seife-auf-tisch.png' }); await chk('seife-auf-tisch');
  // Päckchen im Regal antippen
  let pt = await screenOf('g.packages.home[0]');
  await p.mouse.click(pt.x, pt.y);
  await waitState('picker'); await p.waitForTimeout(500);
  // Spiel-Taps sind pausiert, Schließen per X
  await p.click('#pkg-close'); await p.waitForTimeout(400);
  console.log('after X', await g());
  // gestapelte (schicke) Päckchen öffnen das Fenster auch
  pt = await screenOf("g.packages.home[g.packages.slotOf('kiste')]");
  await p.mouse.click(pt.x, pt.y);
  await waitState('picker'); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/12-paeckchen-auswahl.png' });
  // gesperrt: Freischalt-Dialog; erst zu wenig Münzen, dann (Test-Münzen) kaufen
  await p.evaluate(() => { const g = window.__game; g.coins = 20; g.ui.setCoins(g.coins); });
  await p.click('#pkg-list .pkg-card >> nth=1'); await p.waitForTimeout(400);
  console.log('locked tap ->', await g(), await p.$eval('#unlock-buy', (e) => [e.disabled, e.textContent]));
  await p.screenshot({ path: out + '/13-freischalten-zu-wenig.png' });
  await p.click('#unlock-close'); await p.waitForTimeout(300);
  await p.evaluate(() => { const g = window.__game; g.coins += 500; g.ui.setCoins(g.coins); });
  await p.click('#pkg-list .pkg-card >> nth=1'); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/13-freischalten.png' });
  await p.click('#unlock-buy'); await p.waitForTimeout(400);
  console.log('bought ->', await p.evaluate(() => [window.__game.coins, localStorage.getItem('seifen-save-v1')]));
  await p.click('#pkg-tabs .tab >> nth=3'); await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/12-paeckchen-formen.png' });
  console.log('tabs', await p.$$eval('#pkg-tabs .tab', (t) => t.map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''))), 'cards', await p.$$eval('#pkg-list .pkg-card', (c) => c.length));
  await p.$eval('#pkg-list', (e) => { e.scrollLeft = 0; });
  await p.waitForTimeout(300);
  await p.click('#pkg-list .pkg-card >> nth=1');
  await waitState('pickSoap'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/8-paeckchen-offen.png' }); await chk('paeckchen-offen');
  // Seife antippen -> ins Päckchen, Deckel drauf
  pt = await screenOf('g.bar.position');
  await p.mouse.click(pt.x, pt.y);
  await waitState('decorFill'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/21-deko-start.png' }); await chk('deko-start');
  // ---- Deko ----
  const idle = () => p.waitForFunction(() => !window.__game.drag && !window.__game.deco.busy, null, { timeout: 60000 });
  const tapShelf = async (grp) => { const q = await p.evaluate((x) => window.__game.testPx(x), grp); await p.mouse.click(q.x, q.y); await p.waitForFunction(() => document.getElementById('pkg-picker').classList.contains('open')); await p.waitForTimeout(500); };
  const cardIdx = (name) => p.$$eval('#pkg-list .pkg-card .pkg-name', (n, nm) => n.findIndex((x) => x.textContent === nm), name);
  const card = async (name) => { const i = await cardIdx(name); const c = p.locator('#pkg-list .pkg-card').nth(i); await c.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); return c; };
  // gedrückt halten -> schwebt über dem Finger -> über dem Paket loslassen
  const dragTo = async (name, shot, miss) => {
    const bb = await (await card(name)).boundingBox(), pk = await p.evaluate(() => window.__game.testPx('pkg'));
    const sx = bb.x + bb.width / 2, sy = bb.y + bb.height / 2, tx = miss ? 40 : pk.x, ty = miss ? VH * 0.62 : pk.y + 40;
    await p.mouse.move(sx, sy); await p.mouse.down();
    await p.waitForFunction(() => !!window.__game.drag, null, { timeout: 20000 });
    for (let k = 1; k <= 10; k++) { await p.mouse.move(sx + (tx - sx) * k / 10, sy + (ty - sy) * k / 10); await p.waitForTimeout(40); }
    await p.waitForTimeout(300);
    if (shot) await p.screenshot({ path: out + '/' + shot });
    await p.mouse.up(); await idle(); await p.waitForTimeout(200);
    console.log('deco drag', name, miss ? '(daneben)' : '', '->', await p.evaluate(() => [window.__game.deco.bonus, window.__game.deco.applied.map((x) => x.id).join(',')]));
  };
  await tapShelf('perlen');
  await p.screenshot({ path: out + '/22-deko-auswahl.png' });
  console.log('deco tabs', await p.$$eval('#pkg-tabs .tab', (t) => t.map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''))), 'cards', await p.$$eval('#pkg-list .pkg-card', (c) => c.length));
  await dragTo('Perlmutt-Perlen', '24-deko-ziehen.png');
  await tapShelf('perlen'); await dragTo('Perlmutt-Perlen', null, true);   // daneben: fällt weg, kostet nichts
  await tapShelf('perlen'); await dragTo('Perlmutt-Perlen');               // gleiche Sorte nochmal: mehr Teile, Bonus nur einmal
  // gesperrte Deko freischalten
  await tapShelf('blueten');
  await (await card('Vergissmeinnicht')).click(); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/23-deko-freischalten.png' });
  await p.click('#unlock-buy'); await p.waitForTimeout(400);
  console.log('deco bought ->', await p.evaluate(() => [window.__game.coins, localStorage.getItem('seifen-save-v1')]));
  await dragTo('Vergissmeinnicht');
  // Antippen = fliegt von selbst ins Paket
  await tapShelf('blueten');
  await (await card('Margeriten')).click(); await idle(); await p.waitForTimeout(300);
  console.log('tap place ->', await p.evaluate(() => [window.__game.deco.bonus, window.__game.deco.applied.map((x) => x.id).join(',')]));
  await p.screenshot({ path: out + '/25-deko-gefuellt.png' }); await chk('deko-gefuellt');
  await p.locator('#actions button', { hasText: 'Rückgängig' }).click(); await p.waitForTimeout(300);
  console.log('undo ->', await p.evaluate(() => [window.__game.deco.bonus, window.__game.deco.applied.map((x) => x.id).join(',')]));
  // Schleife bei offenem Paket: geht noch nicht – dezenter Hinweis, Deckel wackelt, Paket bleibt offen
  { const q = await p.evaluate(() => window.__game.testPx('baender')); await p.mouse.click(q.x, q.y); await p.waitForTimeout(250); }
  await p.screenshot({ path: out + '/25b-deckel-hinweis.png' });
  console.log('ribbon while open ->', await g(), 'sheet open', await p.evaluate(() => document.getElementById('pkg-picker').classList.contains('open')), 'hint', await p.$eval('#hint', (e) => e.textContent));
  await p.waitForTimeout(500);
  // Deckel antippen -> Deckel geht zu
  { const q = await p.evaluate(() => window.__game.testPx('lid')); console.log('lid at', q); await p.mouse.click(q.x, q.y); }
  await waitState('packed'); await idle(); await p.waitForTimeout(300);
  await tapShelf('baender');
  await (await card('Bäckerschnur')).click();
  await p.waitForFunction(() => window.__game.state === 'packed' && !window.__game.deco.busy && !!window.__game.deco.lidItems.baender, null, { timeout: 60000 }); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/9-paeckchen-zu.png' }); await chk('paeckchen-zu');
  await tapShelf('perlen');
  console.log('fill items disabled after lid', await p.$$eval('#pkg-list .pkg-card.disabled', (c) => c.length), 'of', await p.$$eval('#pkg-list .pkg-card', (c) => c.length));
  await p.click('#pkg-close'); await p.waitForTimeout(300);
  await tapShelf('anhaenger'); await (await card('Kraft-Anhänger mit Namen')).click(); await idle(); await p.waitForTimeout(300);
  await tapShelf('siegel'); await dragTo('Sticker „Danke“');
  await p.screenshot({ path: out + '/26-deko-deckel.png' }); await chk('deko-deckel');
  const decoTxt = await p.$eval('#order-deco', (e) => e.textContent);
  const before = await p.evaluate(() => [window.__game.coins, window.__game.price, window.__game.pkgType.bonus, window.__game.deco.bonus]);
  console.log('panel', decoTxt, 'before send [coins, price, pkgBonus, deco]', before);
  // zu kurzer Wisch: federt zurück, nichts passiert
  pt = await screenOf('g.packages.home[0].clone().set(0.5, 0.1, -0.34)');
  await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x + 20, pt.y, { steps: 2 }); await p.mouse.up();
  await p.waitForTimeout(600);
  console.log('after short swipe', await g());
  // richtiger Wisch nach rechts, Screenshot mittendrin
  await p.mouse.move(pt.x, pt.y); await p.mouse.down();
  await p.mouse.move(pt.x - 60, pt.y, { steps: 4 });
  await p.screenshot({ path: out + '/10-wischen-mitte.png' });
  await p.mouse.move(pt.x - 200, pt.y + 10, { steps: 4 }); await p.mouse.up();
  await waitState('choose'); await p.waitForTimeout(1200);
  console.log('earned', await p.evaluate(() => window.__game.lastEarned), 'expected', before[1] + before[2] + before[3]);
  console.log('after send', await g(), 'coins', await p.evaluate(() => window.__game.coins), 'hint', await p.$eval('#hint', (e) => e.textContent), 'notes', JSON.stringify(await p.evaluate(() => window.__game.notes.orders.map((o) => o && o.customer))));
  await p.screenshot({ path: out + '/11-naechste-bestellung.png' });

  // ---------- Auftrag mit 2+ Seifen gewinnen ----------
  const shelfPtM = (i) => p.evaluate((i) => { const g = window.__game; const v = g.shelf.home[i].clone().project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, i);
  const drawerIdx = (name) => p.evaluate((name) => [...document.querySelectorAll('#cab-grid .drawer')].findIndex((b) => b._d.kind === 'soap' && b._d.soap.name === name), name);
  const takeFromCab = async (list) => {
    await p.mouse.click(VW / 2, 12); await p.waitForFunction(() => document.getElementById('cabinet').classList.contains('open')); await p.waitForTimeout(700);
    for (const [name, n] of list) { const i = await drawerIdx(name); await p.$eval(`#cab-grid .drawer:nth-child(${i + 1})`, (e) => e.scrollIntoView({ block: 'center', inline: 'center' })); await p.waitForTimeout(300);
      for (let k = 0; k < n; k++) { await p.click(`#cab-grid .drawer >> nth=${i}`); await p.waitForTimeout(300); } }
    await p.click('#cab-done');
  };
  const cutSort = async (shelfIdx, slices) => {
    const pt = await shelfPtM(shelfIdx); await p.mouse.click(pt.x, pt.y);
    await p.waitForFunction(() => window.__game.state === 'cutting', null, { timeout: 30000 });
    await p.waitForFunction(() => { const c = window.__game.testCutPx(); return c.zoom >= 1 && c.tilt >= 1; }, null, { timeout: 30000 }); await p.waitForTimeout(300);
    for (let n = 0, t0 = Date.now(); n < 60 && Date.now() - t0 < 240000;) {   // n = Wische (Warten aufs Messer zählt nicht)
      const st = await p.evaluate(() => { const g = window.__game; return [g.state, g.slicesCut + (g.returning ? 0 : g.sliceProgress), g.returning]; });
      if (st[0] !== 'cutting' || st[1] >= slices - 1e-3) break;
      if (st[2]) { await p.waitForTimeout(80); continue; }
      n++;
      const geo = await p.evaluate(() => window.__game.testCutPx());
      const lx = (yy) => geo.restX + (geo.botX - geo.restX) * (yy - geo.rest) / (geo.bot - geo.rest), y0 = geo.rest - 12, dy = (geo.top - geo.rest) + 1.08 * (geo.bot - geo.top);
      await p.mouse.move(lx(y0), y0); await p.mouse.down(); await p.mouse.move(lx(y0 + dy), y0 + dy, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(120);
    }
    if (await g() === 'cutting') await p.locator('#actions button', { hasText: 'Fertig' }).click();
    await p.waitForFunction(() => ['shelf', 'failed'].includes(window.__game.state), null, { timeout: 30000 });
    await p.waitForFunction(() => { const g = window.__game; return g.shelf.back < 0 && g.testCutPx().zoom <= 0.001 && Math.abs((g.viewShift || 0) - (g.viewShiftTarget || 0)) < 1; }, null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(400);
    const sc = await p.evaluate(() => [window.__game.state, JSON.stringify([...window.__game.supply])]); console.log(' cut ->', sc.join(' '));
  };
  const finishItem = async (k) => {
    for (let q = 0; q < 60 && await p.evaluate(() => window.__game.loose.activeCount) > 0; q++) await p.waitForTimeout(1000);
    await p.locator('#actions button', { hasText: 'Schmelzen' }).click(); await p.waitForTimeout(500);
    if (await g() === 'addSheet') {   // gewünschter Zusatz: aus dem Blatt nehmen, dann schmelzen
      const want = await p.evaluate(() => window.__game.order.additive && window.__game.order.additive.name);
      const c = p.locator('#pkg-list .pkg-card', { hasText: want || '###' }).first();
      if (want && await c.count()) { await c.scrollIntoViewIfNeeded(); await c.click(); await p.waitForTimeout(600); } else { await p.click('#pkg-close'); await p.waitForTimeout(300); }
      if (await g() === 'addSheet') { await p.click('#pkg-close'); await p.waitForTimeout(300); }
      await p.locator('#actions button', { hasText: 'Schmelzen' }).click(); await p.waitForTimeout(500);
    }
    for (let q = 0; q < 150 && (await g()) !== 'reveal'; q++) await p.waitForTimeout(1000);
    await p.click('#actions button'); await p.waitForFunction(() => document.getElementById('pkg-picker').classList.contains('open')); await p.waitForTimeout(500);
    { const want = await p.evaluate(() => window.__game.order.shape.name); const names = await p.$$eval('#pkg-list .pkg-card .pkg-name', (n) => n.map((x) => x.textContent));
      await p.locator('#pkg-list .pkg-card').nth(names.indexOf(want)).click(); }
    await p.waitForTimeout(1500);
    if (k === 0) { await p.screenshot({ path: out + '/31-multi-seife1-fertig.png' }); await chk('multi-praesentation'); }
    await p.click('#actions button'); await waitState('pickPkg'); await p.waitForTimeout(400);
    let q = await screenOf('g.packages.home[0]'); await p.mouse.click(q.x, q.y); await waitState('picker'); await p.waitForTimeout(500);
    await p.click('#pkg-list .pkg-card:not(.locked) >> nth=0'); await waitState('pickSoap'); await p.waitForTimeout(300);
    q = await screenOf('g.bar.position'); await p.mouse.click(q.x, q.y); await waitState('decorFill'); await p.waitForTimeout(400);
    q = await p.evaluate(() => window.__game.testPx('lid')); await p.mouse.click(q.x, q.y); await waitState('packed'); await p.waitForTimeout(500);
    const val = await p.evaluate(() => window.__game.price + window.__game.pkgType.bonus + window.__game.deco.bonus);
    q = await screenOf('g.packages.home[0].clone().set(0.5, 0.1, -0.34)');
    await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.mouse.move(q.x - 60, q.y, { steps: 4 }); await p.mouse.move(q.x - 200, q.y + 10, { steps: 4 }); await p.mouse.up();
    return val;
  };
  {
    const mi = await p.evaluate(() => window.__game.notes.orders.findIndex((o) => o && o.items.length > 1));
    const info = await p.evaluate((i) => { const o = window.__game.notes.orders[i]; return { items: o.items.map((it) => it.mix.map((m) => `${m.soap.name} ${m.pct}`).join('+')), total: o.total }; }, mi);
    console.log('multi order', mi, JSON.stringify(info)); if (mi < 0) note('kein Mehr-Seifen-Auftrag am Brett');
    np = await noteAt(mi); await p.mouse.click(np.x, np.y); await p.waitForTimeout(500);
    await p.screenshot({ path: out + '/30-multi-zettel.png' });
    await p.click('#note-accept'); await p.waitForTimeout(600);
    const need = await p.evaluate(() => { const g = window.__game; return [...window.__barsNeeded(g.order)].map(([id, n]) => [g.order.items.flatMap((it) => it.mix).find((m) => m.soap.id === id).soap.name, n]); });
    console.log('multi need', JSON.stringify(need));
    const coins0 = await p.evaluate(() => window.__game.coins);
    await takeFromCab(need);
    await p.waitForFunction(() => window.__game.state === 'shelf', null, { timeout: 60000 }); await p.waitForTimeout(600);
    await p.screenshot({ path: out + '/30b-multi-regal.png' }); await chk('multi-regal');
    const n = await p.evaluate(() => window.__game.order.items.length); let sum = 0;
    for (let k = 0; k < n; k++) {
      const plan = await p.evaluate(() => { const g = window.__game; return g.order.mix.map((m) => [g.shelf.soaps.indexOf(m.soap), m.pct, m.soap.name, m.soap.id]); });
      console.log('multi soap', k + 1, 'plan', JSON.stringify(plan), 'order', await p.$eval('#order', (e) => e.textContent.replace(/\s+/g, ' ').trim()));
      // je Sorte schneiden, bis der Anteil stimmt; ist das vorderste Stück alle, rückt das nächste nach -> erneut antippen
      for (const [si, pct, , id] of plan) for (let r = 0; r < 3; r++) {
        const have = await p.evaluate((id) => window.__game.pcts[id] || 0, id);
        if (have >= pct - 4 || await g() !== 'shelf') break;
        await cutSort(si, Math.ceil((pct - have - 4) / 10));
      }
      if (await g() === 'failed') { note('Mehr-Seifen-Auftrag gescheitert ' + await p.$eval('#fail-why', (e) => e.textContent)); break; }
      if (k === 0) { await p.mouse.click(VW / 2, 12); await p.waitForTimeout(600); console.log('multi cabinet still locked', !(await p.evaluate(() => document.getElementById('cabinet').classList.contains('open')))); }
      sum += await finishItem(k);
      if (k < n - 1) { await waitState('shelf'); await p.waitForTimeout(800); console.log('multi next', await p.$eval('#hint', (e) => e.textContent), 'pending', await p.evaluate(() => window.__game.pending)); if (k === 0) await p.screenshot({ path: out + '/32-multi-seife2.png' }); }
    }
    await waitState('choose'); await p.waitForTimeout(1200);
    const res = await p.evaluate(() => [window.__game.lastEarned, window.__game.coins]);
    console.log('multi earned', res[0], 'expected', sum, 'coins', coins0, '->', res[1], res[0] === sum && res[1] - coins0 === sum ? 'ok' : 'FEHLER');
    if (res[0] !== sum) note('Mehr-Seifen-Auszahlung');
    await p.screenshot({ path: out + '/33-multi-gewonnen.png' });
  }
  // ---------- Fehlschlag: zu wenig Seife genommen ----------
  {
    const mi = await p.evaluate(() => window.__game.notes.orders.findIndex((o) => o && o.items.length > 1));
    np = await noteAt(mi); await p.mouse.click(np.x, np.y); await p.waitForTimeout(500); await p.click('#note-accept'); await p.waitForTimeout(600);
    const first = await p.evaluate(() => window.__game.order.items[0].mix[0].soap.name);
    await takeFromCab([[first, 1]]);
    await p.waitForFunction(() => document.getElementById('fail').classList.contains('open'), null, { timeout: 30000 }); await p.waitForTimeout(700);
    const f = await p.evaluate(() => [window.__game.state, document.getElementById('fail-title').textContent, document.getElementById('fail-why').textContent]);
    console.log('fail', JSON.stringify(f)); if (f[0] !== 'failed') note('kein Fehlschlag');
    await p.screenshot({ path: out + '/34-nicht-genug.png' });
    await p.click('#fail-retry'); await p.waitForTimeout(900);
    const r = await p.evaluate(() => [window.__game.state, window.__game.stocked, window.__game.take.size, window.__game.order && window.__game.order.cur]);
    console.log('retry', JSON.stringify(r)); if (r[1] || r[2]) note('Nochmal versuchen setzt nicht zurück');
    await p.screenshot({ path: out + '/35-nochmal.png' }); await chk('nochmal');
  }
  console.log('overlaps', JSON.stringify(overlaps));
  console.log('errors', errs);
  await b.close();
})();
