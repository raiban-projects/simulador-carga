// Lê as montagens aprovadas/rejeitadas (tabela modelos_carga) do Supabase, com a chave pública do index.html.
// Usa o curl (respeita o proxy da rede); sem acesso, devolve null e a análise segue sem elas.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
module.exports = function lerModelos(){
  const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const url = (s.match(/const SB_URL\s*=\s*'([^']+)'/) || [])[1], key = (s.match(/const SB_KEY\s*=\s*'([^']+)'/) || [])[1];
  if (!url || !key) return { modelos: null, erro: 'não achei SB_URL/SB_KEY no index.html' };
  try {
    const out = execFileSync('curl', ['-sS', '-m', '20', '--fail', url + '/rest/v1/modelos_carga?select=*&order=created_at.desc',
      '-H', 'apikey: ' + key, '-H', 'Authorization: Bearer ' + key], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const lista = JSON.parse(out);
    return Array.isArray(lista) ? { modelos: lista } : { modelos: null, erro: 'resposta inesperada do banco' };
  } catch(e){ return { modelos: null, erro: String((e.stderr || e.message || e)).trim().split('\n')[0] }; }
};
