// Integração Steamworks (steamworks.js). Tudo aqui é opcional em runtime:
// se o pacote não estiver instalado, ou o Steam não estiver aberto, cada função vira no-op.
const fs = require('fs');
const path = require('path');

const CLOUD_FILE = 'lagoquieto.json';

// Ids internos emitidos pelo jogo (game.js / ent/*.js) → API names no painel Steamworks.
// Ajuste o lado direito conforme os nomes cadastrados em Steamworks > Stats & Achievements.
const ACH_MAP = {
  first_stone:       'ACH_FIRST_STONE',        // Primeira Pedra
  woke_someone:      'ACH_WOKE_SOMEONE',       // Acordei Alguém
  full_moon:         'ACH_FULL_MOON',          // Lua Cheia
  clear_view:        'ACH_CLEAR_VIEW',         // Vista Limpa
  golden_fish:       'ACH_GOLDEN_FISH',        // Peixe Dourado
  night_bloom:       'ACH_NIGHT_BLOOM',        // Flor da Noite
  aurora:            'ACH_AURORA',             // Aurora
  until_dawn:        'ACH_UNTIL_DAWN',         // Até o Amanhecer
  just_watching:     'ACH_JUST_WATCHING',      // Só Olhando
  accidental_melody: 'ACH_ACCIDENTAL_MELODY',  // Melodia Acidental
  left_light_on:     'ACH_LEFT_LIGHT_ON',      // Deixei Aceso
  thousand_ripples:  'ACH_THOUSAND_RIPPLES'    // Mil Ondas (oculto)
};

let client = null;
let reason = 'não inicializado';

function readAppId(){
  // steam_appid.txt ao lado do main.js (dev) ou ao lado do executável (build).
  const candidates = [
    path.join(__dirname, 'steam_appid.txt'),
    path.join(path.dirname(process.execPath), 'steam_appid.txt'),
    process.resourcesPath ? path.join(process.resourcesPath, 'steam_appid.txt') : null
  ].filter(Boolean);
  for (const p of candidates){
    try { const n = parseInt(fs.readFileSync(p, 'utf8').trim(), 10); if (n > 0) return n; } catch (e) {}
  }
  return 480; // Spacewar (app de testes da Valve)
}

function init(){
  let sw;
  try { sw = require('steamworks.js'); }
  catch (e) { reason = 'steamworks.js não instalado'; return false; }
  try {
    const appId = readAppId();
    client = sw.init(appId);
    // Overlay do Steam precisa destas flags no Electron.
    try { sw.electronEnableSteamOverlay && sw.electronEnableSteamOverlay(); } catch (e) {}
    reason = 'ok';
    console.log('[steam] inicializado, appId', appId, 'usuário', safe(() => client.localplayer.getName()));
    return true;
  } catch (e) {
    client = null;
    reason = 'Steam não está rodando: ' + (e && e.message);
    console.warn('[steam]', reason);
    return false;
  }
}

function safe(fn, fallback){ try { return fn(); } catch (e) { return fallback; } }

function achievement(id){
  if (!client) return;
  const api = ACH_MAP[id];
  if (!api){ console.warn('[steam] achievement desconhecido:', id); return; }
  safe(() => {
    if (client.achievement.isActivated(api)) return;
    client.achievement.activate(api); // steamworks.js já chama storeStats()
    console.log('[steam] achievement', api);
  });
}

// Merge de saves (§8): max(totalTime, ripples) e união de unlocked/achievements.
// Espelha LQ.Platform.merge — mantido aqui para o lado Electron ser autossuficiente.
function merge(a, b){
  if (!a) return b; if (!b) return a;
  const out = Object.assign({}, (a.totalTime || 0) >= (b.totalTime || 0) ? a : b);
  out.totalTime = Math.max(a.totalTime || 0, b.totalTime || 0);
  out.ripples = Math.max(a.ripples || 0, b.ripples || 0);
  out.liliesBloomed = Math.max(a.liliesBloomed || 0, b.liliesBloomed || 0);
  const uni = (x, y) => Array.from(new Set([].concat(x || [], y || [])));
  out.unlocked = uni(a.unlocked, b.unlocked);
  out.achievements = uni(a.achievements, b.achievements);
  out.lastSeen = Math.max(a.lastSeen || 0, b.lastSeen || 0);
  return out;
}

function cloudSave(json){
  if (!client) return;
  safe(() => {
    if (!client.cloud.isEnabledForAccount() || !client.cloud.isEnabledForApp()) return;
    // Mescla com o que já existe na nuvem para nunca regredir progresso de outra máquina.
    let merged = json;
    try {
      const existing = client.cloud.fileExists(CLOUD_FILE) ? client.cloud.readFile(CLOUD_FILE) : null;
      if (existing) merged = JSON.stringify(merge(JSON.parse(json), JSON.parse(existing)));
    } catch (e) {}
    client.cloud.writeFile(CLOUD_FILE, merged);
  });
}

function cloudLoad(){
  if (!client) return null;
  return safe(() => {
    if (!client.cloud.fileExists(CLOUD_FILE)) return null;
    const txt = client.cloud.readFile(CLOUD_FILE);
    JSON.parse(txt); // valida; se corrompido cai no catch → null
    return txt;
  }, null);
}

function info(){
  return {
    active: !!client,
    reason,
    appId: readAppId(),
    user: client ? safe(() => client.localplayer.getName(), null) : null
  };
}

function shutdown(){ /* steamworks.js encerra sozinho no exit do processo */ }

module.exports = { init, achievement, cloudSave, cloudLoad, info, shutdown, merge, ACH_MAP, CLOUD_FILE };
