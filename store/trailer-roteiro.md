# Lago Quieto — Roteiro do trailer (30 s)

Sem narração, sem música externa, sem texto além do título final. Só cortes do jogo e o áudio do próprio jogo (plops, notas, grilos, ambiente). Formato: 1920×1080, 60 fps, H.264, estéreo. Ritmo lento — corte mínimo de 3 s.

| Tempo | Duração | Imagem | Som (do jogo) | Nota de edição |
|---|---|---|---|---|
| 0:00–0:03 | 3 s | Tela quase preta; lago inicial sem lua, só estrelas e a água escura. Nada acontece. | Ambiente baixo (vento, um grilo). | Fade-in de preto, 1 s. Deixe o silêncio respirar. |
| 0:03–0:07 | 4 s | Um único clique no centro. Um anel abre e some. Segundo clique, outro anel. | Plop + nota. Plop + nota mais alta. | Cursor visível. Sem movimento além do anel. |
| 0:07–0:12 | 5 s | Sequência de 5 cliques em arco; anéis se cruzam. Primeiro vagalume aparece na margem. | Cinco notas ascendentes (a "melodia acidental"). | Corte no 3.º clique para ângulo/zoom leve (crop 110 %). |
| 0:12–0:16 | 4 s | Lua nascendo; reflexo fatiado na água distorcido pelos anéis. | Nota longa grave + ambiente cresce. | Time-lapse suave (2× do jogo, sem parecer acelerado). |
| 0:16–0:20 | 4 s | Lírios abrindo, sapo pulando na folha, peixe dourado saltando. | Coaxar, plop do peixe. | Três cortes de ~1,3 s cada, cada um com o som próprio. |
| 0:20–0:24 | 4 s | Aurora atravessando o céu; vagalumes muitos. UI já sumiu (modo ambiente). | Ambiente pleno, sem cliques. | Pan lento da esquerda para a direita (crop). |
| 0:24–0:27 | 3 s | Amanhecer: céu rosa, névoa se dissipando. Corte para tema Inverno (neve), corte para tema Tinta. | Plop abafado (Inverno), plop seco (Tinta). | Dois cortes rápidos (1 s cada) só aqui — únicos "extras Steam" mostrados. |
| 0:27–0:30 | 3 s | Fundo escuro. Logo "Lago Quieto" (library_logo) aparece por fade; embaixo, tagline. Um anel se abre atrás do texto. | Um último plop + nota; reverbera até o silêncio. | Fade-out para preto em 0,8 s. Nenhum call-to-action escrito; a Steam já mostra o botão. |

## Regras
- Nenhum texto explicativo. O jogo não tem tutorial; o trailer também não.
- Nunca acelere um plop: cortes podem ser time-lapse, mas os sons ficam em 1×.
- Mixagem: pico em −6 dBFS, loudness alvo −16 LUFS (Steam comprime pouco; evite silêncio absoluto além do primeiro segundo).
- Proporção 16:9 fixa. Sem letterbox.
- Versão EN: idêntica; só a tagline final muda para "Throw a stone. The lake does the rest."

## Material bruto necessário
- 1 gravação contínua de ~6 min do jogo (novo save) com cliques marcados no tempo — ver `scripts/record-trailer.sh`.
- 1 gravação curta de cada tema (Inverno, Tinta) com 2 cliques.
- Áudio capturado separado (WAV) para poder deslocar sons entre cortes.
