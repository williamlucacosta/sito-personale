/* ============================================================
   LUCA COSTA — JOURNEY: viaggio warp 3D (Three.js)
   Scroll = la camera vola in avanti tra le stelle; ogni sezione
   e' una "tappa" con un asset 3D a tema che da' profondita'.
   Si integra dietro ai contenuti, lasciando intatti hero e sfondo 2D.
   ============================================================ */
(() => {
  const canvas = document.getElementById('journey');
  if (!canvas || !window.THREE) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return; }                       // niente WebGL -> il sito resta com'e'
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0x000000, 0);          // trasparente: l'aurora/nebula 2D resta visibile sotto

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 3200);

  const COL = {
    cyan:   new THREE.Color('#5ff3ff'),
    blue:   new THREE.Color('#4f7dff'),
    violet: new THREE.Color('#8b5cf6'),
    pale:   new THREE.Color('#cdd8ff'),
    white:  new THREE.Color('#ffffff'),
  };

  /* ---------- viaggio: mappa scroll -> profondita' z ---------- */
  const TRAVEL = 1700;                           // unita' z percorse sull'intera pagina
  let maxScroll = 1;
  function recalcMax() { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); }
  const zForScroll = (s) => -(s / maxScroll) * TRAVEL;

  /* ---------- STARFIELD profondo (riciclato = tunnel infinito) ---------- */
  const SPREAD_X = 1100, SPREAD_Y = 720, DEPTH = 2100;
  const STAR_COUNT = reduce ? 700 : Math.min(4200, Math.floor(innerWidth * innerHeight / 540));
  const sPos = new Float32Array(STAR_COUNT * 3);
  const sCol = new Float32Array(STAR_COUNT * 3);
  const sSize = new Float32Array(STAR_COUNT);
  const starPalette = [COL.white, COL.pale, COL.pale, COL.blue, COL.cyan, COL.violet];
  for (let i = 0; i < STAR_COUNT; i++) {
    sPos[i*3]   = (Math.random() - 0.5) * SPREAD_X * 2;
    sPos[i*3+1] = (Math.random() - 0.5) * SPREAD_Y * 2;
    sPos[i*3+2] = -Math.random() * DEPTH;
    const c = starPalette[(Math.random() * starPalette.length) | 0];
    const tw = 0.55 + Math.random() * 0.45;
    sCol[i*3] = c.r * tw; sCol[i*3+1] = c.g * tw; sCol[i*3+2] = c.b * tw;
    sSize[i] = 1.1 + Math.random() * 3.2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));

  // texture circolare morbida per i punti
  function discTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }
  const disc = discTexture();

  // shader points: dimensione attenuata con la distanza + streak warp via uStretch
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: disc }, uStretch: { value: 0 }, uPix: { value: renderer.getPixelRatio() } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float size; attribute vec3 color; varying vec3 vColor; varying float vA;
      uniform float uPix;
      void main(){
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        float dist = -mv.z;
        vA = clamp(1.0 - dist/2100.0, 0.0, 1.0);        // fade in lontananza
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPix * (300.0/max(dist,1.0));
      }`,
    fragmentShader: `
      uniform sampler2D uTex; varying vec3 vColor; varying float vA;
      void main(){
        float a = texture2D(uTex, gl_PointCoord).a;
        gl_FragColor = vec4(vColor, a * vA);
      }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  /* ---------- NEBULA: sprite morbidi additivi a varie profondita' ---------- */
  function nebulaTexture(hex) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, hex + 'cc'); g.addColorStop(0.4, hex + '40'); g.addColorStop(1, hex + '00');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); return t;
  }
  const nebTex = { b: nebulaTexture('#2747cf'), v: nebulaTexture('#7b3df0'), c: nebulaTexture('#1f8bd6') };
  const nebula = [];
  const nebDefs = reduce ? [] : [
    ['b', -250, 380], ['v', -520, 520], ['c', -900, 300],
    ['v', -1200, 600], ['b', -1500, 460], ['c', -1900, 540],
  ];
  for (const [k, z, r] of nebDefs) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebTex[k], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
    m.position.set((Math.random() - 0.5) * 900, (Math.random() - 0.5) * 600, z);
    m.scale.set(r * 2.4, r * 2.4, 1);
    scene.add(m); nebula.push(m);
  }

  /* ---------- WAYPOINTS 3D a tema (uno per sezione) ---------- */
  function wire(geo, color, opacity) {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity ?? 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo), m);
  }
  function glowPoints(positions, color, size) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: disc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  }

  // builder per sezione -> Group (ruota/respira nell'animate)
  const builders = {
    about() {                                   // nucleo identita': icosaedri annidati + anello
      const g = new THREE.Group();
      g.add(wire(new THREE.IcosahedronGeometry(46, 1), COL.cyan, 0.9));
      const inner = wire(new THREE.IcosahedronGeometry(26, 0), COL.violet, 0.8); g.add(inner);
      const ring = wire(new THREE.TorusGeometry(70, 1.2, 8, 64), COL.blue, 0.55);
      ring.rotation.x = Math.PI / 2.3; g.add(ring);
      g.userData.spin = inner; return g;
    },
    skills() {                                  // nodi orbitanti attorno a un core
      const g = new THREE.Group();
      g.add(wire(new THREE.OctahedronGeometry(20, 0), COL.cyan, 0.9));
      const orbit = new THREE.Group(); const N = 10; const pts = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2, R = 64 + (i % 3) * 16;
        const node = wire(new THREE.OctahedronGeometry(7 + (i % 3) * 2, 0), i % 2 ? COL.violet : COL.blue, 0.9);
        node.position.set(Math.cos(a) * R, Math.sin(a * 1.3) * 22, Math.sin(a) * R);
        orbit.add(node); pts.push(node.position.x, node.position.y, node.position.z);
      }
      g.add(orbit); g.add(glowPoints(pts, COL.cyan, 4));
      g.userData.spin = orbit; return g;
    },
    progetti() {                                // monoliti fluttuanti in formazione
      const g = new THREE.Group();
      const defs = [[-70, 10, 0], [0, -14, -36], [74, 18, -10], [30, 30, 40], [-40, -28, 30]];
      defs.forEach((p, i) => {
        const b = wire(new THREE.BoxGeometry(26, 44, 26), i % 2 ? COL.cyan : COL.blue, 0.85);
        b.position.set(p[0], p[1], p[2]); b.rotation.y = i; g.add(b);
      });
      g.userData.spin = g; return g;
    },
    esperienza() {                              // elica-timeline di tappe
      const g = new THREE.Group(); const pts = []; const turns = 3, steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = t * Math.PI * 2 * turns;
        pts.push(Math.cos(a) * 40, (t - 0.5) * 150, Math.sin(a) * 40);
      }
      const line = new THREE.BufferGeometry();
      line.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      g.add(new THREE.Line(line, new THREE.LineBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })));
      for (let k = 0; k <= 3; k++) {
        const t = k / 3, a = t * Math.PI * 2 * turns;
        const dot = wire(new THREE.OctahedronGeometry(9, 0), k === 0 ? COL.cyan : k === 3 ? COL.violet : COL.blue, 0.95);
        dot.position.set(Math.cos(a) * 40, (t - 0.5) * 150, Math.sin(a) * 40); g.add(dot);
      }
      g.userData.spin = g; return g;
    },
    contatti() {                                // portale finale
      const g = new THREE.Group();
      const ring = wire(new THREE.TorusGeometry(60, 2, 10, 80), COL.cyan, 0.9); g.add(ring);
      const ring2 = wire(new THREE.TorusGeometry(40, 1.2, 8, 64), COL.violet, 0.7); ring2.rotation.x = 0.5; g.add(ring2);
      g.userData.spin = ring2; return g;
    },
  };

  const waypoints = [];
  function buildWaypoints() {
   try {
    for (const w of waypoints) scene.remove(w.obj);
    waypoints.length = 0;
    recalcMax();
    const offsets = { about: -95, skills: 105, progetti: -90, esperienza: 110, contatti: 0 };
    for (const id of ['about', 'skills', 'progetti', 'esperienza', 'contatti']) {
      const el = document.getElementById(id);
      const b = builders[id];
      if (!el || !b) continue;
      const obj = b();
      // culmine quando la sezione e' centrata nella viewport
      const peakScroll = el.offsetTop + el.offsetHeight / 2 - innerHeight / 2;
      const peakFrac = THREE.MathUtils.clamp(peakScroll / maxScroll, 0.05, 0.96);
      const zc = -peakFrac * TRAVEL - 140;          // 140 = distanza di visione al culmine (con cam +60 -> ahead~200)
      obj.position.set(offsets[id] ?? 0, 22, zc);
      obj.userData.zc = zc;
      obj.scale.setScalar(0.001);
      scene.add(obj); waypoints.push({ obj, id });
    }
   } catch (e) { /* niente waypoint: il viaggio resta comunque */ }
  }

  /* ---------- input: scroll + mouse ---------- */
  let scrollY = window.scrollY, smScroll = scrollY, vel = 0, warp = 0;
  let mx = 0, my = 0, smx = 0, smy = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', (e) => {
    mx = (e.clientX / innerWidth - 0.5);
    my = (e.clientY / innerHeight - 0.5);
  }, { passive: true });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    starMat.uniforms.uPix.value = renderer.getPixelRatio();
    buildWaypoints();
  }
  window.addEventListener('resize', resize);

  /* ---------- loop ---------- */
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) tick(0); });

  const sp = starGeo.attributes.position.array;
  let last = 0;
  function tick(t) {
    if (!running) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;

    // scroll fluido + velocita' -> warp
    const prev = smScroll;
    smScroll += (scrollY - smScroll) * 0.12;
    vel = (smScroll - prev);
    warp += (Math.min(Math.abs(vel) / 26, 1) - warp) * 0.1;
    starMat.uniforms.uStretch.value = warp;

    // camera: avanza nel campo + parallasse mouse + leggero sway
    smx += (mx - smx) * 0.04; smy += (my - smy) * 0.04;
    const camZ = -(smScroll / maxScroll) * TRAVEL;
    camera.position.set(smx * 60, -smy * 40 + Math.sin(t * 0.0002) * 6, camZ + 60);
    camera.lookAt(smx * 18, -smy * 12, camZ - 200);
    camera.rotation.z = smx * 0.04;

    // riciclo stelle attorno alla camera (tunnel infinito) + extra spinta in warp
    const front = camera.position.z - DEPTH, back = camera.position.z + 80;
    for (let i = 0; i < STAR_COUNT; i++) {
      const zi = i * 3 + 2;
      if (reduce) break;
      sp[zi] += vel * 0.9 + warp * 6;            // le stelle scorrono verso di te
      if (sp[zi] > back) { sp[zi] -= DEPTH; sp[i*3] = (Math.random()-0.5)*SPREAD_X*2; sp[i*3+1] = (Math.random()-0.5)*SPREAD_Y*2; }
      else if (sp[zi] < front) { sp[zi] += DEPTH; }
    }
    starGeo.attributes.position.needsUpdate = true;

    // waypoints: scala/fade in base alla vicinanza della camera
    for (const w of waypoints) {
      const o = w.obj;
      const ahead = camera.position.z - o.userData.zc;       // >0 davanti, <0 superato
      const k = THREE.MathUtils.clamp(1 - Math.abs(ahead - 200) / 320, 0, 1);  // picco a ~200 di distanza
      const s = 0.3 + k * 0.82;
      o.scale.setScalar(s);
      o.traverse((c) => { if (c.material && c.material.opacity !== undefined) c.material.opacity = (c.material.userData?.base ?? 0.85) * (0.15 + k * 0.95); });
      const spin = o.userData.spin; if (spin && !reduce) { spin.rotation.y += dt * 0.4; spin.rotation.x += dt * 0.12; }
      o.rotation.y += dt * 0.05;
      o.visible = k > 0.01;
    }

    renderer.render(scene, camera);
  }

  // memorizza opacita' base per il fade dei waypoint
  function cacheBaseOpacity() {
    for (const w of waypoints) w.obj.traverse((c) => { if (c.material && c.material.opacity !== undefined) c.material.userData = { base: c.material.opacity }; });
  }

  function start() {
    recalcMax(); resize(); cacheBaseOpacity();
    if (reduce) { renderer.render(scene, camera); }
    else requestAnimationFrame(tick);
  }
  // attende layout completo (font/immagini) per offset corretti
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
  // ricalcolo dopo che tutto si assesta
  setTimeout(() => { recalcMax(); buildWaypoints(); cacheBaseOpacity(); }, 1200);
})();
