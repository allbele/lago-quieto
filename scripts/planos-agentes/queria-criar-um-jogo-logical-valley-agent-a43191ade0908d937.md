# Plano — CORRETOR FINAL (Idle v2): aplicar planos + achados dos revisores

Estado verificado no disco (2026-08-26, plan mode → nada editado): `web/` continua no baseline. Nenhum dos planos W1/A/B/D/E foi aplicado (`grep milestones|pop:|bonus web/idle/data.js` = 0; `idle/glints.js` não existe; `game.js` sem `t/stoneStyle/silent`; `hud.js` 260 px sem nome/desc). Servidor :8765 responde 200. Por isso os achados "alta" dos dois revisores (nada implementado) são a causa raiz — o corretor só tem o que corrigir depois de aplicar os planos.

Planos-fonte (em `/Users/mateu/.claude/plans/queria-criar-um-jogo-logical-valley-`):
- W1 data `agent-a7d87f9e63a7cad8a.md` · A engine/state/game `agent-a711f6b8a1b26a6b8.md` · B hud/css (arquivos completos) `agent-a667cfa5227797c97.md` · D entidades (descritivo) `agent-a7768b61096e092ad.md` · E sky/glints/index (completos) `agent-af7c872b096d8b6a5.md` · integrador `agent-a083908894bf2538b.md` (6 conflitos já listados; todos confirmados na leitura do código).

## 1. Ordem de aplicação
1. `web/idle/data.js` (W1) → 2. `web/idle/state.js`, `web/game.js` (3 hooks), `web/idle/engine.js` (A) → 3. `web/idle/hud.js` + bloco `/* IDLE */` de `web/style.css` (B) → 4. `web/ent/fireflies.js`, `fish.js`, `reeds.js`, `lilies.js`, `frog.js` (D) → 5. `web/ent/sky.js`, novo `web/idle/glints.js`, `<script src="idle/glints.js">` após `idle/hud.js` em `index.html` (E) → 6. `node --check` nos 12 .js (data, state, engine, hud, glints, game, fireflies, fish, reeds, lilies, frog, sky).

## 2. Correções a aplicar POR CIMA dos planos (achados dos revisores + conflitos do integrador)

### Alta
A1. **HUD `onResize`** (B linha `onResize(_, game)`): núcleo chama `call('onResize', game)` → usar `onResize(game){ if (game && game.mode === 'idle') this.placeCard(); }`.
A2. **Marcos por CONTAGEM, não por `visible()`** (D usa `vis('peixe')>=5/10` e `n>=5` de vagalumes — `vis` = base+floor(log2(n+1))·k, então `visible('peixe')>=10` só aos 511 peixes):
   - fish.js `spont`: `(idle && LQ.Idle.genCount('peixe') >= 5)`; multiplicador: `has('racao') ? B.racaoMult||4 : (LQ.Idle.genCount('peixe') >= 10 ? B.fishMult10||3 : B.fishMult||2)` (B = `LQ.IdleData.bonus`).
   - fireflies.js pousar/constelação: `(game.has('fireflies2') || (game.mode==='idle' && LQ.Idle && LQ.Idle.genCount('vagalume') >= 5))`.
A3. **"Peixe come a pedra" só por `onImpact` com `source==='stone'`** (achado: `onRipple` recebe anéis automáticos/orvalho/mergulho). Além do que D já prevê: medir a distância ao **`f.target`**, não ao `f.pull` (um anel automático pode re-puxar o peixe para outro ponto dentro da janela e pagar bônus falso). Em `update`, dentro de `if (f.pull)`: `const dT = f.target ? Math.hypot(f.target.x - nx, f.target.y - ny) : 1e9; if (f.target && game.t - f.target.t <= EAT_WIN && (dT < 20 || (f.pullT <= 0 && dT < 40))) eat(f, game);` com `EAT_WIN = 2.2` (integrador #4). `f.target.t` = `game.t` no momento do impacto (não `p.t`, que é `performance.now()`). Expirar: `if (f.target && game.t - f.target.t > EAT_WIN) f.target = null`.
A4. **state.js**: `fresh().stats` ganha `bonuses:{}` **e** `bonusSeen:{}`; `migrate` coage ambos (bonuses → `int` por chave `idOk`; bonusSeen → `true` por chave `idOk` verdadeira). Engine já faz `s.stats.bonuses = s.stats.bonuses || {}` antes de incrementar (plano A) — manter.

### Média
M1. **`lakePoint()`** (engine): ler a largura real via DOM em vez do flag local: `const el = document.getElementById('shop'); const sw = el && el.classList.contains('open') ? el.offsetWidth : 0;` e excluir a faixa da barra: `y = horizonY + 20 + rand() * max(10, H - horizonY - 90)`. O laço de anéis automáticos passa a chamar `lakePoint()`. (`shopOpen`/`onShopToggle` podem sair.)
M2. **hud.js listeners sem duplicar**: em `init`, `if (this._offs) this._offs.forEach(f => f()); this._offs = [];` e cada `I().on(...)` guardado: `this._offs.push(I().on('currency', ...))` (engine `on` já devolve o unsubscribe).
M3. **Card com atraso no hover** (ruído ao rolar): em `bindCard` `pointerenter` (mouse) → `clearTimeout(this.hoverT); this.hoverT = setTimeout(() => this.showCard(info), 250);` e `pointerleave` → `clearTimeout(this.hoverT); this.hideCard();`. Mobile já cai "abaixo da linha" (B `placeCard`) com toque longo 400 ms que não compra — OK.
M4. **Floater do marco ×2 nomeia o gerador**: no handler `upgrade` auto: `this.spawnFloat('×' + (p.value || 2) + ' ' + ((I().gen && I().gen(p.gen) || {}).name || p.gen), ...)`.
M5. **Título/tooltip nos upgrades e linhas** (acessibilidade): `b.title = (u.name||u.id) + ' — ' + (u.desc||'')`; `r.title = g.name + ' — ' + g.desc`.

### Baixa (triviais)
B1. **`fmt` sem ".0"** (`util.js`): após `let s = ...`, `s = s.replace(/\.0$/, '')` (o caso `'100.0'` fica coberto). Mesmo em `hud.js` fallback `fmt` e em `fmtRate`: `return (n < 10 && n > 0 ? n.toFixed(1) : fmt(n)).replace(/\.0$/, '')`.
B2. **`.per` = total da linha**: `setText(row.per, n > 0 ? fmtRate(n * genRate(g, game)) + '/s' : fmtRate(genRate(g, game)) + '/s cada')` (o card já mostra "n · r/s cada").
B3. **Ícone `ic-goldfish`** (index.html) distinto do anel da moeda: `<symbol id="ic-goldfish" viewBox="0 0 24 24"><path d="M4 12c3-4 7-5.5 11-4.5 2 .5 3.5 2.5 5 4.5-1.5 2-3 4-5 4.5-4 1-8-.5-11-4.5z"/><path d="M9 10.5l1 1M12 9.5l1 1M15 10.5l1 1"/><path d="M10 7.5l1.5-2 1.5 2"/><circle cx="16" cy="11" r=".8"/></symbol>`.
B4. **Texto do marco 10 de Juncos** (W1 "balançam ao vento" — `wind` já vem na 1ª compra): trocar por "juncos dos dois lados".
B5. **Mobile**: em `@media (max-width:600px)` acrescentar `#shop .gen,#shop .up{max-width:420px;width:100%;margin:0 auto}`.

### Já cobertos pelos planos (só conferir ao aplicar)
- `spawnRipple(opts.silent)` + glints usam `silent:true` nos anéis de vida; anel do clique do bônus é normal (A/E).
- `bonus()` guarda `Number.isFinite` (sem NaN); `emit('bonus')`; floater dourado 17 px "+N ✦" 2 s; toast 1ª vez por chave (`fish`, `fish_racao`, `glint`, `shooting`); sons `unlock` (glint/cadente) e `fishJumpGold` (peixe) (A/B/E).
- Cadente em idle gateada por `genCount('estrelas')>=1` (não `sky_alive`); `reflect{x,y,life}` separado de `shoot` (E).
- Re-bake de estrelas/cordilheiras/lua só quando muda (`starCvN`, `mN`, `moonKey`) (E).
- Upgrades como linha inteira com name/desc/fx/custo; `#shop` 300 px; `.desc` ellipsis; `.mid{min-width:0}` (B).
- Prestígio: `resetCombo(); syncStoneStyle()`; glint/reflexo apagam via `LQ.Idle.on('prestige')` (A/E).

### Hooks read-only para teste (integrador #6) — sem efeito no jogo
`LQ.fireflies.alive = () => alive(LQ.game)`; `LQ.fish = { list: fish, active: () => activeIdx(LQ.game).slice() }`; `LQ.reeds.visible = () => reeds.filter(visibleReed).length`; `LQ.lilies = { count: () => count(LQ.game) }`; `LQ.frog = { count: () => frogCount(LQ.game) }`; `LQ.sky = { info: () => ({ stars: visibleN, ridges: ridges.length, moonScale: moonPop(LQ.game).scale, reflect: { x: reflect.x, y: reflect.y, life: reflect.life }, auroraBands }), forceShoot(){ shootTimer = 0; } }`; `LQ.glints = { force(){ timer = 0; }, state: glint }`.

## 3. Verificação (driver `scratchpad/cdp.js`, roteiro novo `scratchpad/corr.js`; helpers `size/fps` de `fixtest.js`)
T1 `node --check` ×12.
T2 ZEN (`localStorage.clear(); setItem('lagoquieto.mode','zen')`): `LQ.Idle.visible('peixe')===-1`, `LQ.Idle.moon()===null`, `game.stoneStyle==='stone'`, `#hud/#shop/#shop-card` inertes; `forceUnlock` de fireflies…aurora (2,5 s cada + fade) → vagalumes 5→15, `LQ.fish.active()` `[0]`→`[0,1,8]`, juncos 3→7, lírios 3–5, estrelas 15/35/60, ridges 2, sapo 1, `moonScale 1`; screenshot `z-full.png` vs `scratchpad/04-full.png`; console sem `[EXC]`.
T3 IDLE loja: 10 `.gen .name` PT, `.desc` ≤40, upgrades com `.name` ("Pedras pesadas ×2", "Orvalho +1/s", "Sono 12h", "Ração" fx "×4"); custos sem `.0` (`!/\.0[KMB]/.test(shopText)`); `.per` da linha com 11 vagalumes = "6.6/s"; hover 250 ms → `#shop-card` com `li.next`; 375 px → card abaixo da linha, dentro da viewport.
T3b Populações (esperado pela fórmula do PLANO): vagalume 1/5/10/25 → 6/9/12/15; peixe 1/5/10/25 → 2/3/4/5 (+dourado 1/5/10 → 2/3/4); juncos L 4/5/6/7 + R 2/4/6/8; lírios 1/5/25 → 4/5/7; sapos 1/5/25 → 2/3/5; estrelas 30/45/60/75; montanhas 1/5/25 → 3/4/4; lua scale 1.08/1.16/1.32; aurora 10 → 2 faixas. Esperar `0.7·novos + 1.5 s` antes de contar. (Se o usuário quiser "n=1 → base", trocar `log2(n+1)` por `log2(n)` — decisão dele.)
T4 BÔNUS: peixe (clique a ~70 px do `LQ.fish.list[0]`; ≤2.5 s → `stats.bonuses.fish===1`, floater `gold`, toast "O peixe comeu a pedra! ×2"; com 5 anéis automáticos entre o clique e a chegada NÃO paga duas vezes); ração (`buyUpgrade('racao')` → `stoneStyle==='racao'`, pontinhos, mult 4); glint (`LQ.glints.force()` → clique → `amount === max(totalRate()*60, clickPower()*50)`); combo sintético (10 `emit('impact',{…t: base+i*0.8})` → `combo()===1.9`, `#hud .combo.on.hot`; `t` fora da faixa → 1); cadente (`buy('estrelas',1); LQ.sky.forceShoot()` → `reflect.life>0`; clique → kind `shooting` mult 25); prestígio (`life=1e10; claimPrestige()` → combo 1, stoneStyle 'stone', glint/reflect off; reload sem toast repetido: `bonusSeen` migrado).
T5 FPS 1440p com tudo no cap (30 vagalumes, 8+3 peixes, 16 juncos, 12 lírios, 5 sapos, 200 estrelas, 4 cordilheiras, aurora 2 faixas, lua 1.6): ≥55 fps loja fechada e aberta; console 0 erros.

## 4. Fora deste plano (fica de fora / decisão do usuário)
- Fórmula `vis` n=1 → base (PLANO dá 6 vagalumes na 1ª compra, revisor sugeriu 3→6): manter PLANO salvo decisão do usuário.
- Accordion inline no mobile (revisor): B já resolve com card abaixo da linha + toque longo; accordion fica para depois.
- Textos `desc` do revisor (formato "+1.7K/s") vs W1 ("+1700 ondas/s"): ambos ≤40; manter W1.
- Publicação (commit/push/bundle/Steam/DIARIO) — não faz parte; sem Artifact.
