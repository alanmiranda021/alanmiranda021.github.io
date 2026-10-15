/* node tests/naval_browser.cjs <playwright-core path> [base URL] */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.argv[2] || 'playwright-core');
(async () => {
  const browser = await chromium.launchPersistentContext(path.join(os.tmpdir(),'ml-learner-v3-browser-cache'), { channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('Browser:', e.message));
    await page.goto((process.argv[3] || 'http://127.0.0.1:8080') + '/github-pages/');
    await page.locator('[data-testid="stFileUploader"]').waitFor({ timeout: 240000 });
    const header = 'ship_type,route_id,distance,fuel_type,weather_conditions,engine_efficiency,fuel_consumption,CO2_emissions';
    let seed = 17;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return (seed+.5)/4294967296; };
    const rows = Array.from({length: 98}, (_, i) => {
      const distance = 10+90*random();
      const fuel = 10*distance+20*Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
      return `Type${i<42?0:1},Route${i%2},${distance},${i%2?'Diesel':'HFO'},${['sun','rain','wind'][i%3]},${70+25*random()},${fuel},${fuel*2.7}`;
    });
    const matArgument = process.argv.find(arg=>arg.startsWith('--mat='));
    if (matArgument) {
      await page.locator('input[type=file]').setInputFiles(matArgument.slice('--mat='.length));
    } else {
      await page.locator('input[type=file]').setInputFiles({name: 'naval_artificial.csv', mimeType: 'text/csv', buffer: Buffer.from([header, ...rows].join('\n'))});
    }
    try {
      await Promise.race([
        page.getByRole('tab', {name: 'Laboratório — Artigo 3 (naval)'}).waitFor({timeout:120000}),
        page.locator('[data-testid="stAlert"]').filter({hasText:/\.(mat|csv):/}).first().waitFor({timeout:120000}).then(async()=>{
          throw new Error('Leitura do upload: '+(await page.locator('[data-testid="stAlert"]').allTextContents()).join('\n'));
        }),
      ]);
      await page.getByRole('tab', {name: 'Laboratório — Artigo 3 (naval)'}).click({timeout: 120000});
    } catch(error) {
      console.error('Alertas de upload:', await page.locator('[data-testid="stAlert"]').allTextContents());
      throw error;
    }
    await page.getByText('Protocolo do Artigo 3 adaptado', {exact: false}).waitFor();
    const run = page.getByRole('button', {name: 'Executar protocolo naval e gerar PDF'});
    await run.waitFor();
    assert(await run.isEnabled());
    assert.equal(await page.locator('[data-testid="stException"]').count(), 0);
    console.log(`Stlite: upload ${matArgument?'MAT fornecido':'artificial'}, aba naval e controles disponíveis; nenhuma execução disparada ainda.`);
    if (process.argv.includes('--run')) {
      async function removeLast(label, count) {
        const widget = page.locator('[data-testid="stMultiSelect"]').filter({has: page.getByText(label, {exact: true})});
        await widget.waitFor();
        const input = widget.locator('input');
        for (let i = 0; i < count; i++) {
          await input.focus();
          await input.press('Backspace');
          await page.waitForTimeout(500);
        }
        await input.press('Escape');
      }
      await removeLast('Modelos navais', 1);
      const started = Date.now();
      await run.click();
      const download = page.getByRole('button', {name: 'Baixar relatório científico completo (PDF)'});
      await download.waitFor({timeout: 360000});
      assert.equal(await page.locator('[data-testid="stException"]').count(), 0);
      const transfer = page.waitForEvent('download', {timeout: 30000});
      await download.click();
      const artifact = await transfer;
      assert.equal(await artifact.failure(), null);
      const stream = await artifact.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const pdf = Buffer.concat(chunks);
      assert(pdf.subarray(0, 4).equals(Buffer.from('%PDF')));
      fs.writeFileSync(path.join(os.tmpdir(),'ml-learner-v3-stlite-download.pdf'), pdf);
      const partial = await page.getByText('Ocorreram falhas parciais.', {exact:false}).count();
      console.log(`Stlite N-FAST ${matArgument?'MAT fornecido':'artificial'} SVR + DIST: ${((Date.now()-started)/1000).toFixed(1)} s; PDF recebido (${pdf.length} bytes); falhas parciais=${partial}.`);
    }
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exit(1);});
