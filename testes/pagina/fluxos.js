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
  // ✅ Carga finalizada: passo a passo por camada (começa vazia; cada passo mostra mais uma camada inteira)
  const visiveis = ()=> Q("PLACEMENTS.filter(p=> meshById[p.id] && meshById[p.id].visible).length");
  d.getElementById('etapasBtn').click();
  const v0 = visiveis(), t0 = d.getElementById('etTitulo').textContent, nCam = Q("ETAPAS.camadas");
  const naCamada = k=> Q(`PLACEMENTS.filter(p=> ETAPAS.nivel.get(p) <= ${k}).length`);
  d.getElementById('etProx').click();
  const v1 = visiveis(), t1 = d.getElementById('etTitulo').textContent, ok1 = v1 === naCamada(1) && v1 === Q("PLACEMENTS.filter(p=> p.z < 0.5).length");
  const b = d.getElementById('etBarra'); b.value = nCam; b.dispatchEvent(new d.defaultView.Event('input'));
  const vN = visiveis(), pronto = d.getElementById('etProx').textContent;
  d.getElementById('etProx').click();
  confere(v0===0 && /vazia/.test(t0) && t1===`Camada 1 de ${nCam}` && ok1 && vN===38 && /Pronto/.test(pronto) && !Q("ETAPAS") && visiveis()===38 && !d.body.classList.contains('etapas'),
    `carga finalizada: carreta vazia → ${nCam} camada(s), uma por passo, e "Pronto" volta ao normal`);
  const cam = Q("(()=>{ const n = camadasDe(PLACEMENTS); return [Math.max(...n.values()) >= 2, PLACEMENTS.every(p=> (p.z < 0.5) === (n.get(p)===1))].join(); })()");
  confere(cam==='true,true', 'camadas p/ o PDF: o chão é a camada 1 e o que está em cima fica nas de cima');
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
  // GRUPO geral (qualquer carga): 2 pacotes → 🔗 Juntar; tocar em 1 seleciona os 2; mover leva os 2; soltar
  Q("SELECTED.clear(); SELECTED.add(PLACEMENTS[0].id); SELECTED.add(PLACEMENTS[1].id); renderSelPanel();"); d.getElementById('btnJuntar').click();
  Q("selecionarPeca(PLACEMENTS[1].id, false); renderSelPanel();");
  const doisSel = Q("SELECTED.size"), x0 = Q("[PLACEMENTS[0].x, PLACEMENTS[1].x].join()");
  Q("PLACEMENTS.filter(p=>SELECTED.has(p.id)).forEach(p=> p.x -= 20); refreshAll();");
  const moveuJunto = Q("[PLACEMENTS[0].x, PLACEMENTS[1].x].join()") === x0.split(',').map(v=> +v - 20).join();
  const soltarTxt = d.getElementById('btnSoltar') && d.getElementById('btnSoltar').textContent;
  d.getElementById('btnSoltar').click(); Q("selecionarPeca(PLACEMENTS[1].id, false);");
  confere(doisSel===2 && moveuJunto && /Soltar/.test(soltarTxt||'') && Q("SELECTED.size")===1 && !Q("PLACEMENTS[0].grp"),
    'juntar geral: 2 pacotes quaisquer andam como 1 e soltam de novo');
  Q("MULTI_SEL=true; SELECTED.clear();"); Q("selecionarPeca(PLACEMENTS[0].id, MULTI_SEL); selecionarPeca(PLACEMENTS[2].id, MULTI_SEL);");
  confere(Q("SELECTED.size")===2, '"Selecionar vários" soma pacotes a cada toque (celular)'); Q("MULTI_SEL=false; PLACEMENTS[0].x += 20; PLACEMENTS[1].x += 20; refreshAll();");
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
  // carreta + pré-definido: o começo vai no FUNDO e o site repete a fileira que a pessoa montou (deitado + tombado)
  Q("presetSelect.value='custom'; applyPreset('custom'); contL.value=14000; contW.value=2400; contH.value=3000; OPEN_TOP=true;");
  cards([['P1',1860,1360,900,9,1,'predef'],['P2',1860,1360,780,18,1,'predef']]); Q("PLACEMENTS=[]"); await Q("calcularComBotao()");
  const noFundo = Q("PLACEMENTS.length===4 && PLACEMENTS.every(p=> p.x+p.l > 14000-4000)");
  // a pessoa arruma os 4 pacotes soltos numa parede: embaixo P2 deitado + P1 tombado, em cima o mesmo
  Q(`(function(){ const [a,a2]=PLACEMENTS.filter(p=>p.type===1), [b,b2]=PLACEMENTS.filter(p=>p.type===0);
     Object.assign(a,{x:12140,y:60,z:0,l:1860,w:1360,h:780}); Object.assign(b,{x:12140,y:1440,z:0,l:1860,w:900,h:1360});
     Object.assign(a2,{x:12140,y:60,z:800,l:1860,w:1360,h:780}); Object.assign(b2,{x:12140,y:1440,z:1380,l:1860,w:900,h:1360}); refreshAll(); })()`);
  await Q("calcularComBotao()");
  confere(noFundo && Q("PLACEMENTS.length")===27 && Q("PLACEMENTS.filter(isBad).length")===0 && Q("PLACEMENTS.filter(p=>p.type===0).every(p=>p.h===1360)"),
    'carreta pré-definida: começa no fundo e repete a fileira montada à mão');
  // JUNTAR PACOTES: 317 pacotes de 80 chapas (540×370), juntar 3 um em cima do outro → 105 volumes + 2 soltos
  Q("presetSelect.value='40hc'; applyPreset('40hc')");
  cards([['Chapa 540',540,370,820,317,1,'auto',100]]);
  const cj = [...d.querySelectorAll('.card')].pop(); cj.querySelector('.f-junta').value = 3; cj.querySelector('.f-jseg button[data-v="cima"]').click();
  Q("PLACEMENTS=[]"); await Q("calcularComBotao()");
  const contaJ = ()=> Q("JSON.stringify(TYPES.map((t,i)=> PLACEMENTS.filter(p=>p.type===i).length))");
  confere(contaJ()==='[105,2]' && Q("[TYPES[0].l,TYPES[0].w,TYPES[0].h].join('x')")==='820x540x1110' && Q("PLACEMENTS.filter(isBad).length")===0 && Q("PLACEMENTS.every(p=> p.h===1110 || p.h===370)"),
    'juntar 3 em cima: 105 volumes 820×540×1110 (cada pacote de lado, 540 sobre 540) + 2 soltos iguais, sem peça vermelha');
  Q("SELECTED.clear(); SELECTED.add(PLACEMENTS.find(p=>p.type===0).id); renderSelPanel();"); d.getElementById('btnSeparar').click();
  const sep = contaJ(), soltosSep = cj.querySelector('.f-soltos').value, selSep = Q("SELECTED.size");
  // os 3 que saíram do volume continuam selecionados: 🔗 Juntar = andam como 1 só
  Q("renderSelPanel()"); d.getElementById('btnJuntar').click();
  const g3 = Q("(()=>{ const s=PLACEMENTS.filter(p=>SELECTED.has(p.id)); return s.length===3 && s.every(p=>p.grp && p.grp===s[0].grp); })()");
  d.getElementById('undoBtn').click(); d.getElementById('undoBtn').click();
  confere(sep==='[104,5]' && soltosSep==='5' && selSep===3 && g3 && contaJ()==='[105,2]' && cj.querySelector('.f-soltos').value==='' && Q("PLACEMENTS.filter(isBad).length")===0,
    'separar volume → 3 pacotes; juntar os 3; desfazer volta ao volume');
  await Q("calcularComBotao({ forcar:true })");
  const antesJ = contaJ();
  d.getElementById('analiseBtn').click(); await new Promise(r=>setTimeout(r,50));
  const codJ = d.getElementById('analiseTxt').value;
  cards([['X',1000,1000,500,1,1]]); Q("PLACEMENTS=[]; refreshAll()");
  d.getElementById('colarTxt').value = codJ; d.getElementById('colarAbrir').click();
  const cj2 = [...d.querySelectorAll('.card')];
  confere(antesJ==='[105,2]' && contaJ()===antesJ && cj2.length===1 && cj2[0].querySelector('.f-junta').value==='3' && cj2[0].querySelector('.f-qty').value==='317',
    'montar de novo volta ao automático (junta o que der) e copiar → colar devolve os volumes juntos');
  // lado a lado / em fila (pacote de lado 820×540×370): os botões mudam o volume e nada sai da posição estável
  cards([['Chapa 540',540,370,820,150,1,'auto',100]]); const cm = [...d.querySelectorAll('.card')].pop(); cm.querySelector('.f-junta').value = 3;
  for (const [modo, dims] of [['largura','820x1620x370'], ['comprimento','2460x540x370']]){
    cm.querySelector('.f-jseg button[data-v="'+modo+'"]').click();
    Q("PLACEMENTS=[]"); await Q("calcularComBotao({ forcar:true })");
    const ok = Q("[TYPES[0].l,TYPES[0].w,TYPES[0].h].join('x')")===dims && Q("PLACEMENTS.length")===50 && Q("PLACEMENTS.every(p=> Math.abs(p.h - 370) < 1)") && Q("PLACEMENTS.filter(isBad).length")===0;
    confere(ok, `juntar ${modo==='largura'?'lado a lado':'em fila'}: volume ${dims}, 50/50, nada sai da posição estável`);
  }
  // pacote grande: em cima = o normal (skid embaixo); 3 × 900 passa da porta do 40HC → avisa
  cards([['Grande',1860,1360,900,9,1,'auto',100]]); const cg = [...d.querySelectorAll('.card')].pop(); cg.querySelector('.f-junta').value = 3;
  Q("updateComputed([...document.querySelectorAll('.card')].pop())");
  confere(Q("readTypes()[0].h")===2700 && /mais que a porta/.test(cg.querySelector('.computed').textContent), 'pacote grande em cima fica normal (2.700 mm) e avisa que passa da porta');
  // não coube tudo: a janela diz qual produto ficou de fora e por quê; peso passa do limite → só avisa (a carga sai inteira)
  Q("presetSelect.value='carreta_aberta'; applyPreset('carreta_aberta');");
  cards([['Grande',1860,1360,900,60,1]]); await Q("calcularComBotao({ forcar:true })");
  const faltouAberta = d.getElementById('faltouModal').classList.contains('open'), txtF = d.getElementById('faltouLista').textContent;
  confere(faltouAberta && /Grande/.test(txtF) && /espaço/.test(txtF) && /de 60/.test(txtF) && /ficaram de fora/.test(d.getElementById('alerta3d').textContent),
    'carga que não cabe: janela mostra o produto, quantos ficaram de fora e o motivo');
  d.getElementById('faltouModal').classList.remove('open');
  cards([['Grande',1860,1360,900,20,1]]); [...d.querySelectorAll('.card')].pop().querySelector('.f-weight').value = 1500;
  await Q("calcularComBotao({ forcar:true })");
  confere(Q("PLACEMENTS.length")===20 && /Passa do peso: \+4\.790 kg/.test(d.getElementById('alerta3d').textContent) && !d.getElementById('faltouModal').classList.contains('open'),
    'peso acima do limite: monta a carga inteira e avisa quanto passou');
  // pré-definido (40HC, 2500×1250): Montar põe 4 pacotes (2 na largura × 2 na altura) e NÃO abre o aviso; depois de preencher o aviso não manda preencher de novo
  Q("presetSelect.value='40hc'; applyPreset('40hc');"); cards([['Produto 1',2500,1250,1000,18,1,'predef']]);
  await Q("calcularComBotao({ forcar:true })");
  const pd1 = Q("PLACEMENTS.length"), popPd = d.getElementById('faltouModal').classList.contains('open');
  Q("fillPattern()");
  const pd2 = Q("PLACEMENTS.length"), txtPd = d.getElementById('faltouLista').textContent;
  d.getElementById('faltouModal').classList.remove('open');
  confere(pd1===4 && !popPd && pd2>=16 && !/Pré-definido/.test(txtPd), `pré-definido: montar dá 4 pacotes (2×2) sem aviso; preencher completa (${pd2}/18) e o aviso diz o motivo certo`);
  // padrão da pessoa no container (05/10): 4 pacotes amarrados à mão, com os "espaços de mão" (fora da linha, longe da
  // parede, um flutuando 60 mm) → Preencher arruma (alinha, encosta, assenta), repete a
  // parede amarrada e os 2 que sobram vão EM PÉ NO MEIO (o resto anda p/ a porta); "Encaixar" a partir de 16 faz o mesmo
  const sementes = [[0,0,0,2500,1000,1250],[19,1060,0,2500,1250,1000],[45,0,1330,2500,1250,1000],[0,1290,1020,2500,1000,1250]];
  Q("presetSelect.value='40hc'; applyPreset('40hc');"); cards([['Produto 1',2500,1250,1000,18,1,'predef']]); Q("TYPES=readTypes()");
  Q(`PLACEMENTS=[]; PIDSEQ=1; ${JSON.stringify(sementes)}.forEach(([x,y,z,l,w,h])=> PLACEMENTS.push(mkPiece(0,x,y,z,{l,w,h}))); refreshAll();`);
  Q("fillPattern()");
  const emPeMeio = ()=> Q("(()=>{ const e = PLACEMENTS.filter(p=> p.h > 2400), x0 = Math.min(...PLACEMENTS.map(p=>p.x)), x1 = Math.max(...PLACEMENTS.map(p=>p.x+p.l)); return e.length===2 && e.every(p=> p.x > x0+2000 && p.x+p.l < x1-2000); })()");
  const amarrou = Q("PLACEMENTS.filter(p=> p.z > 0.5 && p.h===1250).length===4 && PLACEMENTS.filter(p=> p.z > 0.5 && p.h===1000).length===4");
  const arrumou = Q("PLACEMENTS.filter(p=> p.x < 2000).every(p=> p.x===0) && PLACEMENTS.some(p=> p.x===0 && p.z===1270 && p.h===1000) && PLACEMENTS.some(p=> p.x===0 && p.y===1070)");
  confere(Q("PLACEMENTS.length")===18 && Q("PLACEMENTS.filter(isBad).length")===0 && emPeMeio() && amarrou && arrumou,
    'seguindo o padrão no container: arruma a montagem à mão, repete a parede amarrada e os 2 que sobram vão em pé no meio');
  Q("PLACEMENTS = PLACEMENTS.filter(p=> p.h <= 2400); PLACEMENTS.forEach(p=>{ if (p.x > 5000) p.x -= 1270; }); refreshAll(); encaixarSobra();");
  confere(Q("PLACEMENTS.length")===18 && Q("PLACEMENTS.filter(isBad).length")===0 && emPeMeio(), '"Encaixar onde der" no container cheio: os 2 de fora vão em pé no meio');
  d.getElementById('faltouModal').classList.remove('open');
  // opções de DEV: escondidas p/ a produção; 7 toques no título liga/desliga (fica lembrado no aparelho)
  const devAntes = d.body.classList.contains('dev');
  for (let k=0; k<7; k++) d.getElementById('tituloApp').click();
  const devLigou = d.body.classList.contains('dev');
  for (let k=0; k<7; k++) d.getElementById('tituloApp').click();
  confere(!devAntes && devLigou && !d.body.classList.contains('dev') && d.getElementById('aprovarBtn').classList.contains('dev-only'),
    'opções de DEV escondidas por padrão; 7 toques no título liga e desliga');
  console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})().catch(e=>{ console.log('FALHOU', e.stack); process.exit(1); });
