(() => {
  const shell = document.querySelector('.ml-app-shell');
  const frame = document.querySelector('#ml-app');
  const status = document.querySelector('#app-status');
  const appUrl = new URL(shell.dataset.appUrl, window.location.href);
  document.querySelector('#launch-app').addEventListener('click', () => {
    document.querySelector('#app-launch').hidden = true;
    frame.hidden = false;
    status.textContent = 'Baixando e iniciando o ambiente Python…';
    frame.src = appUrl.href;
  }, { once: true });
  window.addEventListener('message', (event) => {
    if (event.origin !== appUrl.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'ml-learner-ready') status.textContent = 'Interface disponível — confira o laboratório abaixo';
    if (event.data?.type === 'ml-learner-error') status.textContent = 'Falha ao carregar — tente abrir em nova aba';
  });
})();
