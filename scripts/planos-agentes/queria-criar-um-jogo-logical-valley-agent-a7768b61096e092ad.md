# Plano — Seção 4 (entidades): fish.js, fireflies.js, reeds.js, lilies.js, frog.js

Contrato usado: `LQ.Idle.visible(id)` (engine, agente A) → inteiro ≥0 em idle, `-1` em zen. `LQ.Idle.bonus(kind,{x,y,mult})`, `LQ.Idle.has(id)`. Zen INTOCADO: toda regra atual vira o `zenValue` do helper.

## Helper comum (copiado em cada arquivo, local ao IIFE)
```js
// idle: população vem de LQ.Idle.visible(id); zen (ou -1): regra atual
function vis(game, id, zenValue){
  if (game.mode === 'idle' && LQ.Idle && LQ.Idle.visible){ const v = LQ.Idle.visible(id); if (v >= 0) return v; }
  return zenValue;
}
```
(Argumento `game` porque as entidades não guardam `game` — evita globals.)

## fireflies.js
- `MAX = 30`, `BASE = 5` (BASE só para o fade/estagger zen).
- `alive(game)`: `zen = !has('fireflies') ? 0 : has('fireflies2') ? 15 : 5` → `return vis(game,'vagalume',zen)`.
- `init`: pool de 30; `born=0` para `i<alive`.
- `onUnlock`: igual (usa `alive`).
- Recalcular ao comprar: em `update`, `if (n !== lastN){ for i in [lastN,n) se born<0 → born = t + (i-lastN)*0.7, woke=false; lastN=n }` (comparação por frame, barata; cobre prestígio também — n cai, os índices ≥n simplesmente não são atualizados/desenhados).
- Fade em `draw`: `i < BASE ? eff : game.unlockFade('fireflies2')` → em idle `fireflies2` pode não existir; usar `const f2 = game.has('fireflies2') ? game.unlockFade('fireflies2') : eff;` e para `i>=BASE` usar `f2` — em zen idêntico ao atual (f2 só é lido quando i≥5, o que só acontece com fireflies2). Constelação: `game.unlockFade('fireflies2')` → em idle usar `eff` se não tiver fireflies2. Pousar: `game.has('fireflies2')` → `(game.has('fireflies2') || (game.mode==='idle' && n >= 5))` (marco 5 "pousam nos juncos"); zen inalterado.

## fish.js
- `init`: 8 `makeFish(false)` + 3 `makeFish(true)` (dourados nos índices 8..10).
- `fishCount(game)`: zen = `!has('fish') ? 0 : has('fish2') ? 3 : 1`; idle = `vis('peixe') + vis('dourado')`. Em idle com dourados: precisamos que os índices dos dourados sejam ativos. Solução: função `activeIdx(game)` → em zen retorna `[0,1,8]` para 3 (2 normais + 1 dourado) ou `[0]`; em idle `[0..nNormal-1] ∪ [8..8+nGold-1]`. Recalculada só quando `(nNormal,nGold)` mudam (cache). Todos os loops `for i<n` passam a iterar `active`.
  - Zen atual: pool `[n,n,g]`, `fishCount 3` → normal,normal,dourado. Com `[0,1,8]` mantém-se exatamente.
- `fadeOf(f, game)`: zen igual (`f.gold || idx>0 ? fade('fish2') : fade('fish')`); idle: `f.gold ? (has('fish2')?unlockFade('fish2'):1) : unlockFade('fish')` + fade próprio de 1 s ao aparecer (`f.shown` = game.t quando passa a ativo; `smoothstep((t-f.shown)/1)`). Normais idle: `unlockFade('fish')`.
- Salto espontâneo: `spont = has('fish2') || sinceClick>20 || (idle && vis('peixe')>=5)` (marco 5 "saltam sozinhos").
- **Peixe come a pedra** (só idle):
  - `onImpact(p, game)`: `if (game.mode!=='idle' || !p || p.source!=='stone') return;` acha o peixe mais próximo ativo (mesmo critério do onRipple, d<CURVE_R) e grava `f.target = {x:p.x, y:p.y, t: p.t != null ? p.t : game.t}`. Nota: `onRipple` já roda antes (spawnRipple dentro de impact) e define `pull`; onImpact só marca o alvo — reaproveita o pull.
  - Em `update`, dentro do bloco `if (f.pull)`, quando `d < 20`: `if (f.target && game.t - f.target.t <= 1.5) eat(f, game)` senão comportamento atual. Se `f.pullT<=0` ou target expirado → `f.target=null`.
  - `eat(f, game)`: `startJump(f, game)`; `f.ate = true` (em fim de salto usa gotas douradas: `spawnDrops(..., 4, game.palette.gold)`); som: em `startJump` tocar `'fishJumpGold'` se `f.gold || f.ate`; `const mult = LQ.Idle.has('racao') ? 4 : (LQ.Idle.visible('peixe') >= 10 ? 3 : 2); LQ.Idle.bonus('fish', {x:f.x, y:f.y, mult});` guardado em try (engine pode não ter bonus ainda).
  - `game.calm > 8` continua exigido só para o salto zen; em idle o "eat" ignora calm.
- `onResize`: zera `pull`/`target`.

## reeds.js
- `init`: 16 juncos — esquerda `nx = 0.045 + i*0.04` (i 0..7 → 0.045..0.325), direita `nx = 0.985 - i*0.04` (i 0..7 → 0.985..0.705), com os 3 primeiros L e 4 primeiros R iguais aos literais atuais (0.045/0.085/0.125; 0.905/0.935/0.965/0.985 → ordem R: 0.985,0.965,0.935,0.905, depois 0.865…). Zen usa só esses índices → visual idêntico.
- `countL(game) = vis('juncosL', 3)`, `countR(game) = vis('juncosR', has('fireflies2') ? 4 : 0)`.
- Cada junco ganha `idx` (posição no seu lado) e `shown` (game.t em que apareceu; -1 nunca). Em `update`: `visibleReed(r) = r.idx < (r.side<0 ? nL : nR)`; se visível e `shown<0` → `shown = game.t`; se não → `shown=-1`.
- `draw`: alpha = `(r.side<0 ? 1 : rightFade)` em zen; em idle `alpha = smoothstep((t-shown)/1)` (fade 1 s). Zen: manter `rightFade` como hoje (`has('fireflies2') ? unlockFade : 0`) — em idle, `rightFade` trocado por 1 × fade próprio.
- `onRipple` e `perches()`: usar `visibleReed(r)`.

## lilies.js
- `place(game)`: `n = game.mode==='idle' ? 12 : 3+floor(rand*3)`; cria `n` lírios; `shown()`; `game.lilyCount = count(game)`.
- `count(game) = vis(game,'lirio', lilies.length)` (zen: todos). Em idle, `game.has('lilies')` fica true via forceUnlock ao comprar o 1º; mantém checks `has('lilies')`.
- Ativos = primeiros `count`. `L.shown` para fade 1 s (`fadeL = unlockFade('lilies') * smoothstep((t-shown)/1)`). Em `update`, se `count !== lastCount` → ajustar `shown`, `game.lilyCount = count`.
- `update/onRipple/onClick/draw`: iterar só os ativos. Achievement `night_bloom`: `lilies.slice(0,count).every(bloomed)`.
- Posições para 12: espaçar `y` por índice (`(i+rand)/n`), `x` aleatória com `safeX` — já é o que `place` faz.

## frog.js
- `frogs = []` até `MAX=5`; `frogCount(game) = vis('sapo', 1)`. `mk()` cria objeto igual ao singleton atual.
- `home(f, i, game)`: faixa x = `[0.55 + i*0.09, 0.64 + i*0.09]` da largura (i=0 → 0.55..0.64… ajustar para i=0 manter `0.72+rand*0.18` em zen: usar `i===0 ? 0.72+rand*0.18 : W*(0.55 + (i-1)*0.1 + rand*0.06)`, todos ≥0.55, ≤W-30); `croakTimer = 40 + rand*50 + i*11` (escalonado); `dir=-1`.
- `jump(f, game)`: mesma lógica com limites `[W*0.55, W-30]`.
- `update`: `n=frogCount`; `for i<n` (criar lazily `frogs[i] = mk(); home(...)`, `shown=game.t`); loop com corpo atual por sapo (o `return` dentro do pulo vira `continue`).
- `onClick`: percorre ativos, primeiro a <60 px.
- `draw`: percorre ativos; `fade = unlockFade('frog') * smoothstep((t-shown)/1)`; corpo atual extraído para `drawFrog(f, ctx, game, fade)`.
- `onResize/onUnlock/init`: aplicar a todos os ativos.

## Verificação
- `node --check` em cada arquivo.
- Zen (servidor :8765, `?mode=zen` / padrão): 5/15 vagalumes, 1/3 peixes (índice 8 = dourado com fish2), 3+4 juncos, 3-5 lírios, 1 sapo — `LQ.Idle.visible` nunca chamado (mode check antes).
- Idle: comprar vagalume 1/5/10/25 → 3/6/9/12… conforme `pop`; peixe 1 → 1 peixe; jogar pedra perto → peixe alcança em ≤1.5 s, salta com gotas douradas, som gold, floater bônus.
