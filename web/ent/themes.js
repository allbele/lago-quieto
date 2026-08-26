// Temas (§8): paletas, partículas próprias e filtro de áudio. Também checa os achievements (§8).
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;

  // ---------- Paletas (mesmas chaves de game.palette; núcleo lerpa night→day) ----------
  const T = LQ.themes = LQ.themes || {};
  T.night = {}; // padrão do núcleo
  T.winter = {
    night: { zenith: '#04060c', horizon: '#0a1220', shore: '#0c1a2a', ring: '#8fb3c9',
      light: '#eaf3ff', firefly: '#ffb347', gold: '#f0c060', dark: '#0a1a18',
      auroraG: '#9fd8e6', auroraP: '#8a8ad0', dawn: '#d8dde8', fog: '#ffffff' },
    day:   { zenith: '#6f87a8', horizon: '#c9d6e6', shore: '#4a6a86', ring: '#cfe3f0',
      light: '#ffffff', firefly: '#ffb347', gold: '#f0c060', dark: '#1d2f36',
      auroraG: '#9fd8e6', auroraP: '#8a8ad0', dawn: '#e8e0e8', fog: '#ffffff' }
  };
  T.autumn = {
    night: { zenith: '#0c0810', horizon: '#2a1a14', shore: '#3a2416', ring: '#a86a3c',
      light: '#ffe6c4', firefly: '#ffd27a', gold: '#f0a030', dark: '#1a120a',
      auroraG: '#c98a4a', auroraP: '#8a4a5c', dawn: '#f2a882', fog: '#f5e2c8' },
    day:   { zenith: '#6a7aa0', horizon: '#d8b090', shore: '#7a5a3a', ring: '#d8a070',
      light: '#fff4e0', firefly: '#ffd27a', gold: '#f0a030', dark: '#2a1e10',
      auroraG: '#c98a4a', auroraP: '#8a4a5c', dawn: '#f2b8a2', fog: '#f5e2c8' }
  };
  T.ink = {
    night: { zenith: '#f4f1ea', horizon: '#e6e2d8', shore: '#d8d3c6', ring: '#1a1a1a',
      light: '#5a5650', firefly: '#8a8478', gold: '#3a3a3a', dark: '#141414',
      auroraG: '#c8c4bc', auroraP: '#bdb8b0', dawn: '#e0dcd4', fog: '#f4f1ea' },
    day:   { zenith: '#faf8f2', horizon: '#eeeae0', shore: '#e0dbd0', ring: '#1a1a1a',
      light: '#5a5650', firefly: '#8a8478', gold: '#3a3a3a', dark: '#141414',
      auroraG: '#d0ccc4', auroraP: '#c8c4bc', dawn: '#e6e2d8', fog: '#faf8f2' }
  };
  T.tropical = {
    night: { zenith: '#03101c', horizon: '#064a5c', shore: '#0a8a8a', ring: '#5ff0ff',
      light: '#eafcff', firefly: '#b8ff7a', gold: '#ffc34a', dark: '#062a22',
      auroraG: '#3fe0c0', auroraP: '#5a7ad8', dawn: '#ffb08a', fog: '#d8ffff' },
    day:   { zenith: '#3a9ad0', horizon: '#9fe0f0', shore: '#20b0b8', ring: '#a0ffff',
      light: '#ffffff', firefly: '#b8ff7a', gold: '#ffc34a', dark: '#0a3a2a',
      auroraG: '#3fe0c0', auroraP: '#5a7ad8', dawn: '#ffc8a8', fog: '#e8ffff' }
  };
  LQ.themeList = ['night', 'winter', 'autumn', 'ink', 'tropical'];

  // ---------- Pools de partículas ----------
  const SNOW_MAX = 90, LEAF_MAX = 28, STROKE_MAX = 40, BIO_MAX = 120;
  const snow = [], leaves = [], strokes = [], bio = [];
  for (let i = 0; i < SNOW_MAX; i++) snow.push({ x: 0, y: 0, vx: 0, vy: 0, r: 1, ph: 0, a: 0 });
  for (let i = 0; i < LEAF_MAX; i++) leaves.push({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, w: 6, h: 3, ph: 0, water: false, bob: 0, c: 0, alive: false });
  for (let i = 0; i < STROKE_MAX; i++) strokes.push({ active: false, x: 0, y: 0, age: 0, seed: 0 });
  for (let i = 0; i < BIO_MAX; i++) bio.push({ active: false, x: 0, y: 0, ang: 0, age: 0, life: 1, rad: 0 });
  let strokeCur = 0, bioCur = 0, leafTimer = 0;
  const LEAF_COLORS = ['#b8452a', '#d0642e', '#a83a2a', '#c8863a', '#8a2e22'];

  let theme = 'night', ready = false;
  let themeAt = -1e9; // game.t da última troca: entidades do tema entram em fade (§3, "nunca pop")
  function themeFade(game){ return game.ease.smoothstep((game.t - themeAt) / 5); }

  function cap(n, game){ return game.eco ? Math.floor(n * 0.5) : n; }

  // ---------- Neve (inverno) ----------
  function resetFlake(f, game, top){
    f.x = game.rand() * (game.W + 40) - 20;
    f.y = top ? -4 : game.rand() * game.H;
    f.vy = 14 + game.rand() * 26; f.vx = 0;
    f.r = 0.8 + game.rand() * 1.4; f.ph = game.rand() * 6.28;
    f.a = 0.35 + game.rand() * 0.45;
  }
  function updateSnow(dt, game){
    const n = cap(SNOW_MAX, game), wind = game.has('wind') ? 8 : 3;
    for (let i = 0; i < n; i++){
      const f = snow[i];
      f.ph += dt; f.y += f.vy * dt; f.x += (Math.sin(f.ph * 1.3) * 6 + wind) * dt;
      if (f.y > game.H + 4 || f.x > game.W + 30) resetFlake(f, game, true);
    }
  }
  function drawSnow(ctx, game){
    const n = cap(SNOW_MAX, game);
    ctx.fillStyle = game.palette.light;
    const tf = themeFade(game);
    for (let i = 0; i < n; i++){
      const f = snow[i];
      // flocos sobre a água ficam mais fracos (quase derretendo)
      ctx.globalAlpha = (f.y > game.horizonY ? f.a * 0.5 : f.a) * tf;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    ctx.globalAlpha = 1;
  }
  // gelo fino nas bordas: 2 polígonos claros junto à margem
  function drawIce(ctx, game){
    const W = game.W, H = game.H, tf = themeFade(game);
    ctx.fillStyle = game.palette.light;
    ctx.globalAlpha = 0.07 * tf;
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H - 70); ctx.quadraticCurveTo(W * 0.12, H - 55, W * 0.22, H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W, H - 55); ctx.quadraticCurveTo(W * 0.9, H - 40, W * 0.8, H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.12 * tf;
    ctx.beginPath(); ctx.moveTo(0, H - 70); ctx.quadraticCurveTo(W * 0.12, H - 55, W * 0.22, H); ctx.lineWidth = 1; ctx.strokeStyle = game.palette.light; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W, H - 55); ctx.quadraticCurveTo(W * 0.9, H - 40, W * 0.8, H); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------- Folhas (outono) ----------
  function spawnLeaf(game, onWater){
    let l = null;
    for (let i = 0; i < LEAF_MAX; i++) if (!leaves[i].alive){ l = leaves[i]; break; }
    if (!l) return;
    l.alive = true; l.x = game.rand() * game.W;
    l.y = onWater ? game.horizonY + 10 + game.rand() * (game.H - game.horizonY - 20) : -6;
    l.water = onWater; l.vx = 0; l.vy = onWater ? 0 : 18 + game.rand() * 20;
    l.rot = game.rand() * 6.28; l.vr = (game.rand() - 0.5) * 2;
    l.w = 5 + game.rand() * 4; l.h = l.w * 0.5; l.ph = game.rand() * 6.28; l.bob = 0;
    l.c = Math.floor(game.rand() * LEAF_COLORS.length);
  }
  function updateLeaves(dt, game){
    leafTimer -= dt;
    const target = cap(LEAF_MAX, game);
    if (leafTimer <= 0){ leafTimer = 2 + game.rand() * 4; let alive = 0; for (const l of leaves) if (l.alive) alive++; if (alive < target) spawnLeaf(game, false); }
    const wind = game.has('wind') ? 10 : 4;
    for (const l of leaves){
      if (!l.alive) continue;
      l.ph += dt;
      if (!l.water){
        l.y += l.vy * dt; l.x += (Math.sin(l.ph * 1.1) * 14 + wind) * dt; l.rot += l.vr * dt;
        // toca a água: passa a flutuar (anel fraquinho, sem som)
        if (l.y > game.horizonY + 8 + (l.x / game.W) * (game.H - game.horizonY) * 0.9){
          l.water = true; l.vy = 0; l.vr *= 0.2;
          game.spawnRipple(l.x, l.y, { strength: 0.3, rings: 1 });
        }
      } else {
        l.vx *= (1 - 1.5 * dt); l.vy *= (1 - 1.5 * dt);
        l.x += (l.vx + Math.sin(l.ph * 0.4) * 3 + wind * 0.15) * dt; l.y += l.vy * dt;
        l.rot += l.vr * dt; l.bob *= (1 - 2.5 * dt);
        if (l.x > game.W + 20 || l.x < -20 || l.y > game.H + 10 || l.y < game.horizonY) l.alive = false;
      }
    }
  }
  function drawLeaves(ctx, game){
    const tf = themeFade(game);
    for (const l of leaves){
      if (!l.alive) continue;
      const y = l.y + (l.water ? Math.sin(l.ph * 5) * l.bob : 0);
      ctx.fillStyle = LEAF_COLORS[l.c];
      ctx.globalAlpha = (l.water ? 0.8 : 0.9) * tf;
      ctx.save(); ctx.translate(l.x, y); ctx.rotate(l.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, l.w, l.water ? l.h * 0.55 : l.h, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function pushLeaves(x, y, game){
    for (const l of leaves){
      if (!l.alive || !l.water) continue;
      const dx = l.x - x, dy = (l.y - y) / 0.35, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 160 || d < 1) continue;
      const k = (1 - d / 160) * 40;
      l.vx += dx / d * k; l.vy += dy / d * k * 0.35; l.vr += (game.rand() - 0.5) * 1.5; l.bob = 2.5 * (1 - d / 160);
    }
  }

  // ---------- Pinceladas (tinta) ----------
  function addStroke(x, y, game){
    const s = strokes[strokeCur]; strokeCur = (strokeCur + 1) % STROKE_MAX;
    s.active = true; s.x = x; s.y = y; s.age = 0; s.seed = game.rand() * 100;
  }
  function updateStrokes(dt){
    for (const s of strokes){ if (!s.active) continue; s.age += dt; if (s.age > 1.8) s.active = false; }
  }
  // anel como pincelada: segmentos com lineWidth variável e falhas (pincel seco)
  function drawStrokes(ctx, game){
    ctx.strokeStyle = game.palette.ring; ctx.lineCap = 'round';
    const SEG = 14;
    for (const s of strokes){
      if (!s.active) continue;
      const f = 1 - s.age / 1.8, rad = s.age * 60;
      if (rad < 2) continue;
      const alpha = 0.85 * f * f;
      if (alpha < 0.02) continue;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < SEG; i++){
        const a0 = i / SEG * Math.PI * 2, a1 = (i + 1) / SEG * Math.PI * 2;
        const wv = Math.sin(a0 * 3 + s.seed) * 0.5 + 0.5;
        if (wv < 0.18 && s.age > 0.5) continue; // falha de tinta
        ctx.lineWidth = (0.6 + wv * 3.2) * (0.5 + 0.5 * f);
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, rad, rad * 0.35, 0, a0, a1);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.lineCap = 'butt';
  }

  // ---------- Bioluminescência (tropical) ----------
  function addBio(x, y, game){
    const n = cap(14, game);
    for (let k = 0; k < n; k++){
      const b = bio[bioCur]; bioCur = (bioCur + 1) % BIO_MAX;
      b.active = true; b.x = x; b.y = y; b.ang = game.rand() * Math.PI * 2;
      b.age = 0; b.life = 0.9 + game.rand() * 1.1; b.rad = 0.4 + game.rand() * 0.6;
    }
  }
  function updateBio(dt){
    for (const b of bio){ if (!b.active) continue; b.age += dt; if (b.age > b.life) b.active = false; }
  }
  function drawBio(ctx, game){
    const sp = game.sprite.glow('#3fd8ff', 10);
    for (const b of bio){
      if (!b.active) continue;
      const k = b.age / b.life, r = b.age * 60 * b.rad;
      const x = b.x + Math.cos(b.ang) * r, y = b.y + Math.sin(b.ang) * r * 0.35;
      ctx.globalAlpha = 0.55 * Math.sin(Math.PI * k) * (k < 1 ? 1 : 0);
      const sz = 8 + 10 * k;
      ctx.drawImage(sp, x - sz, y - sz, sz * 2, sz * 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Achievements (§8) não cobertos pelo núcleo ----------
  // Núcleo já dá: first_stone, woke_someone, clear_view, aurora, just_watching, accidental_melody, left_light_on, thousand_ripples.
  // golden_fish/night_bloom: ent/fish.js e ent/lilies.js; full_moon/until_dawn: ent/sky.js.

  // ---------- Troca de tema ----------
  function applyTheme(name, game){
    theme = LQ.themeList.indexOf(name) >= 0 ? name : 'night';
    themeAt = ready ? game.t : -1e9; // no init entra pronto; troca em jogo faz fade de 5 s
    game.lightBlend = theme === 'ink' ? 'multiply' : 'lighter'; // glows em papel claro: escurecem em vez de lavar
    game.audio.setTheme(theme);
    game.hideCoreRipples = theme === 'ink'; // tinta: pinceladas substituem os anéis do núcleo
    document.body.classList.remove('theme-night', 'theme-winter', 'theme-autumn', 'theme-ink', 'theme-tropical');
    document.body.classList.add('theme-' + theme);
    // ícones da UI acompanham a tinta (tema claro)
    document.documentElement.style.setProperty('--ico', theme === 'ink' ? '#1a1a1a' : '#e9f2ff');
    if (theme === 'winter') for (let i = 0; i < SNOW_MAX; i++) resetFlake(snow[i], game, false);
    if (theme === 'autumn'){ for (const l of leaves) l.alive = false; for (let i = 0; i < 8; i++) spawnLeaf(game, true); }
    for (const s of strokes) s.active = false;
    for (const b of bio) b.active = false;
  }

  LQ.register('themes', {
    init(game){
      applyTheme(game.state.theme, game);
      ready = true;
    },
    onTheme(name, game){ applyTheme(name, game); },
    update(dt, game){
      if (!ready) return;
      if (game.state.theme !== theme) applyTheme(game.state.theme, game);
      if (theme === 'winter') updateSnow(dt, game);
      else if (theme === 'autumn') updateLeaves(dt, game);
      else if (theme === 'ink') updateStrokes(dt);
      else if (theme === 'tropical') updateBio(dt);
    },
    onRipple(x, y, game){
      if (theme === 'autumn') pushLeaves(x, y, game);
      else if (theme === 'ink') addStroke(x, y, game);
      else if (theme === 'tropical') addBio(x, y, game);
    },
    draw(layer, ctx, game){
      if (theme === 'winter'){
        if (layer === 'lilies') drawIce(ctx, game);
        else if (layer === 'fog') drawSnow(ctx, game);
      } else if (theme === 'autumn'){
        if (layer === 'lilies') drawLeaves(ctx, game);
      } else if (theme === 'ink'){
        if (layer === 'ripples') drawStrokes(ctx, game);
      } else if (theme === 'tropical'){
        if (layer === 'light') drawBio(ctx, game); // eco: metade das partículas (cap)
      }
    }
  });
})();
