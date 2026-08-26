// Camada fina de plataforma. Browser: no-op + localStorage. Steam: troca a implementação abaixo.
// O jogo nunca sabe onde roda — só fala com LQ.Platform.
window.LQ = window.LQ || {};
LQ.Platform = (function(){
  const KEY = 'lagoquieto'; // save padrão (zen); o idle passa 'lagoquieto.idle'
  // Mapa key localStorage → arquivo Steam Cloud: 'lagoquieto' → save.json, 'lagoquieto.idle' → save-idle.json
  const CLOUD_FILES = { 'lagoquieto': 'save.json', 'lagoquieto.idle': 'save-idle.json' };
  const cloudFile = key => CLOUD_FILES[key] || (key + '.json');
  const ACH_KEY = 'lagoquieto.ach'; // espelho local dos achievements (útil para depurar e para merge)

  // Build Steam (Electron): o preload.js expõe `window.steamBridge`
  // { achievement(id), cloudSave(json), cloudLoad() }. O mapeamento id → API name do
  // Steamworks fica do lado Electron (steam/steam.js); aqui só delegamos.
  // Compatibilidade: também aceita `window.steamworks` (cliente steamworks.js direto).
  const bridge = (typeof window !== 'undefined' && window.steamBridge) ? window.steamBridge : null;
  const steam = (!bridge && typeof window !== 'undefined' && window.steamworks) ? window.steamworks : null;

  // Ids internos (§8) → API names configurados no Steamworks (ajustar ao painel do parceiro).
  const STEAM_IDS = {
    first_stone: 'ACH_FIRST_STONE', woke_someone: 'ACH_WOKE_SOMEONE', full_moon: 'ACH_FULL_MOON',
    clear_view: 'ACH_CLEAR_VIEW', golden_fish: 'ACH_GOLDEN_FISH', night_bloom: 'ACH_NIGHT_BLOOM',
    aurora: 'ACH_AURORA', until_dawn: 'ACH_UNTIL_DAWN', just_watching: 'ACH_JUST_WATCHING',
    accidental_melody: 'ACH_ACCIDENTAL_MELODY', left_light_on: 'ACH_LEFT_LIGHT_ON', thousand_ripples: 'ACH_THOUSAND_RIPPLES'
  };

  function localAch(){ try { return JSON.parse(localStorage.getItem(ACH_KEY) || '[]'); } catch (e) { return []; } }

  // Merge de saves (§8): max(totalTime, ripples) e união de unlocked/achievements.
  function merge(a, b){
    if (!a) return b; if (!b) return a;
    const out = Object.assign({}, a.totalTime >= b.totalTime ? a : b);
    out.totalTime = Math.max(a.totalTime || 0, b.totalTime || 0);
    out.ripples = Math.max(a.ripples || 0, b.ripples || 0);
    out.liliesBloomed = Math.max(a.liliesBloomed || 0, b.liliesBloomed || 0);
    const uni = (x, y) => Array.from(new Set([].concat(x || [], y || [])));
    out.unlocked = uni(a.unlocked, b.unlocked);
    out.achievements = uni(a.achievements, b.achievements);
    out.lastSeen = Math.max(a.lastSeen || 0, b.lastSeen || 0);
    return out;
  }

  return {
    name: (bridge || steam) ? 'steam' : 'web',
    wallpaper: false, // modo papel de parede (Steam): 15 fps — a build Steam liga isto
    isSteam(){ return !!(bridge || steam); },
    achievement(id){
      // browser: só espelha em localStorage (sem UI, sem texto)
      try {
        const l = localAch();
        if (l.indexOf(id) < 0){ l.push(id); localStorage.setItem(ACH_KEY, JSON.stringify(l)); }
      } catch (e) {}
      if (bridge){ try { bridge.achievement(id); } catch (e) {} }
      else if (steam){
        try { steam.achievement && steam.achievement.activate(STEAM_IDS[id] || id); } catch (e) {}
      }
    },
    // saveCloud(json, key): key = 'lagoquieto' (zen, padrão) | 'lagoquieto.idle'. Sempre grava em
    // localStorage; na Steam também no arquivo de CLOUD_FILES (bridge recebe o nome como 2º arg).
    saveCloud(json, key){
      key = key || KEY;
      try { localStorage.setItem(key, json); } catch (e) {}
      if (bridge){ try { bridge.cloudSave(json, cloudFile(key)); } catch (e) {} }
      else if (steam){
        try { steam.cloud && steam.cloud.writeFile(cloudFile(key), json); } catch (e) {}
      }
    },
    loadCloud(key){
      key = key || KEY;
      const file = cloudFile(key);
      let local = null, cloud = null;
      try { local = localStorage.getItem(key); } catch (e) {}
      if (bridge){ try { cloud = bridge.cloudLoad(file) || null; } catch (e) {} }
      else if (steam){
        try { cloud = steam.cloud && steam.cloud.fileExists(file) ? steam.cloud.readFile(file) : null; } catch (e) {}
      }
      if (!cloud) return local;
      try {
        const m = merge(local ? JSON.parse(local) : null, JSON.parse(cloud));
        return JSON.stringify(m);
      } catch (e) { return local; }
    },
    merge,
    STEAM_IDS,
    CLOUD_FILES
  };
})();
