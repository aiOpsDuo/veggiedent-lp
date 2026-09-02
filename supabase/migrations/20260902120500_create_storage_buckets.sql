-- Buckets de armazenamento das midias e suas politicas de acesso.
-- Rastreavel a: SDD § "Modelo de dados" (media_assets), § D-05 e § R-04.
--
-- POLITICA DE ACESSO PRETENDIDA
--   Leitura  — publica. A landing page e servida a visitantes anonimos e
--              precisa exibir imagens, videos e legendas ja publicados.
--   Escrita  — apenas pela credencial do servidor. O navegador nunca escreve
--              com a chave anonima: o painel pede a API uma credencial
--              temporaria de upload, emitida com a chave secreta (SDD § D-05).
--
-- Um bucket por valor de `media_assets.kind` (`image`, `video`, `caption`).
-- A divisao nao e organizacional: e o que permite que o limite de tamanho e a
-- lista de tipos aceitos sejam diferentes por natureza de arquivo, ja que o
-- proprio armazenamento recusa o upload fora dessas faixas. Um bucket unico
-- obrigaria a adotar o limite do video (centenas de MB) tambem para imagens.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'veggiedent-images',
    'veggiedent-images',
    true,
    10485760, -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
  ),
  (
    'veggiedent-videos',
    'veggiedent-videos',
    true,
    524288000, -- 500 MB. O PRD descreve videos na ordem de dezenas a centenas de MB.
    array['video/mp4', 'video/webm']
  ),
  (
    'veggiedent-captions',
    'veggiedent-captions',
    true,
    1048576, -- 1 MB
    array['text/vtt']
  )
on conflict (id) do nothing;

-- `image/svg+xml` esta deliberadamente FORA da lista de imagens: SVG e um
-- documento executavel, e servi-lo de um bucket publico no mesmo dominio das
-- URLs do produto e um vetor de script injetado por quem consegue enviar um
-- arquivo. Nenhuma secao da LP precisa de SVG enviado pelo painel.

-- Leitura publica dos arquivos.
--
-- O acesso ao banco e negado por ausencia de policy (ver
-- 20260902120400_enable_rls_deny_all.sql), mas o armazenamento e o caso
-- oposto: aqui a leitura anonima e requisito, entao a policy existe e e
-- explicita. Ela e restrita por `bucket_id` — vale para estes tres buckets e
-- para nenhum outro que venha a ser criado depois.
--
-- `drop ... if exists` antes de criar para que a migracao possa ser reaplicada
-- (`supabase db reset`) sem colidir com a policy ja existente.
drop policy if exists "Leitura publica das midias do Veggiedent" on storage.objects;

create policy "Leitura publica das midias do Veggiedent"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id in ('veggiedent-images', 'veggiedent-videos', 'veggiedent-captions')
  );

-- NAO existe policy de insert, update ou delete — nem para `anon`, nem para
-- `authenticated`. Com RLS ativa em `storage.objects`, a ausencia de policy
-- nega a operacao. Toda escrita passa por `service_role`, que tem BYPASSRLS e
-- e usado somente pela API: e ela quem emite a credencial temporaria de upload
-- e quem registra a midia em `media_assets` depois da confirmacao.
--
-- `storage.buckets` tambem permanece sem policy: nenhum cliente precisa listar
-- ou alterar buckets, e o SDD nao preve criacao de bucket em tempo de execucao.
