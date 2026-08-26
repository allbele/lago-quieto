// Preload — expõe window.steamBridge para o jogo (platform.js detecta e delega).
// Roda com contextIsolation: o jogo nunca vê Node nem Electron diretamente.
const { contextBridge, ipcRenderer } = require('electron');

// cloudLoad é assíncrono no IPC, mas platform.js espera algo síncrono no boot.
// Solução: buscamos cedo os arquivos conhecidos (zen e idle) e os entregamos via cache síncrono por nome.
const FILES = ['save.json', 'save-idle.json'];
const DEFAULT_FILE = FILES[0];
const cloudCache = {};
let cloudReady = false;
const fileOf = f => (typeof f === 'string' && f) ? f : DEFAULT_FILE;
const cloudPromise = Promise.all(FILES.map(f => ipcRenderer.invoke('steam:cloudLoad', f)
  .then(v => { cloudCache[f] = v || null; }).catch(() => { cloudCache[f] = null; })))
  .then(() => { cloudReady = true; return cloudCache; });

contextBridge.exposeInMainWorld('steamBridge', {
  achievement(id){ ipcRenderer.send('steam:achievement', String(id)); },
  // cloudSave(json, file): file = 'save.json' (zen) | 'save-idle.json' (idle) — cada modo no seu arquivo
  cloudSave(json, file){ ipcRenderer.send('steam:cloudSave', String(json), fileOf(file)); },
  // Síncrono: devolve o que já chegou da nuvem para o arquivo (ou null). Ver cloudLoadAsync para aguardar.
  cloudLoad(file){ return cloudCache[fileOf(file)] || null; },
  cloudLoadAsync(file){ return cloudPromise.then(c => c[fileOf(file)] || null); },
  isCloudReady(){ return cloudReady; },
  info(){ return ipcRenderer.invoke('steam:info'); }
});
