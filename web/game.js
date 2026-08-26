// Lago Quieto — núcleo (estado, unlocks, cena, anéis, gotas, input, UI, loop).
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;

  // ---------- Registro de entidades ----------
  const ents = [];
  LQ.register = function(name, def){
    const i = ents.findIndex(e => e.name === name);
    const e = { name, def };
    if (i >= 0) ents[i] = e; else ents.push(e);
  };
  function call(hook, a, b, c){
    for (let i = 0; i < ents.length; i++){
      const f = ents[i].def[hook];
      if (f) f.call(ents[i].def, a, b, c);
    }
  }
  // Hash determinístico barato (0..1) por índice inteiro — jitter estável entre frames
  function hash(i){
    let h = (i | 0) * 2654435761; h ^= h >>> 15; h = (h * 2246822519) | 0; h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  // ---------- Utilidades ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    smoothstep: t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); },
    easeInQuad: t => t * t,
    easeOutQuad: t => 1 - (1 - t) * (1 - t)
  };
  function hexToRgb(h){
    const n = parseInt(h.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgbToHex(r){
    return '#' + r.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function lerpHex(a, b, t){
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
  }
  // PRNG simples e determinístico (semente por sessão)
  let seed = (Date.now() & 0xffff) | 1;
  function rand(){ seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // ---------- Paletas ----------
  const NIGHT = {
    zenith: '#050914', horizon: '#0b1a33', shore: '#123a5c', ring: '#1f5f7a',
    light: '#e9f2ff', firefly: '#d8f27a', gold: '#e8b04a', dark: '#0d2a1f',
    auroraG: '#7ad3c9', auroraP: '#8a6bc9', dawn: '#f2b8a2', fog: '#ffffff'
  };
  const DAY = {
    zenith: '#4a6f9a', horizon: '#9fb9d6', shore: '#3f7a96', ring: '#5f9fb8',
    light: '#f8fbff', firefly: '#d8f27a', gold: '#e8b04a', dark: '#1a3a2c',
    auroraG: '#7ad3c9', auroraP: '#8a6bc9', dawn: '#f2b8a2', fog: '#ffffff'
  };
  LQ.themes = LQ.themes || {}; // ent/themes.js pode preencher: nome → sobrescritas de paleta
  const THEME_LIST = ['night', 'winter', 'autumn', 'ink', 'tropical'];

  // ---------- Tabela de desbloqueios (§3) ----------
  const UNLOCKS = [
    { id: 'fireflies',  time: 45,    ripples: 8,    fade: 5, icon: 'firefly',  ach: 'woke_someone' },
    { id: 'wind',       time: 90,    ripples: 20,   fade: 6 },
    { id: 'fish',       time: 150,   ripples: 30,   fade: 5, icon: 'fish' },
    { id: 'stars2',     time: 180,   ripples: 40,   fade: 8 },
    { id: 'moon',       time: 360,   ripples: 70,   fade: 8, icon: 'moon' },
    { id: 'fireflies2', time: 600,   ripples: 120,  fade: 6 },
    { id: 'fish2',      time: 900,   ripples: 180,  fade: 6, icon: 'goldfish' },
    { id: 'fog_clear',  time: 1200,  ripples: 250,  fade: 8, icon: 'mountain', ach: 'clear_view' },
    { id: 'lilies',     time: 1800,  ripples: 350,  fade: 6, icon: 'lily' },
    { id: 'sky_alive',  time: 2700,  ripples: 500,  fade: 8, icon: 'shooting' },
    { id: 'frog',       time: 3600,  ripples: 700,  fade: 6, icon: 'frog' },
    { id: 'aurora',     time: 7200,  ripples: 1200, fade: 8, icon: 'aurora',   ach: 'aurora' },
    { id: 'dawn',       time: 14400, ripples: Infinity, fade: 8, icon: 'bird' }
  ];
  const fadeStart = {};   // id → game.t em que o fade começou
  let pending = [];       // fila de desbloqueios (cascata)
  let cascadeTimer = 0, cascadeDegree = 0;

  // ---------- Estado salvo (§7) ----------
  // Modo: 'zen' (save 'lagoquieto', intacto) | 'idle' (save 'lagoquieto.idle')
  const MODE_KEY = 'lagoquieto.mode';
  const SAVE_KEYS = { zen: 'lagoquieto', idle: 'lagoquieto.idle' };
  let SAVE_KEY = SAVE_KEYS.zen;
  const OFFLINE_CAP = 8 * 3600;
  function readMode(){
    let m = null;
    try { m = localStorage.getItem(MODE_KEY); } catch (e) {}
    return m === 'zen' || m === 'idle' ? m : null;
  }
  function writeMode(m){ try { localStorage.setItem(MODE_KEY, m); } catch (e) {} }
  function fresh(){
    return { v: 1, ripples: 0, totalTime: 0, lastSeen: 0, unlocked: [],
      liliesBloomed: 0, theme: 'night', muted: false, eco: false,
      achievements: [], stats: { longestIdle: 0, asc: 0 }, dawnAt: -1 };
  }
  function migrate(s){
    if (!s || typeof s !== 'object' || Array.isArray(s)) return fresh();
    const f = fresh();
    for (const k in f) if (s[k] === undefined) s[k] = f[k];
    // coage tipos (save corrompido nunca vira string/NaN)
    s.ripples = Math.max(0, Math.floor(Number(s.ripples) || 0));
    s.totalTime = Math.max(0, Number(s.totalTime) || 0);
    s.lastSeen = Math.max(0, Number(s.lastSeen) || 0);
    s.liliesBloomed = Math.max(0, Math.floor(Number(s.liliesBloomed) || 0));
    s.dawnAt = Number.isFinite(+s.dawnAt) ? +s.dawnAt : -1;
    s.muted = s.muted === true; s.eco = s.eco === true;
    if (!s.stats || typeof s.stats !== 'object') s.stats = f.stats;
    s.stats.longestIdle = Number(s.stats.longestIdle) || 0;
    s.stats.asc = Number(s.stats.asc) || 0;
    const ids = UNLOCKS.map(u => u.id);
    s.unlocked = Array.isArray(s.unlocked) ? s.unlocked.filter(x => ids.indexOf(x) >= 0) : [];
    s.achievements = Array.isArray(s.achievements) ? s.achievements.filter(x => typeof x === 'string' && /^[a-z_]{1,32}$/.test(x)) : [];
    if (THEME_LIST.indexOf(s.theme) < 0) s.theme = 'night';
    // s.idle: sub-estado do modo idle; o núcleo só preserva (idle/state.js migra por dentro)
    if (s.idle !== undefined && (!s.idle || typeof s.idle !== 'object' || Array.isArray(s.idle))) delete s.idle;
    s.v = 1;
    return s;
  }
  function load(){
    let raw = null;
    try { raw = LQ.Platform && LQ.Platform.loadCloud ? LQ.Platform.loadCloud(SAVE_KEY) : localStorage.getItem(SAVE_KEY); } catch (e) {}
    try { return migrate(raw ? JSON.parse(raw) : null); } catch (e) { return fresh(); }
  }
  let resetting = false;
  function save(){
    if (resetting) return;
    const s = game.state;
    // aba oculta: credita a ausência até agora (sem contar duas vezes)
    if (hiddenAt){ s.totalTime += Math.min((Date.now() - hiddenAt) / 1000, OFFLINE_CAP); hiddenAt = Date.now(); }
    s.lastSeen = Date.now();
    const json = JSON.stringify(s);
    if (LQ.Platform && LQ.Platform.saveCloud) LQ.Platform.saveCloud(json, SAVE_KEY);
    else try { localStorage.setItem(SAVE_KEY, json); } catch (e) {}
  }

  // ---------- Objeto game (API para entidades) ----------
  const audioStub = {
    init(){}, play(){}, setMuted(){}, setTheme(){}, voicesActive(){ return 0; },
    ambient: { start(){}, stop(){}, set(){} }
  };
  const game = {
    W: 1, H: 1, horizonY: 1, t: 0, dpr: 1,
    state: null, calm: 0, palette: Object.assign({}, NIGHT), eco: false,
    mouse: { x: -1, y: -1, idleFor: 0, overWater: false },
    moonX: 0, moonY: 0, moonR: 0, // ent/sky.js preenche
    dayPhase: 0, dawnPink: 0,
    paletteVersion: 0,          // incrementa a cada mudança de game.palette
    lilyCount: 0,               // ent/lilies.js preenche
    lightBlend: 'lighter',      // ent/themes.js troca para 'multiply' em tema claro
    rand, ease, hash,
    mode: 'zen',                // 'zen' | 'idle' (LQ.start define)
    unlocksEnabled: true,       // idle: false → checkUnlocks não roda por tempo/anéis
    setPaletteOverride(obj){ paletteOverride = obj || null; },
    // Evento genérico → hook 'on'+Nome nas entidades (ex.: emit('impact',p) → onImpact(p, game))
    emit(name, payload){ call('on' + name.charAt(0).toUpperCase() + name.slice(1), payload, this); },
    // Força um desbloqueio (entra na fila/cascata como os naturais)
    forceUnlock(id){
      if (!UNLOCKS.some(u => u.id === id)) return false;
      if (this.state.unlocked.indexOf(id) >= 0 || pending.indexOf(id) >= 0) return false;
      pending.push(id); return true;
    },
    has(id){ return this.state.unlocked.indexOf(id) >= 0; },
    unlockFade(id){
      if (!this.has(id)) return 0;
      const u = UNLOCKS.find(x => x.id === id);
      const s = fadeStart[id];
      if (s === undefined) return 1;
      return ease.smoothstep((this.t - s) / (u ? u.fade : 6));
    },
    spawnRipple, spawnDrops,
    sprite: { glow: glowSprite },
    audio: audioStub, platform: null,
    achievement(id){
      const s = this.state;
      if (s.achievements.indexOf(id) >= 0) return;
      s.achievements.push(id);
      if (this.platform && this.platform.achievement) this.platform.achievement(id);
    },
    sinceClick: 20, // começa em modo ambiente (§3, fase 0)
    noteGain(){ return this.calm > 14 ? 0.5 : 1; }
  };
  LQ.game = game;

  // ---------- Sprites de glow cacheados ----------
  const glowCache = {};
  function glowSprite(color, radius){
    const key = color + '|' + radius;
    let c = glowCache[key];
    if (c) return c;
    const r = Math.max(2, Math.ceil(radius));
    c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color + 'aa');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    glowCache[key] = c;
    return c;
  }

  // ---------- Cena: canvas e offscreens ----------
  let canvas, ctx, skyCv, waterCv, fogCv, started = false;
  let paletteDirty = true, palTimer = 0;

  function resize(){
    game.eco = !!game.state.eco;
    const dpr = clamp(window.devicePixelRatio || 1, 1, game.eco ? 1 : 1.5);
    game.dpr = dpr;
    game.W = window.innerWidth; game.H = window.innerHeight;
    game.horizonY = Math.round(game.H * 0.40);
    canvas.width = Math.round(game.W * dpr); canvas.height = Math.round(game.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paletteDirty = true;
    for (const k in glowCache) delete glowCache[k];
    if (started) call('onResize', game);
  }

  function rebuildOffscreens(){
    const P = game.palette, W = game.W, H = game.H, hy = game.horizonY;
    if (!skyCv){ skyCv = document.createElement('canvas'); waterCv = document.createElement('canvas'); fogCv = document.createElement('canvas'); }
    // Céu: gradiente vertical zênite → horizonte (+ rosa do amanhecer)
    skyCv.width = W; skyCv.height = hy;
    let g = skyCv.getContext('2d');
    let grad = g.createLinearGradient(0, 0, 0, hy);
    grad.addColorStop(0, P.zenith);
    grad.addColorStop(0.7, lerpHex(P.zenith, P.horizon, 0.7));
    grad.addColorStop(1, lerpHex(P.horizon, P.dawn, game.dawnPink * 0.5));
    g.fillStyle = grad; g.fillRect(0, 0, W, hy);
    // Água: horizonte (profundo) → margem
    waterCv.width = W; waterCv.height = H - hy;
    g = waterCv.getContext('2d');
    grad = g.createLinearGradient(0, 0, 0, H - hy);
    grad.addColorStop(0, lerpHex(P.horizon, P.dawn, game.dawnPink * 0.25));
    grad.addColorStop(0.35, P.horizon);
    grad.addColorStop(1, P.shore);
    g.fillStyle = grad; g.fillRect(0, 0, W, H - hy);
    // Névoa baixa: faixa com gradiente cacheado (ent/fog.js anima alpha/offset)
    fogCv.width = W + 40; fogCv.height = Math.round(H * 0.22);
    g = fogCv.getContext('2d');
    grad = g.createLinearGradient(0, 0, 0, fogCv.height);
    grad.addColorStop(0, P.fog + '00');
    grad.addColorStop(0.5, P.fog + '70'); // pico suave: névoa fina, não faixa
    grad.addColorStop(1, P.fog + '00');
    g.fillStyle = grad; g.fillRect(0, 0, fogCv.width, fogCv.height);
    game.fogSprite = fogCv;
    paletteDirty = false;
  }

  // Paleta-alvo: tema + fase do dia; lerp a cada 500 ms
  function targetPalette(){
    const th = LQ.themes[game.state.theme] || {};
    const base = Object.assign({}, NIGHT, th.night || th);
    const day = Object.assign({}, DAY, th.day || {});
    const out = {};
    for (const k in base) out[k] = lerpHex(base[k], day[k], game.dayPhase);
    // lua nascida: 10% mais azul/clara (§3 #5)
    const mk = game.unlockFade('moon') * 0.10;
    if (mk > 0){
      out.zenith = lerpHex(out.zenith, '#0b1a33', mk);
      out.horizon = lerpHex(out.horizon, out.light, mk * 0.5);
      out.shore = lerpHex(out.shore, out.light, mk * 0.5);
    }
    if (game.dawnPink > 0) out.horizon = lerpHex(out.horizon, out.dawn, game.dawnPink * 0.4);
    if (paletteOverride) for (const k in paletteOverride) if (out[k] !== undefined) out[k] = paletteOverride[k];
    return out;
  }
  function updateDayCycle(){
    const s = game.state;
    if (!game.has('dawn')){ game.dayPhase = 0; game.dawnPink = 0; return; }
    let ph;
    const since = s.totalTime - s.dawnAt; // primeiro ciclo: 30 min sobe, 30 min dia, 30 min desce
    if (s.dawnAt >= 0 && since < 5400){
      ph = since < 1800 ? since / 1800 : since < 3600 ? 1 : 1 - (since - 3600) / 1800;
    } else {
      const h = new Date().getHours() + new Date().getMinutes() / 60; // relógio real
      ph = h < 5 ? 0 : h < 7 ? (h - 5) / 2 : h < 17 ? 1 : h < 20 ? 1 - (h - 17) / 3 : 0;
    }
    ph = ease.smoothstep(ph);
    game.dayPhase = ph;
    game.dawnPink = Math.sin(Math.PI * ph); // rosa só nas transições
  }
  let paletteOverride = null; // game.setPaletteOverride({chave:'#hex'}|null): aplicado ao alvo
  function stepPalette(){
    const T = targetPalette();
    let changed = false;
    for (const k in T){
      const cur = game.palette[k] || T[k];
      const A = hexToRgb(cur), B = hexToRgb(T[k]);
      // snap final: perto do alvo salta direto (o lerp arredondado nunca converge)
      const near = Math.abs(A[0] - B[0]) <= 2 && Math.abs(A[1] - B[1]) <= 2 && Math.abs(A[2] - B[2]) <= 2;
      const nv = near ? T[k] : lerpHex(cur, T[k], 0.25);
      if (nv !== game.palette[k]){ game.palette[k] = nv; changed = true; }
    }
    if (changed){
      paletteDirty = true; game.paletteVersion++;
      for (const k in glowCache) delete glowCache[k]; // sprites dependem da cor; evita cache crescer
    }
  }

  // ---------- Anéis (pool 40) ----------
  const RIPPLE_MAX = 40, RING_LIFE = 1.8, RING_SPEED = 60;
  const ripples = [];
  for (let i = 0; i < RIPPLE_MAX; i++) ripples.push({ active: false, x: 0, y: 0, age: 0, strength: 1, rings: 3 });
  let rippleCursor = 0;
  function spawnRipple(x, y, opts){
    opts = opts || {};
    // recicla o mais antigo se o pool estiver cheio
    let r = null;
    for (let i = 0; i < RIPPLE_MAX; i++){ const c = ripples[(rippleCursor + i) % RIPPLE_MAX]; if (!c.active){ r = c; break; } }
    if (!r){ r = ripples[rippleCursor]; }
    rippleCursor = (rippleCursor + 1) % RIPPLE_MAX;
    r.active = true; r.x = x; r.y = y; r.age = 0;
    r.strength = opts.strength !== undefined ? opts.strength : 1;
    r.rings = clamp(Math.round(opts.rings !== undefined ? opts.rings : (r.strength < 0.5 ? 1 : r.strength < 0.8 ? 2 : 3)) || 1, 1, 3);
    activeRipples++;
    call('onRipple', x, y, game);
    return r;
  }
  const RING_DELAY = [0, 0.12, 0.24], RING_A0 = [1, 0.6, 0.35];
  let activeRipples = 0;
  function updateRipples(dt){
    activeRipples = 0;
    for (let i = 0; i < RIPPLE_MAX; i++){
      const r = ripples[i]; if (!r.active) continue;
      r.age += dt;
      if (r.age > RING_LIFE + RING_DELAY[r.rings - 1]) r.active = false; else activeRipples++;
    }
  }
  function drawRipples(){
    if (game.hideCoreRipples) return; // tema substitui os anéis (ex.: pinceladas da tinta)
    ctx.strokeStyle = game.palette.ring; ctx.lineWidth = 1.5;
    for (let i = 0; i < RIPPLE_MAX; i++){
      const r = ripples[i]; if (!r.active) continue;
      for (let k = 0; k < r.rings; k++){
        const a = r.age - RING_DELAY[k]; if (a <= 0 || a >= RING_LIFE) continue;
        const f = 1 - a / RING_LIFE;
        const alpha = RING_A0[k] * f * f * (0.5 + 0.5 * r.strength);
        if (alpha < 0.01) continue;
        const rad = a * RING_SPEED * (0.6 + 0.4 * r.strength);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  // Deslocamento x da água num ponto por causa dos anéis (usado no reflexo da lua)
  function rippleOffset(px, py){
    let off = 0;
    if (!activeRipples) return 0;
    for (let i = 0; i < RIPPLE_MAX; i++){
      const r = ripples[i]; if (!r.active) continue;
      const dx = px - r.x, dy = (py - r.y) / 0.35;
      const front = r.age * RING_SPEED, lim = front + 30;
      const d2 = dx * dx + dy * dy;
      if (d2 > lim * lim) continue; // sai antes do sqrt
      const d = Math.sqrt(d2);
      const life = 1 - r.age / (RING_LIFE + 0.24);
      off += Math.sin(d * 0.3 - r.age * 6) * 3 * r.strength * life;
    }
    return off;
  }
  game.rippleOffset = rippleOffset;

  // ---------- Gotas (pool 60) ----------
  const DROP_MAX = 60, drops = [];
  for (let i = 0; i < DROP_MAX; i++) drops.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, color: null });
  let dropCursor = 0;
  function spawnDrops(x, y, n, color){
    for (let k = 0; k < n; k++){
      const d = drops[dropCursor]; dropCursor = (dropCursor + 1) % DROP_MAX;
      d.color = color || null;
      const ang = rand() * Math.PI * 2, sp = 40 + rand() * 50;
      d.active = true; d.x = x; d.y = y; d.age = 0;
      d.vx = Math.cos(ang) * sp * 0.6; d.vy = -Math.abs(Math.sin(ang)) * sp - 30;
    }
  }
  function updateDrops(dt){
    for (let i = 0; i < DROP_MAX; i++){
      const d = drops[i]; if (!d.active) continue;
      d.age += dt; if (d.age >= 0.5){ d.active = false; continue; }
      d.vy += 300 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    }
  }
  function drawDrops(){
    ctx.fillStyle = game.palette.light;
    for (let i = 0; i < DROP_MAX; i++){
      const d = drops[i]; if (!d.active) continue;
      ctx.fillStyle = d.color || game.palette.light;
      ctx.globalAlpha = (1 - d.age / 0.5) * 0.9;
      ctx.fillRect(d.x - 1, d.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Pedras caindo e brilhos do céu ----------
  const stones = [], glows = [];
  const STONE_T = 0.25;
  function throwStone(x, y){
    stones.push({ x, y, age: 0 });
  }
  let lastNoteAt = -1, ascRun = 0, lastDegree = -1;
  function impact(x, y){
    const s = game.state;
    spawnRipple(x, y, { strength: 1, rings: 3 });
    spawnDrops(x, y, 3 + Math.floor(rand() * 4));
    s.ripples++;
    game.calm = Math.min(20, game.calm + 1);
    game.emit('impact', { x, y, strength: 1, source: 'stone' });
    // Áudio: plop + nota (x → nota, y → oitava); nota só se >80 ms desde a anterior
    const nx = clamp(x / game.W, 0, 1), ny = clamp((y - game.horizonY) / (game.H - game.horizonY), 0, 1);
    // gain é relativo (1 = valor de projeto do §6; audio.js aplica os absolutos)
    game.audio.play('plop', { x: nx, y: ny, gain: 1 });
    const now = performance.now();
    if (now - lastNoteAt >= 80){
      game.audio.play('note', { x: nx, y: ny, gain: game.noteGain() });
      lastNoteAt = now;
      const deg = Math.min(4, Math.floor(nx * 5)); // "Melodia Acidental": 5 notas ascendentes
      ascRun = deg > lastDegree ? ascRun + 1 : 1; lastDegree = deg;
      if (ascRun >= 5) game.achievement('accidental_melody');
    }
    if (s.ripples === 1) game.achievement('first_stone');
    if (s.ripples >= 1000) game.achievement('thousand_ripples');
  }
  function updateStones(dt){
    for (let i = stones.length - 1; i >= 0; i--){
      const st = stones[i]; st.age += dt;
      if (st.age >= STONE_T){
        stones.splice(i, 1);
        if (st.dew){
          // gota de orvalho: anel menor, sem contar ripple
          spawnRipple(st.x, st.y, { strength: 0.55, rings: 2 });
          spawnDrops(st.x, st.y, 2);
          game.audio.play('dew', { x: st.x / game.W, y: 0.5, gain: 1 });
        } else impact(st.x, st.y);
      }
    }
    for (let i = glows.length - 1; i >= 0; i--){ glows[i].age += dt; if (glows[i].age >= 0.3) glows.splice(i, 1); }
  }
  function drawStones(){
    ctx.fillStyle = game.palette.light;
    for (const st of stones){
      const k = ease.easeInQuad(st.age / STONE_T);
      // pedra: arco leve; orvalho: cai reto da altura do junco
      const h = st.dew ? st.fallH : 40;
      const y = st.y - h * (1 - k), x = st.x - (st.dew ? 0 : 8) * (1 - k);
      ctx.globalAlpha = st.dew ? 0.6 : 0.9;
      ctx.beginPath(); ctx.arc(x, y, st.dew ? 1.5 : 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawGlows(){
    for (const g of glows){
      const k = 1 - g.age / 0.3;
      const sp = glowSprite(game.palette.light, 40);
      ctx.globalAlpha = 0.12 * Math.sin(Math.PI * (1 - k));
      ctx.drawImage(sp, g.x - 40, g.y - 40, 80, 80);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Reflexo da lua em fatias ----------
  function drawMoonReflection(){
    if (game.moonR <= 0 || game.moonY > game.horizonY) return;
    const P = game.palette, hy = game.horizonY;
    const len = Math.min(game.H - hy, game.moonR * 8);
    const baseW = game.moonR * 2.2 + 40; // ~80 px
    ctx.fillStyle = P.light;
    // Cintilações: fatias com jitter (largura/alpha por hash) e ~30% puladas; eco = passo 8 px.
    // Nunca uma coluna contínua nem um retângulo único.
    const slice = game.eco ? 8 : 4, n = Math.floor(len / slice);
    const t = game.t, tick = Math.floor(t * 6);
    for (let i = 0; i < n; i++){
      const h1 = hash(i * 7 + 1), h2 = hash(i * 13 + tick);
      if (h2 < 0.3) continue; // fatia apagada
      const y = hy + i * slice, f = 1 - i / n;
      const w = baseW * (0.35 + 0.65 * (1 - f)) * (0.6 + 0.4 * h1);
      const dx = Math.sin(y * 0.15 + t * 2) * 2 + rippleOffset(game.moonX, y);
      const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7 + h1 * 6.28);
      ctx.globalAlpha = 0.10 * Math.pow(f, 1.6) * tw;
      ctx.fillRect(game.moonX + dx - w * 0.5, y, w, slice - 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Halo do cursor ----------
  function drawCursorHalo(){
    const m = game.mouse;
    if (!m.overWater || m.idleFor > 120 || m.x < 0) return;
    const boost = game.sinceClick < 0.3 ? 0.2 : 0;
    const a = 0.06 + boost;
    ctx.fillStyle = game.palette.light;
    for (let k = 3; k >= 1; k--){
      ctx.globalAlpha = a * (4 - k) / 3;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, 7 * k, 7 * k * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Desbloqueios ----------
  function checkUnlocks(){
    if (!game.unlocksEnabled) return;
    const s = game.state;
    for (const u of UNLOCKS){
      if (s.unlocked.indexOf(u.id) >= 0 || pending.indexOf(u.id) >= 0) continue;
      if (s.totalTime >= u.time || s.ripples >= u.ripples) pending.push(u.id);
    }
  }
  function applyUnlock(id){
    const s = game.state, u = UNLOCKS.find(x => x.id === id);
    s.unlocked.push(id);
    fadeStart[id] = game.t;
    if (id === 'dawn' && s.dawnAt < 0) s.dawnAt = s.totalTime;
    game.audio.play('unlock', { degree: cascadeDegree % 5, gain: 1 });
    cascadeDegree++;
    if (u && u.ach) game.achievement(u.ach);
    call('onUnlock', id, game);
    updateAmbient();
    UI.refreshCollection(u && u.icon);
  }
  function updatePending(dt){
    if (!pending.length){ cascadeTimer = 0; cascadeDegree = 0; return; }
    cascadeTimer -= dt;
    if (cascadeTimer <= 0){
      applyUnlock(pending.shift());
      cascadeTimer = 2.5; // cascata de boas-vindas
    }
  }
  function updateAmbient(){
    game.audio.ambient.set({
      moon: game.has('moon'), aurora: game.has('aurora'), fogOpen: game.has('fog_clear'),
      crickets: game.dayPhase < 0.5, wind: game.has('wind') ? 1 : 0
    });
  }

  // ---------- Modo ambiente ----------
  let dewTimer = 8, watchTimer = 0;
  function updateAmbientMode(dt){
    if (game.sinceClick < 0.001) watchTimer = 0; // houve clique neste frame
    watchTimer += dt;
    game.sinceClick += dt;
    if (game.sinceClick < 20){ dewTimer = 6 + rand() * 4; return; }
    dewTimer -= dt;
    if (dewTimer <= 0){
      dewTimer = 6 + rand() * 4;
      // gota cai de um junco (70%) ou de um ponto qualquer da água
      const per = (LQ.reeds && LQ.reeds.perches) ? LQ.reeds.perches(game) : [];
      let x, y, fallH = 40;
      if (per.length && rand() < 0.7){
        const p = per[Math.floor(rand() * per.length)];
        x = clamp(p.x + (rand() - 0.5) * 10, 10, game.W - 10);
        y = clamp(p.y + 40 + rand() * 80, game.horizonY + 20, game.H - 20);
        fallH = Math.max(20, y - p.y);
      } else {
        x = 40 + rand() * (game.W - 80);
        y = game.horizonY + 20 + rand() * (game.H - game.horizonY - 60);
      }
      stones.push({ x, y, age: 0, dew: true, fallH });
    }
    // "Só Olhando": 10 min sem clicar
    if (watchTimer >= 600) game.achievement('just_watching');
    if (game.sinceClick > game.state.stats.longestIdle) game.state.stats.longestIdle = Math.floor(game.sinceClick);
  }

  // ---------- Input ----------
  function canvasPos(e){
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  let audioStarted = false;
  function ensureAudio(){
    if (audioStarted) return;
    audioStarted = true;
    game.audio.init();
    game.audio.setMuted(!!game.state.muted);
    game.audio.setTheme(game.state.theme);
    // névoa já dissipada em sessão anterior: lowpass já aberto (sem rampa de 60 s)
    game.audio.ambient.set({ fogOpen: game.has('fog_clear'), fogTime: 0.05 });
    game.audio.ambient.start();
    updateAmbient();
  }
  function onPointerDown(e){
    if (e.button !== undefined && e.button !== 0) return;
    ensureAudio();
    const p = canvasPos(e);
    game.mouse.x = p.x; game.mouse.y = p.y; game.mouse.idleFor = 0;
    UI.wake();
    // Primeiro os moradores
    for (let i = ents.length - 1; i >= 0; i--){
      const f = ents[i].def.onClick;
      if (f && f.call(ents[i].def, p.x, p.y, game)){ game.sinceClick = 0; return; }
    }
    if (p.y > game.horizonY){ throwStone(p.x, p.y); game.sinceClick = 0; }
    else glows.push({ x: p.x, y: p.y, age: 0 }); // brilho sutil, nunca erro
  }
  function onPointerMove(e){
    const p = canvasPos(e);
    game.mouse.x = p.x; game.mouse.y = p.y; game.mouse.idleFor = 0;
    game.mouse.overWater = p.y > game.horizonY;
    UI.wake();
  }
  function onPointerLeave(){ game.mouse.overWater = false; }

  // ---------- UI ----------
  const UI = {
    hideTimer: 0, collOpen: false, hover: false, pinned: false, // pinned: painel aberto (loja) segura a barra
    init(){
      const ui = document.getElementById('ui');
      ui.addEventListener('pointerdown', e => e.stopPropagation());
      // ponteiro parado sobre a barra: ela não some debaixo do cursor
      ui.addEventListener('pointerenter', () => { UI.hover = true; UI.wake(); });
      ui.addEventListener('pointerleave', () => { UI.hover = false; UI.hideTimer = 0; });
      document.querySelectorAll('.ico').forEach(b => {
        b.addEventListener('click', e => { e.stopPropagation(); UI.act(b.dataset.act); });
      });
      UI.applyClasses();
      UI.refreshCollection(null, true);
    },
    act(a){
      const s = game.state;
      ensureAudio();
      if (a === 'sound'){ s.muted = !s.muted; game.audio.setMuted(s.muted); }
      else if (a === 'full'){
        let p = null;
        if (document.fullscreenElement){ if (document.exitFullscreen) p = document.exitFullscreen(); }
        else if (document.documentElement.requestFullscreen) p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => {}); // sem gesto/permissão: silencioso
      }
      else if (a === 'theme'){
        const list = LQ.themeList || THEME_LIST;
        s.theme = list[(list.indexOf(s.theme) + 1) % list.length];
        game.audio.setTheme(s.theme);
        call('onTheme', s.theme, game);
      }
      else if (a === 'coll'){ UI.collOpen = !UI.collOpen; document.getElementById('collection').classList.toggle('open', UI.collOpen); }
      else if (a === 'eco'){ s.eco = !s.eco; resize(); }
      else if (a === 'mode'){ LQ.switchMode(game.mode === 'idle' ? 'zen' : 'idle'); return; }
      else if (a === 'shop'){ game.emit('shopToggle', null); } // idle/hud.js implementa onShopToggle
      UI.applyClasses(); save();
    },
    applyClasses(){
      const b = document.body, s = game.state;
      b.classList.toggle('muted', !!s.muted);
      b.classList.toggle('eco', !!s.eco);
      b.classList.toggle('mode-zen', game.mode === 'zen');
      b.classList.toggle('mode-idle', game.mode === 'idle');
    },
    wake(){ UI.hideTimer = 0; document.body.classList.remove('uihidden'); },
    update(dt){
      game.mouse.idleFor += dt;
      if (UI.hover || UI.pinned) UI.hideTimer = 0; else UI.hideTimer += dt;
      if (UI.hideTimer > 3) document.body.classList.add('uihidden');
      document.body.classList.toggle('nocursor', game.mouse.idleFor > 120);
    },
    // Coleção: um ícone por morador acordado; `newIcon` nasce com fade
    refreshCollection(newIcon, silent){
      const el = document.getElementById('collection');
      const s = game.state, icons = [];
      for (const u of UNLOCKS) if (u.icon && s.unlocked.indexOf(u.id) >= 0) icons.push(u.icon);
      if (s.liliesBloomed > 0) icons.push('flower');
      let html = '';
      for (const ic of icons){
        html += '<svg class="' + (ic === newIcon && !silent ? 'new' : '') + '"><use href="#ic-' + ic + '"/></svg>';
      }
      el.innerHTML = html;
      // morador novo: a faixa aparece sozinha por alguns segundos (fade, sem texto)
      if (newIcon && !silent && !UI.collOpen){
        el.classList.add('open');
        clearTimeout(UI.peekTimer);
        UI.peekTimer = setTimeout(() => { if (!UI.collOpen) el.classList.remove('open'); }, 6000);
      }
    }
  };
  game.ui = UI;
  // Recomeçar do zero (dev/teste): impede o save de unload regravar o estado e recarrega
  LQ.reset = function(){
    resetting = true;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  };
  // Troca de modo: salva o atual, grava a escolha e recarrega (cada modo tem seu save)
  LQ.switchMode = function(m){
    if (m !== 'zen' && m !== 'idle') return;
    if (game.state) save();
    writeMode(m);
    resetting = true; // o save de unload não regrava por cima
    location.reload();
  };

  // ---------- Desenho por camadas ----------
  // 'reeds' vem depois de 'water' (juncos ficam na margem, em primeiro plano)
  const LAYERS = ['sky', 'aurora', 'moon', 'mountains', 'water', 'reeds', 'lilies', 'fish', 'ripples', 'light', 'fog', 'hud'];
  function draw(){
    if (paletteDirty) rebuildOffscreens();
    const W = game.W, H = game.H, hy = game.horizonY;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(skyCv, 0, 0);
    for (const layer of LAYERS){
      if (layer === 'aurora'){ if (game.eco) continue; ctx.globalCompositeOperation = 'screen'; }
      else if (layer === 'light') ctx.globalCompositeOperation = game.lightBlend || 'lighter'; // tema claro (tinta): multiply
      else ctx.globalCompositeOperation = 'source-over';
      if (layer === 'water'){ ctx.drawImage(waterCv, 0, hy); }
      call('draw', layer, ctx, game);
      if (layer === 'water') drawMoonReflection();
      if (layer === 'ripples'){ drawRipples(); drawStones(); }
      if (layer === 'light'){ drawDrops(); drawGlows(); drawCursorHalo(); }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Loop ----------
  let last = 0, saveTimer = 0, unlockTimer = 0, hiddenAt = 0, running = false;
  function frame(now){
    if (!running) return;
    requestAnimationFrame(frame);
    if (LQ.Platform && LQ.Platform.wallpaper && now - last < 66) return; // papel de parede: 15 fps
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
    game.t += dt;
    game.state.totalTime += dt;
    game.calm = Math.max(0, game.calm - 0.2 * dt);

    palTimer += dt;
    if (palTimer >= 0.5){ palTimer = 0; updateDayCycle(); stepPalette(); }
    unlockTimer += dt;
    if (unlockTimer >= 1){ unlockTimer = 0; checkUnlocks(); updateAmbient(); }
    updatePending(dt);
    updateAmbientMode(dt);
    updateStones(dt);
    updateRipples(dt);
    updateDrops(dt);
    call('update', dt, game);
    UI.update(dt);
    draw();

    saveTimer += dt;
    if (saveTimer >= 10){ saveTimer = 0; save(); }
  }
  function onVisibility(){
    if (document.hidden){
      running = false; hiddenAt = Date.now(); save();
    } else {
      // Volta: avança relógio (cap 8 h) e deixa a cascata mostrar o que acordou
      let away = 0;
      if (hiddenAt){ away = (Date.now() - hiddenAt) / 1000; game.state.totalTime += Math.min(away, OFFLINE_CAP); hiddenAt = 0; }
      checkUnlocks();
      if (away > 0) call('onOffline', away, game);
      if (running) return; // já há um encadeamento de rAF
      running = true; last = performance.now(); requestAnimationFrame(frame);
    }
  }

  // ---------- Escolha de modo (primeira abertura) ----------
  const ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M15 3.5a9 9 0 1 0 5.5 14.5A8 8 0 0 1 15 3.5z"/></svg>';
  const ICON_BOLT = '<svg viewBox="0 0 24 24"><path d="M13 2.5L5 13.5h6l-1 8 9-11.5h-6l1-7.5z"/></svg>';
  function showModePick(){
    const d = document.createElement('div');
    d.id = 'modepick';
    d.style.cssText = 'position:fixed;inset:0;z-index:20;background:#050914;display:flex;align-items:center;justify-content:center;gap:12vw;opacity:0;transition:opacity .6s ease';
    const mk = (m, svg) => {
      const b = document.createElement('button');
      b.dataset.mode = m;
      b.style.cssText = 'width:min(28vw,180px);height:min(28vw,180px);border:0;background:transparent;padding:0;cursor:pointer;opacity:.6;transition:opacity .3s ease';
      b.innerHTML = svg;
      const sv = b.firstChild;
      sv.style.cssText = 'width:100%;height:100%;fill:none;stroke:#e9f2ff;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round';
      b.addEventListener('pointerenter', () => { b.style.opacity = '1'; });
      b.addEventListener('pointerleave', () => { b.style.opacity = '.6'; });
      b.addEventListener('click', () => {
        writeMode(m);
        d.style.opacity = '0';
        setTimeout(() => { d.remove(); }, 600);
        LQ.start(m);
      });
      return b;
    };
    d.appendChild(mk('zen', ICON_MOON));
    d.appendChild(mk('idle', ICON_BOLT));
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '1'; });
  }
  // Ponto de entrada: com modo gravado inicia direto; sem modo mostra a escolha
  LQ.boot = function(){
    const m = readMode();
    if (m) LQ.start(m); else showModePick();
  };

  // ---------- Início ----------
  LQ.start = function(mode){
    game.mode = mode === 'idle' ? 'idle' : 'zen';
    SAVE_KEY = SAVE_KEYS[game.mode];
    game.unlocksEnabled = game.mode !== 'idle';
    game.state = load();
    game.platform = LQ.Platform || null;
    game.audio = LQ.Audio || audioStub;
    // Ganho offline (cap 8 h) + achievement de retorno após 24 h+
    // (ausência calculada AQUI, antes de lastSeen ser consumida pelo save)
    const s = game.state, now = Date.now();
    let away = 0;
    if (s.lastSeen > 0){
      away = Math.max(0, (now - s.lastSeen) / 1000);
      s.totalTime += Math.min(away, OFFLINE_CAP);
      if (away >= 86400) game.achievement('left_light_on');
    }
    canvas = document.getElementById('lake');
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    updateDayCycle();
    game.palette = targetPalette(); paletteDirty = true;

    call('init', game);
    if (away > 0) call('onOffline', away, game); // depois do init: entidades já têm estado
    started = true;
    UI.init();
    checkUnlocks(); // pendentes entram em cascata (2,5 s cada)
    cascadeTimer = pending.length > 1 ? 1.5 : 0;

    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);

    running = true; last = performance.now();
    requestAnimationFrame(frame);
  };
})();
