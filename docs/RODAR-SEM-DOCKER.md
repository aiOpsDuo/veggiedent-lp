# Rodar sem Docker

O caminho documentado no [`README.md`](../README.md) é o Docker, em
[`DOCKER.md`](DOCKER.md). Este arquivo existe para quem precisa de recarga
automática ao editar, ou depurar um processo isolado — coisas que a pilha
Docker, pensada para homologar o produto já construído, não oferece.

## O comando

```bash
git clone <repositorio> && cd veggiedent-lp
npm install
cp apps/lp/.env.example apps/lp/.env        # opcional: todas as variáveis têm default
cp apps/api/.env.example apps/api/.env      # e preencha as variáveis obrigatórias
cp apps/admin/.env.example apps/admin/.env  # e preencha as duas variáveis do Supabase
npm run dev
```

Tudo responde em **http://localhost:5173**, com o mesmo mapa de caminhos que o
domínio único usa em produção: `/` serve a LP, `/admin` serve o painel e
`/api/*` alcança a API. A recarga automática vale nos dois front-ends.

## Outros comandos da raiz

```bash
npm run build        # build de todos os workspaces; gera apps/lp/dist/ e apps/admin/dist/
npm run typecheck     # checagem de tipos de todos os workspaces
npm run test          # testes de todos os workspaces
npm run preview        # serve o build da LP em http://localhost:4173
npm run instantaneo   # regenera o instantâneo de conteúdo da LP (ver CONTEUDO-DA-LP.md)
```

Para um workspace só, use `-w`: `npm run build -w apps/lp`, `npm run test -w packages/content-schema`.

## Rodar uma aplicação isolada

Serve para depurar uma delas — **não é a forma de acessar o projeto**, essa é
sempre a entrada única acima:

```bash
npm run start:dev -w apps/api       # API sozinha, com recarga automática
npm run start -w apps/api           # roda o build já gerado (exige npm run build -w apps/api antes)
npm run dev -w apps/admin           # painel sozinho
npm run build -w apps/admin         # gera apps/admin/dist/, com os assets sob /admin/
npm run preview -w apps/admin       # serve o build do painel em http://localhost:4174/admin/
npm run test -w apps/admin          # testes do painel (Vitest + Testing Library, em jsdom)
npm run migrate:content -w apps/api # popula um CMS vazio a partir do instantâneo (ver CONTEUDO-DA-LP.md)
```

Requer Node 20 ou superior.

## Portas internas

As individuais são detalhe interno — servem para depurar um processo isolado,
não para o dia a dia:

| Processo | Porta interna | Observação |
|---|---|---|
| LP (servidor de desenvolvimento) | 5173 | é a própria entrada única; encaminha `/admin` e `/api` |
| Painel | 5174 | escuta só em `localhost`; abrir `http://localhost:5174/` devolve a mensagem de base incorreta do Vite — o painel está em `/admin/` |
| API | 3000 | mude com `PORT` no `.env`; todas as rotas ficam sob o prefixo `/api` |

Como o encaminhamento vive no servidor de desenvolvimento da LP, subir só a LP
(`npm run dev -w apps/lp`) deixa `/admin` e `/api` respondendo `500` (erro de
proxy) até que os outros dois processos existam. `npm run dev` na raiz sobe os
três e derruba os três juntos.

## Verificações rápidas

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/          # -> 200 (LP)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:5173/admin   # -> 302 .../admin/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/admin/    # -> 200 (painel)
curl -s http://localhost:5173/api/health                                 # -> {"status":"ok"}
```

Para conferir os builds de produção, que não passam pela entrada única:
`npm run build && npm run preview` serve a LP em http://localhost:4173, e
`npm run build -w apps/admin && npm run preview -w apps/admin` serve o painel
em http://localhost:4174/admin/.

## Variáveis de ambiente

Modeladas em [`../apps/api/.env.example`](../apps/api/.env.example),
[`../apps/admin/.env.example`](../apps/admin/.env.example) e
[`../apps/lp/.env.example`](../apps/lp/.env.example). A tabela de cada
variável, o que é obrigatório e por quê, está em
[OPERACAO.md](OPERACAO.md#variáveis-de-ambiente) — não duplicado aqui.

Este é um `.env` **por aplicação**; não confundir com o `.env` único que o
Docker lê na raiz (ver [DOCKER.md](DOCKER.md#variáveis-de-ambiente)) — os dois
não se sobrepõem, e um não substitui o outro.
