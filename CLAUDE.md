# Simulador de Carga 3D — J8 Compensados

Ferramenta usada pela produção da J8 Compensados para planejar a montagem de carga de pallets de
compensado em carretas e containers. Publicada no GitHub Pages; os dados ficam no Supabase.
Converse em português (Brasil), em linguagem simples: quem usa é a equipe de produção/expedição.

## Arquivos
- `index.html` — o site inteiro (HTML + CSS + JS num arquivo só, Three.js r128, jsPDF, supabase-js via CDN).
  - `<script id="motor-src">` — o **motor de montagem**. Fica num bloco separado porque também roda
    dentro de Web Workers (em segundo plano, em paralelo). Não pode usar DOM.
  - os outros `<script>` — interface, 3D, banco, memória, modelos aprovados, PDF.
- `testes/` — testes automáticos e o analisador de cargas reais (não fazem parte do site). Ver "Testes" e
  "Análise de cargas reais" abaixo.

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
- Container/baú: da frente para a porta; nada pode bloquear a empilhadeira (porta); altura útil da porta. A carga fica
  **encostada no fundo**: camada de cima que não fecha começa no fundo e o que sobra fica perto da porta (na carreta
  aberta o que sobra vai para cima do eixo). No 3D: as 2 portas abertas na traseira.
- **Entregas**: a entrega 1 fica por cima (descarrega primeiro), a 2 embaixo, etc. A entrega de baixo nunca
  fica num nível mais alto que a de cima (podem dividir o mesmo nível lado a lado).
- Pacote do mesmo produto em cima de um igual fica na **mesma posição** (não "virar" as camadas de cima).
- Apoio mínimo da base (padrão 80%); pacote de cima nunca maior que o de baixo; camada de cima pode chegar
  à largura exata da carroceria; a base nunca passa da largura.
- Folga de 20 mm entre pacotes; vãos maiores no comprimento são fechados no final.
- Fechar a largura (a carga trava nos ferros da carreta) vale mais que separar produtos "bonitinho". Quando não
  existe par deitado (ex.: 1860×1360 com 1860×1360 numa carreta de 2,40), o padrão da produção pode **tombar** um
  pacote ao lado do deitado (1360 + 900 tombado). A base não usa os 2.400 inteiros na prática (ferros travam embaixo).
- **Container/baú que não enche** (quase sempre, pelo peso): nada de vão grande num lugar só. O que sobra (o topo das
  paredes perto da porta) vira uma fileira de pacotes **em pé**, lado a lado na largura, **no meio** da carga (nunca
  na frente), travando os dois blocos (`mv8CalcoMeio`, no acabamento). Só se o pacote em pé chega a ~80% da altura
  dos blocos e cabe na porta. A parede da porta com 1 de altura é normal ("o que sobra"); o vão na porta é natural.
- Modelos aprovados/rejeitados só **desempatam** (valem menos que 1 pacote); pacote sozinho não vira padrão.
- Modo pré-definido: o que o usuário monta à mão é mantido e repetido (largura, altura e comprimento), na
  mesma orientação.
- **Juntar pacotes** (card do produto): a produção junta N pacotes num volume só (ex.: "3 de 80" = 3 pacotes de
  80 chapas). Cada pacote vai na **posição mais estável** (a menor medida na vertical): o grande (1860×1360×900) fica
  normal, skid embaixo; o pequeno (540×370 com 80 chapas = 820) fica de lado, 820×540×370, "540 em cima de 540".
  "Em cima" soma a altura, "lado a lado" a largura, "em fila" o comprimento; cada pacote mantém o seu skid. Com
  "Skid sempre embaixo" ligado, fica sempre o normal. Volume e soltos só giram no chão (`naoTomba`).
  Na tela o antigo "estrado" se chama **skid**. `readTypes` cria 2 tipos por card: o volume
  (`derivado:'vol'`) e os soltos (`derivado:'solto'`, o resto da conta). Os dois
  existem sempre (mesmo com 0) para o índice dos tipos não mudar. Soltos são sempre **automáticos** (o que sobra
  da conta): não há campo para isso. "✂ Separar" (num volume) troca por N pacotes e ajusta um valor escondido
  (`.f-soltos`) só para a contagem bater; ao tocar em Montar, volta ao automático.
- **Juntar na tela (geral, qualquer carga e quantidade)**: selecionar 2+ pacotes → "🔗 Juntar" → andam como 1 só
  (`p.grp`; tocar num seleciona o grupo; contorno laranja no 3D) até "✂ Soltar". "☑ Selecionar vários" (canto do 3D)
  faz cada toque somar à seleção (celular não tem Ctrl+clique). O grupo vai no desfazer e no copiar/colar; ao Montar
  de novo o motor refaz tudo (os grupos somem).

## Opções de DEV (só para o dono)
👍 Aprovar, 👎 Não funciona, 📋 Copiar p/ análise, 📥 Colar carga e a lista "Modelos da produção"
ficam escondidos para a produção (classe `dev-only`). Liga no aparelho abrindo o site com `?dev` (desliga com
`?dev=0`) ou tocando 7 vezes seguidas no título; fica lembrado (`localStorage simcarga_dev`). Não é segurança,
só evita confundir a produção. A tela deve ter o mínimo de texto: quem usa é leigo e muitas vezes no celular.

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

## Análise de cargas reais (fluxo com a produção)
1. No site, a pessoa monta a carga e toca em **📋 Copiar p/ análise**, depois cola o texto (`SIMCARGA {...}`) na conversa,
   de preferência dizendo o que é: montagem do motor, montagem corrigida à mão pela produção, ou só o pedido.
2. Salvar o texto em `testes/dados/reais/<data>-<nome>.txt` e rodar:
   `npm run analisar -- testes/dados/reais/<arquivo>.txt [--rodadas 8] [--tempo 12000] [--gravar]`
   - roda o motor várias vezes em paralelo, com as montagens aprovadas/rejeitadas do banco (`testes/banco.js`, via
     curl; o domínio do Supabase está liberado na rede do ambiente), confere as regras (`testes/regras.js`) e compara
     com a montagem que veio no texto e com a aprovada para a mesma carga, se existir (é a que o site mostra);
   - gera `analises/<nome>/relatorio.html` (resumo, vista de lado, planta por camada) e
     `analises/<nome>/resultado.txt`. A pasta `analises/` não vai para o git.
   - `--gravar` guarda a carga em `testes/dados/reais/esperado.json` (mínimo de pacotes e nota mínima): ela passa a
     rodar no `npm run test:motor` e o motor nunca pode piorar nela.
   - `--modelos` lista as montagens aprovadas/rejeitadas do banco; `--modelo <id>` analisa uma delas (sem arquivo).
3. Mandar o relatório para a pessoa. No site, **📥 Colar carga** abre o código do relatório (ou o `resultado.txt`)
   em 3D, pronto para conferir e aprovar (👍).
4. Se a montagem recebida (da produção) for melhor que a do motor, a diferença é a regra que falta: corrigir o motor,
   rodar os testes e subir `MOTOR_VERSAO`.

## Como trabalhar neste projeto
- Mudança no motor: reproduzir primeiro o caso do usuário (ele manda o texto do botão "📋 Copiar p/ análise"),
  corrigir, rodar os testes, subir `MOTOR_VERSAO`.
- Quando a produção corrige uma montagem à mão, a diferença entre a do motor e a corrigida é a regra que falta.
