-- Tabela `content_sections` — um registro por secao da landing page.
-- Rastreavel a: SDD § "Modelo de dados" e § D-01.
--
-- Todo o conteudo da secao, inclusive suas listas, vive em `data` (jsonb).
-- O banco NAO garante a forma desse documento: a garantia vem do esquema em
-- `packages/content-schema`, validado em toda escrita (SDD § D-01 e § R-03).

create table public.content_sections (
  key          text        primary key,
  data         jsonb       not null default '{}'::jsonb,
  is_published boolean     not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,

  -- Os 12 identificadores de secao sao um conjunto fechado (SDD § Glossario):
  -- o CMS edita secoes existentes, nunca cria tipos novos. Manter a restricao
  -- no banco impede que uma chave inventada entre por qualquer caminho.
  constraint content_sections_key_check check (key in (
    'header',
    'hero',
    'educacao',
    'rotina',
    'produto',
    'ingredientes',
    'demonstracao',
    'prova_autoridade',
    'captura_lead',
    'onde_comprar',
    'faq',
    'footer'
  ))
);

comment on column public.content_sections.data is
  'Documento da secao validado contra packages/content-schema. O banco nao impoe forma (SDD § D-01).';
comment on column public.content_sections.is_published is
  'Visibilidade da secao inteira. GET /api/content omite secoes nao publicadas.';
comment on column public.content_sections.updated_by is
  'Operador que salvou (auth.users.id). Sem FK — mesma justificativa de media_assets.';

-- Sem indice sobre `is_published`: a restricao acima limita a tabela a 12
-- linhas. Um indice nunca seria escolhido pelo planejador nesse tamanho, e a
-- leitura de `GET /api/content` e uma unica consulta sobre a tabela inteira
-- (SDD § R-05) — exatamente o caso em que a varredura sequencial e a melhor
-- estrategia.
