# Plano: Lago Quieto — Idle v2 (loja legível, lago que cresce, cliques bônus)

## Contexto

Modo ⚡ Idle publicado em https://allbele.github.io/lago-quieto/. Feedback do usuário: "passaria um tempo igual o Cookie Clicker", mas:
1. **Loja ilegível**: itens no canto, sem nome nem explicação — não dá pra saber se vai aparecer mais peixe, vagalume ou outra lua.
2. **Faltam cliques bônus** (clicar em ponto específico e ganhar algo).
3. **Poucos peixes**; populações (peixes, juncos, vagalumes, montanhas…) deveriam crescer com as evoluções. Ideia: peixes comerem as pedrinhas / pedras virarem ração.

Decisões do usuário: loja com **nome + frase curta** (+ card ao passar o mouse com o que muda visualmente); **só PT-BR**; **todos os 4 bônus** (peixe come a pedra, brilho dourado, combo de ritmo, reflexo de estrela cadente). **Zen permanece intocado.**

**Regra permanente:** o usuário apagou os Artifacts de propósito — **não publicar mais nada como Artifact do Claude**; só CLI/GitHub Pages/Steam. (Salvar na memória ao sair do plano.)

## Fatos do código (explorado)
- Populações hardcoded: `ent/fireflies.js` pool 15, `alive()` 5/15; `ent/fish.js` pool 3 (índice 2 dourado), `fishCount()` 1/3, `onRipple` puxa peixe ≤250 px ao ponto do anel e salta se `calm>8 && d<40` (hook natural para "come a pedra"); `ent/reeds.js` 3 esq + 4 dir literais; `ent/lilies.js` 3-5; `ent/sky.js` `STAR_TOTAL 60`, `starCount()` 15/35/60 bakeado, 2 cordilheiras fixas, lua `buildMoon`; `ent/frog.js` singleton.
- `idle/engine.js` `LQ.Idle`: `genCount`, eventos `buy/upgrade/currency/offline/goal/prestige`; `onImpact` credita `clickPower*strength`; anéis automáticos em `update()` sem moeda; sem noção de bônus.
- `idle/hud.js`: linha = ícone + contagem + custo + barra; sem nome/tooltip; `#shop` 260 px. Único `fillText` = floater.
- `idle/data.js` gens `{id, icon, unlock, base, growth, rate}`; upgrades `{id, kind, at|cost, value}`.

## Arquitetura

### 0. Chave única: `LQ.Idle.visible(id)` (engine)
`vis(count, base, k, cap) = count<=0 ? 0 : min(cap, base + floor(log2(count+1))*k)` com parâmetros em `LQ.IdleData.pop`. Em zen retorna `-1` → entidades usam a regra atual. Entidades: `const v = (game.mode==='idle' && LQ.Idle) ? LQ.Idle.visible('peixe') : regraZen`.

### 1. `web/idle/data.js` (agente C — vai primeiro, define contrato)
- Por gerador: `name`, `desc` (≤40 chars), `milestones:[{at,text}]`. Ex.: Vagalumes "+0.3 ondas/s · +1 vagalume" · 5 "pousam nos juncos" · 10 "formam constelações" · 25 "enxame de 30"; Peixes · 5 "saltam sozinhos" · 10 "comem as pedras (×3)" · 25 "cardume de 8"; Lua "+100/s · halo maior" · 5 "lua cheia maior" · 10 "nuvens" · 25 "halo dourado" · 50 "lua gigante" (**sem segunda lua** — quebra o reflexo); Névoa→"Montanhas" · 5 "3ª cordilheira" · 25 "4ª"; Sapos cap 5; Aurora 10 "duas faixas".
- Upgrades: `name/desc` ("Pedras pesadas ×2", "Orvalho +1/s", "Sono 12h") + novo `{id:'racao', kind:'racao', cost:20000, name:'Ração', desc:'pedras viram ração; peixes comem ×4'}`.
- `pop` (base,k,cap): vagalume 3,3,30 · juncos L 3,1,8 / R 0,2,8 · peixe 1,1,8 · dourado 1,1,3 · estrelas 15,15,200 · lírio 3,1,12 · sapo 1,1,5 · lua `scale 1+0.08*floor(log2(n+1))` cap 1.6, halo 0.55→0.9 · montanhas `2+floor(log2(n+1))` cap 4.
- `bonus`: `{fishMult:3, racaoMult:4, glintEvery:[60,180], glintLife:6, glintRateSec:60, comboStep:0.1, comboCap:2, comboTol:0.12, comboMin:0.3, comboMax:1.5, shootMult:25, shootLife:2}`.

### 2. Engine (agente A — `idle/engine.js`, `idle/state.js`, `game.js` só 2 hooks)
- `visible(id)`, `lakePoint()` (ponto aleatório na água fora da loja — reuso do anel automático), `bonus(kind,{x,y,mult?,amount?})` → soma `cur/life`, `stats.bonuses[kind]++`, emite `'bonus' {kind,x,y,amount}`.
- Combo de ritmo em `onImpact` (source stone): `dtc` entre `comboMin..comboMax` e `|dtc-prevDt| ≤ comboTol` → `combo += step` (cap) senão `combo=1`; `amt *= combo`; emite `'combo' {mult}`.
- `game.js`: `impact()` inclui `t` no payload; `game.stoneStyle` ('stone'|'racao') e `drawStones` desenha 3 pontinhos quando ração; `spawnRipple(opts.silent)`.
- `state.migrate`: `stats.bonuses` default; prestígio zera combo.

### 3. HUD (agente B — `idle/hud.js`, `style.css`)
- `#shop` 260→300 px. Linha: ícone maior · `name` 12px · `desc` 10px op .6 · contagem/custo/barra. Hover (ou toque longo) → `.card` à esquerda com marcos (atingidos ✓ apagados, próximo em destaque). Upgrades com `name`+`desc` no card.
- Arco fino SVG de combo ao redor do ícone do anel no `#hud` (dourado ≥1.5). Floater de bônus dourado 17px "+N ✦". Toast curto no 1º bônus de cada tipo.

### 4. Entidades (agente D — `ent/fish.js`, `fireflies.js`, `reeds.js`, `lilies.js`, `frog.js`)
- fireflies `MAX 30`, `alive()=visible`. fish pool 8 + 3 dourados, `fishCount()` por visible, `fadeOf` por índice; **peixe come a pedra**: `onImpact` guarda `{x,y,t}` no peixe puxado; chega a d<20 em ≤1.5 s → salto, gotas douradas, `fishJumpGold`, `LQ.Idle.bonus('fish',{mult: has('racao')?4:3})`; ativo a partir de `visible('peixe')>=10`... **ajuste**: ativo desde o 1º peixe com ×2, ×3 no marco 10, ×4 com ração (o usuário quer sentir cedo). reeds pool 16 (8+8) revelados por visible com fade; lilies `place(12)`, `lilyCount=visible`; frog → array de 5 com `home()` em faixas distintas e coaxos escalonados.

### 5. Céu e glints (agente E — `ent/sky.js`, novo `idle/glints.js` + 1 `<script>` em `index.html`)
- `STAR_TOTAL 200`, `starCount()` por visible; cordilheiras `ridge()` ×n com `hMax` crescente (rebuild só quando muda); lua com `scale/halo` na key do `buildMoon`; aurora 2 faixas no marco.
- **Brilho dourado**: entidade `idle-glints` (layer `light`): a cada 60-180 s em `lakePoint()`, 6 s pulsando; clique r<28 → `bonus('glint',{amount: max(totalRate()*60, clickPower()*50)})` + anel forte + sino. Disponível desde o início do idle (não gate por dourado — o usuário pediu bônus cedo).
- **Reflexo de cadente**: em `sky.js`, ao spawnar cadente calcula ponto refletido na água, `reflect{x,y,life:2}` com glow; clique r<30 → `bonus('shooting',{mult:25})`.

### 6. Publicação
- Commit/push → GitHub Pages; re-bundle `store/bundle` (só para Steam/arquivo local); rebuild Mac; atualizar `store/loja-*.md` (bônus, lago que cresce); `DIARIO.md`. **Sem Artifact.**

## Execução (workflows)
1. **W1 Data** (1 agente): `data.js` com textos/pop/bonus → contrato.
2. **W2 Build** (~10 agentes): A/B/D/E em paralelo → integrador (Chrome headless CDP em scratchpad `cdp.js`, ou extensão) → 2 revisores (bugs; legibilidade/sensação — "entendi o que cada item faz sem pensar?") → corretor.
3. **W3 Teste & entrega** (~15 agentes): 3 testadores (primeira vez / bônus e ritmo / stress de população a 1440p) → verificação → correções → screenshots 13-16 → bundle + build Mac + textos → eu faço push.

## Verificação
- Zen: screenshots antes/depois idênticos em população (5/15 vagalumes, 3 peixes, 3+4 juncos, 60 estrelas); `visible()` não chamado em zen.
- Idle: comprar vagalume 1/5/10/25 → contagem visível bate com `pop`; card mostra marcos; nomes/descrições em todas as linhas e upgrades; 60 fps com tudo no cap a 1440p.
- Bônus: peixe alcança a pedra → floater dourado e salto; com ração pedra vira pontinhos e ×4; glint aparece em 60-180 s e paga `rate×60`; combo chega a ×2 em ~10 cliques a 0.8 s e quebra ao errar; cadente refletida clicável 2 s.
- Save antigo migra; prestígio zera combo/glint; console limpo.
