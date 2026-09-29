// Roda o motor em cargas de referência e confere as regras físicas.
// Uso: node testes/cenarios.js [tempo_ms]      (sai com código 1 se alguma regra quebrar)
const fs = require('fs'), path = require('path');
const carregar = require('./motor.js');
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
let falhas = 0;
for (const org of [true, false]) for (const [nome,C,aberta,tipos,extra,minimo] of casos){
  const E = carregar();
  E.setup(C, tipos, {apoio:0.8, tempo, portaH:0, porta:true, organizado:org, entregaCima:'menor', estrado:false, ...extra}, aberta);
  const P = E.run(tipos.map((t,i)=>i)); const teto = E.teto(); const err = [];
  P.forEach((p,i)=>{
    if (p.x<-0.5||p.y<-0.5||p.x+p.l>C.l+0.5||p.y+p.w>C.w+0.5) err.push('parede');
    if (p.z+p.h>teto+0.5) err.push('teto');
    for (let j=0;j<i;j++){ const q=P[j]; if (p.x<q.x+q.l-0.5&&p.x+p.l>q.x+0.5&&p.y<q.y+q.w-0.5&&p.y+p.w>q.y+0.5&&p.z<q.z+q.h-0.5&&p.z+p.h>q.z+0.5) err.push('sobreposição'); }
    if (p.z>0.5){ const a=E.apoio(P.filter(q=>q!==p),p); if (a.frac<0.79||!a.ok) err.push('apoio'); }
    if (!aberta && P.slice(0,i).some(q=> q.x>=p.x+p.l-0.5 && q.y<p.y+p.w-0.5 && q.y+q.w>p.y+0.5 && q.z<p.z+p.h-0.5)) err.push('porta');
  });
  if (!E.entregaOk(P)) err.push('entrega');
  // pacote do mesmo produto em cima de um igual, em outra posição (camada "virada")
  let virados = 0; P.forEach(p=>{ if (p.z<0.5) return; const a=E.apoio(P.filter(q=>q!==p),p); if (a.sup.length && a.sup.every(q=>q.type===p.type) && a.sup.some(q=> Math.abs(q.h-p.h)>1||Math.abs(q.l-p.l)>1)) virados++; });
  if (org && virados) err.push('camada virada');
  if (org && P.length < minimo) err.push('menos pacotes que o esperado');
  if (err.length) falhas++;
  console.log(`${err.length?'FALHOU':'ok    '} ${org?'organizado':'livre     '} ${nome.padEnd(24)} ${P.length}/${tipos.reduce((s,t)=>s+t.qty,0)}  ${E.info().estrategia}${err.length?'  → '+[...new Set(err)].join(', '):''}`);
}
console.log(falhas ? `\n${falhas} cenário(s) com problema.` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
