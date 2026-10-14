(() => {
  const audio = document.getElementById('author-music');
  const status = document.getElementById('author-music-status');
  if (!audio || !status) return;
  audio.volume = 0.35;
  audio.addEventListener('playing', () => { status.textContent = 'Tocando'; });
  audio.addEventListener('pause', () => { status.textContent = 'Pausada'; });
  audio.addEventListener('ended', () => { status.textContent = 'Ouvir novamente'; });
  audio.addEventListener('error', () => { status.textContent = 'Não foi possível carregar a música'; });
  audio.play().catch(error => {
    status.textContent = error.name === 'NotAllowedError'
      ? 'Clique em reproduzir para ouvir'
      : 'Use o player para tentar novamente';
  });
})();
