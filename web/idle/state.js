// Lago Quieto — modo Idle: sub-estado game.state.idle (fresh/migrate coercitivos).
window.LQ = window.LQ || {};
LQ.IdleState = (function(){
  'use strict';
  const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? v : d; };
  const pos = v => Math.max(0, num(v, 0));
  const int = v => Math.max(0, Math.floor(num(v, 0)));
  const idOk = x => typeof x === 'string' && /^[a-z0-9_]{1,40}$/.test(x);

  function fresh(){
    return {
      v: 1, cur: 0, life: 0, gens: {}, ups: [],
      prest: { pts: 0, runs: 0, mult: 1 },
      goals: [], lastTick: 0,
      stats: { clicks: 0, offlineEarned: 0, bestRate: 0, purchases: 0 }
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
    out.v = 1;
    return out;
  }

  // Entidade: garante o sub-estado e restaura a cena (peixe/lua/... conforme geradores comprados).
  // O núcleo já restaura `unlocked` do save; forceUnlock ignora ids já desbloqueados → sem duplicar.
  LQ.register('idle-state', {
    init(game){
      if (game.mode !== 'idle') return;
      game.state.idle = migrate(game.state.idle);
      const D = LQ.IdleData; if (!D) return;
      for (const g of D.gens) if (game.state.idle.gens[g.id] > 0 && g.unlock) game.forceUnlock(g.unlock);
    }
  });

  return { fresh, migrate };
})();
