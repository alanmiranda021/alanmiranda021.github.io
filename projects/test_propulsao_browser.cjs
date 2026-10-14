/* node projects/test_propulsao_browser.cjs <playwright-core-path> [base-url] */
const assert=require('node:assert/strict');
async function main(){
  const {chromium}=require(process.argv[2]||'playwright-core');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.addInitScript(()=>sessionStorage.setItem('manifesto-alert-seen','1'));
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto((process.argv[3]||'http://127.0.0.1:8080')+'/naval.html');
    await page.evaluate(()=>document.addEventListener('naval:load-backtest',event=>{window.lastImportedBacktest=event.detail;}));
    await page.locator('#backtestLoad').click();
    try {
      await page.waitForFunction(()=>!document.getElementById('backtestStart').disabled,{},{timeout:120000});
    } catch(error) {
      throw new Error(`Initialization failed: ${await page.locator('#backtestStatus').textContent()}. ${error.message}`);
    }
    await page.evaluate(()=>{
      const el=document.getElementById('backtestConfig'),cfg=JSON.parse(el.value);
      cfg.helice.z=[4];cfg.helice.diametro={min:8,max:8,passo:.1};
      cfg.navio.nome='Navio de teste';
      cfg.helice.ae_ao={min:.7,max:.7,passo:.05};cfg.helice.p_d={min:.85,max:.85,passo:.05};
      el.value=JSON.stringify(cfg);
    });
    await page.selectOption('#searchBlades','config');
    for(const profile of ['rapido','completo','detalhado']){
      await page.selectOption('#backtestProfile',profile);
      await page.locator('#backtestStart').click();
      await page.waitForFunction(()=>!document.getElementById('backtestResults').hidden,{},{timeout:120000});
      assert.equal(await page.locator('#backtestApply').isEnabled(),true);
    }
    await page.locator('#backtestApply').click();
    assert.equal(await page.locator('#simulationBacktest').isVisible(),true);
    assert.equal(await page.locator('input[name=diameter]').inputValue(),'8');
    assert.equal(await page.locator('#missionModel').textContent(),'Holtrop · interpolada');
    assert.equal(await page.locator('#balanceState').textContent(),'EM EQUILÍBRIO');
    assert.match(await page.locator('#inspectionEtaD').textContent(),/75/);
    assert.match(await page.locator('#inspectionMotor').textContent(),/Sem motor/);
    const eta=await page.locator('#metricEta').textContent();
    await page.locator('input[name=rpm]').fill('130');
    await page.waitForTimeout(200);
    assert.notEqual(await page.locator('#metricEta').textContent(),eta);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('[data-backtest-download=html]').click();
    assert.equal((await downloadPromise).suggestedFilename(),'relatorio.html');
    assert.match(await page.locator('#backtestSummary').textContent(),/Motor mais próximo/);
    assert.match(await page.locator('#backtestMargins').textContent(),/1,?\.?464395625/);
    for(const [key,name] of [['diagnosticCsv','diagnostico_motor.csv'],['configJson','config_execucao.json']]){
      const pending=page.waitForEvent('download');
      await page.locator(`[data-backtest-download=${key}]`).click();
      assert.equal((await pending).suggestedFilename(),name);
    }
    await page.locator('#resetButton').click();
    assert.equal(await page.locator('#simulationBacktest').isVisible(),false);
    assert.equal(await page.locator('#missionModel').textContent(),'R ∝ V²');
    await page.locator('#backtestStart').click();
    await page.locator('#backtestCancel').click();
    assert.equal(await page.locator('#backtestStatus').textContent(),'Cálculo cancelado.');
    assert.equal(await page.locator('#backtestStart').isEnabled(),true);
    await page.selectOption('#backtestMode','calibrate');
    assert.equal(await page.locator('#backtestProfileField').isVisible(),false);
    await page.selectOption('#calibrationMotor','8G90ME-C10.5');
    await page.selectOption('#calibrationLevel','completo');
    await page.locator('#backtestStart').click();
    await page.waitForFunction(()=>!document.getElementById('backtestStart').disabled,{},{timeout:120000});
    assert.match(await page.locator('#backtestSummary').textContent(),/rodada 4/);
    assert.match(await page.locator('#backtestSummary').textContent(),/8G90ME-C10.5/);
    assert.equal(await page.locator('#simulationBacktest').isVisible(),true);
    assert.match(await page.locator('#backtestStatus').textContent(),/automaticamente/);
    assert.equal(await page.locator('#shipTitle').textContent(),'Navio de teste');
    const targetTransfer=await page.evaluate(()=>({row:window.lastImportedBacktest.ranking[0],rpm:Number(document.querySelector('input[name=rpm]').value),wake:Number(document.querySelector('input[name=wake]').value),diameter:Number(document.querySelector('input[name=diameter]').value)}));
    assert.equal(targetTransfer.rpm,targetTransfer.row.rpm);
    assert.equal(targetTransfer.wake,targetTransfer.row.w);
    assert.equal(targetTransfer.diameter,targetTransfer.row.D);
    await page.selectOption('#calibrationLevel','infinita');
    await page.locator('#backtestStart').click();
    await page.waitForFunction(()=>document.getElementById('backtestSummary').textContent.includes('rodada 2'),{},{timeout:120000});
    await page.locator('#backtestCancel').click();
    assert.match(await page.locator('#backtestStatus').textContent(),/Melhor resultado encontrado preservado/);
    assert.equal(await page.locator('#backtestApply').isEnabled(),true);
    assert.equal(await page.locator('#backtestResults').isVisible(),true);
    await page.selectOption('#backtestMode','backtest');
    await page.selectOption('#searchBlades','all');
    await page.selectOption('#backtestProfile','infinita');
    await page.locator('#backtestStart').click();
    await page.waitForFunction(()=>document.getElementById('backtestSummary').textContent.includes('rodada 2'),{},{timeout:120000});
    assert.match(await page.locator('#backtestSummary').textContent(),/Todo o catálogo/);
    assert.match(await page.locator('#backtestSummary').textContent(),/pás avaliadas: 3, 4, 5, 6, 7/);
    await page.locator('#backtestCancel').click();
    assert.match(await page.locator('#backtestStatus').textContent(),/automaticamente acima/);
    assert.equal(await page.locator('#simulationBacktest').isVisible(),true);
    const generalTransfer=await page.evaluate(()=>({motor:window.lastImportedBacktest.config.calibracao.motor,row:window.lastImportedBacktest.ranking[0],blades:Number(document.querySelector('select[name=blades]').value),rpm:Number(document.querySelector('input[name=rpm]').value)}));
    assert.equal(generalTransfer.motor,null);
    assert.equal(generalTransfer.blades,generalTransfer.row.Z);
    assert.equal(generalTransfer.rpm,generalTransfer.row.rpm);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: backtest, targeted complete calibration, infinite stop preserves best, simulation, exports and mobile width.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
