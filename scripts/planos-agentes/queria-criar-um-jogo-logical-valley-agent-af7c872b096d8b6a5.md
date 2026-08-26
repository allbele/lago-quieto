# Plano — Agente E: seção 5 (céu + glints)

Plan mode ativo: nenhuma edição feita. Abaixo o conteúdo EXATO a gravar (3 arquivos). Depois: `node --check` em `ent/sky.js` e `idle/glints.js`.

## Decisões (fatos do código)
- `sky_alive` NUNCA é desbloqueado em idle (`unlocksEnabled=false`; `forceUnlock` só nos `unlock` dos gens). Sem ajuste não haveria cadente em idle → em idle "céu vivo" = `has('sky_alive') || genCount('estrelas')>=1`; nuvem na lua = `genCount('lua')>=10` (marco "nuvens"). Zen: regra atual intocada.
- `onClick` é iterado em ordem inversa de registro → `idle-glints` (registrado depois de `sky`) testa primeiro. Retornar `true` consome o clique (não lança pedra).
- Contrato do engine (agente A): `LQ.Idle.visible(id)` (-1 em zen), `LQ.Idle.lakePoint()` → `{x,y}`, `LQ.Idle.bonus(kind,{x,y,mult?,amount?})`. Tudo chamado com guardas (`typeof fn === 'function'`); fallbacks locais para `lakePoint` (mesma fórmula do anel automático) e `visible` (fórmula `vis` do plano com `LQ.IdleData.pop`).
- Lua: `scale = min(scaleCap, 1 + scaleStep*floor(log2(n+1)))`, halo `lerp(haloMin,haloMax,(scale-1)/(scaleCap-1))`; alpha do gradiente = `halo*0.6` (0.55·0.6 = 0x55/255, idêntico ao zen). Marco 25: halo puxa para `palette.gold`. `game.moonR` já alimenta o reflexo do núcleo.
- Cordilheiras: 2 primeiras geradas exatamente como hoje (mesma ordem do PRNG); extras (3ª, 4ª) entram ATRÁS, mais altas (`hMax` 0.30, 0.38·hy), menos segmentos, cor mais próxima do zênite, parallax menor. Rebuild só quando `n` ou tamanho muda.
- Reflexo da cadente: espelho em relação a `horizonY` do ponto médio do rastro (`ry = 2*hy - y`, clampado dentro da água). Só idle. Vida `bonus.shootLife` (2 s), glow `gold` na camada `light` (o `water` tem o reflexo estático; light = lighter → brilha). Clique r<30 → `bonus('shooting',{mult:25})` + anel forte.

---

## 1) `/Users/mateu/Documents/Mateus/Ideias/Jogo aleatorio/web/ent/sky.js` — conteúdo completo

```js
// Céu: estrelas, lua, nuvem, estrela cadente (+ reflexo clicável no idle), aurora, montanhas, pássaros.
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
  const hexA = a => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');

  // ---------- idle: leitura segura do motor (zen → -1 / regra atual) ----------
  const inIdle = game => game.mode === 'idle' && !!LQ.Idle;
  const POP = () => (LQ.IdleData && LQ.IdleData.pop) || {};
  const BON = () => (LQ.IdleData && LQ.IdleData.bonus) || {};
  const genN = id => (LQ.Idle && typeof LQ.Idle.genCount === 'function') ? LQ.Idle.genCount(id) : 0;
  // vis(count, base, k, cap) do plano — fallback caso o engine ainda não exponha visible()
  function visLocal(count, p){ return (!p || count <= 0) ? 0 : Math.min(p.cap, p.base + Math.floor(Math.log2(count + 1)) * p.k); }
  function vis(game, id, genId){
    if (!inIdle(game)) return -1;
    if (typeof LQ.Idle.visible === 'function'){ const v = LQ.Idle.visible(id); if (typeof v === 'number') return v; }
    return visLocal(genN(genId || id), POP()[id]);
  }
  // céu vivo: zen = unlock; idle = unlock ou 1ª estrela comprada (sky_alive nunca desbloqueia em idle)
  const skyAlive = game => game.has('sky_alive') || (inIdle(game) && genN('estrelas') >= 1);
  const skyAliveFade = game => game.has('sky_alive') ? game.unlockFade('sky_alive') : (skyAlive(game) ? 1 : 0);
  const cloudOn = game => game.has('sky_alive') || (inIdle(game) && genN('lua') >= 10);

  // ---------- estrelas ----------
  const STAR_TOTAL = 200, DYN = 12;
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
  // reflexo clicável na água (só idle): life em s, 0 = inativo
  const reflect = { x: 0, y: 0, life: 0, max: 2 };
  let prestSub = false;    // já assinou LQ.Idle.on('prestige')?

  // ---------- aurora ----------
  let auroraCv = null, auroraCtx = null, auroraAt = -1, auroraK = -1, auroraBands = 1;
  const AURORA_HZ = 15;    // repinta o offscreen a 15 Hz (o blur do upscale esconde o passo)
  let noiseCv = null;      // sprite 256x256 de ruído azul-frio (quebra o banding das faixas escaladas)
  const NOISE_T = 256;
  const OVERLAY_OK = (function(){ // 'overlay' suportado? senão cai em 'lighter'
    try { const c = document.createElement('canvas').getContext('2d'); c.globalCompositeOperation = 'overlay'; return c.globalCompositeOperation === 'overlay'; } catch (e){ return false; }
  })();

  // ---------- montanhas ----------
  const ridges = [];       // do fundo para a frente: {path, par, col}
  let mN = -1, mColVer = -1;

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
    const v = vis(game, 'estrelas');
    if (v > 0) return Math.min(STAR_TOTAL, v); // idle com estrelas compradas
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

  // escala/halo da lua pelo gerador 'lua' (zen: 1 / gradiente atual)
  function moonPop(game){
    if (!inIdle(game)) return { scale: 1, halo: -1, gold: false };
    const p = POP().lua || { scaleStep: 0.08, scaleCap: 1.6, haloMin: 0.55, haloMax: 0.9 };
    const n = genN('lua');
    const scale = Math.min(p.scaleCap, 1 + p.scaleStep * Math.floor(Math.log2(n + 1)));
    const t = p.scaleCap > 1 ? (scale - 1) / (p.scaleCap - 1) : 0;
    return { scale, halo: p.haloMin + (p.haloMax - p.haloMin) * t, gold: n >= 25 };
  }
  function buildMoon(game){
    const mp = moonPop(game);
    const R = Math.max(8, Math.round(Math.min(game.W, game.H) * 0.035 * mp.scale));
    const key = R + '|' + game.palette.light + '|' + mp.halo.toFixed(2) + '|' + (mp.gold ? 'g' : '');
    if (key === moonKey && moonCv) return R;
    moonKey = key;
    const G = R * 3;
    if (!moonCv) moonCv = document.createElement('canvas'); // reutiliza o offscreen
    moonCv.width = moonCv.height = G * 2;
    const g = moonCv.getContext('2d');
    const hc = mp.gold ? lerpHex(game.palette.light, game.palette.gold, 0.5) : game.palette.light; // marco 25: halo dourado
    const a0 = mp.halo < 0 ? '55' : hexA(mp.halo * 0.6), a1 = mp.halo < 0 ? '18' : hexA(mp.halo * 0.17);
    const grad = g.createRadialGradient(G, G, R * 0.9, G, G, G);
    grad.addColorStop(0, hc + a0);
    grad.addColorStop(0.4, hc + a1);
    grad.addColorStop(1, hc + '00');
    g.fillStyle = grad; g.fillRect(0, 0, G * 2, G * 2);
    g.fillStyle = game.palette.light;
    g.beginPath(); g.arc(G, G, R, 0, TAU); g.fill();
    // leve sombra de crateras
    g.fillStyle = game.palette.horizon; g.globalAlpha = 0.12;
    g.beginPath(); g.arc(G - R * 0.3, G - R * 0.2, R * 0.28, 0, TAU); g.fill();
    g.beginPath(); g.arc(G + R * 0.35, G + R * 0.3, R * 0.18, 0, TAU); g.fill();
    return R;
  }

  // n cordilheiras (zen 2). As 2 da frente saem idênticas ao zen; extras entram atrás, mais altas.
  function mountainCount(game){ const v = vis(game, 'montanhas', 'nevoa'); return v > 0 ? Math.max(2, Math.min(4, v)) : 2; }
  function buildMountains(game, n){
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
    ridges.length = 0;
    const back = ridge(hy * 0.22, 9, hy * 0.02), front = ridge(hy * 0.13, 14, 0);
    // extras (mais ao fundo primeiro): hMax crescente, parallax menor
    const EXTRA = [{ h: 0.30, seg: 7, yb: 0.04, par: 0.35 }, { h: 0.38, seg: 6, yb: 0.06, par: 0.25 }];
    for (let k = n - 3; k >= 0; k--){ const e = EXTRA[k]; ridges.push({ path: ridge(hy * e.h, e.seg, hy * e.yb), par: e.par, col: '#000', depth: 2 + k }); }
    ridges.push({ path: back, par: 0.5, col: '#000', depth: 1 });
    ridges.push({ path: front, par: 1, col: '#000', depth: 0 });
    mN = n; mColVer = -1;
  }
  function tintMountains(P){
    const cBack = lerpHex(P.horizon, P.zenith, 0.45);
    const cFront = lerpHex(lerpHex(P.horizon, P.zenith, 0.85), P.dark, 0.25);
    for (const m of ridges){
      if (m.depth === 0) m.col = cFront;
      else if (m.depth === 1) m.col = cBack;
      else m.col = lerpHex(cBack, P.zenith, 0.3 + 0.25 * (m.depth - 2)); // mais longe → mais perto do zênite
    }
  }

  function ensureAurora(game){
    const w = Math.max(48, Math.round(game.W / 8)), h = Math.max(32, Math.round(game.horizonY / 2)); // 1/8: mais blur de graça
    if (!auroraCv){ auroraCv = document.createElement('canvas'); auroraCtx = auroraCv.getContext('2d'); }
    if (auroraCv.width !== w || auroraCv.height !== h){ auroraCv.width = w; auroraCv.height = h; auroraAt = -1; }
  }
  // Sprite de ruído pré-gerado (64x64, azul frio, pixels aleatórios) — desenhado em tile sobre a aurora
  function ensureNoise(){
    if (noiseCv) return noiseCv;
    noiseCv = document.createElement('canvas'); noiseCv.width = noiseCv.height = NOISE_T;
    const g = noiseCv.getContext('2d'), img = g.createImageData(NOISE_T, NOISE_T), d = img.data, r = mkRand(9091);
    for (let i = 0; i < d.length; i += 4){
      const v = 120 + Math.floor(r() * 135);
      d[i] = v * 0.7; d[i + 1] = v * 0.85; d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return noiseCv;
  }
  // Ruído azul sutil por cima (alpha 0.02) — só onde há aurora, via clip retangular do destino
  function drawNoise(ctx, x, y, w, h, a){
    const n = ensureNoise();
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.globalCompositeOperation = OVERLAY_OK ? 'overlay' : 'lighter';
    ctx.globalAlpha = a;
    for (let yy = y; yy < y + h; yy += NOISE_T) for (let xx = x; xx < x + w; xx += NOISE_T) ctx.drawImage(n, xx, yy);
    ctx.restore();
  }
  // Redesenha o offscreen da aurora: 6 faixas com alpha senoidal; cada coluna é afunilada em
  // 5 rects (alpha 0.25/0.6/1/0.6/0.25) para não haver borda dura; ondas com fase/frequência
  // distintas por faixa, janela horizontal suave e faixas de baixo esmaecendo (sem 'degrau').
  // bands=2 (marco 'duas faixas' do idle): segunda cortina deslocada, mais fina e fraca, por cima.
  const TAPER = [0.25, 0.6, 1, 0.6, 0.25];
  // qualidade do upscale da aurora: 'high' até ~1600 px de largura; acima disso 'low' (custo por área)
  const auroraQuality = game => game.W > 1600 ? 'low' : 'high';
  function auroraBandCount(game){ const v = vis(game, 'aurora'); const at = (POP().aurora || {}).bands2At || 10; return (v >= 0 && genN('aurora') >= at) ? 2 : 1; }
  function paintAurora(game, k){
    ensureAurora(game);
    const bands = auroraBandCount(game);
    // throttle: só repinta quando passou 1/AURORA_HZ s (ou k mudou bastante, p.ex. no fade de entrada)
    if (auroraAt >= 0 && bands === auroraBands && game.t - auroraAt < 1 / AURORA_HZ && Math.abs(k - auroraK) < 0.02) return;
    auroraAt = game.t; auroraK = k; auroraBands = bands;
    const g = auroraCtx, w = auroraCv.width, h = auroraCv.height, t = game.t;
    g.clearRect(0, 0, w, h);
    const cols = [game.palette.auroraG, game.palette.auroraP];
    const sx = (game.W / 4) / w; // frequências em 'px de offscreen 1/4' (spec), independentes da escala real
    for (let c = 0; c < bands; c++){
      const off = c * 0.37, ph = c * 2.1, gain = c ? 0.6 : 1;
      for (let b = 0; b < 6; b++){
        g.fillStyle = cols[(b + c) % 2];
        const yb = h * (0.08 + b * 0.13 + off * 0.2), bh = h * (0.14 - c * 0.04), step = bh * 0.45;
        const fadeB = b >= 4 ? (b === 4 ? 0.7 : 0.4) : 1;
        for (let x = 0; x < w; x += 2){
          const X = x * sx;
          const a = 0.5 + 0.5 * Math.sin(X * 0.025 + t * 0.3 + b * 0.7 + ph);
          const y = yb + Math.sin(X * 0.05 * (0.6 + b * 0.15) + t * 0.2 + b * 1.9 + ph) * h * 0.12
                       + Math.sin(X * 0.013 + t * 0.07 + b + ph) * h * 0.05;
          const win = Math.pow(Math.sin(Math.PI * (x + 1) / (w + 2)), 0.6); // janela horizontal
          const base = (0.045 + 0.045 * a) * k * 0.55 * win * fadeB * gain / 1.6; // /1.6: 5 rects somam mais que 3
          for (let i = 0; i < 5; i++){
            g.globalAlpha = base * TAPER[i];
            g.fillRect(x, y + (i - 2) * step, 2, bh);
          }
        }
      }
    }
    g.globalAlpha = 1;
  }

  LQ.register('sky', {
    init(game){
      buildStars(game);
      buildMountains(game, mountainCount(game));
      lastW = game.W; lastH = game.H;
      shootTimer = 120 + game.rand() * 120;
      cloudX = -game.W * 0.2;
      reflect.life = 0;
      // prestígio (LQ.Idle.emit('prestige')): sem reflexo pendente
      if (inIdle(game) && !prestSub && typeof LQ.Idle.on === 'function'){ prestSub = true; LQ.Idle.on('prestige', () => { reflect.life = 0; }); }
      // lua já desbloqueada em sessão anterior: nasce imediatamente cheia
      if (game.has('moon')) moonRise = -MOON_RISE_T; // já cheia
      dawnDone = game.state.achievements.indexOf('until_dawn') >= 0;
    },

    onUnlock(id, game){
      if (id === 'moon' && moonRise === null) moonRise = game.t;
      if (id === 'sky_alive') shootTimer = 30 + game.rand() * 60;
    },

    onResize(game){ lastW = game.W; lastH = game.H; buildMountains(game, mountainCount(game)); starCvN = -1; },
    update(dt, game){
      if (game.W !== lastW || game.H !== lastH){ lastW = game.W; lastH = game.H; buildMountains(game, mountainCount(game)); starCvN = -1; }
      else { const n = mountainCount(game); if (n !== mN) buildMountains(game, n); }
      visibleN = starCount(game);

      // nuvem fina cruzando a lua
      if (cloudOn(game)){
        cloudX += cloudSpeed * dt;
        if (cloudX > game.W * 1.3) cloudX = -game.W * 0.3;
      }

      // estrela cadente
      if (skyAlive(game) && game.dayPhase < 0.3){
        if (!shoot.active){
          shootTimer -= dt;
          if (shootTimer <= 0){
            shootTimer = 120 + game.rand() * 120;
            shoot.active = true; shoot.age = 0;
            shoot.x = game.W * (0.1 + game.rand() * 0.8); shoot.y = game.horizonY * (0.05 + game.rand() * 0.4);
            const dir = game.rand() < 0.5 ? -1 : 1, sp = 500 + game.rand() * 300;
            shoot.vx = dir * sp; shoot.vy = sp * (0.25 + game.rand() * 0.25);
            game.audio.play('shooting', { x: shoot.x / game.W, gain: 1 });
            // idle: reflexo clicável no ponto espelhado do meio do rastro (clampado à água)
            if (inIdle(game)){
              const hy = game.horizonY, mx = shoot.x + shoot.vx * 0.2, my = shoot.y + shoot.vy * 0.2;
              reflect.x = Math.max(20, Math.min(game.W - 20, mx));
              reflect.y = Math.max(hy + 24, Math.min(game.H - 40, 2 * hy - my));
              reflect.max = BON().shootLife || 2; reflect.life = reflect.max;
            }
          }
        } else {
          shoot.age += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
          if (shoot.age > 0.4) shoot.active = false;
        }
      }
      if (reflect.life > 0){ reflect.life -= dt; if (!inIdle(game)) reflect.life = 0; }

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

    // reflexo da cadente (só idle): clique r<30 → bônus ×shootMult e consome o clique
    onClick(x, y, game){
      if (reflect.life <= 0 || !inIdle(game)) return false;
      if (Math.hypot(x - reflect.x, y - reflect.y) >= 30) return false;
      const mult = BON().shootMult || 25;
      if (typeof LQ.Idle.bonus === 'function') LQ.Idle.bonus('shooting', { x: reflect.x, y: reflect.y, mult });
      game.spawnRipple(reflect.x, reflect.y, { strength: 1, rings: 3 });
      game.audio.play('unlock', { degree: 3, gain: 0.9 });
      reflect.life = 0;
      return true;
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
        // upscale 8× de uma imagem já borrada: bilinear ('low') basta e custa ~40% menos em telas grandes
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = auroraQuality(game);
        ctx.drawImage(auroraCv, 0, 0, W, hy * 0.7);
        drawNoise(ctx, 0, 0, W, Math.ceil(hy * 0.7), 0.02 * k);
      }

      else if (layer === 'moon'){
        if (moonRise !== null && game.moonR > 0){
          const R = game.moonR, G = R * 3;
          ctx.globalAlpha = 0.55 + 0.45 * night;
          ctx.drawImage(moonCv, game.moonX - G, game.moonY - G, G * 2, G * 2);
          ctx.globalAlpha = 1;
          // nuvem fina
          if (cloudOn(game)){
            ctx.fillStyle = P.light; ctx.globalAlpha = 0.08 * (game.has('sky_alive') ? game.unlockFade('sky_alive') : 1);
            ctx.beginPath(); ctx.ellipse(cloudX, game.moonY + R * 0.3, R * 3.2, R * 0.45, 0, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cloudX + R * 1.5, game.moonY + R * 0.55, R * 2, R * 0.3, 0, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      else if (layer === 'mountains'){
        const k = game.unlockFade('fog_clear');
        if (k <= 0.01 || !ridges.length) return;
        const px = game.mouse.x < 0 ? 0 : (game.mouse.x / W - 0.5) * 2; // parallax 2 px
        ctx.globalAlpha = k;
        if (mColVer !== game.paletteVersion){ mColVer = game.paletteVersion; tintMountains(P); } // cores só mudam com a paleta
        for (const m of ridges){
          ctx.fillStyle = m.col;
          ctx.translate(px * m.par, 0); ctx.fill(m.path); ctx.translate(-px * m.par, 0);
        }
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
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = auroraQuality(game);
            ctx.drawImage(auroraCv, 0, -hy * 0.7, W, hy * 0.7);
            ctx.restore();
            drawNoise(ctx, 0, hy, W, Math.ceil(hy * 0.7), 0.01 * ka); // metade do alpha do céu
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
        // reflexo clicável da cadente (idle): glow dourado pulsando, some em shootLife
        if (reflect.life > 0){
          const f = Math.min(1, reflect.life / reflect.max * 1.5); // fade só no último terço
          const pulse = 0.8 + 0.2 * Math.sin(game.t * 9);
          const r = 22 * pulse;
          ctx.globalAlpha = 0.7 * f;
          ctx.drawImage(game.sprite.glow(P.gold, 24), reflect.x - r, reflect.y - r, r * 2, r * 2);
          ctx.globalAlpha = 0.9 * f;
          ctx.drawImage(game.sprite.glow(P.light, 6), reflect.x - 5, reflect.y - 5, 10, 10);
          ctx.globalAlpha = 1;
        }
      }
    }
  });
})();
```

## 2) `/Users/mateu/Documents/Mateus/Ideias/Jogo aleatorio/web/idle/glints.js` — novo

```js
// Lago Quieto — modo Idle: brilho dourado ('idle-glints'). A cada glintEvery s nasce um ponto
// dourado na água por glintLife s; clicar nele paga max(taxa×glintRateSec, clique×50).
// Só age em game.mode === 'idle'; some ao prestigiar.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;
  const GOLD = '#e8b04a';
  const BON = () => (LQ.IdleData && LQ.IdleData.bonus) || {};
  const inIdle = game => game.mode === 'idle' && !!LQ.Idle;

  let timer = -1, subbed = false; // -1 = ainda não sorteado
  const glint = { on: false, x: 0, y: 0, life: 0, max: 6, ring: 0 };

  function nextTimer(game){
    const e = BON().glintEvery || [60, 180];
    timer = e[0] + game.rand() * Math.max(0, e[1] - e[0]);
  }
  // ponto na água (fora da loja): usa o engine se disponível, senão fórmula equivalente
  function lakePoint(game){
    if (typeof LQ.Idle.lakePoint === 'function'){ const p = LQ.Idle.lakePoint(); if (p && Number.isFinite(p.x)) return p; }
    const el = document.getElementById('shop');
    const sw = (el && el.classList.contains('open')) ? el.offsetWidth : 0; // hud marca #shop.open
    return { x: 20 + game.rand() * Math.max(40, game.W - 40 - sw), y: game.horizonY + 20 + game.rand() * Math.max(10, game.H - game.horizonY - 60) };
  }
  function spawn(game){
    const p = lakePoint(game);
    glint.on = true; glint.x = p.x; glint.y = p.y;
    glint.max = BON().glintLife || 6; glint.life = glint.max; glint.ring = 0;
    game.spawnRipple(glint.x, glint.y, { strength: 0.4, rings: 1, silent: true });
  }
  function amount(){
    const I = LQ.Idle, sec = BON().glintRateSec || 60;
    const rate = typeof I.totalRate === 'function' ? I.totalRate() : 0;
    const cp = typeof I.clickPower === 'function' ? I.clickPower() : 1;
    return Math.max(rate * sec, cp * 50);
  }

  LQ.register('idle-glints', {
    init(game){
      glint.on = false; timer = -1;
      if (!inIdle(game)) return;
      nextTimer(game);
      // prestígio (LQ.Idle.emit('prestige')): brilho pendente some e o relógio recomeça
      if (!subbed && typeof LQ.Idle.on === 'function'){ subbed = true; LQ.Idle.on('prestige', () => { glint.on = false; nextTimer(game); }); }
    },
    update(dt, game){
      if (!inIdle(game)){ glint.on = false; return; }
      if (LQ.IdlePrestige && LQ.IdlePrestige.busy) return; // durante os sinos do prestígio nada nasce
      if (glint.on){
        glint.life -= dt; glint.ring += dt;
        if (glint.ring >= 1.2){ glint.ring = 0; game.spawnRipple(glint.x, glint.y, { strength: 0.35, rings: 1, silent: true }); } // anéis silenciosos
        if (glint.life <= 0){ glint.on = false; nextTimer(game); }
        return;
      }
      if (timer < 0) nextTimer(game);
      if (document.hidden) return; // não nasce com a aba escondida
      timer -= dt;
      if (timer <= 0) spawn(game);
    },
    // clique r<28 → bônus + anel forte + sino; consome o clique
    onClick(x, y, game){
      if (!glint.on || !inIdle(game)) return false;
      if (Math.hypot(x - glint.x, y - glint.y) >= 28) return false;
      const amt = amount();
      if (typeof LQ.Idle.bonus === 'function') LQ.Idle.bonus('glint', { x: glint.x, y: glint.y, amount: amt });
      game.spawnRipple(glint.x, glint.y, { strength: 1, rings: 3 });
      game.audio.play('unlock', { degree: 2, gain: 1 });
      glint.on = false; nextTimer(game);
      return true;
    },
    draw(layer, ctx, game){
      if (layer !== 'light' || !glint.on) return;
      const f = Math.min(1, glint.life / glint.max * 3);      // fade no último terço
      const pulse = 0.75 + 0.25 * Math.sin(game.t * 5);
      const r = 20 * pulse;
      ctx.globalAlpha = 0.75 * f;
      ctx.drawImage(game.sprite.glow(GOLD, 24), glint.x - r, glint.y - r, r * 2, r * 2);
      ctx.globalAlpha = 0.95 * f;
      ctx.drawImage(game.sprite.glow('#fff4d6', 5), glint.x - 4, glint.y - 4, 8, 8);
      ctx.globalAlpha = 1;
    }
  });
})();
```

## 3) `/Users/mateu/Documents/Mateus/Ideias/Jogo aleatorio/web/index.html`
Após `<script src="idle/hud.js"></script>` inserir:
```html
<script src="idle/glints.js"></script>
```

## Verificação pós-escrita
- `node --check web/ent/sky.js && node --check web/idle/glints.js`
- Zen (localhost:8765): 60 → mesma contagem de estrelas visível (15/35/60, STAR_TOTAL só sobe o pool), 2 cordilheiras idênticas (PRNG na mesma ordem), lua igual (key `R|light|-1.00|`, hex '55'/'18'), sem glint, sem reflexo.
- Idle: comprar estrelas → 30 estrelas e cadentes passam a nascer; cadente deixa ponto dourado na água por 2 s, clique paga ×25; lua cresce/ halo com 1/5/25; nevoa 5 → 3ª cordilheira, 25 → 4ª; aurora 10 → duas faixas; glint em 60-180 s, clique paga `max(rate×60, click×50)`; prestígio apaga glint/reflexo (assinatura `LQ.Idle.on('prestige')` feita no `init` — o engine emite por `LQ.Idle.emit`, não por `game.emit`).
- Dependência do engine: `LQ.Idle.bonus`, `LQ.Idle.lakePoint`, `LQ.Idle.visible`, `spawnRipple(opts.silent)` — tudo com guarda/fallback.
