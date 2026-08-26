// Vagalumes — zen: 5 com 'fireflies', 15 com 'fireflies2'; idle: população por LQ.Idle.visible('vagalume') (até 30).
// Movimento = soma de 2 senos, pulso 2-4 s. Glow via game.sprite.glow na camada 'light'. Fogem 30 px do
// anel (ease 600 ms) e brilham 2 s com tilintar; clique = pulso + nota uma oitava acima. Alguns pousam nas
// pontas dos juncos e, com 3+ pousados próximos, linhas finas de constelação (alpha 0.15) ligam-os.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;
  const MAX = 30, BASE = 5, ZEN_MAX = 15;
  const FLEE_R = 150, FLEE_D = 30, FLEE_T = 0.6, SHINE_T = 2.0;
  const HIT_R = 16, CONST_R = 110;
  const flies = [];
  let lastChime = -1e9, constAlpha = 0, constTimer = 0, lastN = 0;
  const pairs = [];   // pares ligados por linhas de constelação

  // idle: população vem de LQ.Idle.visible(id) (ou de pop em data.js); zen (ou -1): regra atual
  function vis(game, id, zenValue){
    if (game.mode !== 'idle' || !LQ.Idle) return zenValue;
    if (typeof LQ.Idle.visible === 'function'){ const v = LQ.Idle.visible(id); if (v >= 0) return v; }
    const P = LQ.IdleData && LQ.IdleData.pop && LQ.IdleData.pop[id];
    if (!P || typeof LQ.Idle.genCount !== 'function') return zenValue;
    const n = LQ.Idle.genCount(id);
    return n <= 0 ? 0 : Math.min(P.cap, P.base + Math.floor(Math.log2(n)) * P.k);
  }
  // idle: quantidade comprada do gerador (marcos); zen: 0
  function gc(game, id){
    return game.mode === 'idle' && LQ.Idle && typeof LQ.Idle.genCount === 'function' ? LQ.Idle.genCount(id) : 0;
  }

  function mk(rnd){
    return {
      // posição base normalizada (x 0..1, y 0..1 na faixa horizonte→fundo)
      bx: rnd(), by: 0.05 + rnd() * 0.85,
      ax: 0.02 + rnd() * 0.05, ay: 0.02 + rnd() * 0.04,      // amplitudes (fração de W/H)
      f1: 0.15 + rnd() * 0.2, f2: 0.31 + rnd() * 0.3,        // frequências dos senos
      p1: rnd() * 6.28, p2: rnd() * 6.28, p3: rnd() * 6.28, p4: rnd() * 6.28,
      period: 2 + rnd() * 2, pph: rnd() * 6.28,              // pulso 2-4 s
      drift: (rnd() - 0.5) * 0.01,                           // deriva lenta da base
      x: 0, y: 0, fx: 0, fy: 0, flee: 10, shine: 10,         // fuga e brilho (timers)
      state: 0, perch: null, st: 0, land: 0, px: 0, py: 0,    // 0 voa, 1 pousando, 2 pousado, 3 decolando
      sx: 0, sy: 0, wait: 8 + rnd() * 20,                     // origem do pouso; espera até tentar pousar
      born: -1                                                // game.t do nascimento (fade)
    };
  }

  function alive(game){
    const zen = !game.has('fireflies') ? 0 : game.has('fireflies2') ? ZEN_MAX : BASE;
    return Math.min(MAX, vis(game, 'vagalume', zen));
  }

  function freePos(f, game){
    const W = game.W, hy = game.horizonY, wh = game.H - hy, t = game.t;
    const x = (f.bx + f.ax * (Math.sin(t * f.f1 + f.p1) + 0.5 * Math.sin(t * f.f2 + f.p2))) * W;
    const y = hy + (f.by + f.ay * (Math.sin(t * f.f1 * 1.3 + f.p3) + 0.5 * Math.sin(t * f.f2 * 0.8 + f.p4))) * wh;
    return { x, y };
  }

  function chime(game, x, g){
    const now = game.t;
    if (now - lastChime < 0.15) return;   // quase subliminar, nunca em rajada
    lastChime = now;
    game.audio.play('firefly', { x: x / game.W, gain: g });
  }

  const def = {
    init(game){
      flies.length = 0;
      for (let i = 0; i < MAX; i++) flies.push(mk(game.rand));
      // já acordados em sessão anterior: nascem em t=0 (born<0 significa 'ainda não')
      lastN = alive(game);
      if (game.has('fireflies') || game.mode === 'idle') for (let i = 0; i < lastN; i++) flies[i].born = 0;
    },

    onUnlock(id, game){
      const n = alive(game);
      // cada um tilinta ao acordar (em update, quando cruza `born`) — coro esparso
      for (let i = 0; i < n; i++) if (flies[i].born < 0){ flies[i].born = game.t + (i % BASE) * 0.7; flies[i].woke = false; }
      lastN = n;
    },

    update(dt, game){
      const n = alive(game), rnd = game.rand, t = game.t;
      // população mudou (compra/prestígio): novos nascem escalonados; os que saem voltam a 'ainda não'
      if (n !== lastN){
        for (let i = lastN; i < n; i++) if (flies[i].born < 0){ flies[i].born = t + (i - lastN) * 0.7; flies[i].woke = false; }
        for (let i = n; i < lastN; i++){ flies[i].born = -1; flies[i].state = 0; flies[i].perch = null; }
        lastN = n;
      }
      const perches = (LQ.reeds && LQ.reeds.perches) ? LQ.reeds.perches(game) : [];
      const W = game.W, H = game.H;
      // pousar nos juncos: fase 6 (fireflies2, §3) ou, no idle, marco de 5 vagalumes comprados
      const canPerch = game.has('fireflies2') || gc(game, 'vagalume') >= 5;
      for (let i = 0; i < MAX; i++){
        const f = flies[i];
        if (i >= n || f.born < 0 || t < f.born) continue;
        if (f.woke === false){ f.woke = true; const p0 = freePos(f, game); chime(game, p0.x, 1); }
        f.flee += dt; f.shine += dt;
        f.bx += f.drift * dt; if (f.bx < 0.02 || f.bx > 0.98) f.drift = -f.drift;
        const fp = freePos(f, game);

        if (f.state === 0){
          f.wait -= dt;
          if (f.wait <= 0 && perches.length && canPerch && rnd() < 0.5){
            f.perch = perches[Math.floor(rnd() * perches.length)].reed;
            f.state = 1; f.st = 0; f.sx = f.x; f.sy = f.y;
          } else if (f.wait <= 0) f.wait = 10 + rnd() * 20;
          f.x = fp.x; f.y = fp.y;
        } else if (f.state === 1){
          // Pousando: 2,5 s de aproximação suave até a ponta do junco
          f.st += dt;
          const k = game.ease.smoothstep(f.st / 2.5);
          const tx = f.perch.wx, ty = f.perch.wy - 3;
          f.x = f.sx + (tx - f.sx) * k + Math.sin(f.st * 5) * 6 * (1 - k);
          f.y = f.sy + (ty - f.sy) * k;
          if (f.st >= 2.5){ f.state = 2; f.land = 6 + rnd() * 14; }
        } else if (f.state === 2){
          f.land -= dt;
          f.x = f.perch.wx; f.y = f.perch.wy - 3;
          if (f.land <= 0 || f.flee < FLEE_T){
            // Decola: a base passa a ser onde está
            f.state = 0; f.perch = null; f.wait = 15 + rnd() * 25;
            f.bx = Math.min(0.98, Math.max(0.02, f.x / W));
            f.by = Math.min(0.9, Math.max(0.05, (f.y - game.horizonY) / (H - game.horizonY)));
            f.p1 = -t * f.f1; f.p2 = -t * f.f2; f.p3 = -t * f.f1 * 1.3; f.p4 = -t * f.f2 * 0.8;
          }
        }
        // Fuga do anel: 30 px em 600 ms, depois volta devagar
        if (f.flee < FLEE_T){
          const k = game.ease.easeOutQuad(f.flee / FLEE_T);
          f.x += f.fx * k; f.y += f.fy * k;
        } else if (f.flee < FLEE_T + 1.5){
          const k = 1 - (f.flee - FLEE_T) / 1.5;
          f.x += f.fx * k; f.y += f.fy * k;
        }
      }

      // Constelação: 3+ pousados a <110 px entre si (zen: fireflies2; idle: marco de 10 vagalumes)
      pairs.length = 0;
      const perched = [];
      const canConst = game.has('fireflies2') || gc(game, 'vagalume') >= 10;
      if (canConst) for (let i = 0; i < n; i++) if (flies[i].state === 2 && flies[i].born >= 0) perched.push(flies[i]);
      let cluster = false;
      if (perched.length >= 3){
        for (let a = 0; a < perched.length; a++){
          let near = 0;
          for (let b = 0; b < perched.length; b++){
            if (a === b) continue;
            const dx = perched[a].x - perched[b].x, dy = perched[a].y - perched[b].y;
            if (dx * dx + dy * dy < CONST_R * CONST_R){ near++; if (a < b) pairs.push(perched[a], perched[b]); }
          }
          if (near >= 2) cluster = true;
        }
      }
      if (cluster){
        constTimer += dt;
        // Aparece em 1,5 s, fica ~6 s, some em 2 s; depois descansa
        const c = constTimer % 14;
        constAlpha = c < 1.5 ? c / 1.5 : c < 7.5 ? 1 : c < 9.5 ? 1 - (c - 7.5) / 2 : 0;
      } else { constTimer = 0; constAlpha = Math.max(0, constAlpha - dt); }
    },

    draw(layer, ctx, game){
      if (layer !== 'light') return;
      const n = alive(game), t = game.t;
      if (!n) return;
      const P = game.palette;
      const dayFade = 1 - game.dayPhase;                // se retiram no amanhecer
      if (dayFade <= 0.01) return;
      const R = game.eco ? 10 : 14;
      const glow = game.sprite.glow(P.firefly, R);
      const eff = game.unlockFade('fireflies');
      // além dos 5 base: fade de 'fireflies2' (zen); no idle não existe → fade dos vagalumes
      const f2 = game.has('fireflies2') ? game.unlockFade('fireflies2') : eff;

      // Linhas de constelação entre pousados
      if (constAlpha > 0.01 && pairs.length){
        ctx.strokeStyle = P.firefly; ctx.lineWidth = 1;
        ctx.globalAlpha = 0.15 * constAlpha * dayFade * f2;
        ctx.beginPath();
        for (let i = 0; i < pairs.length; i += 2){ ctx.moveTo(pairs[i].x, pairs[i].y); ctx.lineTo(pairs[i + 1].x, pairs[i + 1].y); }
        ctx.stroke();
      }

      ctx.fillStyle = P.light;
      for (let i = 0; i < n; i++){
        const f = flies[i];
        if (f.born < 0 || t < f.born) continue;
        const bornK = game.ease.smoothstep((t - f.born) / 5);
        const fade = (i < BASE ? eff : f2) * bornK * dayFade;
        if (fade <= 0.01) continue;
        // Pulso lento (2-4 s) — respiração de luz
        let b = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / f.period + f.pph);
        b = 0.25 + 0.75 * b * b;
        if (f.state === 2) b *= 0.7;                    // pousado: mais quieto
        let shine = 0;
        if (f.shine < SHINE_T) shine = Math.sin(Math.PI * Math.min(1, f.shine / SHINE_T)) * 0.8;
        const a = Math.min(1, (b * 0.55 + shine)) * fade;
        const s = R * (1 + shine * 0.6);
        ctx.globalAlpha = a;
        ctx.drawImage(glow, f.x - s, f.y - s, s * 2, s * 2);
        // Núcleo claro de 1,5 px
        ctx.globalAlpha = Math.min(1, a * 1.4);
        ctx.fillRect(f.x - 0.75, f.y - 0.75, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    },

    // Anel: quem está a <150 px foge 30 px e brilha 2 s (tilintar)
    onRipple(x, y, game){
      const n = alive(game);
      let any = false;
      for (let i = 0; i < n; i++){
        const f = flies[i];
        if (f.born < 0 || game.t < f.born) continue;
        const dx = f.x - x, dy = f.y - y, d2 = dx * dx + dy * dy;
        if (d2 > FLEE_R * FLEE_R || d2 < 1) continue;
        const d = Math.sqrt(d2);
        f.fx = dx / d * FLEE_D; f.fy = dy / d * FLEE_D;
        f.flee = 0; f.shine = 0; any = true;
      }
      if (any) chime(game, x, 0.5);
    },

    // Clique num vagalume: pulso de brilho + mesma nota uma oitava acima
    onClick(x, y, game){
      const n = alive(game);
      let best = null, bd = HIT_R * HIT_R;
      for (let i = 0; i < n; i++){
        const f = flies[i];
        if (f.born < 0 || game.t < f.born) continue;
        const dx = f.x - x, dy = f.y - y, d2 = dx * dx + dy * dy;
        if (d2 < bd){ bd = d2; best = f; }
      }
      if (!best) return false;
      best.shine = 0;
      best.fx = 0; best.fy = 0;
      const nx = Math.min(1, Math.max(0, best.x / game.W));
      const ny = Math.min(1, Math.max(0, (best.y - game.horizonY) / (game.H - game.horizonY)));
      game.audio.play('pulse', { x: nx, y: ny, gain: 1 });
      return true;
    }
  };

  LQ.register('fireflies', def);
  // leitura (depuração/testes/outras entidades): lista do pool e quantos estão vivos agora
  LQ.fireflies = { list: flies, alive: () => (LQ.game ? alive(LQ.game) : 0) };
})();
