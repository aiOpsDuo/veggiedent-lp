-- Remove a natureza de midia `caption` (o campo "Arquivo de legendas") do
-- conjunto fechado, e a policy/constraint que reservavam lugar pra ela.
-- Rastreavel a: agent_context/PLAN.md, T31; agent_context/CHANGELOG.md, entrada de 2026-09-04.
--
-- Decisao do usuario: o campo nunca foi usado de verdade (0 registros com
-- kind = 'caption' em media_assets, confirmado antes desta migracao) -- a
-- remocao nao apaga midia real de nenhum operador.
--
-- O bucket `veggiedent-captions` NAO e apagado por esta migracao: o projeto
-- hospedado recusa DML direto nas tabelas de storage ("Direct deletion from
-- storage tables is not allowed. Use the Storage API instead.", SQLSTATE
-- 42501) tanto para `storage.objects` quanto para `storage.buckets`. O bucket
-- foi removido separadamente, pela Storage API (POST .../empty seguido de
-- DELETE .../bucket/veggiedent-captions, com o bucket ja vazio), antes de
-- aplicar esta migracao -- e essa remocao nao e reproduzida em SQL porque o
-- proprio Supabase nao permite.

-- A policy de leitura publica valia para os tres buckets; passa a valer so
-- para os dois que restam.
drop policy if exists "Leitura publica das midias do Veggiedent" on storage.objects;

create policy "Leitura publica das midias do Veggiedent"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id in ('veggiedent-images', 'veggiedent-videos')
  );

-- O conjunto fechado de naturezas de midia (media_assets.kind) perde `caption`.
alter table public.media_assets
  drop constraint media_assets_kind_check;

alter table public.media_assets
  add constraint media_assets_kind_check
  check (kind in ('image', 'video'));
