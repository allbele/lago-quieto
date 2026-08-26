// Lago Quieto — modo Idle: prestígio ("nova noite"). Só age em game.mode === 'idle'.
// Fluxo: LQ.Idle 'prestigeRequest' → pts = prestigePoints() ≥ 1 → cascata de 5 sinos (2,5 s)
// → reset do estado (plano §4) → save → LQ.resetScene() (recarrega a página em modo idle).
// Reskin por run: PRESTIGE_TINTS[runs % 5] via LQ.themes.tint (ou setPaletteOverride direto);
// a partir de runs ≥ 5 o tema também rotaciona por LQ.themeList.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;

  // Tintas sutis (mistura ~12% sobre zenith/horizon/shore/ring do tema atual). Índice = runs % 5.
  const PRESTIGE_TINTS = [
    null,                                // 0: nenhuma
    { color: '#8a6bc9', amount: 0.14 },  // 1: violeta
    { color: '#e8b04a', amount: 0.10 },  // 2: âmbar
    { color: '#7ad3c9', amount: 0.14 },  // 3: verde-água
    { color: '#f2a0b8', amount: 0.10 }   // 4: rosa
  ];
  // Upgrades permanentes: os de 'offline' (teto de horas) sobrevivem ao prestígio; os demais não.
  const PERMANENT_KINDS = ['offline'];
  const BELLS = 5, BELL_GAP = 0.5; // 5 sinos em 2,5 s

  let game = null, bellTimer = 0, bellsLeft = 0, degree = 0, resetAt = 0, busy = false, bound = false;

  function idleState(){ return game && game.state ? game.state.idle : null; }
  function data(){ return LQ.IdleData || {}; }

  // pts = floor(sqrt(life / K)) — usa LQ.Idle.prestigePoints se o engine expuser
  function points(){
    if (LQ.Idle && typeof LQ.Idle.prestigePoints === 'function') return Math.max(0, Math.floor(LQ.Idle.prestigePoints() || 0));
    const s = idleState(); if (!s) return 0;
    const K = (data().prestige && data().prestige.K) || 1.5e9;
    const got = (s.prest && Number(s.prest.pts)) || 0; // pts já resgatados não contam de novo
    return Math.max(0, Math.floor(Math.sqrt(Math.max(0, Number(s.life) || 0) / K)) - got);
  }

  // Aplica tinta/tema conforme o número de runs (chamado no init e após o reset)
  function applySkin(runs){
    const tint = PRESTIGE_TINTS[runs % PRESTIGE_TINTS.length];
    if (LQ.themes && typeof LQ.themes.tint === 'function') LQ.themes.tint(tint);
    else if (game && game.setPaletteOverride) game.setPaletteOverride(tint ? { zenith: tint.color } : null);
  }
  function rotateTheme(runs){
    const list = LQ.themeList || ['night'];
    if (runs < 5 || !game || !game.state) return;
    const th = list[(runs - 5 + 1) % list.length]; // +1: a run 5 já muda de tema (índice 0 seria 'night' = run 0)
    if (game.state.theme !== th){
      game.state.theme = th;
      if (game.audio && game.audio.setTheme) game.audio.setTheme(th);
    }
  }

  // Reset da cena: o núcleo não expõe call/pending; limpar unlocked e recarregar em modo idle é
  // a forma limpa (LQ.switchMode salva antes de recarregar). Entidades re-fazem init do zero.
  if (typeof LQ.resetScene !== 'function'){
    LQ.resetScene = function(){
      const g = LQ.game;
      if (g && g.state){ g.state.unlocked = []; if (g.state.dawnAt !== undefined) g.state.dawnAt = -1; }
      if (typeof LQ.switchMode === 'function') LQ.switchMode(g && g.mode === 'idle' ? 'idle' : 'zen');
      else location.reload();
    };
  }

  // Reset do estado idle (plano §4). Fonte de verdade: LQ.Idle.claimPrestige (pts/runs/mult, cur=0,
  // gens={}, só upgrades 'offline' ficam; goals/stats/life persistem; meta 'nova_noite' → idle_nova_noite).
  function doReset(pts){
    const s = idleState(); if (!s) return;
    if (LQ.Idle && typeof LQ.Idle.claimPrestige === 'function') LQ.Idle.claimPrestige();
    else {
      const ups = data().upgrades || [];
      s.cur = 0; s.gens = {};
      s.ups = (Array.isArray(s.ups) ? s.ups : []).filter(id => { const u = ups.find(x => x.id === id); return u && PERMANENT_KINDS.indexOf(u.kind) >= 0; });
      s.prest = s.prest && typeof s.prest === 'object' ? s.prest : { pts: 0, runs: 0, mult: 1 };
      s.prest.pts = (Number(s.prest.pts) || 0) + pts;
      s.prest.runs = (Number(s.prest.runs) || 0) + 1;
      s.prest.mult = 1 + 0.1 * s.prest.pts;
    }
    s.lastTick = Date.now();
    if (s.stats && typeof s.stats === 'object') s.stats.bestRate = 0;
    // A cena viva fica intacta durante os sinos (LQ.resetScene limpa unlocked depois); só a cópia gravada
    // já vai com unlocked=[] — fechar a aba durante os sinos não deixa moradores acordados sem geradores.
    rotateTheme(s.prest.runs);
    applySkin(s.prest.runs);
    const patch = { unlocked: [] }; if (game.state && game.state.dawnAt !== undefined) patch.dawnAt = -1;
    if (LQ.Idle && typeof LQ.Idle.save === 'function') LQ.Idle.save(patch);
  }

  function request(){
    if (!game || game.mode !== 'idle' || busy) return false;
    const pts = points();
    if (pts < 1) return false;
    busy = true;
    doReset(pts);            // estado já novo; a cena só troca após os sinos
    bellsLeft = BELLS; bellTimer = 0; degree = 0;
    resetAt = BELLS * BELL_GAP + 0.3;
    if (game.ui && game.ui.wake) game.ui.wake();
    return true;
  }

  function bind(){
    if (bound || !LQ.Idle || typeof LQ.Idle.on !== 'function') return;
    LQ.Idle.on('prestigeRequest', request);
    bound = true;
  }

  LQ.register('idle-prestige', {
    init(g){
      game = g;
      if (game.mode !== 'idle') return;
      const s = idleState();
      applySkin(s && s.prest ? (Number(s.prest.runs) || 0) : 0);
      bind();
    },
    // também aceita game.emit('prestigeRequest') (hud pode usar qualquer um dos dois caminhos)
    onPrestigeRequest(){ if (game && game.mode === 'idle') request(); },
    update(dt, g){
      if (!g || g.mode !== 'idle') return;
      if (!bound) bind(); // LQ.Idle pode ter sido registrado depois deste arquivo
      if (!busy) return;
      bellTimer -= dt;
      if (bellsLeft > 0 && bellTimer <= 0){
        g.audio.play('unlock', { degree: degree % 5, gain: 1 });
        degree++; bellsLeft--; bellTimer = BELL_GAP;
      }
      resetAt -= dt;
      if (resetAt <= 0){ busy = false; LQ.resetScene(); }
    }
  });

  LQ.IdlePrestige = { PRESTIGE_TINTS, PERMANENT_KINDS, points, request, applySkin, get busy(){ return busy; } };
})();
