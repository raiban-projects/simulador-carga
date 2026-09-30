// Lê e escreve o texto "SIMCARGA {...}" do botão "📋 Copiar p/ análise".
const COLORS = [0x4f83cc, 0xe0793e, 0x5aa469, 0xc25b8f, 0xd4b13a, 0x7c6bc4, 0x4bafa8, 0xb85c5c];   // as mesmas do site

// acha o JSON depois de "SIMCARGA" mesmo com texto antes/depois (mensagem colada na conversa)
function ler(txt){
  const i = txt.indexOf('SIMCARGA'); if (i < 0) throw new Error('Não achei "SIMCARGA" no texto.');
  const a = txt.indexOf('{', i); let prof = 0, dentro = false, esc = false;
  for (let k = a; k < txt.length; k++){
    const c = txt[k];
    if (dentro){ if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') dentro = false; continue; }
    if (c === '"') dentro = true; else if (c === '{') prof++;
    else if (c === '}' && --prof === 0) return JSON.parse(txt.slice(a, k + 1));
  }
  throw new Error('Texto SIMCARGA incompleto (cortado no meio?).');
}

// produtos do texto → TYPES do motor (igual ao readTypes do site)
function tipos(d){
  const cima = (d.regras && d.regras.entregaCima) || 'menor';
  return d.produtos.map((p, i)=>{
    const ent = p.entrega || 1;
    const base = p.base != null ? p.base : (p.h > 100 ? 100 : 0);
    return { name: p.nome || ('Produto ' + (i+1)), l: p.l, w: p.w, h: p.h, qty: p.qtd, weight: p.peso || 0, mode: p.modo || 'auto',
      estrado: base, color: p.cor != null ? p.cor : COLORS[i % COLORS.length], sl: p.sl || p.l, sw: p.sw || p.w, st: p.st || 1,
      cargoVol: 0, entrega: ent, grupo: cima === 'maior' ? ent : -ent, ...(p.naoTomba ? { naoTomba: true } : {}) };
  });
}

// peças do texto ([produto, x, y, z, l, w, h]) → peças do motor
function pecas(d, T){
  return (d.pecas || []).map(([type, x, y, z, l, w, h])=> ({ type, x, y, z, l, w, h, weight: (T[type] && T[type].weight) || 0 }));
}

// mesmo texto, com outras peças e a origem marcada (p/ colar no site em "📥 Colar carga")
function escrever(d, P, origem){
  const r = Math.round;
  return 'SIMCARGA ' + JSON.stringify({ ...d, origem: origem || d.origem || null,
    pecas: P.map(p=> [p.type, r(p.x), r(p.y), r(p.z), r(p.l), r(p.w), r(p.h)]) });
}

// carga salva no banco (dados.snap de modelos_carga / pieces de cargas) → mesmo formato do texto SIMCARGA
function deSnap(sn, origem){
  const n = v=> parseFloat(v) || 0;
  const cards = sn.cards || [];
  const produtos = cards.map((c, i)=> ({ i, nome: c.name, l: n(c.sl), w: n(c.sw), h: n(c.base) + n(c.spp)*n(c.st), qtd: c.qty, peso: c.weight || 0,
    modo: c.mode || 'auto', entrega: c.entrega || 1, sl: n(c.sl), sw: n(c.sw), st: n(c.st), base: n(c.base), cor: c.color }))
    .filter(p=> p.l > 0 && p.w > 0 && p.h > 0 && p.qtd > 0);
  const r = Math.round;
  return { motor: null, origem: origem || null,
    unidade: { l: n(sn.contL), w: n(sn.contW), h: n(sn.contH), aberta: !!sn.open, pesoMax: n(sn.maxW), folga: sn.folga != null ? n(sn.folga) : 20 },
    regras: sn.regras || {}, produtos,
    pecas: (sn.pieces || []).filter(p=> p.type != null && p.type < produtos.length).map(p=> [p.type, r(p.x), r(p.y), r(p.z), r(p.l), r(p.w), r(p.h)]) };
}

module.exports = { ler, tipos, pecas, escrever, deSnap, COLORS };
