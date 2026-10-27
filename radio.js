(() => {
  const audio = document.getElementById('portfolio-radio');
  const toggle = document.getElementById('radio-toggle');
  const status = document.getElementById('radio-status');
  if (!audio || !toggle || !status) return;
  audio.volume = 0.35;
  const show = (message, playing = false) => {
    status.textContent = message;
    toggle.textContent = playing ? 'Pausar' : 'Ouvir';
    toggle.setAttribute('aria-label', playing ? 'Pausar rádio' : 'Ouvir rádio');
  };
  const start = () => {
    show('Conectando à rádio…');
    if (audio.error) audio.load();
    audio.play().catch(error => {
      show(error.name === 'NotAllowedError' ? 'Clique em Ouvir para iniciar' : 'Sem conexão. Clique para tentar novamente');
    });
  };
  toggle.addEventListener('click', () => {
    if (audio.paused) start();
    else audio.pause();
  });
  audio.addEventListener('playing', () => show('Ao vivo', true));
  audio.addEventListener('pause', () => show('Rádio pausada'));
  audio.addEventListener('waiting', () => show('Carregando áudio…', !audio.paused));
  audio.addEventListener('error', () => show('Rádio indisponível. Tente novamente'));
  start();
})();
