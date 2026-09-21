# Banco de dados

**Revisto em 2026-09-21 (`migracao-mysql/persistencia-orm`):** o banco trocou de Postgres/Supabase para MySQL 8, auto-hospedado (`docker-compose.yml`, serviço `mysql`), com [Prisma](https://www.prisma.io/) como ORM e ferramenta de migração (SDD § D-10). Este documento descreve o estado atual; a seção "Histórico: migrações Postgres/Supabase" ao final preserva o que existia antes, para quem precisar entender a origem do schema.

## Onde vive o schema

O schema fica em `apps/api/prisma/schema.prisma` — cinco `model`s (`ContentSection`, `SiteMetadata`, `MediaAsset`, `Lead`, `Operator`), traduzidos do modelo de dados do SDD (§ "Modelo de dados") para a sintaxe do Prisma. Cada `model` usa `@map`/`@@map` para manter os nomes de tabela e coluna em `snake_case` no banco (`content_sections`, `is_published`, ...) enquanto o código TypeScript gerado usa `camelCase` (`ContentSection.isPublished`), consistente com o resto do projeto.

Comentários no próprio `schema.prisma` documentam duas decisões que não são óbvias só lendo os tipos:

- **Geração de UUID passou do banco para a aplicação.** As migrações Postgres originais usavam `default gen_random_uuid()` — quem gerava o id de `media_assets` e `leads` era o próprio banco. MySQL não tem uma função nativa portável equivalente (`UUID()` do MySQL gera UUID v1, formato diferente). A partir desta tarefa, nenhum campo `id` tem `@default(...)`: os repositórios de infraestrutura (tarefas seguintes da fase `migracao-mysql`) geram o UUID v4 explicitamente antes do `INSERT`.
- **Sem `CHECK` de banco para os conjuntos fechados** (`content_sections.key`, `media_assets.kind`). O Prisma não tem um atributo declarativo portável para `CHECK` (pedido em aberto desde 2019 — [prisma/prisma#3388](https://github.com/prisma/prisma/issues/3388)). A validação desses valores permanece na aplicação (`packages/content-schema` valida `key`; os repositórios validam `kind`) — uma garantia a menos no nível de banco em relação ao Postgres original, registrada como diferença consciente.

## Aplicar as migrações

### Em produção (contêiner)

```bash
npm run migrate:db -w apps/api
```

Roda `prisma migrate deploy`: aplica as migrações já geradas em `apps/api/prisma/migrations/`, na ordem, sem gerar nenhuma migração nova e sem precisar de um *shadow database* (ao contrário de `migrate dev` — por isso funciona com a credencial de aplicação de privilégio mínimo, `MYSQL_USER`/`MYSQL_PASSWORD` do `docker-compose.yml`, que não tem permissão de `CREATE DATABASE`). Equivalente, no espírito, ao antigo `supabase db push`.

### Em desenvolvimento (schema mudou)

```bash
npm run migrate:dev -w apps/api
```

Roda `prisma migrate dev`: compara o `schema.prisma` contra o banco, gera uma nova pasta em `apps/api/prisma/migrations/<timestamp>_<nome>/migration.sql` com o SQL da diferença, aplica, e regenera o Prisma Client. **Precisa de um usuário com permissão de `CREATE DATABASE`** (usa um *shadow database* temporário para detectar deriva de schema) — contra o MySQL do `docker-compose.yml`, isso significa rodar com uma credencial administrativa (`MYSQL_ROOT_PASSWORD`), não com o usuário de aplicação. Nunca rode `migrate dev` em produção.

Os dois comandos leem `DATABASE_URL` de `apps/api/.env` (nunca commitado — copie de `.env.example`) através de `dotenv`, carregado só por `apps/api/prisma.config.ts` (ver "Por que `prisma.config.ts`" abaixo). Em produção, `DATABASE_URL` já chega como variável de ambiente real do contêiner (`docker-compose.yml`), então não há `.env` para ler.

### Subindo só o MySQL para testar localmente

```bash
docker compose up -d mysql
```

Sem `ports` publicado no `docker-compose.yml` de propósito (mesmo isolamento do antigo Supabase — SDD § "Isolamento de acesso"): para alcançar o MySQL do hospedeiro (fora do contêiner da API), publique a porta temporariamente com um `docker-compose.override.yml` local (nunca commitado) ou rode os comandos de dentro da rede do compose.

## Por que `prisma.config.ts` existe

A partir do Prisma ORM 7, a URL de conexão deixou de viver no bloco `datasource` de `schema.prisma` — o Prisma recusa um `schema.prisma` com `url = env("DATABASE_URL")` ali. A URL usada pelo Prisma Migrate/CLI agora mora em `apps/api/prisma.config.ts`. Em tempo de execução (a aplicação rodando), o `PrismaClient` não lê essa configuração: ele recebe a conexão por um *driver adapter* (ver próxima seção). As duas pontas (CLI e Client) apontam para o mesmo `DATABASE_URL`, só que por caminhos diferentes — detalhe de arquitetura do Prisma 7, não uma escolha deste projeto.

## Cliente Prisma compartilhado

`apps/api/src/shared/infrastructure/prisma-client.ts` e `prisma.module.ts` substituem `supabase-client.ts`/`supabase.module.ts` (mesmo padrão: token de injeção `Symbol`, módulo `@Global()`, uma única instância para o processo inteiro). Diferença que o Prisma 7 impõe: o `PrismaClient` não aceita mais uma URL direta — ele exige um *driver adapter*. Para MySQL, o adapter oficial é `@prisma/adapter-mariadb` (o driver `mariadb` é compatível com MySQL; não existe um `@prisma/adapter-mysql` separado), que aceita a própria connection string de `DATABASE_URL`.

O módulo fecha o pool de conexões em `onModuleDestroy`. Isso só é exercitado porque `main.ts` chama `app.enableShutdownHooks()` — o Nest não escuta sinais do sistema operacional por padrão.

Nenhum repositório de domínio (`ContentSection`, `Lead`, `MediaAsset`, ...) foi criado ainda: são as tarefas seguintes da fase `migracao-mysql` (`modulo-conteudo`, `modulo-metadados`, `modulo-leads`, `modulo-midia`, `gestao-operadores`), cada uma substituindo o repositório `supabase-*.ts` equivalente.

## Gerar o Prisma Client

`prisma generate` lê `schema.prisma` e escreve o client TypeScript gerado em `apps/api/src/generated/prisma/` (caminho dentro de `src/` para o `tsc`/`nest build` incluí-lo na compilação; ignorado pelo Git — é artefato de build, como `dist/`). Roda automaticamente antes de `build`, `typecheck` e `test` (`prebuild`/`pretypecheck`/`pretest` em `apps/api/package.json`, junto do build de `packages/content-schema` que já existia) — nunca precisa ser chamado à mão no dia a dia, só se você quiser inspecionar o client gerado.

## Verificar o schema físico contra o SDD

`apps/api/scripts/verify-schema.mjs` prova, contra um MySQL real, que as cinco tabelas existem e que cada coluna bate com o SDD § "Modelo de dados" — nome, tipo exato (`information_schema.columns.COLUMN_TYPE`) e obrigatoriedade. Mesmo espírito do antigo `supabase/scripts/verify-isolation.mjs`: não confiar em configuração declarada, verificar o banco de verdade — só que aplicado à fidelidade do schema físico, não ao isolamento (MySQL não tem Row Level Security; a garantia de isolamento agora é inteiramente arquitetural, ver SDD § "Isolamento de acesso").

```bash
npm run verify:schema -w apps/api
```

Lê `DATABASE_URL` de `apps/api/.env` (mesmo carregador nativo do Node usado por `migrate:content`, `--env-file-if-exists`). Saída:

- `0` — todas as checagens batem com o SDD.
- `1` — ao menos uma tabela ou coluna diverge (ausente, tipo errado, nulabilidade errada).
- `2` — não foi possível conectar ou consultar o banco; nada foi provado.

## Histórico: migrações Postgres/Supabase

Até 2026-09-21 o banco era Postgres, hospedado no Supabase, com o schema versionado em `supabase/migrations/*.sql` e aplicado via `supabase db push`. Essas migrações continuam no repositório como registro histórico e fonte da tradução de tipos para o `schema.prisma` atual (ver comentários de rastreabilidade no próprio `schema.prisma`, que citam o arquivo `.sql` de origem de cada decisão) — não são mais aplicadas nem mantidas. A remoção definitiva desses arquivos, de `@supabase/supabase-js` e dos adaptadores `supabase-*.ts` ainda em uso é escopo da tarefa `migracao-mysql/migrar-conteudo-e-remover-supabase` (`agent_context/PLAN.md`), que só acontece depois que todos os módulos tiverem migrado para os repositórios Prisma/MySQL.

O texto abaixo é o documento original, preservado para contexto:

O esquema do banco vivia em `supabase/migrations/`, uma migração por assunto, aplicadas na ordem do nome do arquivo:

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
| `20260903140000_drop_rdstation_from_leads.sql` | Remove `rdstation_status` e `rdstation_error` de `leads` — a integração foi descontinuada e o lead não tem destino externo (T26) |
| `20260904150000_remove_header_and_ingredientes_sections.sql` | Apaga as linhas `header` e `ingredientes` de `content_sections` e estreita o `check` de 12 para as **10** chaves restantes — o cabeçalho saiu do CMS e a seção Ingredientes saiu do projeto (T28) |
| `20260904170000_remove_footer_section.sql` | Apaga a linha `footer` de `content_sections` e estreita o `check` de 10 para as **9** chaves restantes — o rodapé saiu do CMS, mesmo tratamento do cabeçalho na T28 (T32) |
| `20260904160000_remove_captions_media_kind.sql` | Restringe a policy de leitura pública de `storage.objects` aos dois buckets restantes e estreita o `check` de `media_assets.kind` de `('image', 'video', 'caption')` para `('image', 'video')` — o campo "Arquivo de legendas" saiu do esquema inteiro (T31). O bucket `veggiedent-captions` em si foi removido pela Storage API, fora desta migração: o projeto hospedado recusa `delete` direto em `storage.buckets` |
| `20260905120000_remove_canonical_url_and_option_codes.sql` | Remove `site_metadata.canonical_url` (endereço canônico volta a ser estático em `apps/lp/index.html`) e migra os rótulos de `porteOptions`/`simNaoOptions` de `captura_lead` para campos simples (T25) |

**Por que não havia policy nas tabelas.** Uma tabela com RLS habilitada e zero policies nega tudo para `anon` e `authenticated` — era exatamente o comportamento que o SDD exigia: nenhum cliente alcançava o banco direto, todo acesso passava pela API com `SUPABASE_SECRET_KEY` (papel `service_role`, que ignora RLS). No armazenamento a regra era a oposta: leitura pública (a LP precisava exibir as mídias), escrita só pela credencial do servidor.

`supabase/scripts/verify-isolation.mjs` provava, contra um Supabase real, três coisas: que a chave publicável não lia nenhuma das quatro tabelas, que os três buckets existiam com leitura pública e escrita fechada, e se o portão da Data API recusava a chave publicável.
