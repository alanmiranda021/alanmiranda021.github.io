
(() => {
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
  const grid=$('#newsGrid');
  if(!grid) return;
  const FEEDS={
    technology:'https://news.google.com/rss/search?q=technology+innovation+AI+robotics&hl=en-US&gl=US&ceid=US:en',
    engineering:'https://news.google.com/rss/search?q=engineering+automation+industrial+technology&hl=en-US&gl=US&ceid=US:en',
    rov:'https://news.google.com/rss/search?q=ROV+subsea+robotics+offshore&hl=en-US&gl=US&ceid=US:en'
  };
  const fallback=[
    {category:'ROV / SUBSEA',source:'Offshore Energy',title:'DeepOcean performs first subsea intervention managed from shore',url:'https://www.offshore-energy.biz/deepocean-performs-first-subsea-intervention-managed-from-shore/',date:'2026-05-06'},
    {category:'ROV / SUBSEA',source:'Offshore Energy',title:'Oceaneering and Petrobras extend collaboration through four-year ROV agreement',url:'https://www.offshore-energy.biz/oceaneering-and-petrobras-extend-collaboration-through-four-year-rov-agreement/',date:'2026-07-08'},
    {category:'ROV / SUBSEA',source:'Offshore Energy',title:'UK testbed showcases multi-robot subsea demonstration',url:'https://www.offshore-energy.biz/uks-testbed-on-the-lookout-for-partners-after-spotlighting-subsea-range-with-multi-robot-demo/',date:'2026-06-19'},
    {category:'TECHNOLOGY',source:'Reuters',title:'AI and technology developments',url:'https://www.reuters.com/technology/artificial-intelligence/',date:''}
  ];
  let all=[]; let active='all';
  function esc(v){const d=document.createElement('div');d.textContent=v||'';return d.innerHTML}
  function cleanTitle(t){return (t||'').replace(/\s+-\s+[^-]+$/,'').trim()}
  function render(){
    const list=active==='all'?all:all.filter(x=>x.kind===active);
    grid.innerHTML=list.slice(0,9).map((x,i)=>`<article class="news-card"><span class="news-category">${esc(x.category)}</span><h3>${esc(cleanTitle(x.title))}</h3><p>${esc(x.description||'Atualização selecionada do ecossistema de tecnologia, engenharia e sistemas remotos.')}</p><div class="news-meta"><span class="news-source">${esc(x.source||'LIVE FEED')}</span><span class="news-time">${esc(x.dateLabel||'RECENT')}</span><a href="${x.url}" target="_blank" rel="noopener noreferrer">LER ↗</a></div></article>`).join('') || '<div class="news-card"><h3>Sem itens nesta categoria.</h3><p>Tente outra categoria ou atualize o feed.</p></div>';
  }
  function skeleton(){grid.innerHTML='<div class="news-skeleton"></div><div class="news-skeleton"></div><div class="news-skeleton"></div>'}
  function parseDate(d){if(!d)return 'RECENT';const dt=new Date(d);return isNaN(dt)?'RECENT':dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}
  async function load(){
    skeleton(); $('#newsStatus').textContent='SINCRONIZANDO...';
    const merged=[];
    for(const [kind,feed] of Object.entries(FEEDS)){
      try{
        const u='https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(feed);
        const r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error('feed');
        const j=await r.json();
        (j.items||[]).slice(0,5).forEach(it=>merged.push({kind,category:kind==='rov'?'ROV / SUBSEA':kind==='engineering'?'ENGENHARIA':'TECNOLOGIA',source:j.feed?.title||'LIVE RSS',title:it.title,url:it.link,description:(it.description||'').replace(/<[^>]*>/g,'').slice(0,150),dateLabel:parseDate(it.pubDate)}));
      }catch(e){}
    }
    if(!merged.length){
      all=fallback.map(x=>({kind:x.category.startsWith('ROV')?'rov':x.category==='TECNOLOGIA'?'technology':'engineering',...x,dateLabel:x.date?parseDate(x.date):'RECENT'}));
      $('#newsStatus').textContent='FALLBACK / ONLINE';
    }else{
      all=merged.sort((a,b)=>new Date(b.dateLabel)-new Date(a.dateLabel));
      $('#newsStatus').textContent='LIVE / ATUALIZADO';
    }
    render();
  }
  $$('.news-tabs button').forEach(b=>b.addEventListener('click',()=>{$$('.news-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');active=b.dataset.newsTab;render()}));
  $('#refreshNews')?.addEventListener('click',load);
  const orb=$('#liveNewsOrb');
  if(orb){
    const drawer=document.createElement('aside');drawer.className='news-drawer';drawer.setAttribute('aria-hidden','true');drawer.innerHTML='<div class="news-drawer-head"><b>LIVE INTELLIGENCE</b><button aria-label="Fechar notícias">×</button></div><div id="newsDrawerItems"></div>';document.body.appendChild(drawer);
    const toggle=()=>{drawer.classList.toggle('open');drawer.setAttribute('aria-hidden',String(!drawer.classList.contains('open')));const box=$('#newsDrawerItems',drawer);box.innerHTML=all.slice(0,5).map(x=>`<div class="drawer-item"><small>${esc(x.category)} · ${esc(x.source)}</small><h4>${esc(cleanTitle(x.title))}</h4><a href="${x.url}" target="_blank" rel="noopener noreferrer">ABRIR NOTÍCIA ↗</a></div>`).join('')};
    orb.addEventListener('click',toggle);$('.news-drawer-head button',drawer).addEventListener('click',toggle);
  }
  const audioInput=$('#localAudio'),audioList=$('#audioLocalList');
  audioInput?.addEventListener('change',()=>{audioList.innerHTML='';[...audioInput.files].forEach(file=>{const url=URL.createObjectURL(file);const item=document.createElement('div');item.className='local-audio-item';item.innerHTML=`<b>${esc(file.name)}</b><audio controls src="${url}"></audio>`;audioList.appendChild(item)})});
  load(); setInterval(load,10*60*1000);
  if(orb && !sessionStorage.getItem('alanNewsSeen')){ setTimeout(()=>{ orb.click(); sessionStorage.setItem('alanNewsSeen','1'); }, 3600); }
})();
