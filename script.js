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
$$('.build-card').forEach(card=>card.addEventListener('click',()=>{
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
