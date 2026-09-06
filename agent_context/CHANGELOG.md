# CHANGELOG — documentos de processo

Registro de mudanças relevantes em documentos de processo já aprovados (`PRD.md`, `SDD.md`, `PLAN.md`). Ver `SKILL.md` § "Contexto operacional".

## 2026-09-02 — Repasse do lead ao RD Station migra da função serverless para a API do CMS

Documento afetado: PRD.md

Motivo: o PRD, escrito antes do desenho técnico, assumia que o repasse continuaria "através da integração serverless que já existe no projeto". Com a API NestJS existindo e com a exigência do próprio PRD de que o lead seja gravado mesmo quando o RD Station falha, manter a função serverless significaria duas credenciais, dois deploys e duas cópias da mesma validação para um único fluxo. A decisão está detalhada em `SDD.md` § D-07.

Impacto: o comportamento externo é preservado — mesma API do RD Station, mesma validação, mesmo honeypot, mesmo mapeamento de campos. Muda apenas onde o código roda. `serverless/rdstation-lead/` é aposentado e sua lógica passa a viver em um adaptador da camada de Infraestrutura da API. A seção "Premissas, restrições e dependências" do PRD foi ajustada para apontar para D-07 em vez de fixar o mecanismo serverless. Nenhuma tarefa concluída precisa ser refeita (nenhuma existe ainda).

## 2026-09-02 — Defeito existente incorporado ao escopo: três campos do formulário são descartados hoje

Documento afetado: PRD.md

Motivo: durante a exploração da Fase 2 constatou-se que `src/sections/CapturaLead/services/submitLeadToRDStation.ts` coleta `conheceVirbac`, `usaProdutoVirbac` e `qualProdutoVirbac` no formulário mas não os inclui no payload enviado, e que `serverless/rdstation-lead/types.ts` sequer prevê esses campos. Os três dados são perdidos a cada envio, hoje, em produção.

Impacto: a feature "Registro dos leads do formulário" passa a incluir explicitamente esses três campos, gravados e repassados. Registrado como risco R-01 no SDD e verificado pelo critério C-11. É correção de um defeito preexistente, não ampliação de escopo — mas fica registrado para não parecer requisito inventado.

## 2026-09-02 — Data API do projeto Supabase ja restrita a chaves secretas

Documento afetado: SDD.md

Motivo: ao validar as credenciais recebidas do usuario, constatou-se que a Data API deste projeto Supabase recusa a chave publicavel com `"Only secret API keys can be used for this endpoint"`. Verificado por requisicao direta: `/rest/v1/` responde 200 com a chave secreta e 401 com a publicavel, enquanto `/auth/v1/settings` responde 200 com a publicavel.

Impacto: reforca — nao substitui — a decisao de RLS habilitada sem policy permissiva (SDD § "Modelo de dados"). Passam a existir duas barreiras independentes: a chave que o navegador carrega nao alcanca a Data API, e as tabelas negam por padrao. A T3 mantem o escopo original; o script de verificacao dela ganha uma checagem a mais, confirmando que a chave publicavel e recusada. O nome da variavel no README foi corrigido de `VITE_SUPABASE_ANON_KEY` para `VITE_SUPABASE_PUBLISHABLE_KEY`, acompanhando o esquema de chaves vigente do Supabase.

## 2026-09-02 — Premissa do PRD sobre o tamanho dos videos estava errada, e existe um teto real de 50 MB

Documento afetado: PRD.md

Motivo: o PRD afirma, em "Premissas", que "os arquivos de video ja existentes no projeto sao grandes (na ordem de dezenas a centenas de MB)". Essa premissa foi escrita a partir de um comentario do proprio codigo (`Demonstracao.content.ts`: "arquivos de ~130MB nao devem passar pelo pipeline de bundling do Vite"). O orquestrador mediu os arquivos reais na T7: **23,6 MB e 4,2 MB**. O comentario do repositorio esta desatualizado — provavelmente os videos foram comprimidos depois que ele foi escrito.

Alem disso, a T7 descobriu e o orquestrador confirmou de forma independente que o projeto Supabase tem um **teto global de 50 MB por arquivo** que prevalece sobre o limite de 500 MB declarado na migracao do bucket de video. Verificado: criacao de upload TUS de 60 MB responde `HTTP 413 Maximum size exceeded`; 50 MB responde `201`.

Impacto: nenhum bloqueio hoje — os dois videos reais cabem com folga, e o criterio C-07 do SDD ("um video de porte equivalente aos existentes no projeto") foi cumprido com um upload real de 23,6 MB. Mas a promessa de "centenas de MB" do PRD **nao e atendivel** no plano atual do Supabase. Duas saidas, e a escolha e do usuario: elevar o limite em Project Settings > Storage (exige plano pago) ou corrigir a premissa do PRD para o tamanho real dos arquivos. Ate a decisao, o limite efetivo de video e 50 MB e esta documentado no README. A T12 (campos de midia no painel) precisa exibir esse limite ao operador.

## 2026-09-02 — Tres decisoes do usuario: SVG permitido, limite de video fixado em 50 MB, fuso de Brasilia nos leads

Documentos afetados: PRD.md, SDD.md

Motivo: tres pontos em aberto foram levados ao usuario com recomendacao e ele decidiu os tres.

1. **SVG passa a ser aceito no bucket de imagens.** A LP usa 4 SVGs reais (o logo Veggiedent, referenciado em dois componentes, e tres infograficos da secao de prova de autoridade), e o bucket criado pela T3 aceitava apenas jpeg/png/webp/avif/gif. A T9 havia comecado a converter o logo para PNG por conta propria — de 8,7 KB para 35 KB, com perda de escalabilidade num ativo de marca. O orquestrador barrou a conversao silenciosa e levou a decisao ao usuario. Risco avaliado: um SVG pode carregar script, mas aqui e contido — apenas operadores autenticados enviam, e o arquivo e servido do dominio do Supabase, nao do da LP, entao um script embutido nao alcanca a origem da pagina nem seus cookies.

2. **O limite de video fica em 50 MB**, o teto real do projeto Supabase, em vez de elevar o plano. A premissa do PRD sobre "centenas de MB" foi corrigida para os tamanhos medidos (23,6 MB e 4,2 MB). O painel deve exibir o limite ao operador (T12).

3. **O filtro de datas dos leads passa a usar horario de Brasilia (UTC-3)** em vez de dias em UTC, para que o corte do dia seja o que o operador entende. Corrigido antes de a T13 construir a tela em cima.

Impacto: a T9 ganha uma migracao acrescentando `image/svg+xml` aos tipos aceitos do bucket de imagens, e o PNG gerado por engano e descartado. A secao "Premissas" do PRD foi corrigida. O criterio C-12 do SDD passa a pressupor recorte de dia em horario de Brasilia.

## 2026-09-02 — ERRO DE MODELAGEM DO ORQUESTRADOR: coluna `aceite_lgpd` guarda uma constante

Documentos afetados: SDD.md, PLAN.md

Motivo: o usuario apontou, e a verificacao confirmou, que a coluna `aceite_lgpd` da tabela `leads` **nao guarda informacao nenhuma**. O erro e do orquestrador: eu a coloquei em "Modelo de dados" do SDD ao transcrever os campos do formulario, sem notar que ela e logicamente impossivel de variar.

Evidencia no codigo implementado a partir desse SDD:
- `apps/api/src/modules/leads/domain/lead-submission.ts:93` — `if (raw.aceite_lgpd !== true)` rejeita a submissao com `422`. Sem consentimento, nenhum registro nasce.
- `apps/api/src/modules/leads/domain/lead-submission.ts:126` — `aceiteLgpd: true`, **literal hardcoded**. O codigo nao le o valor do visitante; ele grava a constante.

Consequencia: toda linha da tabela tem `aceite_lgpd = true`, e o CSV exportado ganhava uma coluna "Aceite LGPD" que sempre diz "Sim". Uma coluna que so pode ter um valor nao prova nada que a existencia da propria linha ja nao prove.

Onde o raciocinio falhou: confundi "o dado aparece no formulario" com "o dado precisa ser persistido". O checkbox existe na interface e e obrigatorio; disso nao decorre que ele seja um campo do registro. A pergunta que faltou fazer ao escrever o modelo de dados foi "este campo pode assumir mais de um valor no banco?" — para `aceite_lgpd` a resposta e nao, e para `aceite_comunicacoes` (opt-in de marketing, genuinamente opcional) a resposta e sim. Os dois foram tratados como iguais por estarem lado a lado no formulario.

Nota tecnica para nao trocar um erro por outro: se um dia for preciso provar **a que texto** a pessoa consentiu — cenario real depois de a Politica de Privacidade mudar —, o campo correto e a versao do texto aceito, nao um booleano. Isso nao esta em escopo hoje e nao foi adicionado.

Impacto: a coluna sai do modelo de dados do SDD e do CSV. Exige migracao de remocao da coluna, ajuste do repositorio, do DTO, da view e do gerador de CSV, e atualizacao dos testes. Registrado como tarefa **T18** no PLAN.md, a ser executada depois da T9 para nao concorrer com ela no modulo de leads. A validacao que exige o consentimento **permanece** — o que muda e apenas nao persistir o resultado dela.

## 2026-09-02 — ERRO DO ORQUESTRADOR: repassei ao usuario uma afirmacao de subagente sem verificar

Documento afetado: PLAN.md (nota de aceitacao da T6)

Motivo: ao aceitar a correcao da T6, relatei ao usuario, como fato, que "o teste R-05 antigo nao pegaria essa regressao porque os documentos de exemplo repetiam o mesmo identificador". Essa frase veio do relatorio do subagente e eu a reproduzi sem conferir. Ao revisar, medi: `apps/api/test/documento-de-exemplo.ts` contem **1 referencia de midia, 1 identificador distinto** — nao ha repeticao nenhuma. `packages/content-schema/tests/fixtures.ts` tem **10 identificadores, todos distintos**.

A conclusao do subagente estava certa na direcao (a fixture antiga nao conseguiria distinguir 1 consulta de N consultas de midia), mas a **razao** era outra: o documento de exemplo tinha uma unica referencia de midia, entao nao havia como observar crescimento. Repeticao de id e ausencia de variedade sao coisas diferentes, e eu propaguei a explicacao errada.

Onde o raciocinio falhou: a skill exige que eu rode os comandos verificaveis em vez de aceitar o relato do subagente, e eu cumpri isso para teste, build e typecheck. Mas tratei as **explicacoes** do subagente como se tivessem o mesmo grau de verificacao que os numeros. Nao tem. Um relatorio pode acertar a conclusao e errar a causa, e a causa e justamente o que vira aprendizado registrado.

Impacto: a nota de aceitacao da T6 no PLAN.md repete a explicacao errada e precisa ser corrigida. Regra derivada para o orquestrador: afirmacao causal de subagente que eu for repassar ao usuario ou escrever em documento de processo precisa ser verificada como um comando verificavel — ou explicitamente atribuida ("segundo o subagente"), nunca apresentada como fato proprio.

## 2026-09-02 — ERRO DO ORQUESTRADOR: escrevi uma nota de handoff afirmando pendencias que nao verifiquei

Documento afetado: PLAN.md, e o prompt de retomada agendada

Motivo: ao pausar o desenvolvimento a pedido do usuario, interrompi a T6 no meio e escrevi, tanto ao usuario quanto no agendamento de retomada, uma lista do que "faltava": teste de consulta unica (R-05), testes de 422, secao e item despublicados ausentes, ordem preservada, chave desconhecida 404, mensagens em portugues. Ao retomar, fui conferir os nomes dos testes e **todos esses itens ja estavam cobertos** — a suite tinha 125 testes na API.

Montei aquela lista a partir do que eu havia pedido na delegacao, nao do que existia no disco. No momento da pausa eu cheguei a rodar `git status` (54 arquivos alterados), mas nao inspecionei o conteudo.

Onde o raciocinio falhou: confundi "o que eu pedi" com "o que ainda falta". Sao a mesma coisa apenas se nada foi feito. Interromper uma tarefa no meio e exatamente o caso em que a diferenca importa, e foi ai que assumi.

Impacto: o custo real foi baixo (a retomada checou antes de agir), mas o risco nao era: um agente de retomada menos cuidadoso teria refeito trabalho pronto, ou pior, sobrescrito. Regra derivada: nota de handoff de tarefa interrompida so afirma pendencia depois de inspecionar o artefato — no minimo listar os testes existentes e rodar a suite —, e na duvida escreve "estado nao verificado" em vez de uma lista especulativa.

## 2026-09-02 — ERRO DO ORQUESTRADOR: criterios de "pronto" testavam o comportamento interno, nao o contrato com o consumidor

Documento afetado: PLAN.md (criterios das T6, T7 e T8), SDD.md (criterios de aceitacao)

Motivo: o criterio de "pronto" que escrevi para a T6 exigia 422 com erro por campo, despublicados ausentes, ordem preservada, chave desconhecida 404 e consulta unica. O subagente cumpriu todos, com 125 testes verdes — e ainda assim `GET /api/content` devolvia referencias de midia como **UUID cru**, inutil para a LP, que e o unico consumidor daquele endpoint. O defeito so apareceu quando eu exercitei o sistema manualmente contra o Supabase real.

Onde o raciocinio falhou: todos os meus criterios olhavam para dentro — o que a API faz com a propria entrada. Nenhum perguntava se **quem consome a resposta consegue usa-la**. Uma suite pode ficar inteiramente verde enquanto o contrato com o consumidor esta quebrado, porque a suite testa o produtor contra si mesmo.

Impacto: o defeito foi corrigido dentro da propria T6 (a saida publica passa a resolver a URL; a administrativa mantem o identificador). Regra derivada: todo criterio de "pronto" de endpoint precisa incluir ao menos uma verificacao na perspectiva do consumidor real — "a LP consegue renderizar isso?", "o painel consegue preencher o formulario com isso?" —, e nao apenas o comportamento observado de dentro da API. Aplicar retroativamente ao revisar T7 e T8, e prospectivamente nas T10 a T15.

## 2026-09-02 — ERRO DO ORQUESTRADOR: o plano ignorou concorrencia por arquivo compartilhado e por arvore de trabalho

Documento afetado: PLAN.md ("Ordem de execucao")

Motivo: dois enganos de planejamento, ambos descobertos so na execucao.

1. Marquei **T2, T3 e T4 como paralelizaveis**. T2 e T4 instalam dependencias npm e portanto escrevem as duas em `package-lock.json` na raiz — arquivo compartilhado. O guardrail de nao paralelizar tarefas que tocam o mesmo arquivo existe na skill e eu o apliquei pensando so em codigo-fonte, nao em arquivos de infraestrutura do repositorio.
2. O plano nao previu que **dois subagentes fazendo git na mesma arvore de trabalho se atropelam**. Cada tarefa tem sua branch, mas branch nao isola arvore: dois `git checkout -b` concorrentes no mesmo diretorio corrompem o trabalho um do outro. Percebi ao disparar a T3 e a isolei em worktree, mas a T2 ja rodava na arvore principal — funcionou por sorte de sequencia, nao por desenho.

Onde o raciocinio falhou: tratei "paralelizavel" como propriedade logica da tarefa (nao ha dependencia entre elas) quando e propriedade **fisica** dos recursos que ela toca — arquivos, diretorio de trabalho, banco, porta de rede.

Impacto: corrigido no PLAN.md, com T4 passando a sequencial apos T2 e a regra de worktree isolado registrada. Regra derivada: antes de paralelizar, listar os recursos fisicos que cada tarefa escreve — incluindo `package-lock.json`, a arvore de trabalho git, o banco e portas — e nao apenas os arquivos de codigo.

## 2026-09-02 — ERRO DO ORQUESTRADOR: premissa escrita a partir de comentario de codigo, sem medir

Documento afetado: PRD.md

Motivo: complementa a entrada sobre o teto de 50 MB, registrando o erro em si e nao apenas a correcao. Escrevi na secao "Premissas" do PRD que os videos tem "dezenas a centenas de MB", copiando a ordem de grandeza de um comentario em `Demonstracao.content.ts` ("arquivos de ~130MB"). Os arquivos reais tem **23,6 MB e 4,2 MB** — medi na T7, cinco tarefas depois. O comentario do repositorio estava desatualizado.

Onde o raciocinio falhou: tratei um comentario de codigo como fonte de fato sobre o mundo. Comentario e afirmacao humana nao verificada, e envelhece sem aviso — ao contrario do arquivo, que estava a um `ls -la` de distancia. A premissa entrou num documento aprovado pelo usuario e sustentou uma decisao de arquitetura (upload retomavel para arquivos grandes, D-05).

Nota: a decisao D-05 continua correta por outro motivo — upload direto ao armazenamento e o desenho certo mesmo para 23 MB, e o caminho retomavel foi exercitado com sucesso. O erro nao propagou dano, mas poderia: uma premissa errada de ordem de grandeza e exatamente o tipo de coisa que justifica arquitetura desnecessaria.

Impacto: premissa corrigida no PRD com os valores medidos. Regra derivada: numero que entra em premissa de PRD precisa vir de medicao direta do artefato, nunca de comentario, README ou documento anterior — e se a medicao nao for possivel, a premissa e declarada como estimativa nao verificada.

## 2026-09-02 — ERROS OPERACIONAIS DO ORQUESTRADOR ao subir e derrubar processos

Documento afetado: nenhum (erros de execucao, nao de especificacao) — registrado para a analise da skill

Motivo: tres enganos meus na operacao dos servidores que o usuario usa para testar, todos visiveis para ele.

1. **LP sem CSS nenhum.** Subi o Vite a partir da raiz do repositorio. O Tailwind resolve os globs de `content` relativos ao **diretorio de trabalho**, nao a pasta do arquivo de configuracao, entao ele procurou `/repo/src/**`, que nao existe desde que a T1 moveu a LP para `apps/lp/`. Resultado: 12 KB de preflight e zero utilitarias. O usuario viu a pagina quebrada e teve que reportar.
2. **Binario errado ao corrigir o item 1.** Usei `./node_modules/.bin/vite` dentro de `apps/lp`, mas em monorepo com workspaces o binario e icado para a raiz. O processo nem subiu.
3. **`pkill -f` matando o proprio shell.** Rodei `pkill -f "node dist/main.js"`, e o padrao casou com a linha de comando do meu proprio processo bash, que continha aquele texto. Saida 144, duas vezes, antes de eu trocar para localizar o processo pela porta em escuta.

Onde o raciocinio falhou: nos tres casos, executei um comando por analogia com o ambiente "normal" (repo de um projeto so, binario local, pkill por nome) sem checar as condicoes especificas deste ambiente (monorepo com workspaces, hoisting, e o fato de `pkill -f` enxergar a propria invocacao).

Impacto: nenhum dano permanente; a LP ficou alguns minutos sem estilo e a API caiu duas vezes. Regras derivadas: (a) processos de desenvolvimento em monorepo sobem com o binario da raiz e o diretorio de trabalho do workspace-alvo; (b) encerrar processo pela porta em escuta, nunca por `pkill -f` com padrao que a propria linha de comando contem; (c) apos subir um servidor, verificar o **conteudo** servido, nao apenas o codigo HTTP — um `200` sem CSS teria sido pego na hora.

## 2026-09-02 — ERROS DOS SUBAGENTES: tres padroes que se repetiram

Documento afetado: nenhum (analise de execucao) — registrado para a analise da skill

Motivo: consolidacao dos erros cometidos pelos subagentes de implementacao, para servir de material a melhoria da skill.

1. **Regressao de qualidade silenciosa.** O primeiro subagente da T9, ao esbarrar num bucket que nao aceitava `image/svg+xml`, comecou a **converter o logo do Veggiedent de SVG para PNG por conta propria** — 8,7 KB para 35 KB, com perda de escalabilidade num ativo de marca. Nao perguntou, nao sinalizou; tratou uma restricao de infraestrutura como se autorizasse mudar o ativo. Foi barrado pelo orquestrador ao inspecionar a arvore, e a decisao foi levada ao usuario. **Este e o mais grave dos tres**, porque teria chegado ao usuario final como degradacao visual sem nenhum registro.
2. **Testes verdes que nao cobrem o contrato.** O subagente da T6 entregou 125 testes passando com um endpoint que devolvia UUID onde o consumidor precisa de URL (ver entrada propria acima). O mesmo padrao apareceu no teste do risco R-05: a fixture tinha uma unica referencia de midia, entao o teste nao conseguia distinguir uma consulta de N consultas. Testes escritos a partir do proprio codigo confirmam o codigo, nao o requisito.
3. **Entrega deixada em estado que nao compila.** O primeiro subagente da T2 foi interrompido deixando `npm run typecheck` quebrado (`tests/sections.test.ts(150,79)`, acesso a `.fields` sem estreitar a uniao discriminada). Interrupcao explica nao ter terminado, nao explica ter deixado o repositorio sem compilar entre um passo e outro.

Aspectos positivos que tambem valem registro, por serem o comportamento a reforcar: os subagentes das T5, T6, T7 e T8 provaram os requisitos criticos **por mutacao** (quebrar de proposito e ver o teste falhar) em vez de por leitura, e declararam explicitamente desvios de camada, decisoes fora de escopo e limitacoes que nao conseguiram resolver — inclusive quando isso os expunha, como o teto de 50 MB e o multipart orfao da T7.

Regras derivadas: (a) toda delegacao deve dizer explicitamente que restricao de infraestrutura nao autoriza alterar um ativo do projeto — a resposta correta e parar e reportar; (b) exigir que o teste seja escrito a partir do requisito e provado por mutacao, nunca a partir do codigo pronto; (c) o criterio de "pronto" deve incluir que o repositorio compila em qualquer ponto de parada, nao apenas ao final.

## 2026-09-03 — Decisao do usuario sobre as 12 imagens que estavam fora do esquema

Documentos afetados: SDD.md, PLAN.md

Motivo: a T9 revelou que 12 arquivos de imagem em 5 pontos da pagina nao foram migrados porque **nao existe campo no esquema para eles** — sao importados direto nos componentes, nao em arquivo `*.content.ts`. A T2 escopou os esquemas nos 12 arquivos de conteudo, e essas imagens ficaram fora. O orquestrador mapeou cada ponto, mostrou os arquivos ao usuario, e ele decidiu ponto a ponto.

**Passam a ser gerenciaveis pelo CMS:**
1. **Kit de imagens** (`Kit-de-imagens.png`, secao Prova de Autoridade) — campo de imagem com texto alternativo obrigatorio. Nota de peso: o arquivo atual tem **2 MB**; cabe no limite de 10 MB do bucket, mas e peso relevante numa pagina de campanha.
2. **Mosaico do formulario** (6 fotos, secao Captura de Lead) — vira **lista** de itens com imagem e texto alternativo, com adicionar, remover e reordenar, como as demais listas do CMS. O layout desenhado pressupoe 6 fotos; a lista permite outra quantidade, e isso fica documentado para o operador.

**Permanecem em codigo, por decisao explicita — nao e esquecimento:**
3. **Faixa de bandeiras do Hero** (`grupo-bandeiras.png`).
4. **Os tres infograficos da Prova de Autoridade** (`01_formato_em_z.svg`, `02_halito_causas_digestivas.svg`, `03_origem_100_vegetal.svg`). Alem da imagem, o texto que os acompanha ("Formato em Z:" e afins) esta escrito dentro de `ProductDifferentials.tsx`, entao torna-los editaveis exigiria campos de imagem **e** de texto. Sao claims de produto, e seguem sob controle de quem edita o codigo.

**Muda de natureza:**
5. **Poster do banner de video** (`video-banner-poster.jpg`, secao Demonstracao) — deixa de ser imagem propria e passa a **derivar do primeiro video cadastrado na secao**, reaproveitando a miniatura que ja e um campo do esquema. Consequencia visual declarada e aceita: o banner passa a exibir a miniatura do video, que hoje e uma arte diferente. O arquivo estatico sai do codigo. Isto **remove** um ativo em vez de acrescentar um campo.

Nota: a decisao anterior de permitir `image/svg+xml` no bucket **continua necessaria**, mesmo com os tres infograficos ficando fora do CMS — o logo do Veggiedent e SVG e esta no CMS desde a T9.

Impacto: nova tarefa **T19** (esquema + migracao dos ativos novos) no PLAN.md, a ser executada **antes da T11**, porque o painel gera o formulario a partir do esquema. A fiacao dos componentes fica na **T14**, junto com o restante da troca de `*.content.ts` para a API — evitando alterar componentes duas vezes. O escopo da T14 foi ampliado para incluir os tres componentes envolvidos.

## 2026-09-03 — REGRA GERAL PARA A SKILL: projeto com multiplas aplicacoes precisa de entrada unica desde o primeiro dia

Documentos afetados: PLAN.md, SDD.md — e, sobretudo, a propria skill `orquestrador-projeto` (registrado aqui a pedido do usuario, que vai analisar estes registros para melhora-la)

Motivo: o usuario apontou uma lacuna real do processo. Este projeto tem tres aplicacoes (LP, painel, API) que em producao vivem **no mesmo dominio** — `/`, `/admin` e `/api/*` —, e isso esta no SDD desde a Fase 2. Mas durante todo o desenvolvimento eu servi as tres em **portas diferentes** (5173, 5174, 3000), obrigando o usuario a lidar com tres enderecos e adiando toda a costura de roteamento para a ultima tarefa antes de publicar (T16).

Onde o raciocinio falhou: tratei "rodar para testar" e "publicar" como problemas separados, quando o segundo e apenas a versao final do primeiro. O resultado e que o modelo de URL — justamente a parte que o usuario enxerga e que mais facilmente quebra — so seria validado no fim, quando corrigir e mais caro. A T10 ja tinha dado a evidencia do custo disso ao descobrir, so na verificacao manual em navegador real, que `/admin` sem barra final devolvia 404: um problema de caminho que a suite inteira nao pegava e que so aparece quando se acessa pelo endereco de verdade.

**Regra derivada, para a skill aplicar em qualquer projeto com mais de uma aplicacao:** se o SDD declara que duas ou mais aplicacoes compartilham dominio em producao, o ambiente de desenvolvimento precisa expor **uma unica entrada** desde a primeira tarefa que sobe um servidor — nunca uma porta por aplicacao. O roteamento de caminhos passa a ser exercitado a cada dia de trabalho, em vez de ser uma tarefa de integracao no fim. Isso vale como criterio de "pronto" da tarefa que estrutura o repositorio, nao como tarefa separada.

Decisao do usuario sobre a forma:
1. **Agora:** entrada unica em desenvolvimento por proxy do servidor de desenvolvimento — um endereco so, mantendo recarga automatica. Tarefa **T20**.
2. **Alvo declarado:** **orquestracao com Docker**, subindo tudo de uma vez atras de um proxy reverso, servindo tanto o desenvolvimento quanto um ambiente de homologacao e alimentando a decisao de publicacao. Tarefa **T21**, imediatamente antes da T16.

Impacto: duas tarefas novas no PLAN.md. A T16 deixa de ser "descobrir como costurar tres aplicacoes" e passa a ser "publicar o modelo que ja esta rodando ha semanas".

## 2026-09-03 — ERRO DO ORQUESTRADOR: a invariante de texto alternativo nao admite imagem decorativa

Documento afetado: SDD.md ("Contrato do esquema de seção"), PLAN.md (T19)

Motivo: escrevi no SDD a invariante "todo campo `imagem` tem obrigatoriamente um campo de texto alternativo adjacente e obrigatorio", tratando-a como regra de acessibilidade absoluta. Ela nao e. Em acessibilidade, imagem **decorativa** deve ter texto alternativo **vazio** e ser escondida de leitores de tela — descreve-la e pior do que nao descrever, porque injeta ruido sem informacao.

A T19 esbarrou nisso ao migrar o mosaico do formulario. Essas seis fotos sao hoje explicitamente decorativas: `LeadFormMosaic.tsx` marca o bloco com `aria-hidden` e cada foto entra com `alt=""`. Como o esquema exige descricao, o subagente **escreveu seis descricoes novas** — declarando isso num comentario, o que foi correto da parte dele. Mas a consequencia e que um leitor de tela passaria a anunciar seis descricoes de fotos de cachorro no meio de um formulario de captacao, onde antes havia silencio proposital.

Verificacao do orquestrador sobre a qualidade dessas descricoes (li as imagens): `mosaico-descanso` — "Corgi dormindo abracado a um bichinho de pelucia sobre a cama" — **exata**. `mosaico-retriever` — o subagente acertou em nao repetir o nome do arquivo (a foto e de um Malinois, nao de um retriever; ele descreveu a imagem, nao o filename), mas afirmou "petisco em formato de Z" e a foto mostra um petisco reto, sem Z visivel: **detalhe nao sustentado pela imagem**.

Onde o raciocinio falhou: transformei uma boa pratica ("imagem informativa precisa de descricao") em regra universal, sem prever a categoria legitima que a contradiz. O efeito foi obrigar um subagente a **produzir conteudo visivel ao usuario final** para satisfazer uma regra minha — exatamente o tipo de coisa que instruo os subagentes a nao fazerem sozinhos.

Impacto: o contrato do esquema passa a admitir que uma imagem seja marcada como **decorativa**, caso em que o texto alternativo e vazio e a imagem e escondida de leitores de tela. A invariante continua existindo, mas na forma correta: quem cadastra uma imagem precisa **escolher conscientemente** entre descreve-la ou declara-la decorativa — nunca deixar o campo em branco por descuido. As seis fotos do mosaico entram como decorativas, preservando o comportamento de acessibilidade que a pagina ja tem hoje. As descricoes escritas pelo subagente sao descartadas, inclusive a que continha o detalhe nao sustentado.

## 2026-09-03 — ERRO DO ORQUESTRADOR: confundi o DTO de entrada com o registro persistido

Documento afetado: PLAN.md (T18)

Motivo: ao delegar a T18, instrui "remover o campo do repositorio, do **DTO**, da view e de tudo que o carrega". O subagente cumpriu tudo menos o DTO, e explicou por que — corretamente.

`SubmitLeadDto` e o contrato de **entrada da requisicao**, e o pipe global roda com `whitelist: true, forbidNonWhitelisted: true` (`apps/api/src/shared/presentation/validation.pipe.ts`). Campo ausente do DTO e **recusado antes de chegar ao dominio**. Remover `aceite_lgpd` de la faria o envio **com** consentimento ser rejeitado — o formulario da LP manda esse campo, e ele precisa ser aceito para que a validacao possa exigi-lo. O subagente provou por mutacao: removido do DTO, **17 dos 22 testes** de `POST /api/leads` caem, incluindo o caminho feliz.

Onde o raciocinio falhou: escrevi "DTO" como se houvesse um so, quando ha dois papeis distintos — o que descreve o que **entra** pela requisicao e o que descreve o que **sai** para o consumidor (`LeadView`). O campo precisava sumir do segundo e do registro persistido, e **permanecer** no primeiro, porque continua sendo enviado e continua sendo condicao de envio. Eu tratei "nao persistir" como sinonimo de "nao existir em lugar nenhum".

Verificacao do orquestrador apos a correcao: envio sem consentimento responde `422` com `{"aceite_lgpd":"Consentimento LGPD e obrigatorio."}`; com `aceite_lgpd:false` responde `422`; com consentimento responde `200` e grava. A coluna nao existe mais no banco hospedado (`42703 column leads.aceite_lgpd does not exist`) e `verify-isolation.mjs` segue com exit 0.

Impacto: nenhum — o subagente parou e relatou em vez de executar a instrucao ao pe da letra, que era o comportamento certo. Regra derivada: ao mandar remover um campo, dizer **em qual fronteira** ele deve sumir (entrada da requisicao, saida para o consumidor, registro persistido), porque as tres sao independentes e uma instrucao generica sobre "o DTO" e ambigua.

## 2026-09-03 — ERRO DO ORQUESTRADOR: interpretei mal o pedido do usuario sobre o banner de video

Documento afetado: PLAN.md (T14, T19), SDD.md

Motivo: em 2026-09-02 o usuario escreveu "o banner do video deve vir direto do video cadastrado". Eu interpretei como "reaproveite o campo `poster` que o video ja tem no esquema" e registrei assim no PLAN e no CHANGELOG, propagando a leitura errada por tres tarefas (T19, T14). O usuario esclareceu: ele queria que a imagem de pre-carregamento fosse o **primeiro quadro do proprio arquivo de video**, derivada automaticamente — nao um campo cadastrado.

Onde o raciocinio falhou: "vir direto do video" descreve **origem derivada** (extrair do arquivo), e eu li como **referencia a um campo** (apontar para o poster ja cadastrado). Quando uma frase curta do usuario admite duas leituras com implementacoes diferentes, a regra do proprio processo manda perguntar — e eu tinha acabado de fazer uma rodada de perguntas, entao havia oportunidade. Assumi a leitura que exigia menos trabalho.

O usuario acrescentou o principio que sustenta a leitura correta, e ele vale alem deste caso: **nao se pede a um operador leigo um dado que ele nao tem como entender**. Uma "imagem de pre-carregamento" e conceito de quem constroi a pagina, nao de quem escreve conteudo. Campo que so faz sentido para desenvolvedor nao deve existir no painel.

Impacto: o banner passa a aceitar **video ou imagem**, a escolha do operador; **nao existe campo de imagem de pre-carregamento**; e quando for video, a imagem exibida antes do carregamento vem do **primeiro quadro do proprio video**. Registrado como tarefa T24. A nota da T19 e a da T14 que descrevem "miniatura do primeiro video" ficam superadas por esta entrada.

## 2026-09-03 — Decisoes do usuario: editor de texto rico com Lexical, migracao recriada a partir do instantaneo

Documentos afetados: SDD.md, PLAN.md

Motivo: tres pontos levados ao usuario apos a T14.

1. **Campo de texto rico.** O titulo da Prova de Autoridade perdeu, na T14, a quebra de linha forcada e o destaque em turquesa extra-bold, porque o JSX escrito a mao deu lugar ao texto do CMS. Em vez de tirar o campo do painel, o usuario decidiu criar um **tipo de campo de texto rico**, que guarda HTML: o operador cria a quebra de linha e marca o trecho em **negrito**, e esse negrito e o que vira o destaque visual. Serve a este titulo e a outros com a mesma necessidade.

   **Editor escolhido: Lexical.** O orquestrador levantou que o CKEditor 5, pedido inicialmente, e distribuido sob GPL na versao aberta, com licenca comercial a parte — e o JavaScript dele vai para o navegador junto com o codigo do projeto, o que tem implicacao num trabalho entregue a cliente. O usuario optou por Lexical (MIT).

   **Requisito de seguranca inegociavel:** HTML vindo do banco renderizado na pagina publica abre porta para injecao de script. So as marcacoes que fazem sentido para titulo passam; qualquer outra coisa e removida. Sem isso, um operador com acesso comprometido injetaria script na LP.

2. **A migracao de conteudo volta, lendo o instantaneo.** A T14 aposentou `apps/api/src/migration/` porque a fonte que ele lia (`*.content.ts`) deixou de existir — decisao correta naquele momento, mas que tira a capacidade de popular um ambiente novo, de que a T21 (Docker/homologacao) e a T16 (publicacao) vao precisar. O modulo volta lendo `apps/lp/src/content/content-snapshot.json`, sem duplicar conteudo. Tarefa T23.

3. **O banner mantem o video vindo do CMS** — ver a entrada acima sobre a interpretacao errada.

Impacto: tres tarefas novas no PLAN — T22 (campo de texto rico com Lexical), T23 (migracao a partir do instantaneo) e T24 (midia do banner: video ou imagem, com pre-carregamento derivado). Ordem: T22 e T24 alteram esquema e painel e sao sequenciais entre si; T23 vem depois das duas, para semear conteudo ja no formato final.

## 2026-09-03 — A regra do pre-carregamento vale para TODOS os videos, nao so o do banner

Documentos afetados: PLAN.md (T24), SDD.md

Motivo: ao registrar a interpretacao errada do banner, o orquestrador levantou que os dois videos da secao Demonstracao tambem tem campo de miniatura cadastravel, e que pelo principio declarado pelo usuario eles provavelmente tambem nao deveriam pedir isso. O usuario confirmou: **a regra vale para todos os videos**.

Estado atual da lista `videos` de `demonstracao`, quatro campos por item: `label` (Titulo do video), `video` (Arquivo de video), `poster` (Miniatura do video) e `captions` (Arquivo de legendas).

Decisao: **`poster` deixa de existir** em todo lugar onde houver video. A imagem exibida antes do carregamento passa a ser derivada do primeiro quadro do proprio arquivo. `label` e `captions` permanecem — o operador entende os dois, e legenda e acessibilidade real, com arquivo que ele de fato possui.

Consequencia registrada: as duas miniaturas hoje cadastradas (`tutor-abrindo-petisco.jpg` e `cachorro-ganhando-petisco.jpg`) ficam sem referencia. Nao serao apagadas pela T24 — a remocao e decisao a parte, para nao misturar limpeza com mudanca de contrato.

Impacto: T24 passa a alterar o esquema da secao Demonstracao alem do banner, e a T23 (migracao a partir do instantaneo) precisa semear o formato novo. Reforca o criterio de revisao ja registrado na T24: verificar se ha outros campos que so fazem sentido para quem constroi a pagina.

## 2026-09-03 — O RD Station sai do projeto; o CMS passa a ser o unico sistema de registro do lead

Documentos afetados: PRD.md, SDD.md, PLAN.md

Motivo: o usuario informou que a integracao com o RD Station **vai ser descontinuada**. Sai tudo o que se refere a ela no codigo; permanece **apenas a exportacao dos leads em CSV**.

Alcance medido pelo orquestrador: **33 arquivos** com referencia (dominio, aplicacao, infraestrutura, apresentacao, testes, painel, LP e configuracao), as colunas `rdstation_status` e `rdstation_error` da tabela `leads`, duas colunas do CSV exportado ("Status RD Station" e "Erro RD Station"), as variaveis `RDSTATION_API_TOKEN` e `RDSTATION_CONVERSION_IDENTIFIER`, e o diretorio `serverless/rdstation-lead/` inteiro — que a T16 iria aposentar e agora perde a razao de existir antes disso.

**Consequencia que muda a criticidade do sistema, e precisa ficar registrada:** ate aqui o lead tinha dois destinos — o banco do CMS e o RD Station —, e boa parte do desenho existia para que a falha de um nao perdesse o dado (risco R-01, criterio C-11, a ordem "grava antes de repassar"). Com a saida do RD Station, **o banco do CMS passa a ser o unico lugar onde o lead existe**. Nao ha mais copia em outro sistema. Isso eleva o peso de: backup do banco, cuidado em qualquer migracao que toque `leads`, e a propria exportacao em CSV, que deixa de ser conveniencia e passa a ser o mecanismo de saida do dado.

O que **permanece** e nao deve ser removido junto: a validacao do envio (nome, e-mail, consentimento, porte), o **honeypot**, a gravacao do lead, a listagem, o filtro por periodo em horario de Brasilia, a exclusao por pedido do titular, e a exportacao em CSV conforme a regra RN-01.

Impacto: risco **R-08** do SDD (payload do RD Station "a confirmar com a Virbac antes do go-live") deixa de existir. A decisao **D-07** (migrar o repasse da funcao serverless para a API) fica historica: o repasse deixa de existir em qualquer lugar. Os criterios **C-11** e **C-12**, a secao "Dependencias externas", os diagramas C4 e a secao "Modelo de dados" do SDD precisam ser corrigidos, assim como as secoes de features, dependencias, fora de escopo e criterios de release do PRD. Registrado como tarefa **T26**.

## 2026-09-03 — Campos que so faziam sentido para quem constroi a pagina saem do painel

Documentos afetados: SDD.md, PLAN.md

Motivo: a varredura pedida na T24 encontrou quatro grupos de campos que violam o principio declarado pelo usuario ("nao se pede a um operador leigo um dado que ele nao tem como entender"). O usuario decidiu remover **todos**.

1. **`captura_lead.porteOptions[].value` e `simNaoOptions[].value` — "Codigo da opcao".** A propria ajuda dizia "nao deve ser alterado sem aviso a equipe tecnica". E o valor gravado no lead: altera-lo corrompe a serie de dados em silencio. O **rotulo** de cada opcao ("Pequeno", "Medio", "Grande") e texto visivel e **permanece editavel**; o valor passa a viver em codigo, coerente com a linha do PRD que mantem a **estrutura** do formulario em codigo e deixa apenas os **textos** no CMS.
2. **`header.menuButtonAriaLabel`, `header.mainNavAriaLabel`, `captura_lead.successModalCloseAriaLabel`.** Rotulos de acessibilidade de **controles de interface** (botao de menu, regiao de navegacao, botao de fechar), nao de conteudo. Um valor ruim degrada a acessibilidade sem ninguem perceber.
3. **`captura_lead.successModalEmailModeMessage`.** Ressalva do orquestrador, declarada ao usuario: diferente dos outros tres, este **e** texto visivel ao visitante — o problema dele e de descoberta (o operador nao controla o modo de entrega e nao tem como saber quando aquilo aparece), nao de ser conceito tecnico. Remove-lo significa que mudar essa frase passa a exigir deploy. O usuario decidiu remover mesmo assim.
4. **`metadata.canonicalUrl`.** SEO tecnico; valor errado pode tirar a pagina do indice.

Impacto: registrado como tarefa **T25**, executada depois da T26 — a saida do RD Station muda o peso do argumento do item 1 (o valor deixa de alimentar um sistema externo e passa a valer so para o banco e o CSV), e mexer nos dois de uma vez no modulo de leads criaria conflito.

## 2026-09-04 — A secao Ingredientes sai do projeto; o Header sai do CMS

Documentos afetados: PRD.md, SDD.md, PLAN.md

Motivo: o usuario, testando o painel, levantou tres pontos.

**1. A secao "Ingredientes" e removida do projeto.** Ela nunca foi finalizada: o codigo original a marcava `[BLOQUEADO]` — "sem conteudo aprovado ate a chegada do material tecnico da Virbac" — e ela tinha **um unico campo**, o titulo "O que tem no Veggiedent", sem lista de ingredientes nem texto. Ficava escondida por um sinalizador em codigo, e o CMS preservou isso migrando-a como nao publicada. Como o material da Virbac nunca chegou, mante-la e manter um espaco vazio permanente. O usuario decidiu remover.

   Registro de um efeito colateral real: ao testar o botao de ativar, o usuario publicou essa secao, e a **landing page passou a exibir um bloco com so um titulo e nada embaixo**. O orquestrador despublicou imediatamente como mitigacao (11 secoes de volta) antes de qualquer tarefa. Isso e evidencia de um problema de produto alem do bug: o painel permite publicar uma secao vazia sem nenhum aviso.

**2. O Header sai do CMS.** O usuario determinou que todos os dados do cabecalho voltem a ser fixos em codigo — links de navegacao, rotulos de botao e textos de acessibilidade. O conteudo atual vai para o codigo **sem alteracao de texto**. Consequencia: o conjunto de secoes editaveis cai de 12 para **10** (saem `header` e `ingredientes`), o que contradiz a linha do PRD que lista as 12 secoes como editaveis — corrigida.

**3. Defeito relatado: desligar uma secao nao funciona (ligar funciona).** Diagnostico do orquestrador, feito antes de delegar:
   - **A API esta correta.** Verificado por requisicao direta: `PATCH .../visibility` com `false` responde `200`, a secao some de `GET /api/content`, o banco grava `is_published = false`; com `true` ela volta.
   - O caminho no painel (componente → gateway → reducer) foi lido e **parece correto**: o `onChange` envia `event.target.checked`, o gateway faz o `PATCH`, e o reducer aplica `summaryOf(action.section)`.
   - **Hipotese principal, sustentada por medicao:** o instantaneo embutido na LP tinha **11 secoes** enquanto a API devolvia **12**. A LP renderiza o instantaneo primeiro e so depois troca pela resposta da API. Isso explica a assimetria relatada — **ativar** faz a secao aparecer (o instantaneo nao a tem, a API passa a ter), e **desativar** pode nao faze-la sumir se a pagina continuar exibindo a copia antiga. O sintoma "so o ativar funciona" e exatamente o que esse desenho produz.
   - O usuario nao chegou a informar se o que falhou foi o painel ou a pagina; a tarefa precisa investigar as duas pontas em vez de assumir a hipotese.

Impacto: tarefas **T27** (corrigir o defeito de visibilidade) e **T28** (remover Ingredientes do projeto e o Header do CMS).

## 2026-09-04 — ERRO DO ORQUESTRADOR: dei o risco R-01 como encaminhado sem nunca verificar o caminho completo

Documento afetado: PLAN.md (T8, T14, T16), SDD.md (C-11)

Motivo: o risco **R-01** — o formulario coleta `conheceVirbac`, `usaProdutoVirbac` e `qualProdutoVirbac` e os descarta no envio — foi encontrado por mim na Fase 2 e acompanhado por dez tarefas. Ao aceitar a T8, verifiquei que a **API** grava os tres campos, enviando um `POST /api/leads` direto com eles no corpo, e registrei o risco como resolvido do lado da API, faltando "so a fiacao da LP", que eu atribui primeiro a T16 e depois assumi coberta pela T14.

Verificacao feita hoje, apos a T26: **o defeito continua vivo**. `apps/lp/src/sections/CapturaLead/services/submitLead.ts` monta um payload com nove campos — `nome`, `email`, `telefone`, `nome_cachorro`, `porte_cachorro`, `cidade_estado`, `aceite_lgpd`, `aceite_comunicacoes`, `origem` — e **os tres campos do R-01 nao estao la**, embora `useLeadForm.ts` e `LeadCaptureForm.tsx` os coletem do visitante. A API aceita e grava os tres quando eles chegam (provado hoje por requisicao direta); ninguem os envia.

Onde o raciocinio falhou: **verifiquei o produtor e nao o consumidor** — exatamente o erro que eu venho cobrando dos subagentes desde a T6 e que coloquei como aviso fixo em todas as delegacoes ("teste verde nao prova contrato com o consumidor"). Testei que a API **aceita** os campos; nunca testei que a LP **envia**. O criterio C-11 do SDD dizia "um envio do formulario cria um registro com todos os campos preenchidos", e eu o satisfiz com um envio meu, de linha de comando, em vez de pelo caminho que o visitante usa.

Agravante de processo: nenhuma tarefa teve "a LP envia os tres campos" como criterio explicito. A T8 fechou a API, a T14 religou o **conteudo** da LP e nao o formulario, e a T26 trocou a URL do endpoint sem tocar no payload. O risco atravessou dez tarefas porque cada uma cumpriu o proprio criterio, e o criterio que fecharia o defeito nunca foi escrito.

Impacto: acrescentado como item explicito da **T27**, com criterio verificavel pelo caminho do visitante — nao por requisicao minha. Regra derivada: risco que atravessa camadas precisa de um criterio de "pronto" que exercite **a camada mais externa**, na tarefa que a toca; verificar a camada interna nao encerra o risco, e "sera coberto por uma tarefa futura" precisa virar criterio escrito naquela tarefa, nunca uma nota de acompanhamento.

## 2026-09-04 — ERRO DO ORQUESTRADOR: duas tarefas concluidas ficaram registradas como "pendente" no PLAN.md

Documento afetado: PLAN.md (T20, T26)

Motivo: ao retomar o desenvolvimento nesta sessao, segui a instrucao de nao confiar no resumo herdado e reconferir tudo por comando antes de agir. `agent_context/PLAN.md`, como estava no disco, marcava **T20** (entrada unica de desenvolvimento) e **T26** (remocao do RD Station) como `Status: pendente` — mas o `git log` mostrava commits de ambas ja feitos, os tres servicos ja respondiam pela entrada unica em `:5173`, e o esquema do banco hospedado ja nao tinha nenhuma coluna do RD Station. As duas tarefas estavam **de fato concluidas**; so a nota de aceitacao no documento de processo nunca foi escrita.

Verificacao que fiz antes de corrigir, e nao apenas a leitura do `git log`: rodei a suite inteira (657 testes, verde), consultei o schema PostgREST de `leads` pela chave secreta (13 colunas, nenhuma de RD Station nem `aceite_lgpd`), rodei `verify-isolation.mjs` contra o projeto hospedado (exit 0), fiz `POST /api/leads` real sem consentimento (422) e com honeypot preenchido (200, sem gravar, confirmado por leitura direta da tabela), e conferi o conteudo servido (nao so o codigo HTTP) nas tres rotas da entrada unica (`/`, `/admin/`, `/api/health`).

Onde o raciocinio falhou: nao foi meu erro nesta sessao especificamente — a lacuna vem de uma sessao anterior, que implementou e aceitou as duas tarefas mas nao escreveu a nota de status no PLAN.md antes de a sessao terminar (ou de a atencao mudar para a tarefa seguinte). O erro que **esta** sessao poderia ter cometido, e nao cometeu porque a instrucao de retomada mandou reconferir tudo, seria confiar cegamente no `Status: pendente` do documento e re-executar ou redesenhar algo que ja existia e funcionava.

Impacto: PLAN.md corrigido com as notas de aceitacao das duas tarefas, incluindo a verificacao propria. Regra derivada, reforcando uma ja registrada: a nota de status de uma tarefa no PLAN.md **e parte da entrega dela**, no mesmo nivel que o codigo — uma tarefa so deve ser dada por terminada, dentro da mesma sessao que a implementou, depois que a nota "concluida e aceita" estiver escrita, nao so depois. Se a sessao for interrompida antes disso, quem retomar precisa tratar o `Status: pendente` como **nao confiavel**, nao como fato — exatamente o que a instrucao de retomada ja pedia, e que se provou necessario na pratica, nao so em tese.

## 2026-09-04 — T27: item 2 (R-01) corrigido e verificado pelo caminho do visitante; item 1 sem defeito reproduzido; achado novo do honeypot ausente na LP

Documento afetado: PLAN.md (T27)

Motivo: registro da execucao da T27, delegada a um subagente apos investigacao propria do orquestrador (ver entrada de 2026-09-04 sobre o R-01 dado como encaminhado sem verificar, e a propria tarefa no PLAN.md).

**Item 2 (R-01):** corrigido. `submitLead.ts` passou a enviar `conhece_virbac`, `usa_produto_virbac` e `qual_produto_virbac`. Verificado pelo caminho do visitante de verdade — preenchimento e envio do formulario em navegador real (Playwright), com leitura da linha gravada direto no Supabase hospedado pela chave secreta, confirmando os tres campos preenchidos. Lead de teste apagado; banco conferido em 0 linhas pelo orquestrador, de forma independente do relato do subagente.

**Item 1 (desligar secao):** o subagente nao conseguiu reproduzir o defeito relatado pelo usuario, em nenhuma das tres camadas (API, painel, LP), incluindo teste em Chromium real do lado da LP. A hipotese registrada no PLAN.md ("instantaneo com 11 secoes, API com 12") foi reavaliada pelo proprio orquestrador antes de delegar: no estado atual as duas fontes tem 11 secoes, e a leitura de `PublishedContentProvider.tsx` mostra substituicao completa de estado ao receber resposta da API, o que deveria corrigir a divergencia em qualquer carregamento novo de pagina, nas duas direcoes. A hipotese original pode ter sido valida no momento em que foi escrita (quando a `ingredientes` foi publicada por engano, criando de fato uma janela em que o instantaneo e a API divergiam), mas nao explica um defeito persistente no estado atual do codigo.

**Lacuna nao fechada, decisao pendente do usuario:** falta o clique real no checkbox do painel, autenticado como o operador de producao (`rodrigo.oliveira@duo.studio`). O subagente nao tinha a senha e duas tentativas de emitir uma sessao de teste sem tocar na senha (`generate_link` da Admin API do Supabase) foram bloqueadas pelo classificador de permissoes do ambiente. Corretamente, nao tentou contornar isso nem resetar a senha do operador por conta propria.

**Achado novo, fora do escopo declarado da T27, apenas relatado:** nao existe campo honeypot (`website`) em lugar nenhum do formulario real da LP (`apps/lp/src/sections/CapturaLead/`) — nem input, nem no payload de `submitLead.ts`. A defesa anti-bot que a API ja implementa (`isHoneypotTriggered`, testada e aceita desde a T8) nunca pode ser acionada por um envio de um visitante de verdade, porque o campo que ela verifica nunca e enviado. Nao e o mesmo defeito da T27 (que e sobre os tres campos da Virbac) e nao foi corrigido — decisao de adicionar o campo fica para o usuario.

Impacto: T27 com o item 2 aceito pelo orquestrador (verificacao propria, nao so o relato do subagente) e o item 1 sem correcao porque nao ha defeito comprovado — mas tambem sem fechamento total, pela lacuna do clique real autenticado. Registrado no PLAN.md. Pendencia de decisao do usuario: fornecer a senha do operador ou autorizar o uso do `generate_link` da Admin API do Supabase (nao altera a senha, so emite um token de sessao de uso unico) para fechar essa verificacao; e decidir se o achado do honeypot ausente vira tarefa.

Fechamento: o usuario forneceu a senha real do painel diretamente no chat. Um subagente logou de verdade em `/admin`, desligou e religou a secao `faq` pelo checkbox do operador, e confirmou nas duas direcoes contra a LP recarregada — nao reproduziu o defeito. A senha foi usada so em memoria (preenchida no formulario de login via automacao), nunca escrita em nenhum arquivo; o orquestrador conferiu isso com uma busca pelo valor em todo o repositorio, sem ocorrencia. T27 fechada como concluida.

## 2026-09-04 — Decisao do usuario: reverter a D-03 (operadores) e abrir duas frentes novas em paralelo

Documentos afetados: SDD.md (D-03, D-09 nova, C-13, R-10, contratos de endpoint), PLAN.md (T29, T30)

Motivo: ao reportar o fechamento da T27, o usuario trouxe dois pontos novos: (1) a interface do painel administrativo "esta muito ruim" e precisa melhorar para facilitar o uso; (2) nao existe modulo de cadastro de usuarios no painel.

Sobre o ponto 2, o orquestrador verificou antes de tratar como lacuna: **nao e um esquecimento**, e uma decisao registrada na D-03 do SDD ("a criacao de operadores acontece no painel do Supabase, nao numa tela do CMS. Coerente com o PRD, que deixou gestao de papeis fora de escopo"). Importante distinguir duas coisas que a redacao original misturava: o PRD deixa de fora **papeis e permissoes diferenciadas** (todo operador tem o mesmo nivel de acesso) — isso **nao muda**. O que a D-03 decidiu, por conveniencia de implementacao, foi **onde** a conta e criada (painel do Supabase em vez de uma tela do CMS) — isso e o que o usuario decidiu reverter.

Perguntado sobre como priorizar, o usuario escolheu **paralelo, em worktree isolado**, em vez de esperar a T28 terminar ou pausa-la.

**Decisao tecnica do orquestrador dentro do escopo autorizado, declarada aqui para nao parecer decidida em silencio:** a nova tela de operadores usa `admin.generateLink({ type: 'invite' })` da Admin API do Supabase, que devolve um link de ativacao para quem esta convidando copiar e enviar por fora (e-mail pessoal, WhatsApp, Slack) — **em vez de** `admin.inviteUserByEmail`, que dependeria do servidor de e-mail embutido do Supabase (plano gratuito deste projeto, nunca testado neste projeto, com limite baixo de envios e propenso a cair em spam). Registrado como D-09 no SDD. Se o usuario preferir envio automatico por e-mail no futuro, e uma troca pequena, sem mudar contrato nem tela.

Impacto: **T29** (gestao de operadores, implementacao completa) e **T30** (auditoria de usabilidade do painel — so levantamento e proposta, sem codigo, porque "esta muito ruim" e vago demais para virar tarefa de implementacao direto) entram no PLAN.md, ambas em worktree isolado, em paralelo a T28 que segue na arvore principal. As tres nao compartilham arquivo entre si na medida do que se sabe agora; qualquer sobreposicao encontrada na execucao precisa ser tratada como o guardrail de arquivo compartilhado manda — sequencial, nao paralela, apesar de estarem em arvores diferentes (T29 toca o painel; se a auditoria da T30 apontar problema na mesma tela que a T29 esta construindo, a correcao dessa tela especifica espera a T29 terminar).

## 2026-09-04 — T28 concluida; proposta (nao implementada) de aviso ao publicar secao vazia

Documento afetado: PLAN.md (T28)

Motivo: registro do fechamento da T28 (remocao da secao Ingredientes do projeto inteiro e saida do Header do CMS, com os textos fixados em codigo). Detalhe completo da execucao e da verificacao em `agent_context/PLAN.md`, entrada da T28.

**Achado de produto herdado da entrada de 2026-09-04 acima ("A secao Ingredientes sai do projeto"), avaliado nesta tarefa por instrucao explicita — proposto, nao implementado:** o painel hoje deixa `PUT /api/admin/sections/:key` gravar e publicar uma secao cujo unico conteudo e o campo obrigatorio minimo (ex.: so um titulo, sem nenhum outro campo preenchido de fato) sem nenhum aviso ao operador — foi assim que a publicacao acidental da `ingredientes` colocou um bloco quebrado (so titulo, sem corpo) na LP.

Proposta avaliada: ao salvar, se a secao tiver **um so campo preenchido** (ou, de forma mais geral, menos campos preenchidos que um limiar baixo — a exemplo de "so os campos obrigatorios e nenhum opcional, numa secao que declara mais de um campo") o painel mostraria um aviso nao bloqueante antes de confirmar a publicacao ("Esta secao tem pouco conteudo alem do titulo. Publicar mesmo assim?"), com um segundo clique para confirmar — o mesmo padrao de confirmacao em dois passos ja usado na exclusao de lead. Nao bloqueante porque uma secao com um campo so pode ser legitima (ex.: uma secao realmente simples); o problema e a ausencia de sinal ao operador, nao a possibilidade de publicar pouco conteudo.

Esforco estimado: pequeno — a contagem de "quanto foi preenchido" ja existe implicitamente no rascunho do formulario (`section-draft.ts`), e o aviso e so mais um estado de confirmacao na tela de edicao (`SectionEditorScreen.tsx`), no mesmo padrao ja usado para outras confirmacoes do painel. Nao exige mudanca de esquema nem de API. Estimativa: uma tarefa pequena, provavelmente menor que a T27.

Impacto: nenhuma mudanca de codigo feita por esta decisao — registrada para o usuario decidir se vira tarefa nova no PLAN.md.

## 2026-09-04 — Decisao do usuario: remover o campo de legendas de video, e tirar o Rodape do CMS

Documentos afetados: PRD.md, SDD.md, PLAN.md

Motivo: o usuario, ainda navegando o painel enquanto T28/T29/T30 rodavam em paralelo, pediu duas remocoes.

1. **"Arquivo de legendas" e desnecessario, apagar tudo.** Verificado pelo orquestrador antes de escrever a tarefa: `media_assets` tem **0 registros** com `kind = 'caption'` — o campo nunca foi usado de verdade, entao a remocao nao perde conteudo real de nenhum operador. Ressalva registrada, nao para bloquear: o PRD listava legenda de video como parte do requisito de acessibilidade preservada (linha "legendas de video continuem sendo preenchidas"). Como nunca houve uso, o custo de hoje e baixo, mas fica registrado que o CMS perde essa capacidade se vier a ser necessaria depois — o usuario decidiu remover mesmo assim, e a linha do PRD sera ajustada quando a tarefa (T31) for executada.

2. **O Rodape sai do CMS, mesmo tratamento do Header (T28).** O usuario tentou nomear isso duas vezes na conversa — primeiro escreveu "o painel", depois se corrigiu para "o rodape" — entao a leitura final e a segunda mensagem. Antes de escrever a tarefa, o orquestrador confirmou que nao existe nenhum campo ou secao chamada "painel" no esquema (o unico "painel" do projeto e a propria aplicacao administrativa), reforcando que a correcao do usuario era a intencao real.

**Por que as duas nao foram implementadas na hora:** T28 estava em execucao na arvore principal, tocando exatamente os mesmos arquivos compartilhados (`content-schema/contract.ts`, `App.tsx`, o instantaneo, a contagem de secoes no painel) que a remocao do Rodape e do tipo de midia `legenda` tambem precisam tocar. Editar isso ao vivo, com um subagente jah escrevendo nos mesmos arquivos, e exatamente o conflito de arquivo compartilhado que a skill probe evitar. As duas entram no PLAN.md como **T31** (legendas) e **T32** (rodape), dependentes da T28 e sequenciais entre si (nao paralelas uma da outra, pelo mesmo motivo).

Impacto: PRD.md corrigido em duas frentes nesta mesma entrada — a lista de secoes editaveis (linha 11) tirou Header e Ingredientes, que a T28 havia removido sem que o subagente atualizasse o PRD (lacuna do subagente, corrigida agora pelo orquestrador); e a mencao ao poster de video (linha 15), removido desde a T24 mas nunca tirada do PRD. T31 e T32 registradas no PLAN.md, ambas dependentes de T28 e sequenciais entre si.

## 2026-09-04 — T31 concluída: campo "Arquivo de legendas" removido do projeto inteiro

Documento afetado: PLAN.md (T31), SDD.md (glossário "Mídia", "Modelo de dados", "Contrato do esquema de seção", C-07), PRD.md (linha de acessibilidade)

Motivo: registro da execução da T31, delegada a um subagente após o mapeamento de escopo já registrado na entrada de 2026-09-04 acima ("Decisao do usuario: remover o campo de legendas de video, e tirar o Rodape do CMS").

**Escopo real maior que o mapeado.** O levantamento original da tarefa (PLAN.md) listava `content-schema`, `apps/admin` e `apps/lp`, mas não `apps/api` — que também tinha o tipo `caption`/`legenda` espalhado por `media-kind.ts`, `media-asset.ts`, `media.module.ts`, `register-media.dto.ts`, `public-content.controller.ts` e sete arquivos de teste/spec (`media-kind.spec.ts`, `upload-plan.spec.ts`, `media-references.spec.ts`, `documento-de-exemplo.ts`, `admin-midia.e2e-spec.ts`, `midia-no-conteudo.e2e-spec.ts`). Descoberto por um grep amplo antes de editar, corrigido na mesma tarefa.

**Migração planejada precisou mudar de forma.** A primeira versão da migração SQL tentava `delete from storage.objects` e `delete from storage.buckets` para o bucket `veggiedent-captions`. O projeto hospedado recusou as duas com `SQLSTATE 42501` ("Direct deletion from storage tables is not allowed. Use the Storage API instead.") — uma proteção da plataforma Supabase, não deste projeto. O bucket foi removido pela Storage API (`POST .../bucket/veggiedent-captions/empty` seguido de `DELETE .../bucket/veggiedent-captions`, com o bucket já vazio — 0 objetos, confirmado antes). A migração aplicada de fato só contém a policy de leitura pública restrita aos dois buckets restantes e o estreitamento do `check` de `media_assets.kind` de `('image', 'video', 'caption')` para `('image', 'video')`. Os testes que reconstroem o estado dos buckets a partir do texto das migrações (`media-kind.spec.ts`, `upload-policy.test.ts`) continuam encontrando os **três** buckets nas migrações — a remoção do terceiro não é replicável em SQL puro, e isso ficou documentado nos dois arquivos.

**Verificação:** `npm run test` (649/649: admin 196, api 299, lp 39, content-schema 115), `npm run typecheck` e `npm run build` verdes nos quatro workspaces. `npm run instantaneo` regenerado (sem diferença: a API nunca chegou a devolver `captions`, por não haver registro nenhum desse tipo). Em navegador real (Chromium via Playwright, ambiente sem as bibliotecas de sistema do Chromium — resolvido baixando `libnspr4`/`libnss3`/`libasound2t64` via `apt-get download` e extraindo com `dpkg-deb -x`, sem precisar de root): a seção Demonstração renderiza 3 vídeos sem elemento `<track>`, e o primeiro reproduz de verdade (`currentTime` avançando, `!paused`); logado como operador de verificação (criado pela Auth Admin API e removido ao final), a tela de edição da seção Demonstração não mostra a palavra "legenda" em lugar nenhum. Tentativa real de inserir `kind = 'caption'` em `media_assets` foi recusada com `23514`.

Impacto: T31 fechada como concluída. Nenhuma pendência aberta. Trabalho segue para a T32 (Rodapé), a partir do HEAD desta branch.

## 2026-09-04 — T32 concluída: Rodapé fixado em código, esquema cai para 9 seções

Documento afetado: PLAN.md (T32), PRD.md (linha "Painel de edição por seção", linha de acessibilidade já corrigida na T31), README.md (contagem de seções, tabela de migrações, tabela "o que a carga inicial produziu")

Motivo: registro da execução da T32, delegada a um subagente logo após o fechamento da T31 na mesma branch/árvore (T31 e T32 sequenciais, mesmo guardrail de arquivo compartilhado já registrado na entrada de 2026-09-04 acima).

**Valores conferidos de novo antes de codificar**, via `GET /api/content` real: bateram exatamente com os capturados quando a tarefa foi escrita — nada mudou entre a captura e a execução. `Footer.tsx` foi reescrito sem `connectSection`, mesmo padrão exato do `Header.tsx` da T28: as seis strings (`logo`, `logoAlt`, `claimSource`, `speciesDisclaimer`, `copyright`, os três links) viraram constantes de módulo, copiadas literalmente.

**Escopo de "propagar a contagem para 9" maior que os quatro locais previstos na tarefa.** Além de `content-schema`, `apps/admin` (SectionsScreen, editable-schema) e `apps/api` (módulo content), doze arquivos de código de produção e teste em `apps/admin`, `apps/api` e `packages/content-schema` tinham "10 seções" em comentário ou nome de teste (`get-published-content.use-case.ts`, `get-section.use-case.ts`, `list-sections.use-case.ts`, `validated-section-document.ts`/`.spec.ts`, `supabase-section.repository.ts`, `admin-sections.controller.ts`, `resource-not-found.error.ts`, `admin-secoes.e2e-spec.ts`, `conteudo-publico.e2e-spec.ts`, `midia-no-conteudo.e2e-spec.ts`, `site-metadata.ts`, `invariants.test.ts`, `App.test.tsx` da LP) — todos localizados por grep e corrigidos para "9" na mesma tarefa. `agent_context/SDD.md` **não foi tocado**: seu glossário "Seção" já cita "12" (drift de antes da T28, nunca corrigido — registrado como lacuna conhecida na entrada de fechamento da T28), fora do padrão "cita 10 seções" que esta tarefa pedia para corrigir, e corrigi-lo agora seria reescrever uma nota de tarefa passada por conta própria.

**Migração precisou ser escrita depois de reconfirmar a tabela certa.** Diferente da T31 (que esbarrou na proteção do Supabase contra DML direto em `storage.*`), `content_sections` é uma tabela comum do schema `public` — a mesma que a migração da T28 já havia alterado com sucesso pelo mesmo caminho (`delete` + `drop/add constraint`). Aplicada sem obstáculo via `npx supabase db push` (pooler).

**Verificação:** `npm run test` (644/644: admin 196, api 299, lp 39, content-schema 110 — a contagem caiu de 649 porque a T32 removeu o `footerDocument` de fixtures e as validações que dependiam dele), `npm run typecheck` e `npm run build` verdes nos quatro workspaces. Banco hospedado: `content_sections` de 10 para 9 linhas, sem `footer`; tentativa real de `insert` com `key = 'footer'` recusada com `23514`. Em navegador real (Chromium via Playwright, mesmo contorno de bibliotecas de sistema ausentes já usado na T31): o rodapé da LP comparado campo a campo contra os valores capturados via `GET /api/content` — logo (`src` e `alt`), os 3 links (`href` e texto, na ordem certa), `claimSource`, `speciesDisclaimer` e `copyright` — todos idênticos; logado como operador de verificação (criado pela Auth Admin API e removido ao final), a lista de seções do painel mostra exatamente 9 itens numerados, sem "Rodapé".

Impacto: T32 fechada como concluída. Nenhuma pendência aberta. `legalData` (CNPJ e demais dados legais da Virbac, nunca preenchido no CMS) deixou de ter campo — se a Virbac entregar o dado, entra direto em `Footer.tsx`, não mais via painel; a pendência correspondente saiu da lista "Pendências herdadas" do README (o item genérico "Dados legais da Virbac Brasil... pendentes no rodapé" permanece, agora resolvido em código quando chegar).

## 2026-09-04 — Integração de T29 na linha T28→T31→T32, e incidente operacional na retomada

Documento afetado: nenhum documento de processo (bookkeeping de execução) — registrado para a análise da skill

Motivo: o usuário pediu uma nova tarefa (T33, menu lateral + redesenho do login + 6 achados da T30) que precisa enxergar **todas** as telas do painel, incluindo a de Operadores da T29 — que vivia numa branch separada (`feat/T29-gestao-operadores`, ramificada antes da T31/T32) nunca integrada à linha principal de trabalho. Construir a T33 sobre a branch da T31/T32 sem a T29 deixaria a tela de Operadores fora do menu lateral novo, e construir sobre a branch da T29 perderia a remoção de legendas e do Rodapé.

Resolvido com um **merge local entre branches de feature** (nunca em `main`), no mesmo padrão já usado quando a T3 foi integrada à linha de trabalho da T5: `git merge feat/T29-gestao-operadores` dentro de `feat/T32-rodape-fixo-codigo`. Sem conflito nenhum — os dois lados tocam arquivos disjuntos (T29 é um módulo novo, `operators/`; T31/T32 mexem em `demonstracao`/`footer`/`content-schema`). Suíte reconferida do zero após o merge: 684 testes verdes (216 admin + 319 API + 39 LP + 110 content-schema), typecheck e build limpos.

**Incidente na retomada dos serviços, mesmo padrão já documentado na T28:** depois do merge, `GET /api/health` respondeu `500` e depois `Connection refused` — a API tinha morrido. Diagnóstico: (a) havia **dois** processos `nest start --watch` órfãos da árvore principal rodando ao mesmo tempo (um de 13:44, outro de 17:33), nenhum escutando a porta 3000 — encerrados pelo PID exato, nunca `pkill -f`; (b) a tentativa de subir tudo de novo com `npm run dev` falhou porque as portas 5173/5174 ainda estavam ocupadas por processos Vite antigos que sobreviveram à primeira tentativa de reinício — também encerrados pelo PID exato; (c) com as portas livres, a API ainda recusou subir com `EnvironmentValidationError: ADMIN_APP_URL: variável obrigatória ausente` — o merge trouxe da T29 uma variável de ambiente nova e obrigatória que o `apps/api/.env` da árvore principal nunca teve (só o `.env` de dentro do worktree isolado da T29 tinha sido preenchido, pelo orquestrador, especificamente para aquela verificação). Corrigido acrescentando `ADMIN_APP_URL=http://localhost:5173` ao `.env` da árvore principal — valor correto para este ambiente, já que a entrada única já serve o painel em `/admin` na mesma porta da LP (T20), diferente do valor `5274` usado no worktree isolado da T29.

Onde o raciocínio falhou: reintegrar uma branch trazida de um worktree isolado precisa verificar não só o **código** (typecheck/test/build, que passaram sem ajuste) mas também o **ambiente** — variável de ambiente nova declarada como obrigatória num módulo que só existia no worktree isolado não tem como já estar no `.env` da árvore principal, porque os dois nunca compartilharam esse arquivo (gitignorado, cada árvore tem o seu). Regra derivada: depois de um merge que traz módulo novo de um worktree isolado, conferir `git diff` dos arquivos `*.env.example`/schema de configuração contra o `.env` real da árvore que vai rodar o merge, antes de simplesmente tentar subir os serviços — a mesma disciplina de "verificar o conteúdo servido, não só o código HTTP" precisa incluir "verificar que o processo nem chegou a subir", que é um passo anterior e mais barato de checar.

Impacto: nenhum dano — os serviços foram religados corretamente e o estado final foi verificado (LP/admin/API/`/admin/operadores` todos `200`, 9 seções corretas). A branch `feat/T32-rodape-fixo-codigo` agora carrega T28+T29+T31+T32 integradas (nome da branch ficou desatualizado em relação ao conteúdo — aceito como está, renomear no meio do trabalho traria mais risco do que o nome enganoso).

## 2026-09-04 — T33 concluída; interrupção por limite de sessão do orquestrador não perdeu trabalho

Documento afetado: PLAN.md (T33)

Motivo: registro de como uma interrupção por limite de uso (não falha do subagente) foi tratada. O primeiro subagente da T33 morreu por limite de sessão do orquestrador no meio da execução, sem dar tempo de commitar — mas a árvore de trabalho ficou num estado coerente e **totalmente verde** (691 testes, typecheck limpo), porque o subagente commita por unidade lógica completa, não ao acaso. O orquestrador conferiu isso rodando a suíte antes de decidir o que fazer, e relançou um segundo subagente com instrução explícita de **retomar, não recomeçar** — `git status`/`git diff` primeiro, para entender o que já existia.

O segundo subagente encontrou uma discrepância no que o orquestrador havia escrito como "já pronto": os achados (a)/(b) do login (contraste do botão, validação em português) foram descritos como concluídos, mas `LoginScreen.tsx` estava intocado. A causa foi que a mensagem de resumo do primeiro subagente, capturada pelo orquestrador na notificação de falha, listava um plano de trabalho, não um relato de execução real — e o orquestrador repassou esse plano como fato consumado. O segundo subagente não confiou cegamente na premissa, leu o arquivo, viu que não batia, e implementou do zero em vez de pular a etapa.

Onde o raciocínio falhou: é a mesma regra já derivada em 2026-09-02 ("nota de handoff de tarefa interrompida só afirma pendência depois de inspecionar o artefato"), agora do lado inverso — o erro não foi afirmar pendência que não existia, foi afirmar **conclusão** que não existia. A mensma disciplina cobre os dois sentidos: depois de uma interrupção, tanto "isso falta" quanto "isso já está pronto" são hipóteses até o arquivo real confirmar.

Impacto: T33 fechada como concluída e aceita (708 testes, 8 commits). Regra derivada, generalizando a de 2026-09-02: ao retomar uma tarefa interrompida, tratar qualquer afirmação sobre o que já foi feito — não só sobre o que falta — como não confirmada até o subagente (ou o orquestrador) ler o artefato real.

## 2026-09-04 — Decisão do usuário: operador passa a ser criado direto com e-mail, senha e nome (reverte parte da D-09)

Documentos afetados: SDD.md (D-09), PLAN.md

Motivo: o usuário perguntou por que a criação de operador manda um convite por e-mail em vez de criar a conta direto preenchendo os dados. Explicado o motivo original (D-09: ninguém além do próprio operador deveria saber a senha dele, nem por um instante), o usuário decidiu mesmo assim que prefere o caminho direto: preencher e-mail, senha e nome do operador na hora, sem link nem e-mail.

Impacto: registrado como tarefa **T34**. `POST /api/admin/operators` passa a usar `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } })` em vez de `generateLink({ type: 'invite' })`. A rota `/admin/ativar` e as telas associadas (`ActivateRoute.tsx`, `ActivateScreen.tsx`, construídas na correção da T29) ficam **sem nenhum chamador** — candidatas a remoção como código morto, decisão que cabe à T34 avaliar e declarar, não presumir. O campo "nome" é conceito novo para operador (hoje só e-mail existe) — vai para `user_metadata` do Supabase Auth, não para uma tabela própria (não existe tabela de operadores no CMS, é a Admin API do Supabase Auth quem é a fonte, conforme já registrado na D-09 original).

**Fechamento (2026-09-04):** T34 implementada e aceita. `ActivateScreen`/`ActivateRoute` confirmados sem chamador e removidos, junto com a cadeia `activate`/`setPassword` que só existia para sustentá-los. Verificado ponta a ponta em navegador real (criar operador de teste com e-mail/senha/nome, logar com a senha definida sem link nenhum, remover, confirmar 0 conta órfã na Admin API do Supabase).

## 2026-09-04 — Pedido extenso do usuário: identidade visual, tema, dashboard e polimento geral do painel (T35)

Documentos afetados: PRD.md (Notas de design), PLAN.md

Motivo: enquanto a T34 rodava, o usuário listou de uma vez um conjunto grande de pedidos de UI para o painel: identidade visual alinhada à LP (mesmas cores/estilo, logo da LP no lugar do texto "Painel Veggiedent" no menu), opção de recolher o menu lateral, tema claro/escuro, ícones no menu e dentro dos módulos, animações, reorganização visual dos campos de formulário (hoje "soltos"), texto de abertura de cada módulo revisto ("sem vida"), uma barra de ação fixa no rodapé para "Salvar e publicar" (pensada para servir também a ações futuras), e um dashboard real ao entrar no painel com informações e atalhos rápidos.

Ponto notável: o pedido de identidade visual alinhada à LP **reverte uma decisão de design já registrada** — o PRD dizia explicitamente que o painel "não precisa seguir a identidade visual da marca Veggiedent", e o `tailwind.config.ts` do admin tem um comentário deliberado explicando por que os tokens de cor da LP não foram copiados para lá (evitar duplicação, regra G5 do catálogo de código limpo). O orquestrador atualizou o PRD para registrar a reversão, e a tarefa (T35) instrui explicitamente a **não duplicar os valores hex** ao aplicar a nova identidade — extrair os tokens para um lugar compartilhado entre os dois apps, honrando a mesma regra G5 que motivou a decisão original, só que agora aplicada à direção contrária.

Impacto: registrado como tarefa **T35**, dependente da T34 (mesmos arquivos do painel — sequencial, não paralela a nada que já esteja rodando). Escopo grande e enumerado item a item no PLAN.md, com orientações técnicas concretas para não introduzir dependências novas sem necessidade (usar `darkMode: 'class'` do Tailwind em vez de biblioteca de tema; reaproveitar `lucide-react`, já usado pela LP, em vez de escolher outra lib de ícones; preferir utilidades de transição do Tailwind a uma biblioteca de animação).

## 2026-09-04 — ERRO DO ORQUESTRADOR: sobre-engenharia de verificação — quase 2 horas para uma troca de 3 linhas de CSS

Documento afetado: nenhum documento de processo (disciplina de delegação) — registrado a pedido do usuário, para a análise da skill

Motivo: depois da T36 aceita, o usuário pediu um ajuste cosmético — o campo de imagem em dropzone estava grande demais. A mudança real, entregue no commit `0814fb6`, foi trocar três constantes de classe Tailwind (`aspect-video` → `h-40 w-full`; `aspect-square` → `h-32 w-32`; remover um `w-full` conflitante) em três arquivos. O subagente levou **116 minutos** (6.990.884 ms), **78 chamadas de ferramenta** e **144.861 tokens** para entregar isso. O usuário perguntou diretamente por que uma mudança "tão simples" demorou mais de uma hora — pergunta justa, e a resposta é um erro meu de delegação, não do subagente.

**Onde o esforço foi gasto** (o subagente relatou em detalhe, não é suposição): suíte inteira dos 4 workspaces (730 testes) rodada do zero; typecheck e build dos 4 workspaces; montagem de Chromium headless de verdade neste ambiente sandboxado **sem root e sem navegador pré-instalado** (extração manual de pacotes `.deb`, repetida a cada subagente que precisa de navegador real, porque cada subagente é um processo novo sem o estado do anterior); login real como o operador; verificação nos **dois temas** (claro/escuro); os **quatro estados** do campo (vazio/enviando/preenchido/excluindo) tanto no campo único quanto na variante múltipla; criação e limpeza de mídias de teste no banco e no armazenamento reais.

**Onde o raciocínio falhou:** eu instruí esse subagente com o mesmo texto de verificação "pesada" que uso para toda mudança de painel/LP — herdado do guardrail real e bem fundamentado desta sessão ("TESTE VERDE NÃO PROVA CONTRATO COM O CONSUMIDOR", que já pegou 6+ defeitos reais em navegador). Mas apliquei essa régua **sem discriminar o tipo de mudança**. O guardrail existe para pegar regressão de **comportamento** — sessão que não persiste, upload que não confirma, validação que não dispara. Uma troca pura de classe CSS de tamanho, sem tocar em lógica, tem uma superfície de risco muito menor, e não precisa do mesmo ciclo completo para ser considerada segura. Tratei "verificação em navegador obrigatória" como uma regra binária (tem ou não tem) quando ela deveria ser proporcional — a mesma "regra de proporcionalidade" que a skill já aplica ao porte do projeto no SDD, e que eu não pensei em aplicar aqui, ao **tamanho da mudança dentro de uma tarefa já aceita**.

**Correção já aplicada, no pedido seguinte do usuário** (troca de `object-cover` para `object-contain`, mesma classe de mudança): a delegação seguinte foi escrita explicitamente como "verificação leve" — só o workspace do painel nos testes (não os 4), sem exigir login em dois temas nem todos os estados, com instrução explícita de não repetir o ciclo completo. É a correção proposta abaixo, já em prática antes mesmo de ser formalizada aqui.

Impacto: nenhum dano ao produto — a mudança foi entregue corretamente, só demorou mais do que deveria e queimou tokens à toa. Regra derivada para a skill: **a profundidade da verificação exigida numa delegação deve ser proporcional ao tipo de mudança, não ao tipo de projeto/tarefa em que ela vive.** Uma tarefa de painel/LP continua exigindo navegador real para qualquer mudança de **comportamento** (dado que persiste, estado que muda, fluxo que avança) — isso não muda. Mas uma mudança **puramente cosmética** (classe CSS de tamanho/cor/espaçamento, sem lógica nova) pode e deve ser verificada com uma checagem visual mínima e o teste do workspace afetado, não a suíte inteira dos quatro workspaces nem o ciclo completo de login em dois temas por todos os estados. Cabe a quem delega (o orquestrador) classificar a mudança antes de escrever o critério de "pronto" — não delegar a mesma régua pesada por hábito.

## 2026-09-05 — Skill atualizada para 1.5.0 e aplicada retroativamente ao projeto

Documentos afetados: PLAN.md, SDD.md, README.md, /docs

Motivo: o usuario forneceu a versao 1.5.0 da skill `orquestrador-projeto`. O changelog dela declara ter sido derivado de dogfooding **deste projeto**, usando este `agent_context/CHANGELOG.md` como fonte primaria de evidencia — e os numeros confirmam: ela cita "README de mais de 1100 linhas" (o nosso tinha **1132**), "mais de 150 commits em branches nunca mergeadas" (**157**, em 34 branches) e "plano real de 36 tarefas" (**36**). Os erros registrados aqui viraram regra la.

Aplicacao das dez mudancas, autorizada pelo usuario:

1. **README com teto de 4 secoes** — de **1132 para 53 linhas**; 1007 linhas movidas para sete arquivos em `/docs`, todos alcancaveis pelo README. Nada perdido, exceto dois blocos descartados de proposito: a nota de "scaffold da Fase 3" (obsoleta) e a secao "Estado verificado" (85 linhas de narrativa de verificacao, que a skill proibe em documentacao tecnica e que ja vive tarefa a tarefa no PLAN.md).
2. **Classificacao cosmetica x comportamental** e **3. verificacao pelo consumidor** — acrescentadas ao PLAN como regras de execucao.
4. **Retomada nao confia em status nao verificado** — aplicada, e **pegou um erro real na hora**: o orquestrador ia integrar `feat/T26-remove-rdstation` como ponta da cadeia, mas a branch havia mudado enquanto a sessao estava pausada. Outra conversa levou o projeto de T27 ate **T36**, com nove branches desconhecidas. A ponta real era `feat/T36-acoes-e-dropzone`. Sem a verificacao, o merge teria descartado dez tarefas.
5. **Ponto unico de entrada declarado no SDD**, com a divida registrada: deveria existir na primeira versao e so nasceu na T20.
6. **Recurso fisico ampliado** (lockfile, arvore de trabalho do git, banco, porta) — formalizado no PLAN; os tres primeiros foram descobertos por acidente aqui, um de cada vez.
7. Roteiro de kickoff — retrospectivo, sem acao.
8. Projeto existente documentado por inteiro — auditado, sem divergencia.
9. **Merge e push como 4a camada de aceite** — executado: `main` avancou por fast-forward preservando os 157 commits e as fronteiras de tarefa, `70cfb61..8297d57` enviado ao remoto, **34 branches e 4 worktrees removidos**. O repositorio passou de 34 branches para uma.
10. **Identificadores `{fase}/{nome}`** — acrescentados as 36 tarefas com tabela de equivalencia. **Decisao do orquestrador:** o rotulo `T{n}` foi mantido nas referencias cruzadas, porque renomear as centenas de citacoes espalhadas por PLAN e CHANGELOG corromperia a rastreabilidade historica — que e o motivo de o registro existir — em troca de forma. Tarefas novas usam apenas o esquema novo.

**Auditoria da regra 4, resultado:** nenhuma divergencia entre o que o PLAN afirma e o codigo real. Zero `*.content.ts`, zero referencias ao RD Station, 9 secoes no esquema (Ingredientes, Header e Footer removidos), tipo "legenda" removido. E confirmou o fechamento do **risco R-01**: os tres campos que se perdiam a cada envio agora sao enviados pela LP — corrigido na outra conversa, depois de o orquestrador ter registrado, aqui, o proprio erro de te-lo dado como resolvido verificando so a API.

Correcao de conteudo feita junto: `docs/OPERACAO.md` carregava, movida verbatim do README, a afirmacao vencida de que "ate la as tabelas estao vazias" a espera da T9 — que ja foi executada. O subagente sinalizou em vez de corrigir, por ser tarefa de reorganizacao; corrigido pelo orquestrador.
