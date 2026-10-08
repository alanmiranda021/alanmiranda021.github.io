(() => {
  const shell = document.querySelector('.ml-app-shell');
  const frame = document.querySelector('#ml-app');
  const status = document.querySelector('#app-status');
  const fallback = document.querySelector('#app-fallback');
  const fallbackLink = document.querySelector('#fallback-link');
  const standalone = document.querySelector('#open-standalone');
  const appUrl = shell.dataset.appUrl;
  const embeddedUrl = `${appUrl.replace(/\/$/, '')}/?embed=true`;

  standalone.href = appUrl;
  fallbackLink.href = appUrl;
  frame.src = embeddedUrl;

  const timer = window.setTimeout(() => {
    shell.dataset.failed = 'true';
    fallback.hidden = false;
    status.textContent = 'Abra em nova aba para continuar';
  }, 15000);

  frame.addEventListener('load', () => {
    window.clearTimeout(timer);
    status.textContent = 'Aplicação pronta para receber dados';
  });
})();
