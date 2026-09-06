# Banco de dados e armazenamento

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
| `20260903140000_drop_rdstation_from_leads.sql` | Remove `rdstation_status` e `rdstation_error` de `leads` — a integração foi descontinuada e o lead não tem destino externo (T26) |
| `20260904150000_remove_header_and_ingredientes_sections.sql` | Apaga as linhas `header` e `ingredientes` de `content_sections` e estreita o `check` de 12 para as **10** chaves restantes — o cabeçalho saiu do CMS e a seção Ingredientes saiu do projeto (T28) |
| `20260904170000_remove_footer_section.sql` | Apaga a linha `footer` de `content_sections` e estreita o `check` de 10 para as **9** chaves restantes — o rodapé saiu do CMS, mesmo tratamento do cabeçalho na T28 (T32) |
| `20260904160000_remove_captions_media_kind.sql` | Restringe a policy de leitura pública de `storage.objects` aos dois buckets restantes e estreita o `check` de `media_assets.kind` de `('image', 'video', 'caption')` para `('image', 'video')` — o campo "Arquivo de legendas" saiu do esquema inteiro (T31). O bucket `veggiedent-captions` em si foi removido pela Storage API, fora desta migração: o projeto hospedado recusa `delete` direto em `storage.buckets` |

**Por que não há policy nas tabelas.** Uma tabela com RLS habilitada e zero policies nega tudo para `anon` e `authenticated` — é exatamente o comportamento que o SDD exige: nenhum cliente alcança o banco direto, todo acesso passa pela API com `SUPABASE_SECRET_KEY` (papel `service_role`, que ignora RLS). Acrescentar uma policy para esses dois papéis, por mais restrita que pareça, abre um caminho que contorna a API. No armazenamento a regra é a oposta e está explícita: leitura pública (a LP precisa exibir as mídias), escrita só pela credencial do servidor.

## Aplicar as migrações

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

## Verificar o isolamento da superfície pública

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
