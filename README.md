# Lago Quieto · Quiet Lake

> *Jogue uma pedra. O lago faz o resto.* — *Throw a stone. The lake does the rest.*

Um jogo para quando você não quer fazer nada. Só clique na água.
Sem texto, sem números, sem objetivo, sem derrota. O lago acorda devagar: vagalumes, peixes, lua, lírios, um sapo, aurora, amanhecer. Continua vivo quando você sai.

**Dois modos.** Ao abrir, escolha 🌙 **Zen** — só clicar e observar, sem números — ou ⚡ **Idle**, com geradores, upgrades e prestígio ao amanhecer. No Idle o lago cresce com cada compra (mais peixes, vagalumes, juncos, montanhas, lua maior) e a margem acende em eras — "A Margem que Acende": lanterna → píer → barco e aldeia → ponte e templo → amanhecer; a margem construída fica para sempre, mesmo após o prestígio. Há uma lanterna pastoreável (+25%), loja sempre visível, clique que acompanha o lago, toasts e falatório, 4 cliques bônus (peixe come a pedra, brilho dourado, ritmo, estrela cadente) e a Ração. Mesmo lago, saves separados; troque quando quiser.

**Jogar grátis:** https://allbele.github.io/lago-quieto/

- 100% HTML/CSS/JS puro, Canvas 2D, áudio sintetizado com WebAudio. Zero dependências, zero assets externos.
- Progresso salvo no navegador. Ganho offline ao voltar.
- Modo Idle opcional (`web/idle/`): geradores, upgrades, prestígio, lago que cresce com cada compra, eras da margem (lanterna, píer, aldeia, templo, amanhecer — permanentes), lanterna pastoreável, toasts e falatório, 4 cliques bônus, Ração — planos em `PLANO-IDLE.md`, `PLANO-IDLE-V2.md` e `PLANO-IDLE-V3.md`.
- Versão Steam (em preparo): mesmo jogo + achievements, cloud save, temas extras.

## Estrutura
- `web/` — o jogo (abra `index.html` ou sirva a pasta)
- `DESIGN.md` — documento de design
- `DIARIO.md` — diário de bordo do projeto
- `steam/` — wrapper Electron para a Steam (em preparo)
- `store/` — screenshots e material de loja

Feito por agentes Claude, sob direção de Mateus.
