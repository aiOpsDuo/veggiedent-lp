-- Remove as secoes `header` e `ingredientes` do conjunto fechado de `content_sections`.
-- Rastreavel a: agent_context/PLAN.md, T28; agent_context/CHANGELOG.md, entrada de 2026-09-04.
--
-- `header` sai do CMS: seus dados voltam a ser fixos em codigo
-- (apps/lp/src/components/layout/Header), com exatamente os textos que
-- estavam publicados. `ingredientes` sai do projeto inteiro: nunca teve
-- conteudo aprovado alem do titulo, e o material tecnico da Virbac que a
-- destravaria nunca chegou.
--
-- O conjunto de secoes editaveis cai de 12 para 10.

delete from public.content_sections where key in ('header', 'ingredientes');

alter table public.content_sections
  drop constraint content_sections_key_check;

alter table public.content_sections
  add constraint content_sections_key_check check (key in (
    'hero',
    'educacao',
    'rotina',
    'produto',
    'demonstracao',
    'prova_autoridade',
    'captura_lead',
    'onde_comprar',
    'faq',
    'footer'
  ));
