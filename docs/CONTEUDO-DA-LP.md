# O conteúdo da landing page

## De onde a LP tira o conteúdo

A landing page **não tem mais texto nem imagem escritos em código**. Toda seção lê
`GET /api/content` — uma resposta só, com as seções publicadas e os metadados da página
(SDD § "Endpoints públicos"). O comando abaixo confirma que não sobrou nenhum arquivo de
conteúdo:

```bash
find apps/lp/src -name "*.content.ts"   # não retorna nada
```

Como isso está montado, em quatro peças pequenas dentro de `apps/lp/src/content/`:

| Arquivo | Papel |
|---|---|
| `published-content.ts` | Os tipos da resposta, derivados de `@veggiedent/content-schema`. A LP não redeclara a forma do conteúdo: um campo novo no esquema aparece aqui sozinho |
| `fetch-published-content.ts` | A leitura HTTP. Nunca lança: API fora do ar, `500` ou corpo ilegível viram todos `null`, porque os três têm o mesmo destino |
| `PublishedContentProvider.tsx` | O estado da página. Começa pelo instantâneo embutido e troca pelo conteúdo da API quando ela responde |
| `connect-section.tsx` | Liga um componente de seção à sua chave. Seção que a API não entrega (porque está despublicada) simplesmente não é renderizada — nem o título |

Cada seção virou um componente **apresentacional**, que recebe o documento pronto por
propriedade e não sabe de rede, de contexto nem de ausência. É o que permite montar a
página inteira em teste sem nenhum servidor.

O endereço é relativo (`/api/content`), porque LP e API compartilham domínio: `/` serve a
página e `/api/*` alcança a API, tanto na entrada única de desenvolvimento quanto em
produção. `VITE_CONTENT_ENDPOINT` troca o endereço quando for preciso apontar para outra
API.

**Campo de texto rico na página.** O título da Prova de Autoridade vem do CMS como HTML e é
desenhado por `components/ui/RichText.tsx`, que sanitiza e reconstrói o conteúdo em elementos
React — o trecho marcado em negrito recebe o destaque da seção, e a seção decide como a quebra
de linha é desenhada (no título da Prova de Autoridade, só a partir de `lg`). Ver [PAINEL.md, "Texto rico:
o que o operador vê e o que o HTML pode ter"](PAINEL.md).

**Uma seção despublicada some da página.** Desligar a visibilidade de uma seção no painel a
tira de `GET /api/content` e, com isso, da página — sem apagar o conteúdo guardado. Religá-la
é o que a traz de volta.

## Instantâneo de conteúdo

O requisito do PRD é que **a indisponibilidade do CMS não derrube a página pública**. Quem
cumpre isso é o instantâneo (SDD § D-08): uma cópia do conteúdo publicado, versionada em
`apps/lp/src/content/content-snapshot.json` e embutida no build.

A página **renderiza a partir dele imediatamente**, sem esperar rede, e o substitui assim
que a busca responde. Se a busca não responder, nada acontece: o visitante continua vendo a
página inteira, com o conteúdo do último instantâneo, em vez de tela vazia ou quebrada.
Renderizar por ele primeiro também é o que permite ao navegador começar a baixar a imagem da
abertura no primeiro quadro, em vez de esperar uma ida à API.

**Como é gerado**, com a API no ar:

```bash
npm run instantaneo                      # lê http://localhost:5173/api/content
npm run instantaneo -- https://.../api/content   # ou de outro ambiente
```

O script recusa gravar uma resposta que não seja JSON, que não traga `sections` ou que venha
sem nenhuma seção publicada — um instantâneo vazio seria pior do que nenhum, porque a página
de reserva ficaria em branco em silêncio, e só quem abrisse o site durante uma queda
descobriria. Em qualquer recusa o arquivo anterior é mantido.

**Ele não é gerado durante o `npm run build`**, de propósito: o build precisa passar sem rede
(integração contínua, máquina de quem desenvolve), e o conteúdo de reserva precisa ser
revisável no diff de quem publica.

**Quando regenerar:** antes de publicar, depois de o conteúdo mudar no painel. O instantâneo
envelhece entre builds — é o custo aceito em D-08, e ele só aparece enquanto a API estiver
fora do ar. Um instantâneo velho não afeta a página quando a API responde: ela é sempre a
fonte, e o arquivo é só a reserva.

## O que continua importado em código, de propósito

Cinco imagens não passaram para o CMS, por decisão do usuário — não é esquecimento:

| Onde | Arquivo | Por quê |
|---|---|---|
| Abertura | `hero/grupo-bandeiras.png` | Arte de campanha, junto do texto "A marca N.1 no Brasil, EUA e Europa" escrito no componente (registrado em `agent_context/CHANGELOG.md`, 2026-09-03) |
| Prova de autoridade | `prova-autoridade/01_formato_em_z.svg`, `02_halito_causas_digestivas.svg`, `03_origem_100_vegetal.svg` | São claims de produto, e o texto que os acompanha ("Formato em Z:" e afins) também vive em `ProductDifferentials.tsx`. Torná-los editáveis exigiria campos de imagem **e** de texto (2026-09-03) |
| Cabeçalho e rodapé | `logos/veggiedent-fresh-edc-logo.svg` | Ativo de marca que nunca muda, mesmo motivo dos dois itens acima — não faz sentido reeditar o logo pelo painel. Cabeçalho e rodapé já tinham saído do CMS inteiros (T28/T32); até então o logo ficava fixo em código como uma **URL do Supabase**, resquício da migração — passou a ser arquivo local importado (2026-09-08) |

Tudo o mais que aparece na página — foto da abertura, packshot, cards, passos da rotina,
kit de imagens, mosaico do formulário, logos dos parceiros e vídeos — vem do CMS.

**O pôster do banner de vídeo deixou de existir**, primeiro como arquivo e depois como campo.
Ele era `demonstracao/video-banner-poster.jpg`; hoje o banner tem **mídia própria no CMS** —
vídeo ou imagem, à escolha do operador — e **nenhum vídeo do CMS pede miniatura**, porque a
imagem de espera é o primeiro quadro do próprio arquivo (decisão do usuário, 2026-09-03; ver
"Vídeo: o que o operador envia"). As duas miniaturas que estavam cadastradas
(`tutor-abrindo-petisco.jpg` e `cachorro-ganhando-petisco.jpg`) continuam registradas como
mídia, agora **sem nenhuma referência** — apagá-las é decisão à parte.

**Identificador do vídeo nos eventos de analytics.** O esquema não tem — nem deve ter — um
campo de identificador técnico. `video_start` e `video_progress` usam o **nome do arquivo**
enviado, que é o dado mais estável da seção: o título é texto editável e a posição na lista
é reordenável, e qualquer um dos dois quebraria a série histórica ao ser mexido no painel.
Os identificadores mudaram em relação aos que estavam escritos em código
(`tutor-abrindo-petisco` virou `tutorabrindopetiscoecachorrocomendo`).

## Popular um ambiente novo a partir do instantâneo

Um projeto Supabase recém-criado — ou um cujas tabelas foram zeradas — deixa o painel sem
nada, e redigitar o conteúdo à mão não é opção. A carga resolve isso lendo o **instantâneo
versionado** e gravando **pelos mesmos endpoints administrativos que o painel usa**, com token
de operador de verdade: não há atalho até o banco, e um documento fora de forma é recusado com
`422` do mesmo jeito que seria para quem edita pelo painel.

```bash
npm run build -w apps/api                # compila a API e a carga
npm run migrate:content -w apps/api      # popula o CMS
```

O que a carga precisa no ambiente (ela lê `apps/api/.env` se ele existir):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | Projeto Supabase de **destino**, o mesmo que a API está usando |
| `CMS_API_URL` | não | Raiz da API, com prefixo. Padrão `http://localhost:3000/api` |
| `CMS_ACCESS_TOKEN` | — | Token de um operador. No lugar dele, as três abaixo |
| `CMS_OPERATOR_EMAIL`, `CMS_OPERATOR_PASSWORD` | — | Operador já criado no Supabase Auth |
| `SUPABASE_PUBLISHABLE_KEY` | — | Chave publicável, usada só para trocar e-mail e senha por token |
| `CONTENT_SNAPSHOT` | não | Caminho de outro instantâneo. Padrão: o do repositório |

**Antes de rodar, crie um operador** — a carga escreve como um operador escreveria, e a guarda
global da API nega por padrão. Ver [PAINEL.md, "Como criar e remover um operador"](PAINEL.md).

**Rodar duas vezes não duplica nada.** A carga substitui: uma seção é uma linha só, pela chave,
e os metadados são um registro único. As mídias são o caso que exige cuidado, porque o
instantâneo guarda **URLs públicas** e as tabelas guardam **identificadores** — uma mídia
enviada duas vezes viraria dois registros e dois arquivos. A conciliação tenta três caminhos,
nesta ordem, e o relatório final diz quantas mídias vieram de cada um:

| Caminho | Quando serve | O que acontece |
|---|---|---|
| Registro existente | O arquivo do instantâneo está no armazenamento de destino, no mesmo caminho | Reaproveita (ou registra) a mídia daquele caminho. Nenhum byte se move |
| Documento gravado | O campo já aponta para uma mídia com o mesmo nome de arquivo | Reaproveita o identificador. É o que sustenta a segunda execução |
| Baixar e reenviar | Nenhum dos dois — o caso do projeto novo | Baixa da URL pública do instantâneo e sobe pelo fluxo de três passos de mídia |

**Depois de popular um projeto novo, regenere o instantâneo** (`npm run instantaneo`): os
arquivos ganharam caminhos novos no projeto de destino, então as URLs do instantâneo antigo
apontam para o projeto de origem. Com o instantâneo regenerado, uma carga futura no mesmo
projeto reaproveita os arquivos que já estão lá em vez de reenviá-los.

**Três limites conhecidos, todos por consequência de o instantâneo ser a forma publicada:**

- **O que estava despublicado não está no instantâneo** — nem seção, nem item de lista. Uma
  seção ausente do instantâneo termina desligada no CMS semeado, e seu conteúdo não é
  inventado. Itens de lista ocultos não voltam.
- **Os bytes precisam vir de algum lugar.** No projeto novo eles vêm das URLs públicas do
  instantâneo, o que exige que o projeto de origem ainda esteja no ar. Não há cópia dos
  arquivos no repositório desde a T14.
- **Rodar contra um CMS já populado o converge para o instantâneo.** É a ferramenta de
  popular um ambiente, não de mesclar conteúdo: uma edição feita no painel depois do último
  `npm run instantaneo` é sobrescrita.

## Migração inicial do conteúdo (histórico)

O conteúdo da landing page nasceu em código: 12 arquivos `*.content.ts`, mais as imagens que
os componentes importavam direto e dois vídeos servidos de `apps/lp/public/videos/`. A T9 e a
T19 levaram tudo isso para o CMS **uma vez**, por um script que executava aqueles arquivos e
gravava o resultado pelos mesmos endpoints do painel — o mesmo comando e o mesmo lugar no
código que a carga de hoje ocupa, mas lendo os arquivos de conteúdo em vez do instantâneo.

**A T14 aposentou o script junto com os arquivos que ele lia.** Sem os `*.content.ts` não há
o que migrar: o CMS passou a ser a fonte do conteúdo, e o instantâneo é o que preserva uma
cópia utilizável dele dentro do repositório — é justamente a fonte que a carga de hoje lê
(ver "Popular um ambiente novo", acima). Foram removidos com ele o teste de cobertura
dos esquemas sobre os arquivos de conteúdo (`packages/content-schema/tests/content-coverage.test.ts`,
critério de "pronto" da T2) e a suíte de ponta a ponta da migração — todos exercitavam
arquivos que não existem mais. O histórico da execução continua registrado em "Estado
verificado" e em `agent_context/PLAN.md`.

O que a carga inicial produziu, e que segue valendo:

| Item | Estado no CMS |
|---|---|
| FAQ, *"A partir de que idade…"* | Item não publicado, com o texto guardado para o operador substituir |
| FAQ, *"Onde posso comprar Veggiedent?"* | Item não publicado, na posição em que o autor o deixou |
| `capturaLead.ebookTitle` | Ausente do documento: a Virbac não entregou o dado, e campo sem valor real é omitido, nunca preenchido |
| **Kit de imagens** (prova de autoridade) | Campo de imagem informativa, com texto alternativo obrigatório |
| **Fotos do mosaico** (captura de lead) | Lista de 6 imagens **decorativas**: sem campo de descrição, exibidas com texto alternativo vazio e escondidas de leitores de tela, como a página sempre fez |

## Pendências herdadas do projeto atual

Itens que já eram pendência antes do CMS e continuam abertos:

- **Imagem de compartilhamento social (`og:image`)** ainda não aprovada pela Virbac. Passa a ser editável pelo painel quando chegar. A migração inicial **não** a inventa: `index.html` declara a pendência num comentário e o campo fica vazio no CMS.
- **Dados legais da Virbac Brasil** (CNPJ e afins) pendentes no rodapé.
- **Faixa etária recomendada** no FAQ aguarda material técnico da Virbac; migrada como item não publicado.
- **Imagens que ficam em código, por decisão.** A T2 escopou os esquemas nos 12 `*.content.ts`, e as imagens que os componentes importam direto ficaram fora. O usuário decidiu ponto a ponto em 2026-09-03 (ver `agent_context/CHANGELOG.md`): o `Kit-de-imagens.png` e as seis fotos do mosaico do formulário **passaram ao CMS** na T19; o `grupo-bandeiras.png` do herói e os três infográficos SVG de `ProductDifferentials.tsx` **permanecem em código** — os infográficos trazem junto um copy também escrito no componente, e os quatro são claims e arte de campanha sob controle de quem edita o código. O pôster do banner de vídeo deixou de ser imagem própria na T14 e, na T24, deixou de ser campo: o banner passou a ter mídia própria (vídeo ou imagem) e nenhum vídeo pede miniatura. Ver "O que continua importado em código, de propósito".
