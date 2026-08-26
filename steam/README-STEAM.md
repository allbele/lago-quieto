# Lago Quieto — build Steam (Electron)

Este diretório é um *wrapper* Electron ao redor do jogo web em `../web/`. O jogo não muda:
`platform.js` detecta `window.steamBridge` (exposto pelo `preload.js`) e delega achievements
e cloud save ao Steamworks. Sem Steam aberto (ou sem o pacote `steamworks.js`), tudo vira
no-op silencioso e o save continua em `localStorage`.

## Arquivos

- `main.js` — janela 1280×720 (mín. 800×500), fundo `#050914`, sem menu, F11 = tela cheia.
- `preload.js` — expõe `window.steamBridge { achievement(id), cloudSave(json), cloudLoad() }`.
- `steam.js` — integração Steamworks: mapa de achievements (`ACH_MAP`), cloud save
  (`lagoquieto.json` no Steam Remote Storage) com merge (`max(totalTime, ripples)` + união de `unlocked`).
- `steam_appid.txt` — App ID usado em desenvolvimento (480 = Spacewar, app de testes da Valve).
- `electron-builder.yml` — alvos mac (dmg+zip, x64+arm64), win (portable+nsis), linux (AppImage).
- `build/icon.png|icns|ico` — ícone (lua sobre o lago).

## Instalar

```sh
cd steam
npm install
```

`steamworks.js` está em `optionalDependencies`: se falhar ao instalar (plataforma sem binário),
o wrapper continua funcionando sem Steam.

## Trocar o App ID

1. Edite `steam/steam_appid.txt` e coloque o App ID real do Lago Quieto (obtido no Steamworks).
2. Na build final **remova** `steam_appid.txt` do lado do executável (ou do `extraResources`
   em `electron-builder.yml`) — o cliente Steam injeta o App ID ao lançar pela biblioteca.
   Mantê-lo só é útil em desenvolvimento.
3. No painel Steamworks → *Stats & Achievements*, cadastre os 12 achievements com os API names
   do `ACH_MAP` em `steam.js` (ex.: `ACH_FIRST_STONE`). Se preferir outros nomes, ajuste
   apenas o lado direito do mapa — os ids internos do jogo não mudam.
4. Em *Steam Cloud*, habilite o Remote Storage (cota sugerida: 1 arquivo, 64 KB).

## Rodar em desenvolvimento

```sh
npm start
```

Com o cliente Steam aberto e logado, o console mostra `[steam] inicializado, appId 480, usuário <nome>`.
No app 480 (Spacewar) os achievements do Lago Quieto **não existem**, então `activate()` falha
silenciosamente — isso é esperado. O cloud save funciona no 480 (Spacewar tem Cloud habilitado).

Sem Steam aberto: `[steam] Steam não está rodando: ...` e o jogo segue normalmente.

## Testar com Steam aberto (App ID real)

1. Coloque o App ID real em `steam_appid.txt`.
2. Abra o Steam, logado numa conta com o app na biblioteca (dev/beta).
3. `npm start`. Clique na água → achievement `Primeira Pedra` deve aparecer no overlay.
4. Para reiniciar achievements em testes: Steamworks → *Stats & Achievements* → *Reset*.
   Ou, no DevTools do Electron (descomente `win.webContents.openDevTools()` em `main.js`),
   rode `await window.steamBridge.info()` para ver estado da conexão.

## Buildar

```sh
npm run build:mac     # dist/mac-*/Lago Quieto.app + .dmg + .zip (x64 e arm64, sem assinatura)
npm run build:win     # dist/Lago Quieto-*-win-x64.exe (portable) + instalador NSIS
npm run build:linux   # dist/Lago Quieto-*-linux-x64.AppImage
npm run build:all
```

Observações:
- Build Windows a partir do macOS requer Wine (electron-builder baixa automaticamente
  ou use uma máquina Windows/CI).
- macOS sem assinatura: o usuário precisa de clique direito → *Abrir* na primeira vez. Para a
  Steam isso é aceitável (o cliente Steam lança o binário), mas para distribuição fora da Steam
  assine e notarize (configure `identity` em `electron-builder.yml`).
- O jogo web é copiado para `resources/web/` (`extraResources`); qualquer mudança em `../web/`
  exige rebuild.

## Upload para a Steam

Use o SteamPipe (`steamcmd` + `app_build.vdf`) apontando o *depot* para o conteúdo de
`dist/mac/`, `dist/win-unpacked/` ou `dist/linux-unpacked/`. Configure em *Installation → General*
o executável de cada SO (`Lago Quieto.app`, `Lago Quieto.exe`, `lago-quieto-steam`).
