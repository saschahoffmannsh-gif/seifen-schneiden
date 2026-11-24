// Probe Seifen-Looks: Startbildschirm, Schrank (Bildchen), Regal, Block beim Schneiden, lose Würfel.
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const url = process.argv[2], out = process.argv[3];
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const [VW, VH] = (process.env.VIEW || '390x844').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  if (process.env.SAFE) { const [st, sb] = process.env.SAFE.split(',').map(Number); await p.addInitScript(([st, sb]) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.setProperty('--sa-top', st + 'px'); document.documentElement.style.setProperty('--sa-bottom', sb + 'px'); }); }, [st, sb]); }
  p.on('pageerror', (e) => console.log('PAGE-ERROR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('PAGE-ERROR', m.text()));
  await p.goto(url); await p.waitForTimeout(3500);
  await p.screenshot({ path: out + '/a-start.png' });
  await p.click('#start-play'); await p.waitForTimeout(900);
  await p.mouse.click(VW / 2, 12); await p.waitForFunction(() => document.getElementById('cabinet').classList.contains('open')); await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/b-schrank.png' });
  await p.evaluate(() => { document.getElementById('cab-grid').scrollLeft = 1e5; }); await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/b2-schrank-rechts.png' });
  await p.click('#cab-close'); await p.waitForTimeout(700);
  const soaps = (names) => p.evaluate((names) => { window.__S = Object.fromEntries(window.__game.cabLayout.filter((d) => d.kind === 'soap').map((d) => [d.soap.name, d.soap])); return names.every((n) => window.__S[n]); }, names);
  console.log('soaps ok', await soaps(['Erdbeere']));
  for (const [tag, set] of [['c-regal-1', ['Erdbeere', 'Zitrone', 'Honig', 'Minze']], ['c-regal-2', ['Orange', 'Rose', 'Matcha', 'Lavendel']], ['c-regal-3', ['Kokos', 'Aktivkohle', 'Kamille', 'Vanille']]]) {
    await p.evaluate((set) => { const g = window.__game; g.shelf.setSoaps(set.map((n) => window.__S[n])); }, set);
    await p.waitForTimeout(600);
    await p.screenshot({ path: out + `/${tag}.png` });
  }
  // Auftrag annehmen, Seifen holen, aufs Regal, erste Seife schneiden
  const np = await p.evaluate(() => { const v = window.__game.notes.screenPos(0, window.__game.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; });
  await p.mouse.click(np.x, np.y); await p.waitForTimeout(600); await p.click('#note-accept'); await p.waitForTimeout(700);
  await p.evaluate(() => { const g = window.__game; for (const [id, n] of window.__barsNeeded(g.order)) g.take.set(id, n); g.stockShelf(); });
  await p.waitForFunction(() => window.__game.state === 'shelf', null, { timeout: 30000 }); await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/d-regal-auftrag.png' });
  for (const name of (process.env.CUT || 'Erdbeere,Zitrone,Honig,Rose').split(',')) {
    await p.evaluate((n) => { const g = window.__game; g.block.load(window.__S[n]); g.block.mesh.visible = true; }, name);
    await p.waitForTimeout(500);
    await p.screenshot({ path: out + `/e-block-${name}.png` });
  }
  // echtes Schneiden: erste Sorte des Auftrags antippen und mit dem Messer schneiden
  await p.evaluate(() => { const g = window.__game; g.block.mesh.visible = false; g.pickSoap(0); });
  await p.waitForFunction(() => window.__game.state === 'cutting', null, { timeout: 30000 }); await p.waitForTimeout(600);
  await p.evaluate(() => { const g = window.__game; g.block.load(window.__S.Erdbeere, g.supply.get(g.order.soaps[0].id).cur); });
  for (let k = 0; k < 3; k++) {
    await p.mouse.move(VW / 2, VH * 0.25); await p.mouse.down();
    for (let s = 0; s <= 20; s++) { await p.mouse.move(VW / 2, VH * (0.25 + s * 0.025)); await p.waitForTimeout(40); }
    await p.mouse.up(); await p.waitForTimeout(500);
  }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/f-geschnitten.png' });
  console.log('state', await p.evaluate(() => [window.__game.state, window.__game.loose ? 1 : 0]));
  await b.close();
})();
