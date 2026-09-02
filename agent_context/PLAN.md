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
- **Próximo passo:** obter a senha do banco ou um token de acesso do usuário, rodar `supabase db push` no projeto hospedado e reexecutar o script contra ele.

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
- Status: pendente

### T6 — Módulo de conteúdo e metadados
- Descrição: implementar repositórios, casos de uso e endpoints de seções e metadados: `GET /api/content`, `GET /api/seo`, `GET/PUT /api/admin/sections`, `PATCH .../visibility`, `GET/PUT /api/admin/metadata`. Validação contra o pacote de esquemas em toda escrita.
- Rastreável a: SDD § "Contratos de dados/API/interfaces", § D-01, § C-03, C-04, C-05, C-08, C-09, C-10
- Critério de "pronto": `npm run test -w apps/api` passa, incluindo: escrita com documento inválido recusada com `422` e erros por campo; seção despublicada ausente de `GET /api/content`; item de lista despublicado ausente; ordem dos itens preservada; e um teste que confirma que `GET /api/content` executa **uma única consulta** ao banco (risco R-05).
- Dependências: T5, T2, T3
- Execução: sequencial (módulo raiz da API)
- Toca documentação: sim — README lista os endpoints.
- Status: pendente

### T7 — Módulo de mídia
- Descrição: implementar emissão de credencial temporária de upload, registro da mídia após confirmação, consulta e remoção com recusa quando referenciada. Suportar imagem, vídeo e legenda.
- Rastreável a: SDD § D-05, § "Modelo de dados", § C-06, C-07
- Critério de "pronto": `npm run test -w apps/api` passa, incluindo: emissão de credencial exige autenticação; tipo de arquivo não suportado recusado; remoção de mídia referenciada por uma seção responde `409`; registro só é criado após confirmação. Verificação manual registrada: um arquivo de vídeo de porte equivalente aos que já existem em `public/videos/` é enviado com sucesso sem que os bytes passem pela API.
- Dependências: T5, T3
- Execução: sequencial (módulo raiz da API)
- Toca documentação: sim — README descreve o fluxo de upload em três passos e o bucket usado.
- Status: pendente

### T8 — Módulo de leads
- Descrição: implementar `POST /api/leads` (validação, honeypot, gravação, repasse ao RD Station), a listagem administrativa com filtro por período, a exportação em CSV e a exclusão. Migrar a lógica de `serverless/rdstation-lead/handler.ts` para um adaptador de infraestrutura, **incluindo os três campos hoje descartados**.
- Rastreável a: SDD § D-07, § R-01, § R-08, § C-11, C-12
- Critério de "pronto": `npm run test -w apps/api` passa, incluindo: lead gravado com os três campos antes ausentes; RD Station recusando ainda grava o lead, responde sucesso ao visitante e marca `rdstation_status` como falha; honeypot preenchido não grava nem repassa e responde sucesso; validação de nome, e-mail e consentimento reproduz a do handler atual; listagem e exportação exigem autenticação; CSV abre com acentuação correta.
- Dependências: T5, T3
- Execução: sequencial (módulo raiz da API)
- Toca documentação: sim — README ganha as variáveis do RD Station e nota de que a função serverless foi aposentada.
- Status: pendente

### T9 — Migração do conteúdo atual para o CMS
- Descrição: script versionado que lê os 12 arquivos `*.content.ts` e os assets de `src/assets` e `public/videos`, envia as mídias ao armazenamento e grava os documentos de seção e os metadados no banco, preservando a ordem dos itens e traduzindo os controles atuais (`isReadyForProduction`, `isContentReady`, blocos comentados) em visibilidade.
- Rastreável a: SDD § "Linguagem ubíqua" (Visibilidade), § C-04, C-08
- Critério de "pronto": após rodar o script, `GET /api/content` devolve conteúdo equivalente ao dos arquivos atuais — verificado por um teste de comparação campo a campo entre o conteúdo servido e os `*.content.ts`; a pergunta do FAQ com espaço reservado e a seção de Ingredientes chegam como não publicadas; o script é idempotente (rodar duas vezes não duplica mídia nem itens).
- Dependências: T6, T7
- Execução: sequencial
- Toca documentação: sim — README descreve o comando de migração inicial.
- Status: pendente

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
- Status: pendente

### T12 — Painel: campos de mídia
- Descrição: implementar os campos de imagem, vídeo e legenda com envio direto ao armazenamento, prévia do arquivo, progresso visível e upload retomável em blocos para vídeos grandes. Texto alternativo obrigatório ao lado de cada imagem.
- Rastreável a: SDD § D-05, § C-06, C-07
- Critério de "pronto": `npm run test -w apps/admin` passa; verificação manual registrada de que um vídeo de porte equivalente aos existentes é enviado com progresso visível e passa a ser reproduzido na LP; salvar imagem sem texto alternativo é recusado no próprio painel.
- Dependências: T11, T7
- Execução: sequencial (mesmo app)
- Toca documentação: não — fluxo já documentado na T7.
- Status: pendente

### T13 — Painel: metadados e leads
- Descrição: tela de edição dos metadados da página e tela de leads com listagem do mais recente ao mais antigo, filtro por período, exportação em CSV e exclusão com confirmação.
- Rastreável a: SDD § C-09, C-12
- Critério de "pronto": `npm run test -w apps/admin` passa, incluindo: listagem ordenada do mais recente ao mais antigo; filtro por período recorta o conjunto; exportação dispara com os filtros aplicados; exclusão pede confirmação e remove o registro; nenhuma das duas telas é alcançável sem sessão.
- Dependências: T10, T6, T8
- Execução: sequencial (mesmo app)
- Toca documentação: sim — README registra o procedimento de exclusão de lead a pedido do titular (exigência de LGPD do PRD).
- Status: pendente

### T14 — LP consumindo a API, com instantâneo de reserva
- Descrição: substituir a leitura dos `*.content.ts` pelo consumo de `GET /api/content` nas 12 seções, e embutir no build um instantâneo do conteúdo publicado usado quando a busca falha. Remover os arquivos de conteúdo após a substituição.
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

### T16 — Publicação: rotas, variáveis e aposentadoria do relay antigo
- Descrição: configurar o domínio único — LP na raiz, painel em `/admin`, `/api/*` encaminhado à API — declarar as variáveis de ambiente de cada ambiente, e remover `serverless/rdstation-lead/` junto com o serviço `submitLeadToRDStation` que aponta para ele, agora substituídos pela API.
- Rastreável a: SDD § D-04, D-07, § "Dependências externas"
- Critério de "pronto": `npm run build` passa; no ambiente publicado, `/` serve a LP, `/admin` exige login e `/api/health` responde `200`, todos no mesmo domínio; um envio real do formulário grava o lead e chega ao RD Station; `serverless/` não existe mais e nenhuma referência a ele resta no código.
- Dependências: T14, T15, T13
- Execução: sequencial
- Toca documentação: sim — README ganha a seção de publicação e a lista completa de variáveis por ambiente.
- Status: pendente

### T17 — Revisão final: documentação e vazamento de credenciais
- Descrição: revisar o `README.md` de ponta a ponta contra o que foi de fato implementado (comandos, variáveis, endpoints, ambientes) e verificar que nenhuma credencial de banco ou armazenamento entrou nos artefatos de build da LP ou do painel.
- Rastreável a: SDD § R-09; PRD § "Critérios de release — Portabilidade & Manutenção"
- Critério de "pronto": `npm run build` passa e uma busca por segredos nos diretórios `dist` da LP e do painel não retorna ocorrência da chave secreta do Supabase nem do token do RD Station; todo comando e variável citados no README foram executados ou conferidos, não apenas escritos.
- Dependências: T16
- Execução: sequencial
- Toca documentação: sim — é a própria revisão final do README.
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
