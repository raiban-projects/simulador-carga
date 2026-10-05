// Confere uma montagem pronta contra as regras físicas e combinadas com a produção.
// Usado pelos cenários de teste (cenarios.js) e pelo analisador de cargas reais (analisar.js).
//   E  = motor carregado (motor.js) já com setup feito
//   P  = peças na posição final (como aparecem na tela)
// Devolve { erros: {regra: quantidade}, m: métricas p/ comparar montagens }
function conferir(E, C, aberta, T, P){
  const erros = {}; const erro = k=> erros[k] = (erros[k]||0) + 1;
  const teto = E.teto();
  const ordem = E.ordem(P);                      // ordem de carregamento (porta: nada pode bloquear)
  ordem.forEach((p, i)=>{
    if (p.x<-0.5||p.y<-0.5||p.x+p.l>C.l+0.5||p.y+p.w>C.w+0.5) erro('parede');
    if (p.z+p.h>teto+0.5) erro('teto');
    for (let j=0;j<i;j++){ const q=ordem[j]; if (p.x<q.x+q.l-0.5&&p.x+p.l>q.x+0.5&&p.y<q.y+q.w-0.5&&p.y+p.w>q.y+0.5&&p.z<q.z+q.h-0.5&&p.z+p.h>q.z+0.5) erro('sobreposição'); }
    if (p.z>0.5){ const a=E.apoio(P.filter(q=>q!==p),p); if (a.frac<0.79||!a.ok) erro('apoio'); }
    if (!aberta && ordem.slice(0,i).some(q=> q.x>=p.x+p.l-0.5 && q.y<p.y+p.w-0.5 && q.y+q.w>p.y+0.5 && q.z<p.z+p.h-0.5)) erro('porta');
  });
  if (!E.entregaOk(P)) erro('entrega');
  // camada: 1 no chão; em cima, 1 + a camada mais alta de quem está embaixo
  const nivel = new Map(); const porZ = P.slice().sort((a,b)=> a.z-b.z);
  let virados = 0, tomb = 0, deP = 0, maiorEmCima = 0;
  for (const p of porZ){
    if (p.z < 0.5){ nivel.set(p, 1); }
    else {
      const a = E.apoio(P.filter(q=>q!==p), p);
      nivel.set(p, 1 + Math.max(0, ...a.sup.map(q=> nivel.get(q)||1)));
      // mesmo produto em cima de um igual, em outra posição (camada "virada") — a amarração do container
      // (deitado ↔ de lado, o mesmo pacote girado no comprimento) é como a produção monta e não conta
      if (a.sup.length && a.sup.every(q=>q.type===p.type) && a.sup.some(q=> Math.abs(q.h-p.h)>1||Math.abs(q.l-p.l)>1) && !E.amarra(p, a.sup)) virados++;
      if (a.sup.length===1 && (p.l > a.sup[0].l+1 || p.w > a.sup[0].w+1)) maiorEmCima++;
    }
    const t = T[p.type]; if (t){ if (E.dePe(t,p)) deP++; else if (E.tombado(t,p)) tomb++; }
  }
  if (virados) erros['camada virada'] = virados;
  const cg = P.length ? E.cg(P) : { x:0, y:0, fracFrente:0.5 };
  const porTipo = {}; P.forEach(p=> porTipo[p.type] = (porTipo[p.type]||0) + 1);
  const m = {
    n: P.length, pedidos: T.reduce((s,t)=> s+t.qty, 0), porTipo,
    camadas: P.length ? Math.max(...nivel.values()) : 0,
    alturaMax: P.length ? Math.max(...P.map(p=> p.z+p.h)) : 0,
    compUsado: P.length ? Math.max(...P.map(p=> p.x+p.l)) - Math.min(...P.map(p=> p.x)) : 0,
    tombados: tomb, dePe: deP, maiorEmCima,
    cgX: cg.x, cgY: cg.y, eixo: aberta ? E.eixo() : null, fracFrente: cg.fracFrente,
  };
  return { erros, m, nivel };
}
module.exports = { conferir };
