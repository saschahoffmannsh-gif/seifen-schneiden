// Headless-Test einer kompletten Runde + Screenshots. Aufruf: node tests/round.cjs <url> <outdir>
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const url = process.argv[2] || 'http://localhost:4173/seifen-schneiden/';
const out = process.argv[3] || '/workspace/seifen-shots';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const [VW, VH] = (process.env.VIEW || '420x860').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url + '?fps=1');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/1-regal.png' });
  // Mitten auf den Tisch tippen darf nichts auswählen
  await p.mouse.click(VW / 2, VH * 0.8); await p.waitForTimeout(300);
  console.log('tap on table ->', await p.evaluate(() => window.__game.state));
  const g = () => p.evaluate(() => window.__game.state);
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
  await p.screenshot({ path: out + '/15-bestellung-aktiv.png' });
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
  const wrong = await p.evaluate(() => { const g = window.__game; return [...document.querySelectorAll('#cab-grid .drawer.soap')].findIndex((b) => !g.order.soaps.includes(b._d.soap)); });
  await p.click(`#cab-grid .drawer.soap >> nth=${wrong}`); await p.waitForTimeout(150);
  console.log('wrong drawer ->', await p.$eval('#cab-msg', (e) => e.textContent));
  await p.screenshot({ path: out + '/18-schublade-falsch.png' });
  for (let s = 0; s < order.length; s++) {
    const idx = await p.evaluate((name) => [...document.querySelectorAll('#cab-grid .drawer')].findIndex((b) => b._d.kind === 'soap' && b._d.soap.name === name), order[s]);
    await p.$eval(`#cab-grid .drawer:nth-child(${idx + 1})`, (e) => e.scrollIntoView({ block: 'center' }));
    await p.click(`#cab-grid .drawer >> nth=${idx}`); await p.waitForTimeout(500);
    console.log('picked', order[s], '->', await p.$eval('#cab-find', (e) => e.textContent));
    if (s === 0) await p.screenshot({ path: out + '/19-schublade-gefunden.png' });
  }
  await p.waitForFunction(() => window.__game.state === 'shelf', null, { timeout: 60000 });
  await p.waitForTimeout(600);
  console.log('stocked', await p.$eval('#hint', (e) => e.textContent), await p.evaluate(() => window.__game.shelf.soaps.map((s) => s.name)));
  await p.screenshot({ path: out + '/20-regal-bestueckt.png' });
  // Zettel bleiben antippbar, Seifen auch (kein Konflikt)
  np = await noteAt(2);
  await p.mouse.click(np.x, np.y); await p.waitForTimeout(400);
  console.log('note tap while stocked ->', await p.evaluate(() => document.getElementById('note-view').classList.contains('open')));
  await p.click('#note-close'); await p.waitForTimeout(400);
  for (let s = 0; s < order.length; s++) {
    const pt = await p.evaluate((i) => { const g = window.__game; const v = g.shelf.home[i].clone().project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, s);
    await p.mouse.click(pt.x, pt.y);
    await p.waitForFunction(() => window.__game.state === 'cutting', null, { timeout: 30000 });
    await p.waitForTimeout(500);
    if (s === 0) await p.screenshot({ path: out + '/2-seife-intakt.png' });
    await p.mouse.move(210, 520); await p.mouse.down();
    let n = 0;
    while ((await g()) === 'cutting' && n < 400) {
      await p.mouse.move(130, 520, { steps: 3 }); await p.mouse.move(290, 520, { steps: 3 });
      n++;
      const f = await p.evaluate(() => window.__game.block.cutFraction);
      if (s === 0 && !midShot && f > 0.33) { await p.mouse.up(); await p.waitForTimeout(120); await p.screenshot({ path: out + '/3-schneiden-mitte.png' }); midShot = true; await p.mouse.down(); }
    }
    await p.mouse.up();
    if (s === 0) { await p.waitForTimeout(1500); await p.screenshot({ path: out + '/4-haufen.png' }); }
    if (s === order.length - 1) { for (let k = 0; k < 120 && await p.evaluate(() => window.__game.loose.activeCount) > 0; k++) await p.waitForTimeout(1000); await p.screenshot({ path: out + '/6-haufen-beide.png' }); }
    await p.waitForTimeout(1200);
    console.log('soap', order[s], 'state', await g(), 'swipes', n);
  }
  const spread = await p.evaluate(() => { const l = window.__game.loose; let mx = 0, mn = 9, zx = -9, zn = 9; for (let i = 0; i < l.used; i++) { if (l.state[i] !== 2) continue; const x = l.pos[i*3], z = l.pos[i*3+2]; mx = Math.max(mx, x); mn = Math.min(mn, x); zx = Math.max(zx, z); zn = Math.min(zn, z); } let hmax = 0; for (const v of l.heights) hmax = Math.max(hmax, v); let rmax = 0; for (let i = 0; i < l.used; i++) if (l.state[i] === 2) rmax = Math.max(rmax, Math.hypot(l.pos[i*3], l.pos[i*3+2])); return { used: l.used, active: l.activeCount, hmax, rmax, x: [mn, mx], z: [zn, zx], fps: document.getElementById('fps').textContent }; });
  console.log('pile', JSON.stringify(spread));
  await p.click('#actions button'); // Ofen
  for (let k = 0; k < 150 && (await g()) !== 'reveal'; k++) { await p.waitForTimeout(1000); if (k % 20 === 0) console.log('oven', await p.evaluate(() => [window.__game.state, window.__game.ovenT])); }
  console.log('state', await g());
  await p.click('#actions button'); await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/5-fertig.png' });
  // Verkaufen -> Schale weg, Seife auf den Tisch
  const waitState = (st) => p.waitForFunction((st) => window.__game.state === st, st, { timeout: 60000 });
  const screenOf = (expr) => p.evaluate((expr) => { const g = window.__game; const v = eval(expr).clone().project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, expr);
  await p.click('#actions button');
  await waitState('pickPkg'); await p.waitForTimeout(400);
  console.log('bowl visible', await p.evaluate(() => window.__game.bowl.visible), 'coins', await p.evaluate(() => window.__game.coins));
  await p.screenshot({ path: out + '/7-seife-auf-tisch.png' });
  // Päckchen im Regal antippen
  let pt = await screenOf('g.packages.home[0]');
  await p.mouse.click(pt.x, pt.y);
  await waitState('picker'); await p.waitForTimeout(500);
  // Spiel-Taps sind pausiert, Schließen per X
  await p.click('#pkg-close'); await p.waitForTimeout(400);
  console.log('after X', await g());
  // gestapelte (schicke) Päckchen öffnen das Fenster auch
  pt = await screenOf('g.packages.home[3]');
  await p.mouse.click(pt.x, pt.y);
  await waitState('picker'); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/12-paeckchen-auswahl.png' });
  await p.click('#pkg-list .pkg-card >> nth=1'); await p.waitForTimeout(250);
  console.log('locked tap ->', await g(), await p.$eval('#pkg-note', (e) => e.classList.contains('show')));
  await p.screenshot({ path: out + '/13-auswahl-gesperrt.png' });
  await p.$eval('#pkg-list', (e) => { e.scrollLeft = 400; });
  await p.waitForTimeout(300);
  console.log('scrolled', await p.$eval('#pkg-list', (e) => [e.scrollLeft, e.scrollWidth, e.clientWidth]));
  await p.$eval('#pkg-list', (e) => { e.scrollLeft = 0; });
  await p.click('#pkg-list .pkg-card >> nth=0');
  await waitState('pickSoap'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/8-paeckchen-offen.png' });
  // Seife antippen -> ins Päckchen, Deckel drauf
  pt = await screenOf('g.bar.position');
  await p.mouse.click(pt.x, pt.y);
  await waitState('packed'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/9-paeckchen-zu.png' });
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
  console.log('after send', await g(), 'coins', await p.evaluate(() => window.__game.coins), 'hint', await p.$eval('#hint', (e) => e.textContent), 'notes', JSON.stringify(await p.evaluate(() => window.__game.notes.orders.map((o) => o && o.customer))));
  await p.screenshot({ path: out + '/11-naechste-bestellung.png' });
  console.log('errors', errs);
  await b.close();
})();
