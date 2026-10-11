const ROOT = (document.currentScript && document.currentScript.src || '').replace(/minimal\.js.*$/, '');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Abrir menu');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.header')) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
// destaque do link da página atual
(() => {
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#navigation a').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });
})();
// animação de entrada ao rolar
(() => {
  const items = document.querySelectorAll('.reveal');
  if (!items.length || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('reveal-ready');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  items.forEach(el => io.observe(el));
})();

// cabeçalho: fundo ao rolar
(() => {
  const head = document.querySelector('.header');
  if (!head) return;
  const on = () => head.classList.toggle('scrolled', scrollY > 40);
  on(); addEventListener('scroll', on, { passive: true });
})();
// popup de alerta do manifesto (uma vez por sessão; fora da página do manifesto)
(() => {
  if (document.body.classList.contains('manifesto-page')) return;
  const KEY = 'manifesto-alert-seen';
  const read = () => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } };
  const mark = () => { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} };
  const box = document.createElement('div');
  box.className = 'alert-overlay';
  box.id = 'manifesto-alert';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'ma-title');
  box.setAttribute('aria-describedby', 'ma-desc');
  box.innerHTML = '<div class="alert-box"><div class="alert-bar"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5 22.5 20.5h-21Z" fill="#fff" stroke="#fff" stroke-linejoin="round" stroke-width="1.5"/><path d="M12 9v5.5" stroke="#b5221f" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.3" fill="#b5221f"/></svg><span>Alerta · Manifesto</span><button type="button" class="alert-x" data-close aria-label="Fechar alerta">×</button></div><div class="alert-body"><p class="alert-kicker">Tecnologia e humanidade</p><h2 id="ma-title">A tecnologia deve servir à humanidade. Nunca o contrário.</h2><p id="ma-desc">Desenvolver o futuro exige mais do que capacidade técnica. Exige consciência sobre o que estamos criando, para quem e a que custo.</p><blockquote>“A maior tecnologia existente continua sendo a humanidade. A natureza, por sua vez, é um patrimônio que nenhuma inovação pode substituir.”</blockquote><div class="alert-actions"><a class="button solid" href="' + ROOT + 'manifesto.html" data-primary>Ler o manifesto <span>↗</span></a><button type="button" class="button" data-close>Continuar no site</button></div></div></div>';
  document.body.appendChild(box);
  let last = null;
  const focusables = () => [...box.querySelectorAll('a[href],button:not([disabled])')];
  function open() {
    last = document.activeElement;
    box.classList.add('show');
    document.documentElement.classList.add('alert-open');
    setTimeout(() => (box.querySelector('[data-primary]') || box).focus(), 60);
  }
  function close() {
    mark();
    box.classList.remove('show');
    document.documentElement.classList.remove('alert-open');
    if (last && last.focus) last.focus();
  }
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
  box.querySelector('[data-primary]').addEventListener('click', mark);
  document.addEventListener('keydown', e => {
    if (!box.classList.contains('show')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const f = focusables(), first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    }
  });
  if (!read()) setTimeout(open, 900);
})();
