-- Tabela `leads` — um registro por envio do formulario de captura.
-- Rastreavel a: SDD § "Modelo de dados", § D-07, § C-11 e § C-12.
--
-- `POST /api/leads` grava o lead ANTES de tentar o RD Station e responde
-- sucesso se a gravacao deu certo. Uma falha do RD Station nunca perde o lead:
-- ela fica registrada em `rdstation_status` / `rdstation_error`.

create table public.leads (
  id                   uuid        primary key default gen_random_uuid(),

  -- Obrigatorios (SDD § "Modelo de dados").
  nome                 text        not null,
  email                text        not null,

  -- Opcionais.
  telefone             text,
  nome_cachorro        text,
  porte_cachorro       text,
  cidade_estado        text,

  -- Opcionais. Hoje coletados no formulario e descartados antes do envio —
  -- defeito existente registrado em SDD § R-01, corrigido por esta tabela.
  conhece_virbac       text,
  usa_produto_virbac   text,
  qual_produto_virbac  text,

  aceite_lgpd          boolean     not null,
  aceite_comunicacoes  boolean     not null,
  origem               text,

  rdstation_status     text        not null default 'nao_enviado',
  rdstation_error      text,
  created_at           timestamptz not null default now(),

  constraint leads_rdstation_status_check
    check (rdstation_status in ('ok', 'falhou', 'nao_enviado')),

  -- "Nulo quando `ok`" (SDD). Um repasse bem-sucedido nao pode carregar
  -- mensagem de erro; o contrario tornaria a coluna ambigua na exportacao.
  constraint leads_rdstation_error_absent_when_ok
    check (not (rdstation_status = 'ok' and rdstation_error is not null))
);

comment on column public.leads.rdstation_status is
  'Resultado do repasse ao RD Station: ok | falhou | nao_enviado.';
comment on column public.leads.origem is
  'Origem declarada do envio (campanha, pagina). Texto livre vindo do formulario.';

-- Indice da consulta de `GET /api/admin/leads`: lista paginada, do mais
-- recente ao mais antigo, com filtros `from` e `to` por data
-- (SDD § "Endpoints administrativos" e § C-12).
--
-- Um unico indice descendente sobre `created_at` atende os dois lados dessa
-- consulta: a faixa do WHERE e a ordenacao do ORDER BY sao a mesma coluna,
-- entao o planejador percorre o indice na ordem final e ja aplica o LIMIT da
-- paginacao, sem passo de ordenacao. `GET /api/admin/leads/export` usa os
-- mesmos filtros e aproveita o mesmo indice.
create index leads_created_at_desc_idx
  on public.leads (created_at desc);
