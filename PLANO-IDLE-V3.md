# Plano: Lago Quieto — Idle v3 "A Margem que Acende" (loja persistente, economia, propósito, toasts)

## Contexto

Idle v2 publicado. Feedback do usuário após jogar a build Steam:
1. **Loja** pequena, simples, não chama atenção; ter que abrir é ruim (manter opção de fechar); precisa mostrar claramente **quanto produz/s** e **quantos tem**.
2. **Economia** desequilibrada: milhões/s enquanto o clique dá 32 — clique inútil.
3. Instinto de **expulsar peixes/vagalumes para as beiradas** → transformar em gameplay/objetivo.
4. **"Pra quê?"** — falta propósito; quer algo que **mostre evolução sem ser texto**; **notificações de desbloqueio estilo Cookie Clicker** funcionam; textos divertidos pipocando são bem-vindos.

Decisões do usuário: eras **"A Margem que Acende"** (construções na margem); **lanterna** como pastoreio de vagalumes; **falatório do lago** com toggle. Zen intocado. Só PT-BR. **Sem Artifacts** (regra permanente).

## Diagnóstico (código lido)
- `clickPower = 1 × 2^upgrades(≤64) × prestígio` (`idle/engine.js:63`); `rate` compõe 10 geradores × marcos ×2 em 10/25/50/100/200 (×32 cada, `applyMilestones :191`). Clique morre em minutos.
- Loja: painel 300 px `translateX` fechado por padrão, só abre pelo ícone (`hud.js:385`, `style.css:68`); `.per` mostra só taxa **por unidade**, nunca o total do gerador (`hud.js:457`); toast de slot único (`toastQ`).
- "Expulsar": anéis automáticos caem sem parar (`engine.js:291`) empurrando vagalumes (`fireflies.js:211`, flee 150 px) e arrastando peixes (`fish.js:254`). Lê-se como "bichos empurrados para a borda".
- Nada visual para `goal`/achievement (`emit('goal')` sem ouvintes). Coleção (`refreshCollection`, `game.js:699`) é o único "desbloqueio" visível.
- Layout: `game.W = innerWidth` (`game.js:219`); entidades usam `game.W` (lua 0.78W). Um painel fixo precisa **reservar** largura, não cobrir.

## Arquitetura (5 frentes, arquivos exclusivos)

### A. Loja persistente + layout reservado (`idle/hud.js`, `style.css`, `game.js` resize, `index.html`)
- Desktop ≥900 px: `#shop` **aberto por padrão**, 360 px (clamp 340-380), sem translate; botão "‹" recolhe para **trilho de 48 px** (anel reabre; ícones dos geradores compráveis com ponto dourado; badge de melhorias). Estado em `localStorage 'lagoquieto.idle.shopOpen'`. Mobile ≤600: drawer overlay como hoje.
- **Cena não coberta**: CSS var `--shop-w` (360/48/0) no body; `#lake{right:var(--shop-w)}`; `resize()` usa `canvas.clientWidth`; `#ui/#collection/#toasts` com `right:var(--shop-w)`; `shopToggle` → `resize()` imediato. `engine.refreshShopW()` retorna 0 quando reservado (só mobile overlay mantém valor).
- Cabeçalho sticky: total 28px/700 · "12.4K/s" 14px · **"+38 por pedra (12% do lago)"** dourado · segmented **x1 | x10 | x100 | max** · abas **Moradores | Melhorias** (badge).
- Linha do gerador (min-height 68px, linha inteira clicável): ícone 36px · nome 14px/600 · **contagem 20px/700** ("x12") · **"produz 7.2/s · 0.6/s cada"** · custo 13px dourado se pagável + "faltam 1m20" · barra 4px · "próximo marco: 10 → ×1.5, formam constelações (faltam 3)". Hover 250 ms/›: expande inline os marcos (substitui o card flutuante — remover `buildCard/placeCard`).
- Melhorias: grid 2 col, ícone 36, nome, desc 2 linhas ("cada pedra rende ×2 e +4% do lago"), visíveis a partir de 25% do custo.
- Geradores só aparecem se `era ≥ gen.era` (ver C).

### B. Economia (`idle/data.js`, `idle/engine.js`, `scripts/sim-economy.mjs`, `scripts/econ-props/prop-v3.json`)
- **`clickPower = (clickBase·clickMult + clickPct·rate()) · globalMult · combo`**, `clickPct = 0.10 + 0.04·(Pedras pesadas)` (máx 0.34). Orvalho (auto) paga só a parte fixa. Bônus glint/cadente seguem clickPower.
- Marcos **×1.5 em 10/25/50/100** (×5.06; era ×32). Texto "×1.5 produção".
- Tabela (growth 1.15): vagalume 8/0.25 · juncos 40/1.2 · peixe 180/5 · estrelas 800/20 · lua 3000/70 · dourado 12K/250 · névoa 55K/900 · lírio 250K/3500 · sapo 1.1M/13K · aurora 4.5M/45K. Pedras pesadas I-VI 15/150/1.5K/15K/150K/1.5M (`value:2`, `pct:0.04`). Prestígio `K` ≈ 2.5e8 (ajustar no sim).
- Sim: estender com `clickPct`, auto = parte fixa, marcos grátis, `--combo 1.3`, relatar `clickShare` 5/15/30/60 min, taxa 30/60 min, `maxGap`. Alvos: 1ª compra <20 s; 5 distintos <3 min; gap <60 s; aurora 38-45 min; taxa 30 min 20-60K/s, 60 min 0.5-2M/s; **cliques 25-35% aos 30 min, ≥5% aos 60**; prestígio 50-60 min. Iterar até bater, então gravar em `data.js`.
- **Anéis automáticos**: não arrastam peixes nem espantam vagalumes (`spawnRipple({auto:true})` → entidades ignoram em `onRipple`), frequência menor (≤1/s) e só como decoração.

### C. Eras "A Margem que Acende" (`idle/data.js` eras, `idle/engine.js` checkEra, novo `ent/shore.js`, `idle/state.js`)
| Era | life ≥ | ~min | libera na loja | peça permanente na margem (fade 8 s) |
|---|---|---|---|---|
| 0 Lago Escuro | 0 | 0 | Vagalumes, Juncos | — |
| 1 Lago Acordado | 500 | 3 | Peixes, Estrelas | **Lanterna** de papel numa estaca (esq.), apagada |
| 2 Lago Vivo | 20K | 10 | Lua, Dourado | **Píer** de madeira (dir.) |
| 3 Lago Profundo | 500K | 20 | Montanhas, Lírios | **Barco** amarrado + **3 luzes de aldeia** na outra margem |
| 4 Lago Lendário | 10M | 32 | Sapos, Aurora | **Ponte em arco** + **templo** com 1 janela acesa |
| 5 Amanhecer | 300M | 45 | — | horizonte rosa 10% (compõe com tinta do prestígio) + pássaros a cada 90 s |
- `life` persiste no prestígio → eras nunca regridem: **a margem construída é o "pra quê"**. Recalibrar limiares após a economia B (manter ~minutos da tabela) — o sim deve reportar tempo de cada era.
- **Linha da Margem** (medidor não-textual, `ent/shore.js` camada `hud`): traço luminoso 1 px no horizonte, da lanterna para a direita; comprimento logarítmico dentro da era; nó de 2 px por marco atingido; pulso nos 90% finais; flash 600 ms + sino + peça em fade ao completar; some com `uihidden`.
- `LQ.Idle.era()`, evento `'era'`; `state.era` migrado de `life`.

### D. Lanterna — pastoreio (`ent/fireflies.js`, `ent/shore.js` expõe `LQ.shore.lantern()`, `idle/engine.js` `setBuff`)
- Zona raio 45 px na lanterna (Era 1+); halo alpha .12 enquanto ≥1 vagalume dentro; vagalumes dentro **imunes ao flee por 4 s** e orbitam.
- 5 dentro (ou 30% dos vivos) → lanterna acende 1,5 s (glow âmbar), sino, `LQ.Idle.bonus('lantern',{amount:max(totalRate()*90, clickPower()*40)})`, **+25% de taxa por 60 s** (`LQ.Idle.setBuff(0.25,60)`, não salvo; Linha da Margem fica dourada). Cooldown 90 s. Era 3 acende aldeia (+35%), Era 4 templo (+50%). Achievement "Guardião da Lanterna" (10×). Toast da Era 1 ensina em 1 frase.

### E. Toasts + falatório + Margem (`idle/hud.js` toasts, novo `idle/chatter.js`, `game.js` coleção idle)
- **Pilha `#toasts`** inferior-esquerda acima da barra, até 3 visíveis (fila 6; era/meta nunca descartadas), ícone 18 · título 12 · frase 11; entrada 300 ms, vida 5 s (era 8 s), gap 600 ms com sino em grau crescente. Tipos: novo morador disponível (`cur ≥ 0.5·base`, `stats.seenGens`), marco, ×1.5 automático, **era**, meta/achievement (`on('goal')`), 1º bônus, offline. Substitui `showToast/toastQ`.
- **Falatório**: `idle/chatter.js`, ~40 frases PT-BR assinadas por morador, filtradas por era/populações, sem repetir em 20; 1 a cada 150-300 s, só com pilha vazia e ≥8 s sem clique; vida 4 s, sem sino; toggle "Falatório do lago" no rodapé da loja (`state.idle.chatter`).
- **Painel Margem** (ícone lua, só idle): linha 1 eras (6 silhuetas; bloqueadas pontilhadas; atual pulsa), linha 2 metas (acesas/apagadas), linha 3 moradores (atual). Toast de era/meta clicável abre a Margem. Zen mantém a faixa atual.

### F. Publicação
Commit/push → Pages; bundle; rebuild Mac; textos loja PT/EN + README ("eras", "lanterna"); `DIARIO.md`. Sem Artifact.

## Execução (workflows)
1. **W1 Economia** (5 agentes): 2 propostas em cima da tabela B → sim estendido → juiz → `data.js` (gens, upgrades com pct, marcos ×1.5, eras com limiares calibrados, K).
2. **W2 Build** (~12 agentes): A (hud/css/layout) ‖ C+D (shore.js, fireflies, engine era/buff) ‖ E (toasts/chatter/Margem) ‖ B-engine (clickPower/auto/anéis auto sem empurrar) → integrador (CDP; zen intocado, layout reservado, loja aberta, cliques ≥25%, eras, lanterna, toasts) → 2 revisores (bugs; legibilidade/propósito) → corretor.
3. **W3 Teste & entrega** (~15 agentes): 3 testadores (humano 10 min / bordas e saves / perf 1440p) → verificação → correções → screenshots 17-20 → bundle + build Mac + textos → eu faço push.

## Verificação
- Zen: populações/UI idênticas; `#shop`/`--shop-w` = 0; nada de shore/toasts.
- Idle: abre com loja aberta e lago inteiro visível (lua visível em 1280 e 1920); recolher → trilho; total e /s por gerador legíveis; "+N por pedra (X%)" correto; 10 cliques/s vs taxa → clique ≥25% aos 30 min no sim e no jogo real (5 min); geradores aparecem por era; Linha da Margem cresce; Era 1 em ~3 min → lanterna aparece + toast; 5 vagalumes na lanterna → acende, bônus, +25% por 60 s; toasts empilham (máx 3); falatório em ≤5 min e toggle desliga; painel Margem mostra eras/metas; prestígio mantém eras; save v2 migra (`era` de `life`); 60 FPS; console limpo.
