// Lago Quieto — modo Idle: HUD pequeno (anel + arco de combo + taxa), loja SEMPRE visível (nunca fecha, nunca cobre o lago),
// toast simples (offline / 1º bônus de cada tipo) e floaters "+N" (bônus em dourado).
// Layout: CSS vars --shop-w/--shop-h no body reservam a área da loja; o canvas #lake ocupa o resto (game.resize lê clientWidth/Height).
// Só age em game.mode==='idle'. Usa LQ.Idle/LQ.IdleUtil quando existem; senão calcula a partir de LQ.IdleData.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;
  const D = () => LQ.IdleData || { gens: [], upgrades: [], clickBase: 1 };
  const U = () => LQ.IdleUtil || {};
  const I = () => LQ.Idle || {};

  // ---------- utilidades locais (fallbacks) ----------
  // fmt sem ".0" ("1.0K" → "1K")
  function fmt(n){
    let s;
    if (U().fmt) s = U().fmt(n);
    else {
      n = +n || 0;
      if (n < 1000) return String(Math.floor(n));
      const suf = ['', 'K', 'M', 'B', 'T']; let i = 0;
      while (n >= 1000 && i < suf.length - 1){ n /= 1000; i++; }
      s = n >= 1e3 ? n.toExponential(1) : (n < 100 ? n.toFixed(1) : String(Math.floor(n))) + suf[i];
    }
    return String(s).replace(/\.0(?=[A-Za-z]*$)/, '');
  }
  function fmtRate(n){ n = +n || 0; if (n > 0 && n < 10){ const s = n.toFixed(1); return s.endsWith('.0') ? s.slice(0, -2) : s; } return fmt(n); }
  // "faltam 1m20" — segundos → 45s / 1m20 / 2h05
  function fmtTime(sec){
    if (!Number.isFinite(sec) || sec < 0) return '';
    if (sec < 60) return Math.ceil(sec) + 's';
    if (sec < 3600){ const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + 'm' + (s < 10 ? '0' : '') + s; }
    if (sec < 360000){ const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h + 'h' + (m < 10 ? '0' : '') + m; }
    return Math.floor(sec / 86400) + 'd';
  }
  // Custo de comprar `qty` unidades tendo `count`
  function cost(g, count, qty){
    if (U().cost) return U().cost(g, count, qty);
    qty = qty || 1; const r = g.growth;
    return Math.ceil(g.base * Math.pow(r, count) * (Math.pow(r, qty) - 1) / (r - 1));
  }
  function maxAffordable(g, count, cur){
    if (U().maxAffordable) return U().maxAffordable(g, count, cur);
    const r = g.growth, c0 = g.base * Math.pow(r, count);
    if (cur < c0) return 0;
    return Math.max(0, Math.floor(Math.log(cur * (r - 1) / c0 + 1) / Math.log(r)));
  }
  function st(game){ return game && game.state && game.state.idle; }
  function rate(game){
    if (I().rate) return I().rate();
    const s = st(game); if (!s) return 0;
    let r = 0; for (const g of D().gens) r += (s.gens[g.id] || 0) * genRate(g, game);
    return r * ((s.prest && s.prest.mult) || 1);
  }
  function totalRate(game){ return I().totalRate ? I().totalRate() : rate(game); }
  // Taxa por unidade (com upgrades mult daquele gerador)
  function genRate(g, game){
    if (I().genRate) return I().genRate(g.id);
    const s = st(game); let m = 1;
    if (s) for (const u of D().upgrades) if (u.gen === g.id && u.kind === 'mult' && s.ups.indexOf(u.id) >= 0) m *= u.value;
    return g.rate * m;
  }
  // taxa total de um gerador (n × por unidade × prestígio)
  function genTotal(g, n, game){ const s = st(game); return n * genRate(g, game) * ((s && s.prest && s.prest.mult) || 1); }
  function clickPower(game){
    if (I().clickPower) return I().clickPower();
    const s = st(game); let m = 1;
    if (s) for (const u of D().upgrades) if (u.kind === 'click' && s.ups.indexOf(u.id) >= 0) m *= u.value;
    return (D().clickBase || 1) * m * ((s && s.prest && s.prest.mult) || 1);
  }
  // fração do lago que uma pedra rende (motor expõe clickPct; senão clique/taxa com guarda)
  function clickPct(game){
    if (I().clickPct) return I().clickPct();
    const r = rate(game); if (!(r > 0)) return 0;
    return clickPower(game) / r;
  }
  // era atual (motor expõe era(); senão maior era cujo limiar de life foi atingido)
  function era(game){
    if (I().era) return I().era();
    const s = st(game), eras = D().eras; if (!s || !eras || !eras.length) return 99;
    let e = 0; for (let i = 0; i < eras.length; i++) if ((s.life || 0) >= (eras[i].life || 0)) e = i;
    return e;
  }
  function prestigePoints(game){
    if (I().prestigePoints) return I().prestigePoints();
    const s = st(game); if (!s) return 0;
    const K = (D().prestige && D().prestige.K) || 1.5e9;
    return Math.max(0, Math.floor(Math.sqrt((s.life || 0) / K)) - ((s.prest && s.prest.pts) || 0));
  }
  function buyGen(g, qty, game){
    if (I().buy) return I().buy(g.id, qty);
    const s = st(game); if (!s) return 0;
    const n = s.gens[g.id] || 0, c = cost(g, n, qty);
    if (s.cur < c) return 0;
    s.cur -= c; s.gens[g.id] = n + qty;
    if (g.unlock && game.forceUnlock) game.forceUnlock(g.unlock);
    return qty;
  }
  function buyUp(u, game){
    if (I().buyUpgrade) return I().buyUpgrade(u.id);
    const s = st(game); if (!s || s.cur < u.cost || s.ups.indexOf(u.id) >= 0) return false;
    s.cur -= u.cost; s.ups.push(u.id); return true;
  }
  const hasUp = (id, game) => I().has ? I().has(id) : !!(st(game) && st(game).ups.indexOf(id) >= 0);
  const idleEmit = (n, p) => { if (I().emit) I().emit(n, p); };
  // texto do floater: frações (lírio/sapo valem 0.5) e ganhos pequenos com combo mostram 1 decimal ("+1.8")
  const fmtGain = (a, dec) => a < 1 || (dec && a < 10 && a % 1) ? a.toFixed(1) : fmt(a);
  const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; }; // evita invalidar estilo sem mudança
  const FLOAT_LIFE = 1.4;   // s de vida do floater "+N"
  const FLOAT_LIFE_GOLD = 2; // bônus dura mais (é raro; merece ser lido)
  const HOVER_DELAY = 250;  // ms de mouse parado antes de expandir os marcos
  const COMBO_C = 69.1;     // circunferência do arco (r=11 em viewBox 24)
  const UP_SHOW = 0.25;     // melhoria aparece a partir de 25% do custo

  // ---------- SVG helpers ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(id){
    const s = document.createElementNS(SVG_NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24');
    const u = document.createElementNS(SVG_NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  }
  function pathIcon(d){
    const s = document.createElementNS(SVG_NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24');
    d.split('|').forEach(p => { const e = document.createElementNS(SVG_NS, 'path'); e.setAttribute('d', p); s.appendChild(e); });
    return s;
  }
  const RING = 'M4 13a8 3.2 0 1 0 16 0a8 3.2 0 1 0 -16 0|M8 13a4 1.6 0 1 0 8 0a4 1.6 0 1 0 -8 0';
  const NEWMOON = 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17|M12 3.5a8.5 8.5 0 0 0 0 17c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5';
  const SPARK = 'M12 3l1.6 6.4L20 12l-6.4 2.6L12 21l-1.6-6.4L4 12l6.4-2.6z';
  const CHEV = 'M9 6l6 6-6 6';
  const UPICON = { click: 'M13 2.5L5 13.5h6l-1 8 9-11.5h-6l1-7.5z', auto: 'M12 4a8 8 0 1 1-6 2.7|M6 3v4h4', offline: 'M12 6v6l4 2|M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', racao: 'M7 12a1.5 1.5 0 1 0 0 .01|M12 9a1.5 1.5 0 1 0 0 .01|M17 12a1.5 1.5 0 1 0 0 .01|M12 15a1.5 1.5 0 1 0 0 .01' };
  // ícone do toast por tipo de bônus (id de <symbol> ou path)
  const BONUS_ICON = { fish: 'ic-fish', fish_racao: 'ic-goldfish', glint: SPARK, shooting: 'ic-shooting', combo: RING, lantern: 'ic-firefly' };
  function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  // texto do efeito de um upgrade: ×2 (clique), +1/s (auto), 12h (offline), ×4 (ração)
  function fxText(u){ return u.kind === 'click' || u.kind === 'racao' ? '×' + u.value : u.kind === 'auto' ? '+' + u.value + '/s' : u.value + 'h'; }
  // frase do toast do 1º bônus de cada tipo
  function bonusPhrase(key, p){
    const m = p && p.mult; const amt = p && p.amount;
    if (key === 'fish_racao') return 'Ração! O peixe comeu ×' + (m || 4);
    if (key === 'fish') return 'O peixe comeu a pedra!' + (m ? ' ×' + m : '');
    if (key === 'glint') return 'Brilho dourado! +' + fmt(amt || 0);
    if (key === 'shooting') return 'Reflexo da cadente!' + (m ? ' ×' + m : ' ×25');
    if (key === 'lantern') return 'A lanterna acendeu! +' + fmt(amt || 0);
    if (key === 'combo') return 'Ritmo! Pedras em cadência rendem mais'; // sem número: o multiplicador segue subindo no HUD
    return 'Bônus! +' + fmt(amt || 0);
  }
  // marcos de um gerador (frases + ×N automáticos) unidos por contagem: [{at, text}]
  function milestonesOf(g){
    const byAt = {};
    for (const m of (g.milestones || [])) if (m && m.at != null) byAt[m.at] = (byAt[m.at] ? byAt[m.at] + ' · ' : '') + m.text;
    for (const u of D().upgrades) if (u.kind === 'mult' && u.gen === g.id && u.at != null) byAt[u.at] = '×' + u.value + ' produção' + (byAt[u.at] ? ', ' + byAt[u.at] : '');
    return Object.keys(byAt).map(Number).sort((a, b) => a - b).map(at => ({ at, text: byAt[at] }));
  }

  // ---------- entidade ----------
  const H = {
    hud: null, shop: null, list: null, ups: null, prest: null, toast: null,
    qty: 1, tab: 'gens', throttle: 0, toastT: 0, toastGap: 0, toastQ: [], dirty: true,
    rows: {}, upRows: {}, hoverTimer: 0, hoverId: null, pinId: null, comboMult: 1, lastShopClick: 0,
    subs: [],   // unsubscribes do barramento do motor
    floats: [], // pool de floaters
    game: null, ro: null,

    init(game){
      this.game = game;
      this.unsubscribe();
      if (game.mode !== 'idle') return;
      this.floats = []; for (let i = 0; i < 24; i++) this.floats.push({ age: 1, x: 0, y: 0, txt: '', gold: false });
      this.buildHud(); this.buildShop();
      // a loja reserva área via CSS (body.mode-idle); garante a classe antes do 1º resize do núcleo e
      // observa o canvas: qualquer mudança da área do lago vira um 'resize' (game.W/H = clientWidth/Height)
      document.body.classList.add('mode-idle');
      if (!this.ro && window.ResizeObserver){
        const cv = document.getElementById('lake');
        if (cv){
          let raf = 0;
          this.ro = new ResizeObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; window.dispatchEvent(new Event('resize')); }); });
          this.ro.observe(cv);
        }
      }
      // assinatura no barramento do motor (cada on() devolve o unsubscribe)
      if (I().on){
        const sub = (ev, fn) => { const off = I().on(ev, fn); if (typeof off === 'function') this.subs.push(off); };
        sub('currency', p => this.onCurrency(p, game));
        sub('offline', p => this.onIdleOffline(p, game));
        sub('bonus', p => this.onBonus(p, game));
        sub('combo', p => this.setCombo(p && p.mult));
        sub('prestige', () => { this.setCombo(1); this.dirty = true; this.render(game, true); });
        sub('era', p => {
          this.dirty = true; this.render(game, true);
          // moradores novos: rolam para a vista e ficam marcados 'novo' por 30 s (em telas baixas ficariam abaixo da dobra)
          const ids = (p && p.gens) || []; let first = null;
          for (const id of ids){ const row = this.rows[id]; if (!row) continue; first = first || row.r; row.r.classList.add('novo'); clearTimeout(row.novoT); row.novoT = setTimeout(() => row.r.classList.remove('novo'), 30000); }
          if (first && this.tab === 'gens' && first.scrollIntoView) setTimeout(() => { try { first.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }, 350);
        });
        sub('buy', p => { this.flash(p && this.rows[p.id]); });
        sub('upgrade', p => {
          if (!p) return;
          if (p.auto) this.flash(this.rows[p.gen]); // marco automático (×1.5): acende a linha (o toast traz o ×N)
          else this.flash(this.upRows[p.id]);
        });
      }
      this.render(game, true);
    },
    // remove listeners do motor (re-init / troca de modo)
    unsubscribe(){
      for (const off of this.subs){ try { off(); } catch (e) {} }
      this.subs = [];
    },
    destroy(){ this.unsubscribe(); clearTimeout(this.hoverTimer); if (this.ro){ this.ro.disconnect(); this.ro = null; } },

    // HUD pequeno no canto do lago: anel + arco de combo · taxa · ×combo (o total vive no cabeçalho da loja)
    buildHud(){
      let h = document.getElementById('hud');
      if (!h){ h = el('div'); h.id = 'hud'; document.body.appendChild(h); }
      h.textContent = '';
      const ring = el('span', 'ring'); ring.appendChild(pathIcon(RING));
      const arc = document.createElementNS(SVG_NS, 'svg'); arc.setAttribute('viewBox', '0 0 24 24'); arc.setAttribute('class', 'combo');
      const c = document.createElementNS(SVG_NS, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '11');
      c.setAttribute('stroke-dasharray', '0 ' + COMBO_C); arc.appendChild(c); ring.appendChild(arc);
      this.comboArc = arc; this.comboCircle = c;
      h.appendChild(ring);
      this.rateEl = el('span', 'rate', '0/s'); this.comboEl = el('span', 'cmul', '');
      h.appendChild(this.rateEl); h.appendChild(this.comboEl);
      this.toast = el('div', 'toast'); this.toastIco = el('span', 'ico'); this.toastIco.appendChild(pathIcon(RING));
      this.toastTxt = el('span'); this.toast.appendChild(this.toastIco); this.toast.appendChild(this.toastTxt);
      h.appendChild(this.toast);
      h.addEventListener('pointerdown', e => e.stopPropagation());
      this.hud = h;
    },

    // Arco de combo: fração (mult-1)/(cap-1); dourado a partir de ×1.5
    setCombo(mult){
      mult = +mult || 1; this.comboMult = mult;
      if (this.comboEl) setText(this.comboEl, mult > 1 ? '×' + mult.toFixed(1) : '');
      // 1ª vez que o ritmo chega a ×1.5: toast único (stats.bonusSeen.combo)
      const s = st(this.game);
      if (mult >= 1.5 && s){
        s.stats = s.stats || {}; s.stats.bonusSeen = s.stats.bonusSeen || {};
        if (!s.stats.bonusSeen.combo && !LQ.Toasts){ s.stats.bonusSeen.combo = true; this.showToast(RING, bonusPhrase('combo', { mult: 1.5 }), 4); } // com LQ.Toasts o toast vem de idle/toasts.js
      }
      if (!this.comboCircle) return;
      const cap = (D().bonus && D().bonus.comboCap) || 2;
      const f = Math.max(0, Math.min(1, (mult - 1) / Math.max(0.01, cap - 1)));
      this.comboCircle.setAttribute('stroke-dasharray', (f * COMBO_C).toFixed(1) + ' ' + COMBO_C);
      this.comboArc.classList.toggle('hot', mult >= 1.5);
      this.comboArc.classList.toggle('on', f > 0);
    },

    // Loja: cabeçalho fixo (total · /s · por pedra · quantidade · abas) · corpo com scroll · rodapé (prestígio · falatório)
    buildShop(){
      let s = document.getElementById('shop');
      if (!s){ s = document.createElement('aside'); s.id = 'shop'; document.body.appendChild(s); }
      s.textContent = '';
      s.addEventListener('pointerdown', e => e.stopPropagation());
      s.addEventListener('pointerenter', () => { if (this.game.ui) this.game.ui.wake(); });
      // --- cabeçalho ---
      const head = el('div', 'sh-head');
      this.totalEl = el('div', 'total', '0'); head.appendChild(this.totalEl);
      this.rateBig = el('div', 'rate', '0/s'); head.appendChild(this.rateBig);
      this.clickEl = el('div', 'click', ''); head.appendChild(this.clickEl);
      const q = el('div', 'qty');
      [[1, 'x1'], [10, 'x10'], [100, 'x100'], ['max', 'max']].forEach(([v, t]) => {
        const b = el('button', 'seg', t); b.dataset.q = v;
        b.addEventListener('click', () => { this.qty = v; this.dirty = true; this.render(this.game, true); });
        q.appendChild(b);
      });
      head.appendChild(q); this.qtyEl = q;
      const tabs = el('div', 'tabs');
      const mk = (id, label) => {
        const b = el('button', 'tab', label); b.dataset.tab = id;
        const badge = el('span', 'badge', ''); b.appendChild(badge);
        b.addEventListener('click', () => { this.tab = id; this.dirty = true; this.render(this.game, true); });
        tabs.appendChild(b); return { b, badge };
      };
      this.tabGens = mk('gens', 'Moradores'); this.tabUps = mk('ups', 'Melhorias');
      head.appendChild(tabs);
      s.appendChild(head);
      // --- corpo ---
      const body = el('div', 'sh-body');
      this.list = el('div', 'gens'); body.appendChild(this.list);
      this.ups = el('div', 'ups'); body.appendChild(this.ups);
      this.upsEmpty = el('div', 'empty', 'Nenhuma melhoria à vista ainda. Junte mais ondas.'); this.ups.appendChild(this.upsEmpty);
      s.appendChild(body); this.body = body;
      // --- rodapé ---
      const foot = el('div', 'sh-foot');
      this.prest = el('button', 'prest'); this.prest.appendChild(pathIcon(NEWMOON)); this.prestTxt = el('span', null, 'Nova noite +0');
      this.prest.appendChild(this.prestTxt); this.prest.hidden = true;
      this.prest.addEventListener('click', () => { idleEmit('prestigeRequest', { pts: prestigePoints(this.game) }); });
      foot.appendChild(this.prest);
      // toggle "Falatório do lago" (state.idle.chatter, padrão ligado); chatter.js lê o estado
      const lab = el('label', 'chatter');
      const cb = document.createElement('input'); cb.type = 'checkbox';
      const sI = st(this.game); cb.checked = !sI || sI.chatter !== false;
      cb.addEventListener('change', () => { const ss = st(this.game); if (ss) ss.chatter = cb.checked; idleEmit('chatter', { on: cb.checked }); });
      lab.appendChild(cb); lab.appendChild(el('span', 'sw')); lab.appendChild(el('span', null, 'Falatório do lago'));
      foot.appendChild(lab); this.chatterCb = cb;
      s.appendChild(foot);
      // --- linhas por gerador ---
      // [ícone 36] nome ..................... x12 ›
      //            produz 7.2/s · 0.6/s cada
      //            ◎ 1.2K (×10) ........ faltam 1m20
      //            [barra 4px]
      //            próximo marco: 10 → ×1.5, texto (faltam 3)
      //            [marcos expandidos]
      this.rows = {}; this.upRows = {};
      for (const g of D().gens){
        const r = el('div', 'gen'); r.hidden = true;
        r.tabIndex = 0; r.setAttribute('role', 'button'); r.setAttribute('aria-label', g.name || g.id); // comprável por teclado
        r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); this.clickGen(g); } });
        r.addEventListener('focus', () => { if (this.game.ui) this.game.ui.wake(); });
        r.appendChild(icon(g.icon));
        const mid = el('div', 'mid');
        const top = el('div', 'top'); const name = el('span', 'name', g.name || g.id); const cnt = el('span', 'n', 'x0');
        const chev = el('button', 'chev'); chev.appendChild(pathIcon(CHEV)); chev.title = 'marcos'; chev.setAttribute('aria-label', 'marcos');
        chev.addEventListener('click', e => { e.stopPropagation(); this.pinId = this.pinId === g.id ? null : g.id; this.syncExpand(); });
        top.appendChild(name); top.appendChild(cnt); top.appendChild(chev);
        const prod = el('div', 'prod', '');
        const costL = el('div', 'costl');
        const cw = el('span', 'c'); cw.appendChild(pathIcon(RING)); const c = el('span', 'v', '0'); cw.appendChild(c); const q2 = el('span', 'q', ''); cw.appendChild(q2);
        const eta = el('span', 'eta', ''); costL.appendChild(cw); costL.appendChild(eta);
        const bar = el('div', 'bar'); const fill = el('i'); bar.appendChild(fill);
        const next = el('div', 'next', '');
        const ms = el('ul', 'ms');
        mid.appendChild(top); mid.appendChild(prod); mid.appendChild(costL); mid.appendChild(bar); mid.appendChild(next); mid.appendChild(ms); r.appendChild(mid);
        r.addEventListener('click', () => this.clickGen(g));
        // hover 250 ms (mouse) expande os marcos inline; sair recolhe (salvo se fixado pelo ›); pausa 1,5 s após compra
        r.addEventListener('pointerenter', e => {
          if (e.pointerType !== 'mouse') return;
          if (performance.now() - this.lastShopClick < 1500) return; // compra em sequência: a lista não pula sob o mouse
          clearTimeout(this.hoverTimer);
          this.hoverTimer = setTimeout(() => { this.hoverId = g.id; this.syncExpand(); }, HOVER_DELAY);
        });
        r.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse'){ clearTimeout(this.hoverTimer); if (this.hoverId === g.id){ this.hoverId = null; this.syncExpand(); } } });
        this.list.appendChild(r);
        this.rows[g.id] = { r, cnt, c, q: q2, eta, fill, prod, next, ms, msN: -1 };
      }
      // --- melhorias (grid 2 col): ícone · nome · desc (2 linhas) · custo ---
      for (const u of D().upgrades){
        if (u.kind === 'mult' || u.cost == null) continue; // mult automáticos: sem custo, o motor aplica
        const b = el('button', 'up'); b.hidden = true;
        b.appendChild(pathIcon(UPICON[u.kind] || UPICON.click));
        b.appendChild(el('span', 'name', u.name || u.id));
        b.appendChild(el('span', 'desc', u.desc || fxText(u)));
        const cw = el('span', 'c'); cw.appendChild(pathIcon(RING)); cw.appendChild(el('span', null, fmt(u.cost))); b.appendChild(cw);
        b.addEventListener('click', () => { if (buyUp(u, this.game)) { this.dirty = true; this.render(this.game, true); } });
        this.ups.appendChild(b); this.upRows[u.id] = { b };
      }
      this.shop = s;
    },

    // um gerador expandido por vez (fixado pelo › ou sob o mouse)
    syncExpand(){
      const id = this.pinId || this.hoverId;
      for (const k in this.rows){
        const row = this.rows[k], on = k === id;
        if (row.r.classList.contains('exp') !== on) row.r.classList.toggle('exp', on);
        if (on) this.fillMilestones(k);
      }
    },
    // lista de marcos: ✓ atingidos apagados · próximo em destaque · demais normais (reconstrói só se a contagem mudou)
    fillMilestones(id){
      const row = this.rows[id]; const s = st(this.game); if (!row || !s) return;
      const g = D().gens.find(x => x.id === id); if (!g) return;
      const n = s.gens[id] || 0; if (row.msN === n) return; row.msN = n;
      row.ms.textContent = '';
      const list = milestonesOf(g); const nx = list.find(m => m.at > n);
      for (const m of list){
        const li = el('li', m.at <= n ? 'done' : nx && m.at === nx.at ? 'nxt' : '');
        li.appendChild(el('span', 'at', (m.at <= n ? '✓ ' : '') + m.at));
        li.appendChild(el('span', 't', m.text));
        row.ms.appendChild(li);
      }
      if (!list.length) row.ms.appendChild(el('li', 'done', 'sem marcos'));
    },

    clickGen(g){
      this.lastShopClick = performance.now();
      const s = st(this.game); if (!s || (LQ.IdlePrestige && LQ.IdlePrestige.busy)) return;
      const n = s.gens[g.id] || 0;
      let q = this.qty === 'max' ? maxAffordable(g, n, s.cur) : this.qty;
      if (q < 1) return;
      if (buyGen(g, q, this.game)) { this.dirty = true; this.render(this.game, true); }
    },

    // realce breve de uma linha/botão após compra ou marco
    flash(row){
      const e = row && (row.r || row.b); if (!e) return;
      e.classList.add('hit');
      clearTimeout(e._hitT); e._hitT = setTimeout(() => e.classList.remove('hit'), 400);
    },
    spawnFloat(txt, x, y, gold){
      let best = null;
      for (const o of this.floats){ if (o.age >= 1){ best = o; break; } if (!best || o.age > best.age) best = o; } // livre, senão o mais velho
      if (!best) return;
      best.age = 0; best.txt = txt; best.x = x; best.y = y; best.gold = !!gold; this.dirty = true;
    },
    // toast curto: ícone (id de symbol ou path) + 1 frase, `sec` segundos
    // Um slot só: se já há um toast visível, o novo entra numa fila curta (≤3) e aparece quando o atual acabar.
    showToast(ico, txt, sec){
      // delega para a pilha LQ.Toasts (idle/toasts.js); fallback: slot antigo no HUD
      if (LQ.Toasts){ LQ.Toasts.show({ icon: ico || RING, title: txt, life: sec, kind: 'info' }); return; }
      if (!this.toast) return;
      if (this.toastT > 0 || this.toastGap > 0){
        if (this.toastQ.length < 3 && this.toastTxt.textContent !== txt && !this.toastQ.some(q => q[1] === txt)) this.toastQ.push([ico, txt, sec]);
        return;
      }
      this.toastIco.textContent = '';
      this.toastIco.appendChild(ico && ico.indexOf('ic-') === 0 ? icon(ico) : pathIcon(ico || RING));
      this.toastTxt.textContent = txt;
      this.toast.classList.add('show'); this.toastT = sec || 4;
      if (this.game && this.game.ui) this.game.ui.wake();
    },

    // Hooks do núcleo
    // loja não abre nem fecha (decisão: sempre visível, nunca sobre o lago) — o antigo toggle é inerte
    onShopToggle(){},
    onResize(game){ if (game && game.mode === 'idle'){ this.dirty = true; } },
    // Moeda ganha: floater "+N" (payload {x,y,amount}); também aceito via game.emit('currency')
    onCurrency(p, game){
      if (!game || game.mode !== 'idle' || !p) return;
      const a = p.amount != null ? p.amount : p.value; if (!(a > 0)) return;
      this.spawnFloat('+' + fmtGain(a, p.combo > 1), p.x != null ? p.x : 60, p.y != null ? p.y : 40);
    },
    // Bônus (peixe/brilho/cadente/lanterna): floater dourado "+N ✦" e toast na 1ª vez de cada tipo
    onBonus(p, game){
      if (!game || game.mode !== 'idle' || !p) return;
      const a = p.amount != null ? p.amount : p.value;
      if (a > 0) this.spawnFloat('+' + fmtGain(a) + ' ✦', p.x != null ? p.x : game.W / 2, p.y != null ? p.y : game.horizonY + 40, true);
      const s = st(game); if (!s || LQ.Toasts) return; // toast do 1º bônus: idle/toasts.js
      s.stats = s.stats || {}; s.stats.bonusSeen = s.stats.bonusSeen || {};
      const kind = p.kind || 'bonus';
      const key = kind === 'fish' && (p.racao || (p.mult >= 4 && hasUp('racao', game))) ? 'fish_racao' : kind;
      if (s.stats.bonusSeen[key]) return;
      s.stats.bonusSeen[key] = true;
      this.showToast(BONUS_ICON[key] || SPARK, bonusPhrase(key, p), 4);
    },
    // Ganho offline calculado pelo motor: {earned, seconds}
    onIdleOffline(p, game){
      if (!game || game.mode !== 'idle' || !p || !(p.earned > 0) || !this.toast || LQ.Toasts) return; // com LQ.Toasts: idle/toasts.js
      this.showToast(RING, '+' + fmt(p.earned) + ' enquanto você estava fora', 5);
    },

    update(dt, game){
      if (game.mode !== 'idle' || !this.hud) return;
      for (const f of this.floats) if (f.age < 1) f.age += dt / (f.gold ? FLOAT_LIFE_GOLD : FLOAT_LIFE);
      if (this.toastT > 0){ this.toastT -= dt; if (this.toastT <= 0){ this.toast.classList.remove('show'); this.toastGap = this.toastQ.length ? 0.5 : 0; } }
      else if (this.toastGap > 0){ this.toastGap -= dt; if (this.toastGap <= 0 && this.toastQ.length){ const q = this.toastQ.shift(); this.showToast(q[0], q[1], q[2]); } }
      this.throttle += dt;
      if (this.throttle >= 0.1){ this.throttle = 0; this.render(game, false); }
    },

    // Atualiza DOM (≤10×/s). `full` força reavaliação de visibilidade/qty/abas.
    render(game, full){
      const s = st(game); if (!s || !this.hud || !this.shop) return;
      const cur = s.cur || 0;
      const tr = totalRate(game); // inclui auto-cliques (o motor ganha com totalRate)
      setText(this.rateEl, fmtRate(tr) + '/s');
      // cabeçalho
      setText(this.totalEl, fmt(cur));
      setText(this.rateBig, fmtRate(tr) + '/s');
      const cp = clickPower(game), pct = clickPct(game);
      setText(this.clickEl, '+' + fmtGain(cp) + ' por pedra' + (pct > 0 ? ' (' + (pct >= 0.995 ? Math.round(pct * 100) : pct * 100 < 1 ? (pct * 100).toFixed(1) : Math.round(pct * 100)) + '% do lago)' : ''));
      if (full){
        for (const b of this.qtyEl.children) b.classList.toggle('on', String(this.qty) === b.dataset.q);
        this.tabGens.b.classList.toggle('on', this.tab === 'gens'); this.tabUps.b.classList.toggle('on', this.tab === 'ups');
        this.list.hidden = this.tab !== 'gens'; this.ups.hidden = this.tab !== 'ups';
      }
      // moradores: só os da era atual (ou já comprados)
      const e = era(game);
      for (const g of D().gens){
        const row = this.rows[g.id]; const n = s.gens[g.id] || 0;
        const vis = n > 0 || (g.era == null || g.era <= e);
        if (row.r.hidden !== !vis) row.r.hidden = !vis;
        if (!vis || this.tab !== 'gens') continue;
        let q = this.qty === 'max' ? Math.max(1, maxAffordable(g, n, cur)) : this.qty;
        const c = cost(g, n, q);
        const can = cur >= c;
        setText(row.cnt, 'x' + n); setText(row.c, fmt(c)); setText(row.q, q > 1 ? '×' + q : '');
        setText(row.eta, can ? '' : tr > 0 ? 'faltam ' + fmtTime((c - cur) / tr) : 'jogue pedras');
        const w = Math.min(100, cur / c * 100);
        if (Math.abs(w - (row.w || 0)) >= 0.5 || w === 100 && row.w !== 100){ row.w = w; row.fill.style.width = w.toFixed(1) + '%'; }
        row.r.classList.toggle('can', can);
        const per = genRate(g, game);
        setText(row.prod, n > 0 ? 'produz ' + fmtRate(genTotal(g, n, game)) + '/s · ' + fmtRate(per) + '/s cada' : 'produz ' + fmtRate(per) + '/s cada');
        if (row.msN !== n || full){
          const list = milestonesOf(g); const nx = list.find(m => m.at > n);
          setText(row.next, nx ? 'próximo marco: ' + nx.at + ' → ' + nx.text + ' (faltam ' + (nx.at - n) + ')' : list.length ? 'todos os marcos atingidos' : '');
          if (row.r.classList.contains('exp')) this.fillMilestones(g.id);
        }
      }
      // melhorias: a partir de 25% do custo, não possuídas, não presas a marco
      let badge = 0, anyUp = false;
      for (const u of D().upgrades){
        const ur = this.upRows[u.id]; if (!ur) continue;
        const owned = s.ups.indexOf(u.id) >= 0;
        const gated = u.gen && u.at != null && (s.gens[u.gen] || 0) < u.at; // upgrade preso a um marco do gerador
        const vis = !owned && !gated && cur >= UP_SHOW * u.cost;
        if (ur.b.hidden !== !vis) ur.b.hidden = !vis;
        if (vis){ anyUp = true; const can = cur >= u.cost; ur.b.classList.toggle('can', can); if (can) badge++; }
      }
      if (this.upsEmpty.hidden !== anyUp) this.upsEmpty.hidden = anyUp;
      setText(this.tabUps.badge, badge > 0 ? String(badge) : '');
      const pts = prestigePoints(game);
      if (this.prest.hidden !== (pts < 1)) this.prest.hidden = pts < 1;
      if (pts >= 1) setText(this.prestTxt, 'Nova noite +' + fmt(pts));
      if (this.chatterCb && full) this.chatterCb.checked = s.chatter !== false;
    },

    // Floaters na camada 'hud' — único fillText do jogo. Bônus: 17px dourado.
    draw(layer, ctx, game){
      if (layer !== 'hud' || game.mode !== 'idle') return;
      let any = false; for (const f of this.floats) if (f.age < 1){ any = true; break; }
      if (!any) return;
      ctx.save();
      // tema claro (ink: lightBlend 'multiply'): texto escuro com halo claro; senão claro com halo escuro
      const lightTheme = game.lightBlend === 'multiply';
      const base = lightTheme ? (game.palette.dark || '#1a1a1a') : game.palette.light;
      const gold = lightTheme ? '#7a4f00' : '#e8b04a'; // dourado legível em papel claro e em noite
      ctx.textAlign = 'center';
      ctx.shadowColor = lightTheme ? 'rgba(255,255,255,.9)' : 'rgba(5,9,20,.85)'; ctx.shadowBlur = 3; // contorno suave: legível sobre anéis
      let curGold = null;
      for (const f of this.floats){
        if (f.age >= 1) continue;
        if (curGold !== f.gold){ curGold = f.gold; ctx.font = (f.gold ? '600 17px' : '13px') + ' system-ui, sans-serif'; ctx.fillStyle = f.gold ? gold : base; }
        ctx.globalAlpha = 0.9 * (1 - f.age);
        ctx.fillText(f.txt, f.x, f.y - 18 - f.age * (f.gold ? 30 : 22));
      }
      ctx.restore();
    },
  };
  LQ.register('idle-hud', H);
  LQ.hud = H; // hook read-only p/ teste
})();
