// Analisa uma carga real: o texto do botão "📋 Copiar p/ análise" (SIMCARGA {...}).
// Roda o motor várias vezes em paralelo, confere as regras e compara com a montagem que veio no texto.
//
// Uso:  npm run analisar -- <arquivo.txt> [--rodadas 8] [--tempo 12000] [--nome carga-x] [--gravar]
//   --rodadas  quantas montagens completas do motor (cada uma com o tempo abaixo); padrão 8
//   --tempo    tempo de cada rodada em ms; padrão = o "tempo" das regras da carga (mín. 5000)
//   --gravar   guarda o mínimo de pacotes em testes/dados/reais/esperado.json (vira teste do motor)
//   --sem-banco não lê as montagens aprovadas/rejeitadas do Supabase
//   --modelo <id>  em vez de arquivo: analisa uma montagem aprovada/rejeitada do banco (tabela modelos_carga)
//   --modelos      lista as montagens aprovadas/rejeitadas do banco
// Saída: analises/<nome>/relatorio.html (desenhos) e analises/<nome>/resultado.txt (colar no site)
const fs = require('fs'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const carregar = require('./motor.js');
const sim = require('./simcarga.js');
const { conferir } = require('./regras.js');

function preparar(d){
  const u = d.unidade, C = { l:u.l, w:u.w, h:u.h }, T = sim.tipos(d);
  const E = carregar();
  E.setup(C, T, { ...d.regras, folga: u.folga, maxW: u.pesoMax }, !!u.aberta);
  return { E, C, T, aberta: !!u.aberta };
}

if (!isMainThread){
  // uma rodada completa do motor (igual a um "Montar" do site, com os modelos aprovados/rejeitados do banco)
  const { d, tempo, conhecimento } = workerData;
  d.regras = { ...d.regras, tempo };
  const { E, T } = preparar(d);
  const P = E.run(T.map((t,i)=> i), { conhecimento });
  const info = E.info();
  parentPort.postMessage({ P, info: { score: info.score, estrategia: info.estrategia, runs: info.runs, ms: info.ms, sobra: info.sobra, porPeso: info.porPeso } });
  return;
}

const args = process.argv.slice(2);
const opc = (k, pad)=>{ const i = args.indexOf('--'+k); return i >= 0 ? args[i+1] : pad; };
const comValor = ['--rodadas', '--tempo', '--nome', '--modelo'];
const arquivo = args.find((a, i)=> !a.startsWith('--') && !comValor.includes(args[i-1]));
if (args.includes('--modelos')){
  const b = require('./banco.js')(); if (!b.modelos){ console.log('Sem acesso ao banco: ' + b.erro); process.exit(1); }
  b.modelos.forEach(m=>{ const u = (m.dados && m.dados.unidade) || {}, n = (m.dados && m.dados.plano || []).length;
    console.log(`${String(m.id).padStart(4)}  ${m.status==='aprovada'?'✅':'⛔'} ${m.nome}  · ${m.saved_by||'—'} · ${(m.created_at||'').slice(0,10)} · ${n} pacotes · ${u.l}×${u.w} ${u.open?'aberta':'fechada'}${m.motivo?' · '+m.motivo:''}`); });
  process.exit(0);
}
let d, nomePadrao;
if (opc('modelo')){
  const b = require('./banco.js')(); if (!b.modelos){ console.log('Sem acesso ao banco: ' + b.erro); process.exit(1); }
  const m = b.modelos.find(x=> String(x.id) === String(opc('modelo')));
  if (!m || !m.dados || !m.dados.snap){ console.log('Não achei a montagem ' + opc('modelo') + ' (veja a lista com --modelos).'); process.exit(1); }
  d = sim.deSnap(m.dados.snap, { tipo: m.status, nome: m.nome });
  nomePadrao = 'modelo-' + m.id + '-' + m.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
} else {
  if (!arquivo){ console.log('Uso: npm run analisar -- <arquivo.txt> [--rodadas 8] [--tempo 12000] [--nome carga-x] [--gravar]  |  --modelos  |  --modelo <id>'); process.exit(1); }
  d = sim.ler(fs.readFileSync(arquivo, 'utf8'));
  nomePadrao = path.basename(arquivo).replace(/\.[^.]+$/, '');
}
const nome = opc('nome', nomePadrao);
const rodadas = Math.max(1, +opc('rodadas', 8));
const tempo = Math.max(1000, +opc('tempo', Math.max(5000, (d.regras && d.regras.tempo) || 5000)));
const paralelo = Math.max(1, Math.min(rodadas, os.cpus().length));

const { E, C, T, aberta } = preparar(d);
const ORG = d.regras.organizado !== false;
const pedidos = T.reduce((s,t)=> s+t.qty, 0);
// montagens da produção (as mesmas que o site usa): só desempatam; e se esta carga já foi aprovada, o site mostra a aprovada
const banco = args.includes('--sem-banco') ? { modelos: null, erro: 'desligado (--sem-banco)' } : require('./banco.js')();
const daUnidade = banco.modelos ? E.modelosDaUnidade(banco.modelos) : [];
const conhecimento = banco.modelos ? E.conhecimento(banco.modelos) : null;
const aprovada = banco.modelos ? E.aprovada(banco.modelos) : null;
const bancoTxt = banco.modelos
  ? `${daUnidade.filter(m=> m.status==='aprovada').length} aprovada(s) e ${daUnidade.filter(m=> m.status!=='aprovada').length} rejeitada(s) desta unidade (de ${banco.modelos.length} no banco)`
  : 'sem as montagens do banco: ' + banco.erro;

(async ()=>{
  const t0 = Date.now();
  console.log(`Carga "${nome}": ${T.length} produto(s), ${pedidos} pacotes, ${aberta?'carreta aberta':'fechada'} ${C.l}×${C.w}×${C.h} mm`);
  console.log(`Montagens da produção: ${bancoTxt}`);
  console.log(`Rodando o motor ${rodadas}× (${(tempo/1000).toFixed(0)} s cada, ${paralelo} ao mesmo tempo)…`);
  const res = []; let prox = 0;
  await Promise.all(Array.from({ length: paralelo }, async ()=>{
    while (prox < rodadas){
      const k = prox++;
      const r = await new Promise((ok, falha)=>{ const w = new Worker(__filename, { workerData: { d, tempo, conhecimento } }); w.once('message', ok); w.once('error', falha); });
      r.k = k + 1; r.conf = conferir(E, C, aberta, T, r.P); res.push(r);
      const ne = Object.keys(r.conf.erros).length;
      console.log(`  rodada ${String(r.k).padStart(2)}: ${r.P.length}/${pedidos} pacotes · ${r.info.estrategia} · nota ${Math.round(r.info.score)}${ne ? ' · ERRO: '+Object.keys(r.conf.erros).join(', ') : ''}`);
    }
  }));
  // melhor: sem erro de regra; depois a nota do motor (ou nº de pacotes, se "organização em 1º lugar" estiver desligada)
  const chave = r=> [Object.keys(r.conf.erros).length ? 0 : 1, ORG ? 0 : r.P.length, r.info.score];
  res.sort((a,b)=>{ const ka = chave(a), kb = chave(b); for (let i=0;i<ka.length;i++) if (ka[i]!==kb[i]) return kb[i]-ka[i]; return 0; });
  const melhor = res[0];
  const contagens = res.map(r=> r.P.length);

  const montagens = [{ titulo: 'Melhor do motor', sub: `rodada ${melhor.k} de ${rodadas} · ${melhor.info.estrategia}`, P: melhor.P, conf: melhor.conf, destaque: true }];
  if (aprovada) montagens.push({ titulo: 'Aprovada pela produção', sub: `"${aprovada.nome}"${aprovada.por ? ' · '+aprovada.por : ''} · é a que o site mostra`, P: aprovada.P, conf: conferir(E, C, aberta, T, aprovada.P) });
  const recebida = sim.pecas(d, T);
  if (recebida.length){
    const org = d.origem && d.origem.tipo;
    const deOnde = { motor:'montada pelo motor no site', memoria:'da memória do navegador', aprovada:'montagem aprovada', rejeitada:'montagem rejeitada pela produção', analise:'resultado de análise anterior' }[org] || 'montagem da tela (manual ou corrigida)';
    const igual = (A, B)=> A.length === B.length && A.every((p,i)=> ['type','x','y','z','l','w','h'].every(k=> Math.abs(p[k]-B[i][k]) < 1));
    if (!(aprovada && igual(recebida, aprovada.P))) montagens.push({ titulo: 'Montagem recebida', sub: deOnde, P: recebida, conf: conferir(E, C, aberta, T, recebida) });
  }

  const dir = path.join(__dirname, '..', 'analises', nome); fs.mkdirSync(dir, { recursive: true });
  const resultado = sim.escrever(d, melhor.P, { tipo: 'analise', nome, rodadas, estrategia: melhor.info.estrategia });
  fs.writeFileSync(path.join(dir, 'resultado.txt'), resultado + '\n');
  const html = require('./relatorio.js')({ nome, d, T, C, aberta, teto: E.teto(), montagens, resultado, pedidos,
    resumo: { rodadas, tempo, banco: bancoTxt, contagens, estrategias: [...new Set(res.map(r=> r.info.estrategia))], ms: Date.now()-t0 } });
  fs.writeFileSync(path.join(dir, 'relatorio.html'), html);

  console.log(`\nMelhor: ${melhor.P.length}/${pedidos} pacotes (rodada ${melhor.k}, ${melhor.info.estrategia}); variação entre rodadas: ${Math.min(...contagens)} a ${Math.max(...contagens)}`);
  for (const mt of montagens){
    const e = Object.entries(mt.conf.erros).map(([k,v])=> `${k} (${v})`).join(', ');
    console.log(`  ${mt.titulo.padEnd(18)} ${mt.P.length}/${pedidos} · ${mt.conf.m.camadas} camada(s) · altura ${mt.conf.m.alturaMax} mm · ${e ? 'ERROS: '+e : 'regras ok'}`);
  }
  console.log(`\nRelatório: ${path.relative(process.cwd(), path.join(dir, 'relatorio.html'))}`);
  console.log(`Para abrir no site (📥 Colar carga): ${path.relative(process.cwd(), path.join(dir, 'resultado.txt'))}`);

  if (args.includes('--gravar')){
    const dr = path.join(__dirname, 'dados', 'reais'); fs.mkdirSync(dr, { recursive: true });
    const nomeArq = nome + '.txt', destino = path.join(dr, nomeArq);
    if (!arquivo) fs.writeFileSync(destino, sim.escrever(d, sim.pecas(d, T), d.origem) + '\n');   // veio do banco
    else if (path.resolve(arquivo) !== path.resolve(destino)) fs.copyFileSync(arquivo, destino);
    const fe = path.join(dr, 'esperado.json');
    const esp = fs.existsSync(fe) ? JSON.parse(fs.readFileSync(fe, 'utf8')) : {};
    // o motor tem sorteio: aceita 1 pacote a menos que o pior resultado sem erro desta análise
    const ok = res.filter(r=> !Object.keys(r.conf.erros).length).map(r=> r.P.length);
    // nota mínima (régua do motor, sem os modelos do banco): pega a montagem que "voltar a piorar" mesmo com o mesmo nº de pacotes
    const notas = res.filter(r=> !Object.keys(r.conf.erros).length).map(r=> E.nota(r.P));
    const notaMin = notas.length ? Math.floor(Math.min(...notas) - Math.abs(Math.min(...notas))*0.03) : null;
    esp[nomeArq] = { minimo: Math.max(0, (ok.length ? Math.min(...ok) : 0) - 1), notaMin, melhor: melhor.P.length, pedidos, data: new Date().toISOString().slice(0,10) };
    fs.writeFileSync(fe, JSON.stringify(esp, null, 2) + '\n');
    console.log(`Guardada como teste: testes/dados/reais/${nomeArq} (mínimo ${esp[nomeArq].minimo})`);
  }
})().catch(e=>{ console.error(e.stack || e); process.exit(1); });
