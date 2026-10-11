(() => {
  'use strict';
  const base=new URL('.',document.currentScript.src);
  const normalize=text=>text.replace(/\s+/g,' ').trim();
  const originals=new WeakMap(),attributes=new WeakMap();
  const watched=['alt','aria-label','placeholder','title','content'];
  let language='pt',dictionary={},folded=new Map(),loading,selection=0;
  try{language=localStorage.getItem('site-language')==='en'?'en':'pt';}catch{}

  const selector=document.createElement('div');
  selector.className='language-switch';selector.dataset.languageSwitch='';selector.setAttribute('role','group');
  const brazil='<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" rx="2" fill="#009739"/><path d="M15 2 28 10 15 18 2 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="5" fill="#002776"/><path d="M10.2 8.6Q15 7.8 19.5 11" fill="none" stroke="white" stroke-width="1"/></svg>';
  const usa='<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" rx="2" fill="#fff"/><path d="M0 1H30M0 4H30M0 7H30M0 10H30M0 13H30M0 16H30M0 19H30" stroke="#b31942" stroke-width="1.5"/><path d="M0 0H13V11H0Z" fill="#0a3161"/><g fill="white"><circle cx="2" cy="2" r=".5"/><circle cx="5" cy="2" r=".5"/><circle cx="8" cy="2" r=".5"/><circle cx="11" cy="2" r=".5"/><circle cx="3.5" cy="4.5" r=".5"/><circle cx="6.5" cy="4.5" r=".5"/><circle cx="9.5" cy="4.5" r=".5"/><circle cx="2" cy="7" r=".5"/><circle cx="5" cy="7" r=".5"/><circle cx="8" cy="7" r=".5"/><circle cx="11" cy="7" r=".5"/><circle cx="3.5" cy="9.5" r=".5"/><circle cx="6.5" cy="9.5" r=".5"/><circle cx="9.5" cy="9.5" r=".5"/></g></svg>';
  for(const [code,name,flag] of [['pt','Português',brazil],['en','English',usa]]){
    const button=document.createElement('button');button.type='button';button.dataset.language=code;
    button.setAttribute('aria-label',name);button.title=name;button.innerHTML=flag+'<span>'+code.toUpperCase()+'</span>';
    button.addEventListener('click',()=>selectLanguage(code));selector.append(button);
  }
  const header=document.querySelector('.header,.topbar');
  if(header)header.append(selector);else{selector.classList.add('language-switch-floating');document.body.prepend(selector);}

  function updateSelection(){
    document.documentElement.lang=language==='en'?'en':'pt-BR';
    selector.setAttribute('aria-label',language==='en'?'Website language':'Idioma do site');
    selector.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language)));
  }
  function dynamic(text){
    return text.replace(/Baixando (\d+) concursos para a janela M99\.\.\./,'Downloading $1 draws for the M99 window...')
      .replace(/Janela carregada: (\d+) concursos, do (\d+) ao (\d+)\./,'Window loaded: $1 draws, from $2 to $3.')
      .replace(/M99 gerado com (\d+) concursos · soma (\d+) · pares (\d+) · ímpares (\d+)\./,'M99 generated from $1 draws · sum $2 · even $3 · odd $4.')
      .replace(/\bALVO\b/g,'TARGET').replace(/CORTADOR ATIVO/g,'CUTTER ACTIVE').replace(/CONCLUÍDA/g,'COMPLETED')
      .replace(/\bpontos\b/g,'points').replace(/\bimpactos\b/g,'impacts').replace(/\bnós\b/g,'kn')
      .replace(/faixa para Z/g,'range for Z').replace(/Série B/g,'B-series').replace(/aviso\(s\)/g,'warning(s)')
      .replace(/Modelo ([ABC])/g,'Model $1');
  }
  function translated(text){
    const key=normalize(text);
    let result=dictionary[key];
    if(result===undefined && key.startsWith('⚠ ')){
      const message=translated(key.slice(2));
      if(message!==null)return '⚠ '+message;
    }
    if(result===undefined){
      result=folded.get(key.toLocaleLowerCase('pt-BR'));
      if(result!==undefined && key===key.toUpperCase())result=result.toUpperCase();
    }
    if(result===undefined){const changed=dynamic(text);return changed!==text?changed:null;}
    return text.match(/^\s*/)[0]+result+text.match(/\s*$/)[0];
  }
  function textNode(node){
    if(!node.parentElement || node.parentElement.closest('script,style,svg,code,pre,[data-language-switch]'))return;
    const record=originals.get(node);
    if(language==='pt'){
      if(record && node.data===record.en)node.data=record.pt;
      originals.delete(node);return;
    }
    if(record && node.data===record.en)return;
    const english=translated(node.data);
    if(english===null || english===node.data){originals.delete(node);return;}
    originals.set(node,{pt:node.data,en:english});node.data=english;
  }
  function elementAttributes(element){
    if(element.closest('[data-language-switch]'))return;
    let record=attributes.get(element)||{};
    for(const name of watched){
      if(!element.hasAttribute(name))continue;
      if(name==='content' && !element.matches('meta[name="description"],meta[property="og:title"],meta[property="og:description"]'))continue;
      const current=element.getAttribute(name);
      if(language==='pt'){
        if(record[name] && current===record[name].en)element.setAttribute(name,record[name].pt);
        delete record[name];continue;
      }
      if(record[name] && current===record[name].en)continue;
      const english=translated(current);
      if(english!==null && english!==current){record[name]={pt:current,en:english};element.setAttribute(name,english);}
      else delete record[name];
    }
    attributes.set(element,record);
  }
  function apply(root){
    if(root.nodeType===Node.TEXT_NODE){textNode(root);return;}
    if(root.nodeType!==Node.ELEMENT_NODE)return;
    if(root.matches('script,style,svg,code,pre,[data-language-switch]'))return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode()))textNode(node);
    elementAttributes(root);root.querySelectorAll('[alt],[aria-label],[placeholder],[title],meta[content]').forEach(elementAttributes);
  }
  async function loadDictionary(){
    if(!loading)loading=fetch(new URL('i18n-en.json',base)).then(response=>{
      if(!response.ok)throw new Error('Language dictionary unavailable');return response.json();
    }).then(data=>{dictionary=data;folded=new Map(Object.entries(data).map(([pt,en])=>[pt.toLocaleLowerCase('pt-BR'),en]));});
    return loading;
  }
  async function selectLanguage(code){
    const request=++selection;
    selector.setAttribute('aria-busy','true');
    try{
      if(code==='en')await loadDictionary();
      if(request!==selection)return;
      language=code;updateSelection();apply(document.documentElement);
      try{localStorage.setItem('site-language',code);}catch{}
      window.dispatchEvent(new CustomEvent('site-language-change',{detail:{language:code}}));
    }catch(error){console.error(error);language='pt';updateSelection();}
    finally{selector.removeAttribute('aria-busy');}
  }
  new MutationObserver(records=>{
    if(language!=='en')return;
    for(const record of records){
      if(record.type==='characterData')textNode(record.target);
      else if(record.type==='attributes')elementAttributes(record.target);
      else record.addedNodes.forEach(apply);
    }
  }).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:watched});
  updateSelection();selectLanguage(language);
})();
