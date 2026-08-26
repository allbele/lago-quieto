# Plano: Lago Quieto — modo ⚡ Idle (incremental completo) + correções do modo 🌙 Zen

## Contexto

O Lago Quieto zen está publicado (https://allbele.github.io/lago-quieto/, Steam preparado). O usuário gostou, mas num mood mais agitado achou que "não tem nada pra fazer". Pedido: **não descartar o zen**; usar como base para um **idle/incremental de verdade** (cliques iniciais → automação → progressão), com agentes fazendo tudo. Decisões do usuário:
- **Mesmo lago, modo separado**: na abertura escolhe 🌙 Zen ou ⚡ Idle; troca depois pela barra de ícones; saves separados; um repo, uma página Steam.
- **Números discretos** permitidos (1.2K, 3.4M), loja com ícone + custo + efeito; sem tutorial/parágrafos.
- **Progressão completa**: recurso + 10 geradores + upgrades + prestígio + metas.
- **Bugs zen a corrigir**: barra/ícones estranhos; reflexo/aurora/névoa com faixas; "coluna da lua até o fim do lago" ao clicar num botão.

## Diagnóstico dos bugs (código lido)
- **Coluna da lua**: `drawMoonReflection` (`web/game.js:444-465`) desenha um trapézio contínuo horizonte→fundo com `len = moonR*14` e piso de alpha `+0.008` em todas as fatias; no **modo eco** (ícone folha) vira um retângulo sólido único (`:450-454`). Clicar folha/tela-cheia chama `resize()` e alterna eco → coluna aparece. Fix: reflexo em cintilações (glints) com jitter e falloff `pow(f,1.6)`, comprimento `moonR*8`, sem piso de alpha; eco = versão com menos fatias, nunca retângulo.
- **Barra**: `#ui` sem `align-items:center`/safe-area; `gap` fixo estoura em telas estreitas; botão coleção repete o glifo da lua (parece 2 luas com tema). Adicionar 6º botão (modo) e 7º (loja, só idle) exige `gap: clamp()`.
- **Faixas**: névoa com alpha 8-bit em gradiente longo; aurora com colunas de 2px em offscreen W/8 escaladas; reflexo em fatias de 3px. Fix: `imageSmoothingQuality='high'`, ruído azul 1-2% nos offscreens, aurora com 5 rects afunilados, jitter por fatia.

## Arquitetura (reaproveitando o que existe)

Fatos do código: `LQ.register(name,{init,update,draw(layer),onResize,onRipple,onUnlock,onTheme,onClick})` (`game.js:9-14`); `LAYERS` (`:661`); `UNLOCKS` one-shot por tempo/ripples (`:59-73`, `checkUnlocks :483`, `applyUnlock :490`); save `lagoquieto` via `LQ.Platform` (`:79-117`); UI estática 5 botões + `UI.act` if/else (`:586-651`); `uihidden` após 3 s (`:626`); rAF para quando aba oculta (`:709`); offline creditado só em `totalTime` **antes** do `init` (`:728`); áudio com primitivas `plop/bell/blip` (`audio.js:175-223`), 8 vozes; zero texto renderizado hoje; temas via `LQ.themes` + `setPaletteOverride` + `paletteVersion`.

### 1. Núcleo (`web/game.js`, `web/platform.js`, `web/index.html`)
- `game.mode` ('zen'|'idle'); `localStorage['lagoquieto.mode']`; save key `lagoquieto` (zen, intacto) / `lagoquieto.idle`. `load/save/LQ.reset` usam a key do modo; `Platform.saveCloud/loadCloud(json, key)` (Steam: `save.json` / `save-idle.json`).
- `LQ.boot()`: sem modo → tela `#modepick` (fundo #050914, dois ícones SVG grandes 🌙/⚡ em fade, sem texto) → `LQ.start(mode)`. `LQ.switchMode(m)`: save, grava modo, `location.reload()`.
- Hooks novos: `onOffline(seconds, game)` disparado **depois** de `call('init')` e na volta de aba oculta; `game.emit(name, payload)` → `call('on'+Name)`; `throwStone/impact` emite `impact {x,y,strength,source}`; lírio/sapo emitem também. Idle ganha moeda **só** em `onImpact` (nunca em `spawnRipple`, evitando loop com anéis automáticos).
- `game.unlocksEnabled`: em idle, `checkUnlocks` não roda por tempo; idle chama `game.forceUnlock(id)` (wrapper de `pending.push`) — a cena acorda conforme geradores comprados (peixe aparece quando compra "peixe", lua quando compra "lua"...).
- `UI.act`: ramos `mode` e `shop`; `UI.update`: `UI.pinned` (loja aberta) pausa o `uihidden`. `LAYERS` ganha `'hud'` no topo (floaters `+N` em canvas — único `fillText` do jogo, 11px, alpha ≤0.6).
- `migrate()`: preserva `s.idle` se objeto; sub-migração fica em `idle/state.js`.

### 2. Economia (`web/idle/data.js`, `state.js`, `engine.js`, `util.js`)
- Estado: `s.idle = {v, cur, life, gens:{id:n}, ups:[], prest:{pts,runs,mult}, goals:[], lastTick, stats:{clicks, offlineEarned, bestRate}}`, com `IdleState.migrate` coercitivo.
- Recurso: **"ondas"** (a moeda é o próprio anel; ícone de anel). Clique = 1×poder. 10 geradores ligados aos moradores/UNLOCKS: orvalho, sapo, vagalume, peixe, lírio, juncos, lua, estrelas, aurora, névoa — `{id, icon, base, growth 1.15, rate, unlock}`; upgrades (mult por gerador, poder do clique, teto offline 8h→24h, auto-clique); metas → achievements existentes + novos.
- `engine.update(dt)`: `cur += rate*dt`, `lastTick` a cada 1 s; `onOffline(sec)`: `rate*min(sec,cap)*0.5`, pulso de boas-vindas no HUD (ícone + `fmt(earned)` 5 s + sino). Anéis visuais da automação: acumulador, ≤3 spawns/s, `strength` por `log10(rate)`, nunca com `document.hidden`.
- `util.js`: `fmt(n)` (K/M/B/T → `1.2e15`), `cost()` soma geométrica, `maxAffordable()` por log; compra x1/x10/max.
- **Balanceamento por painel de agentes** (workflow): 3 designers de economia propõem curvas (base/growth/rate) → simulação headless em Node (tempo até cada gerador, até 1º prestígio ≈ 45-60 min, 2º ≈ 2 h) → juiz escolhe → grava `data.js`.

### 3. HUD/loja (`web/idle/hud.js`, `style.css`, `index.html`)
- `#hud` topo-esquerdo: moeda + taxa/s (opacidade mínima 0.35 quando `uihidden`, nunca 0). `#shop` painel lateral `.open` com linhas `.gen` (ícone `<use href="#ic-…">`, contagem, custo, barra de progresso até próxima compra), 3 pontos x1/x10/max, aba upgrades, botão prestígio (aparece quando `pts ≥ 1`). Fontes: sistema; sem parágrafos. Mesmo idioma visual dos ícones (traço 1.5px, `--ico`).

### 4. Prestígio (`web/idle/prestige.js`, `ent/themes.js`)
- `pts = floor(sqrt(life/1e6))`, `mult = 1 + 0.1*pts`. Reset: `cur, gens, ups, goals` não permanentes + cena (`LQ.resetScene()` limpa `unlocked/pending` e re-`init`). Persistem: `prest, life, stats`, tema, mute/eco. Reskin: runs 1-4 → `setPaletteOverride(PRESTIGE_TINTS[n])`; runs ≥5 → rotação de temas. Cascata de sinos.

### 5. Correções zen (`game.js` reflexo, `ent/sky.js`, `ent/fog.js`, `style.css #ui`)
Conforme diagnóstico acima. Verificar clicando cada botão isoladamente com `game.eco` logado.

### 6. Steam/Pages
- `steam/steam.js`: achievements novos do idle (6-8 ids) mapeados; cloud com 2 arquivos. `store/loja-*.md`: parágrafo "dois modos". Re-bundle do Artifact (`store/bundle`). Deploy via `scripts/deploy-pages.sh`. Rebuild Mac.

## Execução (workflows multi-agente, ~15 agentes cada)
1. **Workflow A — Núcleo + zen fixes** (sequencial primeiro): agente núcleo (hooks §1) ‖ agente zen-fixes (§5, arquivos distintos) → verificação no Chrome (zen continua idêntico; botões não geram coluna).
2. **Workflow B — Economia**: 3 designers → simulador Node → juiz → `data.js`; em paralelo agentes `state/engine/util`, `hud`, `prestige` (donos exclusivos de arquivos) → integrador no Chrome (compra, taxa, offline, prestígio) → 2 revisores (bugs; "sensação de idle": ritmo das primeiras 5 compras < 3 min, nunca fica sem o que fazer por > 2 min na 1ª hora) → corretor.
3. **Workflow C — Teste & publicação**: 3 testadores (primeira vez idle / troca de modo e saves / stress de números grandes 1e15+) → verificação → correções → screenshots do idle → deploy Pages + Artifact + rebuild Mac → `DIARIO.md`.

## Arquivos críticos
`web/game.js`, `web/index.html`, `web/style.css`, `web/platform.js`, `web/ent/sky.js`, `web/ent/fog.js`, `web/ent/themes.js`, novos `web/idle/{data,state,engine,util,hud,prestige}.js`, `steam/steam.js`, `store/bundle/`, `DIARIO.md`.

## Verificação
- Zen: abrir, clicar cada um dos botões (som, tela cheia, tema, coleção, eco, modo) — nenhuma coluna sólida; save `lagoquieto` antigo carrega igual; screenshots antes/depois do reflexo, aurora, névoa.
- Idle: do zero, 5 compras em < 3 min; taxa/s sobe; fechar aba 10 min → volta com ganho offline e pulso de boas-vindas; `x10/max` corretos (`cost()` vs. soma manual); prestígio reseta o certo e aplica tinta; números até 1e18 formatam; console limpo; 60 FPS com 10 geradores.
- Troca de modo preserva os dois saves. Steam build Mac abre nos dois modos. Pages e Artifact atualizados.
