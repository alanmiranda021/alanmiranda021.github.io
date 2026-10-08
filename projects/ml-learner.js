(() => {
  const shell = document.querySelector('.ml-app-shell');
  const frame = document.querySelector('#ml-app');
  const status = document.querySelector('#app-status');

  if (!shell || !frame) return;

  const appUrl = (shell.dataset.appUrl || '').replace(/\/+$/, '');
  if (!appUrl) {
    if (status) status.textContent = 'URL da aplicação não configurada';
    return;
  }

  // A aplicação é carregada dentro desta própria página.
  const embeddedUrl = `${appUrl}/?embed=true`;

  frame.src = embeddedUrl;

  frame.addEventListener('load', () => {
    if (status) status.textContent = 'Aplicação pronta para receber dados';
  });
})();
