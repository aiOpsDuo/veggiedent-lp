# Manutenção

- **Adicionar um campo a uma seção:** edite um arquivo só — o esquema da seção em `packages/content-schema/src/sections/<secao>.ts`.

  1. Acrescente o campo ao array `fields` da seção, ou ao `itemFields` da lista quando o campo pertencer a um item (um card, um passo, um parceiro, uma pergunta). Um campo é `{ name, type, label, help, required }`: `label` e `help` são o que o operador lê no painel, em português — `help` diz onde o campo aparece na página, e é opcional só na forma, não na prática. Tipos disponíveis: `texto-curto`, `texto-longo`, `lista-de-textos`, `imagem`, `video`, `link`, `booleano`.
  2. Se o campo for uma imagem, não o declare à mão — use um dos construtores de `src/fields.ts`, e escolha entre os dois tratamentos de acessibilidade que o esquema admite:

     - **Imagem informativa** — `requiredImage({ ... })` ou `optionalImage({ ... })`. Emitem a imagem **e** o campo de texto alternativo obrigatório adjacente de uma vez. É o caso da maioria: a descrição é o que o leitor de tela anuncia no lugar da imagem.
     - **Imagem decorativa** — `decorativeImage({ ... })`. Emite só a imagem, sem campo de descrição, porque não há o que descrever: ela entra na página com texto alternativo vazio e escondida do leitor de tela. Descrever uma imagem decorativa é **pior** do que não descrevê-la — injeta ruído sem acrescentar significado. É o caso das fotos do mosaico do formulário.

     Um campo de imagem que não faz essa escolha é recusado pela invariante do esquema (`checkSchemaInvariants`), com o teste de `tests/invariants.test.ts` acusando exatamente qual imagem ficou sem declarar. Não existe caminho de "campo em branco por descuido": ou a imagem é descrita, ou é declarada decorativa.
  3. Preencha o campo novo no documento de exemplo da seção, em `packages/content-schema/tests/fixtures.ts`. Este é o único passo manual obrigatório: os documentos de exemplo são tipados pelos tipos derivados do esquema, então um campo obrigatório sem valor ali reprova `npm run typecheck`.
  4. Rode `npm run test -w packages/content-schema` e `npm run typecheck`.

  Acompanham sozinhos, sem nenhuma outra alteração de código: o tipo TypeScript do documento (`SectionDocumentOf<'secao'>` é calculado a partir do mesmo array de campos), a validação aplicada pela API (o validador Zod é construído do esquema em `src/zod.ts`) e o formulário do painel, gerado a partir do esquema (T11).

  Fora do pacote, duas coisas continuam sendo trabalho manual: a LP só exibe o campo quando o componente da seção passar a renderizá-lo; e um campo **obrigatório** acrescentado depois da migração inicial (T9) invalida os documentos já gravados até que alguém preencha o valor pelo painel — para evitar isso, crie-o com `required: false`, preencha o conteúdo e só então torne-o obrigatório.

- **Excluir um lead a pedido do titular (LGPD):** a exclusão é **definitiva e não tem desfazer** — é isso que o titular está pedindo.

  **Pelo painel, que é o caminho normal:**

  1. **Registre o pedido** antes de apagar: quem pediu, por qual canal e quando. Depois da exclusão não sobra no banco nada que ligue o pedido ao registro apagado — só o log do servidor, que guarda o identificador do lead e o do operador que executou.
  2. Abra **Leads recebidos** no painel. Se souber a data do envio, use o filtro por período para encurtar a lista; o dia é o de Brasília.
  3. **Se o titular quiser uma cópia dos próprios dados antes**, use `Exportar CSV do período` e recorte a linha dele.
  4. Na linha do titular, clique em **Excluir o lead de \<nome\>**. Nada é apagado neste clique: a linha passa a perguntar *"Excluir para sempre? Não há desfazer."*.
  5. Confirme em **Confirmar a exclusão do lead de \<nome\>**. A linha some da lista e a tela confirma com *"Lead excluído definitivamente."*.
  6. **Um mesmo titular pode ter mais de um envio.** O pedido alcança **todos** eles: repita para cada linha com aquele e-mail, e confira a lista depois.
  7. **A exclusão é definitiva e não há de onde restaurar.** Desde 2026-09-03 o lead existe só neste banco: apagado aqui, some para sempre. É o comportamento que o pedido do titular exige — mas confira a linha antes de confirmar.

  **Pela API**, quando for preciso fazer em lote ou sem abrir o painel:

  1. **Registre o pedido**, como acima.
  2. **Encontre o lead pelo e-mail do titular**, com um token de operador válido:

     ```bash
     curl -s "$API_BASE_URL/api/admin/leads?from=2026-01-01&to=2026-12-31" \
       -H "authorization: Bearer $TOKEN_DO_OPERADOR" | jq '.leads[] | select(.email == "titular@exemplo.com") | {id, email, createdAt}'
     ```

     Um mesmo titular pode ter mais de um envio; o pedido de exclusão alcança **todos** eles.
  3. **Se ele quiser uma cópia dos próprios dados antes**, exporte o período com `GET /api/admin/leads/export` e recorte a linha dele — a exportação já sai em CSV legível.
  4. **Apague cada identificador encontrado:**

     ```bash
     curl -s -o /dev/null -w '%{http_code}\n' -X DELETE \
       "$API_BASE_URL/api/admin/leads/<id-do-lead>" \
       -H "authorization: Bearer $TOKEN_DO_OPERADOR"
     ```

     `204` significa apagado. `404` significa que aquele identificador não existe (ou já foi apagado) — não é erro a insistir.
  5. **Confirme** repetindo a busca do passo 2: nenhum lead com aquele e-mail deve restar.
  6. **Não há outro sistema a alcançar.** O repasse a destino externo foi descontinuado em 2026-09-03: o lead nunca saiu deste banco por conta própria, e apagá-lo aqui encerra o pedido. O que pode ter saído são **exportações em CSV já baixadas** — se alguma foi entregue a terceiros, o pedido do titular precisa alcançá-la também, e isso está fora do que o sistema controla.

  Nunca apague um lead direto no banco pelo painel do Supabase: os dois caminhos acima passam pela API, que registra a exclusão no log do servidor com o identificador do lead e o do operador — e é esse registro que sustenta a resposta ao titular caso o pedido seja questionado depois. O painel do Supabase apaga sem deixar rastro nenhum.
- **Limpeza de arquivos órfãos no armazenamento:** um upload interrompido entre o passo 2 e o passo 3 do envio de mídia deixa um arquivo no bucket sem linha correspondente em `media_assets` (risco R-04 do SDD). O arquivo é **inerte** — nenhum documento de seção o referencia, porque referência é sempre por identificador de mídia, e identificador só existe depois da confirmação — mas ocupa espaço e é o único resíduo previsto do fluxo.

  A conciliação é uma diferença entre duas listas, e a coluna `storage_path` foi guardada qualificada pelo bucket (`veggiedent-videos/<uuid>/<arquivo>`) justamente para que ela seja direta:

  ```bash
  # 1. o que está registrado (com a chave secreta, do lado do servidor)
  curl -s "$SUPABASE_URL/rest/v1/media_assets?select=storage_path" \
    -H "apikey: $SUPABASE_SECRET_KEY" -H "authorization: Bearer $SUPABASE_SECRET_KEY"

  # 2. o que está em cada bucket
  for b in veggiedent-images veggiedent-videos; do
    curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/$b" \
      -H "apikey: $SUPABASE_SECRET_KEY" -H "authorization: Bearer $SUPABASE_SECRET_KEY" \
      -H 'content-type: application/json' -d '{"prefix":"","limit":1000}'
  done

  # 3. apagar um arquivo que está no bucket e não está na lista de registrados
  curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/<bucket>/<caminho>" \
    -H "apikey: $SUPABASE_SECRET_KEY" -H "authorization: Bearer $SUPABASE_SECRET_KEY"
  ```

  Cadência sugerida: mensal, ou depois de uma sessão de edição em que algum upload de vídeo tenha falhado. **Só apague o que estiver no bucket e não estiver na lista de registrados** — o caminho inverso (registro sem arquivo) não é órfão, é defeito, e apagar o registro esconderia o problema em vez de resolvê-lo. Um upload retomável abandonado antes do primeiro bloco não chega a virar arquivo; o Supabase descarta sozinho essas partes incompletas.
