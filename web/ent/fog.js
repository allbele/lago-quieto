// Névoa baixa: sprite próprio (18% de H) com gradiente + dithering (ruído 1-2%), alpha 0.15,
// 2 passadas com offsets senoidais distintos; dissipa em 60 s após 'fog_clear'.
(function(){
  'use strict';
  const LQ = window.LQ;
  const BASE_A = 0.15, CLEAR_T = 60, H_FRAC = 0.18;
  let clearAt = -1;   // game.t em que começou a dissipar
  let alpha = BASE_A;
  let sp = null, spKey = '';

  function mkRand(seed){ let s = seed | 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function hexToRgb(h){ const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

  // Sprite: perfil vertical em sino (sem borda: 0 nas pontas), janela horizontal suave e
  // ruído de ±1.5% no alpha de cada pixel (quebra o banding do gradiente 8-bit).
  function build(game){
    const W = game.W + 80, H = Math.max(8, Math.round(game.H * H_FRAC));
    const key = W + 'x' + H + '|' + game.palette.fog;
    if (key === spKey && sp) return;
    spKey = key;
    if (!sp) sp = document.createElement('canvas');
    sp.width = W; sp.height = H;
    const g = sp.getContext('2d');
    const [cr, cg, cb] = hexToRgb(game.palette.fog);
    const img = g.createImageData(W, H), d = img.data, r = mkRand(5150);
    const prof = new Float32Array(H), win = new Float32Array(W);
    for (let y = 0; y < H; y++){ const v = Math.sin(Math.PI * (y + 0.5) / H); prof[y] = Math.pow(v, 1.6); }
    for (let x = 0; x < W; x++){ const u = (x + 0.5) / W; win[x] = 0.7 + 0.3 * Math.sin(Math.PI * u); }
    for (let y = 0; y < H; y++){
      for (let x = 0; x < W; x++){
        const i = (y * W + x) * 4;
        let a = prof[y] * win[x] * 0.45;               // pico ~0.45 → névoa fina, não faixa
        a += (r() - 0.5) * 0.03 * a + (r() - 0.5) * 0.008; // dithering 1-2%
        d[i] = cr; d[i + 1] = cg; d[i + 2] = cb;
        d[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
      }
    }
    g.putImageData(img, 0, 0);
  }

  LQ.register('fog', {
    init(game){
      if (game.has('fog_clear')){ clearAt = -CLEAR_T; alpha = 0; }
      build(game);
    },
    onResize(game){ build(game); },
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
      build(game); // barato quando a chave não muda (resize/paleta)
      const t = game.t;
      const y = game.horizonY - sp.height * 0.45;
      // passada 1: deriva lenta
      ctx.globalAlpha = alpha;
      ctx.drawImage(sp, -40 + Math.sin(t * 0.3) * 10, y);
      // passada 2: mais tênue, direção e ritmo diferentes, um pouco mais baixa (profundidade)
      ctx.globalAlpha = alpha * 0.45;
      ctx.drawImage(sp, -40 - Math.sin(t * 0.19 + 1.3) * 14, y + sp.height * 0.3 + Math.sin(t * 0.11) * 3);
      ctx.globalAlpha = 1;
    }
  });
})();
