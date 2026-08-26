# Lago Quieto — Checklist Steamworks

Passo a passo do que **você (usuário)** precisa fazer manualmente no Steamworks e o que **os agentes** fazem depois.
Preço alvo: US$ 0,99 (gesto de apoio; o jogo web é completo — DESIGN.md §8).

Legenda: `[U]` = ação manual sua · `[A]` = feito pelos agentes/scripts · `⏱` = prazo oficial da Valve.

---

## Fase 1 — Conta e habilitação (⏱ ~30 dias no total, em paralelo com o desenvolvimento)

1. `[U]` **Criar conta Steam dedicada à empresa/pessoa física** (não use sua conta de jogador) em https://store.steampowered.com/join. Ative o **Steam Guard Mobile**.
2. `[U]` **Inscrever-se no Steamworks**: https://partner.steamgames.com/newpartner — aceitar os termos (Steam Distribution Agreement).
3. `[U]` **Pagar a taxa de US$ 100 (Steam Direct Fee)** com cartão de crédito. A taxa é reembolsada quando o jogo atinge US$ 1.000 em receita ajustada.
4. `[U]` **Dados fiscais e identidade**:
   - Formulário fiscal **W-8BEN** (pessoa física fora dos EUA; Brasil não tem tratado → retenção de 30% sobre a receita dos EUA) ou **W-8BEN-E** (empresa). Preencha o CPF/CNPJ no campo *Foreign tax identifying number*.
   - Dados bancários (conta em nome do titular; aceita conta brasileira em BRL via transferência internacional, ou Payoneer/Wise com dados de conta em USD).
   - **Verificação de identidade** (documento com foto + selfie, pelo parceiro da Valve). ⏱ **1–5 dias úteis** para aprovação.
5. ⏱ **Espera de 30 dias**: a partir do pagamento da taxa, a Valve impõe **30 dias** antes de permitir o lançamento do jogo. Use esse tempo para as fases 2–5. A página "Coming Soon" pode ir ao ar antes.

## Fase 2 — App, depots e IDs

6. `[U]` No Steamworks, **Apps & Packages → Create New App** ("Lago Quieto", tipo *Game*). Anote o **App ID** (7 dígitos, ex.: `1234560`).
   - Cole-o em `steam/steam_appid.txt` (uma linha, só o número).
   - Em **SteamPipe → Depots**, crie 3 depots com os sistemas e nomes:
     `Lago Quieto Windows` (OS: Windows, 64-bit) · `Lago Quieto macOS` (OS: macOS) · `Lago Quieto Linux` (OS: Linux, 64-bit).
     Normalmente os IDs são `APPID+1`, `+2`, `+3`. Anote-os.
   - Substitua os placeholders nos arquivos de build:
     | Placeholder | Onde | Valor |
     |---|---|---|
     | `<APPID>` | `scripts/steam/app_build.vdf`, `steam/steam_appid.txt` | App ID |
     | `<DEPOTID_WINDOWS>` | `app_build.vdf`, `depot_build_windows.vdf` | depot Windows |
     | `<DEPOTID_MACOS>` | `app_build.vdf`, `depot_build_macos.vdf` | depot macOS |
     | `<DEPOTID_LINUX>` | `app_build.vdf`, `depot_build_linux.vdf` | depot Linux |
   - Em **Installation → General Installation**, crie 3 *Launch Options* (uma por SO) apontando para o executável: `Lago Quieto.exe` (Windows), `Lago Quieto.app` (macOS), `lago-quieto` (Linux) — nomes finais confirmados pelo agente de empacotamento.
   - **Publish** (botão "Publish" no topo do Steamworks) para aplicar as mudanças de configuração.
7. `[U]` **Criar usuário de build** (recomendado pela Valve para automação): crie uma segunda conta Steam (ex.: `lagoquieto_build`), ative **Steam Guard** (e-mail ou mobile), e em **Users & Permissions → Manage Users** adicione-a ao parceiro com as permissões *Edit App Metadata* e *Publish App Changes To Steam* apenas para o App ID do Lago Quieto.
   - Na primeira execução do `scripts/steam-upload.sh`, o `steamcmd` pedirá o **código do Steam Guard**; depois o token fica em cache na máquina.
   - Exporte `STEAM_BUILD_USER=lagoquieto_build` (senha é pedida interativamente, ou `STEAM_BUILD_PASSWORD` em CI com segredo).

## Fase 3 — Achievements (12) e Steam Cloud

8. `[U]` **Stats & Achievements → Achievements → New**. Crie os 12 com exatamente estes *API Names* (é o que `web/platform.js` envia; a ordem define a exibição):

   | # | API Name | Nome PT | Nome EN | Descrição (PT / EN) | Oculto |
   |---|---|---|---|---|---|
   | 1 | `ACH_FIRST_STONE` | Primeira Pedra | First Stone | Primeiro clique na água. / First click on the water. | não |
   | 2 | `ACH_WOKE_SOMEONE` | Acordei Alguém | Woke Someone Up | Primeiro vagalume. / First firefly. | não |
   | 3 | `ACH_FULL_MOON` | Lua Cheia | Full Moon | A lua terminou de nascer. / The moon finished rising. | não |
   | 4 | `ACH_CLEAR_VIEW` | Vista Limpa | Clear View | Névoa dissipada. / The fog lifted. | não |
   | 5 | `ACH_GOLDEN_FISH` | Peixe Dourado | Golden Fish | Ver o peixe dourado saltar. / See the golden fish leap. | não |
   | 6 | `ACH_NIGHT_BLOOM` | Flor da Noite | Night Bloom | Abrir todos os lírios numa sessão. / Open every lily in one session. | não |
   | 7 | `ACH_AURORA` | Aurora | Aurora | Ver a aurora. / See the aurora. | não |
   | 8 | `ACH_UNTIL_DAWN` | Até o Amanhecer | Until Dawn | Um ciclo noite→amanhecer completo. / A full night-to-dawn cycle. | não |
   | 9 | `ACH_JUST_WATCHING` | Só Olhando | Just Watching | 10 min sem clicar com o jogo aberto. / 10 minutes without clicking. | não |
   | 10 | `ACH_ACCIDENTAL_MELODY` | Melodia Acidental | Accidental Melody | 5 notas ascendentes seguidas. / 5 rising notes in a row. | não |
   | 11 | `ACH_LEFT_LIGHT_ON` | Deixei Aceso | Left the Light On | Voltar após 24 h+ de ausência. / Come back after 24h+ away. | não |
   | 12 | `ACH_THOUSAND_RIPPLES` | Mil Ondas | A Thousand Ripples | 1000 ondas. / 1000 ripples. | **sim** |

   - Ícones (64×64 PNG, já gerados por `scripts/steam/gen-achievement-icons.py`) em `store/achievements/`:
     colorido = `<id>.png` (*Achieved icon*), cinza = `<id>_gray.png` (*Unachieved icon*), onde `<id>` = API Name sem `ACH_`, em minúsculas (ex.: `first_stone.png` / `first_stone_gray.png`).
   - Adicione os idiomas **Portuguese (Brazil)** e **English** nos textos.
   - Clique **Publish** ao terminar.
9. `[U]` **Steam Cloud**: **Application → Steam Cloud** → marque *Enable cloud support for developers only* enquanto testa; **Byte quota per user: 1048576 (1 MB)**, **Number of files: 4**. Não use *Auto-Cloud* (o jogo grava `save.json` via API). Antes do lançamento, troque para *Enable cloud support* (todos). Publish.
10. `[U]` **Application → Steam Overlay**: deixe habilitado (necessário para o pop-up de conquistas).

## Fase 4 — Página da loja (⏱ revisão 3–5 dias úteis)

11. `[U]` **Store Presence → Edit Store Page**:
    - Nome, descrição curta (≤ 300 caracteres) e longa em **PT-BR e EN** (textos prontos em `store/` quando o agente de marketing entregar; screenshots em `store/screenshots/*.png`, 1280×720 — mínimo 5, suba todos os 8).
    - **Artes obrigatórias** (dimensões exatas): Header Capsule 920×430 · Small Capsule 462×174 · Main Capsule 1232×706 · Vertical Capsule 748×896 · Library Capsule 600×900 · Library Hero 3840×1240 · Library Logo 1280×720 (PNG transparente) · Community Icon 184×184 (JPG) · Client Icon 32×32 (.ico Windows) — geradas pelo agente de arte em `store/capsules/`.
    - **Trailer** (opcional, mas recomendado): 1080p, MP4 H.264.
    - Tags (até 20): *Relaxing, Casual, Clicker, Idle, Minimalist, Atmospheric, Ambient, Free to Play* (não!), *Singleplayer, Indie, Short*. Gênero: *Casual*.
    - **Preço**: em *Pricing*, US$ 0,99 com "Use suggested prices" (o Steam converte para R$ etc.).
    - **Questionário de conteúdo** (Content Survey) — marque "nenhum conteúdo maduro".
    - **Suporte**: e-mail e URL do repositório/página web.
    - Data de lançamento (após os 30 dias da Fase 1).
12. `[U]` **Enviar a página para revisão** (*Ready for Review* → "Store page"). ⏱ **3–5 dias úteis**. Após aprovada, publique como **Coming Soon** para começar a colher wishlists.
13. `[U]` Quando a build estiver enviada (Fase 5), marque **Ready for Review → Build**. ⏱ **3–5 dias úteis**; a Valve executa o jogo e testa a integração (Overlay, conquistas). Depois de ambas aprovadas, o botão **Release** fica disponível a partir da data de lançamento (não antes dos 30 dias).

## Fase 5 — O que os agentes fazem (após IDs preenchidos)

- `[A]` **Empacotamento**: Electron + `steamworks.js` embrulhando `web/` (não altera o jogo). Expõe `window.steamworks` antes de `platform.js`, define `Platform.wallpaper` para o modo papel de parede 15 fps e gera `steam/dist/{windows,macos,linux}/` com `steam_appid.txt` ao lado do executável (apenas para testes locais — é removido da build final).
- `[A]` **Verificação de placeholders** e integridade: `scripts/steam-upload.sh --preview` (simula sem enviar).
- `[A]` **Upload**: `STEAM_BUILD_USER=... scripts/steam-upload.sh --set-live beta` → build vai para a branch `beta`; você testa pelo cliente Steam (Biblioteca → Propriedades → Betas). Depois `--set-live default` ou promoção manual em *Builds*.
- `[A]` **Teste de conquistas**: desbloqueia cada `ACH_*` numa conta de teste e reseta pelo painel *Stats & Achievements → Reset*.
- `[A]` **Teste de Steam Cloud**: grava `save.json`, verifica em *Steam Cloud → Manage* (Steam client) e testa o merge `max(totalTime, ripples)` ∪ `unlocked` entre duas máquinas.
- `[A]` **Temas extras e trading cards** (§8): assets para *Community Items* (5 cards: vagalume, peixe dourado, sapo, lírio, lua) — cards exigem aprovação separada e só ficam disponíveis após o jogo sair do estado *Profile Features Limited* (vendas/engajamento mínimos definidos pela Valve).

## Resumo dos prazos oficiais

| Etapa | Prazo |
|---|---|
| Verificação de identidade / dados fiscais | ⏱ 1–5 dias úteis |
| Espera obrigatória após pagar US$ 100 até poder lançar | ⏱ 30 dias |
| Revisão da página da loja | ⏱ 3–5 dias úteis |
| Revisão da build | ⏱ 3–5 dias úteis (estimar até 1 semana no lançamento) |
| Antes de lançar: página "Coming Soon" pública | recomendado ≥ 2 semanas |

## Arquivos relacionados

- `scripts/steam/app_build.vdf`, `depot_build_{windows,macos,linux}.vdf` — scripts SteamPipe.
- `scripts/steam-upload.sh` — instala steamcmd, valida placeholders e envia.
- `scripts/steam/gen-achievement-icons.py` — regenera os ícones em `store/achievements/`.
- `steam/steam_appid.txt` — App ID (placeholder `<APPID>` até você preencher).
- `web/platform.js` — mapa `STEAM_IDS` (ids internos → API Names acima).
