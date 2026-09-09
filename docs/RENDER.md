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
(`docker/nginx.conf`). No Render um serviço é **um contêiner com uma porta**, e
não há como pedir um alvo de build (`--target`): o `render.yaml` tem
`dockerfilePath` e `dockerContext`, e nada de alvo.

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
A imagem é [`docker/Dockerfile.render`](../docker/Dockerfile.render), um arquivo
próprio justamente porque no Render se constrói sempre o último estágio: um alvo
a mais no `docker/Dockerfile` funcionaria hoje e quebraria calado no dia em que
alguém acrescentasse um estágio depois dele.

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

3. Aplique. O primeiro build é longo (instala o monorepo e constrói as três
   peças); os seguintes reaproveitam a camada de dependências e só refazem os
   builds, desde que nenhum `package.json` tenha mudado.

4. Verifique, na ordem — é a ordem em que as falhas aparecem:

   ```bash
   curl -i https://<nome>.onrender.com/api/health   # {"status":"ok"}
   curl -I https://<nome>.onrender.com/             # 200, text/html
   curl -I https://<nome>.onrender.com/admin        # 301 -> /admin/
   curl -I https://<nome>.onrender.com/admin/       # 200, text/html
   ```

   E no navegador: `/admin/` deve pedir login, e o login deve levar ao painel.

## O que muda em relação ao `.env.example`

Duas variáveis do compose não existem aqui:

- **`PORTA_PROXY`** — não há proxy. O Render injeta `PORT` e o processo escuta
  nela (`environmentSchema` a lê, e `main.ts` escuta em `0.0.0.0`; em
  `localhost` o Render não acharia porta aberta nenhuma).
- **`VITE_API_BASE_URL` e as outras rotas `VITE_*`** — os padrões relativos
  (`/api`, `/api/content`, `/api/leads`) já valem, porque a origem é única.

## Segredos

O Render traduz variável de ambiente do serviço em **argumento de build**. Por
isso `docker/Dockerfile.render` declara `ARG` só para as `VITE_*`, que são
públicas por definição — o Vite as escreve no arquivo servido ao navegador.
`SUPABASE_SECRET_KEY` não tem `ARG` de propósito: sem ele o valor não alcança
camada de imagem nenhuma e só existe em execução.

## Limitações conhecidas desta configuração

- **A LP sai do Node, não de uma CDN.** O `README` descreve a LP servida
  estaticamente por CDN; aqui ela vem do mesmo processo da API. Para
  homologação é indiferente; para produção com tráfego real, o caminho é pôr
  uma CDN na frente do serviço, e não voltar a separar os endereços.
- **`ALLOWED_ORIGINS` é validada mas não aplicada.** A API nunca chama
  `enableCors`. Não é problema nesta configuração — com origem única não existe
  requisição entre origens —, mas continuará sem efeito se algum dia o painel
  passar a viver em outro endereço.
- **`plan: starter`, não `free`.** No `free` o serviço hiberna depois de 15 min
  sem tráfego e a visita seguinte espera o contêiner subir. Trocar é uma linha
  no `render.yaml`.
