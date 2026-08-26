// Lago Quieto — processo principal do Electron (build Steam).
// Responsável por: janela, integração Steamworks (opcional) e ponte IPC com o preload.
const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const steam = require('./steam'); // camada Steamworks (no-op se ausente)

// Steamworks exige que o cliente seja inicializado antes do app estar pronto (overlay).
steam.init();

let win = null;

function createWindow(){
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#050914',
    title: 'Lago Quieto',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload precisa de require() para ipcRenderer
      backgroundThrottling: false // o lago continua vivo mesmo em segundo plano
    }
  });

  Menu.setApplicationMenu(null);

  // O jogo web fica em ../web/ (empacotado como extraResources → resources/web).
  const webDir = app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.join(__dirname, '..', 'web');
  win.loadFile(path.join(webDir, 'index.html'));

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });

  // F11 alterna tela cheia (só enquanto a janela tem foco).
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && input.key === 'F11'){
      win.setFullScreen(!win.isFullScreen());
      ev.preventDefault();
    }
  });
}

// ---------- IPC: ponte com o preload ----------
ipcMain.on('steam:achievement', (_ev, id) => { steam.achievement(id); });
ipcMain.on('steam:cloudSave', (_ev, json) => { steam.cloudSave(json); });
ipcMain.handle('steam:cloudLoad', () => steam.cloudLoad());
ipcMain.handle('steam:info', () => steam.info());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { app.quit(); });
app.on('will-quit', () => { steam.shutdown(); });
