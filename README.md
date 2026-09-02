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
│   └── api/                # API NestJS — módulos por domínio, quatro camadas em cada
├── packages/
│   └── content-schema/     # esquemas de seção — esqueleto, preenchido na T2
├── serverless/             # relay antigo do RD Station, aposentado na T16
├── docs/
├── supabase/               # migrações SQL do banco, buckets e script de verificação
├── agent_context/
└── README.md
```

Dentro de `apps/api`, a pasta é a regra de dependência do SDD § "Camadas e padrão arquitetural" tornada física — cada domínio tem as quatro camadas, e não existe lugar certo para pôr regra de negócio num controller:

```
apps/api/src/
├── main.ts                 # sobe o processo e escuta a porta
├── app.module.ts           # registra os módulos, o pipe e o filtro globais
├── config/                 # ambiente tipado, validado na inicialização
├── shared/
│   ├── domain/             # erros de domínio, sem import de framework
│   └── presentation/       # formato único de erro, pipe, prefixo, Swagger
├── health/                 # sonda de operação (GET /api/health)
└── modules/                # um módulo por domínio (SDD § D-03 e seguintes)
    └── <content|metadata|media|leads|auth>/
        ├── presentation/   # controllers, DTOs, guardas — traduzem HTTP
        ├── application/    # casos de uso — orquestram domínio e portas
        ├── domain/         # regras e portas — não conhecem ninguém
        └── infrastructure/ # adaptadores: Supabase, Storage, RD Station
```

Os cinco módulos de domínio nascem vazios na T4. `auth` foi preenchido na T5; `content` e `metadata`, na T6; `media` e `leads` chegam nas T7 e T8.

**Como a API consome `packages/content-schema`:** o pacote é a fonte única de validação (SDD § D-02), mas a API compila para CommonJS e o pacote é lido como TypeScript pelo Vite. Para servir aos dois, ele passou a ter um build próprio (`npm run build -w packages/content-schema`, saída em `packages/content-schema/dist/`): a API resolve o pacote pelo build CommonJS, e Vite e Vitest continuam lendo `src/`. Os scripts `build`, `typecheck` e `test` de `apps/api` reconstroem o pacote antes de rodar, então não existe passo manual a lembrar nem risco de compilar contra uma versão velha do esquema.

**Serviços externos:** Supabase (banco Postgres, armazenamento de arquivos e autenticação) e RD Station Marketing (destino de marketing dos leads).

**Ponto de atenção de segurança:** a chave secreta do Supabase e o token do RD Station vivem exclusivamente no ambiente de `apps/api`. Nenhuma credencial pode entrar em um build de navegador — variáveis lidas pelo Vite (`VITE_*`) são públicas por natureza.

## Acesso e execução do código

### Variáveis de ambiente

**`apps/api` (servidor — nunca expostas ao navegador):**

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | sim | Chave secreta do Supabase. Ignora RLS — jamais no cliente |
| `SUPABASE_JWKS_URL` | sim | Endpoint JWKS usado para verificar o token dos operadores |
| `ALLOWED_ORIGINS` | sim | Origens autorizadas a chamar a API, separadas por vírgula |
| `RDSTATION_API_TOKEN` | a partir da T8 | Token da API de Conversões do RD Station |
| `RDSTATION_CONVERSION_IDENTIFIER` | a partir da T8 | Identificador da conversão no RD Station |
| `NODE_ENV` | não | `development` (padrão), `test` ou `production` |
| `PORT` | não | Porta HTTP da API. Padrão `3000` |

O modelo está em [`apps/api/.env.example`](apps/api/.env.example); copie para `apps/api/.env` e preencha. A API **valida o ambiente na inicialização**: faltando uma variável obrigatória ela recusa subir e nomeia a variável no log (nunca o valor), em vez de falhar depois em tempo de requisição. As duas do RD Station só passam a ser obrigatórias quando o repasse do lead migrar para a API (T8, SDD § D-07).

**`apps/lp` e `apps/admin` (públicas, embarcadas no build):**

| Variável | Descrição |
|---|---|
| `VITE_API_BASE_URL` | Base dos endpoints da API |
| `VITE_SUPABASE_URL` | URL do projeto Supabase (usada só pelo painel, no login) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase (`sb_publishable_…`), usada só pelo painel, só no login. Nunca alcança o banco, por duas barreiras independentes: neste projeto o Supabase a recusa já no portão da Data API (`Only secret API keys can be used for this endpoint`) e, além disso, as quatro tabelas negam a leitura para ela (ver "Verificar o isolamento da superfície pública") |
| `VITE_EBOOK_URL` | URL de download do e-book. Vazia enquanto a Virbac não entregar |
| `VITE_EBOOK_DELIVERY_MODE` | `download` ou `email` — conteúdo do modal de sucesso |

### Comandos

Todos rodam a partir da raiz e delegam aos workspaces (`npm run <script> --workspaces --if-present`):

```bash
npm install          # instala as dependências de todos os workspaces
npm run dev          # sobe o servidor de desenvolvimento — hoje só a LP (http://localhost:5173)
npm run build        # build de todos os workspaces; gera apps/lp/dist/
npm run typecheck    # checagem de tipos de todos os workspaces
npm run test         # testes de todos os workspaces (Vitest na LP e em packages/, Jest na API)
npm run preview      # serve o build da LP em http://localhost:4173
```

Para um workspace só, use `-w`: `npm run build -w apps/lp`, `npm run test -w packages/content-schema`.

A API tem dois comandos próprios, que não entram no `npm run dev` da raiz:

```bash
npm run start:dev -w apps/api   # API com recarga automática em http://localhost:3000/api
npm run start -w apps/api       # roda o build já gerado (exige npm run build -w apps/api antes)
```

Requer Node 20 ou superior (verificado com Node 25.6.0 e npm 11.8.0).

`npm run dev` percorre os workspaces em sequência, então um servidor que não termina bloquearia os seguintes. Por isso a API expõe `start:dev` e não `dev`: `npm run dev` na raiz continua equivalendo a subir a LP. Quando o painel (T10) chegar, o script da raiz precisará de execução em paralelo para servir os três de uma vez — hoje ele ainda não tem.

### Como rodar localmente

Confirmado para a LP (T1):

```bash
git clone <repositorio> && cd veggiedent-lp
npm install
cp apps/lp/.env.example apps/lp/.env    # opcional: todas as variáveis têm default
npm run dev                              # LP em http://localhost:5173
```

Para conferir o build de produção da LP: `npm run build && npm run preview` (http://localhost:4173).

Confirmado para a API (T4):

```bash
cp apps/api/.env.example apps/api/.env   # e preencha as variáveis obrigatórias
npm run start:dev -w apps/api            # API em http://localhost:3000/api
curl -s localhost:3000/api/health        # -> {"status":"ok"}
```

A API sobe na **porta 3000** (mude com `PORT` no `.env`) e todas as rotas ficam sob o prefixo `/api`. Ela é um processo separado da LP: subir uma não sobe a outra, e a LP não depende dela para renderizar (SDD § D-08).

As migrações **já foram aplicadas no projeto hospedado** (ver "Estado verificado"). O que ainda falta para a API servir conteúdo de verdade é a migração inicial do conteúdo atual para o CMS, que é a T9: até lá as tabelas estão vazias, e `GET /api/content` responde `200` com `{"sections":{},"metadata":null}` — vazio é o estado correto, não erro.

### Endpoints da API

Prefixo `/api` em todas as rotas. A guarda de autenticação é **global e nega por padrão** (SDD § D-03): as rotas públicas da primeira tabela são as únicas marcadas com `@Public()` no código, e qualquer rota nova nasce exigindo token.

**Públicos — nenhum token, consumidos pela LP e pelo injetor de SEO:**

| Método e rota | O que faz |
|---|---|
| `GET /api/health` | Sonda de operação. Responde `{"status":"ok"}`. |
| `GET /api/content` | Todo o conteúdo publicado em **uma** resposta: `{ sections, metadata }`. Seções não publicadas e itens de lista não publicados são **omitidos**; os itens vêm na ordem definida no painel. |
| `GET /api/seo` | Só os metadados da página, para o injetor de borda: `{ title, description, ogImageUrl, canonicalUrl }`. Campos ausentes vêm `null`, para que o injetor use a reserva do HTML estático em vez de falhar. |

**Exigem token** — cabeçalho `Authorization: Bearer <token do Supabase Auth>`. Sem token, ou com token inválido ou expirado, respondem `401 {"statusCode":401,"error":"Autenticação necessária."}`:

| Método e rota | O que faz |
|---|---|
| `GET /api/admin/sections` | Lista as **12** seções na ordem da página, com `isPublished` e `updatedAt`. Aparecem todas mesmo antes de existir documento salvo (`updatedAt: null`). |
| `GET /api/admin/sections/:key` | Documento completo da seção, publicado ou não. |
| `PUT /api/admin/sections/:key` | Substitui o documento. Valida contra `packages/content-schema`; **salvar publica**. |
| `PATCH /api/admin/sections/:key/visibility` | Corpo `{ "isPublished": true \| false }`. Liga ou desliga a seção sem apagar o conteúdo. |
| `GET /api/admin/metadata` | Metadados da página na forma que o painel edita. |
| `PUT /api/admin/metadata` | Grava os metadados. Mesma validação por esquema das seções. |

Ainda **não implementados**: `/api/leads` (público) e as rotas de mídia e de leads sob `/api/admin/*`, que chegam nas T7 e T8. O contrato completo está no [SDD § "Contratos de dados/API/interfaces"](agent_context/SDD.md).

Comportamentos que valem para todas as rotas administrativas de conteúdo:

- **Chave de seção fora das 12 conhecidas responde `404` e nunca cria registro.** O conjunto é fechado: o CMS edita seções existentes, nunca cria tipos novos. Uma chave inválida não chega sequer a tocar o banco.
- **Nenhuma gravação escapa da validação de esquema** (risco R-03 do SDD). Documento inválido responde `422` com erro por campo, no caminho do campo:
  ```json
  { "statusCode": 422, "error": "Dados inválidos.",
    "fields": { "faq.heading": "Campo obrigatório.",
                "faq.items.0.question": "Campo obrigatório." } }
  ```
  Campo que não existe no esquema também é recusado, em vez de gravado em silêncio.
- **`PATCH .../visibility` em uma seção que nunca foi salva responde `404`.** Publicá-la significaria criar um documento vazio, que é exatamente a forma inválida que a validação existe para impedir — grave a seção primeiro.
- **Mensagens de validação em português**, inclusive as que o `class-validator` produz sozinho. Coberto por teste de guarda que varre os DTOs (`apps/api/test/mensagens-em-portugues.spec.ts`).
- **`GET /api/content` faz uma consulta às seções, não uma por seção** (risco R-05). No máximo três no total — uma por tabela envolvida: `content_sections`, `site_metadata` e `media_assets`. O número não cresce com a quantidade de seções, de itens nem de imagens, e está preso por teste.

#### Como as referências de mídia aparecem na resposta

Um campo de imagem, vídeo ou legenda guarda no banco o **identificador** da mídia, nunca um endereço digitado (SDD § "Contrato do esquema de seção"). As duas saídas da API entregam formas diferentes desse mesmo campo, e a diferença é proposital:

| Saída | O que o campo de mídia traz | Por quê |
|---|---|---|
| `GET /api/content` e `GET /api/seo` (públicas) | A **URL pública** do arquivo | Quem consome é a LP e o injetor de SEO, que precisam de um endereço para `<img src>`, `<video src>` e `og:image`. Um identificador não é renderizável, e a LP nunca fala com o Supabase para resolvê-lo (SDD § C-06, C-07 e C-10). |
| `GET /api/admin/sections/:key` e `GET /api/admin/metadata` (com token) | O **identificador** guardado | Quem consome é o painel, que edita a referência e a devolve no `PUT`. Trocar o identificador pela URL na tela de edição faria o painel gravar um endereço digitado, exatamente o que o esquema proíbe. |

A resolução acontece **dentro da API**, na leitura, e vale tanto para campo de topo (`hero.image`, `header.logo`) quanto para campo de item de lista (vídeos, cards, passos, parceiros).

```jsonc
// GET /api/content — recorte
{ "sections": {
    "hero": { "image": "https://…/storage/v1/object/public/imagens/hero.png",
              "imageAlt": "Cão recebendo o petisco" },
    "demonstracao": { "videos": [ { "video": "https://…/videos/demo.mp4",
                                    "poster": "https://…/imagens/demo.png" } ] } },
  "metadata": { "ogImage": "https://…/imagens/compartilhamento.png" } }
```

**Mídia ausente ou apagada não quebra a resposta:** o campo simplesmente **não aparece** no documento publicado — a API nunca entrega um identificador cru a quem espera um endereço, e a LP já trata campo ausente como vazio (risco R-03). Vale a regra: *na saída pública, um campo de mídia ou é uma URL, ou não existe*. O texto alternativo, que é texto e não mídia, continua vindo intacto ao lado.

Uma consulta resolve **todas** as mídias da página de uma vez, e nenhuma consulta é feita quando o conteúdo publicado não referencia mídia; mídia de seção ou de item despublicado não é sequer buscada (risco R-05).

Exemplo de chamada autenticada:

```bash
curl -s -X PUT http://localhost:3000/api/admin/sections/faq \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"heading":"Perguntas frequentes","items":[{"visivel":true,"ordem":0,"question":"Pergunta?","answer":"Resposta."}]}'
```

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
npx supabase db push --db-url \
  "postgresql://postgres.<ref-do-projeto>:<senha-do-banco>@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
```

Este é o caminho verificado em 2026-09-02, e ele dispensa `supabase login` e `supabase link`. Três detalhes que custam tempo se você não souber:

- **Use o pooler, não o host direto.** `db.<ref>.supabase.co` resolve apenas para IPv6; em rede sem rota IPv6 (WSL, muitos CI) a conexão é recusada com `ECONNREFUSED`. O pooler responde em IPv4.
- **Porta 5432, não 6543.** A 5432 é o modo sessão, que suporta DDL. A 6543 é modo transação e não serve para migração.
- **O usuário é `postgres.<ref>`**, não `postgres`, quando se conecta pelo pooler.

A `<regiao>` deste projeto é `sa-east-1`. Se não souber a de outro projeto, teste as candidatas com `--dry-run`, que conecta e lista o que seria aplicado sem alterar nada.

A senha do banco **não** está em `apps/api/.env` e não deve estar: a API nunca executa DDL, e guardar ali uma credencial com esse poder violaria o menor privilégio. Ela é fornecida na hora da migração, por quem opera. `SUPABASE_SECRET_KEY` não a substitui — ela fala com a Data API e com o Storage, não executa DDL.

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

As **seis migrações foram aplicadas ao projeto hospedado** em 2026-09-02, pelo caminho do pooler descrito acima, e as quatro tabelas responderam `200` com a chave secreta. O `verify-isolation.mjs` rodado contra o projeto hospedado deu **8 checagens, exit 0**, com o portão da Data API aparecendo como `REFORCADO` — lá a chave publicável é recusada antes de chegar às tabelas, então a RLS em si continua provada apenas pela verificação local acima.

Confirmado de novo na T6, com a API real falando com o projeto hospedado: uma seção gravada por `PUT /api/admin/sections/faq` voltou por `GET /api/content` com o item oculto ausente e os visíveis na ordem do painel; os registros de verificação foram apagados em seguida, e as quatro tabelas terminaram vazias, como a T9 espera encontrá-las.

A resolução de mídia foi verificada do mesmo jeito, também contra o projeto hospedado: com uma linha em `media_assets` e as seções `hero` e `demonstracao` gravadas referenciando-a, `GET /api/content` sem token devolveu a **URL pública** no campo de topo, em cada item de lista e em `metadata.ogImage`, sem nenhum identificador na resposta, enquanto `GET /api/admin/sections/hero` continuou devolvendo o identificador; apagada a mídia com o conteúdo ainda apontando para ela, os campos sumiram e o restante do documento veio intacto. Os registros e o operador de verificação foram removidos: as quatro tabelas terminaram vazias e o projeto com **0 usuários**.

### Como criar um operador do painel

O CMS **não tem tela de gestão de usuários** — os operadores são criados no painel do
Supabase, por decisão registrada no [SDD § D-03](agent_context/SDD.md). A API não guarda
senhas nem tabela de usuários: ela apenas verifica o token que o Supabase Auth emitiu.

No painel do Supabase, no projeto do Veggiedent:

1. **Authentication → Users → Add user → Create new user**.
2. Preencha **Email** e **Password**. A senha é definida aqui e entregue à pessoa por um
   canal seguro — ela pode trocá-la depois pelo próprio fluxo do Supabase.
3. Marque **Auto Confirm User**. Sem isso o usuário fica pendente de confirmação por
   e-mail e o login falha, porque este projeto não tem envio de e-mail configurado.
4. Confirme em **Add user**. O operador já entra pelo painel do CMS na hora — não há nenhum
   passo adicional na API, nem reinício, nem lista de permissões a atualizar.

Para **revogar o acesso**, remova (ou banha) o usuário na mesma tela. O token que ele já
tiver em mãos continua válido até expirar; o Supabase emite tokens de vida curta, e a
sessão do painel deixa de ser renovável assim que o usuário some.

Não há papéis nem permissões: quem entra tem acesso a todo o painel. Gestão de papéis está
fora de escopo por decisão do PRD.

> **Verificado na T5**, contra o projeto real, com um usuário de teste criado e removido em
> seguida: o token emitido pelo Supabase Auth é assinado em **ES256** e verificado pela API
> contra o JWKS do projeto (`SUPABASE_JWKS_URL`), sem que a API guarde nenhum segredo de
> assinatura. Requisição sem token a um endpoint administrativo responde `401`; com o token
> do operador, `200`.

## Alterações, testes e validações

- **Estratégia de branch:** GitHub Flow. Branch por tarefa (`feat/T{n}-slug`), PR obrigatório para `main`, **revisão obrigatória antes do merge**. Commits em Conventional Commits. Sem `git push --force` em branch compartilhada. Política completa em [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Testes automatizados:** `npm run test` (todos os workspaces) ou `npm run test -w <workspace>`. O runner é o **Vitest** na LP, no painel e em `packages/`, e o **Jest** em `apps/api` — o padrão do NestJS, adotado na T4 porque o Vitest depende do esbuild, que não emite os metadados de decorador dos quais a injeção de dependência do Nest precisa. Os workspaces ainda sem teste passam com `--passWithNoTests`.
- **Verificação de segurança do banco:** `node supabase/scripts/verify-isolation.mjs` (ver "Verificar o isolamento da superfície pública"). Não entra no `npm run test` porque precisa de um Supabase alcançável e de credenciais — é um passo de verificação de ambiente, não um teste unitário.
- **Qualidade de código:** `npm run typecheck` (TypeScript em modo `strict`). O repositório não tem linter configurado — a T1 não introduziu um, e a checagem de tipos mais a revisão de código são hoje as únicas barreiras automáticas.
- **Visualização da API:** **sim, com Swagger em `/api/docs` — mas apenas fora de produção** (decidido na T4). A API tem dois consumidores construídos separadamente, a LP e o painel, e num projeto de porte Médio a divergência entre o que a API responde e o que o consumidor espera é o defeito mais provável e o mais caro de achar; um contrato gerado do próprio código é a barreira barata contra isso. Em produção a mesma página seria um catálogo público dos endpoints `/api/admin/*` sem nenhum valor para o visitante da LP, então ela é desligada quando `NODE_ENV=production`. A fonte de verdade do contrato continua sendo o SDD § "Contratos de dados/API/interfaces" (o projeto é Spec-Anchored): o Swagger reflete o código, não o substitui.
- **Formato de erro:** toda rota que falha responde `{ statusCode, error, fields? }`, e nada além disso — `fields` mapeia o caminho do campo (`hero.headline`) para a mensagem em português. A mensagem é escolhida a partir do status, nunca copiada da exceção, para que caminho de arquivo, nome de variável de ambiente ou detalhe do Supabase fiquem no log do servidor e não na resposta. Erro de validação responde `422`, como o SDD determina, e não o `400` padrão do NestJS.
- **Autenticação da API:** o painel autentica no Supabase Auth e manda o token em `Authorization: Bearer <token>`; a API o verifica contra o JWKS do projeto (SDD § D-03). A guarda é **global e nega por padrão**: um endpoint novo, criado sem nenhuma marcação, nasce protegido, e só fica público se alguém escrever `@Public()` nele de propósito — esquecer leva a "bloqueado", nunca a "exposto". Toda recusa sai como `401` no formato único de erro, sem distinguir token ausente de expirado ou de assinatura inválida, para não virar oráculo de tokens válidos; o motivo fica no log do servidor, em texto fixo que nunca inclui o token. Os testes de autenticação não tocam a rede: geram um par ES256 próprio, assinam os tokens localmente e apontam a verificação a um JWKS servido em `127.0.0.1`.
- **Ambientes publicados:** **[PENDENTE]** — preencher na T16 com as URLs reais de LP, painel e API.

## Atualização e monitoramento

- **Processo de merge:** PR com revisão aprovada e critério de "pronto" da tarefa verificado (comando de teste/build rodado, não apenas relatado). Ver [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Publicação:** **[PENDENTE]** — documentar na T16 as rotas do domínio único (`/`, `/admin`, `/api/*`) e o procedimento de deploy de cada peça.
- **Logs e monitoramento:** **[PENDENTE]** — definir na T16. A disponibilidade da API precisa ser monitorada: é dela que depende o envio do formulário (risco R-02 do SDD).

## Manutenção

- **Adicionar um campo a uma seção:** edite um arquivo só — o esquema da seção em `packages/content-schema/src/sections/<secao>.ts`.

  1. Acrescente o campo ao array `fields` da seção, ou ao `itemFields` da lista quando o campo pertencer a um item (um card, um passo, um parceiro, uma pergunta). Um campo é `{ name, type, label, help, required }`: `label` e `help` são o que o operador lê no painel, em português — `help` diz onde o campo aparece na página, e é opcional só na forma, não na prática. Tipos disponíveis: `texto-curto`, `texto-longo`, `lista-de-textos`, `imagem`, `video`, `legenda`, `link`, `booleano`.
  2. Se o campo for uma imagem, não o declare à mão: use `requiredImage({ ... })` ou `optionalImage({ ... })` de `src/fields.ts`. Os dois emitem a imagem **e** o texto alternativo obrigatório adjacente de uma vez, de modo que a invariante de acessibilidade não dependa de alguém lembrar dela.
  3. Preencha o campo novo no documento de exemplo da seção, em `packages/content-schema/tests/fixtures.ts`. Este é o único passo manual obrigatório: os documentos de exemplo são tipados pelos tipos derivados do esquema, então um campo obrigatório sem valor ali reprova `npm run typecheck`.
  4. Rode `npm run test -w packages/content-schema` e `npm run typecheck`.

  Acompanham sozinhos, sem nenhuma outra alteração de código: o tipo TypeScript do documento (`SectionDocumentOf<'secao'>` é calculado a partir do mesmo array de campos), a validação aplicada pela API (o validador Zod é construído do esquema em `src/zod.ts`) e o formulário do painel, gerado a partir do esquema (T11).

  Fora do pacote, duas coisas continuam sendo trabalho manual: a LP só exibe o campo quando o componente da seção passar a renderizá-lo; e um campo **obrigatório** acrescentado depois da migração inicial (T9) invalida os documentos já gravados até que alguém preencha o valor pelo painel — para evitar isso, crie-o com `required: false`, preencha o conteúdo e só então torne-o obrigatório.

- **Excluir um lead a pedido do titular (LGPD):** **[PENDENTE]** — procedimento documentado na T13.
- **Limpeza de arquivos órfãos no armazenamento:** **[PENDENTE]** — documentar na T7. Uploads interrompidos podem deixar arquivos sem registro; são inertes, mas ocupam espaço.

## Pendências herdadas do projeto atual

Itens que já eram pendência antes do CMS e continuam abertos:

- **Imagem de compartilhamento social (`og:image`)** ainda não aprovada pela Virbac. Passa a ser editável pelo painel quando chegar.
- **Dados legais da Virbac Brasil** (CNPJ e afins) pendentes no rodapé.
- **Conteúdo da seção Ingredientes** e a **faixa etária recomendada** no FAQ aguardam material técnico da Virbac; migrados como não publicados.
- **Payload do RD Station** marcado no código atual como "confirmar antes do go-live": método de autenticação e nomes dos campos personalizados dependem de como a conta da Virbac foi configurada (risco R-08 do SDD).
