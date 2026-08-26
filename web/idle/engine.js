// Lago Quieto — modo Idle: motor da economia (taxa, compras, upgrades, metas, offline, anéis automáticos).
// API pública em LQ.Idle; a entidade 'idle-engine' só age quando game.mode === 'idle'.
window.LQ = window.LQ || {};
LQ.Idle = (function(){
  'use strict';
  const U = LQ.IdleUtil;
  const D = () => LQ.IdleData;
  let game = null;
  const S = () => (game && game.state && game.state.idle) || null;
  const MAXV = 1e300; // teto de cur/life (evita Infinity → HUD '0' e save zerado no migrate)
  function clampState(s){
    if (!Number.isFinite(s.cur) || s.cur > MAXV) s.cur = Number.isNaN(s.cur) ? 0 : Math.min(MAXV, Math.max(0, s.cur));
    if (!Number.isFinite(s.life) || s.life > MAXV) s.life = Number.isNaN(s.life) ? 0 : Math.min(MAXV, Math.max(0, s.life));
  }

  // ---------- Emissor simples ----------
  const listeners = {};
  function on(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); return () => off(ev, fn); }
  function off(ev, fn){ const l = listeners[ev]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
  function emit(ev, payload){
    const l = listeners[ev]; if (!l) return;
    for (let i = 0; i < l.length; i++){ try { l[i](payload, game); } catch (e) { /* ouvinte nunca derruba o motor */ } }
  }

  // ---------- Consultas ----------
  const gen = id => D().gens.find(g => g.id === id) || null;
  const upgrade = id => D().upgrades.find(u => u.id === id) || null;
  const has = id => { const s = S(); return !!s && s.ups.indexOf(id) >= 0; };
  function genCount(id){ const s = S(); return s ? (s.gens[id] || 0) : 0; }
  // multiplicador do gerador (upgrades kind 'mult' possuídos)
  function genMult(id){
    let m = 1;
    for (const u of D().upgrades) if (u.kind === 'mult' && u.gen === id && has(u.id)) m *= u.value;
    return m;
  }
  function clickMult(){ let m = 1; for (const u of D().upgrades) if (u.kind === 'click' && has(u.id)) m *= u.value; return m; }
  function autoClicks(){ let a = 0; for (const u of D().upgrades) if (u.kind === 'auto' && has(u.id)) a += u.value; return a; }
  function globalMult(){ const s = S(); return s ? s.prest.mult : 1; }
  // ondas/s vindas dos geradores
  function rate(){
    const s = S(); if (!s) return 0;
    let r = 0;
    for (const g of D().gens){ const n = s.gens[g.id] || 0; if (n) r += n * g.rate * genMult(g.id); }
    return r * globalMult();
  }
  // taxa por unidade de um gerador (com os mults do gerador; sem prestígio)
  function genRate(id){ const g = gen(id); return g ? g.rate * genMult(id) : 0; }
  function clickPower(){ return (D().clickBase || 1) * clickMult() * globalMult(); }
  // taxa total exibível (geradores + auto-clique)
  function totalRate(){ return rate() + autoClicks() * clickPower(); }
  // teto offline em segundos (8 h base; upgrades kind 'offline' em horas)
  function offlineCap(){
    let h = 8;
    for (const u of D().upgrades) if (u.kind === 'offline' && has(u.id)) h = Math.max(h, u.value);
    return h * 3600;
  }
  function genCost(id, n){
    const g = gen(id); if (!g) return Infinity;
    return U.cost(g.base, g.growth, genCount(id), n === undefined ? 1 : n);
  }
  function maxBuy(id){ const g = gen(id), s = S(); return g && s ? U.maxAffordable(g.base, g.growth, genCount(id), s.cur) : 0; }
  function canBuy(id, n){
    const s = S(); if (!s || !gen(id)) return false;
    if (n === 'max') return maxBuy(id) >= 1;
    n = Math.floor(n || 1); return n >= 1 && genCost(id, n) <= s.cur;
  }
  // upgrade comprável: tem custo, não possuído, e (se tiver 'at') gerador já no marco
  function upgradeAvailable(id){
    const u = upgrade(id); if (!u || u.cost == null || has(id)) return false;
    if (u.gen && u.at != null && genCount(u.gen) < u.at) return false;
    return true;
  }
  function canBuyUpgrade(id){ const s = S(), u = upgrade(id); return !!s && upgradeAvailable(id) && u.cost <= s.cur; }

  // ---------- Ações ----------
  function buy(id, n){
    const s = S(), g = gen(id); if (!s || !g) return false;
    if (n === 'max') n = maxBuy(id); else n = Math.floor(n || 1);
    if (n < 1) return false;
    const c = genCost(id, n); if (c > s.cur) return false;
    const before = s.gens[id] || 0;
    s.cur -= c; s.gens[id] = before + n; s.stats.purchases += n;
    const idx = D().gens.indexOf(g), degree = idx % 5;
    if (before === 0){
      // 1º do gerador: acorda a cena (o núcleo toca 'unlock' na cascata; se já estava acordado, tocamos aqui)
      const queued = g.unlock ? game.forceUnlock(g.unlock) : false;
      if (!queued) game.audio.play('unlock', { degree, gain: 1 });
    } else game.audio.play('pulse', { degree, x: 0.5, y: 0.3, gain: 0.8 });
    applyMilestones();
    emit('buy', { id, n, count: s.gens[id], cost: c });
    checkGoals();
    return true;
  }
  function buyUpgrade(id){
    const s = S(), u = upgrade(id); if (!s || !u || !canBuyUpgrade(id)) return false;
    s.cur -= u.cost; s.ups.push(id); s.stats.purchases++;
    game.audio.play('pulse', { degree: (s.ups.length) % 5, x: 0.5, y: 0.3, gain: 0.8 });
    emit('upgrade', { id, kind: u.kind, auto: false });
    return true;
  }
  // marcos automáticos: kind 'mult' com 'at' e sem custo → aplicado ao atingir a contagem
  function applyMilestones(){
    const s = S(); if (!s) return;
    for (const u of D().upgrades){
      if (u.kind !== 'mult' || u.cost != null || u.at == null || has(u.id)) continue;
      if (genCount(u.gen) >= u.at){
        s.ups.push(u.id);
        // marco automático: sino curto para o salto de taxa não passar em silêncio
        const gi = D().gens.findIndex(g => g.id === u.gen);
        if (game && game.audio) game.audio.play('unlock', { degree: (gi < 0 ? 0 : gi) % 5, gain: 0.8 });
        emit('upgrade', { id: u.id, kind: 'mult', auto: true, gen: u.gen, value: u.value });
      }
    }
  }

  // ---------- Prestígio ----------
  // pts disponíveis = floor(sqrt(life/K)) - pts já resgatados (life é acumulado, persiste entre runs)
  function prestigePoints(){
    const s = S(); if (!s) return 0;
    const K = (D().prestige && D().prestige.K) || 1.5e9;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Math.sqrt(s.life / K)) - s.prest.pts));
  }
  // Parte de estado do prestígio (a cena/tinta ficam em idle/prestige.js). Mantém: prest, life, stats, goals.
  function claimPrestige(){
    const s = S(); if (!s) return false;
    const pts = prestigePoints(); if (pts < 1) return false;
    s.prest.pts += pts; s.prest.runs++; s.prest.mult = 1 + 0.1 * s.prest.pts;
    s.cur = 0; s.gens = {};
    s.ups = s.ups.filter(id => { const u = upgrade(id); return u && u.kind === 'offline'; }); // teto offline é permanente
    emit('prestige', { pts, total: s.prest.pts, runs: s.prest.runs, mult: s.prest.mult });
    checkGoals();
    return true;
  }

  // Grava o save do idle agora (o núcleo salva a cada 10 s; útil após prestígio)
  function save(){
    if (!game || game.mode !== 'idle' || !game.state) return false;
    const s = game.state; s.lastSeen = Date.now();
    try {
      const json = JSON.stringify(s);
      if (LQ.Platform && LQ.Platform.saveCloud) LQ.Platform.saveCloud(json, 'lagoquieto.idle'); else localStorage.setItem('lagoquieto.idle', json);
      return true;
    } catch (e) { return false; }
  }

  // ---------- Metas ----------
  function goalMet(gl){
    const s = S(), c = gl.cond || {};
    switch (c.type){
      case 'clicks': return s.stats.clicks >= c.value;
      case 'gens': return genCount(c.id) >= c.value;
      case 'life': return s.life >= c.value;
      case 'rate': return rate() >= c.value;
      case 'prestige': return s.prest.runs >= c.value;
      default: return false;
    }
  }
  function checkGoals(){
    const s = S(); if (!s) return;
    for (const gl of D().goals){
      if (s.goals.indexOf(gl.id) >= 0 || !goalMet(gl)) continue;
      s.goals.push(gl.id);
      game.achievement('idle_' + gl.id); // ids mapeados em platform.js STEAM_IDS
      emit('goal', { id: gl.id, icon: gl.icon });
    }
  }

  // ---------- Entidade ----------
  let goalTimer = 0, ringAcc = 0, shopOpen = false;
  const prestigeBusy = () => !!(LQ.IdlePrestige && LQ.IdlePrestige.busy);
  LQ.register('idle-engine', {
    init(g){ game = g; if (g.mode !== 'idle') return; const s = S(); if (s) s.lastTick = Date.now(); applyMilestones(); },
    update(dt, g){
      if (g.mode !== 'idle') return; const s = S(); if (!s) return;
      const r = rate(), auto = autoClicks();
      const tr = r + auto * clickPower();
      // Relógio de parede: o núcleo limita dt a 0.05 s; com rAF estrangulado (janela coberta, wallpaper
      // a 15 fps) o tempo real passa mais rápido que a soma dos dt → creditamos a diferença.
      // Gaps longos (> 2 s) valem 50% como offline; teto = offlineCap.
      const now = Date.now();
      const real = s.lastTick > 0 ? (now - s.lastTick) / 1000 : dt;
      s.lastTick = now;
      let extra = real - dt;
      if (extra > 0.1 && tr > 0){
        extra = Math.min(extra, offlineCap());
        const bonus = extra * tr * (extra > 2 ? 0.5 : 1);
        s.cur += bonus; s.life += bonus;
      }
      const gain = tr * dt;
      s.cur += gain; s.life += gain;
      clampState(s);
      if (tr > s.stats.bestRate) s.stats.bestRate = tr;
      goalTimer += dt;
      if (goalTimer >= 1){ goalTimer = 0; checkGoals(); }
      // anéis visuais da automação: spawnRipple não passa por impact() → não gera moeda nem conta ripple
      if (tr > 0 && !document.hidden){
        const f = U.clamp(0.5 + Math.log10(tr + 1) / 2, 0.3, 3); // spawns/s
        ringAcc += f * dt;
        let n = 0;
        while (ringAcc >= 1 && n < 3){
          ringAcc -= 1; n++;
          // com a loja aberta os anéis nascem só na área visível do lago
          // largura real do painel (a ≤600 px ele ocupa 100%) → anéis nunca nascem debaixo dele
          let sw = 0; if (shopOpen){ const el = document.getElementById('shop'); sw = el ? el.offsetWidth : 260; }
          const x = 20 + g.rand() * Math.max(40, g.W - 40 - sw);
          const y = g.horizonY + 20 + g.rand() * Math.max(10, g.H - g.horizonY - 60);
          g.spawnRipple(x, y, { strength: U.clamp(0.3 + Math.log10(Math.max(1, tr)) / 8, 0.3, 0.9) });
        }
        if (ringAcc > 3) ringAcc = 0;
      } else ringAcc = 0;
    },
    // moeda SÓ aqui (pedra/lírio/sapo → impact); anéis automáticos nunca chegam neste hook
    onImpact(p, g){
      if (g.mode !== 'idle' || prestigeBusy()) return; const s = S(); if (!s) return; // durante os sinos do prestígio nada soma
      const amt = clickPower() * (p && p.strength ? p.strength : 1);
      s.cur += amt; s.life += amt; s.stats.clicks++; clampState(s);
      emit('currency', { x: p ? p.x : g.W / 2, y: p ? p.y : g.horizonY + 40, amount: amt, source: p && p.source });
    },
    onOffline(sec, g){
      if (g.mode !== 'idle') return; const s = S(); if (!s) return;
      sec = Math.max(0, Number(sec) || 0);
      const eff = Math.min(sec, offlineCap());
      const earned = totalRate() * eff * 0.5;
      if (earned > 0){ s.cur += earned; s.life += earned; s.stats.offlineEarned += earned; clampState(s); }
      s.lastTick = Date.now(); // evita creditar a mesma ausência de novo no próximo update
      if (sec >= 30) emit('offline', { sec, earned, capped: sec > eff });
    },
    // loja aberta/fechada (hud emite via game.emit('shopToggle')); usado só para posicionar anéis
    onShopToggle(_, g){ if (g.mode !== 'idle') return; shopOpen = !shopOpen; }
  });

  return {
    rate, totalRate, autoClicks, clickPower, offlineCap, globalMult,
    gen, upgrade, genCount, genMult, genRate, genCost, maxBuy, canBuy, buy, save,
    upgradeAvailable, canBuyUpgrade, buyUpgrade, has,
    prestigePoints, claimPrestige, checkGoals,
    on, off, emit,
    get state(){ return S(); }
  };
})();
