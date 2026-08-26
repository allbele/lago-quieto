// Lago Quieto — sapos: silhueta na margem com 3 poses (parado, inflado, pulando), coaxam e pulam.
// Zen: 1 sapo. Idle: LQ.Idle.visible('sapo') sapos (até 5), cada um com fade próprio de 1 s.
(function(){
  'use strict';
  const TWO_PI = Math.PI * 2;
  const JUMP_T = 0.7;
  const MAX = 5;
  const frogs = [];   // criados sob demanda até MAX

  // idle: população vem de LQ.Idle.visible(id) (ou de pop em data.js); zen (ou -1): regra atual
  function vis(game, id, zenValue){
    if (game.mode !== 'idle' || !LQ.Idle) return zenValue;
    if (typeof LQ.Idle.visible === 'function'){ const v = LQ.Idle.visible(id); if (v >= 0) return v; }
    const P = LQ.IdleData && LQ.IdleData.pop && LQ.IdleData.pop[id];
    if (!P || typeof LQ.Idle.genCount !== 'function') return zenValue;
    const n = LQ.Idle.genCount(id);
    return n <= 0 ? 0 : Math.min(P.cap, P.base + Math.floor(Math.log2(n)) * P.k);
  }
  function frogCount(game){ return Math.min(MAX, vis(game, 'sapo', 1)); }

  function mk(){
    return { x: 0, y: 0, dir: 1, pose: 0, puff: 0, croakTimer: 50, jumping: 0, jx: 0, jy: 0, tx: 0, ty: 0, blink: 0, shown: -1 };
  }
  function home(f, i, game){
    // senta na margem inferior direita (juncos ficam à esquerda); sapos extras (idle) escalonados à esquerda do 1º
    f.x = i === 0 ? game.W * (0.72 + game.rand() * 0.18)
      : Math.min(game.W - 30, Math.max(game.W * 0.55, game.W * (0.55 + (i - 1) * 0.1 + game.rand() * 0.06)));
    f.y = game.H - 22 - game.rand() * 10;
    f.dir = -1;
    f.croakTimer = 40 + game.rand() * 50 + i * 11;
  }
  function croak(f, game){
    f.puff = 1e-6;
    game.audio.play('frog', { x: f.x / game.W, y: 0.9, gain: 1 });
  }
  function jump(f, game){
    if (f.jumping) return;
    f.jumping = 1e-6; f.jx = f.x; f.jy = f.y;
    // pula para um ponto próximo na margem, virando-se
    let tx = f.x + f.dir * (60 + game.rand() * 50);
    if (tx < game.W * 0.55 || tx > game.W - 30){ f.dir = -f.dir; tx = f.x + f.dir * 80; }
    f.tx = Math.min(game.W - 30, Math.max(game.W * 0.55, tx));
    f.ty = game.H - 22 - game.rand() * 12;
    croak(f, game);
  }
  // garante que existam n sapos posicionados; os que saem (prestígio) perdem o fade
  function ensure(n, game){
    for (let i = 0; i < n; i++){
      if (!frogs[i]){ frogs[i] = mk(); home(frogs[i], i, game); frogs[i].shown = game.t; }
      else if (frogs[i].shown < 0) frogs[i].shown = game.t;
    }
    for (let i = n; i < frogs.length; i++) frogs[i].shown = -1;
  }
  function fadeOf(f, game){
    const base = game.unlockFade('frog');
    if (game.mode !== 'idle') return base;
    return f.shown < 0 ? 0 : base * game.ease.smoothstep((game.t - f.shown) / 1);
  }

  function drawFrog(f, ctx, game, fade){
    let x = f.x, y = f.y, pose = 0, h = 0;
    if (f.jumping > 0){
      const k = f.jumping / JUMP_T;
      h = Math.sin(Math.PI * k) * 34; pose = 2;
    } else if (f.puff > 0) pose = 1;
    const puff = pose === 1 ? Math.sin(Math.PI * f.puff / 0.45) : 0;
    const d = f.dir;
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
    if (f.blink > 0 && pose !== 2){
      ctx.fillStyle = game.palette.light;
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillRect(12, -bh - 10, 1.5, 1.5); ctx.fillRect(7, -bh - 11, 1.5, 1.5);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  LQ.register('frog', {
    init(game){
      frogs.length = 0;
      // o 1º sempre existe (zen: único sapo); os demais nascem conforme a população
      frogs.push(mk()); home(frogs[0], 0, game); frogs[0].shown = -1e9;
      ensure(frogCount(game), game);
    },
    onUnlock(id, game){ if (id === 'frog'){ const n = Math.max(1, frogCount(game)); ensure(n, game); for (let i = 0; i < n; i++) home(frogs[i], i, game); } },
    onResize(game){
      // volta a sentar na margem inferior (y era relativo ao H antigo); x limitado à faixa da direita
      for (const f of frogs){
        f.jumping = 0;
        f.x = Math.min(game.W - 30, Math.max(game.W * 0.55, f.x));
        f.y = game.H - 22 - game.rand() * 10;
      }
    },
    update(dt, game){
      if (!game.has('frog')) return;
      const n = frogCount(game);
      ensure(n, game);
      for (let i = 0; i < n; i++){
        const f = frogs[i];
        if (f.x > game.W - 20) home(f, i, game); // após resize
        if (f.puff > 0){ f.puff += dt; if (f.puff > 0.45) f.puff = 0; }
        if (f.jumping > 0){
          f.jumping += dt;
          const k = Math.min(1, f.jumping / JUMP_T);
          f.x = f.jx + (f.tx - f.jx) * k;
          f.y = f.jy + (f.ty - f.jy) * k;
          if (k >= 1){
            f.jumping = 0;
            // pouso na margem: anel na água logo acima
            game.spawnRipple(f.x - f.dir * 10, f.y - 14, { strength: 0.6, rings: 2 });
            game.spawnDrops(f.x, f.y - 12, 3);
            game.audio.play('plop', { x: f.x / game.W, y: 0.9, gain: 0.2 });
          }
          continue;
        }
        f.croakTimer -= dt;
        if (f.croakTimer <= 0){ f.croakTimer = 40 + game.rand() * 50; croak(f, game); }
        f.blink -= dt;
        if (f.blink <= -0.15) f.blink = 3 + game.rand() * 5;
      }
    },
    onClick(x, y, game){
      if (!game.has('frog') || game.unlockFade('frog') < 0.5) return false;
      const n = frogCount(game);
      for (let i = 0; i < n && i < frogs.length; i++){
        const f = frogs[i];
        if (fadeOf(f, game) < 0.5) continue;
        if (Math.hypot(x - f.x, y - f.y) < 60){
          const was = f.jumping;
          jump(f, game);
          // pulo por clique = impacto (idle ganha moeda; zen ignora). Se já pulava, não conta.
          if (!was && game.emit) game.emit('impact', { x: f.x, y: f.y, strength: 0.5, source: 'frog' });
          return true;
        }
      }
      return false;
    },
    draw(layer, ctx, game){
      if (layer !== 'lilies' || !game.has('frog')) return;
      if (game.unlockFade('frog') <= 0.01) return;
      const n = frogCount(game);
      for (let i = 0; i < n && i < frogs.length; i++){
        const fade = fadeOf(frogs[i], game);
        if (fade <= 0.01) continue;
        drawFrog(frogs[i], ctx, game, fade);
      }
    }
  });

  // leitura (depuração/testes): quantos sapos estão ativos agora
  LQ.frog = { count: () => (LQ.game ? frogCount(LQ.game) : 0) };
})();
