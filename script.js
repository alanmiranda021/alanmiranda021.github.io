const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);

const dot=$('.cursor-dot'),ring=$('.cursor-ring');
window.addEventListener('pointermove',e=>{dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px';ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px'});
$$('a,button').forEach(el=>{el.addEventListener('mouseenter',()=>{ring.style.width='52px';ring.style.height='52px'});el.addEventListener('mouseleave',()=>{ring.style.width='34px';ring.style.height='34px'})});

window.addEventListener('scroll',()=>{const h=document.documentElement.scrollHeight-innerHeight;$('.progress').style.width=(scrollY/h*100)+'%'});

const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});
$$('.reveal').forEach(e=>observer.observe(e));

const menuBtn=$('#menuBtn'),nav=$('.nav');
menuBtn.addEventListener('click',()=>{nav.classList.toggle('open');menuBtn.textContent=nav.classList.contains('open')?'×':'☰'});
$$('.nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));

const modal=$('#modal');
const data={
 aeon:{type:'AI / COGNITIVE SYSTEMS',title:'AEON',text:'Laboratório pessoal de arquitetura para agentes inteligentes, reunindo memória, knowledge graph, RAG, validação e orquestração. A proposta é investigar como modelos podem deixar de ser apenas uma interface e passar a operar como sistemas.',tags:['AI AGENTS','RAG','LLM','KNOWLEDGE GRAPH']},
 include:{type:'EDTECH / HARDWARE',title:'INCLUDE',text:'Projeto de educação tecnológica em que robótica e automação são usadas para desenvolver raciocínio, criatividade e resolução de problemas. Uma experiência de ensino conectada a prototipagem prática.',tags:['ROBOTICS','AUTOMATION','EDTECH']},
 alpha:{type:'DATA / MACHINE LEARNING',title:'ALPHA APP',text:'Ambiente experimental de previsão e avaliação de modelos, com backtesting, calibração, engines híbridas e experimentação de aprendizado de máquina. O foco é medir, testar e iterar.',tags:['JAVASCRIPT','ML','BACKTEST','CALIBRATION']}
};
$$('.build-card').forEach(card=>card.addEventListener('click',()=>{window.location.href='projects/'+card.dataset.modal+'.html';return;
 const d=data[card.dataset.modal];$('#modalType').textContent=d.type;$('#modalTitle').textContent=d.title;$('#modalText').textContent=d.text;$('#modalTags').innerHTML=d.tags.map(t=>`<span>${t}</span>`).join('');modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}));
$('#closeModal').onclick=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')};
modal.addEventListener('click',e=>{if(e.target===modal)$('#closeModal').click()});

const panel=$('#commandPanel');
function openCommands(){panel.classList.add('open');panel.setAttribute('aria-hidden','false')}
function closeCommands(){panel.classList.remove('open');panel.setAttribute('aria-hidden','true')}
$('#commandBtn').onclick=openCommands;$('#closeCommand').onclick=closeCommands;
$$('.command-box [data-go]').forEach(b=>b.onclick=()=>{closeCommands();document.querySelector(b.dataset.go).scrollIntoView({behavior:'smooth'})});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommands()}if(e.key==='Escape'){closeCommands();modal.classList.remove('open')}});

const sections=[...$$('main section[id]')],links=[...$$('.nav a')];
const active=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)links.forEach(l=>l.classList.toggle('active',l.getAttribute('href')==='#'+e.target.id))}),{rootMargin:'-40% 0px -50% 0px'});
sections.forEach(s=>active.observe(s));

const gameCanvas=$('#cometCanvas');
if(gameCanvas){
 const gameContext=gameCanvas.getContext('2d'),gameStage=gameCanvas.parentElement,gameMessage=$('#gameMessage'),startGame=$('#startGame'),gameStatus=$('#gameStatus'),scoreOutput=$('#gameScore'),waveOutput=$('#gameWave'),bestOutput=$('#gameBest'),lifeOutput=[...document.querySelectorAll('.game-lives span')];
 let gameWidth=0,gameHeight=0,animationFrame=0,lastFrame=0,spawnTimer=0,score=0,wave=1,lives=3,playing=false,playerX=0,stars=[],comets=[],shots=[],sparks=[];
 const savedBest=Number(localStorage.getItem('cometRunBest')||0);bestOutput.textContent=String(savedBest).padStart(6,'0');
 const random=(min,max)=>Math.random()*(max-min)+min;
 function resizeGame(){const ratio=Math.min(window.devicePixelRatio||1,2),bounds=gameStage.getBoundingClientRect();gameWidth=bounds.width;gameHeight=Math.max(390,Math.min(620,gameWidth*.58));gameCanvas.style.height=gameHeight+'px';gameCanvas.width=gameWidth*ratio;gameCanvas.height=gameHeight*ratio;gameContext.setTransform(ratio,0,0,ratio,0,0);playerX=playerX||gameWidth/2;stars=Array.from({length:Math.ceil(gameWidth/11)},()=>({x:random(0,gameWidth),y:random(0,gameHeight),size:random(.4,1.8),speed:random(8,25)}))}
 function updateHud(){scoreOutput.textContent=String(score).padStart(6,'0');waveOutput.textContent=String(wave).padStart(2,'0');lifeOutput.forEach((life,index)=>life.classList.toggle('lost',index>=lives))}
 function resetGame(){score=0;wave=1;lives=3;playerX=gameWidth/2;spawnTimer=0;comets=[];shots=[];sparks=[];updateHud()}
 function setPlayerPosition(event){const bounds=gameCanvas.getBoundingClientRect(),source=event.touches?event.touches[0]:event;playerX=Math.max(26,Math.min(gameWidth-26,(source.clientX-bounds.left)/bounds.width*gameWidth))}
 function fire(){if(!playing)return;shots.push({x:playerX,y:gameHeight-46,speed:620});for(let i=0;i<3;i++)sparks.push({x:playerX+random(-5,5),y:gameHeight-42,vx:random(-25,25),vy:random(15,65),life:.35})}
 function spawnComet(){const radius=random(12,27)+wave*.8;comets.push({x:random(radius,gameWidth-radius),y:-radius,radius,speed:random(65,105)+wave*12,rotation:random(0,7),spin:random(-2,2),hue:Math.random()>.72?'#b79aff':'#25e7ff'})}
 function explode(comet){for(let i=0;i<12;i++)sparks.push({x:comet.x,y:comet.y,vx:random(-100,100),vy:random(-100,100),life:random(.25,.6),color:comet.hue})}
 function endGame(){playing=false;cancelAnimationFrame(animationFrame);const best=Math.max(score,Number(localStorage.getItem('cometRunBest')||0));localStorage.setItem('cometRunBest',best);bestOutput.textContent=String(best).padStart(6,'0');gameStatus.textContent='STATUS: SIGNAL LOST';gameMessage.classList.add('visible');gameMessage.querySelector('h3').textContent='O núcleo perdeu o sinal.';gameMessage.querySelector('p').textContent=`Pontuação final: ${score}. Respire, ajuste a mira e tente novamente.`;startGame.textContent='TENTAR NOVAMENTE ↗'}
 function drawShip(){gameContext.save();gameContext.translate(playerX,gameHeight-30);gameContext.shadowBlur=18;gameContext.shadowColor='#25e7ff';gameContext.fillStyle='#dffcff';gameContext.beginPath();gameContext.moveTo(0,-19);gameContext.lineTo(15,14);gameContext.lineTo(0,9);gameContext.lineTo(-15,14);gameContext.closePath();gameContext.fill();gameContext.fillStyle='#25e7ff';gameContext.beginPath();gameContext.arc(0,-5,4,0,Math.PI*2);gameContext.fill();gameContext.restore()}
 function draw(){gameContext.clearRect(0,0,gameWidth,gameHeight);gameContext.fillStyle='#030c17';gameContext.fillRect(0,0,gameWidth,gameHeight);stars.forEach(star=>{gameContext.fillStyle=`rgba(125,245,255,${.25+star.size/3})`;gameContext.fillRect(star.x,star.y,star.size,star.size)});gameContext.strokeStyle='rgba(37,231,255,.08)';gameContext.beginPath();gameContext.moveTo(0,gameHeight-72);gameContext.lineTo(gameWidth,gameHeight-72);gameContext.stroke();shots.forEach(shot=>{gameContext.strokeStyle='#dffcff';gameContext.shadowBlur=12;gameContext.shadowColor='#25e7ff';gameContext.lineWidth=2;gameContext.beginPath();gameContext.moveTo(shot.x,shot.y);gameContext.lineTo(shot.x,shot.y+15);gameContext.stroke();gameContext.shadowBlur=0});comets.forEach(comet=>{gameContext.save();gameContext.translate(comet.x,comet.y);gameContext.rotate(comet.rotation);gameContext.shadowBlur=18;gameContext.shadowColor=comet.hue;gameContext.fillStyle='#182d43';gameContext.strokeStyle=comet.hue;gameContext.lineWidth=2;gameContext.beginPath();gameContext.moveTo(0,-comet.radius);for(let i=1;i<8;i++){const angle=i*Math.PI/4;const size=comet.radius*random(.75,1.1);gameContext.lineTo(Math.cos(angle)*size,Math.sin(angle)*size)}gameContext.closePath();gameContext.fill();gameContext.stroke();gameContext.restore()});sparks.forEach(spark=>{gameContext.fillStyle=spark.color||'#25e7ff';gameContext.globalAlpha=Math.max(0,spark.life*2);gameContext.fillRect(spark.x,spark.y,2,2);gameContext.globalAlpha=1});drawShip()}
 function frame(time){if(!playing)return;const delta=Math.min((time-lastFrame)/1000,.035);lastFrame=time;spawnTimer+=delta;const spawnRate=Math.max(.22,.88-wave*.045);if(spawnTimer>spawnRate){spawnTimer=0;spawnComet();if(Math.random()<Math.min(.35,wave*.02))spawnComet()}stars.forEach(star=>{star.y+=star.speed*delta;if(star.y>gameHeight)star.y=0});shots.forEach(shot=>shot.y-=shot.speed*delta);comets.forEach(comet=>{comet.y+=comet.speed*delta;comet.rotation+=comet.spin*delta});sparks.forEach(spark=>{spark.x+=spark.vx*delta;spark.y+=spark.vy*delta;spark.life-=delta});comets=comets.filter(comet=>{if(comet.y-comet.radius>gameHeight){lives--;updateHud();if(lives<=0)endGame();return false}return true});shots=shots.filter(shot=>shot.y>-20);sparks=sparks.filter(spark=>spark.life>0);for(let shotIndex=shots.length-1;shotIndex>=0;shotIndex--){for(let cometIndex=comets.length-1;cometIndex>=0;cometIndex--){const shot=shots[shotIndex],comet=comets[cometIndex];if(Math.hypot(shot.x-comet.x,shot.y-comet.y)<comet.radius+7){explode(comet);comets.splice(cometIndex,1);shots.splice(shotIndex,1);score+=10+wave*2;wave=1+Math.floor(score/160);updateHud();break}}}draw();animationFrame=requestAnimationFrame(frame)}
 function start(){resizeGame();resetGame();playing=true;gameMessage.classList.remove('visible');gameStatus.textContent='STATUS: ACTIVE';lastFrame=performance.now();animationFrame=requestAnimationFrame(frame)}
 startGame.addEventListener('click',start);gameCanvas.addEventListener('pointermove',setPlayerPosition);gameCanvas.addEventListener('pointerdown',event=>{setPlayerPosition(event);fire()});window.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();fire()}if(event.key.toLowerCase()==='a'||event.key==='ArrowLeft')playerX=Math.max(26,playerX-28);if(event.key.toLowerCase()==='d'||event.key==='ArrowRight')playerX=Math.min(gameWidth-26,playerX+28)});window.addEventListener('resize',resizeGame);resizeGame();draw();
}
