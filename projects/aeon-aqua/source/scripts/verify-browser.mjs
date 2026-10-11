import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  for(const url of ['http://127.0.0.1:5173',pathToFileURL(resolve('dist/index.html')).href]) {
    await page.goto(url);
    await page.waitForSelector('#viewport[data-model-status="ready"][data-propeller-status="ready"][data-ship-status="ready"][data-rocks-status="ready"]',{timeout:30000});
    if(await page.locator('#startup-error').isVisible()) throw new Error('Erro de inicialização exibido');
    const depthBefore=await page.locator('#depth').innerText();
    await page.keyboard.down('KeyF');await page.waitForTimeout(700);await page.keyboard.up('KeyF');
    const depthAfter=await page.locator('#depth').innerText();
    if(depthBefore===depthAfter) throw new Error('Teclado não alterou a profundidade');
    await page.keyboard.down('Space');await page.waitForTimeout(100);
    if(!(await page.locator('#target-distance').innerText()).includes('CORTADOR ATIVO')) throw new Error('Cortador não respondeu');
    await page.keyboard.up('Space');
    await page.locator('#reset-button').click();await page.waitForTimeout(100);
    if(await page.locator('#viewport').getAttribute('data-mission-stage')!=='0') throw new Error('Reset não reiniciou a missão');
    await mkdir('docs/previews',{recursive:true});
    await page.screenshot({path:`docs/previews/${url.startsWith('http')?'servidor':'html'}.png`});
    await page.locator('#view-button').click();await page.waitForTimeout(300);
    await page.screenshot({path:`docs/previews/cargueiro-${url.startsWith('http')?'servidor':'html'}.png`});
    await page.locator('#view-button').click();
    console.log(`OK: ${url} — modelos, teclado, cortador, reset e interface`);
  }
  if(errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
