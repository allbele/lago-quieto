// Lago Quieto — modo Idle: sub-estado game.state.idle (fresh/migrate coercitivos).
window.LQ = window.LQ || {};
LQ.IdleState = (function(){
  'use strict';
  const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? v : d; };
  const MAXV = 1e300; // teto numérico (nunca chega a Infinity/NaN)
  const pos = v => Math.min(MAXV, Math.max(0, num(v, 0)));
  const int = v => Math.max(0, Math.floor(num(v, 0)));
  const idOk = x => typeof x === 'string' && /^[a-z0-9_]{1,40}$/.test(x);

  function fresh(){
    return {
      v: 1, cur: 0, life: 0, gens: {}, ups: [],
      prest: { pts: 0, runs: 0, mult: 1 },
      goals: [], lastTick: 0,
      stats: { clicks: 0, offlineEarned: 0, bestRate: 0, purchases: 0, bonuses: {}, bonusSeen: {} }
    };
  }

  function migrate(s){
    const f = fresh();
    if (!s || typeof s !== 'object' || Array.isArray(s)) return f;
    const D = LQ.IdleData || { gens: [], upgrades: [], goals: [] };
    const out = fresh();
    out.cur = pos(s.cur); out.life = pos(s.life);
    // só geradores conhecidos, contagem inteira
    if (s.gens && typeof s.gens === 'object') for (const g of D.gens){ if (s.gens[g.id] !== undefined) out.gens[g.id] = int(s.gens[g.id]); }
    const upIds = D.upgrades.map(u => u.id);
    out.ups = Array.isArray(s.ups) ? Array.from(new Set(s.ups.filter(x => idOk(x) && upIds.indexOf(x) >= 0))) : [];
    const p = s.prest && typeof s.prest === 'object' ? s.prest : {};
    out.prest.pts = int(p.pts); out.prest.runs = int(p.runs);
    out.prest.mult = 1 + 0.1 * out.prest.pts; // derivado: nunca confia no save
    const goalIds = D.goals.map(g => g.id);
    out.goals = Array.isArray(s.goals) ? Array.from(new Set(s.goals.filter(x => idOk(x) && goalIds.indexOf(x) >= 0))) : [];
    out.lastTick = pos(s.lastTick);
    const st = s.stats && typeof s.stats === 'object' ? s.stats : {};
    out.stats.clicks = int(st.clicks); out.stats.offlineEarned = pos(st.offlineEarned);
    out.stats.bestRate = pos(st.bestRate); out.stats.purchases = int(st.purchases);
    // contagem de bônus por tipo (fish/glint/combo/shooting…), chaves saneadas, valores inteiros
    out.stats.bonuses = {};
    if (st.bonuses && typeof st.bonuses === 'object' && !Array.isArray(st.bonuses))
      for (const k in st.bonuses) if (idOk(k)) out.stats.bonuses[k] = int(st.bonuses[k]);
    // toasts de 1ª vez já vistos (hud grava {chave:true})
    out.stats.bonusSeen = {};
    if (st.bonusSeen && typeof st.bonusSeen === 'object' && !Array.isArray(st.bonusSeen))
      for (const k in st.bonusSeen) if (idOk(k) && st.bonusSeen[k]) out.stats.bonusSeen[k] = true;
    out.v = 1;
    return out;
  }

  // Reconciliação: no idle a fonte de verdade é idle.gens — `unlocked` só pode ter ids cujo gerador tem count>0
  // (save gravado no meio dos sinos do prestígio, ou de versão antiga, trazia unlocked cheio com gens vazios).
  // Chamada pelo núcleo (LQ.start) ANTES do init das entidades, para céu/lua/névoa não lerem unlocks fantasmas.
  function reconcile(state){
    if (!state || typeof state !== 'object') return state;
    state.idle = migrate(state.idle);
    const D = LQ.IdleData; if (!D) return state;
    const byUnlock = {};
    for (const g of D.gens) if (g.unlock) byUnlock[g.unlock] = g.id;
    if (Array.isArray(state.unlocked)) state.unlocked = state.unlocked.filter(id => byUnlock[id] && state.idle.gens[byUnlock[id]] > 0);
    if (!(state.idle.gens.lirio > 0)) state.liliesBloomed = 0;
    return state;
  }

  // Entidade: garante o sub-estado e restaura a cena (peixe/lua/... conforme geradores comprados).
  // O núcleo já restaura `unlocked` do save; forceUnlock ignora ids já desbloqueados → sem duplicar.
  LQ.register('idle-state', {
    init(game){
      if (game.mode !== 'idle') return;
      reconcile(game.state);
      const D = LQ.IdleData; if (!D) return;
      for (const g of D.gens) if (game.state.idle.gens[g.id] > 0 && g.unlock) game.forceUnlock(g.unlock);
    }
  });

  return { fresh, migrate, reconcile };
})();
