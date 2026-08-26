#!/usr/bin/env node
// Simulador headless da economia idle de "Lago Quieto".
// Uso: node sim-economy.mjs econ.json [--hours 4] [--json]
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('uso: node sim-economy.mjs econ.json [--hours N] [--json]'); process.exit(1); }
const hours = Number(args[args.indexOf('--hours') + 1]) || 4;
const asJson = args.includes('--json');
const econ = JSON.parse(fs.readFileSync(file, 'utf8'));

const fmt = t => t == null ? '—' : t < 60 ? `${t}s` : t < 3600 ? `${Math.floor(t/60)}m${String(t%60).padStart(2,'0')}` : `${(t/3600).toFixed(2)}h`;
const sci = x => x >= 1e6 ? x.toExponential(2) : x.toFixed(x < 10 ? 2 : 0);

function simulate(e) {
  const T = hours * 3600;
  const K = e.prestige?.K ?? 1e10;
  let pts = 0;
  let s = freshRun();
  function freshRun() {
    return {
      waves: 0, life: 0, t0: 0,
      count: Object.fromEntries(e.gens.map(g => [g.id, 0])),
      gmult: Object.fromEntries(e.gens.map(g => [g.id, 1])),
      clickMult: 1, auto: 0, bought: new Set(),
    };
  }
  const pm = () => 1 + 0.1 * pts;
  const rate = () => e.gens.reduce((a, g) => a + s.count[g.id] * g.rate * s.gmult[g.id], 0) * pm();
  const clickPower = () => (e.clickBase ?? 1) * s.clickMult * pm();
  const genCost = g => g.base * Math.pow(g.growth, s.count[g.id]);

  const rep = {
    firstBuy: null, fiveDistinct: null, genUnlock: {}, maxGapFirstHour: 0, gapStart: null,
    prestiges: [], finalRate: 0, buysFirstHour: 0, notes: [],
  };
  const distinct = new Set();
  let gap = 0;

  for (let t = 1; t <= T; t++) {
    // jogador presente: 2/s nos 5 primeiros min, 0.5/s até 1 h, depois idle.
    // Após prestigiar (ato manual) assume-se 5 min de presença a 0.5/s para reiniciar a run.
    const cps = t <= 300 ? 2 : t <= 3600 ? 0.5 : (s.t0 > 0 && t - s.t0 <= 300) ? 0.5 : 0;
    const gain = rate() + (cps + s.auto) * clickPower();
    s.waves += gain; s.life += gain;

    // compra gulosa: melhor ganho de taxa / custo, repetindo enquanto houver algo pagável
    let anyAffordable = false;
    for (;;) {
      let best = null;
      const consider = (id, cost, gainRate, apply, isGen) => {
        if (cost > s.waves) return;
        anyAffordable = true;
        const score = gainRate / cost;
        if (!best || score > best.score) best = { id, cost, score, apply, isGen };
      };
      for (const g of e.gens) {
        consider(g.id, genCost(g), g.rate * s.gmult[g.id] * pm(), () => { s.count[g.id]++; }, true);
      }
      for (const u of e.upgrades) {
        if (s.bought.has(u.id)) continue;
        let cost = u.cost, gr = 0, apply;
        if (u.kind === 'mult') {
          const g = e.gens.find(x => x.id === u.gen); if (!g) continue;
          if (s.count[g.id] < (u.at ?? 0)) continue;
          if (cost == null) cost = 2 * genCost(g);
          gr = (u.value - 1) * s.count[g.id] * g.rate * s.gmult[g.id] * pm();
          apply = () => { s.gmult[g.id] *= u.value; };
        } else if (u.kind === 'click') {
          if (cost == null) continue;
          gr = (u.value - 1) * (cps + s.auto) * clickPower();
          apply = () => { s.clickMult *= u.value; };
        } else if (u.kind === 'auto') {
          if (cost == null) continue;
          gr = u.value * clickPower();
          apply = () => { s.auto += u.value; };
        } else if (u.kind === 'offline') {
          if (cost == null) continue;
          // conforto: só compra quando custa < 2% do life da run (não afeta taxa)
          if (cost > 0.02 * s.life) continue;
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

    if (t === 2700) rep.lifeAt45 = s.life; if (t === 3600) rep.lifeAt60 = s.life;
    // prestígio
    const newPts = Math.floor(Math.sqrt(s.life / K));
    if (t - s.t0 >= 1800 && newPts >= Math.max(1, 0.5 * pts)) {
      rep.prestiges.push({ t, pts: newPts, total: pts + newPts, life: s.life, rateBefore: rate() });
      pts += newPts;
      s = freshRun(); s.t0 = t;
    }
  }
  rep.finalRate = rate();
  rep.finalPts = pts;
  return rep;
}

const r = simulate(econ);
if (asJson) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
console.log(`== ${econ.name ?? file} ==`);
console.log(`1ª compra: ${fmt(r.firstBuy)} | 5 compras distintas: ${fmt(r.fiveDistinct)} | maior gap sem compra possível (1ª h): ${r.maxGapFirstHour}s | compras na 1ª h: ${r.buysFirstHour}`);
console.log('geradores (1ª unidade): ' + econ.gens.map(g => `${g.id}=${fmt(r.genUnlock[g.id])}`).join(', '));
console.log(`life aos 45 min: ${sci(r.lifeAt45||0)} | aos 60 min: ${sci(r.lifeAt60||0)}`);
console.log('prestígios: ' + (r.prestiges.length ? r.prestiges.map((p, i) => `#${i+1} ${fmt(p.t)} (+${p.pts} pts → ${p.total}, life ${sci(p.life)})`).join(' | ') : 'nenhum'));
console.log(`taxa final (${hours}h): ${sci(r.finalRate)} ondas/s | pts prestígio: ${r.finalPts}`);
