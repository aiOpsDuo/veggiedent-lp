> **Histórico.** Estes arquivos vinham do tempo em que o vídeo era servido de
> `apps/lp/public/videos/`. O CMS **não tem campo de miniatura**: a imagem
> exibida antes de um vídeo tocar é o primeiro quadro do próprio arquivo (ver o
> README, "Vídeo: o que o operador envia, e por que não existe campo de
> miniatura"). Nada aqui é usado pela página.

Frame estatico real de cada video, extraido localmente (ex.: primeiro frame
ou um frame representativo), para uso como thumbnail antes do play
(Especificacao Funcional, secao 6.6 e 14):

- tutor-abrindo-petisco.jpg
- cachorro-ganhando-petisco.jpg

Enquanto ausentes, o VideoPlayer usa o proprio elemento <video> sem poster
(nao ha imagem de fundo generica no lugar).
