// Juncos — silhuetas na margem. Zen: 3 à esquerda desde o início, 4 à direita com 'fireflies2'.
// Idle: LQ.Idle.visible('juncosL'/'juncosR') (até 8 + 8), cada junco novo com fade próprio de 1 s.
// Path2D cacheado por junco; respiração 1.0→1.03→1.0 em 400 ms quando um anel nasce a <120 px;
// balanço ±3° (seno) com o unlock 'wind'. Expõe LQ.reeds.perches() para os vagalumes pousarem.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;
  const BREATH_T = 0.4, BREATH_R = 120, MAX_ANGLE = 3 * Math.PI / 180;
  const PER_SIDE = 8;
  const reeds = [];       // {side, idx, nx, h, lean, path, tipX, tipY, phase, breath, angle, wx, wy, shown}
  let lastW = 0, lastH = 0;

  // idle: população vem de LQ.Idle.visible(id) (ou de pop em data.js); zen (ou -1): regra atual
  function vis(game, id, zenValue){
    if (game.mode !== 'idle' || !LQ.Idle) return zenValue;
    if (typeof LQ.Idle.visible === 'function'){ const v = LQ.Idle.visible(id); if (v >= 0) return v; }
    const P = LQ.IdleData && LQ.IdleData.pop && LQ.IdleData.pop[id];
    if (!P || typeof LQ.Idle.genCount !== 'function') return zenValue;
    const n = LQ.Idle.genCount('juncos');
    return n <= 0 ? 0 : Math.min(P.cap, P.base + Math.floor(Math.log2(n)) * P.k);
  }
  function countL(game){ return Math.min(PER_SIDE, vis(game, 'juncosL', 3)); }
  function countR(game){ return Math.min(PER_SIDE, vis(game, 'juncosR', game.has('fireflies2') ? 4 : 0)); }
  function visibleReed(r, nL, nR){ return r.idx < (r.side < 0 ? nL : nR); }

  // Constrói a Path2D de um junco em coordenadas locais (base na origem, y para cima é negativo)
  function buildPath(r, game){
    const H = game.H;
    const h = r.h * H, lean = r.lean * H;
    const p = new Path2D();
    // Caule: curva fina afunilando até a ponta
    const w0 = 3.2, tx = lean, ty = -h;
    p.moveTo(-w0 * 0.5, 0);
    p.quadraticCurveTo(lean * 0.35 - 1, -h * 0.55, tx - 0.6, ty);
    p.lineTo(tx + 0.6, ty);
    p.quadraticCurveTo(lean * 0.35 + 1, -h * 0.55, w0 * 0.5, 0);
    p.closePath();
    // Espiga (tipo taboa) em alguns juncos
    if (r.head){
      p.ellipse(tx, ty + h * 0.06, 2.6, h * 0.07, r.lean * 0.6, 0, Math.PI * 2);
    }
    // Uma ou duas folhas saindo do caule
    for (let i = 0; i < r.leaves; i++){
      const f = 0.25 + i * 0.28;                  // altura relativa da folha
      const sx = lean * f * 0.5, sy = -h * f;
      const dir = (i % 2 === 0 ? -1 : 1) * r.side;
      const lx = sx + dir * h * 0.16, ly = sy - h * 0.22;
      p.moveTo(sx, sy);
      p.quadraticCurveTo(sx + dir * h * 0.04, sy - h * 0.14, lx, ly);
      p.quadraticCurveTo(sx + dir * h * 0.09, sy - h * 0.08, sx + dir * 2, sy + 4);
      p.closePath();
    }
    r.path = p; r.tipX = tx; r.tipY = ty;
  }

  function makeReed(side, idx, nx, rnd){
    return {
      side, idx, nx,
      h: 0.16 + rnd() * 0.14,           // altura relativa a H
      lean: (rnd() * 0.06 + 0.02) * (rnd() < 0.5 ? -1 : 1),
      head: rnd() < 0.6, leaves: 1 + Math.floor(rnd() * 2),
      phase: rnd() * Math.PI * 2, speed: 0.6 + rnd() * 0.5,
      breath: 10, angle: 0, path: null, tipX: 0, tipY: 0, wx: 0, wy: 0,
      shown: -1                         // game.t em que apareceu (idle); -1 = invisível
    };
  }

  function rebuild(game){
    for (const r of reeds) buildPath(r, game);
    lastW = game.W; lastH = game.H;
  }

  function baseY(game){ return game.H + 2; }   // base um pouco abaixo da borda inferior
  function baseX(r, game){ return r.nx * game.W; }

  const def = {
    init(game){
      const rnd = game.rand;
      reeds.length = 0;
      // Posições: os 3 L e 4 R primeiros são os literais do zen (criados na mesma ordem → mesmo rand)
      const NX_L = [0.045, 0.085, 0.125, 0.165, 0.205, 0.245, 0.285, 0.325];
      const NX_R = [0.985, 0.965, 0.935, 0.905, 0.865, 0.825, 0.785, 0.745];
      for (let i = 0; i < 3; i++) reeds.push(makeReed('L', i, NX_L[i], rnd));
      for (let i = 0; i < 4; i++) reeds.push(makeReed('R', i, NX_R[i], rnd));
      for (let i = 3; i < PER_SIDE; i++) reeds.push(makeReed('L', i, NX_L[i], rnd));
      for (let i = 4; i < PER_SIDE; i++) reeds.push(makeReed('R', i, NX_R[i], rnd));
      for (const r of reeds){ r.side = r.side === 'L' ? -1 : 1; }
      // já presentes ao iniciar: sem fade próprio
      const nL = countL(game), nR = countR(game);
      for (const r of reeds) r.shown = visibleReed(r, nL, nR) ? -1e9 : -1;
      rebuild(game);
    },

    onResize(game){ rebuild(game); },
    update(dt, game){
      if (game.W !== lastW || game.H !== lastH) rebuild(game);
      const wind = game.has('wind') ? game.unlockFade('wind') : 0;
      const by = baseY(game);
      const nL = countL(game), nR = countR(game);
      for (const r of reeds){
        // visibilidade (idle: compra/prestígio) → fade próprio
        if (visibleReed(r, nL, nR)){ if (r.shown < 0) r.shown = game.t; } else r.shown = -1;
        r.breath += dt;
        // Balanço: soma de dois senos lentos, amplitude ±3°
        const s = Math.sin(game.t * r.speed + r.phase) * 0.75 + Math.sin(game.t * r.speed * 2.3 + r.phase * 1.7) * 0.25;
        r.angle = MAX_ANGLE * s * wind;
        // Ponta em coordenadas de tela (para os vagalumes pousarem)
        const c = Math.cos(r.angle), sn = Math.sin(r.angle);
        r.wx = baseX(r, game) + r.tipX * c - r.tipY * sn;
        r.wy = by + r.tipX * sn + r.tipY * c;
      }
    },

    // Camada 'reeds' (depois da água): primeiro plano da margem
    draw(layer, ctx, game){
      if (layer !== 'reeds') return;
      const idle = game.mode === 'idle';
      const rightFade = game.has('fireflies2') ? game.unlockFade('fireflies2') : 0;
      const nL = countL(game), nR = countR(game);
      const by = baseY(game);
      ctx.fillStyle = game.palette.dark;
      for (const r of reeds){
        if (!visibleReed(r, nL, nR)) continue;
        let a;
        if (idle) a = r.shown < 0 ? 0 : game.ease.smoothstep((game.t - r.shown) / 1);
        else a = r.side < 0 ? 1 : rightFade;
        if (a <= 0.005) continue;
        let sc = 1;
        if (r.breath < BREATH_T) sc = 1 + 0.03 * Math.sin(Math.PI * r.breath / BREATH_T);
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(baseX(r, game), by);
        ctx.rotate(r.angle);
        if (sc !== 1) ctx.scale(sc, sc);
        ctx.fill(r.path);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    // Anel perto da base → respiração
    onRipple(x, y, game){
      const by = baseY(game);
      const nL = countL(game), nR = countR(game);
      for (const r of reeds){
        if (!visibleReed(r, nL, nR)) continue;
        // distância ao segmento base→ponta (não só à base, que fica fora da tela)
        const bx = baseX(r, game), vx = r.wx - bx, vy = r.wy - by;
        const len2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((x - bx) * vx + (y - by) * vy) / len2));
        const dx = x - (bx + vx * t), dy = y - (by + vy * t);
        if (dx * dx + dy * dy < BREATH_R * BREATH_R) r.breath = 0;
      }
    }
  };

  LQ.register('reeds', def);

  // API para outras entidades (vagalumes): pontas dos juncos visíveis; visible(): quantos aparecem agora
  LQ.reeds = {
    perches(game){
      const out = [];
      const nL = countL(game), nR = countR(game);
      for (const r of reeds){
        if (!visibleReed(r, nL, nR)) continue;
        out.push({ x: r.wx, y: r.wy, reed: r });
      }
      return out;
    },
    visible(){ const g = LQ.game; return g ? countL(g) + countR(g) : 0; },
    sides(){ const g = LQ.game; return g ? { L: countL(g), R: countR(g) } : { L: 0, R: 0 }; }
  };
})();
