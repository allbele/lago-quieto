# 📓 Diário de Bordo — "Jogo aleatorio" (clicker zen)

> Atualizado automaticamente pelos agentes ao fim de cada etapa. Leitura de cima para baixo = história do projeto.
> Status atual sempre na seção **Agora**.

## Agora
- **JOGO NO AR:** **https://allbele.github.io/lago-quieto/** · espelho Artifact: https://claude.ai/code/artifact/1211e100-54e0-4a88-8caf-2f0dd2c8e307
- **Fase atual:** 6 — **Modo ⚡ Idle** + correções zen (Workflow A: núcleo + zen fixes) — *em execução*. Steam segue aguardando a conta do usuário.
- **Jogo:** **Lago Quieto** (*Quiet Lake*) — "Jogue uma pedra. O lago faz o resto." · slug `lago-quieto`
- **Você precisa fazer:** nada.
- **Próximo entregável:** upload para a Steam — só depois de você criar a conta Steamworks e me passar o App ID / Depot IDs.

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
- **Fase 3 concluída (26/08, 30 agentes, ~1,3M tokens, 57 min).** 3 testadores (primeira vez / stress / direção de arte) → 25 achados → 22 verificações céticas → 12 confirmados e corrigidos: save em array/tipos errados, `LQ.reset()`, barra não some com cursor sobre ela, temas entram em fade (sem pop), tema tinta com lua/vagalumes em grafite, vagalumes só pousam na fase 6, peixes/sapo/lírios reposicionam no resize, lírios evitam a barra de ícones, aurora mais borrada e tênue. 8 screenshots 1280×720 em `store/screenshots/`.
- **Fase 4 concluída (26/08).** Repo público `https://github.com/allbele/lago-quieto` (branch main). GitHub Pages só serve `/` ou `/docs` → raiz com `index.html` redirecionando para `web/` + `.nojekyll`. Publicado em **https://allbele.github.io/lago-quieto/** (ativo 50 s após o push). `scripts/deploy-pages.sh` republica com um comando.
- **Verificação pós-publicação (26/08):** aberto no Chrome em https://allbele.github.io/lago-quieto/ — redireciona para `web/`, pedras caem, anéis formam, console sem erros.
- **Espelho Artifact publicado:** bundle de arquivo único (`store/bundle/lago-quieto.html`, 127 KB, CSS+JS inline) em https://claude.ai/code/artifact/1211e100-54e0-4a88-8caf-2f0dd2c8e307 (privado; compartilhável pelo menu da página).
- **Fase 5 iniciada:** workflow `lago-quieto-steam` — 3 construtores (Electron+steamworks.js, material de loja/capsules, vdf+steamcmd+checklist Steamworks) + 1 verificador que abre o .app no Mac.
- **Fase 5 concluída (26/08, 4 agentes, 7 min).** `steam/`: wrapper Electron (main.js, preload, steam.js com steamworks.js opcional, 12 achievements mapeados = mesmos ids que `game.js` emite, Steam Cloud com merge), build Mac gerado e **aberto com sucesso** (`steam/dist/mac-arm64/Lago Quieto.app` + x64, DMG/ZIP; prova em `store/screenshots/electron-mac.png`). `store/`: textos PT/EN em BBCode, 10 capsules validadas pixel a pixel (`CHECKLIST.md`), 12 ícones de achievement (cor + cinza), roteiro de trailer. `scripts/steam/`: `app_build.vdf` + 3 depots, `steam-upload.sh`, `CHECKLIST-STEAMWORKS.md` (passo a passo manual do usuário). Pendências técnicas: build Windows precisa de Wine ou máquina Windows; app sem assinatura Apple (ok dentro da Steam); placeholders <APPID>/<DEPOTID_*>.
- **26/08 · Novo rumo:** usuário jogou a build Steam, gostou, mas num mood mais agitado achou "sem nada pra fazer". Pedido: manter o zen e criar um **modo idle/incremental completo** na mesma base. Decisões: mesmo lago com escolha 🌙 Zen / ⚡ Idle na abertura, saves separados; números discretos (1.2K); 10 geradores + upgrades + prestígio + metas. Bugs relatados: barra/ícones, faixas em reflexo/aurora/névoa, e "coluna da lua até o fim do lago ao clicar um botão" — diagnosticada: `drawMoonReflection` vira retângulo sólido no modo eco (ícone folha) e tem piso de alpha. Plano em `PLANO-IDLE.md`.
- **26/08 · PAUSA pedida pelo usuário.** Em andamento no momento: Workflow A `lq-idle-core` (run wf_371618e1-b4d — núcleo + zen fixes + verificador) e Workflow B1 `lq-idle-economy` (run wf_44956a31-222 — data.js). Se a sessão fechar, ambos podem ser retomados do cache com `resumeFromRunId`. **Próximo ao retomar:** conferir resultados de A e B1 → lançar B2 (state/engine/util, hud, prestige, integrador, revisores) → C (testes, screenshots, deploy Pages + Artifact + rebuild Mac).
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
- [ ] (só quando quiser a Steam) seguir `scripts/steam/CHECKLIST-STEAMWORKS.md`: criar conta em https://partner.steamgames.com/steamdirect, pagar US$100, W-8BEN, identidade (1-5 dias) → criar o app → me passar **App ID** e **3 Depot IDs** + criar usuário de build. Depois disso os agentes fazem upload, página da loja e achievements. Lançamento só após 30 dias da taxa.
