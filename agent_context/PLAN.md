# Plano de Implementação — CMS Veggiedent LP

Derivado de: `agent_context/SDD.md` (versão aprovada em 2026-09-02)

## Política de branch/PR

Porte declarado no SDD: **Médio**. Conforme `references/git-workflow.md` § "Política de branch/PR por porte", isso implica:

- **Branch por tarefa, obrigatória.** Nome: `feat/T{n}-{slug}` (ou `fix/`, `chore/`, `refactor/` conforme o tipo dominante da tarefa). Nenhum commit direto em `main`.
- **Pull Request obrigatório** para integrar em `main`.
- **Revisão obrigatória antes do merge**, além do critério de "pronto" automatizado. Os dois são complementares: build verde não dispensa revisão.
- **Commits em Conventional Commits**, sem exceção. Nunca `git push --force` em branch compartilhada.

## Convenções de verificação

Comandos rodados a partir da raiz do repositório, após a reestruturação da T1:

| Comando | O que verifica |
|---|---|
| `npm run typecheck` | Checagem de tipos de todos os workspaces |
| `npm run build` | Build de todos os workspaces |
| `npm run test` | Testes de todos os workspaces |
| `npm run test -w <workspace>` | Testes de um workspace específico |

## Política de serviços em execução (definida pelo usuário em 2026-09-02)

O usuário mantém a LP e a API no ar para testar enquanto o desenvolvimento acontece. Regra que ele estabeleceu:

- **Não é obrigatório manter os serviços de pé durante uma alteração.** Se uma tarefa precisa instalar dependências, recompilar ou migrar, pode derrubar o que for necessário.
- **É obrigatório subir tudo de volta depois que os ajustes forem aplicados.** Vale para todos os serviços do projeto, não apenas a LP.
- Responsabilidade do orquestrador: ao aceitar qualquer tarefa, verificar que os serviços voltaram e responder — conferindo o **conteúdo** servido, não só o código HTTP.

Comandos de referência (monorepo com workspaces: binário da raiz, diretório de trabalho do workspace-alvo):

```bash
# LP — de dentro de apps/lp, com o binário da raiz
../../node_modules/.bin/vite --host 0.0.0.0 --port 5173 --strictPort

# API — de dentro de apps/api, após npm run build -w apps/api
node dist/main.js            # com as variáveis de apps/api/.env carregadas, PORT=3000
```

Encerrar processo **pela porta em escuta**, nunca com `pkill -f` cujo padrão a própria linha de comando contenha (ver CHANGELOG, erros operacionais).

## Tarefas

### T1 — Reestruturar o repositório em monorepo
- Descrição: converter o repositório em workspaces npm, movendo a LP atual da raiz para `apps/lp/` e criando os diretórios `apps/admin/`, `apps/api/` e `packages/content-schema/`, com os scripts agregadores na raiz. Ajustar caminhos de build, imports de assets, `tsconfig`, `tailwind.config.ts`, `postcss.config.js` e `index.html`.
- Rastreável a: SDD § "Estrutura de pastas do repositório"
- Critério de "pronto": `npm run typecheck` e `npm run build` passam a partir da raiz; `apps/lp/dist/` é gerado com os mesmos assets de antes; a LP servida por `npm run preview` renderiza as 12 seções sem erro de console.
- Dependências: nenhuma
- Execução: sequencial — toca praticamente todos os arquivos do repositório; nenhuma outra tarefa pode começar antes.
- Toca documentação: sim — README ganha a estrutura de pastas e os comandos novos da raiz.
- Status: **concluída** em 2026-09-02, branch `chore/T1-monorepo` (3 commits, sem merge). Verificado pelo orquestrador: `npm run typecheck`, `npm run build` e `npm run test` rodados diretamente, todos passando; `apps/lp/dist/` gerado com os mesmos hashes de antes da movimentação; `main` intocada.
- Nota sobre o critério: o critério dizia "renderiza as 12 seções". Na prática são 11 blocos renderizados — `Ingredientes` retorna nulo por decisão do código atual (`isContentReady: false`), que é justamente a pendência da Virbac já registrada. Não é regressão; o critério é que estava impreciso.

### T2 — Pacote de esquemas de seção
- Descrição: criar `packages/content-schema` declarando, para as 12 seções, os campos e listas conforme o contrato do SDD (nome, tipo, rótulo em português, ajuda, obrigatoriedade), mais o esquema dos metadados da página. Exportar os tipos TypeScript derivados e a função de validação de um documento de seção.
- Rastreável a: SDD § D-02 e § "Contrato do esquema de seção"
- Critério de "pronto": `npm run test -w packages/content-schema` passa, com ao menos um caso válido e um inválido por seção; todo campo do tipo `imagem` tem um campo de texto alternativo obrigatório adjacente, verificado por um teste que percorre os 12 esquemas; os tipos cobrem todos os campos hoje presentes nos 12 arquivos `*.content.ts`.
- Dependências: T1
- Execução: paralelizável com T3
- Toca documentação: sim — README explica como adicionar um campo novo a uma seção.
- Status: **concluída** em 2026-09-02, branch `feat/T2-content-schema` (3 commits, sem merge). Verificado pelo orquestrador: `npm run typecheck`, `npm run test` e `npm run build` rodados diretamente — 134 testes passando (129 do pacote, 5 da LP), typecheck sem erro, build em 3.11s.
- Nota de revisão (porte Médio exige revisão antes do merge): o teste de cobertura depende de uma **tabela de tradução** entre os nomes de hoje e os do esquema, porque o esquema renomeia e achata de propósito. Ela é necessária, mas é o ponto onde um campo esquecido poderia ser silenciado no futuro. Mitigações já presentes: dois testes de guarda (entrada obsoleta e renomeação órfã) e a categorização de cada diferença por motivo. Auditei as quatro categorias e conferi manualmente os sete textos do formulário mais fáceis de perder (`lgpdLabel`, `optInLabel`, `submitLabel`, `submitLoadingLabel`, `errorToastMessage`, `porteOptions`, `simNaoOptions`): todos presentes no esquema e no conteúdo atual. **Limitação conhecida:** o teste verifica conteúdo ⊆ esquema, não o inverso — campos que existem só no esquema (`hero.image`, `header.logo`, `footer.logo`, `partners.logoAlt`) são intencionais, pois hoje essas imagens são importadas nos componentes e passam a ser editáveis.

### T3 — Esquema do banco e armazenamento no Supabase
- Descrição: escrever as migrações SQL das quatro tabelas (`content_sections`, `site_metadata`, `media_assets`, `leads`), habilitar RLS sem policy permissiva em todas elas, e criar os buckets de mídia.
- Rastreável a: SDD § "Modelo de dados"
- Critério de "pronto": a migração aplica sem erro em um projeto Supabase limpo; uma requisição com a chave anônima a cada uma das quatro tabelas retorna erro de permissão ou conjunto vazio, nunca dados — verificado por um script de checagem versionado no repositório.
- Dependências: T1
- Execução: paralelizável com T2
- Toca documentação: sim — README ganha as variáveis de ambiente do Supabase e o passo de aplicar migrações.
- Status: **bloqueada** em 2026-09-02, branch `feat/T3-supabase-schema` no worktree isolado (4 commits). Os artefatos estão prontos e verificados; falta credencial para cumprir o critério no projeto hospedado.
- O que está pronto e verificado pelo orquestrador: seis migrações (quatro tabelas conforme o SDD coluna a coluna, RLS sem policy, três buckets) e `supabase/scripts/verify-isolation.mjs`. Rodei o script eu mesmo contra um stack Supabase local: **8 checagens, exit 0**. Confirmei também que `.temp/` e `.branches/` não foram commitados e que o projeto hospedado segue intacto (as quatro tabelas dão 404, nenhum bucket).
- **Motivo do bloqueio:** `SUPABASE_SECRET_KEY` fala com PostgREST e Storage, mas **não executa DDL**. Aplicar migrações no projeto hospedado exige a senha do banco (para `supabase link` + `db push`) ou um `SUPABASE_ACCESS_TOKEN` — nenhum dos dois foi fornecido. A verificação foi feita contra um stack local (Postgres 17.6 + PostgREST 16.1 + Storage 1.70), que exercita a mesma maquinaria mas **não é o projeto de destino**.
- **Diferença conhecida entre os ambientes:** o projeto hospedado recusa a chave publicável já no portão da Data API; o stack local a aceita no portão, e ali a negação vem do GRANT revogado. O script reporta qual barreira negou, em vez de tratar qualquer 401 como aprovação. Consequência: no hospedado a RLS fica impossível de exercitar por HTTP, e está provada apenas pela verificação local.
- **DESBLOQUEADA e concluída** em 2026-09-02, após o usuário fornecer a senha do banco. O orquestrador aplicou as migrações no projeto hospedado e verificou o resultado:
  - `supabase db push` aplicou as **seis migrações** sem erro.
  - As quatro tabelas passaram de `404` para `200` com a chave secreta.
  - `verify-isolation.mjs` rodado contra o **projeto hospedado**: **8 checagens, exit 0**. O portão da Data API aparece como `REFORCADO`, e o script declara honestamente que as tabelas "não chegaram a ser consultadas" — a RLS continua provada apenas pela verificação local, como já registrado.
  - Esquema da tabela `leads` conferido coluna a coluna: as 16 colunas do SDD, incluindo `conhece_virbac`, `usa_produto_virbac` e `qual_produto_virbac` (os três campos hoje descartados em produção, risco R-01) e `rdstation_status`.
- Aprendizado operacional documentado no README: o host direto `db.<ref>.supabase.co` é **somente IPv6** e é recusado em rede sem rota IPv6; a conexão precisa ser pelo pooler em IPv4, **porta 5432** (modo sessão, suporta DDL — a 6543 é modo transação e não serve), com usuário `postgres.<ref>`. Região deste projeto: `sa-east-1`.
- **A senha do banco não foi guardada no repositório nem em `apps/api/.env`**, por menor privilégio: a API nunca executa DDL. Ela ficou apenas no diretório temporário da sessão, com permissão `600`.

### T4 — Esqueleto da API NestJS
- Descrição: criar `apps/api` com NestJS 11, configuração tipada de ambiente, pipe global de validação, tratamento de erro no formato único do SDD, endpoint de saúde e a divisão em módulos por domínio ainda vazios.
- Rastreável a: SDD § "Visão de layers dentro da API" e § "Contratos de dados/API/interfaces"
- Critério de "pronto": `npm run build -w apps/api` passa; `npm run test -w apps/api` passa; com a API rodando, `curl -s localhost:3000/api/health` responde `200`; um erro de validação forçado responde no formato `{ statusCode, error, fields }`.
- Dependências: T1
- Execução: **sequencial após T2** — ambas instalam dependências npm e escrevem em `package-lock.json` (ver correção ao final do plano).
- Toca documentação: sim — README ganha como rodar a API localmente e sua porta.
- Status: **concluída** em 2026-09-02, branch `feat/T4-api-skeleton` (3 commits, sem merge). Verificado pelo orquestrador rodando os comandos diretamente: typecheck limpo nos 3 workspaces, **161 testes** (27 API + 5 LP + 129 content-schema), build da raiz em 3.02s. Runtime conferido com a API no ar: `/api/health` → 200; rota inexistente → `{"statusCode":404,"error":"Recurso não encontrado."}`; `/health` sem prefixo → 404; `/api/docs` → 200; e busca por credencial, stack ou caminho interno nas respostas de erro não retornou nada.
- Decisão registrada: Swagger em `/api/docs`, **desligado quando `NODE_ENV=production`** — justificado pelos dois consumidores construídos em tarefas separadas (LP na T14, painel nas T11–T13), onde divergência de contrato é o defeito mais provável. Em produção seria catálogo público de `/api/admin/*` sem valor para o visitante.
- Desvio de camada declarado e aceito: `shared/presentation/validation.pipe.ts` importa `FieldValidationError` de `shared/domain/`, pulando a aplicação. Traduzir erro de domínio para HTTP exige que a apresentação conheça o erro; é o que permitirá à T6 lançar o mesmo erro a partir da validação do `content-schema` sem que a aplicação conheça HTTP.
- Achado de segurança sem relação com a tarefa, verificado pelo orquestrador: `npm audit` acusa 7 vulnerabilidades (1 crítica, 2 altas). **Todas em ferramenta de desenvolvimento** (vitest, vite, esbuild, postcss, nanoid), nenhuma originada em `apps/api`, nenhuma em dependência de produção. Corrigir exige subir o Vite para 8, mudança quebrante na LP — decisão do usuário, registrada e não executada.
- Pendências deixadas para tarefas seguintes: CORS validado mas não ligado (T5 ou T16); `RDSTATION_*` opcional até a T8; mensagens do `class-validator` em inglês por padrão, a T6 precisa de teste de guarda para forçar português.

### T5 — Autenticação e guarda global
- Descrição: implementar a verificação do token do Supabase Auth por JWKS, com guarda global do NestJS que nega por padrão e decorador explícito para liberar endpoints públicos.
- Rastreável a: SDD § D-03 e § C-01
- Critério de "pronto": `npm run test -w apps/api` passa, incluindo testes que verificam `401` sem token, `401` com token inválido ou expirado, `200` com token válido, e que **um endpoint novo criado sem marcação nasce protegido**; a chave secreta do Supabase não aparece em nenhuma resposta nem log.
- Dependências: T4, T3
- Execução: sequencial em relação a T6, T7 e T8 (todas registram no módulo raiz da API)
- Toca documentação: sim — README explica como criar operadores no painel do Supabase.
- Status: **concluída** em 2026-09-02, branch `feat/T5-auth-guard` (6 commits, sem merge em `main`). Verificado pelo orquestrador: 67 testes na API, typecheck limpo, build ok. Confirmei também, por conta própria: **0 usuários** no projeto Supabase (o usuário de teste foi de fato removido), nenhuma chave real em arquivo versionado (as ocorrências de `sb_secret_` são fictícias, de teste), e a guarda registrada por `APP_GUARD` — global de verdade.
- O ponto mais importante foi provado por **mutação, não por leitura**: trocando `APP_GUARD` por um provider comum, 12 de 16 testes falharam, incluindo "nasce protegido". O controller-sonda vive dentro do arquivo de teste e nenhum arquivo de `src/` sabe que ele existe — é a situação real de quem criar endpoint na T6–T8 e esquecer de pensar em autenticação.
- Decisões declaradas: `jose@5` em vez de `@6` (a 6 é somente ESM e a API compila para CommonJS, quebrando o Jest e exigindo Node ≥20.19 acima do `engines` declarado); apenas algoritmos assimétricos aceitos, com teste contra confusão de algoritmo (`HS256` usando a chave pública como segredo); JWKS indisponível responde 401, não 503 — negar por padrão, com o efeito colateral de que indisponibilidade do Supabase desloga o painel; `/api/docs` não passa pela guarda por ser montado fora do roteador do Nest, coberto por teste com comentário explícito.
- Dependência ajustada durante a execução: o plano listava T3 como pré-requisito, mas a T5 não usa nenhuma tabela — só o JWKS, já validado. Executada sem esperar o desbloqueio da T3.

### Integração intermediária — merge de T3 na linha de trabalho (2026-09-02)

A T3 foi executada em worktree isolado, então suas migrações não estavam disponíveis para a T6. Mesclei `feat/T3-supabase-schema` em `feat/T5-auth-guard` (merge local entre branches de feature, **nunca** em `main`). Único conflito: `README.md`, em três blocos, resolvido mantendo os dois lados — seção da API (T4/T5) e seção de banco (T3), com o `[PENDENTE]` corrigido para dizer que o bloqueio real é *aplicar* as migrações no projeto hospedado, não escrevê-las. Após o merge: 201 testes passando, zero erros de tipo.

### T6 — Módulo de conteúdo e metadados
- Descrição: implementar repositórios, casos de uso e endpoints de seções e metadados: `GET /api/content`, `GET /api/seo`, `GET/PUT /api/admin/sections`, `PATCH .../visibility`, `GET/PUT /api/admin/metadata`. Validação contra o pacote de esquemas em toda escrita.
- Rastreável a: SDD § "Contratos de dados/API/interfaces", § D-01, § C-03, C-04, C-05, C-08, C-09, C-10
- Critério de "pronto": `npm run test -w apps/api` passa, incluindo: escrita com documento inválido recusada com `422` e erros por campo; seção despublicada ausente de `GET /api/content`; item de lista despublicado ausente; ordem dos itens preservada; e um teste que confirma que `GET /api/content` executa **uma única consulta** ao banco (risco R-05).
- Dependências: T5, T2, T3
- Execução: sequencial (módulo raiz da API)
- Toca documentação: sim — README lista os endpoints.
- Status: **implementada** em 2026-09-02, branch `feat/T6-content-module` (a partir de `feat/T5-auth-guard`, sem merge). Aguardando verificação do orquestrador. `npm run test -w apps/api`: **125 testes**, 16 suítes. `npm run typecheck` e `npm run build` da raiz: limpos. Suíte inteira do monorepo: 125 (API) + 129 (content-schema) + 5 (LP).
- Os dois pontos que a tarefa exigia foram provados **por mutação**, não por leitura: (a) trocando a leitura agregada por uma consulta por seção, o teste do risco R-05 falhou com 13 chamadas em vez de 2; (b) apontando o `@ts-expect-error` para uma chamada válida, o `ts-jest` derrubou a suíte com `TS2578`, confirmando que o compilador é quem impede gravação sem validação.
- A contagem do R-05 é feita no nível do **cliente Supabase**, não no da porta de repositório: o dublê entra no lugar do cliente e os repositórios de verdade são exercitados, então um adaptador que passasse a iterar seria pego. `GET /api/content` faz **duas** chamadas — uma varredura de `content_sections` e uma leitura de `site_metadata`, tabelas distintas sem relação entre si — e o número não cresce com a quantidade de seções.
- Verificação manual contra o Supabase hospedado, com a API real: `GET /api/content` e `GET /api/seo` responderam `200`; documento inválido → `422` com `faq.heading`/`faq.items`; chave `promocao` → `404` sem tocar no banco; `PUT` válido gravou e publicou; `GET /api/content` devolveu os itens na ordem do painel com o item oculto ausente; `PATCH visibility` removeu e devolveu a seção; `PUT/GET /api/admin/metadata` e `GET /api/seo` preservaram a acentuação. O operador de verificação e as duas linhas gravadas foram apagados: as quatro tabelas terminaram vazias e o projeto com **0 usuários**, como a T9 espera encontrar.
- Decisão de empacotamento: `packages/content-schema` ganhou um build CommonJS (`dist/`) porque a API compila para CommonJS e o pacote era TypeScript puro. `exports` mantém `src/` para Vite e Vitest; `main`/`types` apontam para o build. `apps/api` reconstrói o pacote em `prebuild`/`pretypecheck`/`pretest`, então não há ordem manual a lembrar. `"type": "module"` foi removido do pacote — nada nele executa `.js` cru, e os 129 testes do Vitest continuam passando.
- **Lacuna declarada, não resolvida:** `site_metadata` não tem coluna para `ogImageAlt`. O SDD § "Modelo de dados" não a previu e a T3 seguiu o SDD, mas o esquema da T2 gera o campo (todo campo de imagem carrega seu texto alternativo). Hoje o campo é validado e **não persiste**. Corrigir exige uma migração, e migração exige a senha do banco, que não estava disponível para a T6 — decisão do orquestrador. Está fixado por um teste marcado `LACUNA` que falha no dia em que a coluna existir.
- **ACEITA pelo orquestrador** em 2026-09-02, após correção de um defeito que os testes não pegavam. Verificação própria: `npm run typecheck` (0 erros), `npm run test` (**280 testes**: 146 API + 5 LP + 129 content-schema), `npm run build` ok, árvore limpa, 9 commits coesos.
- **Defeito encontrado pelo orquestrador na verificação manual, ausente da suíte:** `GET /api/content` devolvia referências de mídia como **UUID cru** (`hero.image = "75f5dfa0-…"`), que a LP não tem como renderizar. Havia incoerência interna: `/api/seo` já resolvia a URL (`ogImageUrl`), o conteúdo das seções não. Do jeito que estava, a T14 quebraria e os critérios C-06, C-07 e C-10 do SDD não seriam atendidos. A suíte estava verde porque testava o que o código fazia, não o que a LP precisa receber.
- Correção verificada pelo orquestrador contra o Supabase hospedado, com a API real: público `GET /api/content` → `image = "https://exemplo.invalid/verif-t6.jpg"`, sem UUID; admin `GET /api/admin/sections/hero` → continua devolvendo o **identificador**, sem URL. A regra ficou: na saída pública, campo de mídia é URL ou não existe; na administrativa é sempre o identificador, que é o que o painel edita. Mídia apagada → campo **omitido**, resto do documento intacto. Banco devolvido a zero registros e zero usuários após cada verificação.
- O limite de consultas de `GET /api/content` passou de 2 para **3** (uma por tabela: seções, metadados, mídias) e não cresce com a quantidade de seções ou itens. Provado por mutação: um adaptador que resolvesse mídia uma a uma fez **62 chamadas contra 8**. O teste R-05 antigo não pegaria isso — mas a razão que registrei aqui antes estava **errada**, e a correção fica: eu havia escrito "porque os documentos de exemplo repetiam o mesmo identificador", repassando a explicação do subagente sem conferir. Medi depois: `apps/api/test/documento-de-exemplo.ts` tem **1 referência de mídia, 1 identificador**, e `packages/content-schema/tests/fixtures.ts` tem **10 identificadores, todos distintos**. Não havia repetição; havia **ausência de variedade** — com uma única referência de mídia é impossível observar crescimento no número de consultas. O teste novo usa vários ids distintos. Ver `agent_context/CHANGELOG.md`, entrada sobre repassar afirmação de subagente sem verificar.
- Desvios de camada declarados: (a) `shared/presentation/error-response.factory.ts` passou a conhecer também `ResourceNotFoundError`, mesma exceção já aceita na T4 para `FieldValidationError` — é o que mantém `404` fora dos controllers; (b) `content/application` injeta a porta de metadados, exportada pelo `MetadataModule`, porque `GET /api/content` entrega conteúdo e metadados na mesma resposta por contrato do SDD.

### T7 — Módulo de mídia
- Descrição: implementar emissão de credencial temporária de upload, registro da mídia após confirmação, consulta e remoção com recusa quando referenciada. Suportar imagem, vídeo e legenda.
- Rastreável a: SDD § D-05, § "Modelo de dados", § C-06, C-07
- Critério de "pronto": `npm run test -w apps/api` passa, incluindo: emissão de credencial exige autenticação; tipo de arquivo não suportado recusado; remoção de mídia referenciada por uma seção responde `409`; registro só é criado após confirmação. Verificação manual registrada: um arquivo de vídeo de porte equivalente aos que já existem em `public/videos/` é enviado com sucesso sem que os bytes passem pela API.
- Dependências: T5, T3
- Execução: sequencial (módulo raiz da API)
- Toca documentação: sim — README descreve o fluxo de upload em três passos e o bucket usado.
- Status: **implementada** em 2026-09-02, branch `feat/T7-media-module` (a partir de `feat/T6-content-module`, sem merge). Aguardando verificação do orquestrador. `npm run test -w apps/api`: **193 testes**, 23 suítes; suíte inteira do monorepo: 193 (API) + 129 (content-schema) + 5 (LP). `npm run typecheck` e `npm run build` da raiz: limpos. `node supabase/scripts/verify-isolation.mjs` contra o projeto hospedado, depois da migração nova: **8 checagens, exit 0**.
- **Lacuna do `ogImageAlt` fechada.** A senha do banco foi fornecida; a migração `20260902130000_add_og_image_alt_to_site_metadata.sql` foi aplicada ao projeto hospedado pelo pooler (porta 5432, usuário `postgres.<ref>`), o repositório passou a mapear a coluna nos dois sentidos e o teste marcado `LACUNA` deu lugar a um que prova a ida e a volta do campo, inclusive a coluna gravada. Verificado também de ponta a ponta contra o Supabase real: `PUT`/`GET /api/admin/metadata` preservam o texto, a coluna `og_image_alt` o guarda, e `GET /api/content` o entrega ao lado da URL pública da imagem. A senha não entrou no repositório nem em `apps/api/.env`.
- **Achado da verificação manual, que a T12 precisa saber:** o projeto Supabase tem um **teto global de upload de 50 MB** que prevalece sobre os 500 MB declarados no bucket de vídeo — acima disso o armazenamento responde `413 Maximum size exceeded` antes de aceitar qualquer byte. Os vídeos que a LP usa hoje (23,6 MB e 4,2 MB) passam; um vídeo maior exige elevar o teto em *Project Settings → Storage* (o plano Free trava em 50 MB). O código segue os limites que as migrações declaram, como a tarefa pedia; o teto está documentado no README.
- Verificação manual contra o Supabase hospedado, com a API real na porta 3100 (a 3000 do usuário não foi tocada): **29 checagens, todas OK**. Inclui o upload de verdade do vídeo `TutorabrindoPetiscoEcachorroComendo.mp4` (**23,6 MB**) pelo caminho retomável (TUS em `/storage/v1/upload/resumable/sign`, token no cabeçalho `x-signature`, 4 blocos de 6 MB, 3,1 s), direto do cliente ao armazenamento — a API só viu nome, tipo e tamanho. Um segundo arquivo de **45 MB** subiu em 8 blocos pelo mesmo caminho. Banco e armazenamento devolvidos a zero: quatro tabelas vazias, três buckets vazios, **0 usuários**.
- Decisão de estrutura declarada: o provider do repositório de seções saiu de `ContentModule` para um `SectionRepositoryModule` próprio. A mídia precisa ler as seções para recusar a remoção de mídia em uso, e `ContentModule` já importa `MediaModule` para resolver URLs — importarem-se mutuamente exigiria `forwardRef`, que esconde o ciclo em vez de desfazê-lo. Nenhum módulo lê a tabela do outro: a leitura é sempre pela porta.
- Desvio de camada declarado, no mesmo espírito dos já aceitos na T4 e na T6: `RegisterMediaDto` (apresentação) importa a lista de naturezas de mídia do domínio, em vez de repeti-la — duplicar a lista seria pior do que o desvio.

### T8 — Módulo de leads
- Descrição: implementar `POST /api/leads` (validação, honeypot, gravação, repasse ao RD Station), a listagem administrativa com filtro por período, a exportação em CSV e a exclusão. Migrar a lógica de `serverless/rdstation-lead/handler.ts` para um adaptador de infraestrutura, **incluindo os três campos hoje descartados**.
- Rastreável a: SDD § D-07, § R-01, § R-08, § C-11, C-12
- Critério de "pronto": `npm run test -w apps/api` passa, incluindo: lead gravado com os três campos antes ausentes; RD Station recusando ainda grava o lead, responde sucesso ao visitante e marca `rdstation_status` como falha; honeypot preenchido não grava nem repassa e responde sucesso; validação de nome, e-mail e consentimento reproduz a do handler atual; listagem e exportação exigem autenticação; CSV abre com acentuação correta.
- Dependências: T5, T3
- Execução: sequencial (módulo raiz da API)
- Toca documentação: sim — README ganha as variáveis do RD Station e nota de que a função serverless foi aposentada.
- Status: **concluída e ACEITA** em 2026-09-02, branch `feat/T8-leads-module` (4 commits, sem merge). Verificação do orquestrador: `npm run typecheck` (0 erros), `npm run test` (**420 testes**: 286 API + 5 LP + 129 content-schema), `npm run build` ok.
- Verificado por mim contra o Supabase real, com a API na 3000: `POST /api/leads` respondeu `200 {"success":true}` e o banco guardou **`conhece_virbac`, `usa_produto_virbac` e `qual_produto_virbac`** — os três campos do risco R-01 que hoje se perdem em produção — com acentuação intacta (`Ana Conceição`, `São Paulo, SP`) e `rdstation_status = nao_enviado`, com a razão registrada em `rdstation_error`. Honeypot preenchido respondeu `200` **sem gravar** (a tabela continuou com 1 lead). `GET /api/admin/leads` sem token respondeu `401`. Banco devolvido a zero.
- Prova por mutação, feita pelo subagente e considerada sólida: o teste decisivo não checa a ordem das chamadas ao banco (isso sobrevivia à mutação) — ele instala um observador na porta do RD Station e **conta as linhas gravadas no instante do repasse**, exigindo `[1]`. Inverter a ordem derruba 2 testes; remover as três colunas do R-01 derruba 2; mover o honeypot para depois da validação derruba 1; remover o BOM ou trocar `;` derruba 3; marcar o controller admin como público derruba 7.
- **Ressalva, atualizada em 2026-09-03:** quando esta nota foi escrita, o defeito dos três campos seguia ativo porque a LP ainda chamava `serverless/rdstation-lead/`. A T14 religou a LP à API e a T26 removeu o relay e o diretório `serverless/` inteiro. **O estado atual precisa ser reverificado pelo orquestrador ao aceitar a T26** — não afirmar sem medir, porque a árvore estava sendo alterada por um subagente no momento em que esta atualização foi escrita.
- Decisões do subagente declaradas e aceitas: defesa contra injeção de fórmula no CSV (célula iniciada por `=`, `+`, `-`, `@` recebe apóstrofo) — além do escopo literal, mas correta, já que o conteúdo vem de desconhecido e o arquivo abre na máquina do time; `pageSize` máx. 200 e exportação limitada a 10.000 linhas, por o CSV ser montado em memória; `RDSTATION_*` seguem opcionais, porque exigi-las impediria a API de subir e sem API não se grava lead nenhum.
- **Pendência aberta, precisa de decisão do produto:** o filtro `from`/`to` usa dias em **UTC**, e o operador está em UTC−3 — um lead enviado depois das 21h de Brasília cai no dia seguinte para o filtro. O SDD não fixou o fuso do produto. Documentado no README e comentado no código.

### T9 — Migração do conteúdo atual para o CMS
- Descrição: script versionado que lê os 12 arquivos `*.content.ts` e os assets de `src/assets` e `public/videos`, envia as mídias ao armazenamento e grava os documentos de seção e os metadados no banco, preservando a ordem dos itens e traduzindo os controles atuais (`isReadyForProduction`, `isContentReady`, blocos comentados) em visibilidade.
- Rastreável a: SDD § "Linguagem ubíqua" (Visibilidade), § C-04, C-08
- Critério de "pronto": após rodar o script, `GET /api/content` devolve conteúdo equivalente ao dos arquivos atuais — verificado por um teste de comparação campo a campo entre o conteúdo servido e os `*.content.ts`; a pergunta do FAQ com espaço reservado e a seção de Ingredientes chegam como não publicadas; o script é idempotente (rodar duas vezes não duplica mídia nem itens).
- Dependências: T6, T7
- Execução: sequencial
- Toca documentação: sim — README descreve o comando de migração inicial.
- Status: **implementada** em 2026-09-03, branch `feat/T9-content-migration`. Aguardando verificação do orquestrador. `npm run test` da raiz: **384 testes** na API (32 suítes) + 5 LP + 129 content-schema; `npm run typecheck` e `npm run build` limpos.
- A oitava migração (`20260903120000_allow_svg_in_images_bucket.sql`) foi aplicada ao projeto hospedado pelo pooler, e `verify-isolation.mjs` deu **8 checagens, exit 0**, com o bucket de imagens em `tipos=6`. O logo entrou como SVG de 8.764 bytes, servido publicamente com `content-type: image/svg+xml` — a conversão para PNG que o orquestrador barrou foi desfeita.
- **A carga inicial permanece no banco**, contra o projeto hospedado: 17 mídias (15 imagens + 2 vídeos, incluindo o de 23,6 MB), 12 seções, 1 registro de metadados, 40 itens de lista, `ingredientes` não publicada. Rodada uma **segunda vez**, nenhuma dessas contagens se moveu e `GET /api/content` devolveu resposta com o mesmo hash. O operador criado para a verificação foi apagado (**0 usuários**).
- Decisão sobre os blocos comentados, com motivos opostos: a pergunta comentada do FAQ **entra** não publicada (é conteúdo pronto retirado da página por comentário — exatamente o controle que a visibilidade substitui); o parceiro comentado de `OndeComprar.content.ts` **não entra** (é uma versão anterior de "Tudo de Bicho", que já está publicado com o logo negativo e o link real — migrá-lo criaria parceiro repetido, e seu `link: "#"` é espaço reservado).
- **Lacuna declarada, não resolvida:** três infográficos SVG (`ProductDifferentials.tsx`), o `Kit-de-imagens.png`, o `grupo-bandeiras.png`, o mosaico do formulário e o pôster do banner de vídeo continuam no bundle. Nenhum deles está em `*.content.ts`, e a T2 escopou os esquemas nesses arquivos — não há campo no esquema para preencher. Levá-los ao CMS é acrescentar campos ao esquema (e, nos infográficos, também o copy que hoje vive no componente): é decisão do usuário, não trabalho de migração. Registrado no README, em "Pendências herdadas".
- **Item extra entregue junto:** o filtro `from`/`to` dos leads passou a recortar o dia em horário de Brasília (UTC−3), fechando a pendência aberta na T8. A data no CSV exportado continua em UTC — é escopo da T18.

### T10 — Painel: base, login e proteção de rota
- Descrição: criar `apps/admin` como aplicação Vite servida sob `/admin`, com login por e-mail e senha no Supabase Auth, sessão persistente, logout e guarda que impede renderizar qualquer tela sem sessão válida.
- Rastreável a: SDD § D-04, § C-01, C-02
- Critério de "pronto": `npm run build -w apps/admin` e `npm run test -w apps/admin` passam; teste confirma que acessar uma rota interna sem sessão redireciona ao login sem renderizar conteúdo administrativo; sessão sobrevive a recarregar a página; logout invalida o acesso; credenciais inválidas não revelam se o e-mail existe.
- Dependências: T1, T5
- Execução: sequencial em relação a T11–T13 (mesmo app)
- Toca documentação: sim — README explica como acessar o painel e rodá-lo localmente.
- Status: pendente

### T11 — Painel: formulário gerado a partir do esquema
- Descrição: renderizar, a partir do pacote de esquemas, o formulário de cada seção — campos simples, textos longos, listas com adicionar, remover e reordenar, e o controle de visibilidade de seção e de item. Incluir confirmação visível de sucesso e de erro ao salvar.
- Rastreável a: SDD § D-02, § C-03, C-04, C-05, C-08
- Critério de "pronto": `npm run test -w apps/admin` passa, incluindo: as 12 seções aparecem na ordem da página; um campo novo adicionado ao esquema aparece no formulário sem nenhuma alteração no código do painel; reordenar itens persiste a ordem; erro de validação da API é exibido no campo correspondente; salvar com sucesso mostra confirmação.
- Dependências: T10, T6
- Execução: sequencial (mesmo app que T10)
- Toca documentação: não — comportamento coberto pela documentação de esquema da T2.
- Status: **concluída e ACEITA** em 2026-09-03, branch `feat/T11-formulario-esquema` (5 commits, sem merge). Verificação do orquestrador: typecheck 0 erros, **645 testes** (99 painel + 396 API + 145 content-schema + 5 LP), build limpo, árvore limpa.
- **A decisão D-02 foi provada pelo orquestrador, com mutação própria**, não pelo relato do subagente. Acrescentei um campo ao esquema do FAQ (7 linhas, **um único arquivo, nenhuma linha do painel**) e escrevi um teste que abre o editor da seção e procura o rótulo novo: **passa**. Revertido o esquema, o mesmo teste **falha** com "Unable to find a label". O formulário vem mesmo do esquema.
- Confirmei também que o painel não cita nome de seção nem de campo: buscas por `headline`, `subheadline`, `ctaPrimaryLabel`, `prova_autoridade`, `captura_lead` e `mosaico` em arquivos de produção do painel retornam apenas **dois comentários** explicando o formato de erro da API — nenhum acoplamento.
- **Fragilidade encontrada na minha mutação, registrada para quem editar esquema no futuro:** dois testes do painel têm suposição **posicional** — leem `faq.fields[0]` e comparam com um elemento fixo da tela. Acrescentar um campo no início do array quebra os dois sem que haja defeito algum no formulário. Não é bloqueante e não pedi correção agora, mas é ruído previsível a cada campo novo; vale ancorar esses testes ao campo por nome em vez de por posição.
- Decisão do subagente aceita: `sideEffects: false` em `packages/content-schema/package.json`. Sem isso o módulo de validação era tratado como efeito colateral e arrastava o **zod inteiro** para o pacote do navegador — o build do painel caiu de 514 KB para **425 KB**. Não afeta a API, que lê o build CommonJS.
- Decisões de produto declaradas e aceitas: reordenação por botões Subir/Descer em vez de arrastar-e-soltar (funciona com teclado e é testável; arrastar exigiria dependência nova); ao editar uma lista, os erros daquela lista somem, porque vêm endereçados por posição e mover um item faria a posição apontar para outro conteúdo — errar de campo é pior do que não mostrar; campo opcional em branco é omitido do documento, obrigatório em branco é enviado para a recusa vir da API e aparecer no campo certo.
- Campos de mídia renderizam somente leitura com o identificador já guardado e a nota de que o envio chega na T12. O valor volta intacto na gravação, provado por teste. O operador **não** pode digitar identificador à mão, que é o que o SDD proíbe.

### T12 — Painel: campos de mídia
- Descrição: implementar os campos de imagem, vídeo e legenda com envio direto ao armazenamento, prévia do arquivo, progresso visível e upload retomável em blocos para vídeos grandes. Texto alternativo obrigatório ao lado de cada imagem.
- Rastreável a: SDD § D-05, § C-06, C-07
- Critério de "pronto": `npm run test -w apps/admin` passa; verificação manual registrada de que um vídeo de porte equivalente aos existentes é enviado com progresso visível e passa a ser reproduzido na LP; salvar imagem sem texto alternativo é recusado no próprio painel.
- Dependências: T11, T7
- Execução: sequencial (mesmo app)
- Toca documentação: não — fluxo já documentado na T7.
- Status: **concluída e ACEITA** em 2026-09-03, branch `feat/T12-campos-de-midia` (6 commits, sem merge). Verificação do orquestrador: typecheck 0 erros, **690 testes** (144 painel + 396 API + 145 content-schema + 5 LP), build limpo, árvore limpa, os três caminhos da entrada única respondendo.
- Verifiquei pessoalmente o ponto de maior risco — o subagente alterou conteúdo real da página durante a verificação e restaurou: `media_assets` de volta a **24**, `hero.image` apontando para `virbac-kv-hero.png`, `hero.headline` **idêntica** ao texto do `Hero.content.ts` original, os 2 vídeos nos arquivos originais, e só o operador do usuário no projeto.
- **Prova de que os bytes não passam pela API, medida no navegador:** durante o envio de imagem, o maior corpo enviado a `:5173/api` foi **135 B**, contra `PUT 240.041 B` direto ao armazenamento; no vídeo, **137 B** contra o arquivo inteiro pelo caminho retomável. O subagente notou que `requestBodySize` do Playwright volta `0` em requisições entre origens e mediria "0 bytes pela API" sem provar nada — mediu pelo CDP. Envio em blocos confirmado com o vídeo de 23,6 MB: `POST 6.291.456` + três `PATCH` somando exatamente 24.741.168 B.
- **Terceiro defeito do projeto encontrado só em navegador real, com a suíte inteira verde.** A primeira versão do campo marcava "já pedi esta mídia" antes de a resposta chegar; sob `StrictMode` o efeito monta duas vezes, a segunda via a marca e não pedia de novo, e a resposta da primeira era descartada — prévia presa em "Carregando…". **jsdom não monta em `StrictMode`.** Corrigido e provado por mutação. Junta-se ao `fetch` sem contexto global da T10 e ao UUID cru da T6: o padrão está consolidado e justifica a exigência de verificação em navegador em toda tarefa de painel.
- Desvio declarado e aceito: a T11 decidiu "campo obrigatório vazio vai para a API recusar", mas o texto alternativo de imagem informativa é recusado **no próprio painel**, porque o critério da T12 pedia isso. Está isolado num módulo puro e comentado.
- Limitação declarada e aceita: "retomável" é o que o protocolo entrega — bloco aceito fica aceito e queda de conexão recomeça do último deslocamento —, mas **não há retomada entre recarregamentos da página**, porque credencial e caminho são emitidos a cada tentativa. Documentado no README sem prometer o que não faz.
- Duplicação declarada: o catálogo de tipos e limites existe na API e agora também no painel, inerente ao requisito de recusar antes de qualquer chamada. Mitigada por um teste do painel que **lê as migrações** e falha se as duas listas divergirem.
- O subagente corrigiu, por iniciativa própria, a fragilidade posicional que eu havia sinalizado na T11: o teste que lia `hero.fields[5]` passou a achar o campo por nome.
- Peso: o pacote do painel foi de 425 KB para **494 KB** com o cliente de envio retomável. Não afeta a LP.

### T13 — Painel: metadados e leads
- Descrição: tela de edição dos metadados da página e tela de leads com listagem do mais recente ao mais antigo, filtro por período, exportação em CSV e exclusão com confirmação.
- Rastreável a: SDD § C-09, C-12
- Critério de "pronto": `npm run test -w apps/admin` passa, incluindo: listagem ordenada do mais recente ao mais antigo; filtro por período recorta o conjunto; exportação dispara com os filtros aplicados; exclusão pede confirmação e remove o registro; nenhuma das duas telas é alcançável sem sessão.
- Dependências: T10, T6, T8
- Execução: sequencial (mesmo app)
- Toca documentação: sim — README registra o procedimento de exclusão de lead a pedido do titular (exigência de LGPD do PRD).
- Status: **concluída e ACEITA** em 2026-09-03, branch `feat/T13-metadados-e-leads` (7 commits, sem merge). Verificação do orquestrador: typecheck 0 erros, **741 testes** (193 painel + 398 API + 145 content-schema + 5 LP), build limpo. **O painel está completo.**
- **RN-01 verificada por mim, baixando o arquivo:** primeiros bytes `ef bb bf` (BOM UTF-8), cabeçalho com **13 separadores `;` e 0 vírgulas** (14 colunas), **0 ocorrências de "LGPD"**, e `Ana Conceição` com acentuação intacta. Banco devolvido a 0 leads e só o operador do usuário.
- Prova por mutação bem escolhida — o subagente testou o **engano realista**, não o absurdo: declarar as duas telas novas **fora** da guarda derruba 7 testes. `App.test.tsx` passou a percorrer todas as rotas internas com o observador de mutação do DOM da T10, então a área administrativa não pode chegar ao DOM nem por um quadro. Outras mutações: tela que confia na ordem da API (4 caem), excluir sem confirmação (4), exportar com o filtro digitado em vez do aplicado (1), coluna LGPD de volta no CSV (2).
- **Alteração na API autorizada retroativamente:** o subagente tocou `leads-csv.ts` para remover a coluna "Aceite LGPD" do arquivo exportado. Foi necessário — sem isso o CSV baixado teria a coluna e o critério que eu mesmo dei falharia. A **persistência** da coluna continua intacta; a T18 mantém seu escopo integral.
- **Divergência conhecida, deixada de propósito para a T18:** a tela mostra a data em horário de Brasília, o CSV ainda traz `Data de envio (UTC)` — o mesmo lead aparece como 2/9 na tela e 3/9 na planilha. O subagente documentou em vez de corrigir em silêncio, e está certo: o critério da T18 já exige "a data de envio no CSV sai em horário de Brasília".
- Correção de defeito real feita de passagem, herdado das T10/T11: um `200` com corpo ilegível derrubava `listSections` com `Cannot read properties of null`.
- Achado menor não corrigido: `/favicon.ico` dá 404 no console do painel — o `index.html` dele não declara ícone. Pré-existente desde a T10.

### T14 — LP consumindo a API, com instantâneo de reserva
- Descrição: substituir a leitura dos `*.content.ts` pelo consumo de `GET /api/content` nas 12 seções, **incluindo os três componentes que hoje importam imagem direto**: `ProvaAutoridade.tsx` (Kit de imagens), `LeadFormMosaic.tsx` (as 6 fotos, agora uma lista) e `VideoHeroBanner.tsx` (que passa a usar a miniatura do primeiro vídeo em vez do arquivo estático). `grupo-bandeiras.png` e os três infográficos SVG **continuam importados no código, de propósito** — ver "Decisões registradas de escopo", e embutir no build um instantâneo do conteúdo publicado usado quando a busca falha. Remover os arquivos de conteúdo após a substituição.
- Rastreável a: SDD § D-08, § C-10
- Critério de "pronto": `npm run typecheck` e `npm run build` passam; `grep -r "content" apps/lp/src --include="*.content.ts"` não retorna nenhum arquivo; teste confirma que, com a API indisponível, a LP renderiza o instantâneo em vez de tela vazia; comparação visual da página contra o estado atual não acusa diferença perceptível.
- Dependências: T9
- Execução: sequencial
- Toca documentação: sim — README explica o instantâneo e quando ele é regenerado.
- Status: pendente

### T15 — Injetor de SEO na borda
- Descrição: implementar a função de borda que intercepta a requisição do documento, busca os metadados em `GET /api/seo` com cache curto, injeta no HTML e devolve; em erro ou expiração do tempo limite, devolve o HTML estático intacto. Implementação da plataforma isolada em um único arquivo.
- Rastreável a: SDD § D-06, § "Contrato do injetor de SEO", § C-09
- Critério de "pronto": após alterar o título no painel, `curl -s <url>` (sem executar JavaScript) traz o novo título; com a API derrubada, o mesmo `curl` devolve `200` com os metadados padrão do HTML estático, nunca erro; teste automatizado cobre os dois caminhos.
- Dependências: T6
- Execução: paralelizável com T14 — arquivos distintos, nenhum arquivo compartilhado.
- Toca documentação: sim — README descreve o injetor e como trocar de plataforma.
- Status: pendente

### T16 — Publicação
- Descrição: publicar o produto num ambiente real, servindo o **mesmo mapa de caminhos** que o desenvolvimento já usa desde a T20 e que a T21 empacota: `/` a LP, `/admin` o painel, `/api/*` a API — tudo em um domínio.
- **Reescrita em 2026-09-03.** A versão original desta tarefa dizia "rotas, variáveis e aposentadoria do relay antigo" e pressupunha encaixar o CMS na hospedagem existente. Duas coisas a tornaram obsoleta: (a) o usuário informou que **a hospedagem atual é apenas de teste e será descontinuada**, então não há o que encaixar; (b) a aposentadoria do relay saiu do escopo dela — a T26 removeu o RD Station inteiro, incluindo o diretório `serverless/`.
- Rastreável a: SDD § D-04, § D-06, § "Visão de tiers"; `agent_context/CHANGELOG.md`, entrada de 2026-09-03 sobre entrada única.
- **Pré-requisito de decisão do usuário, ainda em aberto:** onde publicar. A escolha nunca foi feita neste projeto — o repositório nunca teve configuração de deploy, e o README da função serverless declarava a plataforma como indefinida desde antes do CMS. A T21 (Docker + proxy reverso) reduz muito o custo dessa escolha, porque entrega o produto empacotado e independente de provedor; **levar a decisão ao usuário faz parte desta tarefa**, com as opções e os trade-offs, não presumi-la.
- Critério de "pronto": no ambiente publicado, `/` serve a LP com o CSS aplicado (conferir o **conteúdo**, não só o código HTTP), `/admin` e `/admin/` exigem login, `/api/health` responde `200`, e `/admin` **sem barra final** funciona — o defeito que a T10 encontrou; um envio real do formulário grava o lead e ele aparece na tela e na exportação; os metadados chegam no HTML inicial, verificável sem executar JavaScript; nenhuma credencial de servidor aparece nos artefatos de navegador.
- Dependências: T21, T15, T17 não — T17 é a revisão final e vem depois.
- Execução: sequencial
- Toca documentação: sim — README ganha a seção de publicação, o procedimento e as variáveis por ambiente.
- Status: pendente

### T17 — Revisão final: documentação e vazamento de credenciais
- Descrição: revisar o `README.md` de ponta a ponta contra o que foi de fato implementado (comandos, variáveis, endpoints, ambientes) e verificar que nenhuma credencial de banco ou armazenamento entrou nos artefatos de build da LP ou do painel.
- Rastreável a: SDD § R-09; PRD § "Critérios de release — Portabilidade & Manutenção"
- Critério de "pronto": `npm run build` passa e uma busca por segredos nos diretórios `dist` da LP e do painel não retorna ocorrência da chave secreta do Supabase nem do token do RD Station; todo comando e variável citados no README foram executados ou conferidos, não apenas escritos.
- Dependências: T16
- Execução: sequencial
- Toca documentação: sim — é a própria revisão final do README.
- Status: pendente

### T18 — Remover a persistência do aceite LGPD e fixar a regra da exportação
- Descrição: remover a coluna `aceite_lgpd` da tabela `leads` e todo o caminho que a persiste (migração, repositório, DTO, view, gerador de CSV, testes). A **validação que exige o consentimento permanece** — sem ele o envio continua sendo recusado com `422`; o que deixa de existir é a gravação do resultado. Ajustar a exportação para atender a regra de negócio **RN-01** do SDD.
- Rastreável a: SDD § "Modelo de dados" (nota sobre a ausência da coluna), § RN-01, § C-12; `agent_context/CHANGELOG.md`, entrada de 2026-09-02 sobre o erro de modelagem do orquestrador.
- Critério de "pronto": `npm run test` e `npm run typecheck` passam a partir da raiz; a migração aplica no projeto hospedado e `node supabase/scripts/verify-isolation.mjs` continua com exit 0; `POST /api/leads` **sem** o consentimento continua respondendo `422` (teste de regressão obrigatório — é a garantia de que a remoção não afrouxou a regra); o CSV exportado não tem coluna de aceite LGPD e tem uma coluna por campo do formulário, conforme RN-01; a data de envio no CSV sai em horário de Brasília.
- Dependências: T8, T9 (a T9 já altera o módulo de leads para corrigir o fuso — executar T18 antes causaria conflito no mesmo módulo).
- Execução: sequencial — mesmo módulo que a T9.
- Toca documentação: sim — README, na descrição das colunas do CSV exportado.
- Status: **concluída e ACEITA** em 2026-09-03, branch `feat/T18-remove-aceite-lgpd` (4 commits, sem merge). Verificação do orquestrador: typecheck 0 erros, **751 testes** (193 painel + 408 API + 145 content-schema + 5 LP), build limpo.
- Verificado por mim contra o projeto hospedado: a coluna **não existe mais** (`42703 column leads.aceite_lgpd does not exist`), `verify-isolation.mjs` segue com **exit 0**, e a regra continua de pé — envio sem consentimento responde `422` com `{"aceite_lgpd":"Consentimento LGPD é obrigatório."}`, com `false` responde `422`, com consentimento responde `200` e grava. Banco devolvido a 0 leads e só o operador do usuário.
- **Fuso do CSV corrigido, verificado por mim:** cabeçalho agora é `"Data de envio (Brasília)"` e a linha traz `03/09/2026 19:34:38` para um registro gravado às `22:34:38` UTC — deslocamento exato de 3 horas. A causa raiz era boa: só o filtro conhecia o fuso, e a exportação tinha a própria formatação em UTC. Agora os dois leem de um módulo único de horário de Brasília.
- **Recusa fundamentada de uma instrução minha, e ela estava certa** (registrada no CHANGELOG): pedi remover o campo "do DTO", e o subagente manteve `SubmitLeadDto`. O pipe global roda com `forbidNonWhitelisted`, então campo ausente do DTO é recusado antes do domínio — removê-lo faria o envio **com** consentimento ser rejeitado. Provado por mutação: 17 dos 22 testes de `POST /api/leads` caem. O campo saiu do registro persistido e da view de saída, e permaneceu na entrada da requisição, que é onde precisa estar.

### T19 — Levar ao esquema as imagens que hoje vivem nos componentes
- Descrição: acrescentar ao esquema e à carga inicial os ativos que a decisão do usuário de 2026-09-03 tornou gerenciáveis, e retirar do código o pôster do banner de vídeo.
  1. `prova_autoridade`: campo de imagem para o **Kit de imagens**, com texto alternativo obrigatório ao lado (invariante do esquema).
  2. `captura_lead`: **lista** `mosaico`, cada item com imagem e texto alternativo, reordenável — mesma mecânica das demais listas. O layout pressupõe 6 fotos; documentar isso como orientação ao operador, sem travar a quantidade.
  3. `demonstracao`: **nenhum campo novo.** O pôster do banner passa a derivar da miniatura do **primeiro vídeo** da seção. O arquivo `video-banner-poster.jpg` sai do repositório.
  4. Estender o script de migração da T9 para enviar `Kit-de-imagens.png` e as 6 fotos do mosaico, preenchendo os campos novos.
- Rastreável a: `agent_context/CHANGELOG.md`, entrada de 2026-09-03; SDD § "Contrato do esquema de seção" (invariante de texto alternativo), § C-06.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam a partir da raiz; o teste de invariante do esquema continua exigindo texto alternativo para todo campo de imagem, **agora cobrindo os campos novos**; rodar a migração de novo permanece **idempotente**, provado por contagem antes/depois (hoje: 17 mídias, 12 seções); `GET /api/content` devolve o Kit de imagens e as 6 fotos do mosaico como **URL pública**, não identificador.
- Dependências: T9
- Execução: sequencial — altera `packages/content-schema` e o script de migração, os mesmos artefatos que T2 e T9 produziram.
- **Ordem:** precisa vir **antes da T11**, porque o painel gera o formulário a partir do esquema; um campo que não existe no esquema não aparece no painel.
- Toca documentação: sim — README, na lista do que é editável, incluindo a nota de que o mosaico foi desenhado para 6 fotos.
- Status: **concluída e ACEITA** em 2026-09-03, branch `feat/T19-ativos-no-esquema` (4 commits, sem merge). Verificação do orquestrador: typecheck 0 erros, **580 testes** (396 API + 145 content-schema + 34 painel + 5 LP), build limpo, árvore limpa.
- Verificado por mim contra o Supabase real, pela entrada única: `media_assets` passou de 17 para **24**; `prova_autoridade.kit` vem como URL pública com o texto alternativo que já existia no componente, e a URL responde `200 image/png 2.043.014 bytes` **sem credencial**; `captura_lead.mosaico` traz 6 itens com as chaves `[image, ordem, visivel]` — **nenhum campo de descrição**, que é o tratamento correto de imagem decorativa. Só o operador do usuário existe no projeto.
- **Correção da invariante de acessibilidade** (erro de especificação do orquestrador, ver CHANGELOG): todo campo de imagem passa a declarar `imageRole: 'informativa' | 'decorativa'`, sem valor padrão — ausência é violação. Provado por **duas mutações**: remover o papel do construtor informativo derruba 12 testes nomeando cada campo afetado nas 12 seções mais os metadados; remover do construtor decorativo derruba 4. As 6 descrições que o subagente anterior havia escrito foram descartadas, inclusive a que afirmava "petisco em formato de Z" sem sustentação na imagem.
- **Recusa fundamentada de um critério meu, e ela estava certa:** eu pedi que as 6 fotos viessem "marcadas como decorativas" em `GET /api/content`. O subagente não o fez e explicou: a API não serve esquema, e a única forma de marcá-las no corpo seria emitir `imageAlt: ""` — exatamente o campo em branco que o SDD proíbe. A marcação vive no esquema, que é o que painel e LP leem. Ele preferiu relatar a inventar um campo no payload. Critério meu mal formulado, não falha de entrega.
- **Correção sobre a prova de idempotência da T9:** eu havia reportado ao usuário que o hash idêntico de `GET /api/content` provava idempotência. Medi agora: em 5 leituras seguidas o hash é estável (`3b352359da517a87`) e a ordem das seções não varia. Mas a consulta de seções **não tem `ORDER BY`**, então a ordem não é garantida — reescrever linhas pode alterá-la sem que o conteúdo mude. Hash de corpo é, portanto, **prova fraca** de idempotência; a prova válida é a comparação campo a campo com as chaves normalizadas, que confirmei ser idêntica. A T9 deu certo por coincidência de ordenação.
- Não executado nesta tarefa, por ser escopo declarado da T14: o pôster do banner derivando da miniatura do primeiro vídeo e a remoção de `video-banner-poster.jpg` — apagar o arquivo agora quebraria o build, porque `Demonstracao` ainda o importa.

### Decisões registradas de escopo — o que NÃO entra no CMS
Registrado aqui para não ser "corrigido" no futuro como se fosse esquecimento (decisão do usuário em 2026-09-03, detalhada no CHANGELOG):
- **Faixa de bandeiras do Hero** (`grupo-bandeiras.png`) permanece em código.
- **Os três infográficos da Prova de Autoridade** (`01_formato_em_z.svg`, `02_halito_causas_digestivas.svg`, `03_origem_100_vegetal.svg`) permanecem em código, junto com o texto que os acompanha, hoje escrito dentro de `ProductDifferentials.tsx`. São claims de produto e seguem sob controle de quem edita o código.

### T20 — Entrada única em desenvolvimento
- Descrição: fazer o ambiente de desenvolvimento expor **um único endereço**, espelhando o modelo de produção do SDD: `/` serve a LP, `/admin` serve o painel, `/api/*` alcança a API. Os três processos continuam existindo por trás, mas quem usa não lida mais com portas separadas. A recarga automática da LP e do painel precisa continuar funcionando através do proxy.
- Rastreável a: SDD § "Visão de tiers" e § D-04; `agent_context/CHANGELOG.md`, entrada de 2026-09-03 sobre entrada única.
- Critério de "pronto": a partir de **um só endereço**, `/` devolve a LP com o CSS aplicado (verificar o conteúdo servido, não só o código HTTP), `/admin` **e** `/admin/` devolvem o painel, `/api/health` responde `200`, e uma edição em arquivo da LP e outra em arquivo do painel chegam ao navegador sem reinício manual. `npm run test`, `npm run typecheck` e `npm run build` continuam passando a partir da raiz.
- Dependências: T10
- Execução: sequencial
- Toca documentação: sim — README passa a documentar **um** endereço de desenvolvimento; as portas individuais viram detalhe interno.
- Status: **concluída e ACEITA.** A nota de aceitação não havia sido escrita; corrigido nesta retomada, após verificar tudo de novo. `apps/lp/vite.config.ts` implementa o proxy da entrada única (`/admin` → 5174 com `ws: true` para o HMR do painel, `/api` → 3000), com comentário citando a própria T20. Verificado pelo orquestrador, com os três processos já em pé: `http://localhost:5173/` devolve a LP (`<title>Veggiedent — Rotina de cuidado bucal para cachorros | Virbac</title>`); `http://localhost:5173/admin/` devolve o painel (`<title>Painel — Veggiedent</title>`) e `/admin` sem barra redireciona para `/admin/` com `200` ao seguir — o defeito que a T10 havia encontrado não voltou; `http://localhost:5173/api/health` responde `200 {"status":"ok"}`.

### T21 — Orquestração com Docker e proxy reverso
- Descrição: subir as três aplicações com um comando, atrás de um proxy reverso que expõe **uma porta única** com o mesmo mapa de caminhos de produção (`/`, `/admin`, `/api/*`). Serve para desenvolvimento e como ambiente de homologação, e é o que a T16 usa como base para publicar em vez de desenhar o roteamento do zero. Alvo declarado pelo usuário em 2026-09-03.
- Rastreável a: SDD § "Visão de tiers", § D-04, § D-06; `agent_context/CHANGELOG.md`, entrada de 2026-09-03.
- Critério de "pronto": um comando sobe tudo; a mesma bateria de verificação da T20 passa contra a porta única do proxy, incluindo `/admin` sem barra final; as credenciais continuam fora da imagem e fora do repositório, entrando por variáveis de ambiente; a chave secreta do Supabase **não** aparece em nenhum artefato de navegador; `verify-isolation.mjs` continua com exit 0.
- Dependências: T13 (o painel precisa estar completo para valer a pena empacotar), T20
- Execução: sequencial — **imediatamente antes da T16**.
- Toca documentação: sim — README ganha a seção de como subir tudo e como configurar o ambiente.
- Status: pendente

### T22 — Campo de texto rico (Lexical)
- Descrição: acrescentar ao esquema um tipo de campo **texto rico**, que guarda HTML, e implementá-lo no painel com **Lexical** (MIT). O operador cria quebra de linha e marca trechos em **negrito**; o negrito é o que a LP renderiza como destaque visual. Aplicar ao título da Prova de Autoridade, restaurando a quebra forçada no desktop e o destaque em turquesa extra-bold que a T14 perdeu.
- Rastreável a: `agent_context/CHANGELOG.md`, entrada de 2026-09-03 sobre as decisões do usuário; SDD § "Contrato do esquema de seção"; critério C-04.
- **Requisito de segurança inegociável:** HTML vindo do banco e renderizado na página pública precisa ser **sanitizado**. Só as marcações que fazem sentido para título passam (negrito, itálico, quebra de linha); qualquer outra é removida. Sem isso, um operador com acesso comprometido injeta script na LP. Cobrir com teste que tenta injetar `<script>` e um manipulador de evento em atributo, e prova que nada disso chega à página.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam a partir da raiz; teste de sanitização com tentativa real de injeção; o título da Prova de Autoridade volta a exibir quebra e destaque, **verificado em navegador real**, comparando com o estado anterior à T14; o operador consegue editar esse título pelo painel e ver o resultado na página.
- Dependências: T14
- Execução: sequencial — altera esquema, painel e LP.
- Toca documentação: sim — README, no que o operador vê nesse tipo de campo e no que é permitido no HTML.
- Status: **concluída e ACEITA** em 2026-09-03, branch `feat/T22-texto-rico` (6 commits, sem merge). Verificação do orquestrador: typecheck 0 erros, **662 testes** (313 API + 198 painel + 34 LP + 117 content-schema), build limpo.
- **Injeção real testada por mim, pela API, com 5 vetores** — `<script>`, `<img onerror>`, `<a href="javascript:">`, `<iframe>` e `<strong onclick>`. O que foi gravado e servido publicamente: `"Titulolink"`. Nenhum `script`, `onerror`, `javascript:`, `iframe` ou `onclick` sobreviveu. O heading original foi restaurado e conferido, e o banco terminou com 12 seções, 24 mídias e só o operador do usuário.
- **O subagente foi além do que pedi, e para melhor:** não há `dangerouslySetInnerHTML` em lugar nenhum — a LP **reconstrói elementos React** percorrendo o DOM já sanitizado, e o renderizador só sabe emitir `strong`, `em`, `br` e texto. São duas barreiras independentes: mesmo que a sanitização falhasse, não existe caminho para uma tag ou atributo virar nó. Provado por três experimentos: removendo só a sanitização, 11 testes passam; removendo só o renderizador seguro, 11 passam; **removendo as duas, 5 falham** com `<a>`, `<iframe>`, `<svg>` e `<img>` reais no DOM.
- Sanitização nas duas pontas, com justificativa aceita: na **escrita** (antes de validar, para que um título feito só de `<script>` seja recusado como "Campo obrigatório" em vez de gravado em branco, e para manter banco e instantâneo limpos) e na **leitura** (a barreira que protege o visitante de qualquer HTML gravado por outro caminho).
- Honestidade que vale registrar: o subagente declarou que a sanitização na **entrada do editor** não é provada por mutação — removida, o teste segue verde, porque o importador do Lexical já ignora marcação desconhecida. Manteve por explicitude e disse que é redundante, em vez de apresentá-la como barreira.
- Defeito corrigido de passagem, que existia no JSX original: com a quebra escondida no celular, "dos" e "médicos-veterinários," ficavam colados. A seção passou a desenhar um espaço só-mobile.
- Peso: painel de 494 KB para **853 KB** com o Lexical. O subagente declarou não ter medido o baseline da LP antes da mudança, em vez de afirmar um delta que não mediu.

### T24 — Mídia do banner: vídeo ou imagem, com pré-carregamento derivado
- Descrição: o banner da seção Demonstração passa a aceitar **vídeo ou imagem**, à escolha do operador. **Não existe campo de imagem de pré-carregamento** — é conceito de quem constrói a página, não de quem escreve conteúdo. Quando a mídia for vídeo, a imagem exibida antes do carregamento vem do **primeiro quadro do próprio arquivo**, derivada automaticamente.
- Rastreável a: `agent_context/CHANGELOG.md`, entrada de 2026-09-03 sobre a interpretação errada do orquestrador; SDD § C-07.
- **Princípio declarado pelo usuário, que vale além deste caso:** não se pede a um operador leigo um dado que ele não tem como entender. Campo que só faz sentido para desenvolvedor não deve existir no painel.
- **Escopo ampliado pelo usuário em 2026-09-03: a regra vale para TODOS os vídeos do CMS, não só o do banner.** A lista `videos` da seção Demonstração tem hoje quatro campos por item — `label`, `video`, `poster`, `captions`. O campo **`poster` (Miniatura do vídeo) deixa de existir**: a imagem de pré-carregamento passa a ser derivada do primeiro quadro do próprio arquivo, em todo lugar onde houver vídeo.
  - `label` (Título do vídeo) **permanece** — o operador entende e usa.
  - `captions` (Arquivo de legendas) **permanece** — é acessibilidade real, compreensível, e o operador tem o arquivo.
  - As duas miniaturas hoje cadastradas (`tutor-abrindo-petisco.jpg` e `cachorro-ganhando-petisco.jpg`) ficam sem referência. **Não as apague** — relate, e a remoção é decisão à parte.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam; o painel permite escolher entre enviar vídeo ou imagem para o banner, sem pedir pôster; **verificado em navegador real** que, com vídeo cadastrado, algo sensato aparece antes de o vídeo tocar — e que com imagem cadastrada a imagem aparece. O mecanismo de derivação do quadro é escolha do subagente, com justificativa no relatório.
- Dependências: T22
- Execução: sequencial — altera esquema, painel e LP, os mesmos artefatos da T22.
- Toca documentação: sim — README, no que o operador pode enviar para o banner.
- Status: **concluída e ACEITA** em 2026-09-03, branch `feat/T24-midia-de-video` (3 commits, sem merge). Verificação do orquestrador: typecheck 0 erros, **668 testes**, build limpo, **zero ocorrências de `poster` no esquema**, e `GET /api/content` devolvendo `bannerVideo` resolvido com os vídeos tendo apenas `label`, `ordem`, `video`, `visivel` — nenhum pôster. `captions` continua no esquema; não aparece na resposta apenas por estar vazio, já que os arquivos `.vtt` nunca existiram. Banco intacto: 12 seções, 24 mídias, 1 metadados, 0 leads, só o operador do usuário.
- Mecanismo escolhido para o primeiro quadro, com justificativa aceita: **sem processamento** — vídeo sem atributo de pôster, com `preload="metadata"` e o fragmento de mídia `#t=0.001`. A alternativa (capturar o quadro no envio) criaria um ativo novo por vídeo, um caminho de falha no upload e código de canvas, para produzir a imagem que o navegador já sabe extrair. O fragmento é o que transforma "provavelmente aparece" em "o navegador precisa buscar e decodificar esse quadro". **Ressalva declarada:** provado em Chromium; iOS Safari não é testável neste ambiente.
- **Dois defeitos que a suíte verde não pegava, ambos achados no navegador:** (a) a validação recusava salvar imagem decorativa opcional, porque exigia texto alternativo de qualquer imagem preenchida — inclusive das que não têm esse campo no esquema; (b) movimento reduzido não parava o banner, porque o código trocava o elemento de vídeo por imagem e a troca matava a reprodução. **É o quarto e o quinto defeito do projeto invisíveis em teste automatizado.**
- Regra do escoteiro em arquivo já tocado: o player tinha `<source type="video/mp4">` fixo, que descartaria um **WebM** — formato que o esquema aceita desde sempre.
- **As duas miniaturas ficaram órfãs, como previsto, e não foram apagadas:** 24 mídias registradas, 22 referenciadas. `tutor-abrindo-petisco.jpg` e `cachorro-ganhando-petisco.jpg` intactas. Remoção é decisão à parte.
- O subagente apontou que o critério **C-07 do SDD** ficara desatualizado ("Miniatura e legendas de cada vídeo também são enviáveis") e **não o alterou**, por ser documento de processo. Corrigido pelo orquestrador.

### T23 — Recriar a migração de conteúdo a partir do instantâneo
- Descrição: restaurar a capacidade de popular um ambiente novo, que a T14 removeu junto com `apps/api/src/migration/`. O módulo volta lendo `apps/lp/src/content/content-snapshot.json` em vez dos `*.content.ts` apagados — sem duplicar conteúdo, porque o instantâneo já é a cópia versionada do que está publicado.
- Rastreável a: `agent_context/CHANGELOG.md`, entrada de 2026-09-03; SDD § D-08; nota de status da T14.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam; a migração roda contra um CMS vazio e o popula; é **idempotente**, provado por contagem antes/depois da segunda execução; o conteúdo semeado bate campo a campo com o instantâneo.
- Dependências: T22, T24 — precisa semear conteúdo já no formato final do esquema.
- Execução: sequencial
- Toca documentação: sim — README, no procedimento de popular um ambiente novo.
- Status: pendente

### T26 — Remover o RD Station do projeto
- Descrição: a integração foi **descontinuada** (decisão do usuário em 2026-09-03). Sai tudo o que se refere a ela; permanece **apenas a exportação dos leads em CSV**. Alcance medido: **33 arquivos**, as colunas `rdstation_status` e `rdstation_error` da tabela `leads`, duas colunas do CSV ("Status RD Station" e "Erro RD Station"), as variáveis `RDSTATION_API_TOKEN` e `RDSTATION_CONVERSION_IDENTIFIER`, e o diretório `serverless/rdstation-lead/` inteiro.
- Rastreável a: `agent_context/CHANGELOG.md`, entrada de 2026-09-03; PRD § "Premissas, restrições e dependências"; SDD § D-07 (agora histórica), § R-08 (extinto), § C-11.
- **O que NÃO pode ser removido junto:** a validação do envio (nome, e-mail, consentimento, porte), o **honeypot**, a gravação do lead, a listagem, o filtro por período em horário de Brasília, a exclusão por pedido do titular, e a exportação em CSV conforme a RN-01.
- **Consequência que eleva a criticidade:** o banco do CMS passa a ser o **único** lugar onde o lead existe. Não há mais cópia em outro sistema. Qualquer migração que toque `leads` precisa desse cuidado, e a exportação em CSV deixa de ser conveniência para virar o mecanismo de saída do dado.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam a partir da raiz; migração removendo as duas colunas aplicada no projeto hospedado, com `verify-isolation.mjs` em exit 0; `grep -ri "rdstation\|rd station"` em `apps/`, `packages/` e `serverless/` não retorna nada; o CSV mantém as 12 colunas restantes conforme RN-01; **teste de regressão obrigatório** provando que `POST /api/leads` sem consentimento continua respondendo `422` e que o honeypot continua descartando silenciosamente — provados por mutação.
- Dependências: T24
- Execução: sequencial
- Toca documentação: sim — README, em variáveis de ambiente, colunas do CSV e endpoints.
- Status: **concluída e ACEITA** em 2026-09-04, branch `feat/T26-remove-rdstation` (5 commits, sem merge em `main`). A nota de aceitação não havia sido escrita quando a implementação terminou; corrigido agora, na retomada, reverificando tudo do zero em vez de confiar no resumo herdado (a T8 já registrou o risco de dar algo por encaminhado sem medir).
- Verificação do orquestrador, rodada nesta retomada: `npm run test` a partir da raiz — **657 testes** (302 API + 198 painel + 34 LP + 123 content-schema), `npm run typecheck` e `npm run build` limpos. `grep -ril "rdstation\|rd station\|rd_station" apps/ packages/ serverless/` não retornou nada; `serverless/` não existe mais.
- Migração `20260903140000_drop_rdstation_from_leads.sql` aplicada ao projeto hospedado: o esquema PostgREST de `leads` tem hoje **13 colunas**, nenhuma delas `rdstation_status`/`rdstation_error` (nem `aceite_lgpd`, removida na T18). `verify-isolation.mjs` rodado contra o hospedado: **exit 0**, portão da Data API `REFORÇADO`. CSV com **12 colunas**, conforme RN-01.
- Regressão provada contra a API real, não só lida no código: `POST /api/leads` sem `aceite_lgpd` respondeu `422` com `{"aceite_lgpd":"Consentimento LGPD é obrigatório."}`; `POST` com o campo `website` (honeypot) preenchido respondeu `200 {"success":true}` **sem gravar** — `GET` direto à tabela por `SUPABASE_SECRET_KEY` confirmou **0 leads** após as duas tentativas. Banco seguiu vazio.

### T25 — Remover do painel os campos que só fazem sentido para quem constrói a página
- Descrição: quatro grupos de campos violam o princípio declarado pelo usuário e saem do painel (decisão de 2026-09-03, detalhada no CHANGELOG):
  1. **`captura_lead.porteOptions[].value` e `simNaoOptions[].value`** — o "Código da opção" sai; o **rótulo** de cada opção permanece editável, porque é texto visível. O valor passa a viver em código, coerente com a linha do PRD que mantém a **estrutura** do formulário em código e deixa apenas os **textos** no CMS. Editar o valor corrompia a série de dados em silêncio.
  2. **`header.menuButtonAriaLabel`, `header.mainNavAriaLabel`, `captura_lead.successModalCloseAriaLabel`** — rótulos de acessibilidade de controles de interface, não de conteúdo.
  3. **`captura_lead.successModalEmailModeMessage`** — o operador não controla o modo de entrega e não tem como saber quando aquilo aparece. **Ressalva registrada:** diferente dos outros, este é texto visível ao visitante; removê-lo significa que alterá-lo passa a exigir deploy. O usuário decidiu remover mesmo assim.
  4. **`metadata.canonicalUrl`** — SEO técnico; valor errado pode tirar a página do índice.
- Rastreável a: `agent_context/CHANGELOG.md`, entrada de 2026-09-03; PRD § "Fora de escopo" (estrutura do formulário em código).
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam; os campos não aparecem mais no painel; **a página continua idêntica** — os textos removidos do CMS passam a viver em código com o **mesmo valor de hoje**, sem inventar nada; verificado em navegador real.
- Dependências: T26 — a saída do RD Station muda o peso do argumento do item 1, e as duas tarefas tocam o módulo de leads.
- Execução: sequencial
- Toca documentação: sim — README, na lista do que é editável.
- Status: pendente

### T27 — Corrigir o desligar de seção
- Descrição: o usuário relatou que desligar uma seção não funciona, e que ligar funciona. **Investigar as duas pontas antes de corrigir** — não assumir a hipótese abaixo.
- **O que o orquestrador já verificou, para não ser refeito:** a **API está correta** — `PATCH /api/admin/sections/:key/visibility` com `false` responde `200`, a seção some de `GET /api/content` e o banco grava `is_published = false`; com `true` ela volta. O caminho no painel (`SectionEditorScreen` → `admin-api-client` → `editor-state`) foi lido e parece correto.
- **Hipótese principal, sustentada por medição:** o instantâneo embutido na LP tinha **11 seções** enquanto a API devolvia **12**. A LP renderiza o instantâneo primeiro e depois troca pela resposta da API — o que explicaria a assimetria: ligar faz aparecer, desligar não faz sumir, porque a página segue exibindo a cópia antiga. Se for isso, o defeito é de **consumo na LP**, não do painel.
- Rastreável a: SDD § D-08 (instantâneo de reserva), critério C-08, C-10.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam; **teste que prova que desligar uma seção a remove da página**, e que ligar a traz de volta, cobrindo o caminho instantâneo → API; **verificação em navegador real**, desligando e religando uma seção pela interface e conferindo a página. Prove por mutação que o teste novo falha se a correção for desfeita.
- **Segundo item da tarefa — o risco R-01, que continua vivo:** `apps/lp/src/sections/CapturaLead/services/submitLead.ts` monta o payload com nove campos e **omite `conhece_virbac`, `usa_produto_virbac` e `qual_produto_virbac`**, embora o formulário os colete do visitante e a API os aceite e grave. Verificado pelo orquestrador em 2026-09-04. Corrigir, e o critério precisa ser exercido **pelo caminho do visitante** — preencher e enviar o formulário na página, não um `POST` de linha de comando. Ver a entrada do CHANGELOG de 2026-09-04 sobre o erro de processo que deixou isso passar por dez tarefas.
- Dependências: T26
- Execução: sequencial
- Toca documentação: só se a correção mudar como o instantâneo é usado.
- Status: **concluída e ACEITA** em 2026-09-04, branch `feat/T27-corrigir-desligar-secao` (a partir do HEAD de `feat/T26-remove-rdstation`, 4 commits, sem merge em `main`). Verificação do orquestrador, rodada por conta própria: `npm run typecheck` limpo nos 4 workspaces; `npm run test` — **662 testes** (302 API + 198 painel + 39 LP + 123 content-schema); `npm run build` limpo (avisos pré-existentes do `zod`, sem relação com a mudança).
- **Item 1, lacuna fechada:** o usuário forneceu a credencial real do operador. Um subagente logou de verdade em `/admin` (Playwright, sessão real, não simulada), desligou a visibilidade da seção `faq` pelo checkbox do painel, recarregou a LP do zero e confirmou o heading e a primeira pergunta **ausentes** (contagem 0); religou, recarregou de novo, e os dois **voltaram** (contagem 1, conteúdo correto). Reabriu a tela de edição do zero para confirmar o estado persistido (não cache), e devolveu a seção ao estado inicial. **Não reproduziu o defeito relatado**, na quarta camada verificada (as três anteriores — API, código do painel, LP via interceptação de rede — já não tinham reproduzido). Verificado pelo orquestrador, de forma independente: `git status` limpo (nenhum arquivo do repositório tocado), busca pela senha usada no teste não retornou nenhuma ocorrência em nenhum arquivo do repositório, e `GET /api/content` confirmando `faq` presente e as 11 seções no mesmo conjunto de antes.
- **A tarefa fecha sem correção**, porque não há defeito comprovado em nenhuma das quatro camadas testadas, apenas o teste de regressão novo (`App.test.tsx`, caminho instantâneo → API nas duas direções, provado por mutação) como cobertura permanente. Se o usuário voltar a ver o sintoma, o próximo passo é capturar o cenário exato (qual seção, painel ou LP em qual aba, se a página já estava aberta antes do toggle) — a hipótese de página já aberta sem recarregar continua a mais provável não testada.
- **Item 2 (R-01), verificado pelo orquestrador:** revisei o diff de `submitLead.ts` — os três campos (`conhece_virbac`, `usa_produto_virbac`, `qual_produto_virbac`) foram acrescentados no mesmo padrão dos campos opcionais vizinhos. Banco hospedado consultado diretamente após a verificação do subagente: `leads` com **0 linhas** — o lead de teste enviado pelo caminho do visitante (Playwright, formulário real) foi apagado como prometido.
- **Item 1, reavaliação da hipótese registrada:** antes de delegar, medi de novo e a hipótese original ("instantâneo com 11, API com 12") **não se sustentava mais** no estado atual — hoje os dois têm 11 seções (`ingredientes` já está despublicada desde o incidente de 2026-09-04). Também constatei, lendo `PublishedContentProvider.tsx`, que a troca do instantâneo pela resposta da API é uma **substituição completa do estado** (`setContent(published)`), não uma mesclagem — o que deveria refletir corretamente qualquer seção publicada ou despublicada a cada carregamento novo da página, nas duas direções. Passei essa dúvida ao subagente em vez de mandar confirmar a hipótese antiga.
- **O subagente não conseguiu reproduzir o defeito** em nenhuma camada testável: API (já verificada), painel (leitura do código + suíte existente com clique real de checkbox, 26/26 verdes) e LP em Chromium real (via interceptação de `GET /api/content`, alternando seção presente/ausente, com o resto do fluxo real). Descartou também cache HTTP como causa (o `ETag` da API é hash de conteúdo; muda sempre que o conteúdo muda). Acrescentou dois testes de regressão em `App.test.tsx` cobrindo o caminho instantâneo → API nas duas direções, **provados por mutação** (fazendo `connectSection` ignorar a ausência da seção, os dois testes novos falham com erro de render; revertida a mutação, voltam a passar) — reli o diff eu mesmo e confirmo que os dois testes existem e testam o que dizem testar.
- **Ressalva real e não resolvida, declarada com honestidade pelo subagente:** faltou o clique de verdade no checkbox do painel **autenticado como o operador de verdade**, porque não havia a senha do operador (`rodrigo.oliveira@duo.studio`) disponível, e duas tentativas de emitir uma sessão de teste sem tocar na senha (`generate_link` da Admin API do Supabase, por `curl` e por script) foram bloqueadas pelo classificador de permissões do ambiente. O subagente não tentou contornar isso nem resetar a senha do operador — decisão correta, mesmo tipo de guardrail do caso do SVG (restrição de ambiente não autoriza mexer em ativo real). **Fica pendente uma decisão do usuário**, ver abaixo. Enquanto essa lacuna não fechar, o item 1 não pode ser considerado 100% verificado pelo padrão desta tarefa (verificação em navegador real, ponta a ponta) — só parcialmente, com evidência forte de que o código está correto nas três camadas.
- **Achado à parte, relatado e não corrigido:** não existe campo honeypot (`website`) em lugar nenhum de `apps/lp/src/sections/CapturaLead/` — nem no formulário, nem no payload. A defesa anti-bot que a API já implementa nunca pode ser acionada por um envio real do visitante. Fora do escopo declarado da T27; decisão de acrescentar fica para o usuário.

### T28 — Remover a seção Ingredientes e tirar o Header do CMS
- Descrição: duas remoções decididas pelo usuário em 2026-09-04 (detalhadas no CHANGELOG).
  1. **A seção `ingredientes` sai do projeto inteiro** — esquema, componente, montagem da página, instantâneo e o registro no banco. Ela nunca teve conteúdo além do título: o material técnico da Virbac que a destravaria nunca chegou.
  2. **O `header` sai do CMS**, mas **permanece na página**. Todos os seus dados voltam a ser fixos em código, com **exatamente os textos de hoje** — links de navegação, rótulos de botão e textos de acessibilidade. Não inventar nem "melhorar" texto nenhum: copiar os valores atuais do banco.
- Rastreável a: `agent_context/CHANGELOG.md`, entrada de 2026-09-04; PRD § Features.
- Consequência: o conjunto de seções editáveis cai de 12 para **10**. Onde houver contagem ou lista fixa de 12 (esquema, testes, painel, documentação), atualizar.
- **Achado de produto a resolver junto:** o painel permitiu publicar uma seção vazia sem nenhum aviso, e a página exibiu um bloco com só um título. Avaliar se cabe um aviso ao operador ao publicar seção sem conteúdo além do título — **proponha, não implemente por conta própria**, e relate.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam; `grep -ri "ingredientes"` em `apps/` e `packages/` não retorna nada de produção; o painel lista **10** seções; o cabeçalho da página continua **visualmente idêntico**, verificado em navegador real contra o estado atual; o instantâneo é regenerado e o registro de `ingredientes` sai do banco.
- Dependências: T27
- Execução: sequencial
- Toca documentação: sim — README e a lista de seções editáveis.
- Status: **concluída** em 2026-09-04, branch `feat/T28-remover-ingredientes-header` (a partir do HEAD de `feat/T27-corrigir-desligar-secao`), sem merge em `main`.
- **Remoção 1 (Ingredientes):** apagados `packages/content-schema/src/sections/ingredientes.ts`, `apps/lp/src/sections/Ingredientes/` e todo `IngredientesDocument`/`ingredientesSchema` do pacote. `SECTION_KEYS` caiu de 12 para 10 chaves. `App.tsx` não monta mais o componente.
- **Remoção 2 (Header):** `packages/content-schema/src/sections/header.ts` apagado; `apps/lp/src/components/layout/Header/Header.tsx` reescrito sem `connectSection`, com logo, `logoAlt`, os 5 `navLinks`, os dois rótulos de CTA e os dois `aria-label` **copiados literalmente** do `GET /api/content` real, lido antes de qualquer mudança de código (evidência: resposta bruta da API capturada no início da tarefa). `MobileMenu.tsx` trocou o tipo `SectionContent<'header'>['navLinks']` por um tipo local `NavLink`.
- **Banco hospedado:** migração `supabase/migrations/20260904150000_remove_header_and_ingredientes_sections.sql` aplicada via `npx supabase db push --db-url ...` (pooler, porta 5432). Antes: 12 linhas em `content_sections` (`header` publicada, `ingredientes` despublicada, confirmado por `GET .../rest/v1/content_sections`). Depois: **10 linhas**, sem `header` nem `ingredientes`; tentativa de reinserir `key: 'header'` via REST recusada pelo Postgres com `23514` (violação do `check` estreitado) — a restrição foi provada, não só lida.
- **Instantâneo:** `npm run instantaneo` regravou `content-snapshot.json` com **10 seções publicadas**, lidas da API real já sem `header`/`ingredientes` (diff: só remoção do bloco `header`, nada mais mudou).
- **Verificação automatizada:** `npm run test` a partir da raiz — **654 testes** (115 content-schema + 39 LP + 198 admin + 302 API), todos verdes; `npm run typecheck` e `npm run build` limpos nos 4 workspaces. `grep -ri "ingredientes" apps/ packages/` só retorna falsos positivos (a palavra "ingredientes" dentro do texto real de uma resposta do FAQ, "...livre de conservantes ou ingredientes transgênicos") e comentário de teste explicando a remoção — nada em `src/` de produção.
- **Verificação em navegador real** (Chromium via Playwright, headless, contra a entrada única `:5173`, com o dev server derrubado e resubido do zero por esta tarefa depois de um crash do processo da API — ver abaixo): o cabeçalho renderizado tem exatamente o mesmo `logo`/`logoAlt`, os 5 links (texto e `href`), os dois rótulos de CTA ("Baixar o guia de cuidados diários") e os dois `aria-label` ("Menu principal", "Abrir menu") que a API entregava antes da mudança de código — comparação campo a campo, não visual por amostragem. O menu mobile abre e mostra os 5 links mais o CTA. Nenhum erro novo no console (só o aviso pré-existente e não relacionado de `fetchPriority` em `Hero.tsx`). **Pendência declarada:** a verificação logada do painel (`/admin/secoes` mostrando 10 seções, sem "Cabeçalho" nem "Ingredientes") não foi possível — o navegador da automação não tinha sessão ativa de nenhuma tarefa anterior, caiu em `/admin/login`, e a senha do operador não foi fornecida a esta tarefa; por instrução explícita, não foi tentado login, adivinhação nem reset de senha. Coberto em vez disso por: (a) suíte real do painel (`SectionsScreen.test.tsx`, componente de produção contra `orderedSectionSchemas` real, sem dublê de schema) confirmando 10 itens sem "Cabeçalho"/"Ingredientes"; (b) `GET /api/admin/sections` sem token respondendo `401` (guarda intacta) e `GET /api/content` (público) confirmando as 10 chaves certas.
- **Incidente encontrado e corrigido durante a verificação:** o processo da API (`nest start --watch`, porta 3000) tinha morrido silenciosamente em algum momento das várias reconstruções de `packages/content-schema/dist` feitas durante a tarefa (o wrapper de watch continuava "vivo" no `ps`, mas sem processo filho escutando a porta) — `GET /api/content` respondia `500` e o processo real na porta 3000 recusava conexão. Diagnosticado por `ss -ltnp` (só a 5173 escutando) e `curl` direto à 3000 (`Connection refused`); resolvido derrubando o grupo de processos pelo PGID exato (`kill -TERM -37950`, nunca `pkill -f`) e subindo `npm run dev` de novo do zero. Confirmado depois: as três portas (3000, 5173, 5174) respondendo, `GET /api/content` sem erro, header e conteúdo corretos em nova rodada de verificação no navegador.
- **Achado de produto (não implementado, só proposto):** ver `agent_context/CHANGELOG.md`, entrada de 2026-09-04, e o relatório final da tarefa — aviso ao operador ao publicar seção sem conteúdo além do título.

### T29 — Gestão de operadores dentro do painel

- Descrição: o usuário decidiu reverter o trade-off da D-03 (operadores criados só pelo painel do Supabase) e trazer isso para dentro do CMS. Nova tela no painel: listar operadores, convidar um novo por e-mail (gera link de ativação de uso único, mostrado uma vez, sem envio automático — ver D-09 e o motivo de não usar `inviteUserByEmail`), e remover um operador existente. Endpoints novos: `GET/POST /api/admin/operators`, `DELETE /api/admin/operators/:id`, todos atrás da guarda global já existente.
- Rastreável a: SDD § D-09 (nova), § D-03 (trade-off revisto), § C-13, § R-10; `agent_context/CHANGELOG.md`, entrada de 2026-09-04 sobre a reversão da decisão.
- **Regras inegociáveis, testadas por mutação:** um operador não pode remover a si mesmo; não é possível remover o último operador restante. As duas travariam o acesso ao próprio painel sem ninguém para reabri-lo.
- **A chave secreta do Supabase nunca chega ao navegador.** A tela de operadores fala só com a API do CMS; quem fala com a Admin API do Supabase é a API, no servidor.
- Critério de "pronto": `npm run test`, `npm run typecheck` e `npm run build` passam a partir da raiz; teste de regressão provando (por mutação) que remover a si mesmo e remover o último operador são recusados com `409`; **verificação em navegador real**: convidar um e-mail novo pelo painel, copiar o link mostrado, abri-lo numa aba anônima, definir senha e logar no painel com a conta nova; listar mostra os dois operadores; remover o operador de teste funciona e ele deixa de aparecer na lista; o operador original (`rodrigo.oliveira@duo.studio`) nunca é removido durante o teste.
- Dependências: nenhuma (independente de T28 — não compartilha arquivo; ver nota de execução)
- **Execução: em worktree isolado**, paralelo a T28 (decisão do usuário em 2026-09-04) — ambas tocam o painel, mas T28 mexe em `header`/`ingredientes` e T29 numa tela nova; ainda assim, mantidas em árvores de trabalho separadas para não haver risco de concorrência de arquivo, conforme o guardrail do processo.
- Toca documentação: sim — README ganha a seção de como convidar e remover um operador pelo painel, substituindo a instrução antiga de criar operador direto no Supabase.
- Status: pendente

### T30 — Revisão de usabilidade do painel administrativo (proposta, sem implementação)

- Descrição: o usuário relatou que a interface do painel "está muito ruim" para facilitar o uso, sem detalhar o quê especificamente. Antes de qualquer mudança de UI, um levantamento: navegar o painel em navegador real, tela por tela (login, lista de seções, edição de cada tipo de campo, mídia, metadados, leads, e a nova tela de operadores da T29 se já existir), contra os critérios de usabilidade já aprovados no PRD (§ "Usabilidade": "um operador de marketing sem conhecimento técnico consegue localizar e alterar um texto específico da página sem treinamento além de uma explicação inicial curta"), e listar problemas concretos com evidência (print ou descrição precisa), não impressão geral.
- Rastreável a: PRD § "Usabilidade"; `agent_context/CHANGELOG.md`, entrada de 2026-09-04.
- **Esta tarefa não implementa nada.** Produz uma lista priorizada de problemas encontrados e, para cada um, uma proposta de correção com o esforço estimado (pequeno/médio/grande). O orquestrador leva a lista ao usuário para decidir o que vira tarefa nova no plano.
- Critério de "pronto": documento de achados entregue ao orquestrador, cada item com: onde está (tela/componente), o que é ruim e por quê (referenciando o critério de usabilidade do PRD que ele viola), evidência real (não suposição), e proposta objetiva.
- Dependências: nenhuma
- **Execução: em worktree isolado, com instância própria em portas alternativas** (não 5173/5174/3000, que são as do ambiente principal do usuário) — mesmo não escrevendo código, rodar contra a instância principal arriscaria falso positivo se T28 precisar derrubar e subir serviços durante a auditoria. Sem risco de conflito de arquivo com T28/T29 por não escrever nada no repositório.
- Toca documentação: não — o resultado é uma proposta para o usuário decidir, não um artefato de processo definitivo ainda.
- Status: pendente

## Ordem de execução

```
T1
 ├─→ T2 ─┐
 ├─→ T3 ─┤
 └─→ T4 ─┘
          └─→ T5 ─→ T6 ─→ T7 ─→ T8      (módulos da API, sequenciais entre si)
                     │      │      │
                     └──────┴──────┴─→ T9 ─→ T14 ─┐
                     │                             ├─→ T16 ─→ T17
                     └─→ T15 ────────────────────┤
                                                   │
T5 ─→ T10 ─→ T11 ─→ T12 ─→ T13 ────────────────┘
              (painel, sequenciais entre si)
```

Pares realmente paralelizáveis, por não compartilharem arquivo nem módulo: **T2 ‖ T3** (após T1) e **T14 ‖ T15** (após T6 e T9). Todo o resto é sequencial. Os módulos da API (T6, T7, T8) têm dependência lógica apenas de T5, mas registram no mesmo módulo raiz da aplicação — por isso são executados em sequência, conforme o guardrail de arquivo compartilhado.

**Correção feita durante a execução (2026-09-02):** o plano original marcava **T2 ‖ T3 ‖ T4** como paralelizáveis. T2 e T4 instalam dependências npm e portanto ambas escrevem em `package-lock.json` na raiz — arquivo compartilhado. Pelo guardrail de arquivo compartilhado, **T4 passa a ser sequencial em relação a T2**, mesmo sem dependência lógica entre elas. T3 permanece paralelizável por ser SQL mais um script de verificação sem nenhuma dependência npm nova.

**Tarefa acrescentada em 2026-09-02:** a **T18** entra depois da T9 e antes da T17 (revisão final), por corrigir um erro de modelagem do orquestrador registrado no CHANGELOG. Ela toca o módulo de leads, o mesmo que a T9 altera para o fuso — por isso é sequencial em relação a ela, nunca paralela.
