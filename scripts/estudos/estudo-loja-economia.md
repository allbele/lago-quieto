> **Correção do usuário (26/08): a loja NÃO fecha e NÃO sobrepõe o jogo. Ignorar trilho/recolher/overlay abaixo; em telas estreitas usar tela dividida (lago em cima, loja embaixo).**

# Estudo — Loja persistente + rebalanceamento (Idle v3)

## 1. UX da loja
Desktop ≥900: #shop aberto por padrão, width 360 (clamp 340–380), sem transform; botão "‹" recolhe para trilho de 48 px (anel reabre; ícones dos gens compráveis com dot dourado; badge de melhorias pagáveis). Estado em localStorage 'lagoquieto.idle.shopOpen'. #btn-shop continua alternando. Mobile ≤600: drawer overlay full-width fechado por padrão (atual). shopSeen/hint só com painel recolhido.
Cena não coberta: CSS var --shop-w no body (360/48/0); #lake{right:var(--shop-w)}; resize() lê game.W = canvas.clientWidth; canvasPos já usa getBoundingClientRect; #ui/#collection right:var(--shop-w); shopToggle → game.js atualiza var e chama resize() imediato. engine.refreshShopW() retorna 0 quando reservado (só mobile overlay mantém; shopCovers).
Cabeçalho sticky: total 28px/700 tabular; "12.4K/s" 14px op .8; "+38 por pedra (12% do lago)" 12px dourado; segmented x1|x10|x100|max (4 células, 32px alto); abas Moradores | Melhorias (badge).
Linha do gerador (min-height 68, padding 10 12, radius 8, borda 1px se .can, hover fundo .06, op .55 se não pagável): ícone 36 col fixa; l1 nome 14/600 · contagem 20/700 à direita ("x12"); l2 "produz 7.2/s · 0.6/s cada" 12px op .75; l3 custo 13/600 com anel (dourado pagável / op .5), prefixo ×10 quando qty≠1, à direita "faltam 1m20" ((custo−cur)/totalRate); barra 4px; l4 "próximo marco: 10 → ×1.5, formam constelações (faltam 3)" 11px dourado. Linha inteira = alvo de compra. "›" ou hover 250 ms expande inline os marcos (✓ apagados / próximo destaque) — remover #shop-card/placeCard/bindCard. Um expandido por vez.
Melhorias: grid 2 col, ícone 36, nome 13, desc 11 em 2 linhas ("cada pedra rende ×2 e +4% do lago"), custo; visíveis a partir de 25% do custo; "já ativo" some.

## 2. Rebalanceamento
Diagnóstico: clickPower = 1 × 2^ups (≤64) × prestígio; rate compõe com 5 marcos ×2 (×32) por gen. Aos 40 min rate 1e6+, pedra 32.
Fórmula: clickPower = (clickBase·clickMult + clickPct·rate()) · globalMult · combo; clickPct = 0.10 + 0.04·(Pedras pesadas) → máx 0.34. Orvalho (auto) paga só parte fixa. Bônus glint/cadente seguem clickPower.
Marcos ×1.5 em 10/25/50/100 (×5.06). Sem 200.
Tabela (growth 1.15, clickBase 1): vagalume 8/0.25 · juncos 40/1.2 · peixe 180/5 · estrelas 800/20 · lua 3000/70 · dourado 12000/250 · nevoa 55000/900 · lirio 250000/3500 · sapo 1.1M/13000 · aurora 4.5M/45000. Pedras pesadas I–VI custo 15/150/1.5K/15K/150K/1.5M, value 2, pct 0.04. Orvalho 800/40K. Prestígio K ≈ 2.5e8 (ajustar no sim para 50–60 min).
Metas: 1ª compra ~4 s; 5 distintos ~2m30; gap <60 s; aurora 38–45 min; taxa 30 min 20–60K/s, 60 min 0.5–2M/s; clickShare 25–35% (30 min), 6–10% (60 min); eras nos minutos da tabela do estudo de eras.
Sim (scripts/sim-economy.mjs): clickPower com clickPct (+ soma u.pct); auto só parte fixa; score de upgrade click = Δ(clickPower)·cps; marcos grátis (custo 0) leem u.value; --combo 1.3; relatar clickShare 5/15/30/60, rate 30/60, maxGap, tempo de cada era. Rodar com prop-v3.json até bater; copiar para data.js.

## 3. Divisão
A HUD/CSS: hud.js (buildShop, render, onShopToggle com --shop-w, trilho; remover card), style.css. B economia: data.js, engine.js (clickPower/totalRate/mults clickPct, auto fixa, bonus), sim, prop-v3.json; expor clickPct(). C layout: game.js resize() clientWidth, #lake/#ui/#collection right:var(--shop-w), handler shopToggle → resize(); engine.refreshShopW() 0 quando reservado.
