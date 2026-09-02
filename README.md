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

**[PENDENTE]** — os passos de banco e API: aplicar as migrações no Supabase (T3), preencher o `.env` de `apps/api` (T4) e rodar a migração inicial de conteúdo (T9).

### Como criar um operador do painel

**[PENDENTE]** — confirmado na T5. Previsto: criar o usuário pelo painel do Supabase Auth; o CMS não tem tela de gestão de usuários, por decisão registrada no SDD § D-03.

## Alterações, testes e validações

- **Estratégia de branch:** GitHub Flow. Branch por tarefa (`feat/T{n}-slug`), PR obrigatório para `main`, **revisão obrigatória antes do merge**. Commits em Conventional Commits. Sem `git push --force` em branch compartilhada. Política completa em [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Testes automatizados:** `npm run test` (todos os workspaces) ou `npm run test -w <workspace>`. O runner é o **Vitest** na LP, no painel e em `packages/`; a API usará o runner padrão do NestJS (T4). Os workspaces ainda sem teste passam com `--passWithNoTests`.
- **Qualidade de código:** `npm run typecheck` (TypeScript em modo `strict`). O repositório não tem linter configurado — a T1 não introduziu um, e a checagem de tipos mais a revisão de código são hoje as únicas barreiras automáticas.
- **Visualização da API:** **[PENDENTE]** — decidir na T4 se a API expõe Swagger.
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
