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

Os cinco módulos de domínio nascem vazios na T4: eles ganham conteúdo nas T5–T8.

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
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase (`sb_publishable_…`), usada só pelo painel, só no login. Verificado neste projeto: ela **não** alcança a Data API — o Supabase responde `Only secret API keys can be used for this endpoint` —, então não há como ler o banco com ela mesmo que vaze |
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

**[PENDENTE]** — os passos de banco e conteúdo: aplicar as migrações no Supabase (T3) e rodar a migração inicial de conteúdo (T9).

### Como criar um operador do painel

**[PENDENTE]** — confirmado na T5. Previsto: criar o usuário pelo painel do Supabase Auth; o CMS não tem tela de gestão de usuários, por decisão registrada no SDD § D-03.

## Alterações, testes e validações

- **Estratégia de branch:** GitHub Flow. Branch por tarefa (`feat/T{n}-slug`), PR obrigatório para `main`, **revisão obrigatória antes do merge**. Commits em Conventional Commits. Sem `git push --force` em branch compartilhada. Política completa em [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Testes automatizados:** `npm run test` (todos os workspaces) ou `npm run test -w <workspace>`. O runner é o **Vitest** na LP, no painel e em `packages/`, e o **Jest** em `apps/api` — o padrão do NestJS, adotado na T4 porque o Vitest depende do esbuild, que não emite os metadados de decorador dos quais a injeção de dependência do Nest precisa. Os workspaces ainda sem teste passam com `--passWithNoTests`.
- **Qualidade de código:** `npm run typecheck` (TypeScript em modo `strict`). O repositório não tem linter configurado — a T1 não introduziu um, e a checagem de tipos mais a revisão de código são hoje as únicas barreiras automáticas.
- **Visualização da API:** **sim, com Swagger em `/api/docs` — mas apenas fora de produção** (decidido na T4). A API tem dois consumidores construídos separadamente, a LP e o painel, e num projeto de porte Médio a divergência entre o que a API responde e o que o consumidor espera é o defeito mais provável e o mais caro de achar; um contrato gerado do próprio código é a barreira barata contra isso. Em produção a mesma página seria um catálogo público dos endpoints `/api/admin/*` sem nenhum valor para o visitante da LP, então ela é desligada quando `NODE_ENV=production`. A fonte de verdade do contrato continua sendo o SDD § "Contratos de dados/API/interfaces" (o projeto é Spec-Anchored): o Swagger reflete o código, não o substitui.
- **Formato de erro:** toda rota que falha responde `{ statusCode, error, fields? }`, e nada além disso — `fields` mapeia o caminho do campo (`hero.headline`) para a mensagem em português. A mensagem é escolhida a partir do status, nunca copiada da exceção, para que caminho de arquivo, nome de variável de ambiente ou detalhe do Supabase fiquem no log do servidor e não na resposta. Erro de validação responde `422`, como o SDD determina, e não o `400` padrão do NestJS.
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
