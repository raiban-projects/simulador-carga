// Carrega só o bloco <script id="motor-src"> do index.html como módulo Node, sem navegador.
const fs = require('fs'), path = require('path'), os = require('os');
global.performance = require('perf_hooks').performance;
module.exports = function carregarMotor(arquivo){
  arquivo = arquivo || path.join(__dirname, '..', 'index.html');
  const s = fs.readFileSync(arquivo, 'utf8');
  const a = s.indexOf('<script id="motor-src">') + 23, b = s.indexOf('</script>', a);
  const src = s.slice(a, b) + `
;module.exports = {
  setup(c, t, regras, aberta){ CONTAINER=c; TYPES=t; FOLGA=20; OPEN_TOP=!!aberta; EXCEED=false; MAXW=0; Object.assign(REGRAS, regras); },
  run(ids){ return motorV2(ids, [], {}); }, info(){ return MOTOR_INFO; },
  apoio: (P,p)=> mv2Apoio(P,p,20), entregaOk: P=> mv6EntregaOk(P), teto: ()=> mv2Teto() };`;
  const fn = path.join(os.tmpdir(), 'motor-' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(fn, src); const m = require(fn); fs.unlinkSync(fn); return m;
};
