# Plano W1 — `web/idle/data.js` (seção 1 do PLANO-IDLE-V2)

Arquivo alvo: `/Users/mateu/Documents/Mateus/Ideias/Jogo aleatorio/web/idle/data.js`
Regra: NÃO alterar `base/growth/rate/unlock/icon`, `prestige`, `goals`, nem os upgrades existentes (só acrescentar `name`/`desc` e o upgrade `racao`). Depois: `node --check`.

## Gens — acrescentar `name`, `desc` (≤40), `milestones`

| id | name | desc | milestones |
|---|---|---|---|
| vagalume | Vagalumes | `+0.3 ondas/s · +1 vagalume` | 1 "1º vagalume acende" · 5 "pousam nos juncos" · 10 "formam constelações" · 25 "enxame de 30" |
| juncos | Juncos | `+1.4 ondas/s · mais juncos na margem` | 1 "brotam à direita" · 5 "margem cheia" · 10 "balançam ao vento" · 25 "16 juncos" |
| peixe | Peixes | `+6 ondas/s · +1 peixe; come pedras ×2` | 1 "come as pedras (×2)" · 5 "saltam sozinhos" · 10 "comem as pedras (×3)" · 25 "cardume de 8" |
| estrelas | Estrelas | `+25 ondas/s · céu mais estrelado` | 1 "mais 15 estrelas" · 5 "céu denso" · 10 "cadentes frequentes" · 25 "200 estrelas" |
| lua | Lua | `+100 ondas/s · halo maior` | 5 "lua cheia maior" · 10 "nuvens" · 25 "halo dourado" · 50 "lua gigante" |
| dourado | Peixe dourado | `+420 ondas/s · +1 dourado (até 3)` | 1 "1º dourado" · 5 "brilho no salto" · 10 "3 dourados" |
| nevoa | Montanhas | `+1700 ondas/s · cordilheira ao fundo` | 1 "névoa abre" · 5 "3ª cordilheira" · 25 "4ª cordilheira" |
| lirio | Lírios | `+7000 ondas/s · +1 lírio na água` | 1 "1º lírio" · 5 "flores abrem" · 25 "12 lírios" |
| sapo | Sapos | `+27000 ondas/s · +1 sapo coaxando` | 1 "1º coaxo" · 5 "coro de sapos" · 25 "5 sapos" |
| aurora | Aurora | `+100000 ondas/s · aurora no céu` | 1 "1ª faixa" · 10 "duas faixas" · 25 "aurora intensa" |

## Upgrades — `name`/`desc` por família (todos os itens existentes)
- `*_10/25/50/100/200` (mult): name `"<Gen> ×2"` (ex. "Vagalumes ×2"), desc `"produção de <gen> ×2 aos N"`.
- `click_N`: name `"Pedras pesadas ×2"`, desc `"cada pedra rende ×2"`.
- `auto_1/2`: name `"Orvalho +1/s"` / `"Orvalho +2/s"`, desc `"anéis automáticos +N/s"`.
- `offline_12h/18h/24h`: name `"Sono 12h"` etc., desc `"ganho offline até Nh"`.
- NOVO: `{"id":"racao","gen":null,"kind":"racao","at":null,"cost":20000,"value":4,"name":"Ração","desc":"pedras viram ração; peixes comem ×4"}`.

## `pop`
```js
pop: {
  vagalume:  {base:3,  k:3,  cap:30},
  juncosL:   {base:3,  k:1,  cap:8},
  juncosR:   {base:0,  k:2,  cap:8},
  peixe:     {base:1,  k:1,  cap:8},
  dourado:   {base:1,  k:1,  cap:3},
  estrelas:  {base:15, k:15, cap:200},
  lirio:     {base:3,  k:1,  cap:12},
  sapo:      {base:1,  k:1,  cap:5},
  lua:       {scaleStep:0.08, scaleCap:1.6, haloMin:0.55, haloMax:0.9},
  montanhas: {base:2,  k:1,  cap:4},
  aurora:    {bands2At:10},
}
```
Fórmula (engine): `vis(count,base,k,cap) = count<=0 ? 0 : min(cap, base + floor(log2(count+1))*k)`.
`juncosL/juncosR` e `montanhas` leem `genCount('juncos')` / `genCount('nevoa')`.

## `bonus`
```js
bonus: { fishMult:2, fishMult10:3, racaoMult:4, glintEvery:[60,180], glintLife:6, glintRateSec:60,
         comboStep:0.1, comboCap:2, comboTol:0.12, comboMin:0.3, comboMax:1.5, shootMult:25, shootLife:2 }
```
(`fishMult:2` desde o 1º peixe, `fishMult10:3` a partir de visible('peixe')>=10, `racaoMult:4` com upgrade `racao` — ajuste pedido.)

## Verificação
`node --check web/idle/data.js`; no console: `LQ.IdleData.gens.every(g=>g.name&&g.desc.length<=40&&g.milestones.length>=3)`.
