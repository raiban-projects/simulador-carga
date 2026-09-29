// Analisa uma carga real: o texto do botão "📋 Copiar p/ análise" (SIMCARGA {...}).
// Roda o motor várias vezes em paralelo, confere as regras e compara com a montagem que veio no texto.
//
// Uso:  npm run analisar -- <arquivo.txt> [--rodadas 8] [--tempo 12000] [--nome carga-x] [--gravar]
//   --rodadas  quantas montagens completas do motor (cada uma com o tempo abaixo); padrão 8
//   --tempo    tempo de cada rodada em ms; padrão = o "tempo" das regras da carga (mín. 5000)
//   --gravar   guarda o mínimo de pacotes em testes/dados/reais/esperado.json (vira teste do motor)
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
  // uma rodada completa do motor (igual a um "Montar" do site, sem os modelos aprovados do banco)
  const { d, tempo } = workerData;
  d.regras = { ...d.regras, tempo };
  const { E, T } = preparar(d);
  const P = E.run(T.map((t,i)=> i));
  const info = E.info();
  parentPort.postMessage({ P, info: { score: info.score, estrategia: info.estrategia, runs: info.runs, ms: info.ms, sobra: info.sobra, porPeso: info.porPeso } });
  return;
}

const args = process.argv.slice(2);
const opc = (k, pad)=>{ const i = args.indexOf('--'+k); return i >= 0 ? args[i+1] : pad; };
const comValor = ['--rodadas', '--tempo', '--nome'];
const arquivo = args.find((a, i)=> !a.startsWith('--') && !comValor.includes(args[i-1]));
if (!arquivo){ console.log('Uso: npm run analisar -- <arquivo.txt> [--rodadas 8] [--tempo 12000] [--nome carga-x] [--gravar]'); process.exit(1); }
const d = sim.ler(fs.readFileSync(arquivo, 'utf8'));
const nome = opc('nome', path.basename(arquivo).replace(/\.[^.]+$/, ''));
const rodadas = Math.max(1, +opc('rodadas', 8));
const tempo = Math.max(1000, +opc('tempo', Math.max(5000, (d.regras && d.regras.tempo) || 5000)));
const paralelo = Math.max(1, Math.min(rodadas, os.cpus().length));

const { E, C, T, aberta } = preparar(d);
const ORG = d.regras.organizado !== false;
const pedidos = T.reduce((s,t)=> s+t.qty, 0);

(async ()=>{
  const t0 = Date.now();
  console.log(`Carga "${nome}": ${T.length} produto(s), ${pedidos} pacotes, ${aberta?'carreta aberta':'fechada'} ${C.l}×${C.w}×${C.h} mm`);
  console.log(`Rodando o motor ${rodadas}× (${(tempo/1000).toFixed(0)} s cada, ${paralelo} ao mesmo tempo)…`);
  const res = []; let prox = 0;
  await Promise.all(Array.from({ length: paralelo }, async ()=>{
    while (prox < rodadas){
      const k = prox++;
      const r = await new Promise((ok, falha)=>{ const w = new Worker(__filename, { workerData: { d, tempo } }); w.once('message', ok); w.once('error', falha); });
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
  const recebida = sim.pecas(d, T);
  if (recebida.length){
    const org = d.origem && d.origem.tipo;
    const deOnde = { motor:'montada pelo motor no site', memoria:'da memória do navegador', aprovada:'montagem aprovada', analise:'resultado de análise anterior' }[org] || 'montagem da tela (manual ou corrigida)';
    montagens.push({ titulo: 'Montagem recebida', sub: deOnde, P: recebida, conf: conferir(E, C, aberta, T, recebida) });
  }

  const dir = path.join(__dirname, '..', 'analises', nome); fs.mkdirSync(dir, { recursive: true });
  const resultado = sim.escrever(d, melhor.P, { tipo: 'analise', nome, rodadas, estrategia: melhor.info.estrategia });
  fs.writeFileSync(path.join(dir, 'resultado.txt'), resultado + '\n');
  const html = require('./relatorio.js')({ nome, d, T, C, aberta, teto: E.teto(), montagens, resultado, pedidos,
    resumo: { rodadas, tempo, contagens, estrategias: [...new Set(res.map(r=> r.info.estrategia))], ms: Date.now()-t0 } });
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
    if (path.resolve(arquivo) !== path.resolve(destino)) fs.copyFileSync(arquivo, destino);
    const fe = path.join(dr, 'esperado.json');
    const esp = fs.existsSync(fe) ? JSON.parse(fs.readFileSync(fe, 'utf8')) : {};
    // o motor tem sorteio: aceita 1 pacote a menos que o pior resultado sem erro desta análise
    const ok = res.filter(r=> !Object.keys(r.conf.erros).length).map(r=> r.P.length);
    esp[nomeArq] = { minimo: Math.max(0, (ok.length ? Math.min(...ok) : 0) - 1), melhor: melhor.P.length, pedidos, data: new Date().toISOString().slice(0,10) };
    fs.writeFileSync(fe, JSON.stringify(esp, null, 2) + '\n');
    console.log(`Guardada como teste: testes/dados/reais/${nomeArq} (mínimo ${esp[nomeArq].minimo})`);
  }
})().catch(e=>{ console.error(e.stack || e); process.exit(1); });
