// Lago Quieto — peixes: sombras em Bézier, curvam para anéis, saltam, mergulham ao clique.
(function(){
  'use strict';
  const TWO_PI = Math.PI * 2;
  const TRAIL = 4;           // posições do rastro
  const JUMP_T = 0.6;        // duração do arco (s)
  const DIVE_T = 1.6;        // mergulho ao clique (s)
  const CURVE_R = 250;       // raio de atração dos anéis

  const fish = [];
  let goldSeen = false;
  let lastW = 0, lastH = 0, lastTop = 0, lastBot = 0; // geometria do último resize

  function makeFish(gold){
    const f = { gold: !!gold, x: 0, y: 0, ang: 0, len: 22, alpha: 0, trail: [],
      p0: null, p1: null, p2: null, p3: null, u: 0, dur: 6,   // curva atual
      pull: null, pullT: 0,                                    // atração ao anel
      jumping: 0, jx: 0, jy: 0, jumped: false, jumpTimer: 0,
      diving: 0, dx: 0, dy: 0, tx: 0, ty: 0, born: false };
    for (let i = 0; i < TRAIL; i++) f.trail.push({ x: 0, y: 0 });
    return f;
  }
  function waterBand(game){
    const top = game.horizonY + 24, bot = game.H - 30;
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
    f.jumping = 1e-6; f.jumped = false; f.jx = f.x; f.jy = f.y;
    game.audio.play(f.gold ? 'fishJumpGold' : 'fishJump', { x: f.x / game.W, y: 0.4, gain: 1 });
    if (f.gold && !goldSeen){ goldSeen = true; game.achievement('golden_fish'); }
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
  function fishCount(game){
    if (!game.has('fish')) return 0;
    return game.has('fish2') ? 3 : 1;
  }
  function fadeOf(f, game){
    return f.gold || fish.indexOf(f) > 0 ? game.unlockFade('fish2') : game.unlockFade('fish');
  }

  LQ.register('fish', {
    init(game){
      fish.length = 0;
      fish.push(makeFish(false)); fish.push(makeFish(false)); fish.push(makeFish(true));
      for (const f of fish) f.ang = game.rand() * TWO_PI;
      const b = waterBand(game); lastW = game.W; lastH = game.H; lastTop = b.top; lastBot = b.bot;
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
        f.jumping = 0; f.diving = 0; f.pull = null;
        newPath(f, game);
      }
      lastW = game.W; lastH = game.H; lastTop = b.top; lastBot = b.bot;
    },
    update(dt, game){
      const n = fishCount(game);
      const band = waterBand(game);
      for (let i = 0; i < fish.length; i++){
        const f = fish[i];
        if (i >= n){ f.alpha = 0; continue; }
        f.alpha = 0.35 * fadeOf(f, game);
        if (!f.p0) newPath(f, game);

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
            game.spawnDrops(f.x, f.y, 4, f.gold ? game.palette.gold : null); // dourado: gotas douradas
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
          if (f.pullT <= 0 || d < 20){
            if (game.calm > 8 && d < 40 && f.pullT > 0) startJump(f, game);
            f.pull = null;
          }
        }
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
        // Salto espontâneo (só com fish2 ou modo ambiente)
        f.jumpTimer -= dt;
        if (f.jumpTimer <= 0){
          f.jumpTimer = 15 + game.rand() * 30;
          const spont = game.has('fish2') || game.sinceClick > 20;
          if (spont && f.y > game.horizonY + 40) startJump(f, game);
        }
      }
    },
    onRipple(x, y, game){
      const n = fishCount(game);
      let best = null, bd = CURVE_R;
      for (let i = 0; i < n; i++){
        const f = fish[i];
        if (f.jumping || f.diving || !f.born) continue;
        const d = Math.hypot(f.x - x, (f.y - y) * 1.5);
        if (d < bd){ bd = d; best = f; }
      }
      if (best){
        best.pull = { x, y }; best.pullT = 1.5 + game.rand() * 0.5;
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
    onClick(x, y, game){
      const n = fishCount(game);
      for (let i = 0; i < n; i++){
        const f = fish[i];
        if (f.jumping || f.diving || f.alpha <= 0.05) continue;
        const dx = x - f.x, dy = y - f.y;
        if (dx * dx + dy * dy * 4 < 26 * 26){ startDive(f, game); return true; }
      }
      return false;
    },
    draw(layer, ctx, game){
      const n = fishCount(game);
      if (n === 0) return;
      if (layer === 'fish'){
        ctx.fillStyle = game.palette.dark;
        for (let i = 0; i < n; i++){
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
        for (let i = 0; i < n; i++){
          const f = fish[i];
          if (!f.jumping) continue;
          const k = f.jumping / JUMP_T;
          const h = Math.sin(Math.PI * k) * 46;
          const x = f.jx + (k - 0.5) * 40, y = f.jy - h;
          const rot = (k - 0.5) * 2.2; // sobe inclinado, desce de cabeça
          const col = f.gold ? game.palette.gold : game.palette.light;
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
})();
