// Headless-Test einer kompletten Runde + Screenshots. Aufruf: node tests/round.cjs <url> <outdir>
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const url = process.argv[2] || 'http://localhost:4173/seifen-schneiden/';
const out = process.argv[3] || '/workspace/seifen-shots';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url + '?fps=1');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/1-regal.png' });
  // Mitten auf den Tisch tippen darf nichts auswählen
  await p.mouse.click(210, 700); await p.waitForTimeout(300);
  console.log('tap on table ->', await p.evaluate(() => window.__game.state));
  const g = () => p.evaluate(() => window.__game.state);
  let midShot = false;
  for (let s = 0; s < 2; s++) {
    // Seife im Regal antippen (Bildschirmposition aus der 3D-Position)
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
    if (s === 1) { for (let k = 0; k < 120 && await p.evaluate(() => window.__game.loose.activeCount) > 0; k++) await p.waitForTimeout(1000); await p.screenshot({ path: out + '/6-haufen-beide.png' }); }
    await p.waitForTimeout(1200);
    console.log('soap', s, 'state', await g(), 'swipes', n);
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
  await waitState('pickSoap'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/8-paeckchen-offen.png' });
  // Seife antippen -> ins Päckchen, Deckel drauf
  pt = await screenOf('g.bar.position');
  await p.mouse.click(pt.x, pt.y);
  await waitState('packed'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/9-paeckchen-zu.png' });
  // zu kurzer Wisch: federt zurück, nichts passiert
  pt = await screenOf('g.packages.body.position.clone().set(0.74, 0.1, 0.2)');
  await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x + 20, pt.y, { steps: 2 }); await p.mouse.up();
  await p.waitForTimeout(600);
  console.log('after short swipe', await g());
  // richtiger Wisch nach rechts, Screenshot mittendrin
  await p.mouse.move(pt.x, pt.y); await p.mouse.down();
  await p.mouse.move(pt.x - 60, pt.y, { steps: 4 });
  await p.screenshot({ path: out + '/10-wischen-mitte.png' });
  await p.mouse.move(pt.x - 200, pt.y + 10, { steps: 4 }); await p.mouse.up();
  await waitState('shelf'); await p.waitForTimeout(700);
  console.log('after send', await g(), 'coins', await p.evaluate(() => window.__game.coins), 'pkgs on shelf', await p.evaluate(() => [...window.__game.packages.onShelf]));
  await p.screenshot({ path: out + '/11-naechste-bestellung.png' });
  console.log('errors', errs);
  await b.close();
})();
