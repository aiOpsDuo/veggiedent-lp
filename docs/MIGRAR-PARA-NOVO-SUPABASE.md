# Migrar para um novo projeto Supabase

O Supabase usado até aqui é só de desenvolvimento. Este documento é o roteiro para apontar
o projeto — API, painel e o conteúdo do CMS — para um projeto Supabase **novo**, criado
especificamente para produção. Ele não substitui nenhum documento que já existe sobre cada
peça; encadeia-os na ordem certa e registra a única armadilha que não estava escrita em
lugar nenhum: sem o primeiro operador, ninguém entra no painel novo.

Sete passos, do projeto Supabase vazio a pronto para publicar.

## 1. Criar o projeto Supabase novo

No painel do Supabase, **New project**. Anote três coisas da tela de criação — são usadas
nos passos seguintes e não aparecem juntas em lugar nenhum depois: a **URL do projeto**
(`https://<ref>.supabase.co`), a **senha do banco** (definida na criação; não é recuperável
depois, só redefinível) e a **região** escolhida.

## 2. Aplicar as migrações

A partir da raiz do repositório, pelo pooler — a sintaxe já verificada neste ambiente está
em [BANCO-DE-DADOS.md, "Aplicar as migrações"](BANCO-DE-DADOS.md):

```bash
npx supabase db push --db-url \
  "postgresql://postgres.<ref-do-projeto-novo>:<senha-do-banco>@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
```

`--db-url` e `--dry-run` são flags reais desta versão do Supabase CLI (`npx supabase db push
--help`, conferido nesta tarefa: 2.117.0). Use `--dry-run` primeiro se não tiver certeza da
região — ele conecta e lista o que seria aplicado, sem alterar nada. As mesmas três
armadilhas de sempre valem para o projeto novo: pooler, não o host direto (que só resolve
IPv6); porta **5432**, não 6543; usuário `postgres.<ref>`, não `postgres`.

Ao final desta migração o projeto novo tem as quatro tabelas (`media_assets`,
`content_sections`, `site_metadata`, `leads`), RLS habilitado sem nenhuma policy nelas, e os
dois buckets de armazenamento (`veggiedent-images`, `veggiedent-videos`) com leitura
pública — tudo vazio.

## 3. Preencher os `.env` com a URL e as chaves do projeto novo

Duas aplicações leem Supabase, e as duas precisam do projeto novo — esquecer a segunda
deixa o painel autenticando contra o Supabase de desenvolvimento enquanto a API já fala com
o de produção:

**`apps/api/.env`** (modelo em [`apps/api/.env.example`](../apps/api/.env.example)):

| Variável | De onde vem, no projeto novo |
|---|---|
| `SUPABASE_URL` | A URL anotada no passo 1 |
| `SUPABASE_SECRET_KEY` | Project Settings → API → chave secreta (`sb_secret_…`) |
| `SUPABASE_JWKS_URL` | `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` |

**`apps/admin/.env`** (modelo em [`apps/admin/.env.example`](../apps/admin/.env.example)) —
sem isto o login do painel continua validando contra o projeto de desenvolvimento:

| Variável | De onde vem, no projeto novo |
|---|---|
| `VITE_SUPABASE_URL` | A mesma URL do passo 1 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API → chave publicável (`sb_publishable_…`) |

A tabela completa de variáveis, obrigatórias e opcionais, está em [OPERACAO.md](OPERACAO.md).

## 4. Criar o primeiro operador

Este é o passo que este documento existe para não deixar escapar. Um projeto Supabase novo
não tem nenhum usuário, e a tela **Operadores** do próprio painel (`/admin/operadores`, ver
[PAINEL.md, "Como criar e remover um operador do painel"](PAINEL.md)) fica **atrás do
login** — ela serve para todo operador **seguinte**, não para o primeiro. O primeiro precisa
nascer direto no painel do Supabase:

1. No projeto novo: **Authentication → Users → Add user → Create new user**.
2. Preencha **Email** e **Password**.
3. Marque **Auto Confirm User**. Sem isso o usuário fica pendente de confirmação por
   e-mail e o login falha, porque este projeto não tem envio de e-mail configurado.
4. Confirme em **Add user**.

Este detalhe (o Auto Confirm, e por que sem ele o login falha) foi descoberto e documentado
originalmente na verificação da T5 (commit `ac878dc`, quando a criação de operador ainda era
inteiramente pelo painel do Supabase). A tela Operadores de hoje (T29/T34) substituiu esse
fluxo para todo operador *além* do primeiro — mas o primeiro continua exatamente na situação
que a T5 documentou, porque ainda não existe sessão para abrir a tela.

Com a API já apontando para o projeto novo (passo 3), esse operador já entra em `/admin` na
hora. Todo operador seguinte pode ser criado normalmente pela tela Operadores do painel, sem
voltar ao Supabase.

## 5. Rodar a carga do instantâneo

Com o primeiro operador criado e a API no ar contra o projeto novo, popule o CMS a partir do
instantâneo versionado:

```bash
npm run build -w apps/api
npm run migrate:content -w apps/api
```

Comando e nome exatos conferidos em `apps/api/src/migration/main.ts` e
`apps/api/package.json` (script `migrate:content`, que roda `dist/migration/main.js`). O
procedimento completo — todas as variáveis de ambiente que ele lê, os três caminhos de
conciliação de mídia e por que rodar mais de uma vez não duplica nada — está em
[CONTEUDO-DA-LP.md, "Popular um ambiente novo a partir do instantâneo"](CONTEUDO-DA-LP.md);
não duplicado aqui. Resumo mínimo para não perder o fio: a carga se autentica com o e-mail e
a senha do operador criado no passo 4 (`CMS_OPERATOR_EMAIL`, `CMS_OPERATOR_PASSWORD`) junto
da chave publicável do projeto novo (`SUPABASE_PUBLISHABLE_KEY`) — ou, no lugar dos três, um
`CMS_ACCESS_TOKEN` já emitido.

## 6. Regenerar o instantâneo apontando para o projeto novo

As mídias do instantâneo antigo apontam para URLs do projeto de origem (desenvolvimento);
depois da carga, o projeto novo tem seus próprios caminhos de armazenamento. Regenere para
que uma carga futura no mesmo projeto reaproveite os arquivos em vez de reenviá-los:

```bash
npm run instantaneo -- http://localhost:5173/api/content
```

(ou `npm run instantaneo -- <endereço-do-ambiente-novo>`, se a API do projeto novo responder
em outro endereço). Nome do script e do argumento conferidos em
`scripts/gerar-instantaneo-de-conteudo.mjs`. O que o script recusa gravar, e quando
regenerar, está em [CONTEUDO-DA-LP.md, "Instantâneo de conteúdo"](CONTEUDO-DA-LP.md).

## 7. Publicar

Fora do escopo deste documento — a publicação é responsabilidade do usuário, decisão
registrada em `agent_context/CHANGELOG.md` (2026-09-05). O empacotamento das três aplicações
atrás de uma porta única é o que se usa a partir daqui: [`docs/DOCKER.md`](DOCKER.md).

## Limitações conhecidas da carga do instantâneo

Três, todas consequência de a carga partir do instantâneo em vez do banco de origem:

- **Item despublicado não migra.** O instantâneo é a forma *publicada* do conteúdo — uma
  seção desligada ou um item de lista oculto no CMS de origem não está nele, e a carga não
  inventa o que falta: a seção nasce desligada no projeto novo, sem que o conteúdo se perca,
  mas também sem aparecer até alguém publicá-la de novo.
- **Precisa de operador já criado antes de rodar** (passo 4 acima). A carga grava pelos
  mesmos endpoints administrativos que o painel usa, com token de operador de verdade — é o
  que garante que ela não escapa da validação de esquema. Sem um operador, a guarda global da
  API nega toda escrita.
- **Mídia órfã não é limpa automaticamente.** A carga sobe cada arquivo pelo mesmo fluxo de
  três passos que o painel usa (credencial → envio → confirmação); uma interrupção entre o
  envio e a confirmação deixa um arquivo sem registro correspondente no armazenamento do
  projeto novo — o mesmo risco, já descrito em [MANUTENCAO.md, "Limpeza de arquivos órfãos
  no armazenamento"](MANUTENCAO.md). A carga não limpa isso sozinha; é a mesma rotina de
  manutenção, aplicada ao projeto novo.
