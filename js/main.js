/* ============================================================
   LUCA COSTA — effetti spaziali: starfield, parallasse, reveal
   ============================================================ */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- LENIS: smooth scroll inerziale (Awwwards-grade) ---------- */
  let lenis = null, scrollVel = 0;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      anchors: true,                       // gestisce i link #ancora con scroll fluido
    });
    document.documentElement.style.scrollBehavior = 'auto';
    lenis.on('scroll', (e) => { scrollVel = e.velocity; });
  }

  /* ---------- AURORA ANIMATA (canvas low-res upscalato + blur CSS) ---------- */
  const auroraCanvas = document.getElementById('aurora');
  const actx = auroraCanvas.getContext('2d');
  const A_W = 260, A_H = 150;                      // risoluzione interna: il blur fa il resto
  auroraCanvas.width = A_W; auroraCanvas.height = A_H;

  // [hue, sat%, luce%, raggio rel., velocità, fase, raggio orbita X, raggio orbita Y, cx, cy]
  const auroraBlobs = [
    { h: 207, s: 100, l: 60, r: .16, sp: .060, ph: 0.0, ox: .07, oy: .06, cx: .46, cy: .24, a: .34 }, // streak azzurro centro-alto
    { h: 218, s: 100, l: 50, r: .30, sp: .045, ph: 2.1, ox: .10, oy: .08, cx: .40, cy: .30, a: .14 }, // alone blu attorno allo streak
    { h: 272, s:  95, l: 56, r: .20, sp: .055, ph: 4.0, ox: .07, oy: .06, cx: .80, cy: .06, a: .34 }, // viola angolo dx alto
    { h: 250, s:  95, l: 48, r: .28, sp: .040, ph: 1.2, ox: .09, oy: .08, cx: .88, cy: .20, a: .16 }, // alone viola-blu dx
    { h: 232, s: 100, l: 45, r: .30, sp: .038, ph: 5.0, ox: .12, oy: .09, cx: .78, cy: .60, a: .12 }, // blu profondo dietro al blob
    { h: 196, s: 100, l: 58, r: .14, sp: .080, ph: 5.2, ox: .09, oy: .06, cx: .05, cy: .82, a: .16 }, // ciano debole basso sx
    { h: 248, s:  92, l: 42, r: .32, sp: .034, ph: 3.0, ox: .13, oy: .10, cx: .55, cy: 1.02, a: .10 }, // indaco basso
  ];

  function drawAurora(t) {
    const time = t * 0.001;
    actx.globalCompositeOperation = 'source-over';
    actx.fillStyle = '#030409';
    actx.fillRect(0, 0, A_W, A_H);
    actx.globalCompositeOperation = 'lighter';
    for (const b of auroraBlobs) {
      const x = (b.cx + Math.sin(time * b.sp * 7 + b.ph) * b.ox + smX * 0.05) * A_W;
      const y = (b.cy + Math.cos(time * b.sp * 5 + b.ph * 1.7) * b.oy + smY * 0.04) * A_H
                - (scrollY * 0.00003 * A_H);
      const breathe = 1 + Math.sin(time * b.sp * 9 + b.ph * 2.3) * 0.18;
      const rad = b.r * A_H * breathe;
      const g = actx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `hsla(${b.h},${b.s}%,${b.l}%,${b.a})`);
      g.addColorStop(0.55, `hsla(${b.h},${b.s}%,${Math.max(b.l - 18, 20)}%,${b.a * 0.45})`);
      g.addColorStop(1, 'hsla(230,100%,40%,0)');
      actx.fillStyle = g;
      actx.beginPath();
      actx.arc(x, y, rad, 0, Math.PI * 2);
      actx.fill();
    }
  }

  /* ---------- STARFIELD (3 livelli di profondità + twinkle) ---------- */
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let stars = [], W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let scrollY = 0, mouseX = 0, mouseY = 0, smX = 0, smY = 0;

  /* qualità adattiva: parte dal n. di core, poi un watchdog la corregge a runtime.
     Tutti gli effetti restano: cambia solo il NUMERO di stelle e il refresh aurora. */
  let qTier = (navigator.hardwareConcurrency || 4) <= 4 ? 1 : 0;   // 0 full · 1 medio · 2 leggero

  // sprite stella pre-renderizzato per tinta: drawImage costa molto meno di arc+fill+stringa hsla
  function makeStarSprite(hue) {
    const S = 16, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, `hsla(${hue},92%,93%,1)`);
    g.addColorStop(0.4, `hsla(${hue},90%,80%,.55)`);
    g.addColorStop(1, `hsla(${hue},90%,72%,0)`);
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return c;
  }
  const starSprites = { 225: makeStarSprite(225), 195: makeStarSprite(195), 265: makeStarSprite(265) };

  function starTarget() {
    const div = qTier >= 2 ? 7200 : qTier === 1 ? 5600 : 4200;
    const cap = qTier >= 2 ? 170 : qTier === 1 ? 260 : 360;
    return Math.min(cap, Math.floor(W * H / div));
  }

  function resizeStars() {       // tocca il canvas (riallocazione): solo su resize reale
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    populateStars();
  }

  function populateStars() {     // solo l'array: il watchdog adattivo chiama questa (niente stall canvas)
    stars = Array.from({ length: starTarget() }, () => {
      const depth = Math.random();                 // 0 = lontana, 1 = vicina
      const r = 0.3 + depth * 1.3;
      const hue = Math.random() < 0.12 ? 265 : (Math.random() < 0.3 ? 195 : 225);
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        depth,
        base: 0.25 + Math.random() * 0.65,
        tw: 0.5 + Math.random() * 2,               // velocità twinkle
        ph: Math.random() * Math.PI * 2,
        sprite: starSprites[hue],
        sz: r * 3.4 + (depth > 0.85 ? 5 : 1.6),    // dimensione disco: l'alone è già nello sprite
      };
    });
  }

  function drawStars(t) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const par = s.depth * 0.35;
      let y = (s.y - scrollY * par) % H; if (y < 0) y += H;
      const x = (s.x + smX * s.depth * 22 + W) % W;
      const a = s.base * (0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph));
      const sz = s.sz;
      ctx.globalAlpha = a;
      ctx.drawImage(s.sprite, x - sz * 0.5, y + smY * s.depth * 12 - sz * 0.5, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- LOOP UNICO: stelle + parallasse scroll/mouse ---------- */
  const depthEls = [...document.querySelectorAll('[data-depth]')];
  const mouseEls = [...document.querySelectorAll('[data-mouse]')];
  const heroContent = document.querySelector('.hero__content');
  const heroBlobEl = document.getElementById('heroBlob');

  let rafId = 0, auroraLast = -1e9, lastOut = -1, lastRender = 0;
  const RENDER_MS = 1000 / 62;   // cap del lavoro pesante (stelle/aurora/parallasse) a ~60fps anche su monitor 120/144/180Hz
  // watchdog adattivo: misura i primi ~2.6s; se il device arranca, scende di un tier
  let wdT0 = 0, wdFrames = 0, wdSlow = 0, adapted = false, prevT = 0;

  function frame(t) {
    rafId = requestAnimationFrame(frame);
    if (lenis) lenis.raf(t);                  // Lenis ogni frame: lo scroll resta fluido al refresh nativo
    if (t - lastRender < RENDER_MS) return;    // il resto gira al massimo a ~60fps (su 180Hz erano 180fps = 3x lavoro)
    lastRender = t;
    smX += (mouseX - smX) * 0.045;
    smY += (mouseY - smY) * 0.045;
    scrollY = window.scrollY;

    // aurora: sfocata -> ridisegno ~13-15fps, impercettibile
    if (t - auroraLast >= (qTier >= 1 ? 75 : 64)) { drawAurora(t); auroraLast = t; }
    drawStars(t);

    // watchdog: conta i frame lenti nella finestra iniziale, poi adatta una volta sola
    if (!adapted) {
      if (!wdT0) wdT0 = t;
      if (prevT && (t - prevT) > 26) wdSlow++;      // frame > 26ms = sotto ~38fps
      wdFrames++;
      if (t - wdT0 > 2600 && wdFrames > 20) {
        adapted = true;
        if (wdSlow / wdFrames > 0.25 && qTier < 2) { qTier++; populateStars(); }
      }
    }
    prevT = t;

    for (const el of depthEls) {
      const d = parseFloat(el.dataset.depth);
      el.style.transform = `translate3d(0, ${scrollY * d}px, 0)`;
    }
    for (const el of mouseEls) {
      const m = parseFloat(el.dataset.mouse);
      el.style.translate = `${smX * m}px ${smY * m * 0.7}px`;
    }

    /* hero: uscita cinematica allo scroll (skip se gia' fuori vista: niente scritture inutili) */
    const out = Math.min(scrollY / (window.innerHeight * 0.85), 1);
    if (out !== lastOut) {
      lastOut = out;
      if (heroContent) {
        heroContent.style.opacity = String(1 - out);
        heroContent.style.transform = `translateY(${out * -46}px)`;
      }
      if (heroBlobEl) {
        heroBlobEl.style.opacity = String(Math.max(0, 1 - out * 0.9));
        heroBlobEl.style.translate = '0 ' + (scrollY * 0.42).toFixed(1) + 'px';   // parallasse profonda: il blob lagga molto, sembra lontanissimo
      }
    }
  }

  resizeStars();
  window.addEventListener('resize', resizeStars);
  window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / W - 0.5);
    mouseY = (e.clientY / H - 0.5);
  });
  if (!reduceMotion) {
    rafId = requestAnimationFrame(frame);
    // pausa i loop quando il tab non e' visibile: 0 CPU in background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
      else if (!rafId) { auroraLast = -1e9; rafId = requestAnimationFrame(frame); }
    });
  } else {
    drawAurora(0); drawStars(0);
    document.querySelectorAll('.thumb-svg').forEach((s) => { try { s.pauseAnimations(); } catch (e) {} });
  }

  /* ---------- REVEAL ALLO SCROLL ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  /* ---------- NAV: link attivo, hide on scroll-down, progress ---------- */
  const navWrap = document.querySelector('.nav-wrap');
  const progressFill = document.getElementById('progressFill');
  const links = [...document.querySelectorAll('.nav__links a')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
  const dotLinks = [...document.querySelectorAll('.dotnav a')];
  const dotSections = dotLinks.map((a) => document.querySelector(a.getAttribute('href')));
  let lastY = 0;
  /* cache di layout: leggere scrollHeight/offsetTop ad ogni scroll = layout thrashing (reflow sincrono).
     Misuriamo una volta (e su resize/load/font); lo scroll handler fa solo aritmetica. */
  let vh = window.innerHeight, pageMax = 0, secOffsets = [], dotOffsets = [];
  let prevCur = -2, prevDcur = -2;
  function measure() {
    vh = window.innerHeight;
    pageMax = document.documentElement.scrollHeight - vh;
    secOffsets = sections.map((s) => (s ? s.offsetTop : Infinity));
    dotOffsets = dotSections.map((s) => (s ? s.offsetTop : Infinity));
  }

  function updateScroll() {
    const y = window.scrollY;
    navWrap.classList.toggle('is-hidden', y > 500 && y > lastY);
    lastY = y;
    progressFill.style.width = (pageMax > 0 ? Math.min(y / pageMax, 1) * 100 : 0) + '%';
    // in fondo l'ultima sezione (Contatti) e' troppo corta per raggiungere la soglia: forzala attiva
    const atBottom = pageMax > 0 && y >= pageMax - 2;

    let current = -1;
    const t1 = vh * 0.4;
    for (let i = 0; i < secOffsets.length; i++) if (y >= secOffsets[i] - t1) current = i;
    if (atBottom) current = sections.length - 1;
    if (current !== prevCur) {                       // tocca il DOM solo se la sezione attiva cambia
      links.forEach((a, i) => a.classList.toggle('is-active', i === current));
      prevCur = current;
    }

    let dcur = 0;
    const t2 = vh * 0.45;
    for (let i = 0; i < dotOffsets.length; i++) if (y >= dotOffsets[i] - t2) dcur = i;
    if (atBottom) dcur = dotSections.length - 1;
    if (dcur !== prevDcur) {
      dotLinks.forEach((a, i) => a.classList.toggle('is-active', i === dcur));
      prevDcur = dcur;
    }
  }

  /* un solo update per frame, anche se arrivano piu' eventi scroll */
  let scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => { updateScroll(); scrollTicking = false; });
  }
  function remeasure() { measure(); updateScroll(); }

  remeasure();
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure).catch(() => {});
  let measureT;
  window.addEventListener('resize', () => { clearTimeout(measureT); measureT = setTimeout(remeasure, 150); });
  // una sola sorgente di scroll: Lenis se attivo, altrimenti il nativo (niente doppio handler)
  if (lenis) lenis.on('scroll', onScroll);
  else window.addEventListener('scroll', onScroll, { passive: true });

  /* menu mobile */
  const burger = document.querySelector('.nav__burger');
  const nav = document.querySelector('.nav');
  burger.addEventListener('click', () => nav.classList.toggle('is-open'));
  links.forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));

  /* ---------- CARD: spotlight + tilt 3D, agganciato a rAF (max 1 calcolo per frame) ---------- */
  document.querySelectorAll('.card').forEach((card) => {
    card.insertAdjacentHTML('afterbegin', '<i class="card__foil" aria-hidden="true"></i>');
    const tilt = card.classList.contains('tilt') && !reduceMotion;
    let rect = null, lastE = null, scheduled = false;
    function apply() {
      scheduled = false;
      if (!lastE) return;
      if (!rect) rect = card.getBoundingClientRect();   // letto 1 volta per hover, non ad ogni movimento
      const px = (lastE.clientX - rect.left) / rect.width;
      const py = (lastE.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', px * 100 + '%');
      card.style.setProperty('--my', py * 100 + '%');
      if (tilt) card.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 6}deg) rotateX(${(0.5 - py) * 6}deg) translateY(-3px)`;
    }
    card.addEventListener('pointerenter', () => { rect = card.getBoundingClientRect(); });
    card.addEventListener('pointermove', (e) => {
      lastE = e;
      if (!scheduled) { scheduled = true; requestAnimationFrame(apply); }   // throttle: 1 update per frame
    });
    card.addEventListener('pointerleave', () => { lastE = null; rect = null; card.style.transform = ''; });
  });

  /* ---------- COPERTINE PROGETTI STATICHE: ferma le animazioni SMIL delle thumbnail (0 costo per-frame) ---------- */
  document.querySelectorAll('.thumb-svg').forEach((s) => {
    try { s.setCurrentTime(2.6); s.pauseAnimations(); } catch (e) {}   // congela su un fotogramma "pieno" e ferma la timeline
  });

  /* ---------- TOAST (wireframe / layout) ---------- */
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastSub = document.getElementById('toastSub');
  let toastTimer;

  function showToast(title, sub) {
    toastTitle.textContent = title;
    toastSub.textContent = sub;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 3200);
  }

  document.querySelectorAll('.wip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wip-btn').forEach((b) => b.classList.remove('wip-btn--active'));
      btn.classList.add('wip-btn--active');
      showToast(
        btn.dataset.mode === 'layout' ? 'Layout in preparazione' : 'Wireframe in preparazione',
        'Sto preparando il sito'
      );
    });
  });

  document.querySelectorAll('.project__plus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.closest('.project').querySelector('h3').textContent;
      showToast(name, 'Case study in arrivo ✦');
    });
  });
})();
