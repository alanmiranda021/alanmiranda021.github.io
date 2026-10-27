import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const url='http://127.0.0.1:5173';
let server;
const available=async()=>{
  try {const response=await fetch(url,{signal:AbortSignal.timeout(1000)});return response.ok && (await response.text()).includes('AEON AQUA');}
  catch{return false;}
};
if(!await available()) {
  server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'inherit',windowsHide:true});
  server.on('error',error=>{console.error(error);process.exitCode=1;});
  for(let i=0;i<40 && !await available();i++) await new Promise(resolve=>setTimeout(resolve,250));
  if(!await available()){server.kill();throw new Error('Servidor indisponível na porta 5173. Confira se outro programa está usando esta porta.');}
}

// Isolated browser window: no access to the user's existing profile or tabs.
let browser;
try {browser=await chromium.launch({channel:'msedge',headless:false});}
catch(error){server?.kill();throw error;}
const page=await browser.newPage({viewport:null});
await page.goto(url);
await page.waitForSelector('#viewport[data-model-status="ready"]');
console.log('Simulador aberto em uma janela isolada do Edge. Feche a janela para encerrar esta sessão.');
await new Promise(resolve=>browser.on('disconnected',resolve));
server?.kill();
