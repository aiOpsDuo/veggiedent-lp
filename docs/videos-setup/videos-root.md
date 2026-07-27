Os 2 vídeos oficiais confirmados (PRD v1.2, seção 9.4 / Checklist de Assets
Pendentes v1.2) estão presentes neste diretório:

- TutorabrindoPetiscoEcachorroComendo.mp4 (~19s, 4K, ~24,7 MB)
- cachorroGanhadoPetisco.mp4 (~6s, 4K, ~111,9 MB)

Servidos como assets públicos estáticos (Vite copia `public/` verbatim para a
raiz do `dist/`), por isso o componente Demonstracao referencia URLs fixas
`/videos/<arquivo>.mp4` — não precisam de import, e o caminho é o mesmo em
dev e em produção.

Pendente (ver Checklist de Assets Pendentes v1.2): legendas em português
(.vtt) em `captions/` e thumbnails estáticos em `thumbnails/` — o player
funciona normalmente sem eles (sem poster, sem legenda) até que cheguem.
