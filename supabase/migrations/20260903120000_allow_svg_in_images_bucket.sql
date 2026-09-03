-- `image/svg+xml` passa a ser aceito no bucket de imagens.
-- Rastreavel a: CHANGELOG de 2026-09-02 ("Tres decisoes do usuario"), decisao 1.
--
-- POR QUE A LISTA MUDA
--   A migracao 20260902120500 deixou SVG de fora com a justificativa de que
--   nenhuma secao da LP precisaria dele. A T9 mediu o repositorio e a premissa
--   estava errada: a landing page usa quatro SVGs reais — o logo Veggiedent,
--   referenciado pelo cabecalho e pelo rodape, e tres infograficos da secao de
--   prova de autoridade. O logo e um ativo de marca; rasteriza-lo para PNG
--   custou 8,7 KB -> 35 KB e perdeu escalabilidade em tela de alta densidade.
--
-- POR QUE O RISCO E CONTIDO
--   SVG continua sendo documento executavel, mas os dois fatores que tornariam
--   isso perigoso nao existem aqui:
--
--   1. Quem envia. Nao ha upload anonimo. So um operador autenticado obtem
--      credencial de escrita (SDD § D-05), e `storage.objects` nao tem policy
--      de insert para `anon` nem para `authenticated` — toda escrita passa pela
--      chave secreta do servidor.
--   2. De onde e servido. O arquivo sai do dominio do Supabase Storage, nao do
--      dominio da landing page. Um script embutido no SVG roda, se rodar, na
--      origem do Storage: nao alcanca o DOM da LP, nem seus cookies, nem sua
--      sessao. A LP consome esses arquivos por `<img src>`, contexto em que o
--      navegador ja nao executa script do SVG.
--
--   O limite de 10 MB e a policy de leitura publica permanecem como estavam:
--   esta migracao muda uma lista de tipos, nada alem disso.
--
-- `update` em vez de reescrever o `insert` da migracao anterior: uma migracao
-- ja aplicada nao volta atras, e o historico precisa dizer que a lista mudou e
-- por que. `where` restrito ao bucket de imagens — video e legenda nao mudam.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml'
]
where id = 'veggiedent-images';
