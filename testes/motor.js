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
  tombado: (t,o)=> mv3Tombado(t,o), dePe: (t,o)=> isDePe(t,o) };`;
  const fn = path.join(os.tmpdir(), 'motor-' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(fn, src); const m = require(fn); fs.unlinkSync(fn); return m;
};
