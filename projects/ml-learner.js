(() => {
  const shell = document.querySelector('.ml-app-shell');
  const frame = document.querySelector('#ml-app');
  const status = document.querySelector('#app-status');
  const fallback = document.querySelector('#app-fallback');
  const openLink = document.querySelector('#app-open');

  if (!shell || !frame) return;

  const appUrl = (shell.dataset.appUrl || '').replace(/\/+$/, '');
  if (!appUrl) {
    if (status) status.textContent = 'URL da aplicação não configurada';
    return;
  }

  if (openLink) openLink.href = appUrl;

  let loaded = false;

  const showFallback = () => {
    if (loaded) return;
    if (fallback) fallback.hidden = false;
    if (status) status.textContent = 'Não foi possível carregar o embed';
  };

  const hideFallback = () => {
    if (fallback) fallback.hidden = true;
  };

  // Listeners ANTES de definir o src, para não perder o evento "load".
  frame.addEventListener('load', () => {
    loaded = true;
    hideFallback();
    if (status) status.textContent = 'Aplicação pronta para receber dados';
  });
  frame.addEventListener('error', showFallback);

  // A aplicação é carregada dentro desta própria página.
  frame.src = `${appUrl}/?embed=true`;

  // Apps Streamlit "dormindo" podem demorar; só mostra o aviso se nada carregar.
  setTimeout(showFallback, 45000);
})();
