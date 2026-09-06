-- T25 — os campos que so faziam sentido para quem constroi a pagina saem do CMS.
-- Rastreavel a: agent_context/CHANGELOG.md, entrada de 2026-09-03; PRD § "Fora
-- de escopo" (a estrutura do formulario fica em codigo, so os textos vao para o
-- CMS).
--
-- Duas remocoes, no mesmo assunto: dado que o operador nao tem como entender
-- deixa de ser pedido a ele, e o valor correspondente volta para o codigo com
-- exatamente o texto que estava publicado.

-- 1. `site_metadata.canonical_url` — SEO tecnico. Um endereco errado tira a
--    pagina do indice sem nenhum sinal visivel a quem edita. O endereco oficial
--    volta a ser o `<link rel="canonical">` estatico de `apps/lp/index.html`,
--    que ja carrega o mesmo valor (`https://p.virbac.com.br/`). Nem
--    `GET /api/seo` nem `GET /api/content` devolvem mais o campo.
alter table public.site_metadata
  drop column if exists canonical_url;

-- 2. O documento de `captura_lead` perde quatro chaves e ganha cinco.
--
--    `porteOptions` e `simNaoOptions` eram listas cujo item tinha "Codigo da
--    opcao" — o valor gravado no lead, que a propria ajuda mandava nao alterar
--    sem falar com a equipe tecnica. Quais opcoes existem, em que ordem e com
--    que codigo agora vivem em `packages/content-schema/src/sections/captura-lead.ts`
--    (`PORTE_OPTIONS`, `SIM_NAO_OPTIONS`). Do CMS sobra so o **rotulo** de cada
--    opcao, que e texto visivel: vira um campo simples por opcao.
--
--    O rotulo migrado e casado pelo **codigo** do item, nao pela posicao: se um
--    operador tiver reordenado a lista, o texto ainda acompanha a opcao certa.
--    O `coalesce` cobre o caso de o codigo nao existir mais no documento
--    gravado, com o texto que a pagina exibe hoje.
--
--    `successModalCloseAriaLabel` e rotulo de acessibilidade de um controle de
--    interface; `successModalEmailModeMessage` e texto visivel ao visitante,
--    mas quem edita nao controla o modo de entrega nem tem como saber quando
--    aquilo aparece (ressalva registrada no CHANGELOG). Os dois passam a viver
--    em `apps/lp/src/sections/CapturaLead/components/SuccessModal.tsx`.
with rotulos as (
  select
    key,
    coalesce(
      (
        select item ->> 'label'
        from jsonb_array_elements(coalesce(data -> 'porteOptions', '[]'::jsonb)) as item
        where item ->> 'value' = 'pequeno'
        limit 1
      ),
      'Pequeno'
    ) as porte_pequeno,
    coalesce(
      (
        select item ->> 'label'
        from jsonb_array_elements(coalesce(data -> 'porteOptions', '[]'::jsonb)) as item
        where item ->> 'value' = 'medio'
        limit 1
      ),
      'Médio'
    ) as porte_medio,
    coalesce(
      (
        select item ->> 'label'
        from jsonb_array_elements(coalesce(data -> 'porteOptions', '[]'::jsonb)) as item
        where item ->> 'value' = 'grande'
        limit 1
      ),
      'Grande'
    ) as porte_grande,
    coalesce(
      (
        select item ->> 'label'
        from jsonb_array_elements(coalesce(data -> 'simNaoOptions', '[]'::jsonb)) as item
        where item ->> 'value' = 'sim'
        limit 1
      ),
      'Sim'
    ) as opcao_sim,
    coalesce(
      (
        select item ->> 'label'
        from jsonb_array_elements(coalesce(data -> 'simNaoOptions', '[]'::jsonb)) as item
        where item ->> 'value' = 'nao'
        limit 1
      ),
      'Não'
    ) as opcao_nao
  from public.content_sections
  where key = 'captura_lead'
)
update public.content_sections as secao
set data =
  (
    secao.data
      - 'porteOptions'
      - 'simNaoOptions'
      - 'successModalCloseAriaLabel'
      - 'successModalEmailModeMessage'
  )
  || jsonb_build_object(
    'portePequenoLabel', rotulos.porte_pequeno,
    'porteMedioLabel', rotulos.porte_medio,
    'porteGrandeLabel', rotulos.porte_grande,
    'opcaoSimLabel', rotulos.opcao_sim,
    'opcaoNaoLabel', rotulos.opcao_nao
  )
from rotulos
where secao.key = rotulos.key;

-- `updated_at` fica como estava de proposito: nenhum operador editou conteudo
-- aqui, e mover a data faria a tela de secoes contar uma historia falsa sobre
-- quem mexeu no texto e quando.
