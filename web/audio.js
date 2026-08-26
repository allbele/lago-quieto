/* Lago Quieto — áudio (WebAudio, tudo sintetizado). Não conhece o jogo. */
(function () {
  'use strict';
  var LQ = window.LQ = window.LQ || {};

  var MAX_VOICES = 8;      // teto de vozes simultâneas
  var MIN_NOTE_GAP = 0.08; // 80 ms entre notas
  var PENTA = [0, 2, 4, 7, 9]; // C D E G A (semitons)
  var C4 = 261.6256;

  var ctx = null;
  var master, comp, dry, wet, conv, lowpass, themeShelf, themeHP, percBus;
  var muted = false, theme = 'night', fogOpen = false;
  var voices = [];
  var lastNote = -1;
  var amb = null; // nós do ambiente
  var ambState = { moon: false, aurora: false, fogOpen: false, crickets: true, wind: 0, rain: false };

  // ---------- utilitários ----------
  function now() { return ctx ? ctx.currentTime : 0; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function cents(f, c) { return f * Math.pow(2, c / 1200); }

  // nota pentatônica: degree 0..4 (+ oitavas por transbordo), oct 3|4
  function freqOf(degree, oct) {
    var d = Math.floor(degree);
    var o = Math.floor(d / 5), k = ((d % 5) + 5) % 5;
    return C4 * Math.pow(2, (oct - 4) + o + PENTA[k] / 12);
  }
  // x → grau, y → oitava (mais fundo = mais grave)
  function noteFor(x, y) {
    x = clamp(x == null ? 0.5 : x, 0, 0.999);
    y = clamp(y == null ? 0.5 : y, 0, 1);
    return freqOf(Math.floor(x * 5), y > 0.5 ? 3 : 4);
  }

  function panner(x) {
    var p;
    if (ctx.createStereoPanner) {
      p = ctx.createStereoPanner();
      p.pan.value = clamp(((x == null ? 0.5 : x) - 0.5) * 1.4, -1, 1);
    } else {
      p = ctx.createGain();
    }
    return p;
  }

  // ---------- pool de vozes ----------
  function reap() {
    var t = now();
    for (var i = voices.length - 1; i >= 0; i--) if (voices[i].end <= t) voices.splice(i, 1);
  }
  function steal() {
    var v = voices.shift(), t = now(); // mais antiga
    try {
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(v.g.gain.value, t);
      v.g.gain.linearRampToValueAtTime(0, t + 0.03);
      for (var i = 0; i < v.srcs.length; i++) try { v.srcs[i].stop(t + 0.04); } catch (e) {}
    } catch (e) {}
  }
  // cria voz: gain → (pan) → destino. dur em segundos.
  function mkVoice(dur, dest, x) {
    reap();
    while (voices.length >= MAX_VOICES) steal();
    var g = ctx.createGain();
    g.gain.value = 0;
    var out = g;
    if (x != null) { var p = panner(x); g.connect(p); out = p; }
    out.connect(dest || master);
    var v = { g: g, t0: now(), end: now() + dur, srcs: [] };
    v.add = function (src, at) {
      src.start(at == null ? v.t0 : at);
      src.stop(v.end + 0.05);
      v.srcs.push(src);
      return src;
    };
    voices.push(v);
    return v;
  }
  function osc(type, f, t) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t == null ? now() : t);
    return o;
  }

  // ---------- buffers ----------
  var noiseBuf = null, pinkBuf = null;
  function whiteNoise() {
    if (noiseBuf) return noiseBuf;
    var n = ctx.sampleRate, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  // branco por 3 lowpass em cascata (1-polo) → rosa aproximado
  function pinkNoise() {
    if (pinkBuf) return pinkBuf;
    var n = ctx.sampleRate * 4, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c), y1 = 0, y2 = 0, y3 = 0, a = 0.12, peak = 0;
      for (var i = 0; i < n; i++) {
        var w = Math.random() * 2 - 1;
        y1 += a * (w - y1); y2 += a * (y1 - y2); y3 += a * (y2 - y3);
        d[i] = y3; if (Math.abs(y3) > peak) peak = Math.abs(y3);
      }
      var k = peak > 0 ? 0.9 / peak : 1;
      for (i = 0; i < n; i++) d[i] *= k;
      // suaviza a costura do loop
      var f = Math.min(2048, n >> 2);
      for (i = 0; i < f; i++) { var m = i / f; d[i] *= m; d[n - 1 - i] *= m; }
    }
    return (pinkBuf = b);
  }
  // IR sintética: ruído branco × exp(−t/0.6), 2.5 s
  function makeIR() {
    var sr = ctx.sampleRate, n = Math.floor(sr * 2.5), b = ctx.createBuffer(2, n, sr);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-(i / sr) / 0.6);
    }
    return b;
  }
  function weakCPU() {
    var hc = navigator.hardwareConcurrency || 4, dm = navigator.deviceMemory || 4;
    return hc <= 2 || dm <= 2;
  }

  // ---------- init ----------
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    comp.attack.value = 0.01; comp.release.value = 0.25; comp.knee.value = 6;
    dry = ctx.createGain(); dry.gain.value = 0.6;
    wet = ctx.createGain(); wet.gain.value = 0.4;
    lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.frequency.value = fogOpen ? 6000 : 4000; lowpass.Q.value = 0.5;
    themeShelf = ctx.createBiquadFilter(); themeShelf.type = 'highshelf'; themeShelf.frequency.value = 2500; themeShelf.gain.value = 0;
    themeHP = ctx.createBiquadFilter(); themeHP.type = 'highpass'; themeHP.frequency.value = 20; themeHP.Q.value = 0.5;

    master.connect(comp);
    comp.connect(dry);
    if (weakCPU()) {
      // fallback: eco curto em vez de convolução
      var dl = ctx.createDelay(1), fb = ctx.createGain(), dlp = ctx.createBiquadFilter();
      dl.delayTime.value = 0.18; fb.gain.value = 0.35; dlp.type = 'lowpass'; dlp.frequency.value = 3000;
      comp.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet);
    } else {
      conv = ctx.createConvolver(); conv.buffer = makeIR();
      comp.connect(conv); conv.connect(wet);
    }
    dry.connect(lowpass); wet.connect(lowpass);
    lowpass.connect(themeShelf); themeShelf.connect(themeHP); themeHP.connect(ctx.destination);

    // barramento percussivo (plops) — permite abafar por tema
    percBus = ctx.createBiquadFilter(); percBus.type = 'lowpass'; percBus.frequency.value = 20000; percBus.Q.value = 0.3;
    percBus.connect(master);

    setTheme(theme);
    if (ambWanted) ambient.start();
    return true;
  }
  function ready() { return !!ctx && ctx.state !== 'closed'; }

  // ---------- sons ----------
  // plop genérico: seno f0→f1 + burst de ruído
  function plop(f0, f1, gain, x, at, noiseGain, noiseDur, noiseFreq) {
    at = at == null ? now() : at;
    var v = mkVoice((at - now()) + 0.3, percBus, x);
    var o = osc('sine', f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + 0.12);
    o.connect(v.g);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(gain, at + 0.005);
    v.g.gain.exponentialRampToValueAtTime(0.0005, at + 0.185);
    v.g.gain.linearRampToValueAtTime(0, at + 0.19);
    v.add(o, at);
    if (noiseGain > 0) {
      var s = ctx.createBufferSource(); s.buffer = whiteNoise(); s.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = noiseFreq || 1200; bp.Q.value = 2;
      var ng = ctx.createGain(); ng.gain.setValueAtTime(0, at);
      ng.gain.linearRampToValueAtTime(noiseGain, at + 0.004);
      ng.gain.linearRampToValueAtTime(0, at + (noiseDur || 0.04));
      s.connect(bp); bp.connect(ng); ng.connect(v.g);
      // ng já envelopa; v.g segue seu próprio envelope (multiplicativo, ok)
      v.add(s, at);
    }
    return v;
  }

  // sino: fundamental + parcial 2.76× (decay 3× mais rápido) + triângulo oitava acima
  function bell(f, gain, attack, release, x, at, dest) {
    at = at == null ? now() : at;
    var v = mkVoice((at - now()) + attack + release + 0.05, dest || master, x);
    var det = rnd(-4, 4);
    var g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
    var o1 = osc('sine', cents(f, det), at);
    var o2 = osc('sine', cents(f * 2.76, det), at);
    var o3 = osc('triangle', cents(f * 2, det), at);
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(v.g); g2.connect(v.g); g3.connect(v.g);
    g1.gain.value = 0.18; g3.gain.value = 0.05;
    // parcial inarmônico decai 3× mais rápido
    g2.gain.setValueAtTime(0.25 * 0.18, at);
    g2.gain.setTargetAtTime(0, at + attack, release / 3 / 4);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(gain, at + attack);
    v.g.gain.setTargetAtTime(0, at + attack, release / 4);
    v.g.gain.linearRampToValueAtTime(0, at + attack + release);
    v.add(o1, at); v.add(o2, at); v.add(o3, at);
    return v;
  }

  // seno curto (tilintar / glissando)
  function blip(f0, f1, dur, gain, x, at, type) {
    at = at == null ? now() : at;
    var v = mkVoice((at - now()) + dur + 0.05, master, x);
    var o = osc(type || 'sine', f0, at);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    o.connect(v.g);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(gain, at + Math.min(0.01, dur * 0.2));
    v.g.gain.linearRampToValueAtTime(0, at + dur);
    v.add(o, at);
    return v;
  }

  var sounds = {
    // Plop da pedra: 220→90 Hz, ganho 0.5 + ruído 1.2 kHz
    plop: function (o) { plop(220, 90, 0.5 * o.gain, o.x, null, 0.15, 0.04, 1200); return true; },

    // Nota do anel (sino). Respeita 80 ms mínimo entre notas.
    note: function (o) {
      var t = now();
      if (lastNote >= 0 && t - lastNote < MIN_NOTE_GAP) return false;
      lastNote = t;
      var f = o.degree != null ? freqOf(o.degree, o.y != null && o.y > 0.5 ? 3 : 4) : noteFor(o.x, o.y);
      bell(f, 1.0 * o.gain, 0.03, 1.6, o.x);
      return true;
    },

    // Pulso de morador: mesma nota, oitava acima, ganho 0.1
    pulse: function (o) {
      var f = (o.degree != null ? freqOf(o.degree, o.y != null && o.y > 0.5 ? 3 : 4) : noteFor(o.x, o.y)) * 2;
      bell(f, 0.1 / 0.18 * o.gain, 0.03, 1.2, o.x);
      return true;
    },

    // Vagalume acordado: 1.8–2.6 kHz, 60 ms, 0.04
    firefly: function (o) { blip(rnd(1800, 2600), 0, 0.06, 0.04 * o.gain, o.x); return true; },

    // Peixe: 2 plops 440→180 a 90 ms + ruído 80 ms
    fishJump: function (o) {
      var t = now();
      plop(440, 180, 0.22 * o.gain, o.x, t, 0.08, 0.08, 1600);
      plop(440, 180, 0.18 * o.gain, o.x, t + 0.09, 0, 0, 0);
      return true;
    },
    // Dourado: + sino em A4
    fishJumpGold: function (o) {
      sounds.fishJump(o);
      bell(440, 0.6 * o.gain, 0.02, 1.8, o.x, now() + 0.1);
      return true;
    },

    // Gota de orvalho: 330→140 Hz, 0.2
    dew: function (o) { plop(330, 140, 0.2 * o.gain, o.x, null, 0.05, 0.03, 2000); return true; },

    // Sapo: quadrada 90 Hz, LFO 14 Hz, 300 ms, lowpass 400, 0.08
    frog: function (o) {
      var t = now(), v = mkVoice(0.35, master, o.x);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 1;
      var am = ctx.createGain(); am.gain.value = 0.5;
      var sq = osc('square', 90, t);
      var lfo = osc('sine', 14, t), lg = ctx.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg); lg.connect(am.gain);
      sq.connect(am); am.connect(lp); lp.connect(v.g);
      v.g.gain.setValueAtTime(0, t);
      v.g.gain.linearRampToValueAtTime(0.08 * o.gain, t + 0.03);
      v.g.gain.setValueAtTime(0.08 * o.gain, t + 0.24);
      v.g.gain.linearRampToValueAtTime(0, t + 0.3);
      v.add(sq, t); v.add(lfo, t);
      return true;
    },

    // Desbloqueio: acorde de 3 notas (grau, +2, +4), ataque 400 ms, release 3 s, 0.12
    unlock: function (o) {
      var d = o.degree == null ? 0 : Math.floor(o.degree);
      var t = now();
      var v = mkVoice(3.6, master, o.x);
      var det = rnd(-4, 4);
      for (var i = 0; i < 3; i++) {
        var f = freqOf(d + i * 2, 4);
        var g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
        g1.gain.value = 0.18; g3.gain.value = 0.05;
        g2.gain.setValueAtTime(0.045, t); g2.gain.setTargetAtTime(0, t + 0.4, 0.25);
        var o1 = osc('sine', cents(f, det), t), o2 = osc('sine', cents(f * 2.76, det), t), o3 = osc('triangle', cents(f * 2, det), t);
        o1.connect(g1); o2.connect(g2); o3.connect(g3);
        g1.connect(v.g); g2.connect(v.g); g3.connect(v.g);
        v.add(o1, t); v.add(o2, t); v.add(o3, t);
      }
      v.g.gain.setValueAtTime(0, t);
      v.g.gain.linearRampToValueAtTime(0.22 * o.gain, t + 0.4); // ~0.12 efetivo (3 notas × 0.18)
      v.g.gain.setTargetAtTime(0, t + 0.4, 0.75);
      v.g.gain.linearRampToValueAtTime(0, t + 3.4);
      return true;
    },

    // Estrela cadente: 2 kHz→600 Hz, 400 ms, 0.03
    shooting: function (o) { blip(2000, 600, 0.4, 0.03 * o.gain, o.x); return true; },

    // Flor: nota longa 2.4 s com detune
    bloom: function (o) {
      var f = (o.degree != null ? freqOf(o.degree, 4) : noteFor(o.x, 0)) ;
      var t = now(), v = mkVoice(2.6, master, o.x);
      var a = osc('sine', cents(f, -7), t), b = osc('sine', cents(f, 7), t), c = osc('triangle', cents(f * 2, 0), t);
      var gc = ctx.createGain(); gc.gain.value = 0.15;
      a.connect(v.g); b.connect(v.g); c.connect(gc); gc.connect(v.g);
      v.g.gain.setValueAtTime(0, t);
      v.g.gain.linearRampToValueAtTime(0.09 * o.gain, t + 0.5);
      v.g.gain.setValueAtTime(0.09 * o.gain, t + 1.2);
      v.g.gain.linearRampToValueAtTime(0, t + 2.4);
      v.add(a, t); v.add(b, t); v.add(c, t);
      return true;
    },

    // Pássaros: 3 sinos curtos agudos
    birds: function (o) {
      var t = now(), base = [9, 11, 14][Math.floor(Math.random() * 3)]; // graus altos
      for (var i = 0; i < 3; i++) {
        bell(freqOf(base + [0, 2, 1][i], 5), 0.25 * o.gain, 0.008, 0.35, clamp((o.x == null ? 0.5 : o.x) + rnd(-0.15, 0.15), 0, 1), t + i * 0.16);
      }
      return true;
    }
  };

  function play(name, opts) {
    if (!ready()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    var fn = sounds[name];
    if (!fn) return false;
    var o = opts || {};
    o = { x: o.x, y: o.y, gain: o.gain == null ? 1 : o.gain, degree: o.degree };
    try { return fn(o); } catch (e) { return false; }
  }

  // ---------- ambiente ----------
  var ambWanted = false;
  var cricketTimer = null;

  function scheduleCricket() {
    if (!amb || !ambState.crickets) return;
    cricketTimer = setTimeout(function () {
      if (!amb || !ambState.crickets) return;
      try {
        var t = now(), p = panner(Math.random());
        var g = ctx.createGain(), o = osc('sine', 4200, t);
        o.connect(g); g.connect(p); p.connect(amb.bus);
        g.gain.setValueAtTime(0, t);
        for (var i = 0; i < 8; i++) { // 8 pulsos a 30 Hz
          var tp = t + i / 30;
          g.gain.setValueAtTime(0, tp);
          g.gain.linearRampToValueAtTime(0.02, tp + 0.004);
          g.gain.linearRampToValueAtTime(0, tp + 0.02);
        }
        o.start(t); o.stop(t + 0.3);
      } catch (e) {}
      scheduleCricket();
    }, rnd(3000, 7000));
  }

  function applyAmb(time) {
    if (!amb) return;
    var t = now(), tc = time == null ? 2 : time;
    amb.moon.gain.cancelScheduledValues(t);
    amb.moon.gain.setTargetAtTime(ambState.moon ? 0.015 : 0, t, tc);
    amb.aurora.gain.cancelScheduledValues(t);
    amb.aurora.gain.setTargetAtTime(ambState.aurora ? 0.012 : 0, t, Math.max(tc, 8)); // muito lento
    var w = clamp(ambState.wind || 0, 0, 1);
    amb.noiseGain.gain.setTargetAtTime(0.03 + w * 0.012, t, 1);
    amb.lfoDepth.gain.setTargetAtTime(0.006 + w * 0.02, t, 1);
    amb.rain.gain.cancelScheduledValues(t);
    amb.rain.gain.setTargetAtTime(ambState.rain ? 0.02 : 0, t, 1.5);
    if (ambState.crickets && !cricketTimer) scheduleCricket();
    if (!ambState.crickets && cricketTimer) { clearTimeout(cricketTimer); cricketTimer = null; }
  }

  var ambient = {
    start: function () {
      ambWanted = true;
      if (!ready() || amb) return;
      var t = now();
      var bus = ctx.createGain(); bus.gain.value = 0;
      bus.connect(master);
      bus.gain.linearRampToValueAtTime(1, t + 2);

      // ruído rosa → lowpass 500 → ganho 0.03 × LFO 0.1 Hz
      var src = ctx.createBufferSource(); src.buffer = pinkNoise(); src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      var ng = ctx.createGain(); ng.gain.value = 0.03;
      var lfo = osc('sine', 0.1, t), ld = ctx.createGain(); ld.gain.value = 0.006;
      lfo.connect(ld); ld.connect(ng.gain);
      src.connect(lp); lp.connect(ng); ng.connect(bus);
      src.start(t); lfo.start(t);

      // drone 55 + 82.4 (+110 lua, +164.8 aurora)
      function drone(f, g0) {
        var o = osc('sine', f, t), g = ctx.createGain(); g.gain.value = g0;
        o.connect(g); g.connect(bus); o.start(t); return g;
      }
      var d1 = drone(55, 0.02), d2 = drone(82.4, 0.02), moon = drone(110, 0), aurora = drone(164.8, 0);

      // garoa: ruído bandpass 3 kHz, ganho 0.02 (opcional)
      var rs = ctx.createBufferSource(); rs.buffer = whiteNoise(); rs.loop = true;
      var rbp = ctx.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 3000; rbp.Q.value = 0.8;
      var rg = ctx.createGain(); rg.gain.value = 0;
      rs.connect(rbp); rbp.connect(rg); rg.connect(bus); rs.start(t);

      amb = { bus: bus, src: src, lfo: lfo, noiseGain: ng, lfoDepth: ld, d1: d1, d2: d2, moon: moon, aurora: aurora, rain: rg, rs: rs };
      applyAmb(0.5);
    },
    stop: function () {
      ambWanted = false;
      if (!amb) return;
      var a = amb, t = now(); amb = null;
      if (cricketTimer) { clearTimeout(cricketTimer); cricketTimer = null; }
      a.bus.gain.cancelScheduledValues(t);
      a.bus.gain.setValueAtTime(a.bus.gain.value, t);
      a.bus.gain.linearRampToValueAtTime(0, t + 1.5);
      setTimeout(function () {
        try { a.src.stop(); a.lfo.stop(); a.rs.stop(); a.bus.disconnect(); } catch (e) {}
      }, 1700);
    },
    // set({moon, aurora, fogOpen, crickets, wind, rain, fogTime})
    set: function (o) {
      o = o || {};
      if (o.moon != null) ambState.moon = !!o.moon;
      if (o.aurora != null) ambState.aurora = !!o.aurora;
      if (o.crickets != null) ambState.crickets = !!o.crickets;
      if (o.wind != null) ambState.wind = clamp(+o.wind || 0, 0, 1);
      if (o.rain != null) ambState.rain = !!o.rain;
      if (o.fogOpen != null) setFog(!!o.fogOpen, o.fogTime);
      applyAmb();
    },
    running: function () { return !!amb; }
  };

  // lowpass master: 4 kHz com névoa → 6 kHz sem (60 s por padrão)
  function setFog(open, secs) {
    // só reage a mudança de estado (chamadas periódicas não reiniciam a rampa)
    if (open === fogOpen && ready()) return;
    fogOpen = open; ambState.fogOpen = open;
    if (!ready()) return;
    var t = now(), d = secs == null ? 60 : Math.max(0.05, secs);
    lowpass.frequency.cancelScheduledValues(t);
    lowpass.frequency.setValueAtTime(lowpass.frequency.value, t);
    lowpass.frequency.linearRampToValueAtTime(open ? 6000 : 4000, t + d);
  }

  // ---------- controles ----------
  function setMuted(m) {
    muted = !!m;
    if (!ready()) return;
    var t = now();
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.3); // fade 300 ms, nunca corte
  }

  // temas: só ajustam filtros
  function setTheme(name) {
    theme = name || 'night';
    if (!ready()) return;
    var t = now(), perc = 20000, shelf = 0, hp = 20;
    if (theme === 'winter') { perc = 2000; shelf = -2; }        // plop abafado
    else if (theme === 'autumn') { shelf = -4; hp = 40; }       // mais quente
    else if (theme === 'ink') { shelf = -6; hp = 120; }         // seco, mínimo
    else if (theme === 'tropical') { shelf = 2.5; hp = 30; }    // mais claro
    percBus.frequency.setTargetAtTime(perc, t, 0.2);
    themeShelf.gain.setTargetAtTime(shelf, t, 0.3);
    themeHP.frequency.setTargetAtTime(hp, t, 0.3);
  }

  function voicesActive() { if (!ctx) return 0; reap(); return voices.length; }

  LQ.Audio = {
    init: init,
    play: play,
    ambient: ambient,
    setMuted: setMuted,
    setTheme: setTheme,
    voicesActive: voicesActive,
    noteFor: noteFor,
    freqOf: freqOf,
    isMuted: function () { return muted; },
    ready: ready,
    context: function () { return ctx; }
  };
})();
