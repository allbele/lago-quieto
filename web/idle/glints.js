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
    return { x: 20 + game.rand() * Math.max(40, game.W - 40 - sw), y: game.horizonY + 20 + game.rand() * Math.max(10, game.H - game.horizonY - 90) };
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
  // hooks p/ teste: force() faz nascer agora; state() lê o brilho atual
  LQ.glints = {
    force(){ timer = 0; },
    state(){ return { on: glint.on, x: glint.x, y: glint.y, life: glint.life, timer }; }
  };
})();
