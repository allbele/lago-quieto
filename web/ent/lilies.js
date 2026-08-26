// Lago Quieto — lírios d'água: discos derivando, balançam com anéis, florescem ao clique.
// Zen: 3-5 lírios. Idle: 12 posicionados, visíveis os primeiros LQ.Idle.visible('lirio') (fade 1 s cada).
(function(){
  'use strict';
  const TWO_PI = Math.PI * 2;
  const BLOOM_T = 3;   // flor abre em 3 s
  const IDLE_MAX = 12;
  const lilies = [];
  let lastCount = -1;
  // Área dos controles (coleção + barra de ícones, centro inferior): lírios não entram
  // (bot = H-100 mantém o centro acima da coleção; a zona central até H-150 cobre raio+balanço)
  const UI_H = 100, ZONE_H = 150, UI_HALF_W = 230;
  function inZone(y, game){ return y > game.H - ZONE_H; }
  function zoneL(game){ return game.W / 2 - UI_HALF_W; }
  function zoneR(game){ return game.W / 2 + UI_HALF_W; }
  function safeX(x, y, game){
    if (!inZone(y, game) || x < zoneL(game) || x > zoneR(game)) return x;
    const left = zoneL(game), right = zoneR(game);
    if (left < 30 && right > game.W - 30) return x; // tela estreita: sem espaço lateral
    if (left < 30) return right;
    if (right > game.W - 30) return left;
    return x < game.W / 2 ? left : right;
  }

  // idle: população vem de LQ.Idle.visible(id) (ou de pop em data.js); zen (ou -1): regra atual
  function vis(game, id, zenValue){
    if (game.mode !== 'idle' || !LQ.Idle) return zenValue;
    if (typeof LQ.Idle.visible === 'function'){ const v = LQ.Idle.visible(id); if (v >= 0) return v; }
    const P = LQ.IdleData && LQ.IdleData.pop && LQ.IdleData.pop[id];
    if (!P || typeof LQ.Idle.genCount !== 'function') return zenValue;
    const n = LQ.Idle.genCount(id);
    return n <= 0 ? 0 : Math.min(P.cap, P.base + Math.floor(Math.log2(n)) * P.k);
  }
  // quantos lírios estão ativos (zen: todos)
  function count(game){ return Math.min(lilies.length, vis(game, 'lirio', lilies.length)); }
  // sincroniza 'shown' e game.lilyCount quando a população muda
  function sync(game){
    const n = count(game);
    if (n === lastCount) return n;
    for (let i = 0; i < lilies.length; i++){
      const L = lilies[i];
      if (i < n){ if (L.shown < 0) L.shown = game.t; } else L.shown = -1;
    }
    lastCount = n; game.lilyCount = n;
    return n;
  }
  function fadeOf(L, game, base){
    if (game.mode !== 'idle') return base;
    return L.shown < 0 ? 0 : base * game.ease.smoothstep((game.t - L.shown) / 1);
  }

  function place(game){
    lilies.length = 0;
    const n = game.mode === 'idle' ? IDLE_MAX : 3 + Math.floor(game.rand() * 3); // zen: 3-5
    const top = game.horizonY + game.H * 0.12, bot = game.H - UI_H;
    for (let i = 0; i < n; i++){
      const y = top + (i + game.rand()) / n * (bot - top);
      const depth = (y - game.horizonY) / (game.H - game.horizonY); // 0 longe, 1 perto
      const x = safeX(30 + game.rand() * (game.W - 60), y, game);
      lilies.push({
        x, y, r: 10 + depth * 16,
        rot: game.rand() * TWO_PI, notch: game.rand() * TWO_PI,
        vx: (game.rand() - 0.5) * 3, ph: game.rand() * TWO_PI,
        bob: 0, bobV: 0,            // oscilação vertical por anéis (mola amortecida)
        bloomed: false, bloom: 0,
        shown: -1                   // game.t em que apareceu (idle)
      });
    }
    lastCount = -1;
    // já presentes ao iniciar: sem fade próprio
    const c = count(game);
    for (let i = 0; i < c; i++) lilies[i].shown = -1e9;
    sync(game);
  }

  LQ.register('lilies', {
    init(game){ place(game); },
    onUnlock(id, game){ if (id === 'lilies') place(game); },
    onResize(game){
      const top = game.horizonY + game.H * 0.12, bot = game.H - UI_H;
      for (const L of lilies){
        L.x = Math.min(game.W - 30, Math.max(30, L.x));
        L.y = Math.min(bot, Math.max(top, L.y));
        L.x = safeX(L.x, L.y, game);
      }
    },
    update(dt, game){
      if (!game.has('lilies')) return;
      const n = sync(game);
      for (let i = 0; i < n; i++){
        const L = lilies[i];
        // deriva lenta, ida e volta
        L.x += L.vx * dt;
        if (L.x < 30){ L.x = 30; L.vx = Math.abs(L.vx); }
        else if (L.x > game.W - 30){ L.x = game.W - 30; L.vx = -Math.abs(L.vx); }
        // não deriva para debaixo dos controles (centro inferior): as bordas da zona são paredes
        if (inZone(L.y, game)){
          const zl = zoneL(game), zr = zoneR(game);
          if (L.x > zl && L.x < zr){
            if (L.x - zl < zr - L.x && zl >= 30){ L.x = zl; L.vx = -Math.abs(L.vx); }
            else if (zr <= game.W - 30){ L.x = zr; L.vx = Math.abs(L.vx); }
          }
        }
        if (game.rand() < 0.002) L.vx = (game.rand() - 0.5) * 3;
        // mola amortecida para o balanço (com teto: spam nunca vira raio negativo)
        const acc = -L.bob * 30 - L.bobV * 3;
        L.bobV = Math.min(80, Math.max(-80, L.bobV + acc * dt));
        L.bob = Math.min(25, Math.max(-25, L.bob + L.bobV * dt));
        if (L.bloom > 0 && L.bloom < BLOOM_T) L.bloom = Math.min(BLOOM_T, L.bloom + dt);
      }
    },
    onRipple(x, y, game){
      if (!game.has('lilies')) return;
      const n = count(game);
      for (let i = 0; i < n; i++){
        const L = lilies[i];
        const d = Math.hypot(L.x - x, (L.y - y) / 0.35);
        if (d < 220) L.bobV += 40 * (1 - d / 220);
      }
    },
    onClick(x, y, game){
      if (!game.has('lilies') || game.unlockFade('lilies') < 0.5) return false;
      const n = count(game);
      for (let i = 0; i < n; i++){
        const L = lilies[i];
        if (fadeOf(L, game, 1) < 0.5) continue;
        const dx = x - L.x, dy = (y - L.y - L.bob) / 0.45;
        if (dx * dx + dy * dy < (L.r + 4) * (L.r + 4)){
          L.bobV += 25;
          if (!L.bloomed){
            L.bloomed = true; L.bloom = 1e-6;
            game.state.liliesBloomed++;
            game.audio.play('bloom', { x: x / game.W, y: 0.4, gain: 1 });
            game.ui.refreshCollection('flower');
            if (lilies.slice(0, n).every(l => l.bloomed)) game.achievement('night_bloom');
          } else {
            game.audio.play('pulse', { x: x / game.W, y: 0.4, gain: 1 });
          }
          game.spawnRipple(L.x, L.y + L.r * 0.5, { strength: 0.35, rings: 1 });
          // impacto de clique (idle ganha moeda aqui; zen: nenhuma entidade escuta)
          if (game.emit) game.emit('impact', { x: L.x, y: L.y, strength: 0.5, source: 'lily' });
          return true;
        }
      }
      return false;
    },
    draw(layer, ctx, game){
      if (!game.has('lilies')) return;
      const base = game.unlockFade('lilies');
      if (base <= 0.01) return;
      const n = count(game);
      if (layer === 'lilies'){
        ctx.fillStyle = game.palette.dark;
        for (let i = 0; i < n; i++){
          const L = lilies[i];
          const fade = fadeOf(L, game, base);
          if (fade <= 0.01) continue;
          const y = L.y + L.bob, sway = Math.max(0.7, Math.min(1.3, 1 + L.bob * 0.01));
          ctx.globalAlpha = 0.9 * fade;
          // disco elíptico com um recorte (folha de lírio)
          ctx.beginPath();
          ctx.ellipse(L.x, y, L.r * sway, L.r * 0.45 / sway, 0, 0, TWO_PI);
          ctx.fill();
          ctx.fillStyle = game.palette.horizon;
          ctx.globalAlpha = 0.9 * fade;
          ctx.beginPath();
          ctx.moveTo(L.x, y);
          ctx.lineTo(L.x + Math.cos(L.notch) * L.r * 1.05, y + Math.sin(L.notch) * L.r * 0.5);
          ctx.lineTo(L.x + Math.cos(L.notch + 0.5) * L.r * 1.05, y + Math.sin(L.notch + 0.5) * L.r * 0.5);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = game.palette.dark;
          // brilho de borda molhada: fina elipse mais clara na parte de trás
          ctx.globalAlpha = 0.12 * fade;
          ctx.fillStyle = game.palette.light;
          ctx.beginPath(); ctx.ellipse(L.x, y - L.r * 0.1, L.r * 0.8, L.r * 0.18, 0, Math.PI, TWO_PI); ctx.fill();
          ctx.fillStyle = game.palette.dark;
        }
        ctx.globalAlpha = 1;
      } else if (layer === 'light'){
        // flores brancas abrindo (pétalas = elipses radiais), centro dourado
        for (let i = 0; i < n; i++){
          const L = lilies[i];
          if (L.bloom <= 0) continue;
          const fade = fadeOf(L, game, base);
          if (fade <= 0.01) continue;
          const k = game.ease.smoothstep(L.bloom / BLOOM_T);
          const y = L.y + L.bob - L.r * 0.25;
          const pr = L.r * 0.55 * k;
          ctx.fillStyle = game.palette.light;
          const petals = 8;
          for (let p = 0; p < petals; p++){
            const a = L.rot + p / petals * TWO_PI;
            const px = L.x + Math.cos(a) * pr * 0.55, py = y + Math.sin(a) * pr * 0.25;
            ctx.globalAlpha = 0.28 * fade * k;
            ctx.beginPath(); ctx.ellipse(px, py, pr * 0.6, pr * 0.22, a, 0, TWO_PI); ctx.fill();
          }
          // glow suave sob a flor (sprite cacheado)
          const sp = game.sprite.glow(game.palette.light, 30);
          ctx.globalAlpha = 0.12 * k * fade;
          ctx.drawImage(sp, L.x - L.r, y - L.r * 0.5, L.r * 2, L.r);
          ctx.fillStyle = game.palette.gold;
          ctx.globalAlpha = 0.6 * k * fade;
          ctx.beginPath(); ctx.ellipse(L.x, y, pr * 0.22, pr * 0.12, 0, 0, TWO_PI); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  });

  // leitura (depuração/testes): quantos lírios estão ativos agora
  LQ.lilies = { count: () => (LQ.game ? count(LQ.game) : 0) };
})();
