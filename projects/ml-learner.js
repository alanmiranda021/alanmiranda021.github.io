(() => {
  const shell = document.querySelector('.ml-app-shell');
  const frame = document.querySelector('#ml-app');
  const status = document.querySelector('#app-status');
  const fallbackLink = document.querySelector('#fallback-link');
  const standalone = document.querySelector('#open-standalone');
  const appUrl = shell.dataset.appUrl;
  const embeddedUrl = `${appUrl.replace(/\/$/, '')}/?embed=true`;

  standalone.href = appUrl;
  fallbackLink.href = appUrl;
  frame.src = embeddedUrl;

  // Apps Streamlit podem levar mais de alguns segundos para sair do modo
  // "sleep" no Streamlit Cloud. Não esconda o iframe por tempo limite:
  // ele ainda pode carregar normalmente depois disso.
  const timer = window.setTimeout(() => {
    status.textContent = 'Inicialização em andamento — pode levar alguns instantes';
  }, 20000);

  frame.addEventListener('load', () => {
    window.clearTimeout(timer);
    status.textContent = 'Aplicação pronta para receber dados';
  });
})();
