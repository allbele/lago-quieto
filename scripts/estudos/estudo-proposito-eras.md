# Estudo — "Para que serve o lago?" (Idle v3) — direção "A Margem que Acende"

## 1. Eras (gatilho: state.idle.life, persiste no prestígio; nunca regridem)
| Era | life ≥ | ~min 1ª run | libera na loja | peça de cena (fade 8 s, permanente) |
|---|---|---|---|---|
| 0 Lago Escuro | 0 | 0 | Vagalumes, Juncos | — |
| 1 Lago Acordado | 500 | 3 | Peixes, Estrelas | Lanterna de papel numa estaca à esquerda (apagada) |
| 2 Lago Vivo | 20 000 | 10 | Lua, Peixe dourado | Píer de madeira (6 tábuas) saindo da margem direita |
| 3 Lago Profundo | 500 000 | 20 | Montanhas, Lírios | Barco a remo amarrado ao píer + luz de aldeia (3 pontos âmbar) na outra margem |
| 4 Lago Lendário | 10 000 000 | 32 | Sapos, Aurora | Ponte em arco ligando às montanhas + templo (silhueta, 1 janela acesa) |
| 5 Amanhecer | 300 000 000 | 45 | — | horizonte rosa 10% (compõe com tinta do prestígio), 3 chevrons de pássaros a cada 90 s |
Recalibrar os limiares depois da economia v3 (manter ~os minutos). Loja mostra só gens com era ≤ state.era (regra cur ≥ 0.5·custo mantida dentro da era).

### Linha da Margem (medidor não-textual)
Traço luminoso 1 px (palette.light, alpha .35) sobre o horizonte, da lanterna para a direita. Comprimento = log(life/limiar_atual)/log(limiar_próx/limiar_atual). Nó luminoso 2 px por marco atingido na era. Nos 90% finais pulso lento (alpha .35↔.55, 3 s). Ao completar: flash 600 ms, sino (degree = era), peça em fade 8 s, linha recomeça. Some com uihidden.

## 2. Toasts (pilha)
Canto inferior esquerdo acima da barra, empilha para cima. Máx 3 visíveis; fila 6 (descarta antigas, nunca era/meta). Ícone 18 px · título 12 px · frase 11 px alpha .6. Entrada translateY(8px)→0 300 ms; vida 5 s (era 8 s); saída 800 ms; gap mínimo 600 ms; sinos em cascata (cascadeDegree).
Tipos: novo morador disponível (1ª vez cur ≥ 0.5·base; stats.seenGens) "Novo morador: Peixes — Come as pedras que você joga"; marco "12 vagalumes — texto do milestone"; ×1.5 automático "Vagalumes ×1.5 — A colônia aprendeu a brilhar junto"; era "Lago Acordado — Alguém acendeu uma lanterna na margem"; meta "Cardume — 25 peixes no mesmo lago"; 1º bônus (bonusPhrase); offline "+N enquanto você dormia".

### Falatório do lago
~40 frases PT-BR assinadas por morador, sorteio sem repetição em 20, filtradas por era e populações (sapo só fala se visible('sapo')>0). 1 a cada 150–300 s, só com pilha vazia e ≥8 s sem clique. Vida 4 s, alpha .7, sem sino. Toggle "Falatório do lago" no rodapé da loja (state.idle.chatter, default on). Ex.: "Sapo: hoje eu ia coaxar, mas a lua tá bonita demais." / "Peixe: essa pedra tinha gosto de quinta-feira." / "Vagalume 7: quem apagou?"

## 3. Lanterna (pastoreio de vagalumes)
Regra: jogue pedras para espantar vagalumes até a lanterna; com 5 dentro, ela acende.
Zona raio 45 px, halo alpha .12 enquanto ≥1 dentro. Vagalumes dentro imunes ao flee por 4 s e orbitam. Ao chegar a 5 (ou 30% dos vivos, o menor): acende em 1,5 s (glow âmbar #e8b04a), sino, LQ.Idle.bonus('lantern',{amount:max(totalRate()*90, clickPower()*40)}), +25% de taxa por 60 s (Linha da Margem dourada). Dispersam; cooldown 90 s. Era 3: janelas da aldeia (+35%); Era 4: templo (+50%). Achievement "Guardião da Lanterna" (10×). Toast da Era 1 ensina: "Vagalumes fogem das ondas. Será que cabem na lanterna?"

## 4. Painel "Margem" (ícone lua, só idle)
Linha 1 eras: 6 silhuetas (lanterna, píer, barco, ponte, templo, sol nascente); bloqueadas pontilhadas alpha .25; atual pulsa; hover nome + limiar como barra. Linha 2 metas (data.goals + lanterna ×10, 3 eras, falatório 50×). Linha 3 moradores (atual). Toast de era/meta clicável abre a Margem com item em born 4 s. Zen mantém faixa atual.

## 5. Mapeamento
engine.js: eras em data.js [{id, life, gens, piece}]; checkEra() no update (1 s) → state.idle.era, emit('era'); LQ.Idle.era(); state.js migra era de life. hud.render: vis = eraOk && (n>0 || cur ≥ 0.5·cost). ent/shore.js: peças (camada reeds), Linha da Margem (camada hud), lantern() {x,y,r,armed}; -1 em zen → não desenha. hud.js: toastStack (#toasts). idle/chatter.js. fireflies.js: imunidade na zona, contagem, bonus('lantern') + LQ.Idle.setBuff(0.25,60).
