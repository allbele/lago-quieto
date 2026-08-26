// Lago Quieto — sapo: silhueta na margem com 3 poses (parado, inflado, pulando), coaxa e pula.
(function(){
  'use strict';
  const TWO_PI = Math.PI * 2;
  const JUMP_T = 0.7;
  const frog = { x: 0, y: 0, dir: 1, pose: 0, puff: 0, croakTimer: 50, jumping: 0, jx: 0, jy: 0, tx: 0, ty: 0, blink: 0 };

  function home(game){
    // senta na margem inferior direita (juncos ficam à esquerda)
    frog.x = game.W * (0.72 + game.rand() * 0.18);
    frog.y = game.H - 22 - game.rand() * 10;
    frog.dir = -1;
    frog.croakTimer = 40 + game.rand() * 50;
  }
  function croak(game){
    frog.puff = 1e-6;
    game.audio.play('frog', { x: frog.x / game.W, y: 0.9, gain: 1 });
  }
  function jump(game){
    if (frog.jumping) return;
    frog.jumping = 1e-6; frog.jx = frog.x; frog.jy = frog.y;
    // pula para um ponto próximo na margem, virando-se
    let tx = frog.x + frog.dir * (60 + game.rand() * 50);
    if (tx < game.W * 0.55 || tx > game.W - 30){ frog.dir = -frog.dir; tx = frog.x + frog.dir * 80; }
    frog.tx = Math.min(game.W - 30, Math.max(game.W * 0.55, tx));
    frog.ty = game.H - 22 - game.rand() * 12;
    croak(game);
  }

  LQ.register('frog', {
    init(game){ home(game); },
    onUnlock(id, game){ if (id === 'frog') home(game); },
    onResize(game){
      // volta a sentar na margem inferior (y era relativo ao H antigo); x limitado à faixa da direita
      frog.jumping = 0;
      frog.x = Math.min(game.W - 30, Math.max(game.W * 0.55, frog.x));
      frog.y = game.H - 22 - game.rand() * 10;
    },
    update(dt, game){
      if (!game.has('frog')) return;
      if (frog.x > game.W - 20) home(game); // após resize
      if (frog.puff > 0){ frog.puff += dt; if (frog.puff > 0.45) frog.puff = 0; }
      if (frog.jumping > 0){
        frog.jumping += dt;
        const k = Math.min(1, frog.jumping / JUMP_T);
        frog.x = frog.jx + (frog.tx - frog.jx) * k;
        frog.y = frog.jy + (frog.ty - frog.jy) * k;
        if (k >= 1){
          frog.jumping = 0;
          // pouso na margem: anel na água logo acima
          game.spawnRipple(frog.x - frog.dir * 10, frog.y - 14, { strength: 0.6, rings: 2 });
          game.spawnDrops(frog.x, frog.y - 12, 3);
          game.audio.play('plop', { x: frog.x / game.W, y: 0.9, gain: 0.2 });
        }
        return;
      }
      frog.croakTimer -= dt;
      if (frog.croakTimer <= 0){ frog.croakTimer = 40 + game.rand() * 50; croak(game); }
      frog.blink -= dt;
      if (frog.blink <= -0.15) frog.blink = 3 + game.rand() * 5;
    },
    onClick(x, y, game){
      if (!game.has('frog') || game.unlockFade('frog') < 0.5) return false;
      if (Math.hypot(x - frog.x, y - frog.y) < 60){ jump(game); return true; }
      return false;
    },
    draw(layer, ctx, game){
      if (layer !== 'lilies' || !game.has('frog')) return;
      const fade = game.unlockFade('frog');
      if (fade <= 0.01) return;
      let x = frog.x, y = frog.y, pose = 0, h = 0;
      if (frog.jumping > 0){
        const k = frog.jumping / JUMP_T;
        h = Math.sin(Math.PI * k) * 34; pose = 2;
      } else if (frog.puff > 0) pose = 1;
      const puff = pose === 1 ? Math.sin(Math.PI * frog.puff / 0.45) : 0;
      const d = frog.dir;
      ctx.save();
      ctx.translate(x, y - h);
      ctx.scale(d, 1);
      ctx.fillStyle = game.palette.dark;
      ctx.globalAlpha = 0.95 * fade;
      // corpo
      const bw = 14 + (pose === 2 ? 3 : 0), bh = 9 - (pose === 2 ? 2 : 0);
      ctx.beginPath(); ctx.ellipse(0, -bh, bw, bh, pose === 2 ? -0.35 : 0, 0, TWO_PI); ctx.fill();
      // cabeça
      ctx.beginPath(); ctx.ellipse(10, -bh - 4, 8, 6, 0, 0, TWO_PI); ctx.fill();
      // olhos (protuberâncias)
      ctx.beginPath(); ctx.arc(12, -bh - 9, 2.6, 0, TWO_PI); ctx.arc(7, -bh - 10, 2.4, 0, TWO_PI); ctx.fill();
      // papo inflado
      if (puff > 0){
        ctx.globalAlpha = 0.85 * fade;
        ctx.beginPath(); ctx.ellipse(10, -bh + 2, 6 + 6 * puff, 4 + 5 * puff, 0, 0, TWO_PI); ctx.fill();
        ctx.globalAlpha = 0.95 * fade;
      }
      // pernas
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = game.palette.dark;
      ctx.beginPath();
      if (pose === 2){
        ctx.moveTo(-10, -bh); ctx.lineTo(-20, -bh + 4); ctx.lineTo(-30, -bh + 10); // traseira esticada
        ctx.moveTo(8, -bh + 4); ctx.lineTo(14, -bh + 12);                          // dianteira
      } else {
        ctx.moveTo(-10, -bh + 2); ctx.lineTo(-18, -bh - 4); ctx.lineTo(-14, 0);    // traseira dobrada
        ctx.moveTo(8, -bh + 5); ctx.lineTo(10, 0);                                 // dianteira
      }
      ctx.stroke();
      // reflexo dos olhos (pisca)
      if (frog.blink > 0 && pose !== 2){
        ctx.fillStyle = game.palette.light;
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillRect(12, -bh - 10, 1.5, 1.5); ctx.fillRect(7, -bh - 11, 1.5, 1.5);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  });
})();
