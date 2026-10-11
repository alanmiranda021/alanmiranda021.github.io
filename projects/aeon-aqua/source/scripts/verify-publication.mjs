import {chromium} from '@playwright/test';
const base=process.argv[2]||'http://127.0.0.1:8088';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base+'/');
  if(await page.locator('#manifesto-alert').isVisible())await page.locator('#manifesto-alert .alert-x').click();
  await page.locator('main > section:first-child#manifesto .copy').waitFor();
  if((await page.locator('main').innerText()).includes('AEON AQUA'))throw new Error('AEON AQUA deve ficar apenas em projetos navais');
  await page.waitForTimeout(1200);
  if(await page.locator('#manifesto-alert').isVisible()){
    await page.locator('#manifesto-alert .alert-x').click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({path:'docs/previews/site-home.png'});
  await page.goto(base+'/projetos-navais.html');
  await page.locator('.ship-map img[src="assets/aeon-cargo.webp"]').waitFor();
  for(const [selector,href,x,y] of [['.point-rov','projects/aeon-aqua/',.219,.609],['.point-propulsion','naval.html',.255,.565],['.point-ml','projects/ml-learner.html',.337,.34]]){
    const pin=page.locator('.aeon-ship-map '+selector);
    if(await pin.getAttribute('href')!==href)throw new Error('Destino incorreto: '+selector);
    const position=await pin.boundingBox(),map=await page.locator('.aeon-ship-map').boundingBox();
    if(Math.abs((position.x+position.width/2-map.x)/map.width-x)>.01 || Math.abs((position.y+position.height/2-map.y)/map.height-y)>.01)throw new Error('Posição incorreta: '+selector);
  }
  if(!await page.locator('.ship-map img').evaluate(img=>img.complete && img.naturalWidth>0))throw new Error('Imagem do cargueiro não carregou');
  await page.screenshot({path:'docs/previews/site-naval.png'});
  await page.locator('.aeon-ship-map').screenshot({path:'docs/previews/site-navio-links.png'});
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  if(overflow)throw new Error('Home ultrapassa largura no celular');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/projects/aeon-aqua/');
  await page.waitForSelector('#viewport[data-ship-status="ready"][data-propeller-status="ready"][data-model-status="ready"]',{timeout:60000});
  if(await page.locator('#startup-error').isVisible())throw new Error('Simulador não iniciou');
  await page.keyboard.down('Space');await page.waitForTimeout(100);
  if(!(await page.locator('#target-distance').innerText()).includes('CORTADOR ATIVO'))throw new Error('Cortador não respondeu');
  await page.keyboard.up('Space');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('PUBLICAÇÃO OK: home, projetos navais, imagens, layout móvel e simulador 3D com controles — '+base);
}finally{await browser.close();}
