// Lago Quieto — modo Idle: HUD (moeda + taxa + arco de combo), loja lateral legível (nome, frase, marcos em card),
// toasts (offline / 1º bônus de cada tipo) e floaters "+N" (bônus em dourado).
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
  // Taxa por unidade (com upgrades mult daquele gerador)
  function genRate(g, game){
    if (I().genRate) return I().genRate(g.id);
    const s = st(game); let m = 1;
    if (s) for (const u of D().upgrades) if (u.gen === g.id && u.kind === 'mult' && s.ups.indexOf(u.id) >= 0) m *= u.value;
    return g.rate * m;
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
  const HINT_KEY = 'lagoquieto.idle.shopSeen';
  const HINT_HOLD = 10;     // s que a dica segura a barra visível (por sessão)
  const FLOAT_LIFE = 1.4;   // s de vida do floater "+N"
  const FLOAT_LIFE_GOLD = 2; // bônus dura mais (é raro; merece ser lido)
  const LONG_PRESS = 400;   // ms de toque para abrir o card no celular
  const HOVER_DELAY = 250;  // ms de mouse parado antes do card
  const COMBO_C = 69.1;     // circunferência do arco (r=11 em viewBox 24)
  let shopSeen = false; try { shopSeen = localStorage.getItem(HINT_KEY) === '1'; } catch (e) {}

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
  const UPICON = { click: 'M13 2.5L5 13.5h6l-1 8 9-11.5h-6l1-7.5z', auto: 'M12 4a8 8 0 1 1-6 2.7|M6 3v4h4', offline: 'M12 6v6l4 2|M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', racao: 'M7 12a1.5 1.5 0 1 0 0 .01|M12 9a1.5 1.5 0 1 0 0 .01|M17 12a1.5 1.5 0 1 0 0 .01|M12 15a1.5 1.5 0 1 0 0 .01' };
  // ícone do toast por tipo de bônus (id de <symbol> ou path)
  const BONUS_ICON = { fish: 'ic-fish', fish_racao: 'ic-goldfish', glint: SPARK, shooting: 'ic-shooting', combo: RING };
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
    if (key === 'combo') return 'Ritmo! Pedras em cadência ×' + (m || 1.5);
    return 'Bônus! +' + fmt(amt || 0);
  }

  // ---------- entidade ----------
  const H = {
    hud: null, shop: null, list: null, ups: null, prest: null, toast: null, card: null,
    qty: 1, open: false, throttle: 0, toastT: 0, dirty: true, hintT: 0, hintOn: false,
    rows: {}, upRows: {}, cardFor: null, lpTimer: 0, hoverTimer: 0, comboMult: 1,
    subs: [],   // unsubscribes do barramento do motor
    floats: [], // pool de floaters
    game: null,

    init(game){
      this.game = game;
      this.unsubscribe();
      if (game.mode !== 'idle') return;
      this.floats = []; for (let i = 0; i < 24; i++) this.floats.push({ age: 1, x: 0, y: 0, txt: '', gold: false });
      this.buildHud(); this.buildShop(); this.buildCard();
      // assinatura no barramento do motor (cada on() devolve o unsubscribe)
      if (I().on){
        const sub = (ev, fn) => { const off = I().on(ev, fn); if (typeof off === 'function') this.subs.push(off); };
        sub('currency', p => this.onCurrency(p, game));
        sub('offline', p => this.onIdleOffline(p, game));
        sub('bonus', p => this.onBonus(p, game));
        sub('combo', p => this.setCombo(p && p.mult));
        sub('prestige', () => this.setCombo(1));
        sub('buy', p => { this.flash(p && this.rows[p.id]); if (this.cardFor && this.cardFor.id === (p && p.id)) this.fillCard(); });
        sub('upgrade', p => {
          if (!p) return;
          if (p.auto){ // marco automático (×2): acende a linha do gerador e solta um floater "×2" sobre ela
            const row = this.rows[p.gen]; this.flash(row);
            if (row && this.open && !row.r.hidden){
              const b = row.r.getBoundingClientRect();
              this.spawnFloat('×' + (p.value || 2), b.left + b.width / 2, b.top + b.height / 2 + 18);
            }
          } else this.flash(this.upRows[p.id]);
        });
      }
      this.render(game, true);
    },
    // remove listeners do motor (re-init / troca de modo)
    unsubscribe(){
      for (const off of this.subs){ try { off(); } catch (e) {} }
      this.subs = [];
    },
    destroy(){ this.unsubscribe(); clearTimeout(this.lpTimer); clearTimeout(this.hoverTimer); this.hideCard(); },

    buildHud(){
      let h = document.getElementById('hud');
      if (!h){ h = el('div'); h.id = 'hud'; document.body.appendChild(h); }
      h.textContent = '';
      // ícone do anel + arco fino de combo por cima (stroke-dasharray = fração do combo)
      const ring = el('span', 'ring'); ring.appendChild(pathIcon(RING));
      const arc = document.createElementNS(SVG_NS, 'svg'); arc.setAttribute('viewBox', '0 0 24 24'); arc.setAttribute('class', 'combo');
      const c = document.createElementNS(SVG_NS, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '11');
      c.setAttribute('stroke-dasharray', '0 ' + COMBO_C); arc.appendChild(c); ring.appendChild(arc);
      this.comboArc = arc; this.comboCircle = c;
      h.appendChild(ring);
      this.curEl = el('span', 'cur', '0'); this.rateEl = el('span', 'rate', '0/s'); this.comboEl = el('span', 'cmul', '');
      h.appendChild(this.curEl); h.appendChild(this.rateEl); h.appendChild(this.comboEl);
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
        if (!s.stats.bonusSeen.combo){ s.stats.bonusSeen.combo = true; this.showToast(RING, bonusPhrase('combo', { mult: 1.5 }), 4); }
      }
      if (!this.comboCircle) return;
      const cap = (D().bonus && D().bonus.comboCap) || 2;
      const f = Math.max(0, Math.min(1, (mult - 1) / Math.max(0.01, cap - 1)));
      this.comboCircle.setAttribute('stroke-dasharray', (f * COMBO_C).toFixed(1) + ' ' + COMBO_C);
      this.comboArc.classList.toggle('hot', mult >= 1.5);
      this.comboArc.classList.toggle('on', f > 0);
    },

    buildShop(){
      let s = document.getElementById('shop');
      if (!s){ s = document.createElement('aside'); s.id = 'shop'; document.body.appendChild(s); }
      s.textContent = '';
      s.addEventListener('pointerdown', e => e.stopPropagation());
      s.addEventListener('pointerenter', () => { if (this.game.ui) this.game.ui.wake(); });
      s.addEventListener('scroll', () => this.hideCard(), { passive: true });
      // seletor x1 / x10 / max (3 pontos)
      const q = el('div', 'qty');
      [[1, '1'], [10, '10'], ['max', 'max']].forEach(([v, t]) => {
        const b = el('button', 'dot', t); b.dataset.q = v; b.title = 'x' + t;
        b.addEventListener('click', () => { this.qty = v; this.dirty = true; this.render(this.game, true); });
        q.appendChild(b);
      });
      s.appendChild(q); this.qtyEl = q;
      this.list = el('div', 'gens'); s.appendChild(this.list);
      this.ups = el('div', 'ups'); s.appendChild(this.ups);
      this.prest = el('button', 'prest'); this.prest.appendChild(pathIcon(NEWMOON)); this.prestTxt = el('span', null, '+0');
      this.prest.appendChild(this.prestTxt); this.prest.hidden = true;
      this.prest.addEventListener('click', () => { idleEmit('prestigeRequest', { pts: prestigePoints(this.game) }); });
      s.appendChild(this.prest);
      // linhas por gerador (todas criadas, ocultas até serem "compráveis alguma vez")
      // [ícone] nome ............ contagem
      //         frase curta (o que muda)
      //         [barra de progresso até o custo]
      //         taxa/un ............ ◎ custo
      this.rows = {}; this.upRows = {};
      for (const g of D().gens){
        const r = el('div', 'gen'); r.hidden = true;
        r.appendChild(icon(g.icon));
        const mid = el('div', 'mid');
        const top = el('div', 'top'); const name = el('span', 'name', g.name || g.id); const cnt = el('span', 'n', '0');
        top.appendChild(name); top.appendChild(cnt);
        const desc = el('div', 'desc', g.desc || '');
        const bar = el('div', 'bar'); const fill = el('i'); bar.appendChild(fill);
        const bot = el('div', 'bot'); const per = el('span', 'per', '');
        const cw = el('span', 'c'); const q = el('span', 'q', ''); cw.appendChild(q); cw.appendChild(pathIcon(RING)); const c = el('span', null, '0'); cw.appendChild(c); // anel = custo; q = "×10"/"×N" quando qty≠1
        bot.appendChild(per); bot.appendChild(cw);
        mid.appendChild(top); mid.appendChild(desc); mid.appendChild(bar); mid.appendChild(bot); r.appendChild(mid);
        r.addEventListener('click', () => { if (r._lp){ r._lp = false; return; } this.clickGen(g); }); // toque longo não compra
        this.bindCard(r, { type: 'gen', id: g.id, g });
        this.list.appendChild(r);
        this.rows[g.id] = { r, cnt, c, fill, per, q };
      }
      for (const u of D().upgrades){
        if (u.kind === 'mult' || u.cost == null) continue; // mult automáticos: sem custo, o motor aplica
        const b = el('button', 'up'); b.hidden = true;
        b.appendChild(pathIcon(UPICON[u.kind] || UPICON.click));
        b.appendChild(el('span', 'name', u.name || u.id));
        b.appendChild(el('span', 'fx', fxText(u)));
        const cw = el('span', 'c'); cw.appendChild(pathIcon(RING)); cw.appendChild(el('span', null, fmt(u.cost))); b.appendChild(cw);
        b.addEventListener('click', () => { if (b._lp){ b._lp = false; return; } if (buyUp(u, this.game)) { this.hideCard(); this.dirty = true; this.render(this.game, true); } });
        this.bindCard(b, { type: 'up', id: u.id, u });
        this.ups.appendChild(b); this.upRows[u.id] = { b };
      }
      this.shop = s;
    },

    // ---------- card de marcos (hover 250 ms no desktop, toque longo no celular) ----------
    buildCard(){
      let c = document.getElementById('shop-card');
      if (!c){ c = el('div'); c.id = 'shop-card'; document.body.appendChild(c); }
      c.textContent = ''; c.hidden = true;
      c.addEventListener('pointerdown', e => e.stopPropagation());
      this.card = c;
      // toque fora fecha o card (celular) — registrado uma vez
      if (!this._docDown){
        this._docDown = e => { if (this.cardFor && !this.card.contains(e.target) && !(this.cardFor.el && this.cardFor.el.contains(e.target))) this.hideCard(); };
        document.addEventListener('pointerdown', this._docDown, true);
      }
    },
    bindCard(elm, info){
      info.el = elm;
      elm.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(this.hoverTimer);
        this.hoverTimer = setTimeout(() => this.showCard(info), HOVER_DELAY); // só após 250 ms parado
      });
      elm.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse'){ clearTimeout(this.hoverTimer); this.hideCard(); } });
      elm.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') return;
        clearTimeout(this.lpTimer);
        this.lpTimer = setTimeout(() => { elm._lp = true; this.showCard(info); }, LONG_PRESS);
      });
      const cancel = () => clearTimeout(this.lpTimer);
      elm.addEventListener('pointerup', cancel); elm.addEventListener('pointercancel', cancel); elm.addEventListener('pointerleave', cancel);
    },
    showCard(info){
      if (!this.card || !this.open) return;
      this.cardFor = info; this.fillCard(); this.placeCard();
    },
    hideCard(){ if (!this.card) return; this.cardFor = null; this.card.hidden = true; },
    // conteúdo: nome, frase e lista de marcos (✓ atingidos apagados · próximo em destaque · demais normais)
    fillCard(){
      const info = this.cardFor, c = this.card; if (!info || !c) return;
      c.textContent = '';
      const s = st(this.game);
      if (info.type === 'gen'){
        const g = info.g, n = (s && s.gens[g.id]) || 0;
        c.appendChild(el('div', 'h', g.name || g.id));
        if (g.desc) c.appendChild(el('div', 'd', g.desc));
        // marcos do gerador + marcos automáticos ×2 (upgrades kind mult), unidos por contagem
        const byAt = {};
        for (const m of (g.milestones || [])) if (m && m.at != null) byAt[m.at] = (byAt[m.at] ? byAt[m.at] + ' · ' : '') + m.text;
        for (const u of D().upgrades) if (u.kind === 'mult' && u.gen === g.id && u.at != null) byAt[u.at] = (byAt[u.at] ? byAt[u.at] + ' · ' : '') + '×' + u.value + ' produção';
        const ats = Object.keys(byAt).map(Number).sort((a, b) => a - b);
        const next = ats.find(a => a > n);
        const ul = el('ul', 'ms');
        for (const a of ats){
          const li = el('li', a <= n ? 'done' : a === next ? 'next' : '');
          li.appendChild(el('span', 'at', (a <= n ? '✓ ' : '') + a));
          li.appendChild(el('span', 't', byAt[a]));
          ul.appendChild(li);
        }
        if (ats.length) c.appendChild(ul);
        c.appendChild(el('div', 'f', n + ' · ' + fmtRate(genRate(g, this.game)) + '/s cada'));
      } else {
        const u = info.u;
        c.appendChild(el('div', 'h', u.name || u.id));
        if (u.desc) c.appendChild(el('div', 'd', u.desc));
        c.appendChild(el('div', 'f', 'efeito: ' + fxText(u) + (hasUp(u.id, this.game) ? ' · já ativo' : '')));
      }
      c.hidden = false;
    },
    // à esquerda da linha; se não cabe (loja em tela cheia), abaixo dela; sempre dentro da viewport
    placeCard(){
      const info = this.cardFor, c = this.card; if (!info || !c || c.hidden) return;
      const r = info.el.getBoundingClientRect(), W = window.innerWidth, Hh = window.innerHeight, pad = 8;
      const cw = c.offsetWidth, ch = c.offsetHeight;
      let x = r.left - cw - pad, y = r.top;
      if (x < pad){ x = Math.max(pad, Math.min(W - cw - pad, r.left)); y = r.bottom + 4; if (y + ch > Hh - pad) y = r.top - ch - 4; }
      y = Math.max(pad, Math.min(Hh - ch - pad, y));
      c.style.left = Math.round(x) + 'px'; c.style.top = Math.round(y) + 'px';
    },

    clickGen(g){
      const s = st(this.game); if (!s) return;
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
    // dica de descoberta: enquanto a loja nunca foi aberta e há algo comprável, segura a barra e pulsa o ícone
    // (segura a barra só por HINT_HOLD s por sessão — depois o lago volta a ficar limpo; o ícone segue pulsando ao acordar)
    hint(on){
      const b = document.getElementById('btn-shop'); if (!b) return;
      this.hintOn = on;
      if (on && this.hintT < HINT_HOLD){ if (this.game.ui) this.game.ui.wake(); }
      if (on && !this.hintToasted){ this.hintToasted = true; this.showToast(RING, 'Já dá para acordar o lago: toque no anel da barra', 6); }
      if (b.classList.contains('hint') !== on) b.classList.toggle('hint', on);
    },
    // toast curto: ícone (id de symbol ou path) + 1 frase, `sec` segundos
    showToast(ico, txt, sec){
      if (!this.toast) return;
      this.toastIco.textContent = '';
      this.toastIco.appendChild(ico && ico.indexOf('ic-') === 0 ? icon(ico) : pathIcon(ico || RING));
      this.toastTxt.textContent = txt;
      this.toast.classList.add('show'); this.toastT = sec || 4;
      if (this.game && this.game.ui) this.game.ui.wake();
    },

    // Hooks do núcleo
    onShopToggle(_, game){
      if (game.mode !== 'idle' || !this.shop) return;
      this.open = !this.open;
      if (!shopSeen){ shopSeen = true; this.hint(false); try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {} }
      this.shop.classList.toggle('open', this.open);
      if (!this.open) this.hideCard();
      if (game.ui){ game.ui.pinned = this.open; game.ui.wake(); }
      if (this.open) this.render(game, true);
    },
    // o núcleo chama call('onResize', game): game é o 1º argumento
    onResize(game){ if (game && game.mode === 'idle') this.placeCard(); },
    // Moeda ganha: floater "+N" (payload {x,y,amount}); também aceito via game.emit('currency')
    onCurrency(p, game){
      if (!game || game.mode !== 'idle' || !p) return;
      const a = p.amount != null ? p.amount : p.value; if (!(a > 0)) return;
      this.spawnFloat('+' + fmtGain(a, p.combo > 1), p.x != null ? p.x : 60, p.y != null ? p.y : 40);
    },
    // Bônus (peixe/brilho/cadente): floater dourado "+N ✦" e toast na 1ª vez de cada tipo
    onBonus(p, game){
      if (!game || game.mode !== 'idle' || !p) return;
      const a = p.amount != null ? p.amount : p.value;
      if (a > 0) this.spawnFloat('+' + fmtGain(a) + ' ✦', p.x != null ? p.x : game.W / 2, p.y != null ? p.y : game.horizonY + 40, true);
      const s = st(game); if (!s) return;
      s.stats = s.stats || {}; s.stats.bonusSeen = s.stats.bonusSeen || {};
      const kind = p.kind || 'bonus';
      const key = kind === 'fish' && (p.racao || (p.mult >= 4 && hasUp('racao', game))) ? 'fish_racao' : kind;
      if (s.stats.bonusSeen[key]) return;
      s.stats.bonusSeen[key] = true;
      this.showToast(BONUS_ICON[key] || SPARK, bonusPhrase(key, p), 4);
    },
    // Ganho offline calculado pelo motor: {earned, seconds}
    onIdleOffline(p, game){
      if (!game || game.mode !== 'idle' || !p || !(p.earned > 0) || !this.toast) return;
      this.showToast(RING, '+' + fmt(p.earned), 5);
    },

    update(dt, game){
      if (game.mode !== 'idle' || !this.hud) return;
      for (const f of this.floats) if (f.age < 1) f.age += dt / (f.gold ? FLOAT_LIFE_GOLD : FLOAT_LIFE);
      if (this.hintOn) this.hintT += dt;
      if (this.toastT > 0){ this.toastT -= dt; if (this.toastT <= 0) this.toast.classList.remove('show'); }
      this.throttle += dt;
      if (this.throttle >= 0.1){ this.throttle = 0; this.render(game, false); }
    },

    // Atualiza DOM (≤10×/s). `full` força reavaliação de visibilidade/qty.
    render(game, full){
      const s = st(game); if (!s || !this.hud) return;
      const cur = s.cur || 0;
      const r = I().totalRate ? I().totalRate() : rate(game); // inclui auto-cliques (o motor ganha com totalRate)
      setText(this.curEl, fmt(cur));
      setText(this.rateEl, fmtRate(r) + '/s');
      // dica da loja: só até a 1ª abertura, quando algo já é comprável
      if (!shopSeen && !this.open){
        let can = false;
        for (const g of D().gens){ if (cur >= cost(g, s.gens[g.id] || 0, 1)){ can = true; break; } }
        this.hint(can);
      }
      if (!this.open && !full) return;
      for (const b of this.qtyEl.children) b.classList.toggle('on', String(this.qty) === b.dataset.q);
      for (const g of D().gens){
        const row = this.rows[g.id]; const n = s.gens[g.id] || 0;
        const vis = n > 0 || cur >= 0.5 * cost(g, n, 1);
        if (row.r.hidden !== !vis) row.r.hidden = !vis;
        if (!vis) continue;
        let q = this.qty === 'max' ? Math.max(1, maxAffordable(g, n, cur)) : this.qty;
        const c = cost(g, n, q);
        setText(row.cnt, String(n)); setText(row.c, fmt(c)); setText(row.q, q > 1 ? '×' + q : '');
        const w = Math.min(100, cur / c * 100);
        if (Math.abs(w - (row.w || 0)) >= 0.5 || w === 100 && row.w !== 100){ row.w = w; row.fill.style.width = w.toFixed(1) + '%'; }
        row.r.classList.toggle('can', cur >= c);
        setText(row.per, fmtRate(genRate(g, game)) + '/s');
      }
      for (const u of D().upgrades){
        const ur = this.upRows[u.id]; if (!ur) continue;
        const owned = s.ups.indexOf(u.id) >= 0;
        const gated = u.gen && u.at != null && (s.gens[u.gen] || 0) < u.at; // upgrade preso a um marco do gerador
        const vis = !owned && !gated && cur >= 0.5 * u.cost;
        if (ur.b.hidden !== !vis) ur.b.hidden = !vis;
        if (vis) ur.b.classList.toggle('can', cur >= u.cost);
      }
      const pts = prestigePoints(game);
      if (this.prest.hidden !== (pts < 1)) this.prest.hidden = pts < 1;
      if (pts >= 1) setText(this.prestTxt, '+' + fmt(pts));
      if (full && this.cardFor) this.placeCard(); // linhas podem ter aparecido/sumido acima do card
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
