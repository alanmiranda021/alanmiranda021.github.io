document.documentElement.classList.add('js');
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: .5, y: .5 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight; });
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- infraestrutura de canvas ---------- */
  function scene(id, init, draw) {
    const cv = document.getElementById(id), ctx = cv.getContext('2d'); let W, H, vis = false, st = {};
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); st = init(W, H) || {}; };
    size(); addEventListener('resize', size);
    new IntersectionObserver(([e]) => vis = e.isIntersecting).observe(cv);
    const t0 = performance.now();
    (function loop(now) { if (vis || reduce) draw(ctx, W, H, (now - t0) / 1000, st); if (!reduce) requestAnimationFrame(loop); })(t0);
    if (reduce) setTimeout(() => draw(ctx, W, H, 4, st), 50);
  }

  /* ---------- 1. HERO: estrelas + rede de partículas + horizonte ---------- */
  scene('c-hero', (W, H) => ({
    stars: Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random() * .85, r: rnd(.3, 1.4), p: rnd(0, 6) })),
    pts: Array.from({ length: Math.round(Math.min(90, W / 16)) }, () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-.18, .18), vy: rnd(-.18, .18) }))
  }), (c, W, H, t, s) => {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#02050a'); g.addColorStop(.7, '#0a1822'); g.addColorStop(1, '#173345'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    s.stars.forEach(o => { c.globalAlpha = .35 + .65 * Math.abs(Math.sin(t * .8 + o.p)); c.fillStyle = '#dff1ff'; c.beginPath(); c.arc(o.x * W + (mouse.x - .5) * -14 * o.r, o.y * H, o.r, 0, 7); c.fill(); });
    c.globalAlpha = 1;
    // arco de horizonte (planeta/oceano)
    const cx = W * .72, cy = H * 1.85, R = H * 1.22;
    const hg = c.createRadialGradient(cx, cy - R, R * .9, cx, cy, R * 1.05); hg.addColorStop(0, '#9fd4f000'); hg.addColorStop(.97, '#6fb3dd55'); hg.addColorStop(1, '#0a182200');
    c.fillStyle = '#050b11'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
    c.strokeStyle = '#9fd4f0'; c.globalAlpha = .55; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.globalAlpha = 1;
    const gl = c.createRadialGradient(cx, cy - R, 0, cx, cy - R, H * .7); gl.addColorStop(0, '#7fc4ee40'); gl.addColorStop(1, '#7fc4ee00'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
    // rede
    const mx = mouse.x * W, my = mouse.y * H;
    s.pts.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H * .8) p.vy *= -1; const dx = mx - p.x, dy = my - p.y, d = Math.hypot(dx, dy); if (d < 160) { p.x += dx * .004; p.y += dy * .004; } });
    for (let i = 0; i < s.pts.length; i++) { const a = s.pts[i]; c.fillStyle = '#bfe4f7'; c.globalAlpha = .7; c.fillRect(a.x - 1, a.y - 1, 2.2, 2.2);
      for (let j = i + 1; j < s.pts.length; j++) { const b = s.pts[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 130) { c.globalAlpha = (1 - d / 130) * .28; c.strokeStyle = '#7fb4d0'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); } } }
    c.globalAlpha = 1;
  });

  /* ---------- 2. MAR: entardecer + navio offshore (silhueta) + reflexo ---------- */
  function ship(c, t, lights) {
    // porta-contêineres em silhueta ao entardecer (origem na linha d'água, proa à direita)
    const dark = '#03070b';
    c.fillStyle = dark; c.strokeStyle = 'rgba(255,170,110,.42)'; c.lineWidth = 1.4;
    const poly = pts => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
    poly([[-445, -74], [-432, -6], [-396, 0], [340, 0], [404, -30], [462, -122], [444, -76]]); // casco
    c.beginPath(); c.moveTo(-445, -74); c.lineTo(444, -76); c.lineTo(462, -122); c.stroke(); // brilho da borda
    // contêineres: pilhas determinísticas, mais altas perto da casaria e mais baixas à proa
    let seed = 11; const rn = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stacks = []; let x = -222, i = 0;
    while (x < 392) { const n = Math.max(2, Math.min(7, Math.round(6.4 - i * .3 + (rn() - .5) * 1.8))), w = rn() < .4 ? 82 : 41; const nn = x > 300 ? Math.min(n, 3) : n; stacks.push([x, Math.min(w, 396 - x), nn]); x += w + 3; i++; }
    [[-428, 3], [-386, 3], [-344, 2]].forEach(([sx, n]) => stacks.push([sx, 40, n]));
    stacks.forEach(([sx, w, n]) => { for (let k = 0; k < n; k++) { c.fillStyle = (k + Math.round(sx)) % 3 ? '#050a10' : '#0a121a'; c.fillRect(sx, -74 - (k + 1) * 28, w, 27); c.fillStyle = 'rgba(255,160,100,.22)'; c.fillRect(sx, -74 - (k + 1) * 28, w, 1.6); } });
    c.fillStyle = dark;
    // casaria de popa, chaminé e mastro
    poly([[-338, -74], [-338, -138], [-236, -138], [-236, -74]]);
    poly([[-330, -138], [-330, -178], [-242, -178], [-242, -138]]);
    poly([[-322, -178], [-322, -208], [-250, -208], [-250, -178]]);
    poly([[-346, -208], [-346, -234], [-232, -234], [-240, -208]]); // ponte
    poly([[-326, -208], [-322, -278], [-296, -278], [-292, -208]]); // chaminé
    poly([[-318, -280], [-300, -280], [-300, -272], [-318, -272]]);
    poly([[-266, -234], [-263, -300], [-260, -234]]); poly([[-280, -300], [-246, -300], [-246, -296], [-280, -296]]); // mastro
    // castelo de proa e mastro de proa
    poly([[396, -76], [440, -76], [455, -108], [396, -98]]); poly([[418, -98], [420, -150], [422, -98]]);
    if (!lights) return;
    const glow = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, col); g.addColorStop(.25, col.slice(0, 7) + '55'); g.addColorStop(1, col.slice(0, 7) + '00'); c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * .55, 0, 7); c.fill(); };
    for (let k = 0; k < 9; k++) glow(-336 + k * 12, -222, 2, '#ffc069ff'); // janelas da ponte
    for (let k = 0; k < 7; k++) glow(-322 + k * 13, -196, 1.7, '#ffd89aff');
    for (let k = 0; k < 8; k++) { glow(-330 + k * 12, -158, 1.7, '#ffb25cff'); glow(-330 + k * 12, -118, 1.7, '#ffb25cff'); glow(-330 + k * 12, -96, 1.7, '#ffb25cff'); }
    glow(-263, -302, 3, (Math.floor(t * 1.2) % 2 ? '#ff4040ff' : '#ff404066'));
    glow(420, -152, 2.2, '#5aff9cff'); glow(454, -110, 2.2, '#ff5050ff'); glow(-440, -80, 2.2, '#fff2c0ff'); glow(100, -78, 2, '#fff2c0ff');
  }
  scene('c-sea', () => ({}), (c, W, H, t) => {
    const hz = H * (W < 900 ? .36 : .58), px = (mouse.x - .5), sunX = W * .74 + px * -30;
    const sky = c.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#050c16'); sky.addColorStop(.45, '#17324a'); sky.addColorStop(.8, '#b4624a'); sky.addColorStop(1, '#f2a35b'); c.fillStyle = sky; c.fillRect(0, 0, W, hz + 1);
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${.25 + .3 * Math.sin(t + i)})`; c.fillRect((i * 97.3) % W, (i * 41.7) % (hz * .45), 1.2, 1.2); }
    // nuvens finas
    for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(30,45,65,${.35 - i * .04})`; const y = hz * (.52 + i * .08), x = ((t * (4 + i)) % (W + 600)) - 300 + i * 160; c.beginPath(); c.ellipse(x % (W + 400), y, 340, 7 + i * 2, 0, 0, 7); c.fill(); }
    const sg = c.createRadialGradient(sunX, hz, 0, sunX, hz, H * .5); sg.addColorStop(0, '#ffe2a8ff'); sg.addColorStop(.08, '#ffc47acc'); sg.addColorStop(.35, '#ff8a4a33'); sg.addColorStop(1, '#ff8a4a00'); c.fillStyle = sg; c.fillRect(0, 0, W, hz + 2);
    c.fillStyle = '#fff1cf'; c.beginPath(); c.arc(sunX, hz - 4, 26, Math.PI, 0); c.fill();
    // mar
    const sea = c.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#6d5a52'); sea.addColorStop(.12, '#1c3446'); sea.addColorStop(1, '#03080d'); c.fillStyle = sea; c.fillRect(0, hz, W, H - hz);
    // reflexo do sol
    for (let y = hz; y < H; y += 3) { const k = (y - hz) / (H - hz), wd = 20 + k * W * .28, off = Math.sin(y * .09 + t * 1.6) * (6 + k * 40) + Math.sin(y * .31 - t * 2.4) * 4; c.fillStyle = `rgba(255,190,110,${(.55 - k * .5) * (.45 + .55 * Math.abs(Math.sin(y * .5 + t * 3)))})`; c.fillRect(sunX + off - wd / 2, y, wd * (.3 + Math.random() * .0 + .7 * Math.abs(Math.sin(y * .13 + t))), 1.6); }
    // navio
    const s = Math.min(W / 1150, H / 700) * (W < 900 ? .62 : .66), sx = W * (W < 900 ? .5 : .68) + px * 26, sy = hz + H * .045, bob = Math.sin(t * .9) * 3, rot = Math.sin(t * .7) * .012;
    c.save(); c.beginPath(); c.rect(0, hz, W, H); c.clip(); c.translate(sx, sy + bob); c.scale(s, -s * .9); c.globalAlpha = .28; c.rotate(-rot); ship(c, t, true); c.restore();
    for (let y = hz + 4; y < H; y += 3) { c.fillStyle = `rgba(6,16,24,${.25 + .4 * Math.abs(Math.sin(y * .7 + t * 2))})`; c.fillRect(0, y, W, 1.2); }
    c.save(); c.translate(sx, sy + bob); c.rotate(rot); c.scale(s, s); ship(c, t, true); c.restore();
    // espuma na linha d'água
    c.save(); c.translate(sx, sy + bob); c.scale(s, s); for (let i = 0; i < 38; i++) { c.fillStyle = `rgba(255,235,210,${.18 + .12 * Math.sin(t * 3 + i)})`; c.fillRect(-440 + i * 22 + Math.sin(t + i) * 4, -2, 14, 3); } c.restore();
    const vg = c.createLinearGradient(0, H * .8, 0, H); vg.addColorStop(0, '#04070a00'); vg.addColorStop(1, '#04070a'); c.fillStyle = vg; c.fillRect(0, H * .8, W, H * .2);
  });

  /* ---------- 3. IA: rede de agentes com pulsos ---------- */
  scene('c-net', (W, H) => {
    const cx = W * (W < 900 ? .5 : .7), cy = H * (W < 900 ? .3 : .48), nodes = [{ r: 0, a: 0, sp: 0, s: 14, core: true }];
    [[110, 5, .22, 6], [200, 8, -.15, 5], [290, 11, .09, 4]].forEach(([r, n, sp, s]) => { const rr = r * Math.min(1, W / 1100 + .35); for (let i = 0; i < n; i++) nodes.push({ r: rr, a: i / n * 6.283 + rnd(-.2, .2), sp, s }); });
    return { cx, cy, nodes, pulses: [] };
  }, (c, W, H, t, s) => {
    c.fillStyle = '#04080d'; c.fillRect(0, 0, W, H);
    const gg = c.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, H * .7); gg.addColorStop(0, '#16415c66'); gg.addColorStop(1, '#04080d00'); c.fillStyle = gg; c.fillRect(0, 0, W, H);
    const pos = s.nodes.map(n => ({ x: s.cx + Math.cos(n.a + t * n.sp) * n.r + (mouse.x - .5) * 18, y: s.cy + Math.sin(n.a + t * n.sp) * n.r * .78 + (mouse.y - .5) * 12 }));
    s.nodes.forEach((n, i) => { if (!n.core) { c.strokeStyle = 'rgba(127,180,208,.12)'; c.beginPath(); c.ellipse(s.cx, s.cy, n.r, n.r * .78, 0, 0, 7); c.stroke(); } });
    const edges = []; for (let i = 1; i < pos.length; i++) { edges.push([0, i]); const j = pos.findIndex((p, k) => k > i && Math.hypot(p.x - pos[i].x, p.y - pos[i].y) < 120); if (j > 0) edges.push([i, j]); }
    edges.forEach(([a, b]) => { c.strokeStyle = 'rgba(127,180,208,.22)'; c.beginPath(); c.moveTo(pos[a].x, pos[a].y); c.lineTo(pos[b].x, pos[b].y); c.stroke(); });
    if (Math.random() < .12) { const e = edges[Math.floor(Math.random() * edges.length)]; s.pulses.push({ e, p: 0 }); }
    s.pulses = s.pulses.filter(u => (u.p += .015) < 1); s.pulses.forEach(u => { const a = pos[u.e[0]], b = pos[u.e[1]], x = a.x + (b.x - a.x) * u.p, y = a.y + (b.y - a.y) * u.p, g = c.createRadialGradient(x, y, 0, x, y, 12); g.addColorStop(0, '#fff'); g.addColorStop(.3, '#7df5ffaa'); g.addColorStop(1, '#7df5ff00'); c.fillStyle = g; c.fillRect(x - 12, y - 12, 24, 24); });
    pos.forEach((p, i) => { const n = s.nodes[i], k = n.core ? 1 + .12 * Math.sin(t * 2.4) : 1; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, n.s * 3.2 * k); g.addColorStop(0, n.core ? '#ffffffcc' : '#9fe8ff88'); g.addColorStop(1, '#7df5ff00'); c.fillStyle = g; c.fillRect(p.x - n.s * 4, p.y - n.s * 4, n.s * 8, n.s * 8); c.fillStyle = '#04080d'; c.strokeStyle = n.core ? '#fff' : '#b7cedd'; c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, n.s * .55 * k, 0, 7); c.fill(); c.stroke(); });
  });

  /* ---------- 5. DADOS: pipeline + gráfico animado ---------- */
  scene('c-data', () => ({ born: null }), (c, W, H, t, s) => {
    s.born ??= t; const k = Math.min(1, (t - s.born) / 2.6), e = 1 - Math.pow(1 - k, 3);
    c.fillStyle = '#05090d'; c.fillRect(0, 0, W, H);
    const x0 = W * (W < 900 ? .08 : .46), x1 = W * .94, y0 = H * (W < 900 ? .1 : .2), y1 = H * (W < 900 ? .42 : .72), w = x1 - x0, h = y1 - y0;
    c.strokeStyle = '#ffffff14'; c.lineWidth = 1; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(x0 + w * i / 8, y0); c.lineTo(x0 + w * i / 8, y1); c.stroke(); } for (let i = 0; i <= 5; i++) { c.beginPath(); c.moveTo(x0, y0 + h * i / 5); c.lineTo(x1, y0 + h * i / 5); c.stroke(); }
    const n = 32, f = i => .5 + .22 * Math.sin(i * .35 + t * .4) + .12 * Math.sin(i * .9) + i / n * .3;
    for (let i = 0; i < n; i++) { const bh = h * .45 * f(i) * e, bx = x0 + w * i / n; c.fillStyle = `rgba(127,180,208,${.12 + i / n * .3})`; c.fillRect(bx + 2, y1 - bh, w / n - 5, bh); }
    c.beginPath(); for (let i = 0; i <= n * e; i++) { const x = x0 + w * i / n, y = y1 - h * .85 * (f(i) * .9 + .06 * Math.sin(i * 1.7 + t)) * .98; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = '#fff'; c.lineWidth = 2.2; c.shadowColor = '#7df5ff'; c.shadowBlur = 14; c.stroke(); c.shadowBlur = 0;
    // pontos de previsão
    c.fillStyle = '#7df5ff'; for (let i = 0; i < 60; i++) { const px = x0 + (i * 53 % 100) / 100 * w, py = y1 - (.15 + ((i * 37) % 70) / 100) * h * .9; c.globalAlpha = .55 * e; c.fillRect(px, py, 2.5, 2.5); } c.globalAlpha = 1;
    c.fillStyle = '#9ba5ac'; c.font = '10px ui-monospace,monospace'; ['ILUSTRATIVO', 'R² · RMSE · F1'].forEach((l, i) => c.fillText(l, x0 + i * 110, y0 - 14));
  });

  /* ---------- telemetria, relógio, terminal ---------- */
  const $ = s => document.querySelector(s);
  setInterval(() => {
    const t = performance.now() / 1000, J = .62 + .06 * Math.sin(t * .5), Kt = .21 - .05 * (J - .62) * 4 + .004 * Math.sin(t * 3), Kq = .031 + .002 * Math.sin(t * 2), eta = J * Kt / (2 * Math.PI * Kq);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('t-j', J.toFixed(3)); set('t-kt', Kt.toFixed(3)); set('t-kq', Kq.toFixed(4)); set('t-eta', (eta * 100).toFixed(1) + ' %'); set('t-v', (11.2 + .4 * Math.sin(t * .4)).toFixed(1) + ' nós'); set('t-h', String(Math.round(86 + 3 * Math.sin(t * .2))).padStart(3, '0') + '°');
    set('clock', new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  }, 250);
  const lines = ['# demonstração ilustrativa','> aeon.boot()', '[kernel] núcleo inicializado', '[memória] 1.284 documentos indexados', '[agente:pesquisa] consultando fontes…', '[agente:validação] resposta verificada ✓', '> pronto para executar.'];
  let typed = false;
  function typeTerm() { if (typed) return; typed = true; const el = $('#term'); let l = 0, ch = 0; (function step() { if (l >= lines.length) return; el.firstChild.textContent += lines[l][ch++] ?? ''; if (ch > lines[l].length) { el.firstChild.textContent += '\n'; l++; ch = 0; setTimeout(step, 260); } else setTimeout(step, reduce ? 0 : 22); })(); }

  /* ---------- painéis: entrada, dots, progresso ---------- */
  const panels = [...document.querySelectorAll('.panel')], dots = $('.dots');
  panels.forEach((p, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', p.dataset.title); b.innerHTML = '<span>' + p.dataset.title + '</span>'; b.onclick = () => p.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); dots.append(b); });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); const i = panels.indexOf(e.target); [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i)); if (e.target.id === 'ia') typeTerm(); } }), { threshold: .45 });
  panels.forEach(p => io.observe(p));
  const bar = $('.progress'), head = $('.header');
  addEventListener('scroll', () => { bar.style.width = (scrollY / (document.documentElement.scrollHeight - innerHeight) * 100) + '%'; head.classList.toggle('scrolled', scrollY > 40); }, { passive: true });
})();
