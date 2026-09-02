-- Texto alternativo da imagem de compartilhamento em `site_metadata`.
-- Rastreavel a: SDD § "Contrato do esquema de secao" (todo campo `imagem` tem
-- um campo de texto alternativo adjacente e obrigatorio) e § C-06.
--
-- POR QUE ESTA MIGRACAO EXISTE
--   O SDD § "Modelo de dados" descreve `site_metadata` com `title`,
--   `description`, `og_image_media_id` e `canonical_url`, e a T3 seguiu essa
--   lista a risca. Mas o esquema de `packages/content-schema` declara a imagem
--   de compartilhamento com o par obrigatorio imagem + texto alternativo, entao
--   `ogImageAlt` era validado na escrita e descartado na gravacao: o operador
--   preenchia um campo que nao voltava. A coluna fecha essa lacuna.
--
--   A regra de acessibilidade continua morando no esquema, nao aqui: a coluna e
--   anulavel pela mesma razao que `title` e `description` sao (SDD § D-01 —
--   obrigatoriedade de campo e responsabilidade do esquema, nao do banco), e
--   porque a imagem de compartilhamento em si e opcional.

alter table public.site_metadata
  add column if not exists og_image_alt text;

comment on column public.site_metadata.og_image_alt is
  'Texto alternativo da imagem de compartilhamento. Obrigatorio no esquema quando ha imagem; anulavel aqui porque a imagem e opcional.';
