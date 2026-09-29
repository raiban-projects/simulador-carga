// Relatório HTML (um arquivo só, sem internet) da análise de uma carga real:
// resumo, vista de lado, planta camada por camada e o código p/ abrir o resultado no site.
const sim = require('./simcarga.js');
const esc = s=> String(s==null?'':s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const cor = c=> '#' + (c>>>0).toString(16).padStart(6, '0');
const mil = v=> Math.round(v).toLocaleString('pt-BR');
const m2 = v=> (v/1000).toFixed(2).replace('.', ',');

module.exports = function relatorio({ nome, d, T, C, aberta, teto, montagens, resultado, pedidos, resumo }){
  const variasEnt = new Set(T.map(t=> t.entrega)).size > 1;
  const rot = ti=> 'P' + (ti+1);
  const frente = aberta ? 'Frente (engate)' : 'Frente do container';
  const tras = aberta ? 'Traseira' : 'Porta';

  // vista de lado: comprimento na horizontal, altura na vertical (o lado mais perto por cima)
  function lado(P){
    const H = Math.max(teto || C.h, ...P.map(p=> p.z+p.h)), mg = 60;
    const r = P.slice().sort((a,b)=> (b.y+b.w) - (a.y+a.w)).map(p=>
      `<rect x="${p.x}" y="${H-p.z-p.h}" width="${p.l}" height="${p.h}" fill="${cor(T[p.type].color)}" stroke="var(--bg)" stroke-width="30"/>`).join('');
    const tetoL = teto && teto < H + 1 ? `<line x1="0" x2="${C.l}" y1="${H-teto}" y2="${H-teto}" class="tracejado"/>` : '';
    const eixo = aberta ? `<line x1="${C.l*0.78}" x2="${C.l*0.78}" y1="${H}" y2="${H+180}" class="eixo"/><circle cx="${C.l*0.78}" cy="${H+200}" r="110" class="eixo"/>` : '';
    return `<svg class="lado" viewBox="${-mg} ${-mg} ${C.l+2*mg} ${H+2*mg+260}" role="img" aria-label="Vista de lado">
      <rect x="0" y="0" width="${C.l}" height="${H}" class="caixa"/>${tetoL}${r}
      <line x1="0" x2="${C.l}" y1="${H}" y2="${H}" class="chao"/>${eixo}</svg>
      <div class="pontas"><span>← ${frente}</span><span>${tras} →</span></div>`;
  }

  // planta: uma faixa por camada (frente em cima, traseira/porta embaixo); a camada de baixo aparece tracejada
  function planta(P, nivel){
    const K = Math.max(0, ...P.map(p=> nivel.get(p)));
    const gap = 500, topo = 420, W = C.w, L = C.l;
    let s = '';
    for (let k=1; k<=K; k++){
      const ox = (k-1)*(W+gap);
      s += `<text x="${ox + W/2}" y="${-topo/2}" class="tit" text-anchor="middle" dominant-baseline="middle">Camada ${k}</text>`;
      s += `<rect x="${ox}" y="0" width="${W}" height="${L}" class="caixa"/>`;
      P.filter(p=> nivel.get(p) === k-1).forEach(p=>{ s += `<rect x="${ox+p.y}" y="${p.x}" width="${p.w}" height="${p.l}" class="baixo"/>`; });
      P.filter(p=> nivel.get(p) === k).forEach(p=>{
        const fs = Math.max(110, Math.min(280, Math.min(p.w, p.l)*0.3)), cx = ox+p.y+p.w/2, cy = p.x+p.l/2;
        const t = T[p.type], deLado = Math.abs(p.h - t.h) > 1;
        s += `<rect x="${ox+p.y}" y="${p.x}" width="${p.w}" height="${p.l}" fill="${cor(t.color)}" stroke="var(--bg)" stroke-width="30"><title>${esc(t.name)} · ${mil(p.l)}×${mil(p.w)}×${mil(p.h)} · altura ${mil(p.z)}</title></rect>`;
        s += `<text x="${cx}" y="${cy - (variasEnt ? fs*0.45 : 0)}" class="rot" font-size="${fs}" text-anchor="middle" dominant-baseline="middle">${rot(p.type)}${deLado ? '↻' : ''}</text>`;
        if (variasEnt) s += `<text x="${cx}" y="${cy + fs*0.65}" class="rot" font-size="${fs*0.75}" text-anchor="middle" dominant-baseline="middle">E${t.entrega}</text>`;
      });
      if (aberta) s += `<line x1="${ox-60}" x2="${ox+W+60}" y1="${L*0.78}" y2="${L*0.78}" class="eixo"/>`;   // por cima dos pacotes
    }
    const larg = K*(W+gap) - gap;
    return `<svg class="planta" viewBox="-80 ${-topo} ${larg+160} ${L+topo+80}" style="--n:${K}" role="img" aria-label="Planta por camada">${s}</svg>`;
  }

  const erroTxt = e=> Object.entries(e).map(([k,v])=> `${k} (${v})`).join(', ');
  const cards = montagens.map(mt=>{
    const m = mt.conf.m, e = erroTxt(mt.conf.erros), falta = pedidos - mt.P.length;
    const eq = aberta ? `centro de peso a ${m2(Math.abs(m.cgX - m.eixo))} m do eixo` : `peso ${Math.round(m.fracFrente*100)}% frente / ${100-Math.round(m.fracFrente*100)}% porta`;
    return `<div class="card${mt.destaque?' dest':''}">
      <div class="ct">${esc(mt.titulo)}</div><div class="cs">${esc(mt.sub||'')}</div>
      <div class="big">${mt.P.length}<small>/${pedidos} pacotes</small></div>
      ${falta>0 ? `<div class="aviso">sobraram ${falta}</div>` : '<div class="ok">coube tudo</div>'}
      <ul><li>${m.camadas} camada(s) · altura ${m2(m.alturaMax)} m</li><li>comprimento usado ${m2(m.compUsado)} m</li>
      <li>${m.tombados} de lado · ${m.dePe} em pé</li><li>${eq}${T.some(t=>t.weight>0)?'':' (peso estimado)'}</li></ul>
      <div class="${e?'erro':'ok'}">${e ? '⚠ '+esc(e) : '✓ regras físicas ok'}</div></div>`;
  }).join('');

  const tabela = `<table><thead><tr><th>Produto</th><th>Medidas (mm)</th>${variasEnt?'<th>Entrega</th>':''}<th>Pedido</th>${montagens.map(mt=>`<th>${esc(mt.titulo)}</th>`).join('')}</tr></thead><tbody>
    ${T.map((t,i)=> `<tr><td><span class="sw" style="background:${cor(t.color)}"></span><b>${rot(i)}</b> ${esc(t.name)}</td><td>${mil(t.l)}×${mil(t.w)}×${mil(t.h)}</td>${variasEnt?`<td>${t.entrega}</td>`:''}<td>${t.qty}</td>
      ${montagens.map(mt=>{ const n = mt.conf.m.porTipo[i]||0; return `<td class="${n<t.qty?'falta':''}">${n}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table>`;

  const r = d.regras || {};
  const regras = [`apoio ${Math.round((r.apoio||0.8)*100)}%`, r.organizado===false ? 'caber mais em 1º lugar' : 'organização em 1º lugar',
    variasEnt ? (r.entregaCima==='maior' ? 'entrega de nº maior em cima' : 'entrega 1 em cima') : null,
    !aberta && r.porta ? `porta livre${r.portaH?` (altura ${mil(r.portaH)} mm)`:''}` : null, r.pesado ? 'pesado embaixo' : null].filter(Boolean).join(' · ');

  const secoes = montagens.map((mt, i)=> `<section><h2>${esc(mt.titulo)} <small>${mt.P.length}/${pedidos} · ${esc(mt.sub||'')}</small></h2>
    <div class="abrir"><button class="cp" data-alvo="c${i}">📋 Copiar código desta montagem</button> <small>no site: 📥 Colar carga → ver em 3D</small>
    <textarea id="c${i}" readonly hidden>${esc(sim.escrever(d, mt.P, { tipo: 'analise', nome: nome + ' — ' + mt.titulo }))}</textarea></div>
    <h3>Vista de lado</h3>${lado(mt.P)}
    <h3>Planta por camada <small>(${esc(frente.toLowerCase())} em cima${aberta?', linha = eixo':''}; ↻ = pacote de lado; tracejado = camada de baixo)</small></h3>
    <div class="rolar">${planta(mt.P, mt.conf.nivel)}</div></section>`).join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Análise de carga</title>
<style>
:root{ --bg:#f6f7f9; --panel:#fff; --text:#1d232b; --muted:#5d6773; --border:#d9dee4; --accent:#3a6ea5; --ok:#2f8a5b; --warn:#b3541e; --err:#c0392b; --faint:#9aa4af; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --bg:#15191e; --panel:#1e242b; --text:#e6e9ed; --muted:#9aa4af; --border:#333c46; --accent:#7fa8d6; --ok:#5fbf8a; --warn:#e39462; --err:#ef7a6d; --faint:#5d6773; } }
:root[data-theme="dark"]{ --bg:#15191e; --panel:#1e242b; --text:#e6e9ed; --muted:#9aa4af; --border:#333c46; --accent:#7fa8d6; --ok:#5fbf8a; --warn:#e39462; --err:#ef7a6d; --faint:#5d6773; }
*{ box-sizing:border-box; } body{ margin:0; background:var(--bg); color:var(--text); font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
main{ max-width:980px; margin:0 auto; padding:20px 16px 48px; }
h1{ font-size:22px; margin:0 0 4px; } h2{ font-size:18px; margin:28px 0 8px; } h3{ font-size:14px; margin:18px 0 6px; color:var(--muted); font-weight:600; }
small{ font-weight:400; color:var(--muted); font-size:.8em; } .sub{ color:var(--muted); margin:0 0 16px; }
.cards{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
.card{ background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:14px; } .card.dest{ border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset; }
.ct{ font-weight:700; } .cs{ color:var(--muted); font-size:13px; } .big{ font-size:34px; font-weight:700; margin:6px 0 0; } .big small{ font-size:15px; }
.card ul{ margin:8px 0; padding-left:18px; color:var(--muted); font-size:13.5px; }
.ok{ color:var(--ok); font-weight:600; } .aviso{ color:var(--warn); font-weight:600; } .erro{ color:var(--err); font-weight:600; }
section{ background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:4px 14px 14px; margin-top:16px; } section h2{ margin-top:12px; }
svg{ display:block; width:100%; height:auto; } svg.planta{ max-width:calc(var(--n) * 150px + 40px); min-width:calc(var(--n) * 64px); }
.rolar{ overflow-x:auto; }
.caixa{ fill:none; stroke:var(--muted); stroke-width:25; } .chao{ stroke:var(--text); stroke-width:40; } .baixo{ fill:none; stroke:var(--faint); stroke-width:22; stroke-dasharray:70 55; }
.tracejado{ stroke:var(--err); stroke-width:20; stroke-dasharray:120 80; } .eixo{ stroke:var(--warn); stroke-width:35; fill:none; stroke-dasharray:140 70; }
.tit{ fill:var(--text); font-size:230px; font-weight:700; } .rot{ fill:#fff; font-weight:700; paint-order:stroke; stroke:rgba(0,0,0,.35); stroke-width:22; }
.pontas{ display:flex; justify-content:space-between; color:var(--muted); font-size:12.5px; }
table{ width:100%; border-collapse:collapse; font-size:14px; background:var(--panel); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
th,td{ white-space:nowrap; padding:7px 9px; border-bottom:1px solid var(--border); text-align:left; } th{ color:var(--muted); font-weight:600; font-size:12.5px; } td.falta{ color:var(--warn); font-weight:700; }
.tab{ overflow-x:auto; margin-top:16px; } .sw{ display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
textarea{ width:100%; height:90px; font:11px/1.3 ui-monospace,Menlo,Consolas,monospace; background:var(--bg); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:8px; }
button{ background:var(--accent); color:#fff; border:0; border-radius:8px; padding:9px 14px; font-weight:600; font-size:14px; cursor:pointer; margin-top:8px; }
.abrir{ margin:4px 0 6px; } .abrir textarea{ margin-top:6px; } .abrir button{ margin-top:0; }
footer{ color:var(--muted); font-size:12.5px; margin-top:24px; }
</style></head><body><main>
<h1>${esc(nome)}</h1>
<p class="sub">${aberta?'Carreta aberta':'Unidade fechada'} ${m2(C.l)} × ${m2(C.w)} × ${m2(C.h)} m · ${pedidos} pacotes · ${esc(regras)}</p>
<div class="cards">${cards}</div>
<div class="tab">${tabela}</div>
${secoes}
<section><h2>Abrir no site</h2><p class="sub" style="margin:0 0 8px">No simulador, toque em <b>📥 Colar carga</b> e cole o código abaixo: a melhor montagem aparece em 3D, pronta para conferir e aprovar (👍).</p>
<textarea id="cod" readonly>${esc(resultado)}</textarea><button class="cp" data-alvo="cod">Copiar código</button></section>
<footer>${esc(resumo.banco||'')}<br>${resumo.rodadas} rodadas de ${Math.round(resumo.tempo/1000)} s · pacotes por rodada: ${resumo.contagens.join(', ')} · formas: ${esc(resumo.estrategias.join(', '))} · ${new Date().toLocaleString('pt-BR')}</footer>
</main><script>
document.querySelectorAll('button.cp').forEach(function(b){ b.onclick = async function(){ var t = document.getElementById(b.dataset.alvo);
  try { await navigator.clipboard.writeText(t.value); b.textContent = 'Copiado! Cole no site em 📥 Colar carga'; } catch(e){ t.hidden = false; t.focus(); t.select(); b.textContent = 'Selecionado: copie (Ctrl+C)'; } }; });
</script></body></html>`;
};
