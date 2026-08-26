# 📓 Diário de Bordo — "Jogo aleatorio" (clicker zen)

> Atualizado automaticamente pelos agentes ao fim de cada etapa. Leitura de cima para baixo = história do projeto.
> Status atual sempre na seção **Agora**.

## Agora
- **Fase atual:** 3 — Teste & polimento no Chrome (3 testadores → verificação → correções → screenshots) — *em execução*
- **Jogo:** **Lago Quieto** (*Quiet Lake*) — "Jogue uma pedra. O lago faz o resto." · slug `lago-quieto`
- **Você precisa fazer:** nada.
- **Próximo entregável:** pasta `web/` jogável localmente → teste no Chrome → link público `https://allbele.github.io/lago-quieto`.

---

## Linha do tempo

### 2026-08-25 · Nascimento
- **Pedido:** jogo para o mood "sem vontade de nada": só clique de mouse, zero leitura, zero teclado. Tudo feito por agentes; o usuário só cria contas/paga se inevitável.
- **Pesquisa (hospedagem, Steam, automação):**
  - `gh` já logado como **allbele** → GitHub Pages sem cadastro novo.
  - Cloudflare Pages / Vercel / Netlify seriam alternativas, mas exigiriam conta nova → descartadas.
  - itch.io exigiria conta + API key → não escolhido.
  - **Steam:** conta Steamworks paga (US$100/app, recuperável após US$1.000 de receita), fiscal W-8BEN (5-10 min), verificação de identidade (1-5 dias), **espera obrigatória de 30 dias** antes do lançamento. Jogo web vai via **Electron** + upload `steamcmd`.
- **Decisões do usuário:** tipo = clicker/idle zen · publicação = **grátis no navegador + muito barato na Steam** · escala = **máxima** (workflows multi-agente).
- **Plano aprovado:** `/Users/mateu/.claude/plans/queria-criar-um-jogo-logical-valley.md`. Fases: 1 Design → 2 Implementação → 3 Teste Chrome → 4 GitHub Pages + Artifact → 5 Electron/Steam.
- **Stack decidida:** HTML/CSS/JS puro + Canvas 2D + WebAudio sintetizado; sem framework, sem assets externos.
- **Fase 1 iniciada:** workflow `zen-clicker-design` (sementes: jardim, lago noturno, céu estrelado, surpresa; juízes: jogador exausto, engenheiro canvas, produtor Steam).
- **Fase 1 concluída (8 agentes, ~5 min).** Conceitos: Jardim/Estufa (96 pts), **Lago Quieto (112)**, Céu/Luminária (104), Ceramista (83). Vencedor: **Lago Quieto** — lago à noite, cada clique é uma pedrinha; ondas acordam vagalumes, peixes, lua, névoa se dissipa, lírios, sapo, aurora, amanhecer. Enxertos dos perdedores integrados (sino inarmônico, cascata de boas-vindas, coleção "margem", sapo como mascote). Resultado em `DESIGN.md`.
- **Fase 2 iniciada:** workflow `lago-quieto-build`. Arquitetura: `web/` com `index.html`, `style.css`, `audio.js`, `platform.js`, `game.js` (núcleo) + módulos de entidades em arquivos separados para agentes trabalharem em paralelo.
- **Incidente (noite de 25→26/08):** o Mac entrou em modo de descanso durante a Fase 2; o workflow travou no revisor zen após 8/10 agentes concluírem (núcleo, áudio, 4 entidades, integrador com Chrome + console limpo, revisor de bugs). Retomado em 26/08 do cache — só revisor zen + corretor rodam de novo. Lição: manter o Mac acordado durante workflows longos (ex.: `caffeinate`).
- **Fase 2 concluída (26/08, 10 agentes, ~1,2M tokens).** `web/` jogável: núcleo (`game.js` ~28 KB), `audio.js` (tudo sintetizado), `platform.js`, 8 módulos em `ent/`. Integrador testou no Chrome: 12 desbloqueios, 5 temas, eco, resize, amanhecer — console limpo, 60 FPS. Bugs notáveis corrigidos: lua/vagalumes invisíveis após reload, achievement "Só Olhando" dado no 1º frame, névoa/aurora fortes demais, rAF duplicado ao voltar de aba oculta, save corrompido não sanitizado. 21 achados dos revisores aplicados. Frágil ainda: aurora legível como faixas, vagalumes discretos, sapo perto da barra de ícones em telas baixas.
- **Fase 3 iniciada:** workflow `lago-quieto-test`.
- Este diário criado a pedido do usuário: "salva em um .md também, atualizado dinamicamente, com lembranças do que já foi, por onde passou".

---

## Decisões permanentes
| Tema | Decisão | Motivo |
|---|---|---|
| Hospedagem grátis | GitHub Pages (`allbele.github.io/<slug>`) | zero cadastro, gh já logado |
| Espelho | Artifact privado no claude.ai | acesso rápido, sem conta |
| Pago | Steam a US$0,99 via Electron | pedido do usuário |
| Free vs Steam | mesmo jogo; Steam soma achievements, cloud save, temas | não cortar conteúdo essencial |
| UI | só ícones, nenhum texto obrigatório | mood "não quero ler" |

## Pendências que dependem do usuário
- [ ] (só quando quiser a Steam) criar conta em https://partner.steamgames.com/steamdirect, pagar US$100, W-8BEN, identidade → avisar quando aprovado.
