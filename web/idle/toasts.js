// Lago Quieto — modo Idle: pilha de toasts (#toasts, inferior-esquerda acima da barra).
// API: LQ.Toasts.show({icon, title, text, life, kind, onClick}) · LQ.Toasts.idle() (nada visível nem na fila).
// Máx 3 visíveis, fila 6 (era/meta nunca descartadas), entrada 300 ms, vida 5 s (era 8 s), saída 800 ms, gap 600 ms,
// sino 'unlock' em grau crescente (zera quando a pilha esvazia). Só age em game.mode==='idle'.
// Ouvintes do motor (LQ.Idle.on): novo morador (cur ≥ 0.5·base), marco, ×1.5 automático, era, meta, 1º bônus, offline.
window.LQ = window.LQ || {};
LQ.Toasts = (function(){
  'use strict';
  const LQ = window.LQ;
  const D = () => LQ.IdleData || { gens: [], upgrades: [], goals: [], eras: [] };
  const I = () => LQ.Idle || {};
  const MAX_VIS = 3, MAX_Q = 6, GAP = 0.6, LIFE = 5, LIFE_ERA = 8, OUT = 0.8;
  const KEEP = { era: 1, goal: 1 }; // nunca descartados da fila
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RING = 'M4 13a8 3.2 0 1 0 16 0a8 3.2 0 1 0 -16 0|M8 13a4 1.6 0 1 0 8 0a4 1.6 0 1 0 -8 0';
  const SPARK = 'M12 3l1.6 6.4L20 12l-6.4 2.6L12 21l-1.6-6.4L4 12l6.4-2.6z';
  const LANTERN = 'M9 4h6M10 4v3h4V4M8 7h8l1 9H7z|M12 9v5|M11 16v4h2v-4';
  const CLOCK = 'M12 6v6l4 2|M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18';
  const BONUS_ICON = { fish: 'ic-fish', fish_racao: 'ic-goldfish', glint: SPARK, shooting: 'ic-shooting', combo: RING, lantern: LANTERN, village: LANTERN, temple: LANTERN };
  // nome PT das metas (data.goals só tem id/icon/cond)
  const GOAL_TXT = {
    primeira_onda: ['Primeira onda', 'Dez pedras no lago. Ele já sabe seu nome.'],
    vagalumes_acordam: ['Vagalumes acordam', 'A primeira luz que não veio do céu.'],
    cardume: ['Cardume', '25 peixes no mesmo lago.'],
    lua_cheia: ['Lua cheia', 'Dez luas e nenhuma coube no céu.'],
    mil_ondas: ['Um milhão de ondas', 'A água lembra de cada uma.'],
    lago_vivo: ['Lago vivo', 'A aurora dobrou a esquina do horizonte.'],
    mare_alta: ['Maré alta', '100K ondas por segundo.'],
    nova_noite: ['Nova noite', 'O lago recomeçou, mas a margem ficou.'],
    guardiao_lanterna: ['Guardião da Lanterna', 'Dez vezes a lanterna acendeu por você.'],
    tres_eras: ['Três eras', 'Barco, píer e lanterna: a margem tem história.'],
    ouvinte: ['Ouvinte', 'Cinquenta conversas do lago. Você escuta bem.'],
  };
  // frase do ×1.5 automático por gerador
  const MULT_TXT = {
    vagalume: 'a colônia aprendeu a brilhar junto', juncos: 'o vento passa mais fundo entre eles', peixe: 'o cardume nada em fila',
    estrelas: 'o céu se organizou em constelações', lua: 'o halo cresceu', dourado: 'as escamas pegam mais luz',
    nevoa: 'as cordilheiras ecoam', lirio: 'as flores abrem juntas', sapo: 'o coro achou o tom', aurora: 'as faixas dançam em par',
  };

  // fmt sem ".0"
  function fmt(n){
    const U = LQ.IdleUtil; let s;
    if (U && U.fmt) s = U.fmt(n);
    else { n = +n || 0; if (n < 1000) return String(Math.floor(n)); const suf = ['', 'K', 'M', 'B', 'T']; let i = 0; while (n >= 1000 && i < suf.length - 1){ n /= 1000; i++; } s = (n < 100 ? n.toFixed(1) : String(Math.floor(n))) + suf[i]; }
    return String(s).replace(/\.0(?=[A-Za-z]*$)/, '');
  }
  function fmtDur(sec){ sec = Math.max(0, sec | 0); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + 'h' + (m ? String(m).padStart(2, '0') : '') : m + ' min'; }
  function bonusPhrase(key, p){
    const m = p && p.mult, amt = p && p.amount;
    if (key === 'fish_racao') return ['Ração!', 'O peixe comeu ×' + (m || 4)];
    if (key === 'fish') return ['O peixe comeu a pedra!', m ? 'Vale ×' + m : 'Pedras viram comida'];
    if (key === 'glint') return ['Brilho dourado!', '+' + fmt(amt || 0) + ' por tocar a luz na água'];
    if (key === 'shooting') return ['Reflexo da cadente!', 'Tocou o reflexo: ×' + (m || 25)];
    if (key === 'combo') return ['Ritmo!', 'Pedras em cadência rendem mais'];
    if (key === 'lantern') return ['A lanterna acendeu!', '+' + fmt(amt || 0) + ' e o lago rende +25% por 1 min'];
    if (key === 'village') return ['A aldeia acordou!', 'Luzes na outra margem: +35% por 1 min'];
    if (key === 'temple') return ['O templo acendeu!', 'A janela brilha: +50% por 1 min'];
    return ['Bônus!', '+' + fmt(amt || 0)];
  }
  function iconEl(ic){
    const s = document.createElementNS(SVG_NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24');
    if (ic && ic.indexOf('ic-') === 0){ const u = document.createElementNS(SVG_NS, 'use'); u.setAttribute('href', '#' + ic); s.appendChild(u); }
    else (ic || RING).split('|').forEach(p => { const e = document.createElementNS(SVG_NS, 'path'); e.setAttribute('d', p); s.appendChild(e); });
    return s;
  }
  function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  const st = () => (game && game.state && game.state.idle) || null;
  function eraIdx(){
    if (I().era) { const e = I().era(); return typeof e === 'number' ? e : (e && e.index) || 0; }
    const s = st(); if (s && typeof s.era === 'number') return s.era;
    const eras = D().eras || []; let e = 0; for (let i = 0; i < eras.length; i++) if (s && s.life >= eras[i].life) e = i; return e;
  }

  // ---------- pilha ----------
  let game = null, root = null;
  const vis = [];   // {el, t, life, out}
  const queue = []; // opções pendentes
  let gap = 0, degree = 0, seenT = 0;
  const subs = [];

  function ensureRoot(){
    if (root && root.isConnected) return root;
    root = document.getElementById('toasts');
    if (!root){ root = el('div'); root.id = 'toasts'; root.setAttribute('aria-live', 'polite'); document.body.appendChild(root); }
    root.textContent = '';
    return root;
  }
  const same = (a, b) => a && b && a.title === b.title && a.text === b.text;
  function idle(){ return !vis.length && !queue.length; }

  // Enfileira (ou mostra) um toast. Retorna false fora do idle. Duplicatas (título+frase) são ignoradas.
  function show(o){
    if (!game || game.mode !== 'idle' || !o) return false;
    o = { icon: o.icon, title: o.title || '', text: o.text || '', life: o.life, kind: o.kind || 'info', onClick: o.onClick || null };
    if (vis.some(v => same(v.o, o)) || queue.some(q => same(q, o))) return false;
    if (queue.length >= MAX_Q){
      const i = queue.findIndex(q => !KEEP[q.kind]);
      if (i < 0) return false; // fila só com era/meta: espera
      queue.splice(i, 1);
    }
    queue.push(o);
    pump();
    return true;
  }
  function pump(){
    if (!queue.length || gap > 0 || vis.filter(v => !v.out).length >= MAX_VIS) return;
    const o = queue.shift();
    const r = ensureRoot();
    const t = el('div', 'toast ' + o.kind);
    const ic = el('span', 'ico'); ic.appendChild(iconEl(o.icon)); t.appendChild(ic);
    const body = el('span', 'body');
    if (o.title) body.appendChild(el('b', null, o.title));
    if (o.text) body.appendChild(el('span', 'txt', o.text));
    t.appendChild(body);
    if (o.onClick){ t.classList.add('act'); t.addEventListener('click', e => { e.stopPropagation(); try { o.onClick(); } catch (err) {} }); }
    t.addEventListener('pointerdown', e => e.stopPropagation());
    r.appendChild(t);
    // entrada 300 ms: classe no próximo frame (transição de opacity/transform)
    requestAnimationFrame(() => t.classList.add('show'));
    const life = o.life || (o.kind === 'era' ? LIFE_ERA : LIFE);
    vis.push({ el: t, o, t: 0, life, out: false });
    gap = GAP;
    if (o.kind !== 'chatter' && game.audio){ game.audio.play('unlock', { degree: degree % 5, gain: o.kind === 'era' ? 1 : 0.6 }); degree++; }
    if (game.ui && o.kind !== 'chatter') game.ui.wake();
  }
  function tick(dt){
    if (gap > 0) gap -= dt;
    for (let i = vis.length - 1; i >= 0; i--){
      const v = vis[i]; v.t += dt;
      if (!v.out && v.t >= v.life){ v.out = true; v.el.classList.remove('show'); v.el.classList.add('out'); }
      else if (v.out && v.t >= v.life + OUT){ v.el.remove(); vis.splice(i, 1); }
    }
    if (!vis.length && !queue.length){ seenT += dt; if (seenT > 2) degree = 0; } else seenT = 0;
    pump();
  }
  function clear(){ for (const v of vis) v.el.remove(); vis.length = 0; queue.length = 0; gap = 0; degree = 0; }

  // abre o painel Margem (game.js desenha eras/metas/moradores em refreshCollection)
  function openMargem(){
    if (!game || game.mode !== 'idle' || !game.ui) return;
    game.ui.collOpen = true;
    game.ui.refreshCollection(null, true);
    const c = document.getElementById('collection'); if (c) c.classList.add('open');
    game.ui.wake();
  }
  const refreshMargem = () => { if (game && game.ui && game.mode === 'idle') game.ui.refreshCollection(null, true); };

  // ---------- ouvintes do motor ----------
  function bonusSeen(key){
    const s = st(); if (!s) return true;
    s.stats = s.stats || {}; s.stats.bonusSeen = s.stats.bonusSeen || {};
    if (s.stats.bonusSeen[key]) return true;
    s.stats.bonusSeen[key] = true; return false;
  }
  // marco + ×1.5 do mesmo evento saem num só toast: o ×N automático (emitido antes do 'buy') fica pendente até o marco
  const pendingMult = {}; // 'gen:at' → value
  function onBuy(p){
    if (!p) return; const g = D().gens.find(x => x.id === p.id); if (!g || !g.milestones) return;
    const before = (p.count || 0) - (p.n || 1);
    for (const m of g.milestones){
      if (!(before < m.at && p.count >= m.at)) continue;
      const k = g.id + ':' + m.at, mv = pendingMult[k]; delete pendingMult[k];
      if (m.at <= 1) continue; // 1º morador: a cena e o toast 'Novo morador' já comunicam
      show({ icon: g.icon, title: g.name + ' · ' + m.at, text: m.text + (mv ? ' · ×' + mv + ' produção' : ''), kind: 'milestone' });
    }
  }
  function onUpgrade(p){
    if (!p || !p.auto) return; const g = D().gens.find(x => x.id === p.gen); if (!g) return;
    if (p.at != null && (g.milestones || []).some(m => m.at === p.at)){ pendingMult[g.id + ':' + p.at] = p.value || 2; return; }
    show({ icon: g.icon, title: g.name + ' ×' + (p.value || 2), text: MULT_TXT[g.id] || 'produção multiplicada', kind: 'mult' });
  }
  function onEra(p){
    const eras = D().eras || [];
    const i = typeof p === 'number' ? p : p && (typeof p.era === 'number' ? p.era : typeof p.index === 'number' ? p.index : eras.findIndex(e => e.id === p.id));
    const e = eras[i >= 0 ? i : eraIdx()]; if (!e) return;
    const t = e.toast || {};
    show({ icon: e.piece === 'lantern' ? LANTERN : 'ic-moon', title: t.title || e.name, text: t.text || '', kind: 'era', onClick: openMargem });
    refreshMargem();
  }
  function onGoal(p){
    if (!p) return; const g = D().goals.find(x => x.id === p.id);
    const tx = GOAL_TXT[p.id] || [p.id.replace(/_/g, ' '), 'meta alcançada'];
    show({ icon: p.icon || (g && g.icon) || 'ic-coll', title: 'Meta: ' + tx[0], text: tx[1], kind: 'goal', onClick: openMargem });
    refreshMargem();
  }
  function onBonus(p){
    if (!p) return; const kind = p.kind || 'bonus';
    const key = kind === 'fish' && (p.racao || (p.mult >= 4 && I().has && I().has('racao'))) ? 'fish_racao' : kind;
    if (bonusSeen(key)) return;
    const ph = bonusPhrase(key, p);
    show({ icon: BONUS_ICON[key] || SPARK, title: ph[0], text: ph[1], kind: 'bonus' });
  }
  function onCombo(p){ if (p && p.mult >= 1.5 && !bonusSeen('combo')){ const ph = bonusPhrase('combo'); show({ icon: RING, title: ph[0], text: ph[1], kind: 'bonus' }); } }
  function onOffline(p){
    if (!p || !(p.earned > 0)) return;
    show({ icon: CLOCK, title: '+' + fmt(p.earned) + ' enquanto você dormia', text: fmtDur(p.sec) + ' de ausência' + (p.capped ? ' (teto do sono)' : ''), kind: 'offline', life: 7 });
  }
  // novo morador comprável pela 1ª vez (cur ≥ 0.5·base, era liberada, nunca comprado)
  let seenT2 = 0;
  function checkSeen(dt){
    seenT2 += dt; if (seenT2 < 1) return; seenT2 = 0;
    const s = st(); if (!s) return;
    s.stats = s.stats || {}; s.stats.seenGens = s.stats.seenGens || {};
    const era = eraIdx();
    for (const g of D().gens){
      if (s.stats.seenGens[g.id] || (g.era || 0) > era || (s.gens[g.id] || 0) > 0) continue;
      if (s.cur >= 0.5 * g.base){
        s.stats.seenGens[g.id] = true;
        show({ icon: g.icon, title: 'Novo morador: ' + g.name, text: g.desc, kind: 'gen' });
      }
    }
  }

  LQ.register('idle-toasts', {
    init(g){
      game = g; clear();
      for (const off of subs){ try { off(); } catch (e) {} } subs.length = 0;
      if (g.mode !== 'idle') return;
      ensureRoot();
      if (I().on){
        const sub = (ev, fn) => { const off = I().on(ev, fn); if (typeof off === 'function') subs.push(off); };
        sub('buy', onBuy); sub('upgrade', onUpgrade); sub('era', onEra); sub('goal', onGoal);
        sub('bonus', onBonus); sub('combo', onCombo); sub('offline', onOffline);
        sub('prestige', refreshMargem);
      }
    },
    update(dt, g){ if (g.mode !== 'idle') return; tick(dt); checkSeen(dt); },
  });

  return { show, idle, clear, openMargem, count: () => vis.length, queued: () => queue.length };
})();
