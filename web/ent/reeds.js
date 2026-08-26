// Juncos — silhuetas na margem (3 à esquerda desde o início, mais à direita com 'fireflies2').
// Path2D cacheado por junco; respiração 1.0→1.03→1.0 em 400 ms quando um anel nasce a <120 px;
// balanço ±3° (seno) com o unlock 'wind'. Expõe LQ.reeds.perches() para os vagalumes pousarem.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;
  const BREATH_T = 0.4, BREATH_R = 120, MAX_ANGLE = 3 * Math.PI / 180;
  const reeds = [];       // {side, nx, h, lean, path, tipX, tipY, phase, breath, angle, wx, wy}
  let lastW = 0, lastH = 0;

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

  function makeReed(side, nx, rnd){
    return {
      side, nx,
      h: 0.16 + rnd() * 0.14,           // altura relativa a H
      lean: (rnd() * 0.06 + 0.02) * (rnd() < 0.5 ? -1 : 1),
      head: rnd() < 0.6, leaves: 1 + Math.floor(rnd() * 2),
      phase: rnd() * Math.PI * 2, speed: 0.6 + rnd() * 0.5,
      breath: 10, angle: 0, path: null, tipX: 0, tipY: 0, wx: 0, wy: 0
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
      // 3 à esquerda (sempre)
      reeds.push(makeReed('L', 0.045, rnd), makeReed('L', 0.085, rnd), makeReed('L', 0.125, rnd));
      // 4 à direita (fade com 'fireflies2')
      reeds.push(makeReed('R', 0.905, rnd), makeReed('R', 0.935, rnd), makeReed('R', 0.965, rnd), makeReed('R', 0.985, rnd));
      for (const r of reeds){ r.side = r.side === 'L' ? -1 : 1; }
      rebuild(game);
    },

    onResize(game){ rebuild(game); },
    update(dt, game){
      if (game.W !== lastW || game.H !== lastH) rebuild(game);
      const wind = game.has('wind') ? game.unlockFade('wind') : 0;
      const by = baseY(game);
      for (const r of reeds){
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
      const rightFade = game.has('fireflies2') ? game.unlockFade('fireflies2') : 0;
      const by = baseY(game);
      ctx.fillStyle = game.palette.dark;
      for (const r of reeds){
        const a = r.side < 0 ? 1 : rightFade;
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
      for (const r of reeds){
        if (r.side > 0 && !game.has('fireflies2')) continue;
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

  // API para outras entidades (vagalumes): pontas dos juncos visíveis
  LQ.reeds = {
    perches(game){
      const out = [];
      const right = game.has('fireflies2');
      for (const r of reeds){
        if (r.side > 0 && !right) continue;
        out.push({ x: r.wx, y: r.wy, reed: r });
      }
      return out;
    }
  };
})();
