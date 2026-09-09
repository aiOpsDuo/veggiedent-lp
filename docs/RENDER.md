# Publicar no Render

A pilha inteira num serviço só, numa origem só:

| Caminho | Serve |
|---|---|
| `https://<nome>.onrender.com/` | LP (`apps/lp`) |
| `https://<nome>.onrender.com/admin` | painel (`apps/admin`) |
| `https://<nome>.onrender.com/api/*` | API (`apps/api`) |

O painel em `/admin` é requisito do produto, e é ele que dita o desenho: painel
e LP têm de dividir a mesma origem.

## Por que não a mesma pilha do `docker-compose.yml`

Localmente são dois contêineres — a API e um nginx que une os caminhos
(`docker/nginx.conf`). No Render um serviço é **um processo com uma porta**.

Duas saídas eram possíveis:

1. **Dois serviços**, um com o nginx encaminhando para o outro. Dá o endereço
   certo, ao custo de uma peça a mais para pagar e para cair.
2. **Um serviço**, com a própria API servindo os dois `dist`. É a escolhida.

Um serviço estático + um serviço web *não* resolve: seriam dois endereços, e o
painel deixaria de estar em `<url>/admin`.

Então quem faz o papel do nginx é
[`apps/api/src/shared/presentation/static-sites.ts`](../apps/api/src/shared/presentation/static-sites.ts)
— o mesmo mapa de caminhos, escrito em middleware, com o mesmo cuidado com
barra final em `/admin` e com cache imutável só para arquivo com hash no nome.

Nada disso muda o desenvolvimento local: `docker compose up` e `npm run dev`
continuam iguais, com nginx e Vite servindo os front-ends.

## Publicar

1. No painel do Render: **New > Blueprint**, aponte para este repositório.
   Ele lê [`render.yaml`](../render.yaml) da raiz.
2. O Render pede os valores das variáveis marcadas com `sync: false`. São as
   mesmas do `.env.example`:

   | Variável | Onde encontrar |
   |---|---|
   | `SUPABASE_URL` | Supabase > Project Settings > Data API |
   | `SUPABASE_SECRET_KEY` | Supabase > API Keys — `sb_secret_...` |
   | `SUPABASE_JWKS_URL` | `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` |
   | `VITE_SUPABASE_URL` | o mesmo valor de `SUPABASE_URL` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase > API Keys — `sb_publishable_...` |

   `ALLOWED_ORIGINS` não é pedida: ela se resolve a partir do próprio serviço
   (`fromService`), porque de outro modo seria preciso conhecer a URL antes do
   primeiro deploy para poder fazer o primeiro deploy.

3. Aplique e verifique, na ordem — é a ordem em que as falhas aparecem:

   ```bash
   curl -i https://<nome>.onrender.com/api/health   # {"status":"ok"}
   curl -I https://<nome>.onrender.com/             # 200, text/html
   curl -I https://<nome>.onrender.com/admin        # 301 -> /admin/
   curl -I https://<nome>.onrender.com/admin/       # 200, text/html
   ```

   E no navegador: `/admin/` deve pedir login, e o login deve levar ao painel.

## Serviço criado à mão: o que ajustar no painel

Um serviço criado pelo painel **não passa a seguir o `render.yaml` sozinho** —
o blueprint só governa os serviços que ele mesmo criou. O serviço `veggiedent`
(`srv-dagnnjbl550s73cce8eg`) é um desses, e é por isso que o primeiro deploy
falhou: ele rodou o build padrão do Render.

O que precisa mudar, em **Settings** e **Environment**:

| Onde | Campo | Estava | Precisa ser |
|---|---|---|---|
| Settings > Build | Build Command | `npm install && npm run build` | `npm ci --include=dev && npm run build -w apps/lp && npm run build -w apps/admin && npm run build -w apps/api` |
| Settings > Health Checks | Health Check Path | *(vazio)* | `/api/health` |
| Environment | `NODE_VERSION` | *(ausente)* | `24` |

O que **não** precisa mudar:

- **Start Command** (`npm run start -w apps/api`) funciona: o `start` da API é
  `node dist/main.js`, e `static-sites.ts` acha os `dist` a partir de
  `__dirname`, não do diretório de trabalho. `node apps/api/dist/main.js` — o
  que o `render.yaml` declara — é preferível só por não ter o npm no meio para
  engolir o `SIGTERM` que o Render manda ao reimplantar.
- **Root Directory** vazio, **Region** Oregon e **Branch** `deploy-homolg` já
  estão certos.
- As variáveis de servidor e as `VITE_*` já estão lá. Confirme só que
  `VITE_API_BASE_URL` é `/api` — com origem única é o valor certo, e um valor
  absoluto ali funciona por acidente, não por desenho.

Vale saber: **Auto-Deploy está `Off`**. Depois de subir o commit, o deploy sai
por *Manual Deploy*.

## Duas armadilhas que já custaram um deploy

### `NODE_ENV=production` faz o build morrer no `tsc`

Sintoma:

```
error TS2688: Cannot find type definition file for '@testing-library/jest-dom'.
error TS2688: Cannot find type definition file for 'vitest/globals'.
npm error command sh -c tsc --noEmit && vite build
```

Causa: **o npm trata `NODE_ENV=production` como `--omit=dev`**, e no Render as
variáveis de ambiente do serviço valem também durante o build. Mas construir
estas aplicações exige as dependências de desenvolvimento, por definição:
`vite`, `typescript`, `tailwindcss`, `vitest` e `@testing-library/jest-dom` são
todas devDependencies, e o `build` da LP e do painel é
`tsc --noEmit && vite build`.

Correção: o `buildCommand` começa com `npm ci --include=dev`, que sobrepõe a
omissão. O `--include=dev` **não** é redundante — sem ele o build falha, e o
`NODE_ENV=production` continua necessário em execução, porque é ele que mantém
a documentação da API fora do ar (`shouldExposeApiDocs`).

### `engines.node` não basta para escolher a versão do Node

`@supabase/supabase-js` (fixado em `^2.114`) deixou de suportar Node 20 na
versão 2.110.0: `realtime-js` exige o WebSocket nativo que só existe a partir do
Node 22. Com Node 20 a API sobe, inicializa os módulos e morre em
`createSupabaseClient` com `Node.js detected but native WebSocket not found` —
em laço de reinício, sem nunca ficar saudável.

O `engines.node` da raiz dizia `>=20`, o que permitia exatamente a versão que
não funciona; agora diz `>=22`. Ainda assim o `render.yaml` fixa
`NODE_VERSION=24` explicitamente: é a versão do `docker/Dockerfile`, e a versão
em que o projeto é verificado. Não deixe a escolha para o padrão do Render.

## Node nativo ou Docker

O `render.yaml` usa `runtime: node`: o Render instala, constrói e roda o
processo direto. É o caminho mais curto e o de build mais rápido.

Existe também [`docker/Dockerfile.render`](../docker/Dockerfile.render), que
produz a mesma coisa numa imagem — Node fixado em 24, e a imagem final só com
as dependências de execução. Para usá-lo, troque no `render.yaml`:

```yaml
    runtime: docker
    dockerfilePath: ./docker/Dockerfile.render
    dockerContext: .
    # e remova buildCommand, startCommand e NODE_VERSION
```

É um arquivo próprio, e não um alvo a mais em `docker/Dockerfile`, porque no
Render se constrói sempre o **último** estágio: o `render.yaml` tem
`dockerfilePath` e `dockerContext`, e nada de `--target`. Um alvo `render` no
fim daquele Dockerfile funcionaria hoje e quebraria calado no dia em que alguém
acrescentasse um estágio depois dele.

A armadilha do `NODE_ENV` não atinge o caminho Docker: o Render traduz variável
de ambiente em **argumento de build**, e argumento de build sem `ARG`
correspondente no Dockerfile não tem efeito nenhum. Como
`docker/Dockerfile.render` declara `ARG` só para as `VITE_*`, o
`NODE_ENV=production` não alcança o `npm ci` dos estágios de dependências.

## O que muda em relação ao `.env.example`

Duas variáveis do compose não existem aqui:

- **`PORTA_PROXY`** — não há proxy. O Render injeta `PORT` e o processo escuta
  nela (`environmentSchema` a lê, e `main.ts` escuta em `0.0.0.0`; em
  `localhost` o Render não acharia porta aberta nenhuma).
- **`VITE_API_BASE_URL` e as outras rotas `VITE_*`** — os padrões relativos
  (`/api`, `/api/content`, `/api/leads`) já valem, porque a origem é única.

## Segredos

No caminho Docker, o Render traduz variável de ambiente do serviço em argumento
de build. Por isso `docker/Dockerfile.render` declara `ARG` só para as `VITE_*`,
que são públicas por definição — o Vite as escreve no arquivo servido ao
navegador. `SUPABASE_SECRET_KEY` não tem `ARG` de propósito: sem ele o valor não
alcança camada de imagem nenhuma e só existe em execução.

## Limitações conhecidas desta configuração

- **A LP sai do Node, não de uma CDN.** O `README` descreve a LP servida
  estaticamente por CDN; aqui ela vem do mesmo processo da API. Para
  homologação é indiferente; para produção com tráfego real, o caminho é pôr
  uma CDN na frente do serviço, e não voltar a separar os endereços.
- **`ALLOWED_ORIGINS` é validada mas não aplicada.** A API nunca chama
  `enableCors`. Não é problema nesta configuração — com origem única não existe
  requisição entre origens —, mas continuará sem efeito se algum dia o painel
  passar a viver em outro endereço.
- **No `runtime: node`, as devDependencies ficam instaladas em execução.** É o
  preço de construir e rodar no mesmo lugar; custa disco, não comportamento. O
  caminho Docker não tem isso: a imagem final parte de um `npm ci --omit=dev`.
- **`plan: free` hiberna.** Depois de 15 min sem tráfego o serviço dorme, e a
  visita seguinte espera o processo subir — perto de um minuto. Para quem vai
  validar conteúdo no painel isso incomoda; `starter` não hiberna, e a troca é
  uma linha no `render.yaml`.
