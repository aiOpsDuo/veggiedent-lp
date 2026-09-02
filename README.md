# Veggiedent LP + CMS

Landing page do Veggiedent (Virbac) e o CMS que administra todo o seu conteúdo.

> **Estado:** scaffold criado na Fase 3 do processo de orquestração, antes da implementação. As seções marcadas com **[PENDENTE]** só podem ser preenchidas com valores reais durante a execução — não preencha com suposição.

## Objetivo do projeto

Permitir que a equipe de marketing altere qualquer conteúdo da landing page — texto, imagem ou vídeo — por um painel próprio, sem depender de desenvolvedor e sem novo deploy, e acompanhar no mesmo lugar os leads captados pelo formulário da página.

Requisitos de produto completos em [`agent_context/PRD.md`](agent_context/PRD.md).

## Arquitetura e stack

Quatro peças em um domínio único:

| Peça | Papel | Stack |
|---|---|---|
| `apps/lp` | Landing page pública, servida estaticamente por CDN | React 18, Vite 5, TypeScript 5, Tailwind 3 |
| `apps/admin` | Painel de administração, servido em `/admin` atrás de login | React 18, Vite 5, TypeScript 5 |
| `apps/api` | API do CMS: conteúdo, mídia, metadados e leads | NestJS 11, Node 20+ |
| `packages/content-schema` | Esquemas das seções — fonte única de validação, formulário e tipos | TypeScript 5, Zod |

Padrão arquitetural, camadas, modelo de dados, decisões técnicas com trade-offs e os diagramas C4 estão em [`agent_context/SDD.md`](agent_context/SDD.md) — não duplicados aqui.

O repositório é um monorepo de workspaces npm. `agent_context/` e `README.md` ficam na raiz porque cobrem o produto inteiro (SDD § "Estrutura de pastas do repositório"):

```
/
├── apps/
│   ├── lp/                 # landing page (React + Vite + Tailwind)
│   ├── admin/              # painel — esqueleto, preenchido na T10
│   └── api/                # API NestJS — esqueleto, preenchido na T4
├── packages/
│   └── content-schema/     # esquemas de seção — esqueleto, preenchido na T2
├── serverless/             # relay antigo do RD Station, aposentado na T16
├── docs/
├── supabase/               # migrações SQL do banco, buckets e script de verificação
├── agent_context/
└── README.md
```

**Serviços externos:** Supabase (banco Postgres, armazenamento de arquivos e autenticação) e RD Station Marketing (destino de marketing dos leads).

**Ponto de atenção de segurança:** a chave secreta do Supabase e o token do RD Station vivem exclusivamente no ambiente de `apps/api`. Nenhuma credencial pode entrar em um build de navegador — variáveis lidas pelo Vite (`VITE_*`) são públicas por natureza.

## Acesso e execução do código

### Variáveis de ambiente

**`apps/api` (servidor — nunca expostas ao navegador):**

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta do Supabase. Ignora RLS — jamais no cliente |
| `SUPABASE_JWKS_URL` | Endpoint JWKS usado para verificar o token dos operadores |
| `RDSTATION_API_TOKEN` | Token da API de Conversões do RD Station |
| `RDSTATION_CONVERSION_IDENTIFIER` | Identificador da conversão no RD Station |
| `ALLOWED_ORIGINS` | Origens autorizadas a chamar a API, separadas por vírgula |

**`apps/lp` e `apps/admin` (públicas, embarcadas no build):**

| Variável | Descrição |
|---|---|
| `VITE_API_BASE_URL` | Base dos endpoints da API |
| `VITE_SUPABASE_URL` | URL do projeto Supabase (usada só pelo painel, no login) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase (`sb_publishable_…`), usada só pelo painel, só no login. Nunca alcança o banco: as quatro tabelas negam a leitura para ela (ver "Verificar o isolamento") |
| `VITE_EBOOK_URL` | URL de download do e-book. Vazia enquanto a Virbac não entregar |
| `VITE_EBOOK_DELIVERY_MODE` | `download` ou `email` — conteúdo do modal de sucesso |

### Comandos

Todos rodam a partir da raiz e delegam aos workspaces (`npm run <script> --workspaces --if-present`):

```bash
npm install          # instala as dependências de todos os workspaces
npm run dev          # sobe o servidor de desenvolvimento — hoje só a LP (http://localhost:5173)
npm run build        # build de todos os workspaces; gera apps/lp/dist/
npm run typecheck    # checagem de tipos de todos os workspaces
npm run test         # testes de todos os workspaces (Vitest na LP, no painel e em packages/)
npm run preview      # serve o build da LP em http://localhost:4173
```

Para um workspace só, use `-w`: `npm run build -w apps/lp`, `npm run test -w packages/content-schema`.

Requer Node 20 ou superior (verificado com Node 25.6.0 e npm 11.8.0).

`npm run dev` percorre os workspaces em sequência: enquanto só a LP tem servidor de desenvolvimento isso equivale a subir a LP. Quando a API (T4) e o painel (T10) ganharem seu próprio `dev`, o script da raiz precisará de execução em paralelo — hoje ele ainda não tem.

### Como rodar localmente

Confirmado para a LP (T1):

```bash
git clone <repositorio> && cd veggiedent-lp
npm install
cp apps/lp/.env.example apps/lp/.env    # opcional: todas as variáveis têm default
npm run dev                              # LP em http://localhost:5173
```

Para conferir o build de produção da LP: `npm run build && npm run preview` (http://localhost:4173).

**[PENDENTE]** — os passos de API: preencher o `.env` de `apps/api` (T4) e rodar a migração inicial de conteúdo (T9).

### Banco de dados e armazenamento

O esquema do banco vive em `supabase/migrations/`, uma migração por assunto, aplicadas na ordem do nome do arquivo:

| Migração | O que cria |
|---|---|
| `20260902120000_create_media_assets.sql` | Tabela `media_assets` |
| `20260902120100_create_content_sections.sql` | Tabela `content_sections`, com as 12 chaves de seção fechadas |
| `20260902120200_create_site_metadata.sql` | Tabela `site_metadata`, de registro único |
| `20260902120300_create_leads.sql` | Tabela `leads` e o índice da listagem por data |
| `20260902120400_enable_rls_deny_all.sql` | RLS nas quatro tabelas, **sem nenhuma policy** |
| `20260902120500_create_storage_buckets.sql` | Buckets `veggiedent-images`, `veggiedent-videos`, `veggiedent-captions` e a policy de leitura pública |

**Por que não há policy nas tabelas.** Uma tabela com RLS habilitada e zero policies nega tudo para `anon` e `authenticated` — é exatamente o comportamento que o SDD exige: nenhum cliente alcança o banco direto, todo acesso passa pela API com `SUPABASE_SECRET_KEY` (papel `service_role`, que ignora RLS). Acrescentar uma policy para esses dois papéis, por mais restrita que pareça, abre um caminho que contorna a API. No armazenamento a regra é a oposta e está explícita: leitura pública (a LP precisa exibir as mídias), escrita só pela credencial do servidor.

#### Aplicar as migrações

Em um projeto Supabase hospedado, a partir da raiz do repositório:

```bash
npx supabase login                                 # ou exporte SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref <ref-do-projeto>   # uma vez por máquina; pede a senha do banco
npx supabase db push                               # aplica as migrações pendentes
```

Os dois primeiros passos precisam de credenciais que **não** estão em `apps/api/.env`: um token de acesso pessoal e a senha do banco. `SUPABASE_SECRET_KEY` não substitui nenhuma das duas — ela fala com a Data API e com o Storage, não executa DDL.

Contra um Supabase local (exige Docker):

```bash
npx supabase start      # sobe o stack local
npx supabase db reset   # recria o banco e reaplica todas as migrações
```

#### Verificar o isolamento da superfície pública

`supabase/scripts/verify-isolation.mjs` prova, contra um Supabase real, três coisas: que a chave publicável não lê nenhuma das quatro tabelas, que os três buckets existem com leitura pública e escrita fechada, e se o portão da Data API recusa a chave publicável. Não tem dependências além do Node:

```bash
SUPABASE_URL=<url> \
SUPABASE_PUBLISHABLE_KEY=<chave-publicavel> \
SUPABASE_SECRET_KEY=<chave-secreta> \
  node supabase/scripts/verify-isolation.mjs
```

Saída `0` quando tudo que precisava ser provado foi provado, `1` quando algo está alcançável da superfície pública, `2` quando nada está exposto mas alguma checagem ficou sem prova.

A chave secreta é obrigatória por dois motivos: é ela que lista os buckets e é ela que conta as linhas que a chave publicável deveria estar sem enxergar — em uma tabela vazia, uma resposta vazia não prova nada, e o script recusa tratar isso como aprovação. A checagem dos buckets envia um arquivo de sonda com a chave secreta, lê esse arquivo sem credencial nenhuma, tenta escrever com a chave publicável e **apaga a sonda ao final, inclusive em caso de erro** — é a única parte do script que escreve.

O portão da Data API é reportado como camada informativa e não decide o resultado: no projeto hospedado ele recusa a chave publicável (`Only secret API keys can be used for this endpoint`), e essa recusa **reforça, mas não substitui**, a negação por tabela, que é a exigência dura.

#### Estado verificado

Executado contra um stack Supabase local completo (Postgres 17 + PostgREST + Storage), com o banco recriado do zero por `npx supabase db reset`:

```
$ npx supabase db reset
Applying migration 20260902120000_create_media_assets.sql...
Applying migration 20260902120100_create_content_sections.sql...
Applying migration 20260902120200_create_site_metadata.sql...
Applying migration 20260902120300_create_leads.sql...
Applying migration 20260902120400_enable_rls_deny_all.sql...
Applying migration 20260902120500_create_storage_buckets.sql...

$ SUPABASE_URL=http://127.0.0.1:54321 \
  SUPABASE_PUBLISHABLE_KEY=<publicável do stack local> \
  SUPABASE_SECRET_KEY=<secreta do stack local> \
    node supabase/scripts/verify-isolation.mjs
  AUSENTE   Portão da Data API recusa a chave publicável        (stack local aceita; o projeto hospedado recusa)
  OK        Tabela content_sections nega leitura pública        HTTP 401 — permissão negada na tabela (GRANT revogado)
  OK        Tabela site_metadata nega leitura pública           HTTP 401 — permissão negada na tabela (GRANT revogado)
  OK        Tabela media_assets nega leitura pública            HTTP 401 — permissão negada na tabela (GRANT revogado)
  OK        Tabela leads nega leitura pública                   HTTP 401 — permissão negada na tabela (GRANT revogado)
  OK        Bucket veggiedent-images ...                        leitura pública 200; escrita recusada
  OK        Bucket veggiedent-videos ...                        leitura pública 200; escrita recusada
  OK        Bucket veggiedent-captions ...                      leitura pública 200; escrita recusada
OK: tabelas negam a leitura pública e os buckets são públicos só para leitura.   [exit 0]
```

O script foi conferido contra uma falha real, não só contra o caminho feliz: com uma policy permissiva criada de propósito em `leads`, ele acusou `FALHOU ... a chave publicável leu 1 linha(s)` e saiu com `1`; com escrita anônima liberada em `storage.objects`, acusou `a chave publicável conseguiu ESCREVER no bucket`. As duas exposições foram desfeitas e o banco terminou com RLS ligada nas quatro tabelas, **zero policies** no schema `public` e apenas a policy de leitura pública em `storage.objects`.

**[PENDENTE]** — as migrações **ainda não foram aplicadas ao projeto Supabase hospedado**. Aplicá-las exige uma credencial que não está no repositório: a senha do banco (para `npx supabase link` + `npx supabase db push`) ou um token de acesso pessoal (`SUPABASE_ACCESS_TOKEN`). A chave secreta da API **não serve** para isso — ela fala com PostgREST e com o Storage, não executa DDL. Com uma das duas em mãos, rode `npx supabase db push` e em seguida o `verify-isolation.mjs` apontando para a URL hospedada, e registre aqui a saída.

### Como criar um operador do painel

**[PENDENTE]** — confirmado na T5. Previsto: criar o usuário pelo painel do Supabase Auth; o CMS não tem tela de gestão de usuários, por decisão registrada no SDD § D-03.

## Alterações, testes e validações

- **Estratégia de branch:** GitHub Flow. Branch por tarefa (`feat/T{n}-slug`), PR obrigatório para `main`, **revisão obrigatória antes do merge**. Commits em Conventional Commits. Sem `git push --force` em branch compartilhada. Política completa em [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Testes automatizados:** `npm run test` (todos os workspaces) ou `npm run test -w <workspace>`. O runner é o **Vitest** na LP, no painel e em `packages/`; a API usará o runner padrão do NestJS (T4). Os workspaces ainda sem teste passam com `--passWithNoTests`.
- **Verificação de segurança do banco:** `node supabase/scripts/verify-isolation.mjs` (ver "Verificar o isolamento da superfície pública"). Não entra no `npm run test` porque precisa de um Supabase alcançável e de credenciais — é um passo de verificação de ambiente, não um teste unitário.
- **Qualidade de código:** `npm run typecheck` (TypeScript em modo `strict`). O repositório não tem linter configurado — a T1 não introduziu um, e a checagem de tipos mais a revisão de código são hoje as únicas barreiras automáticas.
- **Visualização da API:** **[PENDENTE]** — decidir na T4 se a API expõe Swagger.
- **Ambientes publicados:** **[PENDENTE]** — preencher na T16 com as URLs reais de LP, painel e API.

## Atualização e monitoramento

- **Processo de merge:** PR com revisão aprovada e critério de "pronto" da tarefa verificado (comando de teste/build rodado, não apenas relatado). Ver [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Publicação:** **[PENDENTE]** — documentar na T16 as rotas do domínio único (`/`, `/admin`, `/api/*`) e o procedimento de deploy de cada peça.
- **Logs e monitoramento:** **[PENDENTE]** — definir na T16. A disponibilidade da API precisa ser monitorada: é dela que depende o envio do formulário (risco R-02 do SDD).

## Manutenção

- **Adicionar um campo a uma seção:** **[PENDENTE]** — procedimento documentado na T2. Previsto: editar o esquema da seção em `packages/content-schema`; formulário do painel e validação da API acompanham sem alteração de código.
- **Excluir um lead a pedido do titular (LGPD):** **[PENDENTE]** — procedimento documentado na T13.
- **Limpeza de arquivos órfãos no armazenamento:** **[PENDENTE]** — documentar na T7. Uploads interrompidos podem deixar arquivos sem registro; são inertes, mas ocupam espaço.

## Pendências herdadas do projeto atual

Itens que já eram pendência antes do CMS e continuam abertos:

- **Imagem de compartilhamento social (`og:image`)** ainda não aprovada pela Virbac. Passa a ser editável pelo painel quando chegar.
- **Dados legais da Virbac Brasil** (CNPJ e afins) pendentes no rodapé.
- **Conteúdo da seção Ingredientes** e a **faixa etária recomendada** no FAQ aguardam material técnico da Virbac; migrados como não publicados.
- **Payload do RD Station** marcado no código atual como "confirmar antes do go-live": método de autenticação e nomes dos campos personalizados dependem de como a conta da Virbac foi configurada (risco R-08 do SDD).
