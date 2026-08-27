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

// ---------- Motor: clickPower / eras / buffs / metas (data.js + state.js + engine.js no mesmo contexto) ----------
ctx.LQ.register = (name, def) => { (ctx.LQ._ents = ctx.LQ._ents || {})[name] = def; };
ctx.document = { hidden: true, getElementById: () => null };
ctx.performance = { now: () => Date.now() };
ctx.Number = Number; ctx.Math = Math; ctx.Date = Date; ctx.Infinity = Infinity;
for (const f of ['data', 'state', 'engine']) vm.runInContext(fs.readFileSync(new URL(`../web/idle/${f}.js`, import.meta.url), 'utf8'), ctx);
const D = ctx.LQ.IdleData, I = ctx.LQ.Idle, ST = ctx.LQ.IdleState;
const game = { mode: 'idle', state: { idle: ST.fresh(), unlocked: [], achievements: [] }, W: 1280, H: 720, horizonY: 300, rand: Math.random,
  audio: { play(){} }, forceUnlock(){ return false; }, achievement(){}, spawnRipple(){ game.rings = (game.rings || 0) + 1; } };
ctx.LQ._ents['idle-engine'].init(game);
const s = game.state.idle;
near(I.clickPct(), D.clickPctBase, 'clickPct base');
near(I.clickPower(), D.clickBase, 'clickPower sem geradores = clickBase');
// 10 vagalumes (marcos ×1.5 aos 10 lidos de u.value) e Pedras pesadas I
s.gens.vagalume = 10; s.ups.push('vagalume_10', 'click_1');
const r = 10 * 0.25 * 1.5;
near(I.rate(), r, 'rate com marco ×1.5');
near(I.clickPct(), D.clickPctBase + 0.06, 'clickPct + pedra I');
near(I.clickFixed(), 2, 'parte fixa ×2');
near(I.clickPower(), 2 + (D.clickPctBase + 0.06) * r, 'clickPower = fixa + pct·rate');
s.ups.push('auto_1');
near(I.totalRate(), r + 1 * I.clickFixed(), 'Orvalho paga só a parte fixa');
// buff +25% por 60 s entra em rate() e expira no update
eq(I.setBuff(0.25, 60), true, 'setBuff'); near(I.rate(), r * 1.25, 'rate com buff'); eq(I.buffs().length, 1, 'buffs ativos');
ctx.LQ._ents['idle-engine'].update(61, game); eq(I.buffs().length, 0, 'buff expirou'); near(I.rate(), r, 'rate sem buff');
// eras: life sobe → checkEra emite em ordem e s.era não regride
const seen = []; I.on('era', e => seen.push(e.index));
s.life = D.eras[2].life; I.checkEra(); eq(I.era(), 2, 'era 2'); eq(seen.join(','), '1,2', 'emit era em ordem');
s.life = 0; eq(I.era(), 2, 'era não regride'); eq(s.era, 2, 'state.era gravado');
// migrate: save v1 sem era → era recalculada de life; era gravada maior é mantida
eq(ST.migrate({ life: D.eras[3].life }).era, 3, 'migrate era de life'); eq(ST.migrate({ life: 0, era: 4 }).era, 4, 'migrate mantém era gravada');
eq(ST.migrate({ life: 0, era: 99 }).era, D.eras.length - 1, 'migrate limita era'); eq(ST.migrate(null).chatter, true, 'chatter default');
// metas: bonus/era/chatter
s.stats.bonuses.lantern = 10; s.stats.chatterShown = 50; s.life = D.eras[3].life; I.checkEra(); I.checkGoals();
for (const id of ['guardiao_lanterna', 'tres_eras', 'ouvinte']) eq(s.goals.indexOf(id) >= 0, true, 'meta ' + id);
// loja nunca cobre; lakePoint no canvas todo
eq(I.refreshShopW(), 0, 'refreshShopW 0'); eq(I.shopWidth(), 0, 'shopWidth 0'); eq(I.shopCovers(), false, 'shopCovers');
game.rand = () => 1; const pt = I.lakePoint(); near(pt.x, game.W - 20, 'lakePoint x canvas todo'); near(pt.y, game.H - 70, 'lakePoint y acima da barra');
// anéis automáticos ≤1/s
game.rings = 0; ctx.document.hidden = false; s.gens.aurora = 100; for (let i = 0; i < 100; i++) ctx.LQ._ents['idle-engine'].update(0.1, game);
eq(game.rings <= 11, true, 'anéis auto ≤1/s (' + game.rings + ' em 10 s)');
console.log(fails ? `${fails} falha(s)` : 'util + motor OK'); process.exit(fails ? 1 : 0);
