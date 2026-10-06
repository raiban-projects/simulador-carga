// Roda o motor em cargas de referência e confere as regras físicas.
// Uso: node testes/cenarios.js [tempo_ms]      (sai com código 1 se alguma regra quebrar)
const fs = require('fs'), path = require('path');
const carregar = require('./motor.js');
const { conferir } = require('./regras.js');
const sim = require('./simcarga.js');
const tempo = +(process.argv[2] || 2500);
function T(name,l,w,h,qty,ent,mode){ ent=ent||1; return {name,l,w,h,qty,weight:0,mode:mode||'auto',estrado:100,color:0,sl:l,sw:w,st:1,entrega:ent,grupo:-ent}; }
const CA={l:13500,w:2500,h:3000}, HC={l:11920,w:2320,h:2698}, ST={l:5898,w:2320,h:2393};
const d = JSON.parse(fs.readFileSync(path.join(__dirname,'dados','carga-real-2-entregas.txt'),'utf8').split(' ').slice(1).join(' '));
const ents=[2,2,2,2,2,1,1,1,1];
const real = d.produtos.map((p,i)=> T('P'+(i+1),p.l,p.w,p.h,p.qtd,ents[i]));
// [nome, unidade, aberta, produtos, regras extras, mínimo de pacotes esperado]
const casos = [
  ['Carreta real 2 entregas', {l:14000,w:2400,h:3000}, true, real, {}, 38],
  ['Carreta mix 7', CA, true, [T('A',1860,1360,900,8),T('B',1860,860,900,8),T('C',2440,1220,800,6),T('D',2200,1100,700,6),T('E',1830,915,600,6),T('F',2500,1250,900,4),T('G',2440,1220,1000,4)], {}, 37],
  ['Carreta 1860+860', CA, true, [T('A',1860,1360,950,14),T('B',1860,860,950,14)], {}, 28],
  ['Carreta 2440', CA, true, [T('A',2440,1220,900,30)], {}, 30],
  ['40HC 252 pallets', HC, false, [T('A',540,370,1000,252)], {portaH:2585}, 252],
  ['40HC 252 (estrado 0)', HC, false, [T('A',540,370,900,252)], {portaH:2585}, 252],
  ['40HC 3 produtos', HC, false, [T('A',2440,1220,1000,12),T('B',2200,1100,1000,10),T('C',2440,1220,1000,8)], {portaH:2585}, 18],
  ['40HC volumes de 3 juntos', HC, false, [T('A',540,370,2460,105,1,'stack'),T('A solto',540,370,820,2)], {portaH:2585}, 107],
  ['20ST misto', ST, false, [T('A',1860,1360,900,8),T('B',1200,800,1000,10)], {portaH:2280}, 13],
];
// cargas reais analisadas (testes/dados/reais): o mínimo esperado fica em esperado.json (npm run analisar -- --gravar)
const dirReais = path.join(__dirname,'dados','reais');
const esperado = fs.existsSync(path.join(dirReais,'esperado.json')) ? JSON.parse(fs.readFileSync(path.join(dirReais,'esperado.json'),'utf8')) : {};
for (const arq of Object.keys(esperado)){
  const dr = sim.ler(fs.readFileSync(path.join(dirReais,arq),'utf8')), u = dr.unidade;
  casos.push(['Real: '+arq.replace(/\.txt$/,''), {l:u.l,w:u.w,h:u.h}, !!u.aberta, sim.tipos(dr),
    { ...dr.regras, folga: u.folga, maxW: u.pesoMax }, esperado[arq].minimo, true, esperado[arq].notaMin]);
}
let falhas = 0;
for (const org of [true, false]) for (const [nome,C,aberta,tipos,extra,minimo,real,notaMin] of casos){
  if (real && org !== (extra.organizado !== false)) continue;   // carga real: roda uma vez, com as regras dela
  const E = carregar();
  E.setup(C, tipos, {apoio:0.8, tempo, portaH:0, porta:true, organizado:org, entregaCima:'menor', estrado:false, ...extra, tempo}, aberta);
  const P = E.run(tipos.map((t,i)=>i));
  const { erros } = conferir(E, C, aberta, tipos, P);
  const err = Object.keys(erros).filter(k=> org || k!=='camada virada');
  if ((org || real) && P.length < minimo) err.push('menos pacotes que o esperado');
  if (real && notaMin != null && E.nota(P) < notaMin) err.push(`montagem pior que a guardada (nota ${Math.round(E.nota(P))} < ${notaMin})`);
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} ${org?'organizado':'livre     '} ${nome.padEnd(24)} ${P.length}/${tipos.reduce((s,t)=>s+t.qty,0)}  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
// CONTAINER que não enche: o que sobra vira pacotes EM PÉ no MEIO (nunca na frente), travando os dois blocos
// (exemplo da produção 30/09: 16 × 2440×1220×1000 no 40HC → 2 paredes, 2 em pé, 1½ parede até a porta)
{
  const E = carregar(); const tipos = [T('A',2440,1220,1000,16)];
  E.setup(HC, tipos, {apoio:0.8, tempo, portaH:2585, porta:true, organizado:true, entregaCima:'menor', estrado:false}, false);
  const P = E.run([0]); const { erros } = conferir(E, HC, false, tipos, P); const err = Object.keys(erros);
  const emPe = P.filter(p=> p.h > 2400), ini = Math.min(...P.map(p=> p.x)), fim = Math.max(...P.map(p=> p.x+p.l));
  if (emPe.length !== 2) err.push(`${emPe.length} em pé (esperado 2)`);
  if (emPe.some(p=> p.x < ini + 2000 || p.x + p.l > fim - 2000)) err.push('em pé fora do meio');
  if (P.length !== 16) err.push('menos pacotes');
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} organizado ${'40HC 16×2440 em pé no meio'.padEnd(24)} ${P.length}/16  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
// CONTAINER com poucos pacotes: continua UMA fileira só em pé (vários em pé ficam instáveis — produção 05/10)
for (const [l,w,h,q] of [[2440,1220,1000,10],[2440,1220,1000,18],[2440,1220,700,24]]){
  const E = carregar(); const tipos = [T('A',l,w,h,q)];
  E.setup(HC, tipos, {apoio:0.8, tempo, portaH:2585, porta:true, organizado:true, entregaCima:'menor', estrado:false}, false);
  const P = E.run([0]); const { erros } = conferir(E, HC, false, tipos, P); const err = Object.keys(erros);
  const emPe = P.filter(p=> E.dePe(tipos[0], p)), fileiras = new Set(emPe.map(p=> Math.round(p.x))).size;
  if (fileiras > 1) err.push(`${fileiras} fileiras em pé (máximo 1)`);
  if (P.length !== q) err.push('menos pacotes');
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} organizado ${('40HC '+q+'×'+l+' 1 fileira em pé').padEnd(24)} ${P.length}/${q}  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
// CONTAINER 19 × 2440 (produção 06/10): 4 paredes + BLOCO de 3 em pé no meio (2 em fila + 1 ao lado), nunca mais que 3
{
  const E = carregar(); const tipos = [T('A',2440,1220,1000,19)];
  E.setup(HC, tipos, {apoio:0.8, tempo, portaH:2585, porta:false, organizado:true, entregaCima:'menor', estrado:false}, false);
  const P = E.run([0]); const { erros } = conferir(E, HC, false, tipos, P); const err = Object.keys(erros);
  const emPe = P.filter(p=> E.dePe(tipos[0], p)), ini = Math.min(...P.map(p=> p.x)), fim = Math.max(...P.map(p=> p.x+p.l));
  if (P.length !== 19) err.push('menos pacotes');
  if (emPe.length !== 3) err.push(`${emPe.length} em pé (esperado 3)`);
  if (emPe.some(p=> p.x < ini + 2000 || p.x + p.l > fim - 2000)) err.push('em pé fora do meio');
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} organizado ${'40HC 19×2440 bloco 3 em pé'.padEnd(24)} ${P.length}/19  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
// PAREDE DA PORTA FECHA A LARGURA NO CHÃO (produção 06/10: 17 × 2440×1520×760 no 40HC): o que volta depois da fileira em
// pé vai primeiro no chão, ao lado dos deitados (de lado), e não em cima de mais um deitado deixando a lateral vazia
{
  const E = carregar(); const tipos = [T('A',2440,1520,760,17)];
  E.setup(HC, tipos, {apoio:0.8, tempo, portaH:2585, porta:false, organizado:true, entregaCima:'menor', estrado:false}, false);
  const P = E.run([0]); const { erros } = conferir(E, HC, false, tipos, P); const err = Object.keys(erros);
  if (P.length !== 17) err.push('menos pacotes');
  const paredes = new Map(); P.filter(p=> p.z < 0.5 && !E.dePe(tipos[0], p)).forEach(p=>{ const k = Math.round(p.x); paredes.set(k, (paredes.get(k)||0) + p.w); });
  paredes.forEach((larg, x)=>{ if (larg < 2200) err.push(`parede em ${x} com ${larg} mm no chão (lateral vazia)`); });
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} organizado ${'40HC 17×2440×1520 porta'.padEnd(24)} ${P.length}/17  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
// LÂMINA ATRAVESSADA (produção 07/10): 2200×1220 cabe na largura do 40HC (2320) → tudo de lado, atravessado, 2 de
// altura, sem em pé; o pacote mais fino fecha a última fatia por cima. As compridas (2540) seguem o padrão do compensado.
{
  const E = carregar(); const tipos = [T('L1',2200,1220,1090,17), T('L2',2200,1220,925,1)];
  E.setup(HC, tipos, {apoio:0.8, tempo, portaH:2585, porta:false, organizado:true, entregaCima:'menor', estrado:false}, false);
  const P = E.run([0,1]); const { erros } = conferir(E, HC, false, tipos, P); const err = Object.keys(erros);
  if (P.length !== 18) err.push('menos pacotes');
  if (!P.every(p=> Math.abs(p.w - 2200) < 1 && Math.abs(p.h - 1220) < 1)) err.push('não ficou tudo atravessado de lado');
  const fino = P.find(p=> p.type===1); if (!fino || fino.z < 1) err.push('o pacote fino não ficou por cima');
  const E2 = carregar(); const t2 = [T('L',2540,1270,800,18)];
  E2.setup(HC, t2, {apoio:0.8, tempo, portaH:2585, porta:false, organizado:true, entregaCima:'menor', estrado:false}, false);
  E2.run([0]); if (E2.info().estrategia === 'atravessado') err.push('2540 não pode atravessar');
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} organizado ${'40HC lâmina 2200 atravessada'.padEnd(24)} ${P.length}/18  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
// CONTAINER AMARRADO (fotos da produção 05/10: 18 × 2500×1250×1000 no 40HC): cada parede tem 1 deitado + 1 de lado
// embaixo e em cima eles TROCAM (de lado sobre o deitado, deitado sobre o de lado); os 2 em pé no meio fecham a
// largura (1250 + 1000)
{
  const E = carregar(); const tipos = [T('A',2500,1250,1000,18)];
  E.setup(HC, tipos, {apoio:0.8, tempo, portaH:2585, porta:false, organizado:true, entregaCima:'menor', estrado:false}, false);
  const P = E.run([0]); const { erros } = conferir(E, HC, false, tipos, P); const err = Object.keys(erros);
  const cima = P.filter(p=> p.z > 0.5), amarrados = cima.filter(p=> E.amarra(p, E.apoio(P.filter(q=> q!==p), p).sup)).length;
  const emPe = P.filter(p=> E.dePe(tipos[0], p)), largEmPe = emPe.reduce((s,p)=> s+p.w, 0);
  if (P.length !== 18) err.push('menos pacotes');
  if (amarrados !== cima.length || cima.length !== 8) err.push(`${amarrados} de ${cima.length} amarrados em cima`);
  if (emPe.length !== 2 || largEmPe < 2250) err.push(`em pé: ${emPe.length}, largura ${largEmPe}`);
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} organizado ${'40HC 18×2500 amarrado'.padEnd(24)} ${P.length}/18  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
// CONTAINER: carrega do fundo p/ a porta — a camada de cima que não fecha começa ENCOSTADA NO FUNDO (o que sobra
// fica na porta). Exemplo real 30/09: 157 volumes 820×540×740 (2 juntos) no 40HC.
{
  const E = carregar(); const tipos = [{ ...T('V',820,540,740,157,1,'stack'), naoTomba:true }];
  E.setup(HC, tipos, {apoio:0.8, tempo, portaH:2585, porta:true, organizado:true, entregaCima:'menor', estrado:false}, false);
  const P = E.run([0]); const { erros } = conferir(E, HC, false, tipos, P); const err = Object.keys(erros);
  const topo = Math.max(...P.map(p=> p.z+p.h)), x0 = Math.min(...P.map(p=> p.x));
  const fundo = P.filter(p=> p.x < x0 + 10), topoFundo = Math.max(...fundo.map(p=> p.z+p.h));
  if (topoFundo < topo - 1) err.push('parede do fundo mais baixa que a carga');
  if (P.length !== 157) err.push('menos pacotes');
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} organizado ${'40HC camada de cima no fundo'.padEnd(24)} ${P.length}/157  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
console.log(falhas ? `\n${falhas} cenário(s) com problema.` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
