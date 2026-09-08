# Operação: ambiente, comandos e publicação

## Variáveis de ambiente

**`apps/api` (servidor — nunca expostas ao navegador):**

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | sim | Chave secreta do Supabase. Ignora RLS — jamais no cliente |
| `SUPABASE_JWKS_URL` | sim | Endpoint JWKS usado para verificar o token dos operadores |
| `ALLOWED_ORIGINS` | sim | Origens autorizadas a chamar a API, separadas por vírgula |
| `NODE_ENV` | não | `development` (padrão), `test` ou `production` |
| `PORT` | não | Porta HTTP da API. Padrão `3000` |

O modelo está em [`apps/api/.env.example`](../apps/api/.env.example); copie para `apps/api/.env` e preencha. A API **valida o ambiente na inicialização**: faltando uma variável obrigatória ela recusa subir e nomeia a variável no log (nunca o valor), em vez de falhar depois em tempo de requisição.

**`RDSTATION_API_TOKEN` e `RDSTATION_CONVERSION_IDENTIFIER` não existem mais.** A integração foi descontinuada em 2026-09-03; se elas ainda estiverem no `.env` de algum ambiente, podem ser apagadas — a API as ignora.

**`apps/lp` e `apps/admin` (públicas, embarcadas no build):**

Toda variável `VITE_*` entra no arquivo servido ao navegador. Nenhuma delas é segredo, e nenhuma chave secreta pode ser acrescentada a esses arquivos (SDD § R-09).

`apps/admin` (modelo em [`apps/admin/.env.example`](../apps/admin/.env.example)) — as três são obrigatórias na prática, e o painel **recusa subir** sem as duas do Supabase, dizendo qual falta, em vez de mostrar uma tela de login que não autentica:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_BASE_URL` | não | Base dos endpoints da API. Padrão `/api` — em desenvolvimento a entrada única encaminha `/api` para a API local, do mesmo jeito que o domínio único fará em produção |
| `VITE_SUPABASE_URL` | sim | URL do projeto Supabase. O painel a usa **somente** para autenticar (SDD § D-03) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | sim | Chave publicável do Supabase (`sb_publishable_…`), usada só no login. Nunca alcança o banco, por duas barreiras independentes: neste projeto o Supabase a recusa já no portão da Data API (`Only secret API keys can be used for this endpoint`) e, além disso, as quatro tabelas negam a leitura para ela (ver [BANCO-DE-DADOS.md, "Verificar o isolamento da superfície pública"](BANCO-DE-DADOS.md)) |

`apps/lp` (modelo em [`apps/lp/.env.example`](../apps/lp/.env.example)) — todas com valor padrão:

| Variável | Descrição |
|---|---|
| `VITE_EBOOK_URL` | URL de download do e-book. Vazia enquanto a Virbac não entregar |
| `VITE_EBOOK_DELIVERY_MODE` | `download` ou `email` — conteúdo do modal de sucesso |
| `VITE_LEAD_SUBMIT_ENDPOINT` | Endpoint que recebe o formulário. Padrão `/api/leads` — relativo, pela mesma razão de `VITE_CONTENT_ENDPOINT` |
| `VITE_CONTENT_ENDPOINT` | De onde a LP lê o conteúdo publicado. Padrão `/api/content` — relativo porque LP e API compartilham domínio |

## Comandos e portas internas

O comando de todo dia é o Docker (ver [README.md](../README.md) e [DOCKER.md](DOCKER.md)). A lista completa de comandos `npm`, o modo de rodar uma aplicação isolada para depurar, a tabela de portas internas (5173/5174/3000) e as verificações rápidas por `curl` estão em [RODAR-SEM-DOCKER.md](RODAR-SEM-DOCKER.md) — não duplicados aqui.

**Por que um endereço só (vale para os dois modos):** em produção as três aplicações dividem o mesmo domínio. Servir cada uma numa porta separada em desenvolvimento adiaria toda a costura de caminhos para a última tarefa antes de publicar — e é justamente o modelo de URL que o usuário enxerga e que mais facilmente quebra. Com a entrada única, `/admin` sem barra final, os caminhos dos assets e o encaminhamento de `/api` são exercitados todo dia, e publicar passa a ser repetir um desenho já rodado, não desenhá-lo.

`/admin` sem a barra final é redirecionado para `/admin/` — no servidor de desenvolvimento, no `preview` e, através da entrada única, no endereço que se digita. Em produção, a configuração de rotas do domínio único precisa fazer o mesmo, servindo o `index.html` do painel para `/admin`, `/admin/` e qualquer caminho abaixo dele — é o que a pilha de [`DOCKER.md`](DOCKER.md) já entrega e exercita, com `/admin` sem barra respondendo `301` para `/admin/`.

**O painel precisa da API no ar** para fazer qualquer coisa além de autenticar: ele lê e grava conteúdo, mídia e leads sempre pela API, nunca direto no Supabase (SDD § "Camadas e padrão arquitetural"). Como painel e API respondem no mesmo endereço, o painel chama caminhos relativos e não existe requisição entre origens a liberar — é o mesmo desenho do domínio único de produção. Com a API fora do ar, o painel entra normalmente e avisa na tela que não conseguiu falar com ela.

A LP não depende da API para renderizar (SDD § D-08): com a API fora do ar, `/` continua servindo a página.

As migrações **já foram aplicadas no projeto hospedado** (o registro de execução está em [`../agent_context/PLAN.md`](../agent_context/PLAN.md)).A carga inicial de conteúdo já foi executada: o banco tem as seções, as mídias e os metadados publicados.

## Alterações, testes e validações

- **Estratégia de branch:** GitHub Flow. Branch por tarefa (`feat/T{n}-slug`), PR obrigatório para `main`, **revisão obrigatória antes do merge**. Commits em Conventional Commits. Sem `git push --force` em branch compartilhada. Política completa em [`agent_context/PLAN.md`](../agent_context/PLAN.md).
- **Testes automatizados:** `npm run test` (todos os workspaces) ou `npm run test -w <workspace>`. O runner é o **Vitest** na LP, no painel e em `packages/`, e o **Jest** em `apps/api` — o padrão do NestJS, adotado na T4 porque o Vitest depende do esbuild, que não emite os metadados de decorador dos quais a injeção de dependência do Nest precisa. A LP roda em **jsdom com a Testing Library** desde a T14: `src/App.test.tsx` monta a página inteira e prende os dois caminhos do instantâneo — com `GET /api/content` fora do ar a página aparece com o conteúdo embutido, e com a API respondendo ela troca pelo que a API entregou.
- **Verificação de segurança do banco:** `node supabase/scripts/verify-isolation.mjs` (ver [BANCO-DE-DADOS.md, "Verificar o isolamento da superfície pública"](BANCO-DE-DADOS.md)). Não entra no `npm run test` porque precisa de um Supabase alcançável e de credenciais — é um passo de verificação de ambiente, não um teste unitário.
- **Qualidade de código:** `npm run typecheck` (TypeScript em modo `strict`). O repositório não tem linter configurado — a T1 não introduziu um, e a checagem de tipos mais a revisão de código são hoje as únicas barreiras automáticas.
- **Visualização da API:** **sim, com Swagger em `/api/docs` — mas apenas fora de produção** (decidido na T4). A API tem dois consumidores construídos separadamente, a LP e o painel, e num projeto de porte Médio a divergência entre o que a API responde e o que o consumidor espera é o defeito mais provável e o mais caro de achar; um contrato gerado do próprio código é a barreira barata contra isso. Em produção a mesma página seria um catálogo público dos endpoints `/api/admin/*` sem nenhum valor para o visitante da LP, então ela é desligada quando `NODE_ENV=production`. A fonte de verdade do contrato continua sendo o SDD § "Contratos de dados/API/interfaces" (o projeto é Spec-Anchored): o Swagger reflete o código, não o substitui.
- **Formato de erro:** toda rota que falha responde `{ statusCode, error, fields? }`, e nada além disso — `fields` mapeia o caminho do campo (`hero.headline`) para a mensagem em português. A mensagem é escolhida a partir do status, nunca copiada da exceção, para que caminho de arquivo, nome de variável de ambiente ou detalhe do Supabase fiquem no log do servidor e não na resposta. Erro de validação responde `422`, como o SDD determina, e não o `400` padrão do NestJS.
- **Autenticação da API:** o painel autentica no Supabase Auth e manda o token em `Authorization: Bearer <token>`; a API o verifica contra o JWKS do projeto (SDD § D-03). A guarda é **global e nega por padrão**: um endpoint novo, criado sem nenhuma marcação, nasce protegido, e só fica público se alguém escrever `@Public()` nele de propósito — esquecer leva a "bloqueado", nunca a "exposto". Toda recusa sai como `401` no formato único de erro, sem distinguir token ausente de expirado ou de assinatura inválida, para não virar oráculo de tokens válidos; o motivo fica no log do servidor, em texto fixo que nunca inclui o token. Os testes de autenticação não tocam a rede: geram um par ES256 próprio, assinam os tokens localmente e apontam a verificação a um JWKS servido em `127.0.0.1`.
- **Telas de metadados e de leads (T13):** verificadas em navegador de verdade, contra a API e o Supabase reais, com três leads criados por `POST /api/leads` e apagados ao final. Abrir `/admin/leads` ou `/admin/metadados` sem sessão levou ao login **sem a área administrativa chegar ao DOM**; a listagem saiu do mais recente ao mais antigo, com as datas em horário de Brasília; o filtro `02/09` a `02/09` trouxe **só** o lead recebido às 23h30 de 2 de setembro em Brasília (3 de setembro em UTC) — recortar em UTC o teria deixado de fora, que é justamente o defeito que o critério C-12 proíbe; o CSV baixado começou com os bytes `ef bb bf`, usou `;` (13 separadores, 14 colunas, nenhuma vírgula), abriu com a acentuação intacta e **sem coluna de aceite LGPD**, e respeitou o filtro aplicado (1 linha filtrada contra 3 sem filtro); a exclusão pela tela não apagou nada no primeiro clique e só apagou depois da confirmação. A gravação dos metadados foi exercitada e **os valores originais foram devolvidos e conferidos campo a campo**.
- **Proteção de rota do painel:** os testes do painel não tocam a rede — o dublê entra no lugar do cliente do Supabase, e adaptador, provedor, guarda, roteador e telas exercitados são os de produção. A guarda é provada por mutação, não por leitura: removê-la derruba as 9 provas de rota e sessão, e removê-la **apenas** no estado `verificando` — o caso em que o painel piscaria conteúdo protegido e só depois redirigiria — ainda derruba 3, porque três testes registram cada nó inserido no documento e falham se a área administrativa chegou a existir, ainda que por um quadro. Uma verificação feita depois de a tela assentar não pegaria isso.
- **LP consumindo a API (T14):** verificada em navegador real, pela entrada única `http://localhost:5173/`, comparando a página antes e depois da troca. O **texto de todas as seções é idêntico** ao de antes, seção por seção, incluindo cabeçalho e rodapé, e as 24 imagens que a página exibe carregam do armazenamento público (`200`/`206`, nenhuma falha). Com a **API derrubada** (`/api/content` respondendo `500`), a página renderiza inteira a partir do instantâneo — mesmas 24 chamadas de imagem, mesmo texto, CSS aplicado. E a página de fato usa a resposta da API, não só o instantâneo: trocando o corpo de `/api/content` no caminho, sem tocar no banco, o `<h1>` e o título do FAQ mudaram junto. O conteúdo do CMS foi conferido campo a campo antes e depois e **não se moveu**: 11 seções publicadas, 3 metadados.
- **Campo de texto rico (T22):** a sanitização é coberta por testes que **tentam injetar de verdade** — `<script>`, `onerror`/`onclick` em atributo, `href="javascript:"`, `<iframe>`, `<svg onload>`, `<style>`, `<form>` e marcação mal formada —, e cada um deles monta o HTML resultante e verifica o **DOM que sobrou**, não o texto devolvido. Eles existem nas três pontas: na política (`packages/content-schema/tests/rich-text.test.ts`), na gravação da API (`apps/api/test/texto-rico.e2e-spec.ts`) e na página (`apps/lp/src/components/ui/RichText.test.tsx`). A proteção da página é **dupla e foi medida como tal**: removida só a sanitização, os testes continuam passando, porque o renderizador só sabe criar `strong`, `em`, `br` e texto; trocado só o renderizador por um que aceita qualquer tag, eles também continuam passando, porque a sanitização já removeu o perigo; **removidas as duas**, 5 testes falham com `<a>`, `<iframe>`, `<svg>` e `<img>` de verdade no DOM. Na API, remover a sanitização da gravação derruba **8 dos 9** casos do arquivo.
- **Ambientes publicados:** **[PENDENTE]** — preencher na T16 com as URLs reais de LP, painel e API.

## Atualização e monitoramento

- **Processo de merge:** PR com revisão aprovada e critério de "pronto" da tarefa verificado (comando de teste/build rodado, não apenas relatado). Ver [`agent_context/PLAN.md`](../agent_context/PLAN.md).
- **Publicação:** o **empacotamento e o roteamento do domínio único estão prontos e verificados** — `/`, `/admin`, `/api/*` atrás de uma porta única, com um comando, em [`DOCKER.md`](DOCKER.md), que também lista o que quem publicar precisa ajustar (TLS na frente, `ALLOWED_ORIGINS`, migrações). **Escolher o provedor e publicar continua com o usuário**, por decisão dele: a publicação saiu do escopo dos agentes.
- **Logs e monitoramento:** **[PENDENTE]** — definir na T16. A disponibilidade da API precisa ser monitorada: é dela que depende o envio do formulário (risco R-02 do SDD).
