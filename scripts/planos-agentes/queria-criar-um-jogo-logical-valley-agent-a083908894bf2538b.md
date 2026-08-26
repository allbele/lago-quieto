# Plano — INTEGRADOR (Idle v2): aplicar W1 + A/B/D/E, corrigir conflitos, testar

Estado verificado no disco (2026-08-26): **nada dos 5 planos foi aplicado**. `data.js` sem `name/desc/pop/bonus/racao`; `engine.js` sem `visible/lakePoint/bonus/combo`; `hud.js` e `style.css` antigos; entidades e `sky.js` antigos; `idle/glints.js` não existe; `game.js` sem `t`/`stoneStyle`/`silent`. Servidor :8765 responde 200. Extensão Chrome não testada — usar `scratchpad/cdp.js` (driver headless; `fixtest.js` já tem helpers `size()`/`fps()`).

Planos-fonte (conteúdo exato):
- W1 data: `…/agent-a7d87f9e63a7cad8a.md`
- A engine/state/game: `…/agent-a711f6b8a1b26a6b8.md`
- B hud/css (arquivos completos): `…/agent-a667cfa5227797c97.md`
- D entidades (descritivo): `…/agent-a7768b61096e092ad.md`
- E sky/glints/index (arquivos completos): `…/agent-af7c872b096d8b6a5.md`
(todos em `/Users/mateu/.claude/plans/queria-criar-um-jogo-logical-valley-`)

## 1. Ordem de aplicação (dependências)
1. `web/idle/data.js` (W1) — contrato: `name/desc/milestones`, upgrade `racao`, `pop`, `bonus` (`fishMult:2, fishMult10:3, racaoMult:4, …`).
2. `web/idle/state.js`, `web/game.js` (3 hooks), `web/idle/engine.js` (A).
3. `web/idle/hud.js` + bloco `/* IDLE */` de `web/style.css` (B, cópia integral).
4. `web/ent/fireflies.js`, `fish.js`, `reeds.js`, `lilies.js`, `frog.js` (D — implementar conforme plano D; código atual lido, hooks já existem).
5. `web/ent/sky.js` (E, reescrita), novo `web/idle/glints.js`, `index.html` (`<script src="idle/glints.js">` após `idle/hud.js`).
6. `node --check` em: data, state, engine, hud, glints, game, fireflies, fish, reeds, lilies, frog, sky (12 arquivos).

## 2. Conflitos/bugs entre planos — corrigir AO aplicar
1. **HUD `onResize(_, game)` quebra**: o núcleo chama `call('onResize', game)` → `game` chega no 1º argumento; a assinatura do plano B recebe `undefined` em `game` → `TypeError` a cada resize. Usar `onResize(game){ if (game && game.mode === 'idle') this.placeCard(); }`. (Sky/entidades já usam `onResize(game)` — corretas.)
2. **`state.migrate` deve preservar `stats.bonusSeen`** (B grava `{chave:true}`; A só migra `bonuses`). Acrescentar em `migrate`: `out.stats.bonusSeen = {}; if (st.bonusSeen && typeof st.bonusSeen==='object' && !Array.isArray(st.bonusSeen)) for (const k in st.bonusSeen) if (idOk(k) && st.bonusSeen[k]) out.stats.bonusSeen[k] = true;` e `fresh().stats.bonusSeen = {}`. Sem isso o toast "1ª vez" repete a cada reload.
3. **Multiplicador do peixe vem de `data.bonus`**, não hardcoded: `mult = has('racao') ? (B.racaoMult||4) : (visible('peixe') >= 10 ? (B.fishMult10||3) : (B.fishMult||2))`.
4. **Janela "peixe come a pedra"**: `pull.dur = max(1.6, bd/90)` e `pullT` 1.5–2 s → com janela fixa de 1.5 s o peixe pode chegar a d<20 tarde demais e o bônus nunca disparar. Implementar: `eat` se `f.target && (d < 20 || (f.pullT <= 0 && d < 40))` com janela `game.t - target.t <= 2.2` (constante `EAT_WIN`). Validar empiricamente no teste 4 (clique a ~60–100 px do peixe; a <26 px ele mergulha, `onClick` consome o clique).
5. **Hooks de depuração read-only** (para o integrador contar população sem OCR de canvas; sem efeito no jogo):
   - `LQ.fireflies.list` já existe → visíveis = `list.filter(f => f.born >= 0 && game.t >= f.born).length` limitado a `alive`. Expor também `LQ.fireflies.alive = () => alive(LQ.game)`.
   - `LQ.fish = { active: () => activeIdx(game).slice(), list: fish }`.
   - `LQ.reeds.visible = () => reeds.filter(visibleReed).length` (+ por lado).
   - `LQ.lilies = { count: () => count(game) }`; `LQ.frog = { count: () => frogCount(game) }`.
   - `LQ.sky = { info: () => ({ stars: visibleN, ridges: ridges.length, moonScale: moonPop(game).scale, reflect: reflect.life }), forceShoot(){ shootTimer = 0; } }`.
   - `LQ.glints = { force(){ timer = 0; }, state: glint }`.
   (`game` = `LQ.game`, já exposto pelo núcleo.)
6. **Ordem de `onClick`** (inversa ao registro): glints (registrado por último) → sky (reflexo) → … → fish/lilies/frog. OK como planejado; conferir que `idle/prestige.js` não tem `onClick` (não tem).
7. **Fórmula `vis` (PLANO, fonte da verdade)** dá para vagalume n=1/5/10/25 → **6/9/12/15** (não "3→6→9→12"); peixe 1/5/10/25 → 2/3/4/5 (+dourado 1/5/10 → 2/3/4, cap 3); juncos L 1/5/10/25 → 4/5/6/7, R → 2/4/6/8; lírios 1/5/25 → 4/5/7; sapos 1/5/25 → 2/3/5; estrelas 1/5/10/25 → 30/45/60/75; montanhas 1/5/25 → 3/4/4; lua scale 1/5/25 → 1.08/1.16/1.32. Usar estes valores no checklist. Se o usuário quiser "n=1 → base", trocar para `floor(log2(n))` em `data`/engine (decisão do usuário, não do integrador).

## 3. Roteiro de teste (cdp.js; novo `scratchpad/int.js`)
Helpers de `fixtest.js`: `size(w,h)` (Emulation), `fps(label)`, `nav` com `?x=Date.now()`, `LQ.Platform.saveCloud=null`.

**T1 node --check** nos 12 arquivos.

**T2 ZEN** — `localStorage.clear()`, `setItem('lagoquieto.mode','zen')`, nav. `LQ.Idle.visible('peixe') === -1`, `LQ.Idle.moon() === null`, `game.stoneStyle === 'stone'`, `#hud/#shop` display none. `forceUnlock` de `fireflies,wind,fish,stars2,moon,fireflies2,fish2,sky_alive,fog_clear,lilies,frog` (sleep ≥ 2.5 s × n + fade). Checar: vagalumes 5 (só fireflies) depois 15; peixes `LQ.fish.active()` = `[0]` → `[0,1,8]`; juncos 3 → 7; lírios 3–5 (`lilies.length`); estrelas 15/35/60 (`LQ.sky.info().stars`); ridges 2; sapos 1; `LQ.sky.info().moonScale === 1`; console sem `[EXC]`/erro. Screenshot `z-full.png` e comparar a olho com `scratchpad/04-full.png` (antes).

**T3 IDLE loja/populações** — `localStorage.clear()`, modo idle, nav. `[...document.querySelectorAll('#shop .gen .name')].map(textContent)` = 10 nomes PT; `.desc` não vazio e ≤40 chars; `s.cur = 1e12` → todas as linhas visíveis; hover: `Input.dispatchMouseEvent mouseMoved` sobre a 1ª linha → `#shop-card` não hidden, contém `li.next`. Compras via `LQ.Idle.buy(id, n)` para n = 1/5/10/25 (set cur alto) e leitura dos hooks da seção 2.5; esperar ~1.5 s (fade/estagger 0.7 s × novos) antes de contar. Lua: comprar `lua` 1/5/25 → `moonScale` 1.08/1.16/1.32 e `game.moonR` cresce. Nevoa 5 → ridges 3; 25 → 4. Aurora 10 → `auroraBands` 2 (expor em `LQ.sky.info`). Upgrade `racao` aparece na lista `.up` com nome "Ração" e `.fx` "×4".

**T4 BÔNUS**
- Peixe: `LQ.fish.list[0]` (born, não pulando) → clique CDP em `(f.x+70, f.y)` (na água) → em ≤2.5 s `stats.bonuses.fish === 1`, floater `H.floats` com `gold:true` e txt terminando em "✦", toast `.show` com texto "O peixe comeu a pedra! ×2".
- Ração: `s.cur += 1e6; LQ.Idle.buyUpgrade('racao')` → `game.stoneStyle==='racao'`; repetir clique → mult 4 (payload do `bonus` via `LQ.Idle.on('bonus', p => window.__b = p)`); screenshot durante a queda da pedra (`sleep 120 ms` após mouse) para ver pontinhos.
- Glint: `LQ.glints.force()`, `sleep 200` → `LQ.glints.state.on`; clique em `(x,y)` → `__b.amount === Math.max(LQ.Idle.totalRate()*60, LQ.Idle.clickPower()*50)`.
- Combo determinístico: `base = performance.now()/1000 + 0.5; for i<10: LQ.game.emit('impact',{x:400,y:hy+120,strength:1,source:'stone',t: base + i*0.8})` → `LQ.Idle.combo() === 1.9`, `#hud .combo` tem classe `on` e `hot`, `stroke-dasharray` ≈ `62.2 69.1`; depois `emit` com `t = base + 9*0.8 + 0.3` (fora de [0.3,1.5]? 0.3 está no limite → usar 0.2) → `combo() === 1`. Também versão real: 10 `mouse()` com `sleep(800)` → ≥1.7 (tolerância 0.12 + jitter do driver).
- Cadente: `LQ.Idle.buy('estrelas',1)`; `LQ.game.dayPhase < 0.3` (noite padrão); `LQ.sky.forceShoot()`; `sleep 150` → `LQ.sky.info().reflect > 0`; clique em `(reflect.x, reflect.y)` (expor x,y em info) → `__b.kind==='shooting'`, `mult 25`.
- Prestígio: `s.life = 1e10; LQ.Idle.claimPrestige()` → `combo()===1`, `stoneStyle==='stone'`, glint/reflect apagados.

**T5 FPS** — `size(2560,1440)`, `s.cur=1e15`, comprar cada gerador ×40 (todos no cap: 30 vagalumes, 8+3 peixes, 16 juncos, 12 lírios, 5 sapos, 200 estrelas, 4 cordilheiras, aurora 2 faixas, lua 1.6), loja fechada, `fps('1440p cap', 4000)` ≥ 55 fps; repetir com loja aberta. Console: filtrar `logs` por `[EXC]`/`error` = 0 em todos os testes.

## 4. Correções esperadas durante o teste (verificar, corrigir se falhar)
- Combo real via CDP pode ficar <1.9 por jitter → só a versão sintética é critério de ≥1.9.
- Fade/estagger: contagem de vagalumes recém-comprados só bate após `0.7·(novos)` s.
- `lakePoint` fora da loja: com `#shop` 300 px aberto, `x ≤ W-40-300`.
- Se FPS <55 a 1440p: suspeitos = 30 glows de vagalume (já cacheados), 16 Path2D de juncos (barato), aurora 2 faixas (2× colunas no offscreen 1/8 — cortar `x += 3` na 2ª cortina), 8 peixes com 4 elipses de rastro cada.

## 5. Entrega
Checklist ✅/❌ por item (T1–T5) com os números observados vs. esperados (seção 2.7), lista do que foi corrigido, sem commit, sem Artifact.
