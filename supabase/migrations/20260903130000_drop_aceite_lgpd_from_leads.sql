-- Remove a coluna `aceite_lgpd` da tabela `leads`.
-- Rastreavel a: SDD § "Modelo de dados" (nota "Por que nao existe coluna
-- `aceite_lgpd`"), § RN-01 e § C-12; PLAN.md § T18.
--
-- A coluna nao guardava informacao: o consentimento com a Politica de
-- Privacidade e condicao de envio, e nao um dado que varia. Sem ele
-- `POST /api/leads` recusa com 422 e nenhuma linha nasce — entao toda linha
-- existente tinha `aceite_lgpd = true`, uma constante. A prova de consentimento
-- e a propria existencia do registro somada a `created_at`.
--
-- A validacao que exige o consentimento PERMANECE na API. O que esta migracao
-- desfaz e apenas a gravacao do resultado dela.
--
-- Se um dia for preciso provar a QUE TEXTO a pessoa consentiu (cenario real
-- depois de a Politica de Privacidade mudar), o campo correto a criar e a
-- versao do texto aceito, nao um booleano que so pode ser verdadeiro.

alter table public.leads
  drop column if exists aceite_lgpd;
