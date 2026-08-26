// Preload — expõe window.steamBridge para o jogo (platform.js detecta e delega).
// Roda com contextIsolation: o jogo nunca vê Node nem Electron diretamente.
const { contextBridge, ipcRenderer } = require('electron');

// cloudLoad é assíncrono no IPC, mas platform.js espera algo síncrono no boot.
// Solução: buscamos o save da nuvem uma vez, cedo, e o entregamos via cache síncrono.
let cloudCache = null;
let cloudReady = false;
const cloudPromise = ipcRenderer.invoke('steam:cloudLoad')
  .then(v => { cloudCache = v || null; cloudReady = true; return cloudCache; })
  .catch(() => { cloudReady = true; return null; });

contextBridge.exposeInMainWorld('steamBridge', {
  achievement(id){ ipcRenderer.send('steam:achievement', String(id)); },
  cloudSave(json){ ipcRenderer.send('steam:cloudSave', String(json)); },
  // Síncrono: devolve o que já chegou da nuvem (ou null). Ver cloudLoadAsync para aguardar.
  cloudLoad(){ return cloudCache; },
  cloudLoadAsync(){ return cloudPromise; },
  isCloudReady(){ return cloudReady; },
  info(){ return ipcRenderer.invoke('steam:info'); }
});
