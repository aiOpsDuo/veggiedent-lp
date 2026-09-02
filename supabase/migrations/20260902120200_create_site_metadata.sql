-- Tabela `site_metadata` — registro unico com os metadados da pagina.
-- Rastreavel a: SDD § "Modelo de dados" e § D-06.
--
-- Consumida por `GET /api/seo`, que alimenta o injetor de metadados na borda.

create table public.site_metadata (
  id                 text        primary key default 'default',
  title              text,
  description        text,
  og_image_media_id  uuid        references public.media_assets (id) on delete set null,
  canonical_url      text,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,

  -- O SDD descreve "registro unico (`id` fixo)". Prender o valor da chave
  -- primaria a uma constante e o que torna isso uma garantia do banco, e nao
  -- uma convencao que a aplicacao precisa lembrar de respeitar.
  constraint site_metadata_single_row check (id = 'default')
);

-- Colunas de conteudo sao anulaveis por decisao: obrigatoriedade de campo e
-- responsabilidade do esquema em `packages/content-schema`, nao do banco
-- (SDD § D-01). O injetor de SEO ja tem reserva no HTML estatico para o caso
-- de metadado ausente (SDD § D-06), entao um nulo aqui degrada, nao quebra.
comment on column public.site_metadata.og_image_media_id is
  'Imagem de compartilhamento social. `on delete set null` porque perder a imagem nao pode apagar os demais metadados.';
comment on column public.site_metadata.updated_by is
  'Operador que salvou (auth.users.id). Sem FK — mesma justificativa de media_assets.';

-- Sem indice: a tabela tem no maximo uma linha, alcancada pela chave primaria.
