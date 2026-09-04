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
| `apps/admin` | Painel de administração, servido em `/admin` atrás de login | React 18, Vite 5, TypeScript 5, React Router 6, Tailwind 3, Lexical (editor de texto rico) |
| `apps/api` | API do CMS: conteúdo, mídia, metadados e leads | NestJS 11, Node 20+ |
| `packages/content-schema` | Esquemas das seções — fonte única de validação, formulário e tipos | TypeScript 5, Zod, DOMPurify |

Padrão arquitetural, camadas, modelo de dados, decisões técnicas com trade-offs e os diagramas C4 estão em [`agent_context/SDD.md`](agent_context/SDD.md) — não duplicados aqui.

O repositório é um monorepo de workspaces npm. `agent_context/` e `README.md` ficam na raiz porque cobrem o produto inteiro (SDD § "Estrutura de pastas do repositório"):

```
/
├── apps/
│   ├── lp/                 # landing page (React + Vite + Tailwind)
│   ├── admin/              # painel (React + Vite + Tailwind), servido sob /admin
│   └── api/                # API NestJS — módulos por domínio, quatro camadas em cada
├── packages/
│   └── content-schema/     # esquemas de seção — esqueleto, preenchido na T2
├── serverless/             # relay antigo do RD Station — ainda em produção, aposentado na T16
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

Os cinco módulos de domínio nascem vazios na T4. `auth` foi preenchido na T5; `content` e `metadata`, na T6; `media`, na T7; `leads`, na T8.

Dentro de `apps/admin`, a mesma inversão de dependência da API aparece em escala menor — o painel não conhece o Supabase, conhece uma porta:

```
apps/admin/src/
├── main.tsx            # lê o ambiente, monta o roteador em /admin e injeta as dependências
├── App.tsx             # as rotas: uma pública (login) e todas as outras dentro da guarda
├── config/env.ts       # variáveis do painel, validadas na inicialização
├── auth/
│   ├── auth-gateway.ts           # a porta: entrar, sair, observar a sessão
│   ├── supabase-auth-gateway.ts  # o adaptador do Supabase Auth — o único arquivo que o conhece
│   ├── AuthProvider.tsx          # estado da sessão, alimentado só pelo que o gateway avisa
│   └── RequireSession.tsx        # a guarda de rota
├── api/                # cliente da API do CMS (token no cabeçalho, como a guarda da API espera)
├── content/
│   ├── sections-gateway.ts   # a porta das seções: listar, ler, gravar, ligar/desligar
│   ├── SectionsScreen.tsx    # a lista das 12 seções, na ordem da página
│   ├── SectionEditorScreen.tsx  # a tela de edição de uma seção
│   ├── SectionForm.tsx       # o formulário, percorrendo o esquema
│   ├── ListEditor.tsx        # itens de lista: adicionar, remover, reordenar, ligar/desligar
│   ├── fields/FieldControl.tsx  # um controle por tipo de campo do esquema
│   ├── fields/rich-text/     # o editor de texto rico (Lexical): negrito e quebra de linha
│   ├── section-draft.ts      # rascunho e documento: funções puras, sem React
│   ├── editor-state.ts       # as transições da tela de edição
│   └── field-errors.ts       # caminhos de erro da API → campos do formulário
├── routing/            # caminhos nomeados e a rota de login
└── screens/            # login, esqueleto autenticado e a área das telas de mídia e leads
```

**A guarda é uma rota de layout, não um invólucro repetido em cada tela** — a mesma ideia da guarda global da API: uma rota nova nasce dentro dela, e expor exigiria declará-la fora, de propósito. A sessão tem três estados, e o terceiro (`verificando`) existe para que não haja instante em que tela administrativa apareça antes de a sessão ser confirmada: sem ele, o painel teria de tratar "ainda não sei" como "tem sessão" (e piscaria conteúdo protegido) ou como "não tem" (e expulsaria quem acabou de recarregar a página).

**Como a API consome `packages/content-schema`:** o pacote é a fonte única de validação (SDD § D-02), mas a API compila para CommonJS e o pacote é lido como TypeScript pelo Vite. Para servir aos dois, ele passou a ter um build próprio (`npm run build -w packages/content-schema`, saída em `packages/content-schema/dist/`): a API resolve o pacote pelo build CommonJS, e Vite e Vitest continuam lendo `src/`. Os scripts `build`, `typecheck` e `test` de `apps/api` reconstroem o pacote antes de rodar, então não existe passo manual a lembrar nem risco de compilar contra uma versão velha do esquema.

**Peso do que vai para o navegador:** o pacote do painel passou de 494 KB para **853 KB**
(253 KB comprimidos) com o editor de texto rico — o Lexical é a maior dependência dele. O da
LP fica em **357 KB** (125 KB comprimidos): a LP não carrega o editor, só o sanitizador
(o `purify.min.js` do DOMPurify tem 29 KB).

**Bibliotecas de terceiros que vão para o navegador, e suas licenças:** o código é entregue a
cliente, então a licença de quem viaja junto importa. O editor de texto rico é o **Lexical**
(MIT) — o CKEditor 5, cogitado antes, é GPL na versão aberta. A sanitização do texto rico é do
**DOMPurify** (MPL-2.0 ou Apache-2.0, à escolha de quem usa), a mesma biblioteca que a API usa
do lado do servidor, ali com o **jsdom** (MIT) fornecendo o DOM que o Node não tem.

**Serviços externos:** Supabase (banco Postgres, armazenamento de arquivos e autenticação) e RD Station Marketing (destino de marketing dos leads).

**Ponto de atenção de segurança:** a chave secreta do Supabase e o token do RD Station vivem exclusivamente no ambiente de `apps/api`. Nenhuma credencial pode entrar em um build de navegador — variáveis lidas pelo Vite (`VITE_*`) são públicas por natureza.

## Como o painel gera o formulário de cada seção

**Não existe formulário escrito à mão por seção** (SDD § D-02). `SectionForm.tsx` percorre
`schema.fields` e `schema.lists` do pacote `packages/content-schema` e desenha o que
encontra; em nenhum arquivo do painel aparece o nome de um campo ou de uma seção. Cada
pedaço da tela sai de uma propriedade do esquema:

| No esquema | Na tela |
|---|---|
| `label` | o rótulo do campo, em português |
| `help` | a linha de ajuda logo abaixo do rótulo, ligada ao controle por `aria-describedby` |
| `required` | o asterisco vermelho (fora do rótulo, para o leitor de tela não anunciá-lo) e `aria-required` no controle |
| `type` | qual controle é desenhado — a tabela abaixo |

**O que o operador vê em cada tipo de campo:**

| Tipo | Controle | Observação |
|---|---|---|
| `texto-curto` | uma linha de texto | |
| `texto-longo` | uma área de texto de 4 linhas | |
| `texto-rico` | uma área de edição com dois botões, **Negrito** e **Quebra de linha** | guarda HTML; ver **Texto rico: o que o operador vê e o que o HTML pode ter** logo abaixo |
| `lista-de-textos` | uma linha por valor, com **Adicionar linha** e **Remover a linha N** | é um grupo (`fieldset`/`legend`), porque um rótulo serve a um controle só |
| `link` | uma linha de texto | quem julga o endereço é a API: `#secao`, `/pagina`, `https://…`, `mailto:` e `tel:` |
| `booleano` | uma caixa de seleção | |
| `imagem`, `video`, `legenda` | prévia do arquivo guardado, um seletor de arquivo, o limite escrito ao lado, barra de progresso durante o envio e um botão de remover | ver **Como o operador envia um arquivo** logo abaixo. Não há onde digitar identificador de mídia, de propósito (SDD § "Contrato do esquema de seção") |

**Listas de itens.** Cada lista do esquema vira um bloco com **Adicionar item**, e cada item
traz **Subir**, **Descer**, **Remover** e a caixa **Aparece na página**. Não há campo de
posição para digitar: a ordem é a ordem dos itens na tela, e `ordem` é recalculada a partir
dela na hora de gravar — o que torna impossível salvar duas posições iguais ou um buraco na
sequência. Desligar um item o retira da LP sem apagar o conteúdo (SDD § C-08); o mesmo vale
para a seção inteira, pela caixa **Seção aparece na página** no topo da tela, que chama
`PATCH /api/admin/sections/:key/visibility`.

**Salvar publica.** Não há rascunho no servidor: o botão é **Salvar e publicar**, e o sucesso
aparece como confirmação visível na própria tela. Quando a API recusa com `422`, cada mensagem
vai para **o campo que a causou** — o painel tira o prefixo da seção do caminho que a API
devolve (`faq.items.1.question` → a pergunta do segundo item) e pendura a mensagem ali, com
`aria-invalid` no controle. Uma mensagem cujo caminho não corresponde a nenhum campo da tela
não é descartada: aparece em uma lista de avisos acima do formulário.

#### Texto rico: o que o operador vê e o que o HTML pode ter

Alguns textos precisam de mais do que uma linha corrida — o título da Prova de Autoridade, por
exemplo, quebra em duas linhas no desktop e traz um trecho destacado em turquesa. Esses campos
são do tipo `texto-rico` e guardam **HTML**.

**O que o operador vê.** Uma área de edição com o texto já formatado — nunca marcação escrita
por extenso — e dois botões:

- **Negrito**, que marca o trecho selecionado. O botão fica pressionado (`aria-pressed`) quando
  o cursor está dentro de um trecho já marcado;
- **Quebra de linha**, que quebra a linha na posição do cursor. A tecla **Enter** faz o mesmo:
  o campo é um título, e não cria parágrafos.

**O negrito é o destaque.** Não existe controle de cor, de tamanho nem de fonte, e não há
marcação própria de "destaque" para o operador aprender: ele marca em negrito e a página
desenha aquele trecho com o destaque da seção — no título da Prova de Autoridade, turquesa e
extra-bold. Onde o trecho aparece destacado é decisão da página, não de quem escreve.

**O que sobrevive no HTML, e por que o resto é removido.** Um campo de conteúdo que guarda HTML
e é renderizado na página pública é caminho de injeção de script: bastaria um operador com
acesso comprometido colar `<script>` ou `<img src=x onerror=…>` para que o código rodasse no
navegador de todo visitante. Por isso a lista de permissão é fechada e mora em um só lugar
(`packages/content-schema/src/rich-text.ts`):

| Sobrevive | Vira | Observação |
|---|---|---|
| `<strong>`, `<b>` | `<strong>` | é o destaque da página |
| `<em>`, `<i>` | `<em>` | itálico |
| `<br>` | `<br>` | quebra de linha |
| texto | texto | acentuação preservada |

Tudo o mais é removido, **inclusive todo e qualquer atributo** — sem atributo não existe
`onerror`, `onclick` nem `href="javascript:"`. Tag proibida perde a marcação mas **mantém o
texto** que estava dentro dela (a exceção é `<script>` e `<style>`, cujo conteúdo também vai
embora). Um campo obrigatório que só tinha marcação proibida fica vazio depois da limpeza e é
recusado com "Campo obrigatório." — em vez de ser gravado em branco.

**A limpeza acontece nas duas pontas**, com a mesma política:

- **na escrita**, na API, antes de validar e gravar (`SaveSectionUseCase`), para que nem o banco
  nem o instantâneo versionado da LP guardem uma carga de injeção;
- **na leitura**, na LP, ao renderizar (`apps/lp/src/components/ui/RichText.tsx`). Esta é a
  barreira que protege o visitante, e ela é dupla: o componente sanitiza e depois **reconstrói
  o conteúdo em elementos React**, sem `dangerouslySetInnerHTML` em lugar nenhum — só
  `<strong>`, `<em>`, `<br>` e texto conseguem virar nó na página.

#### Como o operador envia um arquivo pelo painel

Abrir a seção, achar o campo de imagem, vídeo ou legenda e **escolher o arquivo**. Não há botão
de enviar: escolher já envia. Enquanto o arquivo sobe, o campo mostra uma barra de progresso e
a porcentagem em texto; ao terminar, a prévia do arquivo aparece ali mesmo — a imagem, o vídeo
com controles de reprodução, ou o link do arquivo de legendas.

**A prévia aparece antes de salvar, e é do arquivo que já está no armazenamento.** O envio e a
gravação da seção são coisas diferentes: o arquivo já subiu e já foi registrado quando a prévia
aparece; o botão **Salvar e publicar** é o que faz a seção passar a apontar para ele. Sair da
tela sem salvar deixa o arquivo no armazenamento sem ninguém usando (ver "Limpeza de arquivos
órfãos", em Operação).

**O limite fica escrito abaixo do campo, antes de qualquer envio** — por exemplo
`MP4 ou WebM, até 50 MB.` Arquivo de tipo não aceito ou acima do limite é recusado **no próprio
painel**, com mensagem em português e sem nenhuma chamada à rede: o operador não espera um
envio para descobrir que o arquivo nunca teve chance.

> **Por que 50 MB, se o bucket de vídeo declara 500 MB.** O projeto Supabase tem um teto global
> de upload por arquivo — hoje **50 MB** — que prevalece sobre o limite declarado em cada
> bucket: acima dele o armazenamento responde `413 Maximum size exceeded` antes de aceitar
> qualquer byte. O painel exibe e aplica o **menor** dos dois limites, que é o que de fato vale.
> Elevar o teto é mudança de plano do projeto, em *Project Settings → Storage → Upload file size
> limit* (o plano Free trava em 50 MB), não mudança de código. Ver "Buckets, limites e tipos
> aceitos" para a tabela completa.

**Vídeo sobe em blocos, pelo protocolo retomável.** Blocos de 6 MB, direto ao armazenamento: um
arquivo de 23,6 MB vira quatro blocos, e uma queda de conexão faz o envio recomeçar do último
bloco confirmado, não do início. Retomar **entre recarregamentos da página** não é oferecido: a
credencial e o caminho de destino são emitidos a cada tentativa, então recarregar começa um
envio novo. Arquivo pequeno (imagem, legenda) sobe em uma requisição só, também com progresso.

**Os bytes nunca passam pela API** (SDD § D-05). O painel pede a credencial, envia o arquivo
direto ao armazenamento e confirma — os três passos descritos em "Envio de mídia em três
passos". Trocar a imagem de uma seção faz o navegador falar duas vezes com a API, com corpos de
poucas centenas de bytes, e uma vez com o armazenamento, com o arquivo inteiro.

**Remover** desfaz a referência do campo, e só isso: o arquivo continua no armazenamento e a
mídia continua registrada, porque ela pode estar em uso em outra seção. Apagar de vez é
`DELETE /api/admin/media/:id`, que recusa com `409` enquanto alguém a referenciar.

#### Imagem decorativa não tem campo de descrição, e isso é proposital

Todo campo de imagem do esquema declara se a imagem é **informativa** ou **decorativa**
(SDD § "Contrato do esquema de seção"):

- **informativa** — o esquema declara, ao lado dela, um campo de texto alternativo obrigatório.
  O painel **recusa salvar** a seção enquanto houver imagem preenchida sem descrição, sem
  chegar a chamar a API: a mensagem aparece no campo de descrição. É a única validação que o
  painel decide sozinho — todo o resto quem decide é a API.
- **decorativa** — o esquema **não** declara campo de descrição, então ele não existe na tela.
  Não é esquecimento nem exceção à acessibilidade: descrever uma imagem que não carrega
  informação injeta ruído no leitor de tela sem acrescentar significado. Na página essas imagens
  entram com texto alternativo vazio e escondidas de leitores de tela. É o caso das seis fotos
  do mosaico ao lado do formulário do guia.

Quem edita o esquema faz essa escolha uma vez, pelos construtores `requiredImage`,
`optionalImage` e `decorativeImage` de `packages/content-schema/src/fields.ts` — não há como
declarar uma imagem sem escolher.

**Acrescentar um campo a uma seção continua sendo editar um arquivo só.** Basta declará-lo no
esquema da seção em `packages/content-schema/src/sections/`: ele passa a ser validado pela API,
a aparecer no formulário do painel e a existir no tipo consumido pela LP, sem nenhuma alteração
no código do painel. Isso é verificado por mutação na T11 — ver "Estado verificado".

## As telas do painel

O painel tem quatro telas, todas atrás do login. **Nenhuma delas é alcançável sem sessão**: a
guarda é uma rota de layout, e toda rota nova nasce dentro dela — expor uma tela exigiria
declará-la fora da guarda, de propósito.

| Tela | Endereço | O que faz |
|---|---|---|
| Início | `/admin/` | Caminhos para as demais e a confirmação de que a API aceitou a sessão |
| Seções da página | `/admin/secoes` | As 12 seções, na ordem da página, com data da última edição e visibilidade |
| Metadados da página | `/admin/metadados` | Título, descrição, endereço oficial e imagem de compartilhamento |
| Leads recebidos | `/admin/leads` | Consulta, filtro por período, exportação em CSV e exclusão |

### Metadados da página

Edita o que buscadores e redes sociais mostram sobre a página: **título**, **descrição**,
**endereço oficial** (a URL canônica) e a **imagem de compartilhamento** com seu **texto
alternativo**. Salvar publica — não há rascunho nem visibilidade, porque os metadados sempre
valem.

O formulário é gerado do esquema `packages/content-schema/src/site-metadata.ts`, o mesmo
mecanismo das seções: acrescentar um campo lá o faz aparecer na tela sem tocar no painel. A
imagem usa o campo de mídia das seções, com envio direto ao armazenamento — o operador nunca
digita identificador de mídia. A descrição da imagem é **obrigatória quando há imagem**, e o
painel recusa salvar antes de chamar a API.

A imagem de compartilhamento continua vazia enquanto a Virbac não aprovar a arte — ver
"Pendências herdadas". Com o campo vazio, a LP usa a reserva declarada no `index.html`.

### Leads recebidos

- **Ordem:** do mais recente ao mais antigo. A API já responde assim, e a tela ordena de novo
  por conta própria: a ordem que o operador vê é promessa do painel, não da resposta.
- **Data:** exibida em **horário de Brasília (UTC−3)**, o dia que o operador viveu. Um lead
  enviado às 23h de 2 de setembro aparece como dia 2, ainda que o banco o guarde como 3 de
  setembro em UTC.
- **Filtro por período:** dois dias, inclusivos nos dois extremos. O corte do dia é feito pela
  API, também em horário de Brasília. O painel manda o dia escolhido e não converte nada — fuso
  resolvido em dois lugares vira dois resultados diferentes na primeira vez que um deles mudar.
- **Colunas:** uma por campo que o visitante preenche, mais data de recebimento, origem e o
  resultado do repasse ao RD Station. **Não há coluna de aceite da Política de Privacidade**:
  sem consentimento nenhum lead é gravado, então ela só poderia dizer "sim" e não prova nada
  que a existência da linha já não prove.
- **Exportação em CSV:** `Exportar CSV do período` baixa o arquivo respeitando o **filtro
  aplicado** — o que está digitado sem filtrar não conta, porque exportaria um período que o
  operador não viu na tela. O arquivo é montado pela API e entregue ao navegador **sem ser
  reescrito**, para que o BOM UTF-8 e o separador `;` que fazem o Excel em português abrir a
  planilha certa cheguem intactos.
- **Paginação:** aparece só quando o período não cabe em uma página (50 leads).
- **Exclusão:** em dois passos, para o pedido do titular — ver "Manutenção".

## Acesso e execução do código

### Variáveis de ambiente

**`apps/api` (servidor — nunca expostas ao navegador):**

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | sim | Chave secreta do Supabase. Ignora RLS — jamais no cliente |
| `SUPABASE_JWKS_URL` | sim | Endpoint JWKS usado para verificar o token dos operadores |
| `ALLOWED_ORIGINS` | sim | Origens autorizadas a chamar a API, separadas por vírgula |
| `RDSTATION_API_TOKEN` | não | Token da API de Conversões do RD Station. Vazio hoje — ver abaixo |
| `RDSTATION_CONVERSION_IDENTIFIER` | não | Nome da conversão no RD Station (`conversion_identifier`). Vazio hoje — ver abaixo |
| `NODE_ENV` | não | `development` (padrão), `test` ou `production` |
| `PORT` | não | Porta HTTP da API. Padrão `3000` |

O modelo está em [`apps/api/.env.example`](apps/api/.env.example); copie para `apps/api/.env` e preencha. A API **valida o ambiente na inicialização**: faltando uma variável obrigatória ela recusa subir e nomeia a variável no log (nunca o valor), em vez de falhar depois em tempo de requisição.

**As duas variáveis do RD Station são opcionais de propósito, e hoje estão vazias.** Enquanto a Virbac não confirmar a configuração da conta (risco R-08 do SDD), não há credencial real para preencher. Exigi-las na inicialização faria a API recusar subir — e sem API não há como gravar lead nenhum, que é justamente o dado que não pode se perder. Faltando qualquer uma das duas, `POST /api/leads` continua **gravando o lead** e respondendo sucesso ao visitante; o repasse fica registrado como `rdstation_status = "nao_enviado"`, com a razão em `rdstation_error`. Quem as exige é o adaptador do RD Station, no instante em que o repasse é de fato tentado. Preenchê-las depois não pede mudança de código: os leads que chegarem a partir daí passam a ser repassados.

**`apps/lp` e `apps/admin` (públicas, embarcadas no build):**

Toda variável `VITE_*` entra no arquivo servido ao navegador. Nenhuma delas é segredo, e nenhuma chave secreta pode ser acrescentada a esses arquivos (SDD § R-09).

`apps/admin` (modelo em [`apps/admin/.env.example`](apps/admin/.env.example)) — as três são obrigatórias na prática, e o painel **recusa subir** sem as duas do Supabase, dizendo qual falta, em vez de mostrar uma tela de login que não autentica:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_BASE_URL` | não | Base dos endpoints da API. Padrão `/api` — em desenvolvimento a entrada única encaminha `/api` para a API local, do mesmo jeito que o domínio único fará em produção |
| `VITE_SUPABASE_URL` | sim | URL do projeto Supabase. O painel a usa **somente** para autenticar (SDD § D-03) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | sim | Chave publicável do Supabase (`sb_publishable_…`), usada só no login. Nunca alcança o banco, por duas barreiras independentes: neste projeto o Supabase a recusa já no portão da Data API (`Only secret API keys can be used for this endpoint`) e, além disso, as quatro tabelas negam a leitura para ela (ver "Verificar o isolamento da superfície pública") |

`apps/lp` (modelo em [`apps/lp/.env.example`](apps/lp/.env.example)) — todas com valor padrão:

| Variável | Descrição |
|---|---|
| `VITE_EBOOK_URL` | URL de download do e-book. Vazia enquanto a Virbac não entregar |
| `VITE_EBOOK_DELIVERY_MODE` | `download` ou `email` — conteúdo do modal de sucesso |
| `VITE_LEAD_SUBMIT_ENDPOINT` | Endpoint que recebe o formulário. Aposentado na T16, quando a LP passar a chamar `POST /api/leads` |
| `VITE_CONTENT_ENDPOINT` | De onde a LP lê o conteúdo publicado. Padrão `/api/content` — relativo porque LP e API compartilham domínio |

### Comandos

Todos rodam a partir da raiz. `build`, `typecheck` e `test` delegam aos workspaces (`npm run <script> --workspaces --if-present`); `dev` sobe os três processos de uma vez, atrás da entrada única (`scripts/dev.mjs`).

```bash
npm install          # instala as dependências de todos os workspaces
npm run dev          # sobe LP, painel e API — tudo em http://localhost:5173
npm run build        # build de todos os workspaces; gera apps/lp/dist/ e apps/admin/dist/
npm run typecheck    # checagem de tipos de todos os workspaces
npm run test         # testes de todos os workspaces (Vitest na LP, no painel e em packages/, Jest na API)
npm run preview      # serve o build da LP em http://localhost:4173
npm run instantaneo  # regenera o instantâneo de conteúdo da LP (ver "Instantâneo de conteúdo")
```

Para um workspace só, use `-w`: `npm run build -w apps/lp`, `npm run test -w packages/content-schema`.

Cada aplicação também roda isolada. Isso serve para depurar uma delas, **não é a forma de acessar o projeto** — essa é sempre a entrada única:

```bash
npm run start:dev -w apps/api       # API sozinha, com recarga automática
npm run start -w apps/api           # roda o build já gerado (exige npm run build -w apps/api antes)
npm run dev -w apps/admin           # painel sozinho
npm run build -w apps/admin         # gera apps/admin/dist/, com os assets sob /admin/
npm run preview -w apps/admin       # serve o build do painel em http://localhost:4174/admin/
npm run test -w apps/admin          # testes do painel (Vitest + Testing Library, em jsdom)
```

Requer Node 20 ou superior (verificado com Node 25.6.0 e npm 11.8.0; a T10 rodou em Node 24.18.0 e npm 11.16.0, e a T20 em Node 24.18.0).

### Como rodar localmente

Um comando, **um endereço**:

```bash
git clone <repositorio> && cd veggiedent-lp
npm install
cp apps/lp/.env.example apps/lp/.env        # opcional: todas as variáveis têm default
cp apps/api/.env.example apps/api/.env      # e preencha as variáveis obrigatórias
cp apps/admin/.env.example apps/admin/.env  # e preencha as duas variáveis do Supabase
npm run dev
```

Tudo responde em **http://localhost:5173**, com o mesmo mapa de caminhos que o domínio único terá em produção (SDD § "Visão de tiers" e § D-04):

| Caminho | O que responde |
|---|---|
| `/` | a LP |
| `/admin`, `/admin/` e qualquer caminho abaixo | o painel |
| `/api/*` | a API |

A recarga automática continua valendo nos dois front-ends: uma alteração em `apps/lp/src` ou em `apps/admin/src` chega ao navegador sem recarregar a página e sem reiniciar nada.

**Por que um endereço só:** em produção as três aplicações dividem o mesmo domínio. Servir cada uma numa porta em desenvolvimento adiaria toda a costura de caminhos para a última tarefa antes de publicar — e é justamente o modelo de URL que o usuário enxerga e que mais facilmente quebra. Com a entrada única, `/admin` sem barra final, os caminhos dos assets e o encaminhamento de `/api` são exercitados todo dia, e publicar passa a ser repetir um desenho já rodado, não desenhá-lo.

**As portas individuais são detalhe interno.** Servem para depurar um processo isolado, não para o dia a dia:

| Processo | Porta interna | Observação |
|---|---|---|
| LP (servidor de desenvolvimento) | 5173 | é a própria entrada única; encaminha `/admin` e `/api` |
| Painel | 5174 | escuta só em `localhost`; abrir `http://localhost:5174/` devolve a mensagem de base incorreta do Vite, e o painel está em `/admin/` |
| API | 3000 | mude com `PORT` no `.env`; todas as rotas ficam sob o prefixo `/api` |

Como o encaminhamento vive no servidor de desenvolvimento da LP, subir só a LP (`npm run dev -w apps/lp`) deixa `/admin` e `/api` respondendo `500` (erro de proxy) até que os outros dois processos existam. `npm run dev` na raiz sobe os três e derruba os três juntos.

Verificações rápidas, todas a partir do endereço único:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/          # -> 200 (LP)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:5173/admin   # -> 302 .../admin/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/admin/    # -> 200 (painel)
curl -s http://localhost:5173/api/health                                 # -> {"status":"ok"}
```

Para conferir os builds de produção, que não passam pela entrada única: `npm run build && npm run preview` serve a LP em http://localhost:4173, e `npm run build -w apps/admin && npm run preview -w apps/admin` serve o painel em http://localhost:4174/admin/.

`/admin` sem a barra final é redirecionado para `/admin/` — no servidor de desenvolvimento, no `preview` e, através da entrada única, no endereço que se digita. Em produção, a configuração de rotas do domínio único (T16) precisa fazer o mesmo, servindo o `index.html` do painel para `/admin`, `/admin/` e qualquer caminho abaixo dele.

**O painel precisa da API no ar** para fazer qualquer coisa além de autenticar: ele lê e grava conteúdo, mídia e leads sempre pela API, nunca direto no Supabase (SDD § "Camadas e padrão arquitetural"). Como painel e API respondem no mesmo endereço, o painel chama caminhos relativos e não existe requisição entre origens a liberar — é o mesmo desenho do domínio único de produção. Com a API fora do ar, o painel entra normalmente e avisa na tela que não conseguiu falar com ela.

A LP não depende da API para renderizar (SDD § D-08): com a API fora do ar, `/` continua servindo a página.

As migrações **já foram aplicadas no projeto hospedado** (ver "Estado verificado"). O que ainda falta para a API servir conteúdo de verdade é a migração inicial do conteúdo atual para o CMS, que é a T9: até lá as tabelas estão vazias, e `GET /api/content` responde `200` com `{"sections":{},"metadata":null}` — vazio é o estado correto, não erro.

### Endpoints da API

Prefixo `/api` em todas as rotas. Os exemplos de `curl` desta seção falam direto com a API, na porta 3000; pela entrada única de
desenvolvimento as mesmas rotas respondem em `http://localhost:5173/api/…`. A guarda de autenticação é **global e nega por padrão** (SDD § D-03): as rotas públicas da primeira tabela são as únicas marcadas com `@Public()` no código, e qualquer rota nova nasce exigindo token.

**Públicos — nenhum token, consumidos pela LP e pelo injetor de SEO:**

| Método e rota | O que faz |
|---|---|
| `GET /api/health` | Sonda de operação. Responde `{"status":"ok"}`. |
| `GET /api/content` | Todo o conteúdo publicado em **uma** resposta: `{ sections, metadata }`. Seções não publicadas e itens de lista não publicados são **omitidos**; os itens vêm na ordem definida no painel. |
| `GET /api/seo` | Só os metadados da página, para o injetor de borda: `{ title, description, ogImageUrl, canonicalUrl }`. Campos ausentes vêm `null`, para que o injetor use a reserva do HTML estático em vez de falhar. |
| `POST /api/leads` | Recebe o formulário da LP: valida, **grava o lead** e repassa ao RD Station. Responde `200 {"success":true}`; dados inválidos respondem `422` com erro por campo. Ver "Captura e consulta de leads". |

**Exigem token** — cabeçalho `Authorization: Bearer <token do Supabase Auth>`. Sem token, ou com token inválido ou expirado, respondem `401 {"statusCode":401,"error":"Autenticação necessária."}`:

| Método e rota | O que faz |
|---|---|
| `GET /api/admin/sections` | Lista as **12** seções na ordem da página, com `isPublished` e `updatedAt`. Aparecem todas mesmo antes de existir documento salvo (`updatedAt: null`). |
| `GET /api/admin/sections/:key` | Documento completo da seção, publicado ou não. |
| `PUT /api/admin/sections/:key` | Substitui o documento. Valida contra `packages/content-schema`; **salvar publica**. |
| `PATCH /api/admin/sections/:key/visibility` | Corpo `{ "isPublished": true \| false }`. Liga ou desliga a seção sem apagar o conteúdo. |
| `GET /api/admin/metadata` | Metadados da página na forma que o painel edita. |
| `PUT /api/admin/metadata` | Grava os metadados. Mesma validação por esquema das seções. |
| `POST /api/admin/media/upload-url` | Recebe `{ originalFilename, contentType, sizeBytes }` e devolve a credencial temporária e o caminho de destino. **Não** recebe o arquivo. |
| `POST /api/admin/media` | Confirma o upload e registra a mídia. Devolve o registro com a URL pública. |
| `GET /api/admin/media/:id` | Registro de uma mídia. |
| `DELETE /api/admin/media/:id` | Remove registro e arquivo. Responde `409` quando a mídia está em uso. |
| `GET /api/admin/leads` | Lista os leads, **do mais recente ao mais antigo**, paginada. Parâmetros `from`, `to`, `page` e `pageSize`. Devolve `{ leads, total, page, pageSize }`. |
| `GET /api/admin/leads/export` | Exportação em CSV dos leads do período, com os mesmos filtros `from` e `to` da listagem. |
| `DELETE /api/admin/leads/:id` | Exclusão **definitiva** de um lead, a pedido do titular (LGPD). Responde `204`; identificador inexistente ou malformado responde `404`. |

O contrato completo está no [SDD § "Contratos de dados/API/interfaces"](agent_context/SDD.md).

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

#### Envio de mídia em três passos

Os bytes de um arquivo **nunca passam pela API** (SDD § D-05). Vídeos chegam a dezenas de MB, e fazê-los atravessar a API significaria requisição longa, memória consumida e o limite de corpo de requisição da plataforma. O painel faz três chamadas:

**1. Pedir a credencial.** A API recusa aqui o que não pode ser guardado — tipo não suportado ou arquivo acima do limite do bucket — antes de qualquer byte sair da máquina do operador:

```bash
curl -s -X POST http://localhost:3000/api/admin/media/upload-url \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"originalFilename":"Demonstração.mp4","contentType":"video/mp4","sizeBytes":24741168}'
```

```jsonc
{ "kind": "video", "bucket": "veggiedent-videos",
  "path": "676edef9-…/demonstracao.mp4",
  "signedUrl": "https://…/storage/v1/object/upload/sign/veggiedent-videos/…?token=…",
  "token": "…",                       // o mesmo direito de escrita, para o upload retomável
  "resumableEndpoint": "https://…/storage/v1/upload/resumable/sign",
  "expiresInSeconds": 7200, "maxBytes": 524288000 }
```

**2. Enviar os bytes, do navegador direto ao armazenamento.** Dois caminhos, ambos com a credencial acima e **sem** passar pela API:

- *Arquivo pequeno* (imagem, legenda): `PUT` no `signedUrl`, com o `content-type` do arquivo — é o que o `uploadToSignedUrl(path, token, file)` do `@supabase/supabase-js` faz.
- *Vídeo*: protocolo retomável (TUS) apontado para `resumableEndpoint`, com o token no cabeçalho **`x-signature`**, blocos de **6 MB** e os metadados `bucketName`, `objectName` e `contentType`. Retomável é o que permite continuar de onde parou depois de uma queda de conexão, e é o que dá o progresso visível que o painel mostra. Quem faz esse papel no painel é o `tus-js-client`, a biblioteca que a própria documentação do Supabase Storage indica; a escolha entre este caminho e o `PUT` acima é feita pela natureza da mídia, em `apps/admin/src/media/media-transfer.ts`.

**3. Confirmar.** Só agora nasce o registro em `media_assets` (risco R-04):

```bash
curl -s -X POST http://localhost:3000/api/admin/media \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"kind":"video","path":"676edef9-…/demonstracao.mp4",
       "originalFilename":"Demonstração.mp4","width":1080,"height":1920,"durationSeconds":12.4}'
```

A API pergunta ao armazenamento se o arquivo está lá; se não estiver, responde `422` e **não grava nada**. Tamanho e tipo do registro são lidos do arquivo que chegou, não do corpo da requisição — quem confirma não consegue registrar uma mídia que não existe nem descrevê-la de forma diferente do que ela é. Confirmar duas vezes o mesmo caminho devolve o registro que já existe, sem duplicar.

A chave secreta do Supabase **não sai do servidor** em nenhum dos três passos: o navegador recebe apenas uma credencial válida para um caminho, em um bucket, por duas horas.

**Buckets, limites e tipos aceitos** (criados por `20260902120500_create_storage_buckets.sql` e alterados por `20260903120000_allow_svg_in_images_bucket.sql`; o catálogo em `apps/api/src/modules/media/domain/media-kind.ts` repete os mesmos valores e um teste lê as migrações em ordem e compara os dois):

| Natureza | Bucket | Limite | Tipos aceitos |
|---|---|---|---|
| `image` | `veggiedent-images` | 10 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, `image/svg+xml` |
| `video` | `veggiedent-videos` | 500 MB | `video/mp4`, `video/webm` |
| `caption` | `veggiedent-captions` | 1 MB | `text/vtt` |

**Por que SVG é aceito.** Ele ficou de fora na criação dos buckets, com a justificativa de que nenhuma seção precisaria dele. A premissa estava errada: a LP usa quatro SVGs reais — o logo Veggiedent, no cabeçalho e no rodapé, e três infográficos da prova de autoridade. Rasterizar o logo custaria 8,7 KB → 35 KB e a escalabilidade de um ativo de marca. SVG continua sendo documento executável, mas aqui o risco é contido por dois fatos: **só operador autenticado envia arquivo** (não existe upload anônimo, e `storage.objects` não tem policy de escrita), e o arquivo é **servido do domínio do Supabase Storage**, não do domínio da LP — um script embutido não alcançaria o DOM da página, seus cookies ou sua sessão, e a LP carrega essas imagens por `<img src>`, contexto em que o navegador já não executa script do SVG.

A natureza é **deduzida do tipo do arquivo**, não escolhida por quem envia: cada tipo pertence a um único bucket. Tipo fora da lista é recusado com `422` e a mensagem `Tipo de arquivo não suportado. Tipos aceitos: …` no campo `contentType`.

> **Limite do projeto, acima do limite do bucket.** O projeto Supabase tem um teto global de upload — hoje **50 MB** neste projeto, verificado em 2026-09-02 — que **prevalece sobre os 500 MB do bucket de vídeo**: um arquivo maior é recusado pelo próprio armazenamento com `413 Maximum size exceeded`, antes de qualquer byte ser aceito. Os vídeos que a LP usa hoje têm 23,6 MB e 4,2 MB, então nada está bloqueado — mas se um vídeo maior que 50 MB precisar entrar, o teto tem de ser elevado em *Project Settings → Storage → Upload file size limit* (o plano Free trava em 50 MB; os pagos vão até 50 GB). O código não contorna isso, e não deve: quem manda no armazenamento é o armazenamento.

**Remoção.** `DELETE /api/admin/media/:id` responde `409` se a mídia estiver referenciada por qualquer seção — **publicada ou não**, porque uma seção desligada precisa voltar idêntica — ou pelos metadados da página; nesse caso nada é apagado. Sem referências, o registro sai primeiro e o arquivo depois: na ordem inversa, uma falha no meio deixaria um registro apontando para arquivo inexistente, e a LP com imagem quebrada.

Exemplo de chamada autenticada:

```bash
curl -s -X PUT http://localhost:3000/api/admin/sections/faq \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"heading":"Perguntas frequentes","items":[{"visivel":true,"ordem":0,"question":"Pergunta?","answer":"Resposta."}]}'
```

#### Captura e consulta de leads

O envio do formulário passou a ser um endpoint da API (SDD § D-07). A função em `serverless/rdstation-lead/` continua no repositório e **será aposentada na T16**, junto com o serviço `submitLeadToRDStation` da LP que aponta para ela — até lá ela ainda é o caminho de produção, e nada nela foi alterado.

**A ordem de `POST /api/leads` é a regra, não detalhe de implementação:**

1. **Honeypot.** O formulário tem um campo invisível (`website`). Preenchido, a resposta é **sucesso** e nada acontece: nenhum lead é gravado, nenhum repasse é feito. Responder erro ensinaria ao robô que o campo existe.
2. **Validação.** Nome não vazio, e-mail com forma de e-mail, consentimento LGPD marcado e porte dentro de `pequeno | medio | grande`. São exatamente as regras do relay que está sendo aposentado. Recusa responde `422` com as chaves `nome`, `email`, `aceite_lgpd` e `porte_cachorro` em `fields`, que é como o formulário da LP marca o campo errado.
3. **Gravação.** O lead é gravado **antes** de o RD Station ser tentado. Se a gravação falhar, aí sim o visitante vê erro — é o único caso em que o lead se perderia.
4. **Repasse.** Só então o RD Station é chamado, e o resultado vira `rdstation_status` (`ok`, `falhou` ou `nao_enviado`) mais `rdstation_error`. **Nenhuma falha desse passo chega ao visitante:** recusa do RD Station, queda de rede e credencial ausente respondem `200` do mesmo jeito, com o lead guardado.

**Os três campos que hoje se perdem em produção.** `conheceVirbac`, `usaProdutoVirbac` e `qualProdutoVirbac` são coletados pelo formulário e descartados antes do envio — o relay serverless nem os prevê no tipo. É o risco R-01 do SDD, e a partir deste endpoint eles são gravados (`conhece_virbac`, `usa_produto_virbac`, `qual_produto_virbac`) e repassados (`cf_conhece_virbac`, `cf_usa_produto_virbac`, `cf_qual_produto_virbac`). O formulário da LP passa a enviá-los quando a LP migrar para este endpoint, na T16.

**O formato do payload do RD Station foi preservado**, tal como estava no relay: `POST https://api.rd.services/platform/conversions?api_key=…`, com `event_type: "CONVERSION"`, `event_family: "CDP"` e os campos personalizados prefixados por `cf_`. A forma confere com a documentação vigente da API de Conversões, mas **o método de autenticação e o `api_identifier` de cada campo `cf_*` continuam dependendo de como a conta da Virbac foi configurada** (risco R-08) — é pendência externa, não decisão deste projeto, e nada disso foi "melhorado" na migração.

**Filtros `from` e `to`** são dias no formato `AAAA-MM-DD`, **inclusivos nos dois extremos**: `from=2026-09-01&to=2026-09-03` traz também o lead enviado às 23h50 do dia 3. Data fora do formato, dia inexistente no calendário (`2026-02-31`) e período invertido respondem `422`.

**O dia é o de Brasília (UTC−3), não o de UTC.** O recorte é feito no fuso de quem opera o painel: um lead enviado às 23h de 2 de setembro entra no filtro do dia 2, ainda que o banco o guarde como 3 de setembro às 02h em UTC. `from=2026-09-02&to=2026-09-02` vira, para o banco, o intervalo `2026-09-02T03:00:00.000Z` a `2026-09-03T02:59:59.999Z`. O deslocamento é fixo em −03:00 porque o Brasil não observa horário de verão desde 2019; se voltar a observar, a mudança é em um lugar só (`apps/api/src/modules/leads/domain/brasilia-time.ts`), que é o mesmo módulo de onde a data do CSV sai.

**Paginação:** `page` a partir de 1 (padrão 1) e `pageSize` de 1 a 200 (padrão 50). Página além da última devolve lista vazia com o `total` correto, nunca erro.

**O CSV abre no Excel em português.** Três decisões, cada uma resolvendo um jeito específico de o arquivo chegar errado: **BOM UTF-8** no início (sem ele, "Comunicações" vira "ComunicaÃ§Ãµes" no Windows), **ponto e vírgula** como separador (na configuração regional pt-BR a vírgula é separador decimal, e com ela a planilha inteira cai numa coluna só) e fim de linha **CRLF**. A data sai como `02/09/2026 23:00:00`, em **horário de Brasília** — o mesmo fuso do filtro de período e o mesmo que a tela do painel mostra. Em UTC esse lead apareceria como 3 de setembro na planilha e como 2 de setembro na tela: um lead, duas datas. Uma célula que começaria por `=`, `+`, `-` ou `@` recebe um apóstrofo à frente: o conteúdo do lead é texto que um desconhecido digitou num formulário público, e sem isso a planilha executaria a célula como fórmula ao abrir o arquivo. A exportação é limitada a 10.000 linhas por chamada, porque o arquivo é montado em memória antes de ser enviado.

**As colunas do CSV são as da regra de negócio RN-01**, nesta ordem — uma por campo que o visitante preenche, mais as operacionais que acompanham o registro:

| # | Coluna | Conteúdo |
|---|---|---|
| 1 | `Data de envio (Brasília)` | Instante do envio, em horário de Brasília, como `02/09/2026 23:00:00` |
| 2 | `Nome` | Obrigatório no formulário |
| 3 | `E-mail` | Obrigatório no formulário |
| 4 | `Telefone` | Vazio quando não preenchido |
| 5 | `Nome do cachorro` | Vazio quando não preenchido |
| 6 | `Porte do cachorro` | `pequeno`, `medio` ou `grande` |
| 7 | `Cidade e estado` | Vazio quando não preenchido |
| 8 | `Conhece a Virbac` | Um dos três campos que o relay antigo descartava (R-01) |
| 9 | `Usa produto Virbac` | Idem |
| 10 | `Qual produto Virbac` | Idem |
| 11 | `Aceite de comunicações` | Opt-in de marketing: `sim` ou `não` |
| 12 | `Origem` | Origem declarada do envio |
| 13 | `Status RD Station` | `ok`, `falhou` ou `nao_enviado` |
| 14 | `Erro RD Station` | Vazio quando o repasse deu certo |

**Por que não existe coluna — nem registro — de aceite da Política de Privacidade.** O consentimento é **condição de envio**, não dado do lead: sem ele `POST /api/leads` recusa com `422` e nenhuma linha nasce. Guardá-lo significaria gravar a constante `true` em toda linha, e exportar uma coluna que só pode dizer "sim" — informação zero, que não prova nada que a existência da própria linha, somada à data de envio, já não prove. Por isso a tabela `leads` **não tem** a coluna `aceite_lgpd` (removida pela migração `20260903130000_drop_aceite_lgpd_from_leads.sql`) e o arquivo exportado não tem a coluna correspondente. A validação que **exige** o consentimento continua exatamente onde estava, coberta por teste de regressão: o que deixou de existir é apenas a gravação do resultado dela. Se um dia for preciso provar **a que texto** a pessoa consentiu — cenário real depois de a Política de Privacidade mudar —, o campo correto a criar é a versão do texto aceito, não um booleano que só pode ser verdadeiro (ver `agent_context/CHANGELOG.md`, 2026-09-02).

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
| `20260902130000_add_og_image_alt_to_site_metadata.sql` | Coluna `og_image_alt` em `site_metadata` (T7) |
| `20260903120000_allow_svg_in_images_bucket.sql` | Acrescenta `image/svg+xml` aos tipos aceitos do bucket de imagens (T9) |
| `20260903130000_drop_aceite_lgpd_from_leads.sql` | Remove a coluna `aceite_lgpd` de `leads` — o consentimento é condição de envio, não dado do registro (T18) |

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

Na **T7** a sétima migração (`og_image_alt`) foi aplicada ao projeto hospedado pelo mesmo caminho do pooler, e o `verify-isolation.mjs` rodado depois dela deu de novo **8 checagens, exit 0**. O fluxo de mídia foi exercitado inteiro contra o Supabase real, com a API rodando: credencial recusada sem token; `image/svg+xml` recusado com `422` e mensagem em português (tipo que a T9 passou a aceitar, ver abaixo); o vídeo `TutorabrindoPetiscoEcachorroComendo.mp4` (**23,6 MB**) enviado pelo protocolo retomável em 4 blocos de 6 MB, direto do cliente ao armazenamento, com a API vendo apenas nome, tipo e tamanho; registro criado só na confirmação, com o tamanho lido do arquivo; URL pública servindo os 24.741.168 bytes sem credencial nenhuma; `409` ao tentar remover a mídia usada por `demonstracao` e a usada em `metadata.ogImage`; `204` depois de soltar as referências, com o arquivo saindo também do armazenamento. Um segundo arquivo, de **45 MB**, subiu em 8 blocos pelo mesmo caminho. As quatro tabelas, os três buckets e a lista de operadores terminaram vazios.

Na **T9** a oitava migração (`allow_svg_in_images_bucket`) foi aplicada pelo mesmo caminho do pooler e o `verify-isolation.mjs` deu de novo **8 checagens, exit 0**, agora com o bucket de imagens reportando `tipos=6`. Em seguida a **carga inicial do conteúdo rodou contra o projeto hospedado**, com a API real: 17 mídias enviadas (15 imagens e 2 vídeos, incluindo o de 23,6 MB), 12 seções e os metadados gravados, `ingredientes` despublicada. O logo entrou como **SVG de 8.764 bytes** e é servido publicamente com `content-type: image/svg+xml`. `GET /api/content` devolveu 11 seções, sem nenhuma ocorrência de `PLACEHOLDER`, com as cinco perguntas prontas do FAQ nas posições 0, 2, 3, 4 e 6 — as posições 1 e 5 são as duas não publicadas, guardadas com o texto inteiro. **A migração foi rodada uma segunda vez e as contagens não se moveram:** 12 seções, 1 registro de metadados, 17 mídias, 15 + 2 + 0 objetos nos buckets, 40 itens de lista, e a resposta de `GET /api/content` com o mesmo hash antes e depois. O operador criado para a verificação foi removido (**0 usuários**), e o conteúdo **permanece no banco**: ele é a carga de que a T14 depende.

Na **T10** o painel foi exercitado num navegador de verdade contra o Supabase e a API reais, nas duas formas em que ele roda — servidor de desenvolvimento e build de produção servido pelo `preview` —, com **14 checagens em cada uma, todas OK**: rota interna sem sessão cai no login sem que a área administrativa chegue a existir no documento; e-mail inexistente e senha errada devolvem exatamente a mesma mensagem; o login válido abre o painel com o operador identificado no cabeçalho; `GET /api/admin/sections` com o token respondeu `200` com as 12 seções e, sem token, `401`; recarregar a página manteve a sessão; sair devolveu ao login, apagou a chave do armazenamento e a área administrativa não reapareceu. O operador de verificação foi criado pela Auth Admin API e removido ao final (**0 usuários**), e a carga da T9 ficou intacta: 12 seções, 17 mídias, 1 registro de metadados, 0 leads.

Na **T19** os ativos que passaram a ter campo no esquema foram migrados contra o projeto hospedado, pela **entrada única** (`CMS_API_URL=http://localhost:5173/api`): `media_assets` saiu de **17 para 24** — o `Kit-de-imagens.png` e as seis fotos do mosaico —, com 22 objetos no bucket de imagens e 2 no de vídeos, e as demais contagens intactas (12 seções, 1 registro de metadados, 0 leads). `GET /api/content` passou a devolver o kit como **URL pública** acompanhado do texto alternativo que o componente já escrevia, e as seis fotos do mosaico como URL pública **sem nenhum campo de descrição** — elas são decorativas no esquema, e o corpo da resposta reflete isso. As URLs foram buscadas sem credencial nenhuma: `200`, `image/png` de 2.043.014 bytes no kit e `image/jpeg` de 69.438 bytes na primeira foto. **A migração foi rodada mais duas vezes e nada se moveu:** 0 mídias enviadas, 24 reaproveitadas, as mesmas contagens, e as respostas de `GET /api/content` iguais campo a campo. Uma ressalva de medição, para não repetir a da T9: comparar o **hash** da resposta não serve como prova de idempotência aqui, porque a ordem das seções no corpo segue a ordem das linhas de uma consulta sem `ORDER BY` e varia entre execuções — a comparação válida é campo a campo, e é a que foi feita. O operador criado para a verificação foi removido (o único que restou é o do usuário), e a carga **permanece no banco**.

Na **T11** o formulário gerado foi exercitado num **navegador de verdade** (Chromium via Playwright), pela entrada única, contra a API e o Supabase reais, com **8 checagens, todas OK**: o painel abre no login; o login entra; a lista traz as **12 seções na ordem da página** (Cabeçalho → Abertura → Saúde oral → Rotina de cuidado → Produto → Demonstração em vídeo → Ingredientes → Prova de autoridade → Captura de lead → Onde comprar → Perguntas frequentes → Rodapé); a tela de "Perguntas frequentes" abriu preenchida com o conteúdo real, com os **7 itens** guardados (os 5 publicados e os 2 desligados); salvar mostrou a confirmação visível; **`GET /api/content` passou a devolver o texto novo**; e o console do navegador não acusou nenhum erro. O texto alterado (`faq.heading`) foi **devolvido ao valor original pelo próprio painel**, e o documento voltou intacto: os mesmos 7 itens, com `ordem` de 0 a 6 e a visibilidade de cada um preservada, `ingredientes` seguindo despublicada, e as contagens do banco onde estavam — **12 seções, 24 mídias, 1 registro de metadados, 0 leads**. O operador de verificação foi criado pela Auth Admin API e removido ao final; restou apenas o operador do usuário.

Na **T12** os campos de mídia foram exercitados num **navegador de verdade** (Chromium via Playwright), pela entrada única, contra a API e o Supabase reais, com **26 checagens, todas OK**. Uma **imagem real do projeto** (`virbac-kv-hero-antigo.jpg`, 240.041 bytes) foi enviada pelo campo da Abertura: a prévia apareceu **antes de salvar**, apontando para a URL pública do armazenamento; salvar fez a seção referenciar a mídia nova **por identificador**; `GET /api/content` passou a entregar a URL pública dela, que serviu os **240.041 bytes exatos, `image/jpeg`, sem credencial nenhuma**. Um **vídeo real do projeto** (`cachorroGanhadoPetisco.mp4`, 4.429.533 bytes) foi enviado pelo primeiro item da Demonstração, com **progresso visível** (0% → 42% → 100%), e o vídeo publicado **tocou no navegador** a partir da URL pública (duração 5,94 s, reprodução avançando até 1,46 s).

**Os bytes não passaram pela API, e isso foi medido, não deduzido.** As requisições foram lidas pelo CDP, que enxerga o `content-length` como o navegador o enviou. Durante o envio da imagem, o maior corpo enviado a `:5173/api` foi de **135 bytes**, enquanto o `PUT` para `…/storage/v1/object/upload/sign/…` levou os **240.041 bytes** do arquivo. Durante o envio do vídeo, o maior corpo à API foi de **137 bytes**, e o arquivo inteiro saiu por `…/storage/v1/upload/resumable/…`. Uma ressalva de medição, para quem repetir: `request.sizes().requestBodySize` do Playwright volta **0** para esses envios entre origens — medir por ele daria "0 bytes pela API" sem provar coisa alguma.

**Blocos de 6 MB, verificados pelo tamanho de cada requisição.** O vídeo de 4,2 MB cabe em um bloco só e sobe na própria criação do envio (`POST` de 4.429.533 B). Já `TutorabrindoPetiscoEcachorroComendo.mp4` (24.741.168 B) subiu em **quatro blocos** — `POST 6.291.456` + `PATCH 6.291.456` + `PATCH 6.291.456` + `PATCH 5.866.800`, somando exatamente o tamanho do arquivo — com o progresso passando por 0, 11, 23, 25, 36, 48, 51, 61, 73, 76, 87 e 100%.

**Recusa no painel, antes de qualquer chamada.** Um `application/pdf` foi recusado com *"Tipo de arquivo não suportado para imagem. Envie JPG, PNG, WebP, AVIF, GIF ou SVG."*; um PNG de 11 MB, com *"O arquivo tem 11 MB e o limite para imagem é 10 MB."* — e a contagem de requisições depois da escolha do arquivo foi **zero**, nem à API nem ao armazenamento.

**Um defeito real foi encontrado pela verificação em navegador, com toda a suíte verde.** A primeira versão do campo marcava "já pedi esta mídia" antes de a resposta chegar; sob `StrictMode`, que o painel usa, o efeito monta duas vezes, a segunda montagem via a marca e não pedia de novo, e a resposta da primeira era descartada pela limpeza — a prévia ficava presa em "Carregando o arquivo guardado…". O jsdom não monta em `StrictMode`, então nenhum teste acusava. A correção veio com um teste que monta como o painel monta, provado por mutação: reintroduzido o defeito, ele falha; corrigido, passa.

**Banco devolvido ao estado em que estava.** As duas seções tocadas (`hero` e `demonstracao`) foram restauradas e conferidas **campo a campo** contra o documento original; as três mídias criadas na verificação foram removidas pela própria API (`204` em cada uma). As contagens fecharam onde começaram: **12 seções, 24 mídias, 1 registro de metadados, 0 leads**, com 22 objetos no bucket de imagens, 2 no de vídeos e 0 no de legendas. O operador de verificação foi criado pela Auth Admin API e removido ao final; restou apenas o operador do usuário.

**A verificação foi completada na T14**, quando a LP passou a consumir `GET /api/content`: as imagens do CMS aparecem na página renderizada, conferidas em navegador real (ver "De onde a LP tira o conteúdo").

Na **T22** o campo de texto rico foi exercitado num **navegador de verdade** (Chromium via
Playwright), pela entrada única, contra a API e o Supabase reais. Na **página pública**, o
título da Prova de Autoridade voltou a quebrar em duas linhas no desktop (`br` com
`display: block` em 1440 px) e a exibir "médicos-veterinários," em **turquesa
`rgb(30, 143, 136)` com peso 800**; em 390 px a quebra fica escondida (`display: none`), o
título flui em uma linha e o texto lido é `A recomendação dos médicos-veterinários, em
números`, sem palavras coladas. Nenhuma tag proibida no `<h2>` e nenhum erro novo no console.

No **painel**, com um operador de verificação: o campo abriu com o texto já formatado (nunca
com marcação escrita por extenso); selecionar "números" e clicar em **Negrito** marcou o
trecho, salvar respondeu `200` e a página pública passou a exibir **dois** trechos em turquesa
extra-bold; desfazer o negrito e salvar devolveu o título ao valor pretendido. Também
verificados no editor: o botão **Quebra de linha** e a tecla **Enter** inserem `<br>` sem criar
parágrafo (o editor terminou com **1** parágrafo e 4 quebras), e um `<script>alert(1)</script>`
digitado pelo operador vira **texto literal**, nunca elemento. Nada disso foi salvo.

O único campo que mudou no banco foi o `heading` da Prova de Autoridade, que passou do texto
corrido para a mesma frase com marcação (`A recomendação dos<br><strong>médicos-veterinários,</strong> em números`)
— conferido campo a campo contra o documento anterior. As contagens ficaram onde estavam:
**12 seções, 24 mídias, 1 registro de metadados, 0 leads**; o operador de verificação foi
removido e restou apenas o do usuário. O instantâneo foi regenerado por `npm run instantaneo`
e saiu idêntico ao que já estava versionado.

A **prova por mutação** do que a D-02 promete foi feita no mesmo passo, e é reproduzível: com um campo `seloDeCampanha` acrescentado a `packages/content-schema/src/sections/hero.ts` — **e nenhuma linha do painel alterada** —, o rótulo declarado no esquema passou a aparecer no formulário da Abertura; removido o campo, ele desapareceu. O único arquivo alterado entre a falha e o acerto foi o do esquema.

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

> **Verificado de novo na T10**, agora pelo painel, num navegador de verdade e contra o
> Supabase e a API reais: o operador foi criado por esta mesma Auth Admin API, entrou pela
> tela de login do painel, e a chamada autenticada a `GET /api/admin/sections` respondeu
> `200`; a mesma chamada sem token respondeu `401`. O operador foi removido ao final, e o
> projeto voltou a **0 usuários**.

### Como o painel trata a sessão

- **Onde a sessão vive:** no armazenamento do navegador do operador, sob a chave
  `veggiedent-admin-auth` — própria do painel, para que a LP servida no mesmo domínio nunca
  a compartilhe. É isso que faz a sessão sobreviver a recarregar a página.
- **Renovação:** o token do Supabase é de vida curta e o painel o renova sozinho antes de
  expirar. Se o Supabase ficar indisponível, a renovação falha e o operador é deslogado —
  consequência aceita e declarada desde a T5, em que a API responde `401` quando não
  consegue consultar o JWKS.
- **Sair:** encerra a sessão no Supabase e apaga a chave do armazenamento. Se o servidor
  falhar ao invalidar o token, a sessão local é apagada do mesmo jeito — sair é sempre
  possível do lado do painel.
- **Credenciais recusadas:** a mensagem é uma só, `E-mail ou senha inválidos.`, para senha
  errada, e-mail inexistente e conta não confirmada. Separar esses casos diria a quem tenta
  se aquele e-mail está cadastrado. Falha de rede tem mensagem própria, porque ali ninguém
  chegou a julgar as credenciais.
- **Nenhuma tela é alcançável sem sessão.** Um endereço interno aberto sem sessão leva ao
  login, e o painel volta a ele depois que o operador entra.

### De onde a LP tira o conteúdo

A landing page **não tem mais texto nem imagem escritos em código**. Toda seção lê
`GET /api/content` — uma resposta só, com as seções publicadas e os metadados da página
(SDD § "Endpoints públicos"). O comando abaixo confirma que não sobrou nenhum arquivo de
conteúdo:

```bash
find apps/lp/src -name "*.content.ts"   # não retorna nada
```

Como isso está montado, em quatro peças pequenas dentro de `apps/lp/src/content/`:

| Arquivo | Papel |
|---|---|
| `published-content.ts` | Os tipos da resposta, derivados de `@veggiedent/content-schema`. A LP não redeclara a forma do conteúdo: um campo novo no esquema aparece aqui sozinho |
| `fetch-published-content.ts` | A leitura HTTP. Nunca lança: API fora do ar, `500` ou corpo ilegível viram todos `null`, porque os três têm o mesmo destino |
| `PublishedContentProvider.tsx` | O estado da página. Começa pelo instantâneo embutido e troca pelo conteúdo da API quando ela responde |
| `connect-section.tsx` | Liga um componente de seção à sua chave. Seção que a API não entrega (porque está despublicada) simplesmente não é renderizada — nem o título |

Cada seção virou um componente **apresentacional**, que recebe o documento pronto por
propriedade e não sabe de rede, de contexto nem de ausência. É o que permite montar a
página inteira em teste sem nenhum servidor.

O endereço é relativo (`/api/content`), porque LP e API compartilham domínio: `/` serve a
página e `/api/*` alcança a API, tanto na entrada única de desenvolvimento quanto em
produção. `VITE_CONTENT_ENDPOINT` troca o endereço quando for preciso apontar para outra
API.

**Campo de texto rico na página.** O título da Prova de Autoridade vem do CMS como HTML e é
desenhado por `components/ui/RichText.tsx`, que sanitiza e reconstrói o conteúdo em elementos
React — o trecho marcado em negrito recebe o destaque da seção, e a seção decide como a quebra
de linha é desenhada (no título da Prova de Autoridade, só a partir de `lg`). Ver **Texto rico:
o que o operador vê e o que o HTML pode ter**.

**Uma seção despublicada some da página.** É assim que a seção de Ingredientes fica fora do
ar hoje: nada de `isContentReady` no código, ela está despublicada no painel. Publicá-la é o
que a coloca na página.

### Instantâneo de conteúdo

O requisito do PRD é que **a indisponibilidade do CMS não derrube a página pública**. Quem
cumpre isso é o instantâneo (SDD § D-08): uma cópia do conteúdo publicado, versionada em
`apps/lp/src/content/content-snapshot.json` e embutida no build.

A página **renderiza a partir dele imediatamente**, sem esperar rede, e o substitui assim
que a busca responde. Se a busca não responder, nada acontece: o visitante continua vendo a
página inteira, com o conteúdo do último instantâneo, em vez de tela vazia ou quebrada.
Renderizar por ele primeiro também é o que permite ao navegador começar a baixar a imagem da
abertura no primeiro quadro, em vez de esperar uma ida à API.

**Como é gerado**, com a API no ar:

```bash
npm run instantaneo                      # lê http://localhost:5173/api/content
npm run instantaneo -- https://.../api/content   # ou de outro ambiente
```

O script recusa gravar uma resposta que não seja JSON, que não traga `sections` ou que venha
sem nenhuma seção publicada — um instantâneo vazio seria pior do que nenhum, porque a página
de reserva ficaria em branco em silêncio, e só quem abrisse o site durante uma queda
descobriria. Em qualquer recusa o arquivo anterior é mantido.

**Ele não é gerado durante o `npm run build`**, de propósito: o build precisa passar sem rede
(integração contínua, máquina de quem desenvolve), e o conteúdo de reserva precisa ser
revisável no diff de quem publica.

**Quando regenerar:** antes de publicar, depois de o conteúdo mudar no painel. O instantâneo
envelhece entre builds — é o custo aceito em D-08, e ele só aparece enquanto a API estiver
fora do ar. Um instantâneo velho não afeta a página quando a API responde: ela é sempre a
fonte, e o arquivo é só a reserva.

### O que continua importado em código, de propósito

Quatro imagens não passaram para o CMS, por decisão do usuário registrada em
`agent_context/CHANGELOG.md` (2026-09-03) — não é esquecimento:

| Onde | Arquivo | Por quê |
|---|---|---|
| Abertura | `hero/grupo-bandeiras.png` | Arte de campanha, junto do texto "A marca N.1 no Brasil, EUA e Europa" escrito no componente |
| Prova de autoridade | `prova-autoridade/01_formato_em_z.svg`, `02_halito_causas_digestivas.svg`, `03_origem_100_vegetal.svg` | São claims de produto, e o texto que os acompanha ("Formato em Z:" e afins) também vive em `ProductDifferentials.tsx`. Torná-los editáveis exigiria campos de imagem **e** de texto |

Tudo o mais que aparece na página — logos, foto da abertura, packshot, cards, passos da
rotina, kit de imagens, mosaico do formulário, logos dos parceiros, vídeos e miniaturas —
vem do CMS.

**O pôster do banner de vídeo deixou de existir como arquivo.** Ele era
`demonstracao/video-banner-poster.jpg`; hoje o banner usa o **primeiro vídeo da seção** como
plano de fundo e a **miniatura desse mesmo vídeo** como imagem de espera, que já é um campo
do esquema. Um ativo a menos, nenhum campo novo (decisão do usuário, 2026-09-03).

**Identificador do vídeo nos eventos de analytics.** O esquema não tem — nem deve ter — um
campo de identificador técnico. `video_start` e `video_progress` usam o **nome do arquivo**
enviado, que é o dado mais estável da seção: o título é texto editável e a posição na lista
é reordenável, e qualquer um dos dois quebraria a série histórica ao ser mexido no painel.
Os identificadores mudaram em relação aos que estavam escritos em código
(`tutor-abrindo-petisco` virou `tutorabrindopetiscoecachorrocomendo`).

### Migração inicial do conteúdo (histórico — ferramenta aposentada na T14)

O conteúdo da landing page nasceu em código: 12 arquivos `*.content.ts`, mais as imagens que
os componentes importavam direto e dois vídeos servidos de `apps/lp/public/videos/`. A T9 e a
T19 levaram tudo isso para o CMS **uma vez**, por um script que executava aqueles arquivos e
gravava o resultado pelos mesmos endpoints do painel (`apps/api/src/migration/`, `npm run
migrate:content -w apps/api`).

**A T14 aposentou o script junto com os arquivos que ele lia.** Sem os `*.content.ts` não há
o que migrar: o CMS passou a ser a fonte do conteúdo, e o instantâneo acima é o que preserva
uma cópia utilizável dele dentro do repositório. Foram removidos com ele o teste de cobertura
dos esquemas sobre os arquivos de conteúdo (`packages/content-schema/tests/content-coverage.test.ts`,
critério de "pronto" da T2) e a suíte de ponta a ponta da migração — todos exercitavam
arquivos que não existem mais. O histórico da execução continua registrado em "Estado
verificado" e em `agent_context/PLAN.md`.

O que a carga inicial produziu, e que segue valendo:

| Item | Estado no CMS |
|---|---|
| Seção **Ingredientes** | Não publicada, com o título já aprovado guardado |
| FAQ, *"A partir de que idade…"* | Item não publicado, com o texto guardado para o operador substituir |
| FAQ, *"Onde posso comprar Veggiedent?"* | Item não publicado, na posição em que o autor o deixou |
| `Footer.legalData` e `capturaLead.ebookTitle` | Ausentes do documento: a Virbac não entregou o dado, e campo sem valor real é omitido, nunca preenchido |
| **Kit de imagens** (prova de autoridade) | Campo de imagem informativa, com texto alternativo obrigatório |
| **Fotos do mosaico** (captura de lead) | Lista de 6 imagens **decorativas**: sem campo de descrição, exibidas com texto alternativo vazio e escondidas de leitores de tela, como a página sempre fez |

## Alterações, testes e validações

- **Estratégia de branch:** GitHub Flow. Branch por tarefa (`feat/T{n}-slug`), PR obrigatório para `main`, **revisão obrigatória antes do merge**. Commits em Conventional Commits. Sem `git push --force` em branch compartilhada. Política completa em [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Testes automatizados:** `npm run test` (todos os workspaces) ou `npm run test -w <workspace>`. O runner é o **Vitest** na LP, no painel e em `packages/`, e o **Jest** em `apps/api` — o padrão do NestJS, adotado na T4 porque o Vitest depende do esbuild, que não emite os metadados de decorador dos quais a injeção de dependência do Nest precisa. A LP roda em **jsdom com a Testing Library** desde a T14: `src/App.test.tsx` monta a página inteira e prende os dois caminhos do instantâneo — com `GET /api/content` fora do ar a página aparece com o conteúdo embutido, e com a API respondendo ela troca pelo que a API entregou.
- **Verificação de segurança do banco:** `node supabase/scripts/verify-isolation.mjs` (ver "Verificar o isolamento da superfície pública"). Não entra no `npm run test` porque precisa de um Supabase alcançável e de credenciais — é um passo de verificação de ambiente, não um teste unitário.
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

- **Processo de merge:** PR com revisão aprovada e critério de "pronto" da tarefa verificado (comando de teste/build rodado, não apenas relatado). Ver [`agent_context/PLAN.md`](agent_context/PLAN.md).
- **Publicação:** **[PENDENTE]** — documentar na T16 as rotas do domínio único (`/`, `/admin`, `/api/*`) e o procedimento de deploy de cada peça.
- **Logs e monitoramento:** **[PENDENTE]** — definir na T16. A disponibilidade da API precisa ser monitorada: é dela que depende o envio do formulário (risco R-02 do SDD).

## Manutenção

- **Adicionar um campo a uma seção:** edite um arquivo só — o esquema da seção em `packages/content-schema/src/sections/<secao>.ts`.

  1. Acrescente o campo ao array `fields` da seção, ou ao `itemFields` da lista quando o campo pertencer a um item (um card, um passo, um parceiro, uma pergunta). Um campo é `{ name, type, label, help, required }`: `label` e `help` são o que o operador lê no painel, em português — `help` diz onde o campo aparece na página, e é opcional só na forma, não na prática. Tipos disponíveis: `texto-curto`, `texto-longo`, `lista-de-textos`, `imagem`, `video`, `legenda`, `link`, `booleano`.
  2. Se o campo for uma imagem, não o declare à mão — use um dos construtores de `src/fields.ts`, e escolha entre os dois tratamentos de acessibilidade que o esquema admite:

     - **Imagem informativa** — `requiredImage({ ... })` ou `optionalImage({ ... })`. Emitem a imagem **e** o campo de texto alternativo obrigatório adjacente de uma vez. É o caso da maioria: a descrição é o que o leitor de tela anuncia no lugar da imagem.
     - **Imagem decorativa** — `decorativeImage({ ... })`. Emite só a imagem, sem campo de descrição, porque não há o que descrever: ela entra na página com texto alternativo vazio e escondida do leitor de tela. Descrever uma imagem decorativa é **pior** do que não descrevê-la — injeta ruído sem acrescentar significado. É o caso das fotos do mosaico do formulário.

     Um campo de imagem que não faz essa escolha é recusado pela invariante do esquema (`checkSchemaInvariants`), com o teste de `tests/invariants.test.ts` acusando exatamente qual imagem ficou sem declarar. Não existe caminho de "campo em branco por descuido": ou a imagem é descrita, ou é declarada decorativa.
  3. Preencha o campo novo no documento de exemplo da seção, em `packages/content-schema/tests/fixtures.ts`. Este é o único passo manual obrigatório: os documentos de exemplo são tipados pelos tipos derivados do esquema, então um campo obrigatório sem valor ali reprova `npm run typecheck`.
  4. Rode `npm run test -w packages/content-schema` e `npm run typecheck`.

  Acompanham sozinhos, sem nenhuma outra alteração de código: o tipo TypeScript do documento (`SectionDocumentOf<'secao'>` é calculado a partir do mesmo array de campos), a validação aplicada pela API (o validador Zod é construído do esquema em `src/zod.ts`) e o formulário do painel, gerado a partir do esquema (T11).

  Fora do pacote, duas coisas continuam sendo trabalho manual: a LP só exibe o campo quando o componente da seção passar a renderizá-lo; e um campo **obrigatório** acrescentado depois da migração inicial (T9) invalida os documentos já gravados até que alguém preencha o valor pelo painel — para evitar isso, crie-o com `required: false`, preencha o conteúdo e só então torne-o obrigatório.

- **Excluir um lead a pedido do titular (LGPD):** a exclusão é **definitiva e não tem desfazer** — é isso que o titular está pedindo.

  **Pelo painel, que é o caminho normal:**

  1. **Registre o pedido** antes de apagar: quem pediu, por qual canal e quando. Depois da exclusão não sobra no banco nada que ligue o pedido ao registro apagado — só o log do servidor, que guarda o identificador do lead e o do operador que executou.
  2. Abra **Leads recebidos** no painel. Se souber a data do envio, use o filtro por período para encurtar a lista; o dia é o de Brasília.
  3. **Se o titular quiser uma cópia dos próprios dados antes**, use `Exportar CSV do período` e recorte a linha dele.
  4. Na linha do titular, clique em **Excluir o lead de \<nome\>**. Nada é apagado neste clique: a linha passa a perguntar *"Excluir para sempre? Não há desfazer."*.
  5. Confirme em **Confirmar a exclusão do lead de \<nome\>**. A linha some da lista e a tela confirma com *"Lead excluído definitivamente."*.
  6. **Um mesmo titular pode ter mais de um envio.** O pedido alcança **todos** eles: repita para cada linha com aquele e-mail, e confira a lista depois.
  7. **O RD Station é um sistema separado** — ver o item 6 do procedimento por API, abaixo.

  **Pela API**, quando for preciso fazer em lote ou sem abrir o painel:

  1. **Registre o pedido**, como acima.
  2. **Encontre o lead pelo e-mail do titular**, com um token de operador válido:

     ```bash
     curl -s "$API_BASE_URL/api/admin/leads?from=2026-01-01&to=2026-12-31" \
       -H "authorization: Bearer $TOKEN_DO_OPERADOR" | jq '.leads[] | select(.email == "titular@exemplo.com") | {id, email, createdAt}'
     ```

     Um mesmo titular pode ter mais de um envio; o pedido de exclusão alcança **todos** eles.
  3. **Se ele quiser uma cópia dos próprios dados antes**, exporte o período com `GET /api/admin/leads/export` e recorte a linha dele — a exportação já sai em CSV legível.
  4. **Apague cada identificador encontrado:**

     ```bash
     curl -s -o /dev/null -w '%{http_code}\n' -X DELETE \
       "$API_BASE_URL/api/admin/leads/<id-do-lead>" \
       -H "authorization: Bearer $TOKEN_DO_OPERADOR"
     ```

     `204` significa apagado. `404` significa que aquele identificador não existe (ou já foi apagado) — não é erro a insistir.
  5. **Confirme** repetindo a busca do passo 2: nenhum lead com aquele e-mail deve restar.
  6. **O RD Station é um sistema separado.** Apagar o lead aqui não apaga o contato lá. Se o lead chegou a ser repassado (`rdstationStatus: "ok"` na listagem, ou a coluna "Status RD Station" no CSV), o pedido do titular precisa ser encaminhado também ao RD Station, pela conta da Virbac. Um lead com status `falhou` ou `nao_enviado` nunca chegou lá.

  Nunca apague um lead direto no banco pelo painel do Supabase: os dois caminhos acima passam pela API, que registra a exclusão no log do servidor com o identificador do lead e o do operador — e é esse registro que sustenta a resposta ao titular caso o pedido seja questionado depois. O painel do Supabase apaga sem deixar rastro nenhum.
- **Limpeza de arquivos órfãos no armazenamento:** um upload interrompido entre o passo 2 e o passo 3 do envio de mídia deixa um arquivo no bucket sem linha correspondente em `media_assets` (risco R-04 do SDD). O arquivo é **inerte** — nenhum documento de seção o referencia, porque referência é sempre por identificador de mídia, e identificador só existe depois da confirmação — mas ocupa espaço e é o único resíduo previsto do fluxo.

  A conciliação é uma diferença entre duas listas, e a coluna `storage_path` foi guardada qualificada pelo bucket (`veggiedent-videos/<uuid>/<arquivo>`) justamente para que ela seja direta:

  ```bash
  # 1. o que está registrado (com a chave secreta, do lado do servidor)
  curl -s "$SUPABASE_URL/rest/v1/media_assets?select=storage_path" \
    -H "apikey: $SUPABASE_SECRET_KEY" -H "authorization: Bearer $SUPABASE_SECRET_KEY"

  # 2. o que está em cada bucket
  for b in veggiedent-images veggiedent-videos veggiedent-captions; do
    curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/$b" \
      -H "apikey: $SUPABASE_SECRET_KEY" -H "authorization: Bearer $SUPABASE_SECRET_KEY" \
      -H 'content-type: application/json' -d '{"prefix":"","limit":1000}'
  done

  # 3. apagar um arquivo que está no bucket e não está na lista de registrados
  curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/<bucket>/<caminho>" \
    -H "apikey: $SUPABASE_SECRET_KEY" -H "authorization: Bearer $SUPABASE_SECRET_KEY"
  ```

  Cadência sugerida: mensal, ou depois de uma sessão de edição em que algum upload de vídeo tenha falhado. **Só apague o que estiver no bucket e não estiver na lista de registrados** — o caminho inverso (registro sem arquivo) não é órfão, é defeito, e apagar o registro esconderia o problema em vez de resolvê-lo. Um upload retomável abandonado antes do primeiro bloco não chega a virar arquivo; o Supabase descarta sozinho essas partes incompletas.

## Pendências herdadas do projeto atual

Itens que já eram pendência antes do CMS e continuam abertos:

- **Imagem de compartilhamento social (`og:image`)** ainda não aprovada pela Virbac. Passa a ser editável pelo painel quando chegar. A migração inicial **não** a inventa: `index.html` declara a pendência num comentário e o campo fica vazio no CMS.
- **Legendas dos vídeos (`.vtt`)** nunca existiram como arquivo. O campo é opcional no esquema e está vazio; a LP só declara a faixa de legenda quando há arquivo cadastrado, então o navegador simplesmente não oferece legenda — o mesmo que a página fazia antes. Enviar um `.vtt` pelo painel passa a oferecê-la, sem mudança de código.
- **Dados legais da Virbac Brasil** (CNPJ e afins) pendentes no rodapé.
- **Conteúdo da seção Ingredientes** e a **faixa etária recomendada** no FAQ aguardam material técnico da Virbac; migrados como não publicados.
- **Imagens que ficam em código, por decisão.** A T2 escopou os esquemas nos 12 `*.content.ts`, e as imagens que os componentes importam direto ficaram fora. O usuário decidiu ponto a ponto em 2026-09-03 (ver `agent_context/CHANGELOG.md`): o `Kit-de-imagens.png` e as seis fotos do mosaico do formulário **passaram ao CMS** na T19; o `grupo-bandeiras.png` do herói e os três infográficos SVG de `ProductDifferentials.tsx` **permanecem em código** — os infográficos trazem junto um copy também escrito no componente, e os quatro são claims e arte de campanha sob controle de quem edita o código. O pôster do banner de vídeo deixou de ser imagem própria na T14 e passou a derivar da miniatura do primeiro vídeo da seção; o arquivo saiu do repositório. Ver "O que continua importado em código, de propósito".
- **Payload do RD Station** marcado no código atual como "confirmar antes do go-live": método de autenticação e nomes dos campos personalizados dependem de como a conta da Virbac foi configurada (risco R-08 do SDD). A T8 migrou o payload para `apps/api/src/modules/leads/infrastructure/rdstation-lead.relay.ts` **sem alterá-lo**, e a pendência continua exatamente onde estava — com a diferença de que, enquanto ela não for resolvida, o lead já não se perde: fica gravado com `rdstation_status = "nao_enviado"`.
