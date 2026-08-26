// Integração Steamworks (steamworks.js). Tudo aqui é opcional em runtime:
// se o pacote não estiver instalado, ou o Steam não estiver aberto, cada função vira no-op.
const fs = require('fs');
const path = require('path');

// Arquivos na Steam Cloud: 'save.json' (zen, padrão) e 'save-idle.json' (idle) — o web/platform.js
// (CLOUD_FILES) passa o nome como 2º argumento de cloudSave/cloudLoad. LEGACY_FILE é o nome antigo
// do save zen (builds anteriores): lido como fallback quando 'save.json' ainda não existe.
const CLOUD_FILE = 'save.json';
const CLOUD_FILE_IDLE = 'save-idle.json';
const LEGACY_FILE = 'lagoquieto.json';
const SAFE_FILE = /^[a-z0-9_.-]{1,64}$/i;
function fileName(f){ return (typeof f === 'string' && SAFE_FILE.test(f)) ? f : CLOUD_FILE; }

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
  thousand_ripples:  'ACH_THOUSAND_RIPPLES',   // Mil Ondas (oculto)
  // Modo Idle — ids = goals de web/idle/data.js (web/platform.js STEAM_IDS ainda não os lista;
  // quando listar, os API names devem coincidir com estes).
  primeira_onda:     'ACH_IDLE_PRIMEIRA_ONDA',   // 10 cliques
  vagalumes_acordam: 'ACH_IDLE_VAGALUMES',       // 1º vagalume
  cardume:           'ACH_IDLE_CARDUME',         // 25 peixes
  lua_cheia:         'ACH_IDLE_LUA_CHEIA',       // 10 luas
  mil_ondas:         'ACH_IDLE_MIL_ONDAS',       // 1M ondas na vida
  lago_vivo:         'ACH_IDLE_LAGO_VIVO',       // 1ª aurora
  mare_alta:         'ACH_IDLE_MARE_ALTA',       // 100K/s
  nova_noite:        'ACH_IDLE_NOVA_NOITE'       // 1º prestígio
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
  // Sub-estado idle: fica o de maior 'life' (ondas acumuladas na vida) — nunca regride prestígio.
  if (a.idle || b.idle){
    const la = a.idle && a.idle.life || 0, lb = b.idle && b.idle.life || 0;
    out.idle = la >= lb ? (a.idle || b.idle) : b.idle;
  }
  return out;
}

// cloudSave(json, file = 'save.json'): grava (mesclando com o que já há na nuvem).
function cloudSave(json, file){
  if (!client) return;
  file = fileName(file);
  safe(() => {
    if (!client.cloud.isEnabledForAccount() || !client.cloud.isEnabledForApp()) return;
    // Mescla com o que já existe na nuvem para nunca regredir progresso de outra máquina.
    let merged = json;
    try {
      const existing = cloudRead(file);
      if (existing) merged = JSON.stringify(merge(JSON.parse(json), JSON.parse(existing)));
    } catch (e) {}
    client.cloud.writeFile(file, merged);
  });
}

// Lê um arquivo (ou null). O save zen cai no nome antigo se 'save.json' ainda não existe.
function cloudRead(file){
  if (client.cloud.fileExists(file)) return client.cloud.readFile(file);
  if (file === CLOUD_FILE && client.cloud.fileExists(LEGACY_FILE)) return client.cloud.readFile(LEGACY_FILE);
  return null;
}

// cloudLoad(file = 'save.json'): JSON válido ou null.
function cloudLoad(file){
  if (!client) return null;
  file = fileName(file);
  return safe(() => {
    const txt = cloudRead(file);
    if (!txt) return null;
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

module.exports = { init, achievement, cloudSave, cloudLoad, info, shutdown, merge, ACH_MAP, CLOUD_FILE, CLOUD_FILE_IDLE, LEGACY_FILE };
