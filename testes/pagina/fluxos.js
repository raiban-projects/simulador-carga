// Testa a página inteira: montar, memória, aprovar outra carga, container, pré-definido e ferramentas manuais.
// Uso: node testes/pagina/fluxos.js      (leva ~1 min; sai com código 1 se algo falhar)
const path = require('path');
const pg = require('./navegador.js')(path.join(__dirname, '..', '..', 'index.html')); const { Q, d, cards } = pg;
const real=[['P1',1860,860,900,4,2],['P2',1960,760,900,7,2],['P3',2020,950,900,2,2],['P4',1860,1360,900,10,2],['P5',2000,1100,910,1,2],['P6',1860,1360,900,3,1],['P7',1860,1360,740,5,1],['P8',1860,860,900,4,1],['P9',1960,760,900,2,1]];
let falhas = 0;
const confere = (cond, txt)=>{ console.log((cond?'ok     ':'FALHOU ')+txt); if (!cond) falhas++; };
const orient = ()=>{ const o={}; Q("PLACEMENTS").forEach(p=>{ const k=p.l+'x'+p.w+'x'+p.h; o[k]=(o[k]||0)+1; }); return Object.keys(o).length; };
(async()=>{
  Q("document.getElementById('rgTempo').value='2000'");
  Q("presetSelect.value='custom'; applyPreset('custom'); contL.value=14000; contW.value=2400; contH.value=3000; OPEN_TOP=true;");
  cards(real); await Q("calcularComBotao()");
  confere(Q("PLACEMENTS.length")===38 && Q("PLACEMENTS.filter(isBad).length")===0, 'carreta real: 38/38 sem peça vermelha');
  await Q("calcularComBotao()"); confere(Q("ORIGEM_MONTAGEM.tipo")==='memoria', 'segunda vez vem da memória');
  cards([['A',1860,1360,900,22,1],['B',1860,860,900,21,1]]); await Q("calcularComBotao()");
  Q("abrirModelo('aprovada')"); d.getElementById('mdQuem').value='teste'; d.getElementById('mdSalvar').click(); await new Promise(r=>setTimeout(r,80));
  cards(real); await Q("calcularComBotao()");
  confere(Q("PLACEMENTS.length")===38, 'aprovar outra carga não estraga a carga real');
  // aprovar a carga real e reabrir: produtos de mesma medida em entregas diferentes voltam cada um na sua entrega
  const tipos = ()=> Q("JSON.stringify(PLACEMENTS.map(p=>[p.type,Math.round(p.x),Math.round(p.y),Math.round(p.z)]).sort())");
  const aprovadaAntes = tipos();
  Q("abrirModelo('aprovada')"); d.getElementById('mdQuem').value='teste'; d.getElementById('mdSalvar').click(); await new Promise(r=>setTimeout(r,80));
  cards([['A',1860,1360,900,22,1],['B',1860,860,900,21,1]]); await Q("calcularComBotao()");
  cards(real); await Q("calcularComBotao()");
  confere(Q("ORIGEM_MONTAGEM.tipo")==='aprovada' && tipos()===aprovadaAntes && Q("mv6EntregaOk(PLACEMENTS)"), 'aprovada reabre igual, cada pacote na sua entrega');
  const pos = ()=> Q("JSON.stringify(PLACEMENTS.map(p=>[p.type,Math.round(p.x),Math.round(p.y),Math.round(p.z),Math.round(p.l),Math.round(p.w),Math.round(p.h)]))");
  d.getElementById('analiseBtn').click(); await new Promise(r=>setTimeout(r,50));
  const codigo = d.getElementById('analiseTxt').value, antes = pos();
  cards([['X',1000,1000,500,1,1]]); Q("PLACEMENTS=[]; refreshAll()");
  d.getElementById('colarBtn').click(); d.getElementById('colarTxt').value = 'olha essa carga:\n' + codigo; d.getElementById('colarAbrir').click();
  confere(pos()===antes && Q("TYPES.length")===9 && Q("PLACEMENTS.filter(isBad).length")===0 && Q("ORIGEM_MONTAGEM.tipo")==='colada', 'copiar p/ análise → colar carga devolve a mesma montagem');
  Q("presetSelect.value='40hc'; applyPreset('40hc')"); cards([['Chapa 540',540,370,900,252,1,'auto',0]]); await Q("calcularComBotao()");
  confere(Q("PLACEMENTS.length")===252 && orient()===1, '40HC 252 pallets numa orientação só');
  cards([['Chapa 540',540,370,900,252,1,'predef',0]]); Q("PLACEMENTS=[]"); await Q("calcularComBotao()");
  Q(`(function(){ PLACEMENTS = PLACEMENTS.slice(0,4); PLACEMENTS.forEach((p,j)=>{ p.l=900; p.w=370; p.h=540; p.x=0; p.y=j*390; p.z=0; }); refreshAll(); })()`);
  await Q("calcularComBotao()");
  confere(Q("PLACEMENTS.length")===252 && orient()===1 && Q("PLACEMENTS[0].h")===540, 'pré-definido segue a orientação montada à mão');
  Q("SELECTED.clear(); SELECTED.add(PLACEMENTS[0].id); renderSelPanel();"); d.getElementById('btnTombX').click(); d.getElementById('btnRot').click();
  Q("PLACEMENTS[5].z+=500; SELECTED.clear(); SELECTED.add(PLACEMENTS[5].id); renderSelPanel();"); const z0 = Q("PLACEMENTS[5].z"); d.getElementById('btnDrop').click();
  confere(Q("PLACEMENTS[5].z") < z0, 'girar / tombar / encostar funcionam');
  console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})().catch(e=>{ console.log('FALHOU', e.stack); process.exit(1); });
