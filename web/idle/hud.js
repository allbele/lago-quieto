// Lago Quieto — modo Idle: HUD (moeda + taxa), loja lateral, toast offline e floaters "+N".
// Só age em game.mode==='idle'. Usa LQ.Idle/LQ.IdleUtil quando existem; senão calcula a partir de LQ.IdleData.
window.LQ = window.LQ || {};
(function(){
  'use strict';
  const LQ = window.LQ;
  const D = () => LQ.IdleData || { gens: [], upgrades: [], clickBase: 1 };
  const U = () => LQ.IdleUtil || {};
  const I = () => LQ.Idle || {};

  // ---------- utilidades locais (fallbacks) ----------
  function fmt(n){
    if (U().fmt) return U().fmt(n);
    n = +n || 0; if (n < 1000) return String(Math.floor(n));
    const s = ['', 'K', 'M', 'B', 'T']; let i = 0;
    while (n >= 1000 && i < s.length - 1){ n /= 1000; i++; }
    return n >= 1e3 ? n.toExponential(1) : (n < 10 ? n.toFixed(1) : Math.floor(n)) + s[i];
  }
  function fmtRate(n){ n = +n || 0; return n < 10 && n > 0 ? n.toFixed(1) : fmt(n); }
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
  const idleEmit = (n, p) => { if (I().emit) I().emit(n, p); };
  // texto do floater: frações (lírio/sapo valem 0.5) mostram 1 decimal em vez de "+0"
  const fmtGain = a => a < 1 ? a.toFixed(1) : fmt(a);
  const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; }; // evita invalidar estilo sem mudança
  const HINT_KEY = 'lagoquieto.idle.shopSeen';
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
  const UPICON = { click: 'M13 2.5L5 13.5h6l-1 8 9-11.5h-6l1-7.5z', auto: 'M12 4a8 8 0 1 1-6 2.7|M6 3v4h4', offline: 'M12 6v6l4 2|M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18' };
  function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  // ---------- entidade ----------
  const H = {
    hud: null, shop: null, list: null, ups: null, prest: null, toast: null,
    qty: 1, open: false, throttle: 0, toastT: 0, dirty: true,
    rows: {}, upRows: {},
    floats: [], // pool de floaters
    game: null,

    init(game){
      this.game = game;
      if (game.mode !== 'idle') return;
      this.floats = []; for (let i = 0; i < 24; i++) this.floats.push({ age: 1, x: 0, y: 0, txt: '' });
      this.buildHud(); this.buildShop();
      // assinatura opcional no barramento do motor
      if (I().on){
        I().on('currency', p => this.onCurrency(p, game));
        I().on('offline', p => this.onIdleOffline(p, game));
        I().on('buy', p => this.flash(p && this.rows[p.id]));
        I().on('upgrade', p => {
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

    buildHud(){
      let h = document.getElementById('hud');
      if (!h){ h = el('div'); h.id = 'hud'; document.body.appendChild(h); }
      h.textContent = '';
      h.appendChild(pathIcon(RING));
      this.curEl = el('span', 'cur', '0'); this.rateEl = el('span', 'rate', '0/s');
      h.appendChild(this.curEl); h.appendChild(this.rateEl);
      this.toast = el('div', 'toast'); this.toast.appendChild(pathIcon(RING)); this.toastTxt = el('span'); this.toast.appendChild(this.toastTxt);
      h.appendChild(this.toast);
      h.addEventListener('pointerdown', e => e.stopPropagation());
      this.hud = h;
    },

    buildShop(){
      let s = document.getElementById('shop');
      if (!s){ s = document.createElement('aside'); s.id = 'shop'; document.body.appendChild(s); }
      s.textContent = '';
      s.addEventListener('pointerdown', e => e.stopPropagation());
      s.addEventListener('pointerenter', () => { if (this.game.ui) this.game.ui.wake(); });
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
      for (const g of D().gens){
        const r = el('div', 'gen'); r.hidden = true;
        r.appendChild(icon(g.icon));
        const mid = el('div', 'mid');
        const top = el('div', 'top'); const cnt = el('span', 'n', '0');
        const cw = el('span', 'c'); cw.appendChild(pathIcon(RING)); const c = el('span', null, '0'); cw.appendChild(c); // anel = custo
        top.appendChild(cnt); top.appendChild(cw);
        const bar = el('div', 'bar'); const fill = el('i'); bar.appendChild(fill);
        const per = el('span', 'per', '');
        mid.appendChild(top); mid.appendChild(bar); mid.appendChild(per); r.appendChild(mid);
        r.addEventListener('click', () => this.clickGen(g));
        this.list.appendChild(r);
        this.rows[g.id] = { r, cnt, c, fill, per };
      }
      for (const u of D().upgrades){
        if (u.kind === 'mult' || u.cost == null) continue; // mult automáticos: sem custo, o motor aplica
        const b = el('button', 'up'); b.hidden = true;
        b.appendChild(pathIcon(UPICON[u.kind] || UPICON.click));
        // efeito sem texto: ×2 (clique), +1/s (auto), 12h (offline)
        const fx = u.kind === 'click' ? '×' + u.value : u.kind === 'auto' ? '+' + u.value + '/s' : u.value + 'h';
        b.appendChild(el('span', 'fx', fx));
        const c = el('span', 'c', fmt(u.cost)); b.appendChild(c);
        b.addEventListener('click', () => { if (buyUp(u, this.game)) { this.dirty = true; this.render(this.game, true); } });
        this.ups.appendChild(b); this.upRows[u.id] = { b };
      }
      this.shop = s;
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
    spawnFloat(txt, x, y){
      let best = null;
      for (const o of this.floats){ if (o.age >= 1){ best = o; break; } if (!best || o.age > best.age) best = o; } // livre, senão o mais velho
      if (!best) return;
      best.age = 0; best.txt = txt; best.x = x; best.y = y; this.dirty = true;
    },
    // dica de descoberta: enquanto a loja nunca foi aberta e há algo comprável, segura a barra e pulsa o ícone
    hint(on){
      const b = document.getElementById('btn-shop'); if (!b) return;
      if (on){ if (this.game.ui) this.game.ui.wake(); }
      if (b.classList.contains('hint') !== on) b.classList.toggle('hint', on);
    },

    // Hooks do núcleo
    onShopToggle(_, game){
      if (game.mode !== 'idle' || !this.shop) return;
      this.open = !this.open;
      if (!shopSeen){ shopSeen = true; this.hint(false); try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {} }
      this.shop.classList.toggle('open', this.open);
      if (game.ui){ game.ui.pinned = this.open; game.ui.wake(); }
      if (this.open) this.render(game, true);
    },
    // Moeda ganha: floater "+N" (payload {x,y,amount}); também aceito via game.emit('currency')
    onCurrency(p, game){
      if (!game || game.mode !== 'idle' || !p) return;
      const a = p.amount != null ? p.amount : p.value; if (!(a > 0)) return;
      this.spawnFloat('+' + fmtGain(a), p.x != null ? p.x : 60, p.y != null ? p.y : 40);
    },
    // Ganho offline calculado pelo motor: {earned, seconds}
    onIdleOffline(p, game){
      if (!game || game.mode !== 'idle' || !p || !(p.earned > 0) || !this.toast) return;
      this.toastTxt.textContent = '+' + fmt(p.earned);
      this.toast.classList.add('show'); this.toastT = 5;
      if (game.ui) game.ui.wake();
    },

    update(dt, game){
      if (game.mode !== 'idle' || !this.hud) return;
      for (const f of this.floats) if (f.age < 1) f.age += dt / 1.1;
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
        setText(row.cnt, String(n)); setText(row.c, fmt(c));
        const w = Math.min(100, cur / c * 100);
        if (Math.abs(w - (row.w || 0)) >= 0.5 || w === 100 && row.w !== 100){ row.w = w; row.fill.style.width = w.toFixed(1) + '%'; }
        row.r.classList.toggle('can', cur >= c);
        setText(row.per, fmtRate(genRate(g, game)) + '/s');
      }
      for (const u of D().upgrades){
        const ur = this.upRows[u.id]; if (!ur) continue;
        const owned = s.ups.indexOf(u.id) >= 0;
        const vis = !owned && cur >= 0.5 * u.cost;
        if (ur.b.hidden !== !vis) ur.b.hidden = !vis;
        if (vis) ur.b.classList.toggle('can', cur >= u.cost);
      }
      const pts = prestigePoints(game);
      if (this.prest.hidden !== (pts < 1)) this.prest.hidden = pts < 1;
      if (pts >= 1) setText(this.prestTxt, '+' + fmt(pts));
    },

    // Floaters na camada 'hud' — único fillText do jogo
    draw(layer, ctx, game){
      if (layer !== 'hud' || game.mode !== 'idle') return;
      let any = false; for (const f of this.floats) if (f.age < 1){ any = true; break; }
      if (!any) return;
      ctx.save();
      ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = game.palette.light;
      ctx.shadowColor = 'rgba(5,9,20,.8)'; ctx.shadowBlur = 3; // contorno suave: legível sobre anéis claros
      for (const f of this.floats){
        if (f.age >= 1) continue;
        ctx.globalAlpha = 0.75 * (1 - f.age);
        ctx.fillText(f.txt, f.x, f.y - 18 - f.age * 22);
      }
      ctx.restore();
    },
  };
  LQ.register('idle-hud', H);
})();
