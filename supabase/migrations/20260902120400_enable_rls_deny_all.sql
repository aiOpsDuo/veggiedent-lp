-- Isolamento da superficie publica do banco.
-- Rastreavel a: SDD § "Modelo de dados" (Row Level Security) e § R-09.
--
-- REQUISITO: nenhum cliente alcanca o banco diretamente. Todo acesso passa
-- pela API usando a chave secreta do lado do servidor.
--
-- COMO ISTO E OBTIDO — e por que NAO existe nenhuma policy neste arquivo:
--
--   Uma tabela com Row Level Security habilitada e ZERO policies nega todas as
--   linhas para qualquer papel que nao tenha o atributo BYPASSRLS. Nao ha
--   policy a satisfazer, entao nenhuma linha e visivel e nenhuma escrita passa.
--   Negar tudo e o comportamento desejado aqui, nao um esquecimento: os papeis
--   `anon` e `authenticated` — os dois que o Supabase expoe pela Data API — nao
--   devem enxergar coisa alguma.
--
--   O papel `service_role`, usado exclusivamente pela API a partir de
--   SUPABASE_SECRET_KEY, tem BYPASSRLS e continua enxergando tudo. E esse o
--   unico caminho de acesso previsto pelo SDD.
--
-- ATENCAO A QUEM FOR MANTER ESTE ARQUIVO: acrescentar aqui uma policy para
-- `anon` ou `authenticated`, por mais restrita que pareca, abre um caminho de
-- acesso ao banco que contorna a API e quebra o requisito acima. Se surgir a
-- necessidade, ela e uma mudanca de arquitetura — trate no SDD antes do SQL.

alter table public.content_sections enable row level security;
alter table public.site_metadata    enable row level security;
alter table public.media_assets     enable row level security;
alter table public.leads            enable row level security;

-- Segunda barreira: retirar tambem os GRANTs de tabela.
--
-- A documentacao do Supabase e explicita em que habilitar RLS nao remove os
-- grants que os papeis ja tenham recebido — as duas coisas sao independentes.
-- Como o Supabase concede privilegios padrao a `anon` e `authenticated` sobre o
-- schema `public`, revogar deixa a negacao apoiada em dois mecanismos em vez de
-- um so. Se um dia alguem habilitar RLS de menos, ou criar uma policy por
-- engano, o grant ausente ainda barra a leitura.
--
-- O bloco e condicional porque `anon` e `authenticated` sao papeis do Supabase:
-- em um Postgres puro (usado para verificar estas migracoes localmente) eles
-- nao existem, e um REVOKE solto abortaria a migracao inteira.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.content_sections from anon;
    revoke all on public.site_metadata    from anon;
    revoke all on public.media_assets     from anon;
    revoke all on public.leads            from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.content_sections from authenticated;
    revoke all on public.site_metadata    from authenticated;
    revoke all on public.media_assets     from authenticated;
    revoke all on public.leads            from authenticated;
  end if;
end
$$;

-- `force row level security` NAO e aplicado de proposito: ele estenderia as
-- policies ao dono da tabela, que sem nenhuma policy passaria a nao enxergar as
-- proprias linhas — quebrando migracoes, backups e manutencao. O dono nao e uma
-- superficie exposta; `anon` e `authenticated` sao, e e neles que a negacao
-- precisa valer.
