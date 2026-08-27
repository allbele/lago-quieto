// Lago Quieto — peixes: sombras em Bézier, curvam para anéis, saltam, mergulham ao clique.
// Zen: 1 com 'fish', 3 (2 + dourado) com 'fish2'. Idle: LQ.Idle.visible('peixe'/'dourado') (até 8 + 3);
// no idle o peixe mais próximo "come" a pedra (onImpact source 'stone') → salto dourado + LQ.Idle.bonus('fish').
(function(){
  'use strict';
  const TWO_PI = Math.PI * 2;
  const TRAIL = 4;           // posições do rastro
  const JUMP_T = 0.6;        // duração do arco (s)
  const DIVE_T = 1.6;        // mergulho ao clique (s)
  const CURVE_R = 250;       // raio de atração dos anéis
  const N_NORMAL = 8, N_GOLD = 3; // pool: normais 0..7, dourados 8..10
  const EAT_T = 2.2;         // janela para alcançar a pedra (s)
  const JUMP_CD = 6;         // s mínimos entre saltos do mesmo peixe (anéis não viram chuva de saltos)
  const EAT_CD = 6;          // s mínimos entre refeições do mesmo peixe (o bônus não domina a economia)
  const JUMP_SND_GAP = 1;    // s mínimos entre sons 'fishJump' (global; o dourado/refeição sempre toca)
  const UI_BAND = 72;        // px acima da borda inferior reservados à barra de ícones
  let lastJumpSnd = -1e9;

  const fish = [];
  let goldSeen = false;
  let lastW = 0, lastH = 0, lastTop = 0, lastBot = 0; // geometria do último resize
  let active = [];           // índices ativos (cache)
  let cacheN = -1, cacheG = -1, cacheMode = '';

  // idle: população vem de LQ.Idle.visible(id) (ou de pop em data.js); zen (ou -1): regra atual
  function vis(game, id, zenValue){
    if (game.mode !== 'idle' || !LQ.Idle) return zenValue;
    if (typeof LQ.Idle.visible === 'function'){ const v = LQ.Idle.visible(id); if (v >= 0) return v; }
    const P = LQ.IdleData && LQ.IdleData.pop && LQ.IdleData.pop[id];
    if (!P || typeof LQ.Idle.genCount !== 'function') return zenValue;
    const n = LQ.Idle.genCount(id);
    return n <= 0 ? 0 : Math.min(P.cap, P.base + Math.floor(Math.log2(n)) * P.k);
  }
  function gc(game, id){
    return game.mode === 'idle' && LQ.Idle && typeof LQ.Idle.genCount === 'function' ? LQ.Idle.genCount(id) : 0;
  }

  function makeFish(gold){
    const f = { gold: !!gold, x: 0, y: 0, ang: 0, len: 22, alpha: 0, trail: [],
      p0: null, p1: null, p2: null, p3: null, u: 0, dur: 6,   // curva atual
      pull: null, pullT: 0,                                    // atração ao anel
      target: null, ate: false, shown: -1,                     // pedra a comer; salto de refeição; t em que apareceu (idle)
      jumping: 0, jx: 0, jy: 0, jumped: false, jumpTimer: 0, jumpCd: 0, eatCd: 0, pullJump: false, // pullJump: atração veio de pedra (clique) → pode saltar ao chegar
      diving: 0, dx: 0, dy: 0, tx: 0, ty: 0, born: false };
    for (let i = 0; i < TRAIL; i++) f.trail.push({ x: 0, y: 0 });
    return f;
  }
  function waterBand(game){
    const top = game.horizonY + 24, bot = game.H - UI_BAND; // nunca por cima da barra inferior
    return { top, bot };
  }
  function randPoint(game){
    const b = waterBand(game);
    return { x: 20 + game.rand() * (game.W - 40), y: b.top + game.rand() * (b.bot - b.top) };
  }
  // Nova curva de Bézier partindo da posição atual (ou entrando pela borda se recém-nascido)
  function newPath(f, game){
    if (!f.born){
      const b = waterBand(game);
      f.born = true;
      f.x = game.rand() < 0.5 ? -40 : game.W + 40;
      f.y = b.top + game.rand() * (b.bot - b.top);
    }
    f.p0 = { x: f.x, y: f.y };
    f.p3 = randPoint(game);
    // controles: seguem a direção atual e depois curvam
    const d = 120 + game.rand() * 160;
    f.p1 = { x: f.x + Math.cos(f.ang) * d, y: f.y + Math.sin(f.ang) * d * 0.5 };
    f.p2 = { x: f.p3.x + (game.rand() - 0.5) * 260, y: f.p3.y + (game.rand() - 0.5) * 120 };
    f.u = 0;
    const dist = Math.hypot(f.p3.x - f.p0.x, f.p3.y - f.p0.y);
    f.dur = Math.max(4, dist / (28 + game.rand() * 14)); // ~30-40 px/s
    f.jumpTimer = 6 + game.rand() * 14;
  }
  function bez(a, b, c, d, t){
    const s = 1 - t;
    return s*s*s*a + 3*s*s*t*b + 3*s*t*t*c + t*t*t*d;
  }
  function pushTrail(f){
    for (let i = TRAIL - 1; i > 0; i--){ f.trail[i].x = f.trail[i-1].x; f.trail[i].y = f.trail[i-1].y; }
    f.trail[0].x = f.x; f.trail[0].y = f.y;
  }
  function startJump(f, game){
    f.jumping = 1e-6; f.jumped = false; f.jx = f.x; f.jy = f.y; f.jumpCd = JUMP_CD;
    if (f.gold || f.ate) game.audio.play('fishJumpGold', { x: f.x / game.W, y: 0.4, gain: 1 });
    else if (game.t - lastJumpSnd >= JUMP_SND_GAP){ lastJumpSnd = game.t; game.audio.play('fishJump', { x: f.x / game.W, y: 0.4, gain: 1 }); }
    if (f.gold && !goldSeen){ goldSeen = true; game.achievement('golden_fish'); }
  }
  // Idle: peixe alcançou a pedra → salto dourado e bônus (×2; ×3 com 10 peixes; ×4 com ração)
  function eat(f, game){
    f.ate = true; f.eatCd = EAT_CD;
    startJump(f, game);
    try {
      const B = (LQ.IdleData && LQ.IdleData.bonus) || {};
      const has = LQ.Idle && typeof LQ.Idle.has === 'function' && LQ.Idle.has('racao');
      const mult = has ? (B.racaoMult || 4) : gc(game, 'peixe') >= 10 ? (B.fishMult10 || 3) : (B.fishMult || 2);
      if (LQ.Idle && typeof LQ.Idle.bonus === 'function') LQ.Idle.bonus('fish', { x: f.x, y: f.y, mult });
    } catch (e) { /* motor pode não ter bonus ainda */ }
  }
  function startDive(f, game){
    f.diving = 1e-6; f.dx = f.x; f.dy = f.y;
    // ressurge 200 px adiante na direção atual, dentro da água
    const b = waterBand(game);
    let tx = f.x + Math.cos(f.ang) * 200, ty = f.y + Math.sin(f.ang) * 200 * 0.4;
    if (tx < 20 || tx > game.W - 20){ tx = f.x - Math.cos(f.ang) * 200; f.ang += Math.PI; }
    f.tx = Math.min(game.W - 20, Math.max(20, tx));
    f.ty = Math.min(b.bot, Math.max(b.top, ty));
    game.spawnRipple(f.x, f.y, { strength: 0.6, rings: 2 });
    game.spawnDrops(f.x, f.y, 2);
    game.audio.play('plop', { x: f.x / game.W, y: 0.3, gain: 0.25 });
  }
  // Índices ativos: zen [0] ou [0,1,8] (2 normais + dourado); idle [0..nN-1] ∪ [8..8+nG-1]
  function activeIdx(game){
    let nN, nG;
    if (game.mode === 'idle'){
      nN = Math.min(N_NORMAL, vis(game, 'peixe', 0)); nG = Math.min(N_GOLD, vis(game, 'dourado', 0));
    } else {
      const z = !game.has('fish') ? 0 : game.has('fish2') ? 3 : 1;
      nN = z === 3 ? 2 : z; nG = z === 3 ? 1 : 0;
    }
    if (nN !== cacheN || nG !== cacheG || game.mode !== cacheMode){
      cacheN = nN; cacheG = nG; cacheMode = game.mode;
      active = [];
      for (let i = 0; i < nN; i++) active.push(i);
      for (let i = 0; i < nG; i++) active.push(N_NORMAL + i);
      // idle: quem acaba de aparecer ganha fade próprio; quem saiu volta a -1
      for (let i = 0; i < fish.length; i++){
        const on = active.indexOf(i) >= 0;
        if (on && fish[i].shown < 0) fish[i].shown = game.t;
        else if (!on){ fish[i].shown = -1; fish[i].pull = null; fish[i].target = null; }
      }
    }
    return active;
  }
  function fadeOf(f, game){
    if (game.mode === 'idle'){
      const base = f.gold ? (game.has('fish2') ? game.unlockFade('fish2') : 1) : game.unlockFade('fish');
      const own = f.shown < 0 ? 0 : game.ease.smoothstep((game.t - f.shown) / 1);
      return base * own;
    }
    return f.gold || fish.indexOf(f) > 0 ? game.unlockFade('fish2') : game.unlockFade('fish');
  }
  // alvo (pedra) ainda válido?
  function hasTarget(f, game){ return !!f.target && game.t - f.target.t <= EAT_T; }

  LQ.register('fish', {
    init(game){
      fish.length = 0;
      for (let i = 0; i < N_NORMAL; i++) fish.push(makeFish(false));
      for (let i = 0; i < N_GOLD; i++) fish.push(makeFish(true));
      for (const f of fish) f.ang = game.rand() * TWO_PI;
      const b = waterBand(game); lastW = game.W; lastH = game.H; lastTop = b.top; lastBot = b.bot;
      cacheN = -1; cacheG = -1; cacheMode = '';
      // já presentes ao iniciar: sem fade próprio
      const act = activeIdx(game);
      for (const i of act) fish[i].shown = -1e9;
    },
    // janela mudou: reposiciona proporcionalmente à faixa d'água e recomeça a curva daí
    onResize(game){
      const b = waterBand(game);
      if (!lastW || !lastH){ lastW = game.W; lastH = game.H; lastTop = b.top; lastBot = b.bot; return; }
      const sx = game.W / lastW, sy = (b.bot - b.top) / Math.max(1, lastBot - lastTop);
      for (const f of fish){
        if (!f.born) continue;
        f.x *= sx; f.y = b.top + (f.y - lastTop) * sy;
        f.x = Math.min(game.W + 40, Math.max(-40, f.x));
        f.y = Math.min(b.bot, Math.max(b.top, f.y));
        for (const p of f.trail){ p.x = f.x; p.y = f.y; }
        f.jumping = 0; f.diving = 0; f.pull = null; f.target = null;
        newPath(f, game);
      }
      lastW = game.W; lastH = game.H; lastTop = b.top; lastBot = b.bot;
    },
    update(dt, game){
      const act = activeIdx(game);
      const band = waterBand(game);
      for (let i = 0; i < fish.length; i++){
        const f = fish[i];
        if (act.indexOf(i) < 0){ f.alpha = 0; continue; }
        f.alpha = 0.35 * fadeOf(f, game);
        if (!f.p0) newPath(f, game);
        if (f.jumpCd > 0) f.jumpCd -= dt;
        if (f.eatCd > 0) f.eatCd -= dt;

        // Mergulho (clique): invisível, reaparece adiante
        if (f.diving > 0){
          f.diving += dt;
          const k = Math.min(1, f.diving / DIVE_T);
          f.x = f.dx + (f.tx - f.dx) * k; f.y = f.dy + (f.ty - f.dy) * k;
          if (k >= 1){
            f.diving = 0;
            game.spawnRipple(f.x, f.y, { strength: 0.4, rings: 1 });
            for (const p of f.trail){ p.x = f.x; p.y = f.y; }
            newPath(f, game);
          }
          continue;
        }
        // Salto: sombra parada, corpo em arco na camada de luz
        if (f.jumping > 0){
          f.jumping += dt;
          if (f.jumping >= JUMP_T){
            f.jumping = 0;
            game.spawnRipple(f.x, f.y, { strength: 0.7, rings: 2 });
            game.spawnDrops(f.x, f.y, 4, f.gold || f.ate ? game.palette.gold : null); // dourado/refeição: gotas douradas
            f.ate = false;
          }
          continue;
        }

        // Avança na curva
        f.u += dt / f.dur;
        if (f.u >= 1){ newPath(f, game); }
        let nx = bez(f.p0.x, f.p1.x, f.p2.x, f.p3.x, f.u);
        let ny = bez(f.p0.y, f.p1.y, f.p2.y, f.p3.y, f.u);
        // Atração ao anel (dura ~1.5 s, mistura suavemente)
        if (f.pull){
          f.pullT -= dt;
          const w = game.ease.smoothstep(Math.min(1, f.pullT / 1.5)) * 0.6;
          nx += (f.pull.x - nx) * w * dt * 2; ny += (f.pull.y - ny) * w * dt * 2;
          const d = Math.hypot(f.pull.x - nx, f.pull.y - ny);
          let ate = false;
          if (f.target){
            // idle: distância medida ao alvo guardado (a pedra), não ao pull
            if (!hasTarget(f, game)) f.target = null;
            else {
              const dtg = Math.hypot(f.target.x - nx, f.target.y - ny);
              if (dtg < 20 || (f.pullT <= 0 && dtg < 40)){ eat(f, game); ate = true; f.pull = null; f.target = null; }
            }
          }
          if (!ate && (f.pullT <= 0 || d < 20)){
            // salto ao chegar: só se a atração veio de uma pedra (não de anéis automáticos/orvalho) e fora do cooldown
            if (game.calm > 8 && d < 40 && f.pullT > 0 && f.pullJump && f.jumpCd <= 0) startJump(f, game);
            f.pull = null;
            if (f.pullT <= 0) f.target = null;
          }
        } else if (f.target) f.target = null;
        const mvx = nx - f.x, mvy = ny - f.y;
        if (Math.abs(mvx) + Math.abs(mvy) > 0.05){
          const target = Math.atan2(mvy, mvx);
          let da = target - f.ang; while (da > Math.PI) da -= TWO_PI; while (da < -Math.PI) da += TWO_PI;
          f.ang += da * Math.min(1, dt * 4);
        }
        f.x = nx; f.y = Math.min(band.bot, Math.max(band.top, ny)); // nunca acima do horizonte
        // Rastro: guarda a cada ~80 ms
        f._tt = (f._tt || 0) + dt;
        if (f._tt >= 0.08){ f._tt = 0; pushTrail(f); }
        // Salto espontâneo (fish2, modo ambiente ou, no idle, marco de 5 peixes)
        f.jumpTimer -= dt;
        if (f.jumpTimer <= 0){
          f.jumpTimer = 15 + game.rand() * 30;
          const spont = game.has('fish2') || game.sinceClick > 20 || gc(game, 'peixe') >= 5;
          if (spont && f.y > game.horizonY + 40) startJump(f, game);
        }
      }
    },
    onRipple(x, y, game, meta){
      if (meta && meta.auto) return; // anel automático do idle: decoração, não arrasta peixe
      const act = activeIdx(game);
      let best = null, bd = CURVE_R;
      for (const i of act){
        const f = fish[i];
        if (f.jumping || f.diving || !f.born) continue;
        if (hasTarget(f, game)) continue; // já vai comer uma pedra: anéis automáticos não o desviam
        const d = Math.hypot(f.x - x, (f.y - y) * 1.5);
        if (d < bd){ bd = d; best = f; }
      }
      if (best){
        best.pull = { x, y }; best.pullT = 1.5 + game.rand() * 0.5; best.pullJump = false;
        // recomeça a curva a partir de onde está para a atração não brigar com o Bézier
        best.p0 = { x: best.x, y: best.y }; best.u = 0;
        best.p3 = { x: x + (game.rand() - 0.5) * 120, y: y + (game.rand() - 0.5) * 40 };
        best.p1 = { x: best.x + Math.cos(best.ang) * 60, y: best.y + Math.sin(best.ang) * 30 };
        best.p2 = { x: x, y: y };
        best.dur = Math.max(1.6, bd / 90);
        // calm alto: o mais próximo salta chegando (0.5–2 s depois do clique)
        if (game.calm > 8) best.pullT = Math.min(best.pullT, 1.2);
      }
    },
    // Idle: pedra caiu (onRipple já puxou o mais próximo) → marca o alvo para a refeição
    onImpact(p, game){
      if (!p || p.source !== 'stone') return;
      const act0 = activeIdx(game);
      // pedra (clique): o peixe que onRipple acabou de puxar para este ponto pode saltar ao chegar
      for (const i of act0){ const f = fish[i]; if (f.pull && f.pull.x === p.x && f.pull.y === p.y) f.pullJump = true; }
      if (game.mode !== 'idle') return;
      const act = act0;
      let best = null, bd = CURVE_R;
      for (const i of act){
        const f = fish[i];
        if (f.jumping || f.diving || !f.born || hasTarget(f, game) || f.eatCd > 0) continue; // em cooldown: não come
        const d = Math.hypot(f.x - p.x, (f.y - p.y) * 1.5);
        if (d < bd){ bd = d; best = f; }
      }
      if (!best) return;
      best.target = { x: p.x, y: p.y, t: game.t }; // relógio da cena (p.t é o relógio real do combo)
      if (!best.pull){ best.pull = { x: p.x, y: p.y }; best.pullT = 1.5; }
      best.pullT = Math.max(best.pullT, EAT_T); // tempo de sobra para chegar
    },
    onClick(x, y, game){
      const act = activeIdx(game);
      for (const i of act){
        const f = fish[i];
        if (f.jumping || f.diving || f.alpha <= 0.05) continue;
        const dx = x - f.x, dy = y - f.y;
        if (dx * dx + dy * dy * 4 < 26 * 26){ startDive(f, game); return true; }
      }
      return false;
    },
    draw(layer, ctx, game){
      const act = activeIdx(game);
      if (act.length === 0) return;
      if (layer === 'fish'){
        ctx.fillStyle = game.palette.dark;
        for (const i of act){
          const f = fish[i];
          if (f.alpha <= 0.01 || f.diving || f.jumping) continue;
          // rastro: 4 posições, alpha decrescente
          for (let k = TRAIL - 1; k >= 0; k--){
            const p = f.trail[k];
            ctx.globalAlpha = f.alpha * (0.5 - k * 0.11);
            ctx.beginPath(); ctx.ellipse(p.x, p.y, f.len * 0.7 * (1 - k * 0.12), f.len * 0.22, f.ang, 0, TWO_PI); ctx.fill();
          }
          ctx.globalAlpha = f.alpha;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, f.len, f.len * 0.36, f.ang, 0, TWO_PI); ctx.fill();
          // cauda
          const tx = f.x - Math.cos(f.ang) * f.len * 1.1, ty = f.y - Math.sin(f.ang) * f.len * 1.1;
          ctx.beginPath(); ctx.ellipse(tx, ty, f.len * 0.35, f.len * 0.2, f.ang + 0.6, 0, TWO_PI); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (layer === 'light'){
        // corpo saltando: arco 600 ms, parábola até 46 px; reflexo claro na camada aditiva
        for (const i of act){
          const f = fish[i];
          if (!f.jumping) continue;
          const k = f.jumping / JUMP_T;
          const h = Math.sin(Math.PI * k) * 46;
          const x = f.jx + (k - 0.5) * 40, y = f.jy - h;
          const rot = (k - 0.5) * 2.2; // sobe inclinado, desce de cabeça
          const col = f.gold || f.ate ? game.palette.gold : game.palette.light;
          const a = 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * fadeOf(f, game);
          ctx.fillStyle = col;
          for (let e = 3; e >= 1; e--){ // 3 elipses concêntricas = glow
            ctx.globalAlpha = a * (e === 1 ? 1 : 0.18 / e);
            ctx.beginPath(); ctx.ellipse(x, y, f.len * 0.8 * (1 + (e - 1) * 0.45), f.len * 0.28 * (1 + (e - 1) * 0.6), rot, 0, TWO_PI); ctx.fill();
          }
          // sombra que fica na água
          ctx.globalAlpha = a * 0.3;
          ctx.beginPath(); ctx.ellipse(f.jx, f.jy, f.len * 0.8, f.len * 0.25, 0, 0, TWO_PI); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  });

  // leitura (depuração/testes): peixes ativos agora (objetos vivos — não alterar)
  LQ.fish = { list: fish, active: () => (LQ.game ? activeIdx(LQ.game).map(i => fish[i]) : []) };
})();
