// Roda o motor em cargas de referência e confere as regras físicas.
// Uso: node testes/cenarios.js [tempo_ms]      (sai com código 1 se alguma regra quebrar)
const fs = require('fs'), path = require('path');
const carregar = require('./motor.js');
const { conferir } = require('./regras.js');
const sim = require('./simcarga.js');
const tempo = +(process.argv[2] || 2500);
function T(name,l,w,h,qty,ent){ ent=ent||1; return {name,l,w,h,qty,weight:0,mode:'auto',estrado:100,color:0,sl:l,sw:w,st:1,entrega:ent,grupo:-ent}; }
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
  ['20ST misto', ST, false, [T('A',1860,1360,900,8),T('B',1200,800,1000,10)], {portaH:2280}, 13],
];
// cargas reais analisadas (testes/dados/reais): o mínimo esperado fica em esperado.json (npm run analisar -- --gravar)
const dirReais = path.join(__dirname,'dados','reais');
const esperado = fs.existsSync(path.join(dirReais,'esperado.json')) ? JSON.parse(fs.readFileSync(path.join(dirReais,'esperado.json'),'utf8')) : {};
for (const arq of Object.keys(esperado)){
  const dr = sim.ler(fs.readFileSync(path.join(dirReais,arq),'utf8')), u = dr.unidade;
  casos.push(['Real: '+arq.replace(/\.txt$/,''), {l:u.l,w:u.w,h:u.h}, !!u.aberta, sim.tipos(dr),
    { ...dr.regras, folga: u.folga, maxW: u.pesoMax }, esperado[arq].minimo, true]);
}
let falhas = 0;
for (const org of [true, false]) for (const [nome,C,aberta,tipos,extra,minimo,real] of casos){
  if (real && org !== (extra.organizado !== false)) continue;   // carga real: roda uma vez, com as regras dela
  const E = carregar();
  E.setup(C, tipos, {apoio:0.8, tempo, portaH:0, porta:true, organizado:org, entregaCima:'menor', estrado:false, ...extra, tempo}, aberta);
  const P = E.run(tipos.map((t,i)=>i));
  const { erros } = conferir(E, C, aberta, tipos, P);
  const err = Object.keys(erros).filter(k=> org || k!=='camada virada');
  if ((org || real) && P.length < minimo) err.push('menos pacotes que o esperado');
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} ${org?'organizado':'livre     '} ${nome.padEnd(24)} ${P.length}/${tipos.reduce((s,t)=>s+t.qty,0)}  ${E.info().estrategia}${err.length?'  → '+err.join(', '):''}`);
}
console.log(falhas ? `\n${falhas} cenário(s) com problema.` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
