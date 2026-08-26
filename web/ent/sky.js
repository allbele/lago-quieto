// Céu: estrelas, lua, nuvem, estrela cadente, aurora, montanhas, pássaros do amanhecer.
(function(){
  'use strict';
  const LQ = window.LQ;
  const TAU = Math.PI * 2;

  // PRNG local com semente fixa (formas estáveis entre resizes)
  function mkRand(seed){ let s = seed | 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function hexToRgb(h){ const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lerpHex(a, b, t){
    const A = hexToRgb(a), B = hexToRgb(b);
    return '#' + [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t))).toString(16).padStart(2, '0')).join('');
  }

  // ---------- estrelas ----------
  const STAR_TOTAL = 60, DYN = 12;
  const stars = [];        // {nx, ny, size, phase, speed}
  let starCv = null, starCvN = -1, starCvW = 0, starCvH = 0, starCvVer = -1;
  let visibleN = 15;
  let lastW = 0, lastH = 0;

  // ---------- lua ----------
  let moonCv = null, moonKey = '';
  let moonRise = null;     // game.t em que começou a nascer (null = ainda não)
  const MOON_RISE_T = 90;
  let cloudX = -1, cloudSpeed = 8;

  // ---------- estrela cadente ----------
  let shootTimer = 0;
  const shoot = { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0 };

  // ---------- aurora ----------
  let auroraCv = null, auroraCtx = null;

  // ---------- montanhas ----------
  let mBack = null, mFront = null;
  let mColVer = -1, mColBack = '#000', mColFront = '#000';

  // ---------- pássaros ----------
  const birds = [];        // {x, y, vx, phase}
  let prevPhase = -1, dawnDone = false;


  function buildStars(game){
    stars.length = 0;
    const r = mkRand(7331);
    for (let i = 0; i < STAR_TOTAL; i++){
      stars.push({ nx: r(), ny: Math.pow(r(), 0.8), size: r() < 0.25 ? 2 : 1, phase: r() * TAU, speed: 0.6 + r() * 1.6, a: 0.35 + r() * 0.5 });
    }
  }
  function starCount(game){
    return Math.round(15 + 20 * game.unlockFade('stars2') + 25 * game.unlockFade('sky_alive'));
  }
  // Bakea as estrelas assentadas (todas menos as DYN dinâmicas) num offscreen
  function bakeStars(game, n){
    const W = game.W, hy = game.horizonY;
    if (!starCv) starCv = document.createElement('canvas');
    starCv.width = W; starCv.height = hy;
    const g = starCv.getContext('2d');
    g.fillStyle = game.palette.light;
    const settled = Math.max(0, n - DYN);
    for (let i = 0; i < settled; i++){
      const s = stars[i];
      g.globalAlpha = s.a * 0.8;
      g.fillRect(Math.round(s.nx * W), Math.round(s.ny * hy), s.size, s.size);
    }
    starCvN = n; starCvW = W; starCvH = hy; starCvVer = game.paletteVersion;
  }

  function buildMoon(game){
    const R = Math.max(8, Math.round(Math.min(game.W, game.H) * 0.035));
    const key = R + '|' + game.palette.light;
    if (key === moonKey && moonCv) return R;
    moonKey = key;
    const G = R * 3;
    if (!moonCv) moonCv = document.createElement('canvas'); // reutiliza o offscreen
    moonCv.width = moonCv.height = G * 2;
    const g = moonCv.getContext('2d');
    const grad = g.createRadialGradient(G, G, R * 0.9, G, G, G);
    grad.addColorStop(0, game.palette.light + '55');
    grad.addColorStop(0.4, game.palette.light + '18');
    grad.addColorStop(1, game.palette.light + '00');
    g.fillStyle = grad; g.fillRect(0, 0, G * 2, G * 2);
    g.fillStyle = game.palette.light;
    g.beginPath(); g.arc(G, G, R, 0, TAU); g.fill();
    // leve sombra de crateras
    g.fillStyle = game.palette.horizon; g.globalAlpha = 0.12;
    g.beginPath(); g.arc(G - R * 0.3, G - R * 0.2, R * 0.28, 0, TAU); g.fill();
    g.beginPath(); g.arc(G + R * 0.35, G + R * 0.3, R * 0.18, 0, TAU); g.fill();
    return R;
  }

  function buildMountains(game){
    const W = game.W, hy = game.horizonY;
    const r = mkRand(4242);
    function ridge(hMax, seg, yBase){
      const p = new Path2D();
      p.moveTo(-10, hy + 4);
      p.lineTo(-10, hy - yBase);
      let x = -10;
      const step = W / seg;
      for (let i = 0; i <= seg + 1; i++){
        const h = hMax * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + r() * 0.8)) * (0.6 + 0.4 * r()));
        x = -10 + i * step;
        p.lineTo(x, hy - yBase - h);
      }
      p.lineTo(W + 10, hy - yBase);
      p.lineTo(W + 10, hy + 4);
      p.closePath();
      return p;
    }
    mBack = ridge(hy * 0.22, 9, hy * 0.02);
    mFront = ridge(hy * 0.13, 14, 0);
  }

  function ensureAurora(game){
    const w = Math.max(48, Math.round(game.W / 8)), h = Math.max(32, Math.round(game.horizonY / 2)); // 1/8: mais blur de graça
    if (!auroraCv){ auroraCv = document.createElement('canvas'); auroraCtx = auroraCv.getContext('2d'); }
    if (auroraCv.width !== w || auroraCv.height !== h){ auroraCv.width = w; auroraCv.height = h; }
  }
  // Redesenha o offscreen da aurora: 6 faixas com alpha senoidal, bordas verticais suaves
  // (3 retângulos empilhados por coluna), ondas com fase/frequência distintas por faixa, janela
  // horizontal suave (não vai de borda a borda) e faixas de baixo esmaecendo (sem 'degrau').
  function paintAurora(game, k){
    ensureAurora(game);
    const g = auroraCtx, w = auroraCv.width, h = auroraCv.height, t = game.t;
    g.clearRect(0, 0, w, h);
    const cols = [game.palette.auroraG, game.palette.auroraP];
    const sx = (game.W / 4) / w; // frequências em 'px de offscreen 1/4' (spec), independentes da escala real
    for (let b = 0; b < 6; b++){
      g.fillStyle = cols[b % 2];
      const yb = h * (0.08 + b * 0.13), bh = h * 0.14;
      const fadeB = b >= 4 ? (b === 4 ? 0.7 : 0.4) : 1;
      for (let x = 0; x < w; x += 2){
        const X = x * sx;
        const a = 0.5 + 0.5 * Math.sin(X * 0.025 + t * 0.3 + b * 0.7);
        const y = yb + Math.sin(X * 0.05 * (0.6 + b * 0.15) + t * 0.2 + b * 1.9) * h * 0.12
                     + Math.sin(X * 0.013 + t * 0.07 + b) * h * 0.05;
        const win = Math.pow(Math.sin(Math.PI * (x + 1) / (w + 2)), 0.6); // janela horizontal
        const base = (0.045 + 0.045 * a) * k * 0.55 * win * fadeB;
        g.globalAlpha = base * 0.35; g.fillRect(x, y - bh * 0.6, 2, bh);
        g.globalAlpha = base;        g.fillRect(x, y, 2, bh);
        g.globalAlpha = base * 0.35; g.fillRect(x, y + bh * 0.6, 2, bh);
      }
    }
    g.globalAlpha = 1;
  }

  LQ.register('sky', {
    init(game){
      buildStars(game);
      buildMountains(game);
      lastW = game.W; lastH = game.H;
      shootTimer = 120 + game.rand() * 120;
      cloudX = -game.W * 0.2;
      // lua já desbloqueada em sessão anterior: nasce imediatamente cheia
      if (game.has('moon')) moonRise = -MOON_RISE_T; // já cheia
      dawnDone = game.state.achievements.indexOf('until_dawn') >= 0;
    },

    onUnlock(id, game){
      if (id === 'moon' && moonRise === null) moonRise = game.t;
      if (id === 'sky_alive') shootTimer = 30 + game.rand() * 60;
    },

    onResize(game){ lastW = game.W; lastH = game.H; buildMountains(game); starCvN = -1; },
    update(dt, game){
      if (game.W !== lastW || game.H !== lastH){ lastW = game.W; lastH = game.H; buildMountains(game); starCvN = -1; }
      visibleN = starCount(game);

      // nuvem fina cruzando a lua
      if (game.has('sky_alive')){
        cloudX += cloudSpeed * dt;
        if (cloudX > game.W * 1.3) cloudX = -game.W * 0.3;
      }

      // estrela cadente
      if (game.has('sky_alive') && game.dayPhase < 0.3){
        if (!shoot.active){
          shootTimer -= dt;
          if (shootTimer <= 0){
            shootTimer = 120 + game.rand() * 120;
            shoot.active = true; shoot.age = 0;
            shoot.x = game.W * (0.1 + game.rand() * 0.8); shoot.y = game.horizonY * (0.05 + game.rand() * 0.4);
            const dir = game.rand() < 0.5 ? -1 : 1, sp = 500 + game.rand() * 300;
            shoot.vx = dir * sp; shoot.vy = sp * (0.25 + game.rand() * 0.25);
            game.audio.play('shooting', { x: shoot.x / game.W, gain: 1 });
          }
        } else {
          shoot.age += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
          if (shoot.age > 0.4) shoot.active = false;
        }
      }

      // lua
      if (moonRise !== null){
        const R = buildMoon(game);
        const k = game.ease.smoothstep((game.t - moonRise) / MOON_RISE_T);
        game.moonR = R;
        game.moonX = game.W * 0.78;
        game.moonY = game.horizonY + R * 1.5 - k * (game.horizonY + R * 1.5 - game.horizonY * 0.32);
        if (k >= 1 && moonRise >= 0) game.achievement('full_moon'); // só se nasceu nesta sessão
      } else game.moonR = 0;

      // amanhecer: pássaros ao começar a clarear; achievement no dia pleno
      if (game.has('dawn')){
        const ph = game.dayPhase;
        if (prevPhase >= 0 && prevPhase < 0.15 && ph >= 0.15 && ph > prevPhase){
          birds.length = 0;
          const dir = game.rand() < 0.5 ? 1 : -1;
          for (let i = 0; i < 3; i++){
            birds.push({ x: dir > 0 ? -40 - i * 30 : game.W + 40 + i * 30, y: game.horizonY * (0.3 + i * 0.07 + game.rand() * 0.05), vx: dir * (35 + game.rand() * 10), phase: game.rand() * TAU });
          }
          game.audio.play('birds', { x: dir > 0 ? 0.1 : 0.9, gain: 1 });
        }
        if (ph >= 0.99 && !dawnDone){ dawnDone = true; game.achievement('until_dawn'); }
        prevPhase = ph;
      }
      for (let i = birds.length - 1; i >= 0; i--){
        const b = birds[i]; b.x += b.vx * dt; b.phase += dt * 6;
        if (b.x < -80 || b.x > game.W + 80) birds.splice(i, 1);
      }
    },

    draw(layer, ctx, game){
      const W = game.W, hy = game.horizonY, P = game.palette;
      const night = 1 - game.dayPhase; // estrelas somem de dia

      if (layer === 'sky'){
        if (starCvN !== visibleN || starCvW !== W || starCvH !== hy || starCvVer !== game.paletteVersion) bakeStars(game, visibleN);
        if (night > 0.02){
          ctx.globalAlpha = night;
          ctx.drawImage(starCv, 0, 0);
          // estrelas dinâmicas (piscam mais com o vento)
          const wind = 0.5 + 0.5 * game.unlockFade('wind');
          ctx.fillStyle = P.light;
          const from = Math.max(0, visibleN - DYN);
          for (let i = from; i < visibleN; i++){
            const s = stars[i];
            const tw = 0.5 + 0.5 * Math.sin(game.t * s.speed + s.phase);
            ctx.globalAlpha = night * s.a * (1 - wind * 0.7 + wind * 0.7 * tw);
            ctx.fillRect(Math.round(s.nx * W), Math.round(s.ny * hy), s.size, s.size);
          }
          ctx.globalAlpha = 1;
        }
        // pássaros do amanhecer (3 chevrons)
        if (birds.length){
          ctx.strokeStyle = P.dark; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6;
          for (const b of birds){
            const f = 3 + 2 * Math.sin(b.phase);
            ctx.beginPath(); ctx.moveTo(b.x - 6, b.y - f); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + 6, b.y - f); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      else if (layer === 'aurora'){
        const k = game.unlockFade('aurora') * night;
        if (k <= 0.01) return;
        paintAurora(game, k);
        ctx.drawImage(auroraCv, 0, 0, W, hy * 0.7);
      }

      else if (layer === 'moon'){
        if (moonRise !== null && game.moonR > 0){
          const R = game.moonR, G = R * 3;
          ctx.globalAlpha = 0.55 + 0.45 * night;
          ctx.drawImage(moonCv, game.moonX - G, game.moonY - G, G * 2, G * 2);
          ctx.globalAlpha = 1;
          // nuvem fina
          if (game.has('sky_alive')){
            ctx.fillStyle = P.light; ctx.globalAlpha = 0.08 * game.unlockFade('sky_alive');
            ctx.beginPath(); ctx.ellipse(cloudX, game.moonY + R * 0.3, R * 3.2, R * 0.45, 0, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cloudX + R * 1.5, game.moonY + R * 0.55, R * 2, R * 0.3, 0, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      else if (layer === 'mountains'){
        const k = game.unlockFade('fog_clear');
        if (k <= 0.01 || !mBack) return;
        const px = game.mouse.x < 0 ? 0 : (game.mouse.x / W - 0.5) * 2; // parallax 2 px
        ctx.globalAlpha = k;
        if (mColVer !== game.paletteVersion){ // cores só mudam com a paleta
          mColVer = game.paletteVersion;
          mColBack = lerpHex(P.horizon, P.zenith, 0.45);
          mColFront = lerpHex(lerpHex(P.horizon, P.zenith, 0.85), P.dark, 0.25);
        }
        ctx.fillStyle = mColBack;
        ctx.translate(px * 0.5, 0); ctx.fill(mBack); ctx.translate(-px * 0.5, 0);
        ctx.fillStyle = mColFront;
        ctx.translate(px, 0); ctx.fill(mFront); ctx.translate(-px, 0);
        ctx.globalAlpha = 1;
      }

      else if (layer === 'water'){
        // reflexo espelhado das estrelas perto do horizonte (alpha 0.35)
        if (night > 0.02 && starCv){
          const sh = Math.round(hy * 0.4);
          ctx.globalAlpha = 0.35 * night;
          ctx.save(); ctx.translate(0, hy); ctx.scale(1, -1);
          ctx.drawImage(starCv, 0, hy - sh, W, sh, 0, -sh, W, sh);
          ctx.restore();
          // aurora refletida
          const ka = game.eco ? 0 : game.unlockFade('aurora') * night;
          if (ka > 0.01 && auroraCv){
            ctx.globalAlpha = 0.15 * night;
            ctx.save(); ctx.translate(0, hy); ctx.scale(1, -1);
            ctx.drawImage(auroraCv, 0, -hy * 0.7, W, hy * 0.7);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }
      }

      else if (layer === 'light'){
        if (shoot.active){
          const f = 1 - shoot.age / 0.4;
          ctx.strokeStyle = P.light; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7 * f;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 0.12, shoot.y - shoot.vy * 0.12); ctx.stroke();
          const sp = game.sprite.glow(P.light, 10);
          ctx.globalAlpha = 0.6 * f;
          ctx.drawImage(sp, shoot.x - 10, shoot.y - 10, 20, 20);
          ctx.globalAlpha = 1;
        }
      }
    }
  });
})();
