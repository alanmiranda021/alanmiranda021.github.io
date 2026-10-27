import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForSelector('#viewport[data-model-status="ready"][data-propeller-status="ready"]');
  const stage=async()=>Number(await page.locator('#viewport').getAttribute('data-mission-stage'));
  const distance=async()=>Number((await page.locator('#target-distance').innerText()).match(/ALVO ([\d.]+)/)[1]);
  const pulse=async(ms)=>{await page.keyboard.down('KeyW');await page.waitForTimeout(ms);await page.keyboard.up('KeyW');await page.waitForTimeout(1800);};
  for(let i=0;i<10 && await distance()>3.8;i++) await pulse(500);
  await page.waitForTimeout(4500);
  if(await stage()!==2) throw new Error(`Inspeção não concluiu: estágio ${await stage()}, distância ${await distance()}`);
  for(let i=0;i<8 && await distance()>3.05;i++) await pulse(200);
  await page.keyboard.down('Space');await page.waitForTimeout(5000);await page.keyboard.up('Space');
  if(await stage()!==3) throw new Error(`Corte não concluiu: estágio ${await stage()}, distância ${await distance()}`);
  for(let i=0;i<10 && await distance()<3.4;i++) {
    await page.keyboard.down('KeyS');await page.waitForTimeout(60);await page.keyboard.up('KeyS');await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(3500);
  if(await stage()!==4) throw new Error(`Verificação não concluiu: estágio ${await stage()}, distância ${await distance()}`);
  console.log('Missão completa via teclado real: aproximação, inspeção, corte e verificação.');
  await page.screenshot({path:'docs/previews/missao-concluida.png'});
} finally {await browser.close();}
