-- Remove a secao `footer` do conjunto fechado de `content_sections`.
-- Rastreavel a: agent_context/PLAN.md, T32; agent_context/CHANGELOG.md, entrada de 2026-09-04.
--
-- O Rodape sai do CMS, mesmo tratamento dado ao Header na T28: seus dados
-- voltam a ser fixos em codigo (apps/lp/src/components/layout/Footer), com
-- exatamente os textos que estavam publicados no momento da remocao.
--
-- O conjunto de secoes editaveis cai de 10 para 9.

delete from public.content_sections where key = 'footer';

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
    'faq'
  ));
