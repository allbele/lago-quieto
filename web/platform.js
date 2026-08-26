// Camada fina de plataforma. Browser: no-op + localStorage. Steam: troca a implementação abaixo.
// O jogo nunca sabe onde roda — só fala com LQ.Platform.
window.LQ = window.LQ || {};
LQ.Platform = (function(){
  const KEY = 'lagoquieto';
  const ACH_KEY = 'lagoquieto.ach'; // espelho local dos achievements (útil para depurar e para merge)

  // TODO(steam): na build Electron/Steamworks, expor `window.steamworks` (steamworks.js) antes deste script:
  //   const sw = require('steamworks.js'); const client = sw.init(APP_ID); window.steamworks = client;
  // Então: achievement(id) → client.achievement.activate(STEAM_IDS[id]);
  //        saveCloud(json) → client.cloud.writeFile('save.json', json);
  //        loadCloud()     → client.cloud.fileExists('save.json') ? client.cloud.readFile('save.json') : null;
  //        overlay do troféu → client.overlay.activateToWebPage / activate('Achievements').
  const steam = (typeof window !== 'undefined' && window.steamworks) ? window.steamworks : null;

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
    name: steam ? 'steam' : 'web',
    wallpaper: false, // modo papel de parede (Steam): 15 fps — a build Steam liga isto
    isSteam(){ return !!steam; },
    achievement(id){
      // browser: só espelha em localStorage (sem UI, sem texto)
      try {
        const l = localAch();
        if (l.indexOf(id) < 0){ l.push(id); localStorage.setItem(ACH_KEY, JSON.stringify(l)); }
      } catch (e) {}
      if (steam){
        // TODO(steam): steam.achievement.activate(STEAM_IDS[id] || id)
        try { steam.achievement && steam.achievement.activate(STEAM_IDS[id] || id); } catch (e) {}
      }
    },
    saveCloud(json){
      try { localStorage.setItem(KEY, json); } catch (e) {}
      if (steam){
        // TODO(steam): steam.cloud.writeFile('save.json', json)
        try { steam.cloud && steam.cloud.writeFile('save.json', json); } catch (e) {}
      }
    },
    loadCloud(){
      let local = null, cloud = null;
      try { local = localStorage.getItem(KEY); } catch (e) {}
      if (steam){
        // TODO(steam): cloud = steam.cloud.fileExists('save.json') ? steam.cloud.readFile('save.json') : null
        try { cloud = steam.cloud && steam.cloud.fileExists('save.json') ? steam.cloud.readFile('save.json') : null; } catch (e) {}
      }
      if (!cloud) return local;
      try {
        const m = merge(local ? JSON.parse(local) : null, JSON.parse(cloud));
        return JSON.stringify(m);
      } catch (e) { return local; }
    },
    merge,
    STEAM_IDS
  };
})();
