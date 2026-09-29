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
      cargoVol: 0, entrega: ent, grupo: cima === 'maior' ? ent : -ent };
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

module.exports = { ler, tipos, pecas, escrever, COLORS };
