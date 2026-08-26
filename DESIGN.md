# LAGO QUIETO — Documento de Design

**Nome:** Lago Quieto (EN: *Quiet Lake*; código interno: "ripple")
**Tagline:** *Jogue uma pedra. O lago faz o resto.* / *Throw a stone. The lake does the rest.*

---

## 1. Fantasia e tom

Você está sentado na margem de um lago à noite, jogando pedrinhas na água sem motivo. Cada onda acorda o lago um pouco mais: vagalumes chegam, um peixe sobe para ver, a lua nasce, a névoa vai embora. Não há objetivo, pontuação ou derrota. O lago fica mais vivo quanto mais tempo você passa ali — e continua vivo quando você sai. Tom: contemplativo, noturno, silencioso, levemente melancólico mas acolhedor. O jogo nunca pede nada; ele apenas responde.

## 2. Loop do clique (frame a frame)

Alvo: qualquer ponto abaixo da linha do horizonte (60% inferiores da tela).

| t | Visual | Áudio | Estado |
|---|---|---|---|
| 0 ms | Ponto claro (#e9f2ff, r=2) nasce ~40px acima do clique e cai em arco (easeInQuad, 250 ms). Cursor ganha um halo de 0.2 alpha. | — | `lastClick = now`; contador de silêncio zera. |
| 250 ms | Impacto: 3-6 gotas (velocidade radial 40-90 px/s, gravidade 300 px/s², vida 500 ms). Anel 1 nasce (elipse scaleY 0.35, r += 60 px/s, alpha (1-age/1.8)²). Juncos a <120px "respiram" (scale 1.0→1.03→1.0 em 400 ms). | **Plop** grave + **nota** pentatônica (x → nota, y → oitava). Se a nota anterior foi <80 ms atrás, só o plop. | `ripples++` (oculto). `calm = min(20, calm+1)`. Achievement "Primeira Pedra" se `ripples==1`. |
| 370 / 490 ms | Anéis 2 e 3 nascem no mesmo centro, alpha inicial 0.6 e 0.35. Reflexo da lua/estrelas dentro do raio ondula: deslocamento x por fatia = Σ sin(dist·0.3 − age·6)·amp·(1−age/life). | — | Vagalumes num raio de 150 px se afastam 30 px (ease 600 ms) e brilham 2 s → tilintar quase subliminar. |
| 0.5–2 s | Peixes num raio de 250 px curvam a rota para o centro do anel. Se `calm > 8`, o mais próximo salta (arco 600 ms) e gera anel secundário + gotas. | Salto: 2 plops rápidos oitava acima, volume baixo. | `calm` decai 0.2/s. Quando `calm > 14`, ganho das notas cai a 0.5 ("o lago está cheio"). |
| 20 s sem clique | **Modo ambiente**: o lago gera um anel sozinho a cada 6-10 s (gota de orvalho caindo de um junco/lírio), peixes saltam sozinhos. Ícones da UI somem (fade 1 s); cursor some após 2 min. | Gota de orvalho: plop mais agudo (330→140 Hz), ganho 0.2. | Timer "Só Olhando" conta. |

Regras: clicar e segurar = um clique. Clique no céu/margem = brilho sutil de 300 ms, sem som negativo, nunca erro. **Clicar num morador nunca é neutro**: vagalume → pulso de brilho + mesma nota uma oitava acima; lírio → flor branca abre em 3 s (uma vez por lírio/sessão); peixe (sombra) → ele mergulha e ressurge 200 px adiante; sapo → coaxa e pula (anel). Teto de efeitos: 40 anéis, 60 gotas, 8 vozes de áudio; spam além disso só recicla os mais antigos — nunca vira espetáculo.

## 3. Progressão idle

Gatilho = `tempoTotal` OU `ripples`, o que vier primeiro. Cada desbloqueio entra em fade de 4-8 s (nunca "pop"), com um acorde suave (ataque 400 ms, 3 notas da pentatônica, ganho 0.12) e um ícone que nasce na "margem" (coleção, ver §5).

| # | Gatilho | Desbloqueio | Visual | Som |
|---|---|---|---|---|
| 0 | início | Lago escuro | Água, horizonte, 3 juncos à esquerda, 15 estrelas fracas, névoa alpha 0.15. Modo ambiente ativo desde t=0. | Drone 55/82 Hz + ruído rosa + grilos. |
| 1 | 45 s / 8 ripples | Primeiros vagalumes | 5 pontos #d8f27a, movimento soma de 2 senos, pulso 2-4 s. | Tilintar ao acordar (1.8-2.6 kHz, 60 ms). |
| 2 | 1m30 / 20 | Vento nos juncos | Juncos balançam (rotate sin, ±3°), estrelas piscam mais. | Ruído rosa: LFO 0.1 Hz ganha profundidade. |
| 3 | 2m30 / 30 | Peixe | Sombra elíptica alpha 0.35 cruzando em Bézier, rastro de 4 posições. | Salto: plop duplo. |
| 4 | 3 min / 40 | Mais estrelas | 15 → 35 estrelas, com reflexo espelhado perto do horizonte. | Acorde de desbloqueio. |
| 5 | 6 min / 70 | Lua nasce | Disco nasce à direita em 90 s reais; reflexo fatiado; paleta lerp 10% mais azul/clara. | Drone ganha 5ª (110 Hz, ganho 0.015). |
| 6 | 10 min / 120 | Mais vagalumes + juncos à direita | 15 vagalumes; alguns pousam nos juncos e, quando 3+ pousam próximos, linhas finas de "constelação" (alpha 0.15) ligam-os por alguns segundos. | Tilintares em coro esparso. |
| 7 | 15 min / 180 | 2º e 3º peixe (um dourado #e8b04a) | Saltos espontâneos com anéis próprios. | Dourado: plop com nota harmônica (sino) extra. |
| 8 | 20 min / 250 | Névoa dissipa | Alpha 0.15 → 0 em 60 s; revela 2 camadas de montanhas em parallax mínimo. | Lowpass master abre de 4 kHz para 6 kHz em 60 s. |
| 9 | 30 min / 350 | Lírios d'água | 3-5 discos #0d2a1f derivam; anéis os balançam (offset y senoidal). Clicável → flor. | Flor: nota longa 2.4 s com detune. |
| 10 | 45 min / 500 | Céu vivo | 60 estrelas, estrela cadente a cada 2-4 min (trail 400 ms), nuvem fina cruzando a lua. | Cadente: glissando seno 2 kHz→600 Hz, ganho 0.03. |
| 11 | 1 h / 700 | Sapo | Silhueta na margem com 3 poses (parado, inflado, pulando). Coaxa a cada 40-90 s; pula se clicado perto. | Quadrada 90 Hz + LFO 14 Hz. |
| 12 | 2 h / 1200 | Aurora tênue | Faixas verde/roxo alpha 0.08-0.15 no céu superior, refletidas na água. Estado "máximo". | Drone ganha um seno 164.8 Hz muito lento em fade. |
| ∞ | 4 h+ | Amanhecer lento (ciclo) | Paleta migra 30 min para azul-cinza e rosa no horizonte; vagalumes se retiram; 3 chevrons de pássaros; noite recomeça com tudo já acordado. Após o primeiro ciclo, o tom do céu segue o **relógio real** do sistema como variação lenta. | Pássaros: 3 sinos curtos agudos. Grilos somem no amanhecer. |

## 4. Regras "zen"

- **Ausência nunca reduz nada.** Não existe decaimento de progresso. `calm` zera fora da sessão, só isso.
- **Ganho offline:** ao reabrir, `tempoTotal += min(ausência, 8 h)` (cap evita saltar da fase 1 para a 12; quem volta depois de dias ainda ganha 8 h). Desbloqueios acumulados entram em **cascata de boas-vindas**: um a um, a cada 2,5 s, com acorde ascendente. Retorno após 24 h+ → achievement "Deixei Aceso".
- **Zero texto essencial.** Nenhuma palavra na tela do jogo. Nenhum número visível, nunca. Sem tutorial: o cursor sobre a água mostra um halo, o convite é suficiente.
- **Sem pressão:** nada pisca pedindo atenção, nada tem cooldown visível, nada expira.
- **UI some** após 3 s sem mouse; reaparece em fade ao mover.
- **Ícones necessários** (SVG inline, traço 1.5 px, #e9f2ff a 0.6 alpha, hover 1.0):
  1. Alto-falante / alto-falante com barra (som on/off)
  2. Quatro cantos (tela cheia)
  3. Gota com paleta (tema) — cicla temas
  4. Lua crescente ("margem"/coleção: abre a faixa de moradores acordados)
  5. Folha (modo econômico: desliga aurora, reflexo fatiado, DPR=1)
  6. Ícones de moradores para a coleção: vagalume, peixe, peixe dourado, lua, montanha, lírio, flor, estrela cadente, sapo, aurora, pássaro
  7. Steam apenas: troféu discreto (abre overlay Steam)

## 5. Direção visual

### Paleta (papéis)
| Hex | Papel |
|---|---|
| `#050914` | Céu no zênite |
| `#0b1a33` | Céu no horizonte / água profunda |
| `#123a5c` | Água junto à margem |
| `#1f5f7a` | Traço dos anéis (alpha variável) |
| `#e9f2ff` | Lua, estrelas, brilhos, ícones |
| `#d8f27a` | Vagalumes (glow) |
| `#e8b04a` | Peixe dourado / centro da flor |
| `#0d2a1f` | Juncos, lírios, silhuetas, sapo |
| `#7ad3c9` | Aurora verde-água |
| `#8a6bc9` | Aurora roxa / amanhecer |
| `#f2b8a2` | Rosa do amanhecer |
| `#ffffff @0.12` | Névoa baixa |

### Técnica Canvas 2D
- Um canvas full-screen, DPR clamp 1.5 (1.0 no modo econômico). Horizonte fixo em 40% da altura.
- **Regra de ouro:** zero `shadowBlur`, zero gradiente criado por frame. Glows = sprites radiais pré-renderizados em offscreen (`drawImage` + `globalAlpha`) ou 3 elipses concêntricas de alpha decrescente.
- **Camadas por frame, em ordem:**
  1. Céu: offscreen com gradiente vertical, re-renderizado só quando a paleta muda (lerp a cada 500 ms). Estrelas "assentadas" bakeadas nesse offscreen; só as 12 mais recentes/piscantes são dinâmicas (`fillRect` 1-2 px, alpha senoidal).
  2. Aurora: offscreen de 1/4 da largura, 6 faixas com alpha sin(x·0.01 + t·0.3), escalado com `drawImage` (blur de graça); `globalCompositeOperation='screen'` só aqui.
  3. Lua: sprite cacheado (disco + glow). Nuvem: elipse alongada alpha 0.08.
  4. Montanhas (2 Path2D, parallax 2 px pelo mouse) e juncos (Path2D + `rotate` seno).
  5. Água: gradiente vertical cacheado. Reflexos: estrelas/aurora espelhadas em y com alpha 0.35 (sem fatia); **só a coluna da lua (~80 px)** é desenhada em fatias de 3 px com deslocamento x = sin(y·0.15 + t·2)·2 + distorção dos anéis (O(fatias×anéis), ~27×40).
  6. Lírios, sombras de peixes (elipse alpha 0.35 + rastro), anéis (pool de 40; 1-3 `ellipse` stroke #1f5f7a, lineWidth 1.5).
  7. Camada de luz com `globalCompositeOperation='lighter'`: vagalumes (pool 30, sprite de glow), gotas, peixe saltando, estrela cadente, flores.
  8. Névoa: retângulo com gradiente cacheado, offset x senoidal 10 px, alpha animado.
  9. UI (SVG em DOM sobre o canvas, `pointer-events` só nos ícones).
- Easing: anéis quadrático; fades de desbloqueio `smoothstep`; respiração dos juncos `sin(πt)`.
- Loop `requestAnimationFrame`, dt clamp 50 ms. Aba oculta → pausa render, mantém relógio; ao voltar, avança tempo e mostra cascata. Modo papel de parede (Steam): 15 fps.
- Ciclo dia/noite: noite fixa até a fase 12; depois ciclo de 4 h + segue o relógio real (00-05 noite profunda, 05-07 amanhecer, 07-17 dia azul-claro suave com lua pálida, 17-20 entardecer #f2b8a2, 20-24 noite).

## 6. Direção de áudio (WebAudio, tudo sintetizado)

`AudioContext` criado no primeiro clique. Cadeia master: `GainNode` → `DynamicsCompressor` (threshold −18, ratio 3) → split: seco (60%) + `ConvolverNode` (40%) com IR = ruído branco × exp(−t/0.6), 2.5 s, 22 kHz (fallback: `DelayNode` 0.18 s feedback 0.35 se CPU fraca) → `BiquadFilter` lowpass 6 kHz (4 kHz enquanto há névoa) → destino. Toggle de som = fade de 300 ms do master, nunca corte.

Escala: **pentatônica maior de Dó** (C D E G A). x da tela → 5 notas; y (mais fundo = mais grave) → oitava 3 ou 4. Teto de 8 vozes ativas; mínimo 80 ms entre notas.

| Som | Síntese |
|---|---|
| Plop da pedra | Seno 220 → 90 Hz (`exponentialRamp`, 120 ms); ganho 0→0.5 em 5 ms, →0 em 180 ms. + burst de ruído 40 ms por bandpass 1.2 kHz Q2, ganho 0.15. |
| Nota do anel ("sino") | Seno fundamental (ganho 0.18) + seno em 2.76× a fundamental (ganho 0.25 × 0.18, decay 3× mais rápido — parcial inarmônico de sino) + triângulo uma oitava acima (ganho 0.05). Detune ±4 cents. Ataque 30 ms, release 1.6 s. Ganho × 0.5 se `calm > 14`. |
| Pulso de morador (clique em vagalume/lírio) | Mesma nota, uma oitava acima, ganho 0.1. |
| Vagalume acordado | Seno 1.8-2.6 kHz, 60 ms, ganho 0.04, `StereoPanner` por x. |
| Peixe saltando | 2 plops (440→180 Hz) a 90 ms de intervalo + ruído 80 ms. Dourado: + sino em A4. |
| Gota de orvalho (ambiente) | Plop 330→140 Hz, ganho 0.2. |
| Sapo | Quadrada 90 Hz, LFO de amplitude 14 Hz, 300 ms, lowpass 400 Hz, ganho 0.08. |
| Desbloqueio / boas-vindas | Acorde de 3 notas pentatônicas (seno+sino), ataque 400 ms, release 3 s, ganho 0.12. Cascata: cada evento sobe um grau. |
| Estrela cadente | Seno 2 kHz→600 Hz em 400 ms, ganho 0.03. |
| Ambiente | Ruído rosa (branco por 3 lowpass em cascata em `AudioBufferSource` loop) lowpass 500 Hz, ganho 0.03 × LFO 0.1 Hz. Drone: senos 55 + 82.4 Hz ganho 0.02 (+110 Hz com a lua, +164.8 Hz com aurora). Grilos: 8 pulsos de seno 4.2 kHz a 30 Hz, a cada 3-7 s, ganho 0.02, pan aleatório. Garoa ocasional (evento ambiente raro após fase 8): ruído bandpass 3 kHz ganho 0.02 + anéis mínimos aleatórios por 60 s. |

## 7. Arquitetura

- **index.html** — canvas, barra de ícones SVG inline, carrega `style.css`, `audio.js`, `platform.js`, `game.js`. Sem build, sem dependências.
- **style.css** — reset, canvas fixo, barra inferior, transições de alpha da UI, `cursor:none` quando ocioso.
- **audio.js** — `Audio.init()`, `play(name, opts)`, `ambient.start/stop`, `setMuted(bool)`, gerador de IR, pool de vozes. Não conhece o jogo.
- **game.js** — módulos internos: `State` (save/load/migrate), `Unlocks` (tabela §3), `Scene` (camadas, caches offscreen), entidades (`Ripples`, `Fireflies`, `Fish`, `Lilies`, `Frog`, `Sky`), `Input`, `UI`, `Loop`.
- **platform.js** — camada fina: `Platform.achievement(id)`, `Platform.saveCloud(json)`, `Platform.loadCloud()`. No browser é no-op + localStorage; na build Steam (Electron/Greenworks ou Steamworks via wrapper) chama Steamworks. O jogo nunca sabe onde roda.

Estado salvo (`localStorage["lagoquieto"]`, JSON):
```json
{ "v": 1, "ripples": 0, "totalTime": 0, "lastSeen": 0, "unlocked": ["fireflies"],
  "liliesBloomed": 0, "theme": "night", "muted": false, "eco": false,
  "achievements": [], "stats": { "longestIdle": 0, "asc": 0 } }
```
Salvar a cada 10 s e em `visibilitychange`/`beforeunload`. `migrate(save)` por `v`; save corrompido → começa do zero silenciosamente.

Ordem de implementação: (1) canvas + céu + água + anel no clique; (2) audio.js com plop + nota + master; (3) reflexo da lua fatiado com distorção; (4) State + tempo + tabela de unlocks + fades; (5) vagalumes, peixes, juncos; (6) modo ambiente, cascata de retorno, UI que some; (7) névoa, montanhas, lírios, céu vivo, sapo, aurora; (8) amanhecer/ciclo/relógio; (9) temas; (10) platform.js + achievements + modo eco; (11) tuning de performance e volumes.

## 8. Steam extras (US$0.99 — gesto de apoio; o jogo web é completo)

**Achievements** (PT / EN — condição):
1. Primeira Pedra / First Stone — primeiro clique na água.
2. Acordei Alguém / Woke Someone Up — primeiro vagalume.
3. Lua Cheia / Full Moon — a lua terminou de nascer.
4. Vista Limpa / Clear View — névoa dissipada.
5. Peixe Dourado / Golden Fish — ver o peixe dourado saltar.
6. Flor da Noite / Night Bloom — abrir todos os lírios numa sessão.
7. Aurora / Aurora — ver a aurora.
8. Até o Amanhecer / Until Dawn — um ciclo noite→amanhecer completo.
9. Só Olhando / Just Watching — 10 min sem clicar com o jogo aberto.
10. Melodia Acidental / Accidental Melody — 5 notas ascendentes seguidas.
11. Deixei Aceso / Left the Light On — voltar após 24 h+ de ausência.
12. Mil Ondas / A Thousand Ripples — oculto, 1000 ripples.

**Temas extras** (mudam paleta, partículas e som):
- **Lago de Inverno** — água quase negra, gelo fino nas bordas, neve caindo, vagalumes viram fagulhas de fogueira na margem; plop abafado (lowpass 2 kHz).
- **Lago de Outono** — folhas vermelhas caem e flutuam, reagindo aos anéis; paleta âmbar, lua alaranjada; sapo vira grilo grave.
- **Lago de Tinta** — sumi-e monocromático, alto contraste, anéis como pinceladas (lineWidth variável), mínimo estímulo; também serve como tema de acessibilidade.
- (bônus) **Lago Tropical** — turquesa, bioluminescência azul nos anéis (camada `lighter`), sapo vira cigarra.

**Cloud save:** o mesmo JSON de §7 via Steam Cloud (`platform.js`), merge por `max(totalTime, ripples)` e união de `unlocked`. **Extras:** trading cards dos moradores (vagalume, peixe dourado, sapo, lírio, lua); modo papel de parede sem borda a 15 fps com áudio ambiente.

## 9. Enxertos integrados dos outros conceitos

- **Luminária:** clique em morador sempre responde (pulso + oitava acima); sino com parcial 2.76×; teto de 8 vozes; UI some após 3 s, cursor após 2 min; cascata de boas-vindas com acorde; aurora em offscreen 1/4; baking de estrelas assentadas; `lighter` só na camada de luz; linhas de constelação entre vagalumes pousados; `platform.js` no-op; achievement "Deixei Aceso".
- **Estufa:** respiração dos juncos no clique (1.0→1.03→1.0 em 400 ms); teto de partículas com reciclagem; céu ligado ao relógio real após o primeiro ciclo; garoa ambiente que mostra que nada depende do jogador; modo papel de parede 15 fps.
- **Ceramista:** acorde de ataque lento como som de desbloqueio; glows como 3 elipses concêntricas (regra do projeto); reciclagem dos objetos mais antigos nos pools; a **margem/coleção** (ícone lua crescente) como estante persistente dos moradores acordados — base dos achievements e trading cards; o sapo como "gato da oficina": morador com 3 poses e som próprio, ótimo para screenshots e capsule.
