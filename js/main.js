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
  let stars = [], W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let scrollY = 0, mouseX = 0, mouseY = 0, smX = 0, smY = 0;

  function buildStars() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const count = Math.min(420, Math.floor(W * H / 3800));
    stars = Array.from({ length: count }, () => {
      const depth = Math.random();                 // 0 = lontana, 1 = vicina
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        depth,
        r: 0.3 + depth * 1.3,
        base: 0.25 + Math.random() * 0.65,
        tw: 0.5 + Math.random() * 2,               // velocità twinkle
        ph: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.12 ? 265 : (Math.random() < 0.3 ? 195 : 225),
      };
    });
  }

  /* ---------- STELLE CADENTI (nucleo incandescente + alone + scintille) ---------- */
  let meteors = [], sparks = [];
  let nextMeteor = 2200;

  function spawnMeteor(t) {
    const big = Math.random() < 0.25;                 // 1 su 4 è spettacolare
    const angle = (28 + Math.random() * 20) * Math.PI / 180;
    const speed = big ? 13 + Math.random() * 5 : 8 + Math.random() * 4;
    meteors.push({
      x: Math.random() * W * 0.9 - W * 0.1,
      y: -30 - Math.random() * H * 0.2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: big ? 0.005 : 0.009,
      len: big ? 240 + Math.random() * 120 : 130 + Math.random() * 80,
      size: big ? 2.6 : 1.7,
      hue: 205 + Math.random() * 55,                  // dal ciano al violetto
    });
    nextMeteor = t + 2800 + Math.random() * 4800;
  }

  function drawMeteors() {
    ctx.globalCompositeOperation = 'lighter';

    meteors = meteors.filter((m) => m.life > 0 && m.x < W + 200 && m.y < H + 200);
    for (const m of meteors) {
      m.x += m.vx; m.y += m.vy;
      m.vy += 0.015;                                  // leggera curvatura gravitazionale
      m.life -= m.decay;
      const mag = Math.hypot(m.vx, m.vy);
      const ux = m.vx / mag, uy = m.vy / mag;
      const tx = m.x - ux * m.len * m.life;
      const ty = m.y - uy * m.len * m.life;

      // alone largo colorato
      let g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `hsla(${m.hue},100%,72%,${0.35 * m.life})`);
      g.addColorStop(0.4, `hsla(${m.hue + 20},100%,60%,${0.12 * m.life})`);
      g.addColorStop(1, 'hsla(250,100%,50%,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = m.size * 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();

      // nucleo bianco incandescente
      g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * m.life})`);
      g.addColorStop(0.3, `hsla(${m.hue},100%,85%,${0.5 * m.life})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = m.size;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();

      // testa luminosa con bagliore radiale
      const head = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 7);
      head.addColorStop(0, `rgba(255,255,255,${0.9 * m.life})`);
      head.addColorStop(0.3, `hsla(${m.hue},100%,75%,${0.5 * m.life})`);
      head.addColorStop(1, 'hsla(220,100%,60%,0)');
      ctx.fillStyle = head;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size * 7, 0, Math.PI * 2); ctx.fill();

      // scintille che si staccano dalla scia
      if (Math.random() < 0.75) {
        const back = Math.random() * m.len * 0.5;
        sparks.push({
          x: m.x - ux * back + (Math.random() - 0.5) * 5,
          y: m.y - uy * back + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 1.1 - ux * 0.4,
          vy: (Math.random() - 0.5) * 1.1 - uy * 0.4 + 0.18,
          life: 0.6 + Math.random() * 0.4,
          r: 0.5 + Math.random() * 1.3,
          hue: m.hue + (Math.random() - 0.5) * 30,
        });
      }
    }

    sparks = sparks.filter((p) => p.life > 0);
    for (const p of sparks) {
      p.x += p.vx; p.y += p.vy; p.life -= 0.018;
      ctx.fillStyle = `hsla(${p.hue},100%,${70 + p.life * 25}%,${p.life})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life + 0.3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  function drawStars(t) {
    ctx.clearRect(0, 0, W, H);
    if (t > nextMeteor) spawnMeteor(t);
    drawMeteors();
    for (const s of stars) {
      const par = s.depth * 0.35;
      let y = (s.y - scrollY * par) % H; if (y < 0) y += H;
      const x = (s.x + smX * s.depth * 22 + W) % W;
      const a = s.base * (0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph));
      ctx.beginPath();
      ctx.arc(x, y + smY * s.depth * 12, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${s.hue},90%,80%,${a})`;
      ctx.fill();
      if (s.depth > 0.85) {                        // alone sulle stelle più vicine
        ctx.beginPath();
        ctx.arc(x, y + smY * s.depth * 12, s.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue},90%,70%,${a * 0.08})`;
        ctx.fill();
      }
    }
  }

  /* ---------- LOOP UNICO: stelle + parallasse scroll/mouse ---------- */
  const depthEls = [...document.querySelectorAll('[data-depth]')];
  const mouseEls = [...document.querySelectorAll('[data-mouse]')];
  const heroContent = document.querySelector('.hero__content');
  const heroBlobEl = document.getElementById('heroBlob');

  function frame(t) {
    if (lenis) lenis.raf(t);
    smX += (mouseX - smX) * 0.045;
    smY += (mouseY - smY) * 0.045;
    scrollY = window.scrollY;

    drawAurora(t);
    drawStars(t);

    for (const el of depthEls) {
      const d = parseFloat(el.dataset.depth);
      el.style.transform = `translate3d(0, ${scrollY * d}px, 0)`;
    }
    for (const el of mouseEls) {
      const m = parseFloat(el.dataset.mouse);
      el.style.translate = `${smX * m}px ${smY * m * 0.7}px`;
    }

    /* hero: uscita cinematica allo scroll */
    const out = Math.min(scrollY / (window.innerHeight * 0.85), 1);
    if (heroContent) {
      heroContent.style.opacity = String(1 - out);
      heroContent.style.transform = `translateY(${out * -46}px)`;
    }
    if (heroBlobEl) {
      heroBlobEl.style.opacity = String(Math.max(0, 1 - out * 0.7));
      heroBlobEl.style.translate = '0 ' + (scrollY * 0.16).toFixed(1) + 'px';   // parallasse lenta: il blob lagga lo scroll
    }

    requestAnimationFrame(frame);
  }

  buildStars();
  window.addEventListener('resize', buildStars);
  window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / W - 0.5);
    mouseY = (e.clientY / H - 0.5);
  });
  if (!reduceMotion) requestAnimationFrame(frame);
  else {
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

  function onScroll() {
    const y = window.scrollY;
    navWrap.classList.toggle('is-hidden', y > 500 && y > lastY);
    lastY = y;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressFill.style.width = (y / max * 100) + '%';

    let current = -1;
    sections.forEach((s, i) => { if (s && y >= s.offsetTop - window.innerHeight * 0.4) current = i; });
    links.forEach((a, i) => a.classList.toggle('is-active', i === current));

    let dcur = 0;
    dotSections.forEach((s, i) => { if (s && y >= s.offsetTop - window.innerHeight * 0.45) dcur = i; });
    dotLinks.forEach((a, i) => a.classList.toggle('is-active', i === dcur));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  if (lenis) lenis.on('scroll', onScroll);
  onScroll();

  /* menu mobile */
  const burger = document.querySelector('.nav__burger');
  const nav = document.querySelector('.nav');
  burger.addEventListener('click', () => nav.classList.toggle('is-open'));
  links.forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));

  /* ---------- CARD: spotlight che segue il mouse + tilt 3D ---------- */
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', px * 100 + '%');
      card.style.setProperty('--my', py * 100 + '%');
      if (card.classList.contains('tilt') && !reduceMotion) {
        card.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 6}deg) rotateX(${(0.5 - py) * 6}deg) translateY(-3px)`;
      }
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });

  /* ---------- BOTTONI MAGNETICI ---------- */
  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      if (reduceMotion) return;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - r.left - r.width / 2;
      const dy = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
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
