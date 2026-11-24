// Probe Puzzle: Mehr-Seifen-Auftrag, Schrank (scrollen), Regal mit Ersatzstücken, Schrank zu, Fehlschlag.
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const url = process.argv[2], out = process.argv[3];
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const [VW, VH] = (process.env.VIEW || '390x844').split('x').map(Number);
  const mk = async () => {
    const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
    if (process.env.SAFE) { const [st, sb] = process.env.SAFE.split(',').map(Number); await p.addInitScript(([st, sb]) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.setProperty('--sa-top', st + 'px'); document.documentElement.style.setProperty('--sa-bottom', sb + 'px'); }); }, [st, sb]); }
    p.on('pageerror', (e) => console.log('PAGE-ERROR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('PAGE-ERROR', m.text()));
    await p.goto(url); await p.waitForTimeout(2500);
    await p.click('#start-play'); await p.waitForTimeout(900);
    return p;
  };
  const noteAt = (p, i) => p.evaluate((i) => { const v = window.__game.notes.screenPos(i, window.__game.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, i);
  const drawer = async (p, name) => { const i = await p.evaluate((name) => [...document.querySelectorAll('#cab-grid .drawer')].findIndex((b) => b._d.kind === 'soap' && b._d.soap.name === name), name); return p.locator(`#cab-grid .drawer >> nth=${i}`); };
  const openCab = async (p) => { await p.mouse.click(VW / 2, 12); await p.waitForFunction(() => document.getElementById('cabinet').classList.contains('open')); await p.waitForTimeout(800); };
  let p = await mk();
  await p.screenshot({ path: out + '/a-brett.png' });
  const multi = await p.evaluate(() => window.__game.notes.orders.findIndex((o) => o && o.items.length > 1));
  const info = await p.evaluate((i) => { const o = window.__game.notes.orders[i]; return { items: o.items.map((it) => it.mix.map((m) => m.soap.name + ' ' + m.pct).join('+')), total: o.total }; }, multi);
  console.log('multi note', multi, JSON.stringify(info));
  let np = await noteAt(p, multi); await p.mouse.click(np.x, np.y); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/b-zettel-gross.png' });
  await p.click('#note-accept'); await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/c-angenommen.png' });
  const need = await p.evaluate(() => { const g = window.__game; return [...window.__barsNeeded(g.order)].map(([id, n]) => [g.order.items.flatMap((it) => it.mix).find((m) => m.soap.id === id).soap.name, n]); });
  console.log('need', JSON.stringify(need));
  await openCab(p);
  await p.screenshot({ path: out + '/d-schrank-links.png' });
  for (const [name, n] of need) { const d = await drawer(p, name); for (let k = 0; k < n; k++) { await d.click(); await p.waitForTimeout(350); } }
  await p.screenshot({ path: out + '/e-schrank-genommen.png' });
  await p.evaluate(() => { document.getElementById('cab-grid').scrollLeft = 1e5; }); await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/e2-schrank-rechts.png' });
  console.log('take', JSON.stringify(await p.evaluate(() => [...window.__game.take])), await p.$eval('#cab-done', (e) => [e.disabled, e.textContent]));
  await p.click('#cab-done');
  await p.waitForFunction(() => window.__game.state === 'shelf', null, { timeout: 30000 }); await p.waitForTimeout(900);
  console.log('regal', JSON.stringify(await p.evaluate(() => { const g = window.__game; return { shelf: g.shelf.soaps.map((s) => s.name), spares: [...g.shelf.spareN], supply: [...g.supply], hint: document.getElementById('hint').textContent, order: document.getElementById('order').textContent.replace(/\s+/g, ' ').trim() }; })));
  await p.screenshot({ path: out + '/f-regal.png' });
  await p.mouse.click(VW / 2, 12); await p.waitForTimeout(500);
  console.log('schrank zu', await p.evaluate(() => [window.__game.state, document.getElementById('cabinet').classList.contains('open'), document.getElementById('hint').textContent]));
  await p.screenshot({ path: out + '/g-schrank-zu.png' });
  await p.close();
  // Fehlschlag: zu wenig genommen
  p = await mk();
  const m2 = await p.evaluate(() => window.__game.notes.orders.findIndex((o) => o && o.items.length > 1));
  np = await noteAt(p, m2); await p.mouse.click(np.x, np.y); await p.waitForTimeout(500); await p.click('#note-accept'); await p.waitForTimeout(600);
  const first = await p.evaluate(() => window.__game.order.items[0].mix[0].soap.name);
  await openCab(p);
  await (await drawer(p, first)).click(); await p.waitForTimeout(400);
  await p.click('#cab-done');
  await p.waitForFunction(() => document.getElementById('fail').classList.contains('open'), null, { timeout: 30000 }); await p.waitForTimeout(700);
  console.log('fail', await p.evaluate(() => [window.__game.state, document.getElementById('fail-why').textContent, document.getElementById('fail-rule').textContent]));
  await p.screenshot({ path: out + '/h-nicht-genug.png' });
  await p.click('#fail-retry'); await p.waitForTimeout(800);
  console.log('retry', await p.evaluate(() => [window.__game.state, window.__game.stocked, window.__game.take.size, document.getElementById('hint').textContent]));
  await p.screenshot({ path: out + '/i-nochmal.png' });
  await b.close();
})();
