#!/usr/bin/env node
// Teste rápido de LQ.IdleUtil (fmt/cost/maxAffordable) em Node.
import fs from 'node:fs'; import vm from 'node:vm';
const ctx = {}; ctx.window = ctx; ctx.LQ = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../web/idle/util.js', import.meta.url), 'utf8'), ctx);
const U = ctx.LQ.IdleUtil;
let fails = 0;
const eq = (a, b, m) => { if (a !== b){ fails++; console.log('FAIL', m, '→', a, '≠', b); } };
const near = (a, b, m) => { if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(b))){ fails++; console.log('FAIL', m, '→', a, '≠', b); } };
eq(U.fmt(0), '0', 'fmt 0'); eq(U.fmt(999.9), '999', 'fmt 999.9'); eq(U.fmt(1000), '1.0K', 'fmt 1000');
eq(U.fmt(1234), '1.2K', 'fmt 1234'); eq(U.fmt(12345), '12.3K', 'fmt 12345'); eq(U.fmt(123456), '123K', 'fmt 123456');
eq(U.fmt(3.4e6), '3.4M', 'fmt M'); eq(U.fmt(1e9), '1.0B', 'fmt B'); eq(U.fmt(2.5e12), '2.5T', 'fmt T');
eq(U.fmt(7e15), '7.0Qa', 'fmt Qa'); eq(U.fmt(1.2e18), '1.2Qi', 'fmt Qi'); eq(U.fmt(1.2e21), '1.2e21', 'fmt e21');
eq(U.fmt(999999), '999K', 'fmt 999999'); eq(U.fmt(999995), '999K', 'fmt 999995'); eq(U.fmt(99960), '100K', 'fmt 99960'); eq(U.fmt(99940), '99.9K', 'fmt 99940'); eq(U.fmt(NaN), '0', 'fmt NaN');
// cost = soma manual
const manual = (b, g, o, n) => { let s = 0; for (let i = 0; i < n; i++) s += b * Math.pow(g, o + i); return Math.ceil(s - 1e-9); }; // cost arredonda p/ cima
near(U.cost(8, 1.15, 0, 1), 8, 'cost 1'); near(U.cost(8, 1.15, 0, 10), manual(8, 1.15, 0, 10), 'cost 10');
near(U.cost(2200, 1.15, 37, 25), manual(2200, 1.15, 37, 25), 'cost 25 owned 37'); eq(U.cost(8, 1.15, 0, 0), 0, 'cost 0');
// maxAffordable coerente com cost
for (const [b, g, o, cur] of [[8,1.15,0,7],[8,1.15,0,8],[8,1.15,0,100],[35,1.15,12,1e6],[4e6,1.15,3,1e12],[8,1.15,200,1e15],[8,1.15,0,0]]){
  const n = U.maxAffordable(b, g, o, cur);
  if (U.cost(b, g, o, n) > cur || U.cost(b, g, o, n + 1) <= cur){ fails++; console.log('FAIL maxAffordable', b, g, o, cur, '→', n); }
}
eq(U.maxAffordable(8, 1.15, 0, 7), 0, 'max 7'); eq(U.maxAffordable(8, 1.15, 0, 8), 1, 'max 8');
eq(U.cost(8, 1.15, 1, 1), 10, 'cost inteiro (9.2→10)'); eq(U.maxAffordable(8, 1.15, 1, 9), 0, 'max 9 < 10'); eq(U.maxAffordable(0, 1.15, 0, 1e9), 0, 'base 0'); eq(U.maxAffordable(8, 0.5, 0, 1e9), 0, 'growth<1');
near(U.cost({base:8,growth:1.15}, 3, 5), U.cost(8, 1.15, 3, 5), 'cost(gen,..)'); eq(U.maxAffordable({base:8,growth:1.15}, 0, 100), U.maxAffordable(8, 1.15, 0, 100), 'max(gen,..)');
eq(U.clamp(5, 0, 1), 1, 'clamp'); eq(U.lerp(0, 10, 0.5), 5, 'lerp');
console.log(fails ? `${fails} falha(s)` : 'util OK'); process.exit(fails ? 1 : 0);
