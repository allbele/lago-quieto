// Névoa baixa: faixa com gradiente cacheado (game.fogSprite), alpha 0.15, offset senoidal; dissipa em 60 s.
(function(){
  'use strict';
  const LQ = window.LQ;
  const BASE_A = 0.15, CLEAR_T = 60;
  let clearAt = -1;   // game.t em que começou a dissipar
  let alpha = BASE_A;

  LQ.register('fog', {
    init(game){
      if (game.has('fog_clear')){ clearAt = -CLEAR_T; alpha = 0; }
    },
    onUnlock(id, game){
      if (id === 'fog_clear' && clearAt < 0){
        clearAt = game.t;
        game.audio.ambient.set({ fogOpen: true });
      }
    },
    update(dt, game){
      let k = 1;
      if (clearAt >= 0) k = 1 - game.ease.smoothstep((game.t - clearAt) / CLEAR_T);
      alpha = BASE_A * k * (1 - 0.6 * game.dayPhase);
    },
    draw(layer, ctx, game){
      if (layer !== 'fog' || alpha < 0.003) return;
      const sp = game.fogSprite; if (!sp) return;
      const off = Math.sin(game.t * 0.3) * 10;
      const y = game.horizonY - sp.height * 0.45;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sp, -20 + off, y);
      // segunda passada mais tênue e defasada dá profundidade
      ctx.globalAlpha = alpha * 0.4;
      ctx.drawImage(sp, -20 - off * 0.6, y + sp.height * 0.25);
      ctx.globalAlpha = 1;
    }
  });
})();
