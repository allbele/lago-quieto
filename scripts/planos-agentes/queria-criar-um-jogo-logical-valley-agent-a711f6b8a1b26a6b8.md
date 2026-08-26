# Plano — Agente A (engine): seção 2 do PLANO-IDLE-V2

Arquivos: `web/idle/engine.js`, `web/idle/state.js`, `web/game.js` (só os hooks listados). Sem módulos, namespace LQ, PT-BR.
Zen intocado: tudo em engine/state já sai cedo com `game.mode !== 'idle'`; em game.js os 3 hooks são neutros em zen
(`t` extra no payload é ignorado por quem não lê; `stoneStyle` default `'stone'` desenha igual ao atual; `silent` só quando pedido).

## 1. `web/idle/state.js`

- `fresh().stats` ganha `bonuses: {}`.
- `migrate`: após `out.stats.purchases = ...`:
```js
    // contagem de bônus por tipo (fish/glint/combo/shooting…), chaves saneadas, valores inteiros
    out.stats.bonuses = {};
    if (st.bonuses && typeof st.bonuses === 'object' && !Array.isArray(st.bonuses))
      for (const k in st.bonuses) if (idOk(k)) out.stats.bonuses[k] = int(st.bonuses[k]);
```

## 2. `web/game.js` (3 hooks pontuais)

a) `impact()` — payload com tempo (segundos, relógio real; usado no combo de ritmo):
```js
    game.emit('impact', { x, y, strength: 1, source: 'stone', t: performance.now() / 1000 });
```
b) objeto `game`: novo campo `stoneStyle: 'stone',   // 'stone' | 'racao' (idle: engine troca ao comprar ração)`.
`drawStones()`: quando `!st.dew && game.stoneStyle === 'racao'`, em vez de 1 arco r=2 desenha 3 pontinhos r=1
em (x-3,y+1), (x+1,y-2), (x+3,y+2) (offsets escalados por `(1-k)*0.5+0.5` para "abrirem" ao cair). Orvalho e `'stone'` inalterados.
c) `spawnRipple(x, y, opts)`: `if (!opts.silent) call('onRipple', x, y, game);` — anel silencioso não acorda os
moradores (peixe não é puxado, tema não solta folha/pincelada, nada de reação/som de entidade). Usado pelos anéis de bônus.

## 3. `web/idle/engine.js`

### Consultas novas
```js
  const P = () => D().pop || {};
  const B = () => D().bonus || {};
  // vis: 0 sem unidades; senão base + floor(log2(n+1))*k, limitado ao cap
  function vis(count, base, k, cap){ return count <= 0 ? 0 : Math.min(cap, base + Math.floor(Math.log2(count + 1)) * k); }
  // id de pop → gerador que o alimenta
  const POP_GEN = { juncosL: 'juncos', juncosR: 'juncos', montanhas: 'nevoa' };
  // Quantos "moradores" a entidade mostra. -1 em zen (entidade usa a regra atual).
  // ids com base/k/cap (vagalume, juncosL, juncosR, peixe, dourado, estrelas, lirio, sapo, montanhas) → vis();
  // 'aurora' → 1 ou 2 faixas (bands2At); 'lua' → contagem bruta (use moon() para escala/halo).
  function visible(id){
    if (!game || game.mode !== 'idle') return -1;
    const n = genCount(POP_GEN[id] || id), p = P()[id];
    if (id === 'aurora') return n <= 0 ? 0 : (n >= ((p && p.bands2At) || 10) ? 2 : 1);
    if (!p || p.base === undefined) return n;
    return vis(n, p.base, p.k, p.cap);
  }
  // Lua: {scale, halo} conforme pop.lua; scale 1 / halo haloMin quando sem lua. Em zen: null.
  function moon(){
    if (!game || game.mode !== 'idle') return null;
    const p = P().lua || {}, n = genCount('lua');
    const step = n <= 0 ? 0 : Math.floor(Math.log2(n + 1));
    const scale = Math.min(p.scaleCap || 1.6, 1 + (p.scaleStep || 0.08) * step);
    const hMin = p.haloMin === undefined ? 0.55 : p.haloMin, hMax = p.haloMax === undefined ? 0.9 : p.haloMax;
    const halo = hMin + (hMax - hMin) * ((scale - 1) / Math.max(1e-6, (p.scaleCap || 1.6) - 1));
    return { scale, halo };
  }
```
### lakePoint (extraído do laço de anéis automáticos; o laço passa a chamá-lo)
```js
  // Ponto aleatório na água, fora do painel da loja (largura real do #shop quando aberto)
  function lakePoint(){
    let sw = 0; if (shopOpen){ const el = document.getElementById('shop'); sw = el ? el.offsetWidth : 260; }
    const x = 20 + game.rand() * Math.max(40, game.W - 40 - sw);
    const y = game.horizonY + 20 + game.rand() * Math.max(10, game.H - game.horizonY - 60);
    return { x, y };
  }
```
### bonus
```js
  // Bônus de clique. o = {x, y, mult?, amount?}: amount explícito vence; senão clickPower()*mult (mult default 1).
  // Soma cur/life, stats.bonuses[kind]++, emite 'bonus'. Retorna o valor creditado (0 se ignorado).
  function bonus(kind, o){
    if (!game || game.mode !== 'idle' || prestigeBusy()) return 0; const s = S(); if (!s) return 0;
    o = o || {};
    const mult = Number.isFinite(o.mult) && o.mult > 0 ? o.mult : 1;
    let amount = Number.isFinite(o.amount) ? Math.max(0, o.amount) : clickPower() * mult;
    if (!(amount > 0)) return 0;
    s.cur += amount; s.life += amount; clampState(s);
    s.stats.bonuses = s.stats.bonuses || {};
    s.stats.bonuses[kind] = (s.stats.bonuses[kind] || 0) + 1;
    const x = Number.isFinite(o.x) ? o.x : game.W / 2, y = Number.isFinite(o.y) ? o.y : game.horizonY + 40;
    emit('bonus', { kind, x, y, amount, mult });
    return amount;
  }
```
### Combo de ritmo (estado do motor, não salvo)
```js
  let combo = 1, lastStoneT = -1, prevDt = -1;
  function setCombo(v){ if (v !== combo){ combo = v; emit('combo', { mult: combo }); } }
  // pedra em cadência: dtc dentro de [comboMin, comboMax] e |dtc - anterior| ≤ comboTol → +step (cap); senão volta a 1
  function stepCombo(t){
    const b = B(), step = b.comboStep || 0.1, cap = b.comboCap || 2, tol = b.comboTol || 0.12;
    const mn = b.comboMin || 0.3, mx = b.comboMax || 1.5;
    if (lastStoneT < 0){ lastStoneT = t; return; }
    const dtc = t - lastStoneT; lastStoneT = t;
    if (dtc >= mn && dtc <= mx && (prevDt < 0 || Math.abs(dtc - prevDt) <= tol)) setCombo(Math.min(cap, +(combo + step).toFixed(3)));
    else setCombo(1);
    prevDt = (dtc >= mn && dtc <= mx) ? dtc : -1;
  }
  function resetCombo(){ lastStoneT = -1; prevDt = -1; setCombo(1); }
```
- `onImpact`: 
```js
      let amt = clickPower() * (p && p.strength ? p.strength : 1);
      if (p && p.source === 'stone'){ stepCombo(Number.isFinite(p.t) ? p.t : performance.now() / 1000); amt *= combo; }
      ...
      emit('currency', { ..., source: p && p.source, combo });
```
- `update()`: `if (combo > 1 && lastStoneT >= 0 && performance.now() / 1000 - lastStoneT > (B().comboMax || 1.5)) resetCombo();`
  (ritmo quebrado por silêncio → arco do HUD apaga sem esperar o próximo clique).
### Ração / stoneStyle
```js
  function syncStoneStyle(){ if (game) game.stoneStyle = has('racao') ? 'racao' : 'stone'; }
```
- chamado em `init` (idle) e ao final de `buyUpgrade` (após `s.ups.push`). `has('racao')` já funciona (upgrade genérico; `kind:'racao'` não é 'mult'/'click'/'auto'/'offline' → não altera taxa).
- `upgradeAvailable` já cobre (gen null, at null, cost 20000).
### Prestígio
- `claimPrestige`: após filtrar `s.ups` → `resetCombo(); syncStoneStyle();` (ração não é permanente → volta a pedra).
### Export
`visible, moon, lakePoint, bonus, combo: () => combo, resetCombo` adicionados ao objeto retornado.

## 4. Verificação
- `node --check` em engine.js, state.js, game.js.
- Zen: `LQ.Idle.visible('peixe') === -1`, `moon() === null`; `game.stoneStyle === 'stone'`; pedra desenhada igual.
- Idle (console em :8765): comprar vagalume → `visible('vagalume')` 3→6 (n=1)→9 (n=3)…; `bonus('glint',{x,y,amount:100})` soma 100 e `stats.bonuses.glint===1`;
  10 cliques a ~0.8 s → `combo()` ≈ 1.9–2.0; parar 2 s → volta a 1 (evento 'combo' {mult:1}); comprar 'racao' → `stoneStyle==='racao'` e pontinhos; prestígio → combo 1, stoneStyle 'stone'.
