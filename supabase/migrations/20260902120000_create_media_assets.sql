-- Tabela `media_assets` — um registro por arquivo enviado ao armazenamento.
-- Rastreavel a: SDD § "Modelo de dados".
--
-- O registro so e criado depois que o upload e confirmado (SDD § D-05 e § R-04).
-- Arquivo no bucket sem linha aqui e um orfao inerte: nada no conteudo o referencia.

create table public.media_assets (
  id                uuid        primary key default gen_random_uuid(),
  kind              text        not null,
  storage_path      text        not null,
  public_url        text        not null,
  mime_type         text        not null,
  size_bytes        bigint      not null,
  original_filename text        not null,
  width             integer,
  height            integer,
  duration_seconds  numeric,
  created_at        timestamptz not null default now(),
  created_by        uuid,

  -- Conjunto fechado declarado no SDD. Cada valor corresponde a um bucket
  -- (ver 20260902120500_create_storage_buckets.sql).
  constraint media_assets_kind_check
    check (kind in ('image', 'video', 'caption')),

  -- Um caminho no bucket identifica um unico arquivo. Tambem serve de indice
  -- para a busca por caminho na conciliacao de orfaos (SDD § R-04).
  constraint media_assets_storage_path_key
    unique (storage_path),

  constraint media_assets_size_bytes_check
    check (size_bytes > 0)
);

-- `width`, `height` e `duration_seconds` sao "nulos conforme o tipo" (SDD):
-- imagem preenche largura e altura; video preenche os tres; legenda nenhum.
comment on column public.media_assets.width is 'Nulo para kind = caption.';
comment on column public.media_assets.height is 'Nulo para kind = caption.';
comment on column public.media_assets.duration_seconds is 'Preenchido apenas para kind = video.';

-- `created_by` guarda o operador do Supabase Auth. Deliberadamente SEM chave
-- estrangeira para `auth.users`: amarrar estas migracoes ao schema de
-- autenticacao do Supabase impediria aplica-las e verifica-las em um Postgres
-- puro, que e hoje o unico ambiente de teste disponivel. O valor e de
-- auditoria, nao de negocio — nenhuma regra do SDD depende dele.
comment on column public.media_assets.created_by is
  'Operador que registrou a midia (auth.users.id). Sem FK — ver comentario da migracao.';

-- Sem indice adicional: as unicas leituras previstas sao por `id` (chave
-- primaria) e por `storage_path` (unique). O SDD § "Endpoints administrativos"
-- expoe apenas GET e DELETE por id, sem listagem paginada de midia.
