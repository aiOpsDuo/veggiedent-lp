# A API do CMS

Rotas, comportamentos comuns, o fluxo de envio de mídia e as regras de captura e exportação de leads. O contrato canônico é o [SDD § "Contratos de dados/API/interfaces"](../agent_context/SDD.md).

Prefixo `/api` em todas as rotas. Os exemplos de `curl` desta seção falam direto com a API, na porta 3000; pela entrada única de
desenvolvimento as mesmas rotas respondem em `http://localhost:5173/api/…`. A guarda de autenticação é **global e nega por padrão** (SDD § D-03): as rotas públicas da primeira tabela são as únicas marcadas com `@Public()` no código, e qualquer rota nova nasce exigindo token.

**Públicos — nenhum token, consumidos pela LP e pelo injetor de SEO:**

| Método e rota | O que faz |
|---|---|
| `GET /api/health` | Sonda de operação. Responde `{"status":"ok"}`. |
| `GET /api/content` | Todo o conteúdo publicado em **uma** resposta: `{ sections, metadata }`. Seções não publicadas e itens de lista não publicados são **omitidos**; os itens vêm na ordem definida no painel. |
| `GET /api/seo` | Só os metadados da página, para o injetor de borda: `{ title, description, ogImageUrl, canonicalUrl }`. Campos ausentes vêm `null`, para que o injetor use a reserva do HTML estático em vez de falhar. |
| `POST /api/leads` | Recebe o formulário da LP: valida e **grava o lead**. Responde `200 {"success":true}`; dados inválidos respondem `422` com erro por campo; falha de gravação responde `500`, porque o lead se perderia. Ver "Captura e consulta de leads". |

**Exigem token** — cabeçalho `Authorization: Bearer <token do Supabase Auth>`. Sem token, ou com token inválido ou expirado, respondem `401 {"statusCode":401,"error":"Autenticação necessária."}`:

| Método e rota | O que faz |
|---|---|
| `GET /api/admin/sections` | Lista as **9** seções na ordem da página, com `isPublished` e `updatedAt`. Aparecem todas mesmo antes de existir documento salvo (`updatedAt: null`). |
| `GET /api/admin/sections/:key` | Documento completo da seção, publicado ou não. |
| `PUT /api/admin/sections/:key` | Substitui o documento. Valida contra `packages/content-schema`; **salvar publica**. |
| `PATCH /api/admin/sections/:key/visibility` | Corpo `{ "isPublished": true \| false }`. Liga ou desliga a seção sem apagar o conteúdo. |
| `GET /api/admin/metadata` | Metadados da página na forma que o painel edita. |
| `PUT /api/admin/metadata` | Grava os metadados. Mesma validação por esquema das seções. |
| `POST /api/admin/media/upload-url` | Recebe `{ originalFilename, contentType, sizeBytes }` e devolve a credencial temporária e o caminho de destino. **Não** recebe o arquivo. |
| `POST /api/admin/media` | Confirma o upload e registra a mídia. Devolve o registro com a URL pública. |
| `GET /api/admin/media/:id` | Registro de uma mídia. |
| `DELETE /api/admin/media/:id` | Remove registro e arquivo. Responde `409` quando a mídia está em uso. |
| `GET /api/admin/leads` | Lista os leads, **do mais recente ao mais antigo**, paginada. Parâmetros `from`, `to`, `page` e `pageSize`. Devolve `{ leads, total, page, pageSize }`. |
| `GET /api/admin/leads/export` | Exportação em CSV dos leads do período, com os mesmos filtros `from` e `to` da listagem. |
| `DELETE /api/admin/leads/:id` | Exclusão **definitiva** de um lead, a pedido do titular (LGPD). Responde `204`; identificador inexistente ou malformado responde `404`. |

O contrato completo está no [SDD § "Contratos de dados/API/interfaces"](../agent_context/SDD.md).

Comportamentos que valem para todas as rotas administrativas de conteúdo:

- **Chave de seção fora das 9 conhecidas responde `404` e nunca cria registro.** O conjunto é fechado: o CMS edita seções existentes, nunca cria tipos novos. Uma chave inválida não chega sequer a tocar o banco.
- **Nenhuma gravação escapa da validação de esquema** (risco R-03 do SDD). Documento inválido responde `422` com erro por campo, no caminho do campo:
  ```json
  { "statusCode": 422, "error": "Dados inválidos.",
    "fields": { "faq.heading": "Campo obrigatório.",
                "faq.items.0.question": "Campo obrigatório." } }
  ```
  Campo que não existe no esquema também é recusado, em vez de gravado em silêncio.
- **`PATCH .../visibility` em uma seção que nunca foi salva responde `404`.** Publicá-la significaria criar um documento vazio, que é exatamente a forma inválida que a validação existe para impedir — grave a seção primeiro.
- **Mensagens de validação em português**, inclusive as que o `class-validator` produz sozinho. Coberto por teste de guarda que varre os DTOs (`apps/api/test/mensagens-em-portugues.spec.ts`).
- **`GET /api/content` faz uma consulta às seções, não uma por seção** (risco R-05). No máximo três no total — uma por tabela envolvida: `content_sections`, `site_metadata` e `media_assets`. O número não cresce com a quantidade de seções, de itens nem de imagens, e está preso por teste.

## Como as referências de mídia aparecem na resposta

Um campo de imagem ou vídeo guarda no banco o **identificador** da mídia, nunca um endereço digitado (SDD § "Contrato do esquema de seção"). As duas saídas da API entregam formas diferentes desse mesmo campo, e a diferença é proposital:

| Saída | O que o campo de mídia traz | Por quê |
|---|---|---|
| `GET /api/content` e `GET /api/seo` (públicas) | A **URL pública** do arquivo | Quem consome é a LP e o injetor de SEO, que precisam de um endereço para `<img src>`, `<video src>` e `og:image`. Um identificador não é renderizável, e a LP nunca fala com o Supabase para resolvê-lo (SDD § C-06, C-07 e C-10). |
| `GET /api/admin/sections/:key` e `GET /api/admin/metadata` (com token) | O **identificador** guardado | Quem consome é o painel, que edita a referência e a devolve no `PUT`. Trocar o identificador pela URL na tela de edição faria o painel gravar um endereço digitado, exatamente o que o esquema proíbe. |

A resolução acontece **dentro da API**, na leitura, e vale tanto para campo de topo (`hero.image`, `header.logo`) quanto para campo de item de lista (vídeos, cards, passos, parceiros).

```jsonc
// GET /api/content — recorte
{ "sections": {
    "hero": { "image": "https://…/storage/v1/object/public/imagens/hero.png",
              "imageAlt": "Cão recebendo o petisco" },
    "demonstracao": { "bannerVideo": "https://…/videos/banner.mp4",
                      "videos": [ { "video": "https://…/videos/demo.mp4" } ] } },
  "metadata": { "ogImage": "https://…/imagens/compartilhamento.png" } }
```

**Mídia ausente ou apagada não quebra a resposta:** o campo simplesmente **não aparece** no documento publicado — a API nunca entrega um identificador cru a quem espera um endereço, e a LP já trata campo ausente como vazio (risco R-03). Vale a regra: *na saída pública, um campo de mídia ou é uma URL, ou não existe*. O texto alternativo, que é texto e não mídia, continua vindo intacto ao lado.

Uma consulta resolve **todas** as mídias da página de uma vez, e nenhuma consulta é feita quando o conteúdo publicado não referencia mídia; mídia de seção ou de item despublicado não é sequer buscada (risco R-05).

## Envio de mídia em três passos

Os bytes de um arquivo **nunca passam pela API** (SDD § D-05). Vídeos chegam a dezenas de MB, e fazê-los atravessar a API significaria requisição longa, memória consumida e o limite de corpo de requisição da plataforma. O painel faz três chamadas:

**1. Pedir a credencial.** A API recusa aqui o que não pode ser guardado — tipo não suportado ou arquivo acima do limite do bucket — antes de qualquer byte sair da máquina do operador:

```bash
curl -s -X POST http://localhost:3000/api/admin/media/upload-url \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"originalFilename":"Demonstração.mp4","contentType":"video/mp4","sizeBytes":24741168}'
```

```jsonc
{ "kind": "video", "bucket": "veggiedent-videos",
  "path": "676edef9-…/demonstracao.mp4",
  "signedUrl": "https://…/storage/v1/object/upload/sign/veggiedent-videos/…?token=…",
  "token": "…",                       // o mesmo direito de escrita, para o upload retomável
  "resumableEndpoint": "https://…/storage/v1/upload/resumable/sign",
  "expiresInSeconds": 7200, "maxBytes": 524288000 }
```

**2. Enviar os bytes, do navegador direto ao armazenamento.** Dois caminhos, ambos com a credencial acima e **sem** passar pela API:

- *Arquivo pequeno* (imagem): `PUT` no `signedUrl`, com o `content-type` do arquivo — é o que o `uploadToSignedUrl(path, token, file)` do `@supabase/supabase-js` faz.
- *Vídeo*: protocolo retomável (TUS) apontado para `resumableEndpoint`, com o token no cabeçalho **`x-signature`**, blocos de **6 MB** e os metadados `bucketName`, `objectName` e `contentType`. Retomável é o que permite continuar de onde parou depois de uma queda de conexão, e é o que dá o progresso visível que o painel mostra. Quem faz esse papel no painel é o `tus-js-client`, a biblioteca que a própria documentação do Supabase Storage indica; a escolha entre este caminho e o `PUT` acima é feita pela natureza da mídia, em `apps/admin/src/media/media-transfer.ts`.

**3. Confirmar.** Só agora nasce o registro em `media_assets` (risco R-04):

```bash
curl -s -X POST http://localhost:3000/api/admin/media \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"kind":"video","path":"676edef9-…/demonstracao.mp4",
       "originalFilename":"Demonstração.mp4","width":1080,"height":1920,"durationSeconds":12.4}'
```

A API pergunta ao armazenamento se o arquivo está lá; se não estiver, responde `422` e **não grava nada**. Tamanho e tipo do registro são lidos do arquivo que chegou, não do corpo da requisição — quem confirma não consegue registrar uma mídia que não existe nem descrevê-la de forma diferente do que ela é. Confirmar duas vezes o mesmo caminho devolve o registro que já existe, sem duplicar.

A chave secreta do Supabase **não sai do servidor** em nenhum dos três passos: o navegador recebe apenas uma credencial válida para um caminho, em um bucket, por duas horas.

**Buckets, limites e tipos aceitos** (criados por `20260902120500_create_storage_buckets.sql` e alterados por `20260903120000_allow_svg_in_images_bucket.sql`; o catálogo em `apps/api/src/modules/media/domain/media-kind.ts` repete os mesmos valores e um teste lê as migrações em ordem e compara os dois). O bucket `veggiedent-captions` (natureza `caption`, tipo de campo "legenda") foi removido na T31 — nunca teve arquivo real (0 registros) e o campo saiu do esquema inteiro; ver `20260904160000_remove_captions_media_kind.sql`:

| Natureza | Bucket | Limite | Tipos aceitos |
|---|---|---|---|
| `image` | `veggiedent-images` | 10 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, `image/svg+xml` |
| `video` | `veggiedent-videos` | 500 MB | `video/mp4`, `video/webm` |

**Por que SVG é aceito.** Ele ficou de fora na criação dos buckets, com a justificativa de que nenhuma seção precisaria dele. A premissa estava errada: a LP usa quatro SVGs reais — o logo Veggiedent, no cabeçalho e no rodapé, e três infográficos da prova de autoridade. Rasterizar o logo custaria 8,7 KB → 35 KB e a escalabilidade de um ativo de marca. SVG continua sendo documento executável, mas aqui o risco é contido por dois fatos: **só operador autenticado envia arquivo** (não existe upload anônimo, e `storage.objects` não tem policy de escrita), e o arquivo é **servido do domínio do Supabase Storage**, não do domínio da LP — um script embutido não alcançaria o DOM da página, seus cookies ou sua sessão, e a LP carrega essas imagens por `<img src>`, contexto em que o navegador já não executa script do SVG.

A natureza é **deduzida do tipo do arquivo**, não escolhida por quem envia: cada tipo pertence a um único bucket. Tipo fora da lista é recusado com `422` e a mensagem `Tipo de arquivo não suportado. Tipos aceitos: …` no campo `contentType`.

> **Limite do projeto, acima do limite do bucket.** O projeto Supabase tem um teto global de upload — hoje **50 MB** neste projeto, verificado em 2026-09-02 — que **prevalece sobre os 500 MB do bucket de vídeo**: um arquivo maior é recusado pelo próprio armazenamento com `413 Maximum size exceeded`, antes de qualquer byte ser aceito. Os vídeos que a LP usa hoje têm 23,6 MB e 4,2 MB, então nada está bloqueado — mas se um vídeo maior que 50 MB precisar entrar, o teto tem de ser elevado em *Project Settings → Storage → Upload file size limit* (o plano Free trava em 50 MB; os pagos vão até 50 GB). O código não contorna isso, e não deve: quem manda no armazenamento é o armazenamento.

**Remoção.** `DELETE /api/admin/media/:id` responde `409` se a mídia estiver referenciada por qualquer seção — **publicada ou não**, porque uma seção desligada precisa voltar idêntica — ou pelos metadados da página; nesse caso nada é apagado. Sem referências, o registro sai primeiro e o arquivo depois: na ordem inversa, uma falha no meio deixaria um registro apontando para arquivo inexistente, e a LP com imagem quebrada.

Exemplo de chamada autenticada:

```bash
curl -s -X PUT http://localhost:3000/api/admin/sections/faq \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"heading":"Perguntas frequentes","items":[{"visivel":true,"ordem":0,"question":"Pergunta?","answer":"Resposta."}]}'
```

## Captura e consulta de leads

> **O banco do CMS é o único sistema de registro do lead.** Até 2026-09-03 o lead
> tinha dois destinos — este banco e o RD Station —, e boa parte do desenho existia
> para que a falha de um não perdesse o dado. Com a integração descontinuada, **não
> há mais cópia em lugar nenhum**. Duas consequências práticas, e nenhuma delas é
> teórica:
>
> - **Backup do banco deixa de ser higiene e passa a ser a única rede de proteção.**
>   Uma tabela `leads` perdida é um conjunto de leads perdido, ponto.
> - **A exportação em CSV deixa de ser conveniência e passa a ser o mecanismo de
>   saída do dado** — é por ela que o lead sai do CMS para quem trabalha com ele.
>   Exportar com regularidade é parte da operação, não um extra.
>
> Qualquer migração que toque a tabela `leads` merece esse mesmo peso.

**A ordem de `POST /api/leads` é a regra, não detalhe de implementação:**

1. **Honeypot.** O formulário tem um campo invisível (`website`). Preenchido, a resposta é **sucesso** e nada acontece: nenhum lead é gravado. Responder erro ensinaria ao robô que o campo existe.
2. **Validação.** Nome não vazio, e-mail com forma de e-mail, consentimento LGPD marcado e porte dentro de `pequeno | medio | grande`. São as regras do relay serverless aposentado, preservadas. Recusa responde `422` com as chaves `nome`, `email`, `aceite_lgpd` e `porte_cachorro` em `fields`, que é como o formulário da LP marca o campo errado.
3. **Gravação.** É o **único** destino do lead, e o último passo. Se ela falhar, o visitante vê `500` — e tem de ser assim: responder sucesso a um lead que não foi gravado o perderia em silêncio, sem nenhum segundo sistema de onde recuperá-lo. Não há `catch` em volta da gravação, e há teste de regressão provado por mutação para que não volte a haver.

**Os três campos que se perdiam em produção.** `conheceVirbac`, `usaProdutoVirbac` e `qualProdutoVirbac` eram coletados pelo formulário e descartados antes do envio pelo relay serverless — risco R-01 do SDD. Neste endpoint eles são gravados como `conhece_virbac`, `usa_produto_virbac` e `qual_produto_virbac`, e saem no CSV.

**Filtros `from` e `to`** são dias no formato `AAAA-MM-DD`, **inclusivos nos dois extremos**: `from=2026-09-01&to=2026-09-03` traz também o lead enviado às 23h50 do dia 3. Data fora do formato, dia inexistente no calendário (`2026-02-31`) e período invertido respondem `422`.

**O dia é o de Brasília (UTC−3), não o de UTC.** O recorte é feito no fuso de quem opera o painel: um lead enviado às 23h de 2 de setembro entra no filtro do dia 2, ainda que o banco o guarde como 3 de setembro às 02h em UTC. `from=2026-09-02&to=2026-09-02` vira, para o banco, o intervalo `2026-09-02T03:00:00.000Z` a `2026-09-03T02:59:59.999Z`. O deslocamento é fixo em −03:00 porque o Brasil não observa horário de verão desde 2019; se voltar a observar, a mudança é em um lugar só (`apps/api/src/modules/leads/domain/brasilia-time.ts`), que é o mesmo módulo de onde a data do CSV sai.

**Paginação:** `page` a partir de 1 (padrão 1) e `pageSize` de 1 a 200 (padrão 50). Página além da última devolve lista vazia com o `total` correto, nunca erro.

**O CSV abre no Excel em português.** Três decisões, cada uma resolvendo um jeito específico de o arquivo chegar errado: **BOM UTF-8** no início (sem ele, "Comunicações" vira "ComunicaÃ§Ãµes" no Windows), **ponto e vírgula** como separador (na configuração regional pt-BR a vírgula é separador decimal, e com ela a planilha inteira cai numa coluna só) e fim de linha **CRLF**. A data sai como `02/09/2026 23:00:00`, em **horário de Brasília** — o mesmo fuso do filtro de período e o mesmo que a tela do painel mostra. Em UTC esse lead apareceria como 3 de setembro na planilha e como 2 de setembro na tela: um lead, duas datas. Uma célula que começaria por `=`, `+`, `-` ou `@` recebe um apóstrofo à frente: o conteúdo do lead é texto que um desconhecido digitou num formulário público, e sem isso a planilha executaria a célula como fórmula ao abrir o arquivo. A exportação é limitada a 10.000 linhas por chamada, porque o arquivo é montado em memória antes de ser enviado.

**As colunas do CSV são as da regra de negócio RN-01**, nesta ordem — uma por campo que o visitante preenche, mais as operacionais que acompanham o registro:

| # | Coluna | Conteúdo |
|---|---|---|
| 1 | `Data de envio (Brasília)` | Instante do envio, em horário de Brasília, como `02/09/2026 23:00:00` |
| 2 | `Nome` | Obrigatório no formulário |
| 3 | `E-mail` | Obrigatório no formulário |
| 4 | `Telefone` | Vazio quando não preenchido |
| 5 | `Nome do cachorro` | Vazio quando não preenchido |
| 6 | `Porte do cachorro` | `pequeno`, `medio` ou `grande` |
| 7 | `Cidade e estado` | Vazio quando não preenchido |
| 8 | `Conhece a Virbac` | Um dos três campos que o relay antigo descartava (R-01) |
| 9 | `Usa produto Virbac` | Idem |
| 10 | `Qual produto Virbac` | Idem |
| 11 | `Aceite de comunicações` | Opt-in de marketing: `sim` ou `não` |
| 12 | `Origem` | Origem declarada do envio |

São **12 colunas**. As duas do RD Station (`Status RD Station` e `Erro RD Station`) saíram em 2026-09-03, junto com a integração e com as colunas `rdstation_status` e `rdstation_error` da tabela.

**Por que não existe coluna — nem registro — de aceite da Política de Privacidade.** O consentimento é **condição de envio**, não dado do lead: sem ele `POST /api/leads` recusa com `422` e nenhuma linha nasce. Guardá-lo significaria gravar a constante `true` em toda linha, e exportar uma coluna que só pode dizer "sim" — informação zero, que não prova nada que a existência da própria linha, somada à data de envio, já não prove. Por isso a tabela `leads` **não tem** a coluna `aceite_lgpd` (removida pela migração `20260903130000_drop_aceite_lgpd_from_leads.sql`) e o arquivo exportado não tem a coluna correspondente. A validação que **exige** o consentimento continua exatamente onde estava, coberta por teste de regressão: o que deixou de existir é apenas a gravação do resultado dela. Se um dia for preciso provar **a que texto** a pessoa consentiu — cenário real depois de a Política de Privacidade mudar —, o campo correto a criar é a versão do texto aceito, não um booleano que só pode ser verdadeiro (ver `agent_context/CHANGELOG.md`, 2026-09-02).
