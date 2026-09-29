# Simulador de Carga 3D — J8 Compensados

Ferramenta usada pela produção da J8 Compensados para planejar a montagem de carga de pallets de
compensado em carretas e containers. Publicada no GitHub Pages; os dados ficam no Supabase.
Converse em português (Brasil), em linguagem simples: quem usa é a equipe de produção/expedição.

## Arquivos
- `index.html` — o site inteiro (HTML + CSS + JS num arquivo só, Three.js r128, jsPDF, supabase-js via CDN).
  - `<script id="motor-src">` — o **motor de montagem**. Fica num bloco separado porque também roda
    dentro de Web Workers (em segundo plano, em paralelo). Não pode usar DOM.
  - os outros `<script>` — interface, 3D, banco, memória, modelos aprovados, PDF.
- `testes/` — testes automáticos (não fazem parte do site). Ver "Testes" abaixo.

## Banco (Supabase, chave pública no próprio index.html)
Tabelas: `produtos`, `unidades`, `cargas` (cargas salvas; o estado completo fica em `pieces` jsonb) e
`modelos_carga` (montagens aprovadas/rejeitadas pela produção: `nome, status, motivo, saved_by, chave, dados jsonb`).

## Como o motor funciona (entrada: `motorV2`)
Três formas de montar geram montagens **completas**; a nota (`mv3Score`) escolhe a melhor:
1. **Padrão da produção** (`mv6*`) — aprendido com a montagem real da produção: fileiras atravessadas com
   1 pacote largo + 1 estreito completando a largura (1360+860, 1360+950, 1360+760…) ou 3×760; camadas de
   cima **amarradas** (o largo troca de lado, em cima da emenda); tombar pacote só quando compensa.
2. **Paredes/camadas uniformes** (`mv7*`) — cada produto numa orientação só; container parede por parede
   da frente para a porta. Vence em container e em carga de um produto só.
3. **Fileiras/paredes livres** (`mv3*`, `mv2Construir`) — só com "Organização em 1º lugar" desligada ou
   com peças pré-definidas na tela; pode misturar orientações para caber mais.

Acabamento (`finalizar`): exceder limite (se pedido), espelhar para o fundo da carreta, fechar vãos no
comprimento (`mv7FecharVaos`), 60/40 (só container/baú), ordem de carregamento (`mv3OrdemCarga`).

## Regras combinadas com a produção (não quebrar)
- Base primeiro; sobe camada por camada; simetria e organização valem mais que caber 1 pacote a mais
  (regra "Organização em 1º lugar", ligada por padrão).
- Carreta aberta: carrega do **fundo** para o engate; o que sobra fica **em cima do eixo** (78% do comprimento).
- Container/baú: da frente para a porta; nada pode bloquear a empilhadeira (porta); altura útil da porta.
- **Entregas**: a entrega 1 fica por cima (descarrega primeiro), a 2 embaixo, etc. A entrega de baixo nunca
  fica num nível mais alto que a de cima (podem dividir o mesmo nível lado a lado).
- Pacote do mesmo produto em cima de um igual fica na **mesma posição** (não "virar" as camadas de cima).
- Apoio mínimo da base (padrão 80%); pacote de cima nunca maior que o de baixo; camada de cima pode chegar
  à largura exata da carroceria; a base nunca passa da largura.
- Folga de 20 mm entre pacotes; vãos maiores no comprimento são fechados no final.
- Modelos aprovados/rejeitados só **desempatam** (valem menos que 1 pacote); pacote sozinho não vira padrão.
- Modo pré-definido: o que o usuário monta à mão é mantido e repetido (largura, altura e comprimento), na
  mesma orientação.

## Memória e versão
`MOTOR_VERSAO` (no script principal) muda sempre que a nota/lógica do motor muda: a memória de cargas
calculadas neste navegador é descartada. Montagens aprovadas não são afetadas.

## Próximos passos combinados (em ordem)
1. **Peso como regra** — antes de tentar caber mais no container, porque os containers saem abaixo da
   capacidade por excesso de peso (pesado embaixo, limite total, distribuição por eixo).
2. Container com paredes mistas (pilhas deitadas + de lado na mesma parede, cada pilha igual de baixo a cima).
3. PDF com o desenho de cada camada (vista de cima, ordem de carregamento e entrega).

## Testes
```
npm install          # só na primeira vez (jsdom e three, apenas para os testes)
npm run test:motor   # cenários de carreta e container: parede, teto, sobreposição, apoio, porta, entrega
npm run test:pagina  # a página inteira num navegador simulado (montar, memória, aprovar, pré-definido…)
```
Rode os dois antes de publicar qualquer mudança no motor. O motor tem sorteio: o número de pacotes pode
variar 1 entre execuções nos cenários mistos; erro de regra física nunca pode aparecer.

## Como trabalhar neste projeto
- Mudança no motor: reproduzir primeiro o caso do usuário (ele manda o texto do botão "📋 Copiar p/ análise"),
  corrigir, rodar os testes, subir `MOTOR_VERSAO`.
- Quando a produção corrige uma montagem à mão, a diferença entre a do motor e a corrigida é a regra que falta.
