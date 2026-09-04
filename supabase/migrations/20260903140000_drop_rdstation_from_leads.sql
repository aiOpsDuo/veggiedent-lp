-- Remove da tabela `leads` as colunas do repasse ao destino externo de
-- marketing, descontinuado pelo usuario em 2026-09-03.
-- Rastreavel a: agent_context/CHANGELOG.md (entrada de 2026-09-03),
-- PLAN.md § T26, SDD § "Modelo de dados", § C-11 e § RN-01.
--
-- CUIDADO AO REVISAR ESTA MIGRACAO: com a saida do destino externo, esta tabela
-- passa a ser o UNICO lugar onde o lead existe. Nao ha mais copia em outro
-- sistema. Por isso ela so derruba as duas colunas do repasse e as duas
-- restricoes que existiam por causa delas — nenhum dado do formulario e tocado,
-- e nenhuma linha e removida.
--
-- O que sai:
--   `rdstation_status` — resultado do repasse (ok | falhou | nao_enviado);
--   `rdstation_error`  — mensagem da falha do repasse.
-- Sem repasse, as duas so poderiam guardar 'nao_enviado' e a razao de nunca
-- haver tentativa: informacao zero, pelo mesmo motivo que aposentou
-- `aceite_lgpd` na T18.
--
-- As duas restricoes (`leads_rdstation_status_check` e
-- `leads_rdstation_error_absent_when_ok`) caem junto com as colunas, porque
-- `drop column` derruba as restricoes que dependem delas.
--
-- O que PERMANECE: todos os campos do formulario, `origem`, `created_at`, o
-- indice `leads_created_at_desc_idx` que serve a listagem e a exportacao, e a
-- politica RLS de negacao total.

alter table public.leads
  drop column if exists rdstation_status,
  drop column if exists rdstation_error;
