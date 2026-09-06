# O painel de administração

Como o painel gera cada formulário, o que o operador vê em cada tipo de campo, as quatro telas, a sessão e a gestão de operadores.

## Como o painel gera o formulário de cada seção

**Não existe formulário escrito à mão por seção** (SDD § D-02). `SectionForm.tsx` percorre
`schema.fields` e `schema.lists` do pacote `packages/content-schema` e desenha o que
encontra; em nenhum arquivo do painel aparece o nome de um campo ou de uma seção. Cada
pedaço da tela sai de uma propriedade do esquema:

| No esquema | Na tela |
|---|---|
| `label` | o rótulo do campo, em português |
| `help` | a linha de ajuda logo abaixo do rótulo, ligada ao controle por `aria-describedby` |
| `required` | o asterisco vermelho (fora do rótulo, para o leitor de tela não anunciá-lo) e `aria-required` no controle |
| `type` | qual controle é desenhado — a tabela abaixo |

**O que o operador vê em cada tipo de campo:**

| Tipo | Controle | Observação |
|---|---|---|
| `texto-curto` | uma linha de texto | |
| `texto-longo` | uma área de texto de 4 linhas | |
| `texto-rico` | uma área de edição com dois botões, **Negrito** e **Quebra de linha** | guarda HTML; ver **Texto rico: o que o operador vê e o que o HTML pode ter** logo abaixo |
| `lista-de-textos` | uma linha por valor, com **Adicionar linha** e **Remover a linha N** | é um grupo (`fieldset`/`legend`), porque um rótulo serve a um controle só |
| `link` | uma linha de texto | quem julga o endereço é a API: `#secao`, `/pagina`, `https://…`, `mailto:` e `tel:` |
| `booleano` | uma caixa de seleção | |
| `imagem`, `video` | prévia do arquivo guardado, um seletor de arquivo, o limite escrito ao lado, barra de progresso durante o envio e um botão de remover | ver **Como o operador envia um arquivo** logo abaixo. Não há onde digitar identificador de mídia, de propósito (SDD § "Contrato do esquema de seção") |

**Listas de itens.** Cada lista do esquema vira um bloco com **Adicionar item**, e cada item
traz **Subir**, **Descer**, **Remover** e a caixa **Aparece na página**. Não há campo de
posição para digitar: a ordem é a ordem dos itens na tela, e `ordem` é recalculada a partir
dela na hora de gravar — o que torna impossível salvar duas posições iguais ou um buraco na
sequência. Desligar um item o retira da LP sem apagar o conteúdo (SDD § C-08); o mesmo vale
para a seção inteira, pela caixa **Seção aparece na página** no topo da tela, que chama
`PATCH /api/admin/sections/:key/visibility`.

**Salvar publica.** Não há rascunho no servidor: o botão é **Salvar e publicar**, e o sucesso
aparece como confirmação visível na própria tela. Quando a API recusa com `422`, cada mensagem
vai para **o campo que a causou** — o painel tira o prefixo da seção do caminho que a API
devolve (`faq.items.1.question` → a pergunta do segundo item) e pendura a mensagem ali, com
`aria-invalid` no controle. Uma mensagem cujo caminho não corresponde a nenhum campo da tela
não é descartada: aparece em uma lista de avisos acima do formulário.

### Texto rico: o que o operador vê e o que o HTML pode ter

Alguns textos precisam de mais do que uma linha corrida — o título da Prova de Autoridade, por
exemplo, quebra em duas linhas no desktop e traz um trecho destacado em turquesa. Esses campos
são do tipo `texto-rico` e guardam **HTML**.

**O que o operador vê.** Uma área de edição com o texto já formatado — nunca marcação escrita
por extenso — e dois botões:

- **Negrito**, que marca o trecho selecionado. O botão fica pressionado (`aria-pressed`) quando
  o cursor está dentro de um trecho já marcado;
- **Quebra de linha**, que quebra a linha na posição do cursor. A tecla **Enter** faz o mesmo:
  o campo é um título, e não cria parágrafos.

**O negrito é o destaque.** Não existe controle de cor, de tamanho nem de fonte, e não há
marcação própria de "destaque" para o operador aprender: ele marca em negrito e a página
desenha aquele trecho com o destaque da seção — no título da Prova de Autoridade, turquesa e
extra-bold. Onde o trecho aparece destacado é decisão da página, não de quem escreve.

**O que sobrevive no HTML, e por que o resto é removido.** Um campo de conteúdo que guarda HTML
e é renderizado na página pública é caminho de injeção de script: bastaria um operador com
acesso comprometido colar `<script>` ou `<img src=x onerror=…>` para que o código rodasse no
navegador de todo visitante. Por isso a lista de permissão é fechada e mora em um só lugar
(`packages/content-schema/src/rich-text.ts`):

| Sobrevive | Vira | Observação |
|---|---|---|
| `<strong>`, `<b>` | `<strong>` | é o destaque da página |
| `<em>`, `<i>` | `<em>` | itálico |
| `<br>` | `<br>` | quebra de linha |
| texto | texto | acentuação preservada |

Tudo o mais é removido, **inclusive todo e qualquer atributo** — sem atributo não existe
`onerror`, `onclick` nem `href="javascript:"`. Tag proibida perde a marcação mas **mantém o
texto** que estava dentro dela (a exceção é `<script>` e `<style>`, cujo conteúdo também vai
embora). Um campo obrigatório que só tinha marcação proibida fica vazio depois da limpeza e é
recusado com "Campo obrigatório." — em vez de ser gravado em branco.

**A limpeza acontece nas duas pontas**, com a mesma política:

- **na escrita**, na API, antes de validar e gravar (`SaveSectionUseCase`), para que nem o banco
  nem o instantâneo versionado da LP guardem uma carga de injeção;
- **na leitura**, na LP, ao renderizar (`apps/lp/src/components/ui/RichText.tsx`). Esta é a
  barreira que protege o visitante, e ela é dupla: o componente sanitiza e depois **reconstrói
  o conteúdo em elementos React**, sem `dangerouslySetInnerHTML` em lugar nenhum — só
  `<strong>`, `<em>`, `<br>` e texto conseguem virar nó na página.

### Como o operador envia um arquivo pelo painel

Abrir a seção, achar o campo de imagem ou vídeo e **escolher o arquivo**. Não há botão
de enviar: escolher já envia. Ao terminar, a prévia do arquivo aparece ali mesmo — a imagem, ou o
vídeo com controles de reprodução.

**Campo de imagem é uma área de soltar/enviar (T36).** Um retângulo de largura total com borda
tracejada: ícone de envio centralizado quando vazio, uma animação de carregamento dentro do
próprio retângulo enquanto o arquivo sobe, e a imagem enviada preenchendo a área inteira. O botão
de excluir (só o ícone de lixeira, sem texto) aparece no canto inferior direito **apenas quando há
imagem** — fundo levemente avermelhado em repouso, vermelho cheio em destaque/hover. Campo de
vídeo continua com o seletor de arquivo tradicional e a barra de progresso com a porcentagem em
texto: não há como "ver o conteúdo" de um vídeo antes de tocar, do jeito que uma imagem se vê
inteira de uma vez.

**A prévia aparece antes de salvar, e é do arquivo que já está no armazenamento.** O envio e a
gravação da seção são coisas diferentes: o arquivo já subiu e já foi registrado quando a prévia
aparece; o botão **Salvar e publicar** é o que faz a seção passar a apontar para ele. Sair da
tela sem salvar deixa o arquivo no armazenamento sem ninguém usando (ver [MANUTENCAO.md, "Limpeza de arquivos
órfãos no armazenamento"](MANUTENCAO.md)).

**O limite fica escrito abaixo do campo, antes de qualquer envio** — por exemplo
`MP4 ou WebM, até 50 MB.` Arquivo de tipo não aceito ou acima do limite é recusado **no próprio
painel**, com mensagem em português e sem nenhuma chamada à rede: o operador não espera um
envio para descobrir que o arquivo nunca teve chance.

> **Por que 50 MB, se o bucket de vídeo declara 500 MB.** O projeto Supabase tem um teto global
> de upload por arquivo — hoje **50 MB** — que prevalece sobre o limite declarado em cada
> bucket: acima dele o armazenamento responde `413 Maximum size exceeded` antes de aceitar
> qualquer byte. O painel exibe e aplica o **menor** dos dois limites, que é o que de fato vale.
> Elevar o teto é mudança de plano do projeto, em *Project Settings → Storage → Upload file size
> limit* (o plano Free trava em 50 MB), não mudança de código. Ver [API.md, "Buckets, limites e tipos
> aceitos"](API.md) para a tabela completa.

**Vídeo sobe em blocos, pelo protocolo retomável.** Blocos de 6 MB, direto ao armazenamento: um
arquivo de 23,6 MB vira quatro blocos, e uma queda de conexão faz o envio recomeçar do último
bloco confirmado, não do início. Retomar **entre recarregamentos da página** não é oferecido: a
credencial e o caminho de destino são emitidos a cada tentativa, então recarregar começa um
envio novo. Arquivo pequeno (imagem) sobe em uma requisição só, também com progresso.

**Os bytes nunca passam pela API** (SDD § D-05). O painel pede a credencial, envia o arquivo
direto ao armazenamento e confirma — os três passos descritos em "Envio de mídia em três
passos". Trocar a imagem de uma seção faz o navegador falar duas vezes com a API, com corpos de
poucas centenas de bytes, e uma vez com o armazenamento, com o arquivo inteiro.

**Remover** desfaz a referência do campo, e só isso: o arquivo continua no armazenamento e a
mídia continua registrada, porque ela pode estar em uso em outra seção. Apagar de vez é
`DELETE /api/admin/media/:id`, que recusa com `409` enquanto alguém a referenciar.

### Vídeo: o que o operador envia, e por que não existe campo de miniatura

Na **Demonstração em vídeo** o operador envia duas coisas diferentes, e nenhuma delas é uma
imagem de espera:

| Onde | O que enviar | Obrigatório |
|---|---|---|
| **Fundo do banner** | Um **vídeo** (*Vídeo do banner*) **ou** uma **imagem** (*Imagem do banner*) — o que fizer mais sentido para a campanha | Nenhum dos dois. Com os dois enviados, o vídeo é o que aparece |
| **Cada vídeo da lista** | O **arquivo de vídeo**; mais o **título do vídeo**, que é texto | Os dois |

**Não existe campo de miniatura em vídeo nenhum, e isso é decisão, não esquecimento.** A imagem
exibida antes de um vídeo tocar é o **primeiro quadro do próprio arquivo**: o navegador a
carrega do vídeo que já foi enviado, sem ninguém precisar produzir e enviar uma imagem à parte.
Pedir uma "imagem de pré-carregamento" seria pedir a quem escreve conteúdo um dado de quem
constrói a página — o operador não teria como saber o que é, nem de onde tirar o arquivo.

Isso vale igualmente para o banner: quando o fundo é vídeo, o que aparece antes de ele tocar é
o primeiro quadro dele; quem navega com **menos movimento** (`prefers-reduced-motion`) vê esse
mesmo quadro parado, sem reprodução automática. Quando o fundo é imagem, ela é tratada como
**decorativa** — sem campo de descrição, escondida de leitores de tela —, porque o que o banner
comunica está no título e no texto sobrepostos a ela.

### Imagem decorativa não tem campo de descrição, e isso é proposital

Todo campo de imagem do esquema declara se a imagem é **informativa** ou **decorativa**
(SDD § "Contrato do esquema de seção"):

- **informativa** — o esquema declara, ao lado dela, um campo de texto alternativo obrigatório.
  O painel **recusa salvar** a seção enquanto houver imagem preenchida sem descrição, sem
  chegar a chamar a API: a mensagem aparece no campo de descrição. É a única validação que o
  painel decide sozinho — todo o resto quem decide é a API.
- **decorativa** — o esquema **não** declara campo de descrição, então ele não existe na tela.
  Não é esquecimento nem exceção à acessibilidade: descrever uma imagem que não carrega
  informação injeta ruído no leitor de tela sem acrescentar significado. Na página essas imagens
  entram com texto alternativo vazio e escondidas de leitores de tela. É o caso das seis fotos
  do mosaico ao lado do formulário do guia.

Quem edita o esquema faz essa escolha uma vez, pelos construtores `requiredImage`,
`optionalImage` e `decorativeImage` de `packages/content-schema/src/fields.ts` — não há como
declarar uma imagem sem escolher.

**Acrescentar um campo a uma seção continua sendo editar um arquivo só.** Basta declará-lo no
esquema da seção em `packages/content-schema/src/sections/`: ele passa a ser validado pela API,
a aparecer no formulário do painel e a existir no tipo consumido pela LP, sem nenhuma alteração
no código do painel. Isso é verificado por mutação na T11 — ver [`../agent_context/PLAN.md`](../agent_context/PLAN.md), T11.

**Um componente de várias imagens num campo só, pronto e não usado ainda (T36).**
`apps/admin/src/media/MultiImageMediaField.tsx` guarda mais de uma imagem no mesmo campo, com a
mesma mecânica visual do campo de imagem único — mas nenhuma seção usa esse tipo hoje. O esquema
não tem um campo "várias imagens direto"; o padrão continua sendo uma lista de itens com campo de
imagem individual (ex. `captura_lead.mosaico`, com suas seis fotos). Migrar um caso real para o
componente novo troca o formato do documento gravado — muda o esquema, a validação da API e o
dado já existente —, o que ficou fora do escopo da T36 (reorganizar a casca visual, não migrar
esquema). O componente é verificável isoladamente, com sessão ativa, em
`/verificacao/multi-imagem` (fora do menu lateral — não é uma tela de conteúdo do CMS).

## As telas do painel

O painel tem quatro telas, todas atrás do login e sempre acessíveis por um **menu lateral**
fixo (uma gaveta em telas pequenas), que marca qual delas está ativa no momento — não há uma
tela "Início" separada: `/admin/` redireciona direto para a lista de seções, que já é o primeiro
item do menu. **Nenhuma tela é alcançável sem sessão**: a guarda é uma rota de layout, e toda
rota nova nasce dentro dela — expor uma tela exigiria declará-la fora da guarda, de propósito.
A única rota pública é o login — desde a T34, criar um operador não gera mais link nenhum, então
não existe outra rota pública além dela.

| Tela | Endereço | O que faz |
|---|---|---|
| Seções da página | `/admin/secoes` | As 9 seções, na ordem da página, com data da última edição e visibilidade |
| Metadados da página | `/admin/metadados` | Título, descrição, endereço oficial e imagem de compartilhamento |
| Leads recebidos | `/admin/leads` | Consulta, filtro por período, exportação em CSV e exclusão |
| Operadores do painel | `/admin/operadores` | Lista (com nome), cria com e-mail/senha/nome e remove operadores |

Editar um campo em "Seções da página" ou "Metadados da página" e tentar navegar para outra tela
sem salvar pede confirmação em português — não há rascunho persistido, então sair descarta a
edição de verdade.

### Metadados da página

Edita o que buscadores e redes sociais mostram sobre a página: **título**, **descrição**,
**endereço oficial** (a URL canônica) e a **imagem de compartilhamento** com seu **texto
alternativo**. Salvar publica — não há rascunho nem visibilidade, porque os metadados sempre
valem.

O formulário é gerado do esquema `packages/content-schema/src/site-metadata.ts`, o mesmo
mecanismo das seções: acrescentar um campo lá o faz aparecer na tela sem tocar no painel. A
imagem usa o campo de mídia das seções, com envio direto ao armazenamento — o operador nunca
digita identificador de mídia. A descrição da imagem é **obrigatória quando há imagem**, e o
painel recusa salvar antes de chamar a API.

A imagem de compartilhamento continua vazia enquanto a Virbac não aprovar a arte — ver
"Pendências herdadas". Com o campo vazio, a LP usa a reserva declarada no `index.html`.

### Leads recebidos

- **Ordem:** do mais recente ao mais antigo. A API já responde assim, e a tela ordena de novo
  por conta própria: a ordem que o operador vê é promessa do painel, não da resposta.
- **Data:** exibida em **horário de Brasília (UTC−3)**, o dia que o operador viveu. Um lead
  enviado às 23h de 2 de setembro aparece como dia 2, ainda que o banco o guarde como 3 de
  setembro em UTC.
- **Filtro por período:** dois dias, inclusivos nos dois extremos. O corte do dia é feito pela
  API, também em horário de Brasília. O painel manda o dia escolhido e não converte nada — fuso
  resolvido em dois lugares vira dois resultados diferentes na primeira vez que um deles mudar.
- **Colunas:** uma por campo que o visitante preenche, mais data de recebimento e origem.
  **Não há coluna de aceite da Política de Privacidade**:
  sem consentimento nenhum lead é gravado, então ela só poderia dizer "sim" e não prova nada
  que a existência da linha já não prove.
- **Exportação em CSV:** `Exportar CSV do período` baixa o arquivo respeitando o **filtro
  aplicado** — o que está digitado sem filtrar não conta, porque exportaria um período que o
  operador não viu na tela. O arquivo é montado pela API e entregue ao navegador **sem ser
  reescrito**, para que o BOM UTF-8 e o separador `;` que fazem o Excel em português abrir a
  planilha certa cheguem intactos.
- **Paginação:** aparece só quando o período não cabe em uma página (50 leads).
- **Exclusão:** em dois passos, para o pedido do titular — ver [MANUTENCAO.md](MANUTENCAO.md).

## Como criar e remover um operador do painel

A T29 trouxe a gestão de operadores para dentro do CMS, revertendo o trade-off original da
[SDD § D-03](../agent_context/SDD.md) (que deixava isso só no painel do Supabase). A T34 trocou o
fluxo de criação por convite (link de ativação de uso único) por criação direta: quem cria
preenche e-mail, senha e nome, e a conta já nasce pronta para logar — ver
[SDD § D-09](../agent_context/SDD.md), revista em 2026-09-04. A API continua sem tabela de
usuários — o Supabase Auth segue como única fonte —, mas é a própria tela **Operadores**
(`/admin/operadores`) que fala com a Admin API do Supabase em nome de quem administra o painel;
a chave secreta nunca chega ao navegador.

**Criar:**

1. Na tela **Operadores**, preencha **nome**, **e-mail** e **senha inicial** do operador novo e
   confirme **Criar operador**. A API chama `admin.createUser({ email, password, email_confirm:
   true, user_metadata: { name } })` — a conta nasce **já confirmada e pronta para logar**, sem
   link nem e-mail transacional algum.
2. A senha mínima é de 6 caracteres (o padrão do Supabase Auth); a tela recusa antes de
   submeter, com mensagem em português, se a senha for mais curta.
3. **Trade-off aceito, declarado em D-09:** quem cria sabe a senha inicial de outra pessoa —
   não há passo em que o novo operador a define por conta própria. A equipe é pequena e todos os
   operadores já se conhecem; nada impede o operador novo de trocar a própria senha depois pelo
   fluxo padrão do Supabase, se isso vier a ser necessário (não implementado, por não ter sido
   pedido).
4. O nome mostrado na lista vem de `user_metadata.name` — a única extensão de dado que a Admin
   API do Supabase Auth permite sem outra fonte de verdade. Um operador criado antes deste campo
   existir (o operador original) não tem nome cadastrado; a lista mostra, nesse caso, um nome
   derivado do e-mail (ex.: `ana.paula@...` vira "Ana Paula").

**Remover:** na mesma tela, com confirmação em dois passos. A API recusa com `409` remover a
própria conta ou o único operador restante (SDD § R-10) — as duas formas de travar o próprio
acesso ao painel —, e a tela já desabilita o botão nesses dois casos, com o motivo visível.

Não há papéis nem permissões: quem entra tem acesso a todo o painel. Gestão de papéis está
fora de escopo por decisão do PRD.

> **Verificado na T5**, contra o projeto real, com um usuário de teste criado direto no painel
> do Supabase (o fluxo da época) e removido em seguida: o token emitido pelo Supabase Auth é
> assinado em **ES256** e verificado pela API contra o JWKS do projeto (`SUPABASE_JWKS_URL`),
> sem que a API guarde nenhum segredo de assinatura. Requisição sem token a um endpoint
> administrativo responde `401`; com o token do operador, `200`.

> **Verificado na T29** (fluxo de convite por link, superado pela T34), de ponta a ponta, num
> navegador de verdade e contra o Supabase e a API reais: login como o operador real; convite de
> um e-mail de teste pela tela; o link copiado, aberto numa aba anônima e navegado até a rota de
> ativação; senha definida no formulário, com entrada automática no painel já autenticado; saída
> e login de novo com a conta nova, confirmando que a senha valeu; de volta como o operador
> original, o operador de teste foi removido pelo painel. A Admin API do Supabase confirmou ao
> final que não sobrou conta órfã.
>
> **Verificado de novo na T34**, contra o fluxo de criação direta, num navegador de verdade e
> contra o Supabase e a API reais: login como o operador real; criação de um operador de teste
> pela tela, preenchendo nome, e-mail e senha; o operador de teste apareceu na lista com o nome
> certo, sem nenhum link envolvido; login com esse e-mail e a senha definida na tela, numa aba
> anônima, sem qualquer passo de ativação; de volta como o operador original, o operador de
> teste foi removido pelo painel e saiu da lista. A Admin API do Supabase confirmou ao final que
> não sobrou conta órfã — só o operador original permaneceu.

## Como o painel trata a sessão

- **Onde a sessão vive:** no armazenamento do navegador do operador, sob a chave
  `veggiedent-admin-auth` — própria do painel, para que a LP servida no mesmo domínio nunca
  a compartilhe. É isso que faz a sessão sobreviver a recarregar a página.
- **Renovação:** o token do Supabase é de vida curta e o painel o renova sozinho antes de
  expirar. Se o Supabase ficar indisponível, a renovação falha e o operador é deslogado —
  consequência aceita e declarada desde a T5, em que a API responde `401` quando não
  consegue consultar o JWKS.
- **Sair:** encerra a sessão no Supabase e apaga a chave do armazenamento. Se o servidor
  falhar ao invalidar o token, a sessão local é apagada do mesmo jeito — sair é sempre
  possível do lado do painel.
- **Credenciais recusadas:** a mensagem é uma só, `E-mail ou senha inválidos.`, para senha
  errada, e-mail inexistente e conta não confirmada. Separar esses casos diria a quem tenta
  se aquele e-mail está cadastrado. Falha de rede tem mensagem própria, porque ali ninguém
  chegou a julgar as credenciais.
- **Nenhuma tela é alcançável sem sessão.** Um endereço interno aberto sem sessão leva ao
  login, e o painel volta a ele depois que o operador entra.
