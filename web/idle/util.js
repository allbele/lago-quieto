// Lago Quieto — modo Idle: utilidades numéricas (formatação, custos geométricos).
window.LQ = window.LQ || {};
LQ.IdleUtil = (function(){
  'use strict';
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  // 0-999 inteiro; 1.2K / 12.3K / 123K … Qi; ≥ 1e21 → 1.2e21
  function fmt(n){
    n = Number(n);
    if (!Number.isFinite(n)) return '0';
    const neg = n < 0; if (neg) n = -n;
    if (n < 1000) return (neg ? '-' : '') + Math.floor(n);
    let e = Math.floor(Math.log10(n) / 3);
    if (e >= SUF.length) return (neg ? '-' : '') + n.toExponential(1).replace('+', '');
    let v = n / Math.pow(1000, e);
    // 1 decimal abaixo de 100 (99.96 arredonda para "100.0" → vira "100")
    let s = v < 100 ? v.toFixed(1) : Math.floor(v).toString();
    if (s === '100.0') s = '100';
    return (neg ? '-' : '') + s + SUF[e];
  }

  // Custo total de comprar n unidades tendo `owned` (soma geométrica), arredondado para cima:
  // inteiro para que o que o HUD mostra (fmt = floor) seja exatamente o que é cobrado.
  // Aceita também cost(gen, owned, n) com gen = {base, growth}.
  function cost(base, growth, owned, n){
    if (base && typeof base === 'object'){ n = owned; owned = growth; growth = base.growth; base = base.base; }
    n = Math.max(0, Math.floor(n || 0));
    if (n === 0) return 0;
    const first = base * Math.pow(growth, owned);
    const t = growth === 1 ? first * n : first * (Math.pow(growth, n) - 1) / (growth - 1);
    return Math.ceil(t - 1e-9);
  }

  // Máximo de unidades pagáveis com `cur` (log + verificação). Aceita maxAffordable(gen, owned, cur).
  function maxAffordable(base, growth, owned, cur){
    if (base && typeof base === 'object'){ cur = owned; owned = growth; growth = base.growth; base = base.base; }
    if (!Number.isFinite(cur) || !(cur > 0) || !(base > 0) || !(growth >= 1)) return 0; // dados inválidos/Infinity → nada comprável
    const first = base * Math.pow(growth, owned);
    if (cur < first) return 0;
    let n;
    if (growth === 1) n = Math.floor(cur / first);
    else n = Math.floor(Math.log(cur * (growth - 1) / first + 1) / Math.log(growth));
    // corrige erro de ponto flutuante
    while (n > 0 && cost(base, growth, owned, n) > cur) n--;
    while (n < 1e6 && cost(base, growth, owned, n + 1) <= cur) n++; // teto defensivo
    return n;
  }

  return { fmt, cost, maxAffordable, clamp, lerp };
})();
