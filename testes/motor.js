// Carrega só o bloco <script id="motor-src"> do index.html como módulo Node, sem navegador.
const fs = require('fs'), path = require('path'), os = require('os');
global.performance = require('perf_hooks').performance;
module.exports = function carregarMotor(arquivo){
  arquivo = arquivo || path.join(__dirname, '..', 'index.html');
  const s = fs.readFileSync(arquivo, 'utf8');
  const a = s.indexOf('<script id="motor-src">') + 23, b = s.indexOf('</script>', a);
  const src = s.slice(a, b) + `
;module.exports = {
  // regras.folga e regras.maxW são opcionais (padrão: folga 20 mm, sem limite de peso)
  setup(c, t, regras, aberta){ CONTAINER=c; TYPES=t; FOLGA=regras.folga!=null ? regras.folga : 20; OPEN_TOP=!!aberta; EXCEED=false;
    MAXW=regras.maxW||0; const { folga, maxW, ...r } = regras; Object.assign(REGRAS, r); },
  run(ids, opts){ return motorV2(ids, [], opts || {}); }, info(){ return MOTOR_INFO; },
  apoio: (P,p)=> mv2Apoio(P,p,FOLGA), entregaOk: P=> mv6EntregaOk(P), teto: ()=> mv2Teto(),
  ordem: P=> mv3OrdemCarga(P.map(p=>({ ...p })), OPEN_TOP), eixo: ()=> eixoCarretaX(), cg: P=> calcCG(P),
  tombado: (t,o)=> mv3Tombado(t,o), dePe: (t,o)=> isDePe(t,o),
  // montagens da produção (tabela modelos_carga): o mesmo "conhecimento" que o site passa ao motor
  // nota do motor p/ uma montagem na posição final (a mesma régua para todas; sem os campos de fileira)
  nota(P, K){ const a = MV3_ALVO_X, k = MV3_K; MV3_ALVO_X = OPEN_TOP ? eixoCarretaX() : null; MV3_K = K || null;
    const s = mv3Score(P.map(({ row, W, D, ...p })=> p)); MV3_ALVO_X = a; MV3_K = k; return s; },
  modelosDaUnidade: lista=> mv3ModelosDaUnidade(lista), conhecimento: lista=> mv3Conhecimento(mv3ModelosDaUnidade(lista)),
  aprovada(lista){ const m = mv3AprovadoPara(lista, chaveCarga(true)); const P = m && mapearPlano(m.dados.plano, m.dados.snap); return P ? { nome: m.nome, por: m.saved_by, P } : null; } };`;
  const fn = path.join(os.tmpdir(), 'motor-' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(fn, src); const m = require(fn); fs.unlinkSync(fn); return m;
};
