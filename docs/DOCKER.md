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

Complementa, não substitui, o `npm run dev` de todo dia — esse continua sendo a
forma de desenvolver, com recarga automática (ver [OPERACAO.md](OPERACAO.md)).
Este aqui serve para homologar o produto construído e para entregá-lo pronto a
um servidor.

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
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | sim | **Segredo.** Ignora RLS — jamais no navegador |
| `SUPABASE_JWKS_URL` | sim | Chaves públicas com que a API verifica o token do operador |
| `ALLOWED_ORIGINS` | não | Padrão `http://localhost:8080`. Precisa ser a origem pública real |

**Navegador — embutidas no build da LP e do painel.** Todo `VITE_*` termina no
arquivo servido ao navegador: é o contrato do Vite, e por isso **nada secreto
pode entrar aqui**. A chave publicável do Supabase só troca e-mail e senha por
um token; ela não alcança o banco nem o armazenamento.

| Variável | Obrigatória | Observação |
|---|---|---|
| `VITE_SUPABASE_URL` | sim | O painel a usa somente para autenticar |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | sim | Chave **publicável** (`sb_publishable_…`) |
| `VITE_API_BASE_URL` | não | Padrão `/api` — relativo, porque a origem é única |
| `VITE_CONTENT_ENDPOINT` | não | Padrão `/api/content` |
| `VITE_LEAD_SUBMIT_ENDPOINT` | não | Padrão `/api/leads` |
| `VITE_EBOOK_URL` | não | Vazia enquanto a Virbac não entregar o arquivo |
| `VITE_EBOOK_DELIVERY_MODE` | não | `download` ou `email` (padrão) |
| `PORTA_PROXY` | não | Porta única no hospedeiro. Padrão `8080` |

Falta uma variável obrigatória e o `docker compose up` **para antes de subir
nada**, nomeando qual falta — em vez de subir um painel que não autentica.

## Quando é preciso reconstruir

Esta é a pegadinha do modelo, e vale conhecê-la antes de depurar meia hora:

- Mudou um **`VITE_*`**? Precisa de `docker compose up --build -d`. Essas
  variáveis são argumentos de build e já estão dentro do arquivo que o navegador
  baixa; reiniciar o contêiner não muda o que foi construído.
- Mudou um **segredo do servidor** (`SUPABASE_*`, `ALLOWED_ORIGINS`)? Basta
  `docker compose up -d`. Eles são lidos em tempo de execução.
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
4. **As migrações não rodam sozinhas.** A imagem não aplica nada ao banco;
   `supabase/migrations/` é aplicado à parte (ver
   [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md)). Código na frente do banco **quebra
   de verdade**: se o banco não tiver uma coluna que o código seleciona, a
   resposta é `500`, não um campo vazio. Foi exatamente o que aconteceu ao
   construir esta pilha a partir de um commit anterior ao que reconcilia código
   e banco.
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
devolve "0 ocorrências"):

```bash
SEG=$(grep '^SUPABASE_SECRET_KEY=' .env | cut -d= -f2-)
PUB=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2-)

docker exec -e SEG="$SEG" -e PUB="$PUB" veggiedent-proxy-1 sh -c '
  R=/usr/share/nginx/html
  echo "chave secreta:    $(grep -rlF "$SEG" $R | wc -l) ocorrencias"   # 0
  echo "material sb_secret_: $(grep -roE "sb_secret_[A-Za-z0-9_-]{8,}" $R | wc -l)"  # 0
  echo "JWT legado eyJ...:   $(grep -roE "eyJ[A-Za-z0-9_-]{20,}" $R | wc -l)"        # 0
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
docker inspect veggiedent-api:latest | grep -cF "$SEG"          # 0
docker history --no-trunc veggiedent-api:latest | grep -cF "$SEG"  # 0
docker exec veggiedent-api-1 find /repo -maxdepth 3 -name '.env*'  # nada
```

## Derrubar

```bash
docker compose down
```

Nada aqui ocupa as portas `5173`, `5174` ou `3000`, então a pilha e o
`npm run dev` convivem: só a `8080` (ou `PORTA_PROXY`) é tomada.
