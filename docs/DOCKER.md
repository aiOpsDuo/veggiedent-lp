# Subir tudo com um comando (Docker + porta única)

As três aplicações atrás de um proxy reverso, numa **porta única**, com o mesmo
mapa de caminhos que o domínio único de produção usa:

| Caminho | Serve |
|---|---|
| `/` | a LP estática |
| `/admin` e `/admin/` | o painel estático, construído com `base: '/admin/'` |
| `/api/*` | a API NestJS |

Isso existe por um motivo específico: o roteamento é a parte que o usuário
enxerga e a que mais facilmente quebra, e neste projeto já custou um defeito
real (`/admin` sem barra final devolvendo 404, encontrado na T10 com a suíte
inteira verde). Servindo aqui o mesmo mapa da publicação, quem for publicar
**repete um desenho já exercitado em vez de desenhá-lo do zero**.

Por trás dessas três aplicações, a pilha sobe também a plataforma de dados
própria do CMS (SDD § "Camadas e padrão arquitetural", T5 — MySQL 8 + MinIO,
auto-hospedados desde 2026-09-21, no lugar do Supabase): os serviços `mysql` e
`minio`, descritos em "[Serviços de dados: mysql e minio](#serviços-de-dados-mysql-e-minio)"
abaixo.

**Este é o caminho documentado no [README.md](../README.md)** para rodar o
projeto — um comando, uma porta, sem instalar dependência nenhuma no
hospedeiro além do Docker. Para editar com recarga automática ou depurar um
processo isolado, sem Docker, veja [RODAR-SEM-DOCKER.md](RODAR-SEM-DOCKER.md);
os dois convivem sem conflito de porta (ver "Derrubar", ao final).

## Serviços de dados: mysql e minio

Dois serviços novos ficam por trás da `api`, nunca alcançáveis diretamente do
hospedeiro — mesmo isolamento de rede já aplicado à própria API (só `expose`,
nunca `ports`; ver "O que quem for publicar precisa saber", item 1):

| Serviço | Imagem | Porta interna | Função |
|---|---|---|---|
| `mysql` | `mysql:8` | `3306` | Banco relacional. A API conecta com o usuário de aplicação (`MYSQL_USER`), nunca com o `root` |
| `minio` | `quay.io/minio/minio` | `9000` (API S3) e `9001` (console administrativo) | Armazenamento de imagens e vídeos, compatível com S3 |

Cada um tem healthcheck próprio (`mysqladmin ping` para o `mysql`, `mc ready
local` para o `minio`), no mesmo padrão já usado por `api`/`proxy`, e a `api`
só inicia depois que os dois respondem saudáveis (`depends_on: condition:
service_healthy`).

**Persistência entre `down`/`up`.** Cada serviço grava num volume nomeado
próprio — `mysql_data:/var/lib/mysql` e `minio_data:/data`. Um
`docker compose down` seguido de `docker compose up -d` preserva os dados: o
MySQL não reinicializa o banco (não aparece "Initializing database" no log, só
o log de start normal) e os arquivos do MinIO continuam no bucket. Os dados só
são apagados com `docker compose down -v` (a flag `-v` remove os volumes
nomeados) — use isso deliberadamente para começar de um ambiente limpo, nunca
por engano num ambiente com conteúdo de verdade.

## O comando

```bash
cp .env.example .env     # e preencha (só na primeira vez)
docker compose up --build -d
```

Tudo responde em **http://localhost:8080**. Para acompanhar os logs,
`docker compose logs -f`; para derrubar, `docker compose down`.

O `--build` pode ser omitido depois da primeira vez, mas veja
"[Quando é preciso reconstruir](#quando-é-preciso-reconstruir)" antes de omiti-lo:
as variáveis do navegador entram na imagem em tempo de build.

## Variáveis de ambiente

O compose lê **um `.env` na raiz do repositório**, modelado em
[`.env.example`](../.env.example). Ele é gitignorado e não substitui os `.env`
de cada aplicação, que continuam servindo ao `npm run dev`.

A separação entre as duas metades do arquivo é a regra de segurança do projeto
(SDD § R-09), não uma questão de organização:

**Servidor — só o contêiner da API vê.** Chegam como variável de ambiente em
tempo de execução, nunca como argumento de build, e por isso não entram em
nenhuma camada de imagem:

| Variável | Obrigatória | Observação |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | sim | Credencial de administração do próprio contêiner MySQL — nunca usada pela API |
| `MYSQL_DATABASE` | sim | Nome do banco que o contêiner MySQL inicializa |
| `MYSQL_USER` | sim | Usuário de aplicação — é com ele que a API conecta, nunca como `root` |
| `MYSQL_PASSWORD` | sim | Senha do usuário de aplicação. Junto de `MYSQL_USER`/`MYSQL_DATABASE`, o próprio compose monta a `DATABASE_URL` que o Prisma espera — não há variável de connection string para preencher à parte |
| `MINIO_ROOT_USER` | sim | Access key do MinIO. **Segredo** — jamais no navegador |
| `MINIO_ROOT_PASSWORD` | sim | Secret key do MinIO. **Segredo** — jamais no navegador |
| `MINIO_ENDPOINT` | não | Padrão `http://minio:9000` (nome do serviço na rede do compose) |
| `MINIO_BUCKET_IMAGES` | não | Padrão `veggiedent-images` |
| `MINIO_BUCKET_VIDEOS` | não | Padrão `veggiedent-videos` |
| `AUTH_JWT_SECRET` | sim | **Segredo.** Assina o JWT próprio da aplicação (SDD § D-03) — quem o tiver forja a sessão de qualquer operador. Gere um valor por ambiente (`openssl rand -base64 32`), nunca reaproveite |
| `ALLOWED_ORIGINS` | não | Padrão `http://localhost:8080`. Precisa ser a origem pública real |

**Navegador — embutidas no build da LP e do painel.** Todo `VITE_*` termina no
arquivo servido ao navegador: é o contrato do Vite, e por isso **nada secreto
pode entrar aqui**.

| Variável | Obrigatória | Observação |
|---|---|---|
| `VITE_API_BASE_URL` | não | Padrão `/api` — relativo, porque a origem é única |
| `VITE_CONTENT_ENDPOINT` | não | Padrão `/api/content` |
| `VITE_LEAD_SUBMIT_ENDPOINT` | não | Padrão `/api/leads` |
| `VITE_EBOOK_URL` | não | Vazia enquanto a Virbac não entregar o arquivo |
| `VITE_EBOOK_DELIVERY_MODE` | não | `download` ou `email` (padrão) |
| `PORTA_PROXY` | não | Porta única no hospedeiro. Padrão `8080` |

Por enquanto o painel **não tem** nenhuma variável `VITE_` própria de
autenticação — login passa a ser via API (`POST /api/auth/login`), não mais
contra um provedor externo. Isso só é implementado nas tarefas
`migracao-mysql/autenticacao-propria` e `migracao-mysql/painel-cliente`.

**Nota de transição, válida só durante a fase `migracao-mysql`:** o serviço
`proxy` deste `docker-compose.yml` ainda declara `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` como argumentos de build obrigatórios — o
painel só deixa de precisar deles quando `migracao-mysql/painel-cliente`
trocar o cliente de autenticação por padrão. Até lá, quem for subir a pilha
completa (`docker compose up --build -d`, todos os serviços) ainda precisa
defini-las no `.env`, mesmo que `.env.example` não as documente mais. Rodar só
`mysql`/`minio` (`docker compose up -d mysql minio`), como esta tarefa
verifica, não exige essas duas variáveis.

Falta uma variável obrigatória e o `docker compose up` **para antes de subir
nada**, nomeando qual falta — em vez de subir um painel que não autentica.

## Quando é preciso reconstruir

Esta é a pegadinha do modelo, e vale conhecê-la antes de depurar meia hora:

- Mudou um **`VITE_*`**? Precisa de `docker compose up --build -d`. Essas
  variáveis são argumentos de build e já estão dentro do arquivo que o navegador
  baixa; reiniciar o contêiner não muda o que foi construído.
- Mudou um **segredo do servidor** (`MYSQL_*`, `MINIO_*`, `AUTH_JWT_SECRET`,
  `ALLOWED_ORIGINS`)? Basta `docker compose up -d`. Eles são lidos em tempo de
  execução.
- Mudou **código**? `docker compose up --build -d`.

## O que quem for publicar precisa saber

1. **A porta única é a única coisa a expor.** A API **não** é publicada no
   hospedeiro — o compose usa `expose`, não `ports`, então ela só é alcançável
   pela rede interna, através do proxy. É o mesmo isolamento do domínio único de
   produção, e não há uma segunda porta para proteger.
2. **TLS não é resolvido aqui.** Termine HTTPS no que estiver na frente (o
   balanceador do provedor, um Caddy, um Traefik) e encaminhe para a porta
   `8080`. O proxy já repassa `X-Forwarded-Proto` e `X-Forwarded-For`, então
   quem está atrás vê o esquema e o IP originais.
3. **`ALLOWED_ORIGINS` precisa virar a origem pública.** Com o domínio único,
   LP e painel chamam caminhos relativos e não existe requisição entre origens
   — mas a variável é validada na inicialização e o valor padrão aponta para
   `localhost`.
4. **As migrações não rodam sozinhas.** A imagem não aplica nada ao banco.
   Nesta tarefa (`migracao-mysql/infraestrutura`) o `mysql` do compose só sobe
   vazio, com o banco (`MYSQL_DATABASE`) e o usuário de aplicação criados pela
   própria imagem oficial — nenhum schema ainda. `migracao-mysql/persistencia-orm`
   introduz o Prisma e `prisma migrate deploy`, que passa a ser a forma de
   aplicar o schema (ver [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md), atualizado
   naquela tarefa). Código na frente do banco **quebra de verdade**: se o
   banco não tiver uma coluna que o código seleciona, a resposta é `500`, não
   um campo vazio.
5. **Nenhum segredo vive na imagem nem no repositório.** Verificável, não
   prometido — o procedimento está na seção seguinte.
6. **O proxy resolve o nome `api` uma vez, ao carregar a configuração.** Se o
   contêiner da API for **recriado sozinho** e ganhar outro IP, o proxy passa a
   responder `502` até ser reiniciado (`docker compose restart proxy`).
   `docker compose up -d` recria os dois e não tem esse problema. Reresolver em
   tempo de execução exigiria `zone`, que é do nginx comercial.
7. **Node 24, não 20.** `@supabase/supabase-js` deixou de suportar Node 20 na
   versão 2.110.0 (o projeto usa `^2.114`), porque `realtime-js` exige o
   WebSocket nativo que só existe a partir do Node 22. Com Node 20 a API
   inicializa os módulos e morre em laço de reinício. O pin está no
   `docker/Dockerfile`.

## Verificar

Com a pilha no ar, contra a porta única — conferindo **conteúdo**, não só o
código HTTP, que é a lição que este projeto pagou caro para aprender:

```bash
B=http://localhost:8080

curl -s -o /dev/null -w '%{http_code}\n' $B/                     # 200 (LP)
curl -s -o /dev/null -w '%{http_code}\n' $B/admin                # 301 -> /admin/
curl -s -o /dev/null -w '%{http_code}\n' $B/admin/               # 200 (painel)
curl -s $B/api/health                                            # {"status":"ok"}
curl -s $B/api/content | head -c 200                             # as seções

# CSS de verdade, não um index.html devolvido no lugar do arquivo:
curl -s $B/$(curl -s $B/ | grep -oE 'assets/[^"]+\.css') | head -c 80
```

E a prova de que nenhuma credencial de servidor chega ao navegador — varrendo o
que o nginx de fato serve, com um **controle positivo** para garantir que a
varredura está olhando os arquivos certos (uma varredura que não lê nada também
devolve "0 ocorrências"). Segredos de servidor cobertos, conforme SDD § R-09
revisado: `AUTH_JWT_SECRET`, `MYSQL_PASSWORD`/`MYSQL_ROOT_PASSWORD` e
`MINIO_ROOT_PASSWORD` (a nota de transição acima explica por que
`VITE_SUPABASE_PUBLISHABLE_KEY` segue sendo o controle positivo por enquanto):

```bash
JWT=$(grep '^AUTH_JWT_SECRET=' .env | cut -d= -f2-)
DBPASS=$(grep '^MYSQL_PASSWORD=' .env | cut -d= -f2-)
MINIOPASS=$(grep '^MINIO_ROOT_PASSWORD=' .env | cut -d= -f2-)
PUB=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2-)

docker exec -e JWT="$JWT" -e DBPASS="$DBPASS" -e MINIOPASS="$MINIOPASS" -e PUB="$PUB" veggiedent-proxy-1 sh -c '
  R=/usr/share/nginx/html
  echo "AUTH_JWT_SECRET:     $(grep -rlF "$JWT" $R | wc -l) ocorrencias"    # 0
  echo "senha do MySQL:      $(grep -rlF "$DBPASS" $R | wc -l) ocorrencias" # 0
  echo "senha do MinIO:      $(grep -rlF "$MINIOPASS" $R | wc -l) ocorrencias" # 0
  echo "controle positivo (a publicavel DEVE aparecer):"
  grep -rlF "$PUB" $R'
```

O literal `sb_secret_` aparece **uma vez** no pacote do painel e isso é
esperado: é um trecho do próprio `@supabase/supabase-js`, que classifica
formatos de chave (`e.startsWith("sb_publishable_") || e.startsWith("sb_secret_")`).
É o nome do formato, não uma chave — daí a varredura procurar `sb_secret_`
**seguido de material de chave**, que é o que denunciaria um vazamento.

Que o segredo também não está na imagem:

```bash
docker inspect veggiedent-api:latest | grep -cF "$JWT"          # 0
docker inspect veggiedent-api:latest | grep -cF "$DBPASS"       # 0
docker history --no-trunc veggiedent-api:latest | grep -cF "$JWT"  # 0
docker exec veggiedent-api-1 find /repo -maxdepth 3 -name '.env*'  # nada
```

## Derrubar

```bash
docker compose down
```

Nada aqui ocupa as portas `5173`, `5174` ou `3000`, então a pilha e o
`npm run dev` convivem: só a `8080` (ou `PORTA_PROXY`) é tomada.
