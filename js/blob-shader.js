/* ============================================================
   BLOB — texture animata via shader WebGL (curtains.js)
   La superficie/energia del blob fluisce, pulsa e reagisce al mouse.
   Fallback: se WebGL/curtains non disponibili → resta l'immagine statica.
   ============================================================ */
(() => {
  const heroBlob = document.getElementById('heroBlob');
  const stage = document.getElementById('blobStage');
  const img = document.getElementById('blobImg');
  if (!img) return;

  // sorgente immagine (data-URI: stessa origine → niente CORS anche da file://)
  if (window.BLOB_DATA_URI) img.src = window.BLOB_DATA_URI;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.Curtains || !heroBlob || !stage) return;  // resta l'immagine
  if (window.matchMedia('(max-width: 760px)').matches) return;    // su telefono: blob statico, niente shader (GPU mobile)

  const vertexShader = `
    precision mediump float;
    attribute vec3 aVertexPosition;
    attribute vec2 aTextureCoord;
    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;
    uniform mat4 uTextureMatrix;
    varying vec2 vTextureCoord;
    void main() {
      gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
      vTextureCoord = (uTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
    }
  `;

  const fragmentShader = `
    precision highp float;
    uniform float uTime;
    uniform vec2  uMouse;
    uniform vec2  uResolution;
    uniform sampler2D uTexture;
    varying vec2 vTextureCoord;

    // --- 2D simplex noise (Ashima / Stefan Gustavson, public domain) ---
    vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                              + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x  = 2.0 * fract(p * C.www) - 1.0;
      vec3 h  = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    float fbm(vec2 p){
      float val = 0.0, amp = 0.5, freq = 1.0;
      for (int i = 0; i < 2; i++){        // 2 ottave: piu' leggero, il dettaglio fine si perde sotto al blur/glow
        val  += amp * snoise(p * freq);
        freq *= 2.0; amp *= 0.5;
      }
      return val;
    }

    void main(){
      vec2 uv0 = vTextureCoord;

      // respiro/morph leggero (niente rotazione: il disco 2D non deve "ribaltarsi")
      vec2 c = uv0 - 0.5;
      float breathe = 1.0 + 0.012 * sin(uTime * 0.5);
      float aniso   = 0.008 * sin(uTime * 0.37);
      c.x *= breathe * (1.0 + aniso);
      c.y *= breathe * (1.0 - aniso);
      vec2 uv = c + 0.5;

      // flusso fine + morph leggero
      float t = uTime * 0.16;
      vec2 flow = vec2(fbm(uv * 3.0 + vec2(0.0, t)), fbm(uv * 3.0 + vec2(t, 0.0) + 5.2));
      float tm = uTime * 0.07;
      vec2 morph = vec2(fbm(uv * 1.3 + vec2(0.0, tm) + 21.0), fbm(uv * 1.3 + vec2(tm, 0.0) + 47.0));

      // ripple sul cursore
      vec2  m = uMouse;
      float dist = distance(uv, m);
      float ripple = sin(dist * 24.0 - uTime * 4.0) * exp(-dist * 6.0);
      vec2  rippleDir = normalize(uv - m + 1e-4);

      vec2  warp = flow * 0.006 + morph * 0.012 + rippleDir * ripple * 0.006;

      // shimmer cromatico sottile (3 lookup invece di 4: verde+alpha dallo stesso tap)
      vec2 ca = warp * 0.08 + rippleDir * ripple * 0.0015;
      vec2 baseUV = uv + warp;
      vec2 ga = texture2D(uTexture, baseUV).ga;
      float r  = texture2D(uTexture, baseUV + ca).r;
      float b  = texture2D(uTexture, baseUV - ca).b;
      vec4  tex = vec4(r, ga.x, b, ga.y);

      // energia: accende il blu degli anelli e pulsa
      float blueness = clamp(tex.b - max(tex.r, tex.g) * 0.9, 0.0, 1.0);
      float sweep = sin((uv.x + uv.y) * 6.0 - uTime * 2.0 + flow.x * 3.0);
      sweep = smoothstep(0.2, 1.0, sweep);
      float pulse = 0.82 + 0.18 * sin(uTime * 1.2);
      vec3 energyColor = vec3(0.30, 0.66, 1.0);
      vec3 glow = energyColor * blueness * (0.30 + 0.6 * sweep) * pulse;
      glow += energyColor * blueness * exp(-dist * 4.0) * 0.45;
      vec3 color = tex.rgb + glow;

      // alpha: riuso quella gia' campionata (il blur CSS + la dissolvenza radiale ammorbidiscono i bordi).
      // Prima erano 4 lookup texture extra per pixel solo per sfumare l'alpha: tolti = molta meno banda GPU.
      float aSoft = tex.a;

      // soft-fade ai margini del piano
      float edge = smoothstep(0.0, 0.03, uv0.x) * smoothstep(1.0, 0.97, uv0.x)
                 * smoothstep(0.0, 0.03, uv0.y) * smoothstep(1.0, 0.97, uv0.y);
      // dissolvenza radiale ellittica: il disco svanisce nello spazio (anelli esterni senza fine netta)
      vec2 rc = (uv0 - 0.5) * vec2(1.0, 1.5);
      float radial = smoothstep(0.60, 0.34, length(rc));
      gl_FragColor = vec4(color, aSoft * edge * radial);
    }
  `;

  let curtains;
  try {
    curtains = new window.Curtains({
      container: heroBlob,
      alpha: true,
      premultipliedAlpha: false,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.0),    // blob enorme + sfocato: 1.0 basta (meno frammenti = molta meno GPU)
      watchScroll: false,   // il canvas è nel flusso pagina: niente doppio scroll
    });
  } catch (e) { return; }                       // niente WebGL → resta l'immagine

  curtains.onError(() => heroBlob.classList.remove('is-shaded'))
          .onContextLost(() => { try { curtains.restoreContext(); } catch (e) {} });

  const plane = new window.Plane(curtains, stage, {
    vertexShader, fragmentShader,
    uniforms: {
      uTime:       { name: 'uTime',       type: '1f', value: 0 },
      uMouse:      { name: 'uMouse',      type: '2f', value: [0.5, 0.5] },
      uResolution: { name: 'uResolution', type: '2f', value: [1, 1] },
    },
  });

  if (!plane) return;

  // mouse → UV normalizzate (0..1, y verso l'alto), smussato
  let tmx = 0.5, tmy = 0.55, cmx = 0.5, cmy = 0.55, tPrev = 0;
  window.addEventListener('pointermove', (e) => {
    const r = plane.getBoundingRect();
    tmx = (e.clientX - r.left) / r.width;
    tmy = 1.0 - (e.clientY - r.top) / r.height;
  }, { passive: true });

  // UN SOLO onRender: avanza il tempo (deformazione dinamica) + smussa il mouse
  plane
    .onReady(() => {
      heroBlob.classList.add('is-shaded');
      const r = plane.getBoundingRect();
      plane.uniforms.uResolution.value = [r.width, r.height];
      curtains.disableDrawing();                   // da qui i frame li guidiamo noi a fps cappati (vedi sotto)
    })
    .onRender(() => {
      const now = performance.now();
      const dt = tPrev ? Math.min((now - tPrev) / 1000, 0.05) : 1 / 60;
      tPrev = now;
      plane.uniforms.uTime.value += dt;            // dt reale: la velocita' del morph non dipende dagli fps
      cmx += (tmx - cmx) * 0.08;
      cmy += (tmy - cmy) * 0.08;
      plane.uniforms.uMouse.value = [cmx, cmy];
    });

  // FPS CAP: lo shader e' la cosa piu' pesante. Invece del refresh nativo (su 144Hz = 144 frame/s),
  // guidiamo noi i frame a ~40fps con needRender(), e SOLO quando la hero e' a schermo e il tab e' attivo.
  // (curtains.disableDrawing() viene chiamato in onReady)
  const BLOB_MS = 1000 / 40;
  let heroVisible = true, tabVisible = true, blobRaf = 0, blobLast = 0;
  function blobLoop(t) {
    blobRaf = requestAnimationFrame(blobLoop);
    if (t - blobLast < BLOB_MS) return;
    blobLast = t;
    try { curtains.needRender(); } catch (e) {}
  }
  function syncBlob() {
    const run = heroVisible && tabVisible;
    if (run && !blobRaf) { blobLast = 0; tPrev = 0; blobRaf = requestAnimationFrame(blobLoop); }
    else if (!run && blobRaf) { cancelAnimationFrame(blobRaf); blobRaf = 0; }
  }
  const heroEl = document.getElementById('home') || heroBlob;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { heroVisible = entries[0].isIntersecting; syncBlob(); },
      { rootMargin: '120px' }).observe(heroEl);
  }
  document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; syncBlob(); });
  syncBlob();
})();
