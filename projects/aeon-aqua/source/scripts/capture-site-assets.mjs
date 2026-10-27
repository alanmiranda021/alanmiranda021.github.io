import {chromium} from '@playwright/test';
import sharp from 'sharp';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
  await page.goto('http://127.0.0.1:5173');
  await page.waitForSelector('#viewport[data-model-status="ready"][data-ship-status="ready"][data-propeller-status="ready"]');
  const simulation=await page.screenshot();
  await sharp(simulation).resize(1200).webp({quality:85}).toFile('docs/previews/aeon-preview.webp');
  await page.locator('#view-button').click();await page.waitForTimeout(300);
  await page.addStyleTag({content:'.topbar,.bottombar,.panel,.crosshair,.center-note,#rov-camera,#startup-error{display:none!important}'});
  const cargo=await page.screenshot();
  await sharp(cargo).extract({left:160,top:240,width:1120,height:550}).webp({quality:90}).toFile('docs/previews/cargo-ship.webp');
}finally{await browser.close();}
