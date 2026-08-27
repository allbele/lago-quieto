#!/usr/bin/env node
// Simulador headless da economia idle de "Lago Quieto" (v3).
// Uso: node sim-economy.mjs econ.json [--hours 4] [--combo 1.3] [--profile ativo|preguicoso|all] [--json]
//
// Fórmulas (espelham idle/engine.js v3):
//   clickPct   = clickPctBase + Σ u.pct dos upgrades 'click' comprados
//   clickPower = (clickBase·clickMult + clickPct·rate) · prest · combo     (jogador)
//   autoClick  = clickBase·clickMult · prest                               (Orvalho: só parte fixa, sem combo)
//   marcos 'mult' (kind mult, at N) são grátis (custo 0) e aplicam u.value ao gerador
//   prestígio: pts disponíveis = floor(sqrt(life/K)) - pts; life é acumulado (persiste entre runs)
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('uso: node sim-economy.mjs econ.json [--hours N] [--combo M] [--profile ativo|preguicoso|all] [--json]'); process.exit(1); }
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] != null ? args[i + 1] : def; };
const hours = Number(opt('--hours', 4)) || 4;
const combo = Number(opt('--combo', 1.3)) || 1.3;
const profileArg = opt('--profile', 'all');
const asJson = args.includes('--json');
const econ = JSON.parse(fs.readFileSync(file, 'utf8'));

const fmt = t => t == null ? '—' : t < 60 ? `${t}s` : t < 3600 ? `${Math.floor(t/60)}m${String(t%60).padStart(2,'0')}` : `${(t/3600).toFixed(2)}h`;
const sci = x => x >= 1e6 ? x.toExponential(2) : x.toFixed(x < 10 ? 2 : 0);
const pct = x => (100 * x).toFixed(1) + '%';

// Perfis de presença: cliques/s do jogador em função do tempo desde o início da run (segundos).
const PROFILES = {
  ativo: t => t <= 300 ? 2 : t <= 1800 ? 0.7 : t <= 3600 ? 0.3 : 0,
  preguicoso: t => t <= 300 ? 0.5 : 0,
};

function simulate(e, profile) {
  const cpsAt = PROFILES[profile];
  const T = hours * 3600;
  const K = e.prestige?.K ?? 1e10;
  const clickBase = e.clickBase ?? 1;
  const clickPctBase = e.clickPctBase ?? 0;
  const eras = (e.eras ?? []).slice().sort((a, b) => a.life - b.life);
  // gating por era (plano §C): se eras[].gens existir, o gerador só entra na loja quando sua era for atingida
  const genEra = {};
  eras.forEach((er, i) => (er.gens ?? []).forEach(id => { genEra[id] = i; }));
  let pts = 0;
  let life = 0;                 // acumulado, persiste no prestígio (engine.js)
  let s = freshRun();
  function freshRun() {
    return {
      waves: 0, t0: 0,
      count: Object.fromEntries(e.gens.map(g => [g.id, 0])),
      gmult: Object.fromEntries(e.gens.map(g => [g.id, 1])),
      clickMult: 1, clickPct: clickPctBase, auto: 0, bought: new Set(),
    };
  }
  const pm = () => 1 + 0.1 * pts;
  const rate = () => e.gens.reduce((a, g) => a + s.count[g.id] * g.rate * s.gmult[g.id], 0) * pm();
  const clickFixed = () => clickBase * s.clickMult * pm();               // parte fixa (auto paga só isto)
  const clickPower = () => (clickBase * s.clickMult + s.clickPct * rate()) * pm() * combo;
  const genCost = g => g.base * Math.pow(g.growth, s.count[g.id]);

  const rep = {
    profile, combo, firstBuy: null, fiveDistinct: null, genUnlock: {}, maxGapFirstHour: 0,
    prestiges: [], buysFirstHour: 0, clickShare: {}, rateAt: {}, eraAt: {}, notes: [],
  };
  const distinct = new Set();
  let gap = 0, incClick = 0, incTotal = 0, eraIdx = 0;
  const SHARE_T = [300, 900, 1800, 3600];

  for (let t = 1; t <= T; t++) {
    // presença: perfil na 1ª run; após prestigiar (ato manual) assume-se o perfil reiniciado a partir de t0.
    const cps = cpsAt(t - s.t0);
    const r = rate();
    const gClick = cps * clickPower();
    const gAuto = s.auto * clickFixed();
    const gain = r + gClick + gAuto;
    s.waves += gain; life += gain;
    incClick += gClick; incTotal += gain;
    if (SHARE_T.includes(t)) rep.clickShare[t] = incTotal > 0 ? incClick / incTotal : 0;
    if (t === 1800 || t === 3600) rep.rateAt[t] = r;

    // eras (limiares de life acumulado)
    while (eraIdx < eras.length && life >= eras[eraIdx].life) { rep.eraAt[eras[eraIdx].id] = t; eraIdx++; }

    // marcos grátis: aplica assim que o gerador atinge 'at'
    for (const u of e.upgrades) {
      if (u.kind !== 'mult' || s.bought.has(u.id)) continue;
      const g = e.gens.find(x => x.id === u.gen); if (!g) continue;
      if (s.count[g.id] >= (u.at ?? 0) && !(u.cost > 0)) { s.gmult[g.id] *= u.value; s.bought.add(u.id); }
    }

    // compra gulosa: melhor ganho de taxa efetiva / custo, repetindo enquanto houver algo pagável
    let anyAffordable = false;
    for (;;) {
      let best = null;
      const consider = (id, cost, gainRate, apply, isGen) => {
        if (cost > s.waves) return;
        anyAffordable = true;
        const score = gainRate / cost;
        if (!best || score > best.score) best = { id, cost, score, apply, isGen };
      };
      const cpNow = clickPower();
      for (const g of e.gens) {
        if (genEra[g.id] != null && genEra[g.id] >= eraIdx) continue; // era ainda não atingida
        // gerador também alimenta a parte percentual do clique
        const dr = g.rate * s.gmult[g.id] * pm();
        consider(g.id, genCost(g), dr * (1 + s.clickPct * combo * cps), () => { s.count[g.id]++; }, true);
      }
      for (const u of e.upgrades) {
        if (s.bought.has(u.id)) continue;
        let cost = u.cost, gr = 0, apply;
        if (u.kind === 'mult') {
          // marco pago (cost > 0): comportamento antigo
          const g = e.gens.find(x => x.id === u.gen); if (!g) continue;
          if (s.count[g.id] < (u.at ?? 0)) continue;
          if (!(cost > 0)) continue; // grátis: tratado acima
          gr = (u.value - 1) * s.count[g.id] * g.rate * s.gmult[g.id] * pm();
          apply = () => { s.gmult[g.id] *= u.value; };
        } else if (u.kind === 'click') {
          if (cost == null) continue;
          const v = u.value ?? 1, p = u.pct ?? 0;
          const cpNew = (clickBase * s.clickMult * v + (s.clickPct + p) * rate()) * pm() * combo;
          gr = (cpNew - cpNow) * cps + (v - 1) * s.auto * clickFixed();
          // sem jogador presente o upgrade ainda vale para o Orvalho; se nada, usa ganho hipotético mínimo
          apply = () => { s.clickMult *= v; s.clickPct += p; };
        } else if (u.kind === 'auto') {
          if (cost == null) continue;
          gr = u.value * clickFixed();
          apply = () => { s.auto += u.value; };
        } else if (u.kind === 'offline') {
          if (cost == null) continue;
          // conforto: só compra quando custa < 2% do life (não afeta taxa)
          if (cost > 0.02 * life) continue;
          gr = 1e-12;
          apply = () => {};
        } else continue;
        if (gr <= 0) continue;
        consider(u.id, cost, gr, () => { apply(); s.bought.add(u.id); }, false);
      }
      if (!best) break;
      s.waves -= best.cost; best.apply();
      if (rep.firstBuy == null) rep.firstBuy = t;
      distinct.add(best.id);
      if (distinct.size >= 5 && rep.fiveDistinct == null) rep.fiveDistinct = t;
      if (best.isGen && rep.genUnlock[best.id] == null) rep.genUnlock[best.id] = t;
      if (t <= 3600) rep.buysFirstHour++;
    }
    if (t <= 3600) {
      if (anyAffordable) gap = 0; else { gap++; if (gap > rep.maxGapFirstHour) rep.maxGapFirstHour = gap; }
    }

    if (t === 2700) rep.lifeAt45 = life; if (t === 3600) rep.lifeAt60 = life;
    if (t % 60 === 0 && [3,10,20,32,45].includes(t/60)) (rep.lifeProbe ??= {})[t/60] = life;
    // prestígio (regra atual do engine: disponíveis = floor(sqrt(life/K)) - pts; sim exige run ≥ 30 min e ganho ≥ 50% dos pts)
    const avail = Math.floor(Math.sqrt(life / K)) - pts;
    if (t - s.t0 >= 1800 && avail >= Math.max(1, 0.5 * pts)) {
      rep.prestiges.push({ t, pts: avail, total: pts + avail, life, rateBefore: rate() });
      pts += avail;
      s = freshRun(); s.t0 = t;
    }
  }
  rep.finalRate = rate();
  rep.finalPts = pts;
  rep.finalLife = life;
  for (const er of eras) if (rep.eraAt[er.id] == null) rep.eraAt[er.id] = null;
  return rep;
}

const profiles = profileArg === 'all' ? Object.keys(PROFILES) : [profileArg];
for (const p of profiles) if (!PROFILES[p]) { console.error(`perfil desconhecido: ${p}`); process.exit(1); }
const results = profiles.map(p => simulate(econ, p));
if (asJson) { console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2)); process.exit(0); }

console.log(`== ${econ.name ?? file} == (combo médio ${combo}, K=${econ.prestige?.K ?? '—'})`);
for (const r of results) {
  console.log(`\n-- perfil: ${r.profile} --`);
  console.log(`1ª compra: ${fmt(r.firstBuy)} | 5 compras distintas: ${fmt(r.fiveDistinct)} | maior gap sem compra possível (1ª h): ${r.maxGapFirstHour}s | compras na 1ª h: ${r.buysFirstHour}`);
  console.log('geradores (1ª unidade): ' + econ.gens.map(g => `${g.id}=${fmt(r.genUnlock[g.id])}`).join(', '));
  console.log('clickShare acumulado: ' + [300, 900, 1800, 3600].map(t => `${fmt(t)}=${pct(r.clickShare[t] ?? 0)}`).join(' | '));
  console.log(`taxa (só geradores): 30 min ${sci(r.rateAt[1800] ?? 0)}/s | 60 min ${sci(r.rateAt[3600] ?? 0)}/s`);
  console.log(`life aos 45 min: ${sci(r.lifeAt45||0)} | aos 60 min: ${sci(r.lifeAt60||0)}`);
  if (r.lifeProbe) console.log('life (1ª run) aos ' + Object.entries(r.lifeProbe).map(([m,v]) => `${m}min=${sci(v)}`).join(' | '));
  if (econ.eras?.length) console.log('eras: ' + econ.eras.map(er => `${er.id}(${sci(er.life)})=${fmt(r.eraAt[er.id])}`).join(' | '));
  console.log('prestígios: ' + (r.prestiges.length ? r.prestiges.map((p, i) => `#${i+1} ${fmt(p.t)} (+${p.pts} pts → ${p.total}, life ${sci(p.life)}, taxa antes ${sci(p.rateBefore)}/s)`).join(' | ') : 'nenhum'));
  console.log(`taxa final (${hours}h): ${sci(r.finalRate)} ondas/s | pts prestígio: ${r.finalPts} | life total: ${sci(r.finalLife)}`);
}
