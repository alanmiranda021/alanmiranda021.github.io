const list = document.querySelector('#news-list');
const status = document.querySelector('#news-status');
const refresh = document.querySelector('#refresh-news');
let articles = [];
let category = 'all';
const feeds = {
  rov: 'https://news.google.com/rss/search?q=ROV+subsea+robotics+offshore&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  naval: 'https://news.google.com/rss/search?q=engenharia+naval+propulsao+navios&hl=pt-BR&gl=BR&ceid=BR:pt-419'
};
function safeUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
}
function render() {
  list.replaceChildren();
  const selected = articles.filter(item => category === 'all' || item.category === category);
  if (!selected.length) {
    const box = document.createElement('div');
    box.className = 'news-empty';
    const message = document.createElement('p');
    message.textContent = 'Nenhuma notícia disponível agora. Consulte as fontes abaixo ou tente atualizar.';
    box.append(message);
    Object.entries(feeds).filter(([key]) => category === 'all' || key === category).forEach(([key, feed]) => {
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = feed.replace('/rss/search', '/search');
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = key === 'rov' ? 'Notícias de ROV ↗' : 'Notícias de engenharia naval ↗';
      box.append(link);
    });
    list.append(box); return;
  }
  selected.slice(0, 12).forEach(item => {
    const card = document.createElement('article'); card.className = 'news-item';
    const label = document.createElement('small'); label.textContent = item.category === 'rov' ? 'ROV / SUBSEA' : 'ENGENHARIA NAVAL';
    const title = document.createElement('h3');
    const link = document.createElement('a'); link.href = item.url; link.textContent = item.title; link.target = '_blank'; link.rel = 'noopener noreferrer';
    title.append(link); card.append(label, title);
    if (Number.isFinite(item.timestamp)) {
      const date = document.createElement('time'); date.dateTime = new Date(item.timestamp).toISOString();
      date.textContent = new Date(item.timestamp).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); card.append(date);
    }
    list.append(card);
  });
}
async function loadNews() {
  refresh.disabled = true; status.textContent = 'Buscando notícias…';
  const results = await Promise.allSettled(Object.entries(feeds).map(async ([kind, feed]) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed), { signal: controller.signal });
      if (!response.ok) throw new Error('Feed indisponível');
      const data = await response.json();
      if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('Feed inválido');
      return data.items.map(item => ({ category: kind, title: String(item.title || ''), url: safeUrl(item.link), timestamp: Date.parse(item.pubDate) })).filter(item => item.url && item.title);
    } finally { clearTimeout(timeout); }
  }));
  const merged = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  if (merged.length) {
    const seen = new Set();
    articles = merged.filter(item => { if (seen.has(item.url)) return false; seen.add(item.url); return true; }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    status.textContent = results.every(result => result.status === 'fulfilled') ? 'Notícias atualizadas.' : 'Parte das fontes está indisponível. Exibindo notícias disponíveis.';
  } else status.textContent = articles.length ? 'Não foi possível atualizar. Exibindo a última consulta.' : 'As fontes estão indisponíveis no momento.';
  render(); refresh.disabled = false;
}
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  category = button.dataset.category;
  document.querySelectorAll('[data-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));
refresh.addEventListener('click', loadNews);
document.querySelector('#contact-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = 'Contato pelo portfólio — ' + data.get('nome');
  const body = 'Nome: ' + data.get('nome') + '\nE-mail: ' + data.get('email') + '\n\n' + data.get('mensagem');
  window.location.href = 'mailto:alanmirandarj@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
});
loadNews();
