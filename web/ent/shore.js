// Margem que Acende — só idle. Peças permanentes por era (lanterna, píer, barco + aldeia, ponte + templo,
// amanhecer com pássaros), Linha da Margem (medidor logarítmico no horizonte, camada 'hud') e a lanterna
// (LQ.shore.lantern() / light()) que os vagalumes acendem. Silhuetas em 'reeds' (Path2D), glows em 'light'.
// Zen (ou era -1): nada é desenhado nem calculado.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;
  const PIECE_FADE = 8, LIT_T = 1.5, FLASH_T = 0.6, BIRDS_EVERY = 90, GLOW = '#e8b04a';
  const D = () => LQ.IdleData || {};
  const eras = () => D().eras || [];
  const B = () => (D().bonus && D().bonus.lantern) || { radius: 45, need: 5, needPct: 0.3, buff: 0.25, buffSec: 60, cooldown: 90, rateSec: 90, clickMult: 40 };

  let game = null;
  let shownEra = -1;          // era cuja peça já está em cena (a próxima entra em fade)
  let fadeAt = {};            // era → game.t em que a peça começou a aparecer (ausente = já pronta)
  let flash = 10, buffUntil = -1, lit = 10, cooldown = 0;
  let birdsT = 0, birds = [];
  let uiHidden = false, uiT = 0;
  let lastW = 0, lastH = 0;
  let paths = null;           // Path2D cacheados por tamanho
  let lastObj = null, origOverride = null, dawnOn = false;
  let splitMode = false;      // loja embaixo (--shop-h > 0) ou lago baixo: lanterna sobe para não ficar atrás dos toasts
  let woodFor = '', wood = '#3a2a1c'; // tom de madeira (píer/barco) derivado de palette.dark, cacheado por cor

  const isIdle = () => !!(game && game.mode === 'idle' && LQ.Idle);
  const S = () => (game && game.state && game.state.idle) || null;

  // era atual: LQ.Idle.era() se existir, senão pelo life acumulado
  function eraFromLife(life){
    const E = eras(); let e = 0;
    for (let i = 0; i < E.length; i++) if (life >= E[i].life) e = i;
    return e;
  }
  // (lê o estado direto: no init desta entidade o motor ainda não recebeu `game`, e LQ.Idle.era() devolveria 0 —
  //  as peças de um save antigo entrariam todas em fade com sino a cada carregamento)
  function era(){
    if (!isIdle()) return -1;
    const s = S(); if (!s) return -1;
    let e = Math.max(eraFromLife(s.life || 0), Number.isFinite(s.era) ? s.era : 0);
    if (typeof LQ.Idle.era === 'function'){ const m = LQ.Idle.era(); if (Number.isFinite(m)) e = Math.max(e, m); }
    return e;
  }
  // fade 0..1 da peça de uma era (1 = pronta)
  function pieceK(e){
    const cur = era(); if (cur < e) return 0;
    const at = fadeAt[e]; if (at === undefined) return 1;
    return game.ease.smoothstep((game.t - at) / PIECE_FADE);
  }

  // ---------- geometria (relativa a W/H; cache de Path2D) ----------
  function lanternPos(){
    const W = game.W, H = game.H;
    return { x: Math.round(W * 0.085), y: Math.round(H * (splitMode || H < 500 ? 0.5 : 0.62)) }; // acima da pilha de toasts (split: mais alto)
  }
  function build(){
    const sh = document.getElementById('shop'); splitMode = !!sh && sh.offsetHeight > 0 && sh.getBoundingClientRect().top > 1; // loja embaixo do lago
    const W = game.W, H = game.H, hy = game.horizonY, L = lanternPos();
    const p = {};
    // Lanterna de papel numa estaca: poste + caixa (lados levemente curvos) + tampa
    const pole = new Path2D();
    pole.rect(L.x - 1.5, L.y + 12, 3, H - L.y - 8);
    pole.rect(L.x - 7, L.y - 15, 14, 3);
    pole.moveTo(L.x - 3, L.y - 12); pole.lineTo(L.x + 3, L.y - 12); pole.lineTo(L.x + 1.5, L.y - 8); pole.lineTo(L.x - 1.5, L.y - 8); pole.closePath();
    p.pole = pole;
    const body = new Path2D();
    body.moveTo(L.x - 8, L.y - 9); body.quadraticCurveTo(L.x - 11, L.y, L.x - 8, L.y + 10);
    body.lineTo(L.x + 8, L.y + 10); body.quadraticCurveTo(L.x + 11, L.y, L.x + 8, L.y - 9); body.closePath();
    p.body = body;
    // Píer à direita: tábuas em leve perspectiva + estacas
    const py = H * 0.80, px0 = W - W * 0.20, pier = new Path2D();
    pier.moveTo(px0, py - 7); pier.lineTo(W + 2, py - 12); pier.lineTo(W + 2, py + 4); pier.lineTo(px0, py + 2); pier.closePath();
    for (let i = 0; i < 4; i++){ const x = px0 + 4 + i * (W * 0.2 - 8) / 3; pier.rect(x - 2, py, 4, 22 + i * 4); }
    p.pier = pier; p.pierEnd = { x: px0, y: py };
    // Barco a remo amarrado à ponta do píer (casco + banco), balança em update
    const boat = new Path2D(), bx = px0 - 34, by = py + 10;
    boat.moveTo(bx - 22, by); boat.quadraticCurveTo(bx - 14, by + 9, bx, by + 9); boat.quadraticCurveTo(bx + 14, by + 9, bx + 24, by - 1);
    boat.lineTo(bx + 20, by - 4); boat.quadraticCurveTo(bx, by + 2, bx - 20, by - 3); boat.closePath();
    boat.rect(bx - 6, by + 1, 12, 2);
    p.boat = boat; p.boatAt = { x: bx, y: by };
    // Luzes de aldeia na outra margem (horizonte)
    p.village = [0, 1, 2].map(i => ({ x: W * (0.60 + i * 0.035) + (i === 1 ? 6 : 0), y: hy - 3 - (i === 1 ? 3 : 0) }));
    // Ponte em arco no horizonte (esq. do centro) + templo (dir., telhado em duas águas e janela)
    const bx0 = W * 0.30, bx1 = W * 0.46, bh = Math.max(10, hy * 0.05), bridge = new Path2D();
    bridge.moveTo(bx0, hy + 1); bridge.quadraticCurveTo((bx0 + bx1) / 2, hy - bh * 2, bx1, hy + 1);
    bridge.lineTo(bx1 - 6, hy + 1); bridge.quadraticCurveTo((bx0 + bx1) / 2, hy - bh * 1.1, bx0 + 6, hy + 1); bridge.closePath();
    for (let i = 1; i < 6; i++){ const x = bx0 + (bx1 - bx0) * i / 6; bridge.rect(x - 0.6, hy - bh * 1.9 * Math.sin(Math.PI * i / 6) - 5, 1.2, 6); }
    p.bridge = bridge;
    const tx = W * 0.79, th = Math.max(14, hy * 0.07), temple = new Path2D();
    temple.rect(tx - th * 0.55, hy - th * 0.7, th * 1.1, th * 0.72);
    temple.moveTo(tx - th * 0.85, hy - th * 0.66); temple.lineTo(tx, hy - th * 1.25); temple.lineTo(tx + th * 0.85, hy - th * 0.66); temple.closePath();
    temple.rect(tx - th * 0.08, hy - th * 1.45, th * 0.16, th * 0.22);
    p.temple = temple; p.window = { x: tx + th * 0.18, y: hy - th * 0.36, w: Math.max(2, th * 0.14), h: Math.max(3, th * 0.2) };
    paths = p; lastW = W; lastH = H;
  }

  // ---------- amanhecer: compõe rosa 10% no horizonte por cima do override (tinta do prestígio) ----------
  function mixHex(a, b, t){
    const A = parseInt(a.slice(1), 16), Bv = parseInt(b.slice(1), 16), o = [];
    for (let s = 16; s >= 0; s -= 8){ const x = A >> s & 255, y = Bv >> s & 255; o.push(Math.max(0, Math.min(255, Math.round(x + (y - x) * t)))); }
    return '#' + o.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function baseHorizon(){
    const th = (LQ.themes && game.state && LQ.themes[game.state.theme]) || {};
    const n = th.night || th; return n.horizon || '#0b1a33';
  }
  function compose(obj){
    if (!dawnOn) return obj;
    const out = Object.assign({}, obj || {});
    const P = game.palette || {};
    out.horizon = mixHex(out.horizon || baseHorizon(), P.dawn || '#f2b8a2', 0.10);
    return out;
  }
  function installOverride(){
    if (origOverride || !game.setPaletteOverride) return;
    origOverride = game.setPaletteOverride.bind(game);
    // tinta já ativa antes de nós: reconstrói o que themes.js teria passado
    const t = LQ.themes && LQ.themes.currentTint && LQ.themes.currentTint();
    if (t){ lastObj = {}; const th = (LQ.themes[game.state.theme] || {}), base = Object.assign({ zenith: '#050914', horizon: '#0b1a33', shore: '#123a5c', ring: '#1f5f7a' }, th.night || th);
      for (const k of t.keys) if (base[k]) lastObj[k] = mixHex(base[k], t.color, t.amount); }
    game.setPaletteOverride = function(o){ lastObj = o || null; origOverride(compose(lastObj)); };
  }
  function setDawn(on){ if (on === dawnOn) return; dawnOn = on; if (origOverride) origOverride(compose(lastObj)); }

  // ---------- Linha da Margem ----------
  // progresso 0..1 (log) dentro da era; última era → 1
  function progress(){
    const s = S(), E = eras(); if (!s || !E.length) return 0;
    const e = Math.max(0, Math.min(E.length - 1, era()));
    if (e >= E.length - 1) return 1;
    const lo = Math.max(1, E[e].life), hi = Math.max(lo + 1, E[e + 1].life), life = Math.max(lo, s.life || 0);
    return Math.max(0, Math.min(1, Math.log(life / lo) / Math.log(hi / lo)));
  }
  // marcos atingidos na era: por gerador liberado nela, marcos 'at' já alcançados (nós de 2 px)
  function nodes(){
    const E = eras(), e = era(); if (e < 0 || !E[e]) return { hit: 0, total: 0 };
    let hit = 0, total = 0;
    for (const gid of E[e].gens || []){
      const g = LQ.Idle.gen ? LQ.Idle.gen(gid) : null; if (!g) continue;
      const n = LQ.Idle.genCount(gid);
      for (const m of g.milestones || []){ total++; if (n >= m.at) hit++; }
    }
    return { hit, total };
  }
  function bell(degree, x){ if (game && game.audio) game.audio.play('unlock', { degree: ((degree % 5) + 5) % 5, x: x == null ? 0.5 : x, gain: 0.8 }); }

  // 3 chevrons de pássaros cruzando o céu (Amanhecer)
  function flock(){
    const g = game, dir = g.rand() < 0.5 ? 1 : -1;
    for (let i = 0; i < 3; i++) birds.push({ x: dir > 0 ? -30 - i * 26 : g.W + 30 + i * 26, y: g.horizonY * (0.25 + i * 0.06 + g.rand() * 0.05), vx: dir * (32 + g.rand() * 8), ph: g.rand() * 6.28 });
  }

  // ---------- desenho ----------
  function drawSil(ctx, path, k, P, color){
    if (k <= 0.005) return;
    ctx.globalAlpha = k; ctx.fillStyle = color || P.dark; ctx.fill(path);
  }
  // madeira: palette.dark puxado para castanho (lê-se como tábua, não como junco)
  function woodColor(P){
    const d = typeof P.dark === 'string' && /^#[0-9a-f]{6}$/i.test(P.dark) ? P.dark : '#123a5c';
    if (d !== woodFor){ woodFor = d; wood = mixHex(d, '#6b4a2a', 0.55); }
    return wood;
  }
  // sombra curta na água (2 px abaixo da peça)
  function shadow(ctx, path, k, P){
    if (k <= 0.005) return;
    ctx.save(); ctx.translate(0, 2); ctx.globalAlpha = k * 0.35; ctx.fillStyle = P.dark; ctx.fill(path); ctx.restore();
  }
  function drawReeds(ctx){
    const P = game.palette, p = paths, t = game.t;
    const k1 = pieceK(1), k2 = pieceK(2), k3 = pieceK(3), k4 = pieceK(4), k5 = pieceK(5);
    if (k1 > 0){ drawSil(ctx, p.pole, k1, P);
      // corpo da lanterna: papel âmbar fraco (apagada) ou aceso
      const glowK = lit < LIT_T ? Math.sin(Math.PI * Math.min(1, lit / LIT_T)) : 0;
      ctx.globalAlpha = k1 * (0.35 + 0.55 * glowK); ctx.fillStyle = GLOW; ctx.fill(p.body);
      ctx.globalAlpha = k1 * 0.8; ctx.strokeStyle = P.dark; ctx.lineWidth = 1; ctx.stroke(p.body); }
    if (k2 > 0){ shadow(ctx, p.pier, k2, P); drawSil(ctx, p.pier, k2, P, woodColor(P)); }
    if (k3 > 0){
      // barco balança devagar, amarrado à ponta do píer
      const bob = Math.sin(t * 0.9) * 1.5, rot = Math.sin(t * 0.7) * 0.03;
      ctx.save(); ctx.translate(p.boatAt.x, p.boatAt.y + bob); ctx.rotate(rot); ctx.translate(-p.boatAt.x, -p.boatAt.y);
      shadow(ctx, p.boat, k3, P); drawSil(ctx, p.boat, k3, P, woodColor(P)); ctx.restore();
      ctx.globalAlpha = k3 * 0.8; ctx.strokeStyle = P.dark; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(p.boatAt.x + 24, p.boatAt.y - 1 + bob); ctx.quadraticCurveTo(p.pierEnd.x - 6, p.pierEnd.y + 8, p.pierEnd.x + 2, p.pierEnd.y + 2); ctx.stroke();
      // casinhas da aldeia (silhuetas mínimas atrás das luzes)
      ctx.globalAlpha = k3; ctx.fillStyle = P.dark;
      for (const v of p.village) ctx.fillRect(v.x - 5, v.y - 4, 10, 7);
    }
    if (k4 > 0){ drawSil(ctx, p.bridge, k4, P); drawSil(ctx, p.temple, k4, P); }
    if (k5 > 0 && birds.length){
      ctx.globalAlpha = k5 * 0.55; ctx.strokeStyle = P.light; ctx.lineWidth = 1.2; ctx.beginPath(); // claros: o céu ainda é noite
      for (const b of birds){ const w = 5 + Math.sin(b.ph) * 2.5; ctx.moveTo(b.x - 6, b.y - w * 0.5); ctx.lineTo(b.x, b.y + 1); ctx.lineTo(b.x + 6, b.y - w * 0.5); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawLight(ctx){
    const P = game.palette, p = paths, t = game.t, L = lanternPos();
    const k1 = pieceK(1), k3 = pieceK(3), k4 = pieceK(4);
    const dayFade = 1 - (game.dayPhase || 0);
    if (k1 > 0){
      // lanterna: âmbar fraco sempre; acesa → glow forte 1,5 s
      const glowK = lit < LIT_T ? Math.sin(Math.PI * Math.min(1, lit / LIT_T)) : 0;
      const r = 26 + glowK * 40, g = game.sprite.glow(GLOW, r);
      ctx.globalAlpha = k1 * (0.16 + 0.7 * glowK) * dayFade;
      ctx.drawImage(g, L.x - r, L.y - r, r * 2, r * 2);
    }
    if (k3 > 0){
      const g = game.sprite.glow(GLOW, 8), lk = lit < LIT_T ? Math.sin(Math.PI * Math.min(1, lit / LIT_T)) : 0;
      for (let i = 0; i < p.village.length; i++){
        const v = p.village[i], fl = 0.75 + 0.25 * Math.sin(t * (1.7 + i * 0.4) + i * 2.1);
        ctx.globalAlpha = k3 * (0.45 + 0.5 * lk) * fl * dayFade;
        ctx.drawImage(g, v.x - 8, v.y - 8, 16, 16);
        ctx.fillStyle = GLOW; ctx.fillRect(v.x - 1, v.y - 1, 2, 2);
        // reflexo curto na água
        ctx.globalAlpha = k3 * 0.18 * fl * dayFade; ctx.fillRect(v.x - 0.5, v.y + 4, 1, 10 + 6 * Math.sin(t * 2 + i));
      }
    }
    if (k4 > 0){
      const w = p.window, lk = lit < LIT_T ? Math.sin(Math.PI * Math.min(1, lit / LIT_T)) : 0, g = game.sprite.glow(GLOW, 10);
      ctx.globalAlpha = k4 * (0.35 + 0.6 * lk) * dayFade; ctx.drawImage(g, w.x + w.w / 2 - 10, w.y + w.h / 2 - 10, 20, 20);
      ctx.globalAlpha = k4 * (0.8 + 0.2 * lk) * dayFade; ctx.fillStyle = GLOW; ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    ctx.globalAlpha = 1;
  }
  // silhueta mínima da próxima peça (destino do traço), centrada em (x, y), ~10 px
  function nextMark(ctx, x, y, piece){
    ctx.beginPath();
    if (piece === 'lantern'){ ctx.rect(x - 3, y - 9, 6, 7); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 4); }
    else if (piece === 'pier'){ ctx.moveTo(x - 7, y - 5); ctx.lineTo(x + 7, y - 5); for (const dx of [-5, 0, 5]){ ctx.moveTo(x + dx, y - 5); ctx.lineTo(x + dx, y + 1); } }
    else if (piece === 'boat'){ ctx.moveTo(x - 7, y - 5); ctx.quadraticCurveTo(x, y + 4, x + 7, y - 5); ctx.moveTo(x, y - 5); ctx.lineTo(x, y - 12); }
    else if (piece === 'bridge'){ ctx.moveTo(x - 8, y - 1); ctx.quadraticCurveTo(x, y - 12, x + 8, y - 1); ctx.moveTo(x - 8, y - 1); ctx.lineTo(x + 8, y - 1); }
    else if (piece === 'dawn'){ ctx.arc(x, y - 1, 6, Math.PI, 0); ctx.moveTo(x - 9, y - 1); ctx.lineTo(x + 9, y - 1); }
    else return;
    ctx.stroke();
  }
  function drawHud(ctx){
    if (uiHidden && !(game.sinceClick < 10)) return; // barra oculta: some, salvo enquanto o jogador está clicando
    const s = S(); if (!s) return;
    const P = game.palette, t = game.t, W = game.W, hy = game.horizonY + 0.5;
    const e = era(), x0 = e >= 1 ? lanternPos().x + 14 : Math.round(W * 0.06), maxLen = W - x0 - Math.round(W * 0.05);
    const prog = progress(), len = Math.max(0, maxLen * prog);
    // destino: a próxima peça em alpha .2 na ponta final do traço
    const nxt = eras()[e + 1];
    if (nxt && nxt.piece && nxt.piece !== 'none'){ ctx.globalAlpha = 0.2; ctx.strokeStyle = P.light; ctx.lineWidth = 1; nextMark(ctx, x0 + maxLen, hy - 3, nxt.piece); }
    const buffOn = (typeof LQ.Idle.buffMult === 'function' && LQ.Idle.buffMult() > 1) || t < buffUntil;
    let a = 0.35;
    if (prog >= 0.9 && prog < 1) a = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 3));
    const fl = flash < FLASH_T ? Math.sin(Math.PI * flash / FLASH_T) : 0;
    const col = buffOn ? GLOW : P.light;
    if (fl > 0){ ctx.globalAlpha = fl * 0.7; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, hy); ctx.lineTo(x0 + maxLen, hy); ctx.stroke(); }
    if (len > 1){
      ctx.globalAlpha = a * (buffOn ? 1.6 : 1); ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, hy); ctx.lineTo(x0 + len, hy); ctx.stroke();
      // ponta viva
      ctx.globalAlpha = Math.min(1, a * 2.2); ctx.fillStyle = col; ctx.fillRect(x0 + len - 1, hy - 1, 2, 2);
      // nós: marcos atingidos na era, distribuídos ao longo do traço
      const nd = nodes();
      if (nd.hit > 0 && nd.total > 0){
        ctx.globalAlpha = Math.min(1, a * 2);
        for (let i = 1; i <= nd.hit; i++){ const x = x0 + len * i / (nd.total + 1); ctx.fillRect(x - 1, hy - 1, 2, 2); }
      }
    }
    ctx.globalAlpha = 1;
  }

  const def = {
    init(g){
      game = g; paths = null; fadeAt = {}; birds = []; birdsT = 0; flash = 10; lit = 10; cooldown = 0; buffUntil = -1;
      if (!isIdle()){ shownEra = -1; return; }
      shownEra = era();
      build();
      installOverride();
      setDawn(shownEra >= 5);
    },
    onResize(g){ if (isIdle() && g) build(); },
    update(dt, g){
      if (!isIdle()) return;
      if (g.W !== lastW || g.H !== lastH) build();
      const e = era(); if (e < 0) return;
      if (e > shownEra){
        // completou a era: flash, sino (grau = era) e peças novas em fade de 8 s
        if (shownEra >= 0){ flash = 0; bell(e, 0.5); for (let i = shownEra + 1; i <= e; i++) fadeAt[i] = g.t; }
        shownEra = e;
      }
      setDawn(e >= 5);
      flash += dt; lit += dt;
      if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
      uiT += dt; if (uiT > 0.25){ uiT = 0; uiHidden = document.body.classList.contains('uihidden'); }
      // pássaros do Amanhecer: 3 chevrons a cada 90 s
      if (e >= 5){
        birdsT += dt;
        if (birdsT >= BIRDS_EVERY && !birds.length){ birdsT = 0; flock(); }
        for (let i = birds.length - 1; i >= 0; i--){ const b = birds[i]; b.x += b.vx * dt; b.ph += dt * 7; if (b.x < -60 || b.x > g.W + 60) birds.splice(i, 1); }
      } else birds.length = 0;
    },
    draw(layer, ctx, g){
      if (!isIdle() || !paths || era() < 0) return;
      if (layer === 'reeds') drawReeds(ctx);
      else if (layer === 'light') drawLight(ctx);
      else if (layer === 'hud') drawHud(ctx);
    }
  };
  LQ.register('shore', def);

  LQ.shore = {
    // zona da lanterna: armed = pode acender agora (Era 1+, sem cooldown, não acesa)
    lantern(){
      if (!isIdle() || !game || era() < 1){ return { x: 0, y: 0, r: 0, armed: false, lit: false, cooldown: 0 }; }
      const L = lanternPos();
      return { x: L.x, y: L.y, r: B().radius || 45, armed: cooldown <= 0 && lit >= LIT_T, lit: lit < LIT_T, cooldown };
    },
    // acende: glow 1,5 s (aldeia/templo acendem junto), cooldown, Linha da Margem dourada enquanto o buff durar
    light(){
      if (!isIdle() || era() < 1 || cooldown > 0 || lit < LIT_T) return false;
      const b = B(); lit = 0; cooldown = b.cooldown || 90; buffUntil = game.t + (b.buffSec || 60);
      return true;
    },
    era, flock,
    state(){ return { era: era(), shownEra, progress: progress(), nodes: nodes(), lit: lit < LIT_T, cooldown, flash: flash < FLASH_T, buffOn: !!game && game.t < buffUntil, birds: birds.length, dawn: dawnOn, fading: Object.keys(fadeAt).filter(k => pieceK(+k) < 1).map(Number) }; }
  };
})();
