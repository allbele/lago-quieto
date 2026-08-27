// Lago Quieto — modo Idle: "Falatório do lago" — frases curtas assinadas pelos moradores, via LQ.Toasts (kind 'chatter').
// Filtro por era (min) e população (LQ.Idle.visible(pop) > 0); sem repetir nas últimas 20; 1 a cada 150-300 s,
// só com pilha vazia, ≥3 s sem clique e aba visível (1ª frase ~90 s após abrir). Vida 4 s, sem sino.
// Respeita state.idle.chatter; soma stats.chatterShown. Pool pequeno (era 0): `recent` encolhe para nunca silenciar.
window.LQ = window.LQ || {};
LQ.Chatter = (function(){
  'use strict';
  const LQ = window.LQ;
  const D = () => LQ.IdleData || { gens: [], eras: [] };
  const I = () => LQ.Idle || {};
  const MIN_GAP = 150, MAX_GAP = 300, LIFE = 4, QUIET = 3, NO_REPEAT = 20, FIRST = 90;
  // quem fala: nome, ícone e população que precisa existir (null = sempre; era mínima em `era`)
  const WHO = {
    vagalume: { name: 'Vagalume', icon: 'ic-firefly', pop: 'vagalume' },
    junco:    { name: 'Junco', icon: 'ic-reed', pop: 'juncosL' },
    peixe:    { name: 'Peixe', icon: 'ic-fish', pop: 'peixe' },
    estrela:  { name: 'Estrela', icon: 'ic-star', pop: 'estrelas' },
    lua:      { name: 'Lua', icon: 'ic-moon', pop: 'lua' },
    dourado:  { name: 'Peixe dourado', icon: 'ic-goldfish', pop: 'dourado' },
    montanha: { name: 'Montanha', icon: 'ic-mountain', pop: 'montanhas' },
    lirio:    { name: 'Lírio', icon: 'ic-lily', pop: 'lirio' },
    sapo:     { name: 'Sapo', icon: 'ic-frog', pop: 'sapo' },
    aurora:   { name: 'Aurora', icon: 'ic-aurora', pop: 'aurora' },
    lago:     { name: 'O lago', icon: 'ic-coll', pop: null },
    lanterna: { name: 'A lanterna', icon: 'ic-coll', pop: null, era: 1 },
    pier:     { name: 'O píer', icon: 'ic-coll', pop: null, era: 2 },
    barco:    { name: 'O barco', icon: 'ic-coll', pop: null, era: 3 },
    templo:   { name: 'O templo', icon: 'ic-coll', pop: null, era: 4 },
    passaro:  { name: 'Pássaro', icon: 'ic-bird', pop: null, era: 5 },
  };
  // [quem, frase]
  const LINES = [
    ['vagalume', 'quem apagou?'],
    ['vagalume', 'eu era o sétimo. Agora sou o oitavo. Não sei o que aconteceu.'],
    ['vagalume', 'pisca duas vezes se você também está com frio.'],
    ['vagalume', 'a estrela ali em cima me copiou.'],
    ['vagalume', 'onda vindo. Onda vindo. Todo mundo pra margem.'],
    ['junco', 'o vento contou um segredo. Não entendi, mas balancei.'],
    ['junco', 'hoje eu cresci um centímetro. Ninguém notou.'],
    ['junco', 'um vagalume pousou em mim e disse que era o meu chapéu.'],
    ['peixe', 'essa pedra tinha gosto de quinta-feira.'],
    ['peixe', 'vi meu reflexo na lua. Precisamos conversar.'],
    ['peixe', 'mais uma pedra e eu abro um restaurante.'],
    ['peixe', 'o fundo do lago é só o céu de cabeça pra baixo, né?'],
    ['estrela', 'caí uma vez. Não recomendo. Mas a vista é boa.'],
    ['estrela', 'se piscar for cansativo, ninguém me avisou.'],
    ['estrela', 'aquela estrela ali é um vagalume que subiu muito.'],
    ['lua', 'estou cheia, obrigada por perguntar.'],
    ['lua', 'todo lago quer um pedaço de mim. Este pediu com educação.'],
    ['lua', 'meu halo não é vaidade. É neblina bem colocada.'],
    ['dourado', 'não sou dourado. Sou bem iluminado.'],
    ['dourado', 'as pedras deste lago são de primeira. Cinco estrelas.'],
    ['montanha', 'eu já estava aqui. Só a névoa é que saiu.'],
    ['montanha', 'daqui de cima o lago parece uma moeda. Uma moeda bonita.'],
    ['lirio', 'flori de madrugada só pra ninguém ver. Deu certo.'],
    ['lirio', 'o peixe passou por baixo e fez cócegas.'],
    ['sapo', 'hoje eu ia coaxar, mas a lua tá bonita demais.'],
    ['sapo', 'coaxei em dó. O lago respondeu em silêncio. Empate.'],
    ['sapo', 'cada onda é um aplauso. Obrigado, obrigado.'],
    ['aurora', 'eu não danço. Eu escorro devagar.'],
    ['aurora', 'verde hoje. Amanhã vejo como acordo.'],
    ['lago', 'toda pedra que cai eu guardo. Ainda não perdi nenhuma.'],
    ['lago', 'silêncio também é som, só que bem espalhado.'],
    ['lago', 'quem jogou a primeira pedra? Foi você, né? Obrigado.'],
    ['lago', 'me chamam de quieto. Não sabem o que se passa lá embaixo.'],
    ['lanterna', 'cinco vagalumes e eu acendo. Quatro e eu fico só com esperança.'],
    ['lanterna', 'alguém me deixou aqui. Acho que foi de propósito.'],
    ['lanterna', 'os vagalumes fogem das ondas. Eu sou o lugar para onde fogem.'],
    ['pier', 'seis tábuas e nenhuma range. Sou um píer de respeito.'],
    ['pier', 'o peixe usa a minha sombra como rede. Cobro nada.'],
    ['barco', 'amarrado, sim. Parado, nunca: eu balanço.'],
    ['barco', 'as luzes da outra margem me acenam. Um dia eu vou.'],
    ['templo', 'uma janela acesa é suficiente para quem sabe olhar.'],
    ['templo', 'a ponte veio até mim. Eu não precisei ir a lugar nenhum.'],
    ['passaro', 'passei aqui ontem. Estava mais escuro.'],
    ['passaro', 'o amanhecer vem de longe. Eu vim mais longe ainda.'],
  ];

  let game = null, timer = 0, recent = [];
  const st = () => (game && game.state && game.state.idle) || null;
  const rnd = () => (game && game.rand ? game.rand() : Math.random());
  const nextGap = () => MIN_GAP + rnd() * (MAX_GAP - MIN_GAP);
  function eraIdx(){
    if (I().era){ const e = I().era(); return typeof e === 'number' ? e : (e && e.index) || 0; }
    const s = st(); return s && typeof s.era === 'number' ? s.era : 0;
  }
  // frase elegível: era mínima, população viva e não dita nas últimas NO_REPEAT
  function pool(){
    const era = eraIdx(), elig = [];
    for (let i = 0; i < LINES.length; i++){
      const w = WHO[LINES[i][0]]; if (!w) continue;
      if ((w.era || 0) > era) continue;
      if (w.pop && I().visible && !(I().visible(w.pop) > 0)) continue;
      elig.push(i);
    }
    // pool menor que a memória de repetição: esquece as mais antigas (senão silenciaria para sempre)
    while (recent.length && recent.length >= elig.length) recent.shift();
    return elig.filter(i => recent.indexOf(i) < 0);
  }
  // Solta uma frase agora (ignora timer/condições de silêncio). Retorna a frase ou null.
  function say(){
    if (!game || game.mode !== 'idle' || !LQ.Toasts) return null;
    const p = pool(); if (!p.length) return null;
    const i = p[Math.floor(rnd() * p.length)], w = WHO[LINES[i][0]];
    recent.push(i); if (recent.length > NO_REPEAT) recent.shift();
    if (!LQ.Toasts.show({ icon: w.icon, title: w.name, text: LINES[i][1], kind: 'chatter', life: LIFE })) return null;
    const s = st(); if (s){ s.stats = s.stats || {}; s.stats.chatterShown = (s.stats.chatterShown || 0) + 1; }
    return w.name + ': ' + LINES[i][1];
  }
  const enabled = () => { const s = st(); return !!s && s.chatter !== false; };

  LQ.register('idle-chatter', {
    init(g){ game = g; recent = []; timer = FIRST; },
    update(dt, g){
      if (g.mode !== 'idle' || !enabled()) return;
      timer -= dt;
      if (timer > 0) return;
      // condições: pilha vazia, sem clique há ≥3 s, aba visível — senão tenta de novo em alguns segundos
      if (document.hidden || !LQ.Toasts || !LQ.Toasts.idle() || g.sinceClick < QUIET){ timer = 5; return; }
      timer = nextGap();
      say();
    },
  });

  return { say, enabled, lines: () => LINES.length, pool: () => pool().length, nextIn: () => timer };
})();
