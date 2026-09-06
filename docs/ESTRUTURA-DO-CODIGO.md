# Estrutura do código

Como o repositório e cada aplicação estão organizados, o que vai para o navegador e onde as credenciais podem e não podem aparecer. O padrão arquitetural e as decisões que levaram a ele estão em [`../agent_context/SDD.md`](../agent_context/SDD.md).

O repositório é um monorepo de workspaces npm. `agent_context/` e `README.md` ficam na raiz porque cobrem o produto inteiro (SDD § "Estrutura de pastas do repositório"):

```
/
├── apps/
│   ├── lp/                 # landing page (React + Vite + Tailwind)
│   ├── admin/              # painel (React + Vite + Tailwind), servido sob /admin
│   └── api/                # API NestJS — módulos por domínio, quatro camadas em cada
├── packages/
│   └── content-schema/     # esquemas de seção — esqueleto, preenchido na T2
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
        └── infrastructure/ # adaptadores: Supabase e Storage
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
│   ├── SectionsScreen.tsx    # a lista das 9 seções, na ordem da página
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

**Serviço externo:** Supabase (banco Postgres, armazenamento de arquivos e autenticação) — o único. O RD Station Marketing foi **descontinuado em 2026-09-03**; o lead não tem destino externo.

**Ponto de atenção de segurança:** a chave secreta do Supabase vive exclusivamente no ambiente de `apps/api`. Nenhuma credencial pode entrar em um build de navegador — variáveis lidas pelo Vite (`VITE_*`) são públicas por natureza.
