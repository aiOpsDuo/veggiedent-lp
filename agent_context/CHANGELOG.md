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
