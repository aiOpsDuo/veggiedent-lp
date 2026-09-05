# PRD — CMS Veggiedent LP

## Objetivo

Permitir que a equipe responsável pela landing page do Veggiedent altere qualquer conteúdo da página — texto, imagem ou vídeo — por conta própria, através de um painel web, sem depender de um desenvolvedor e sem uma nova publicação de código a cada ajuste de copy ou troca de asset, e acompanhar no mesmo painel os leads captados pelo formulário da página. Hoje todo o conteúdo vive hardcoded em arquivos `*.content.ts` do repositório, o que faz cada correção de texto virar uma tarefa de engenharia, e os leads não têm onde ser consultados.

## Features

- **Painel restrito em `/admin`** — todo o CMS vive sob a rota `/admin` do mesmo site da landing page. Qualquer endereço dentro de `/admin` exige login: um visitante não autenticado nunca alcança uma tela de edição nem vê conteúdo administrativo.
- **Autenticação de equipe** — login por e-mail e senha, com sessão persistente e logout. Vários usuários da equipe têm acesso ao mesmo painel.
- **Painel de edição por seção** — a página é apresentada no painel como a lista de seções que ela realmente tem hoje, na mesma ordem em que aparecem no site: Hero, Educação, Rotina de Cuidado, Produto, Demonstração, Prova de Autoridade, Captura de Lead, Onde Comprar e FAQ. **Header, Ingredientes e Footer não são editáveis pelo painel** — decisão do usuário em 2026-09-04 (ver `agent_context/CHANGELOG.md`): Ingredientes foi removida do projeto por nunca ter tido conteúdo além do título, e o Header e o Footer voltaram a ser fixos em código (T28 e T32).
- **Edição de todos os campos de texto** — títulos, subtítulos, textos de apoio, rótulos de botão, textos legais, mensagens de erro do formulário, textos do modal de sucesso e textos alternativos (`alt`) de acessibilidade das imagens.
- **Gestão de itens de lista** — adicionar, editar, remover e reordenar itens das listas da página: links de navegação do Header, cards de Educação, passos da Rotina de Cuidado, benefícios do Produto, vídeos da Demonstração, números da Prova de Autoridade, parceiros de Onde Comprar, perguntas do FAQ e links do Footer.
- **Upload de imagens pelo painel** — o operador envia o arquivo direto no painel e ele passa a ser exibido na landing page; substituir uma imagem é trocar o arquivo no campo correspondente.
- **Upload de vídeos pelo painel** — mesmo fluxo das imagens, para os vídeos da seção Demonstração. **Não há campo de miniatura (poster)**: a imagem de pré-carregamento deriva do primeiro quadro do próprio vídeo (decisão do usuário em 2026-09-03).
- **Controle de visibilidade de item e de seção** — marcar um item de lista ou uma seção inteira como não publicada, para que ela deixe de aparecer no site sem que o conteúdo seja apagado. Isso substitui os controles hoje existentes no código (`isReadyForProduction` no FAQ, `isContentReady` em Ingredientes, itens comentados em Onde Comprar e FAQ).
- **Edição dos metadados de busca e compartilhamento** — título, descrição e imagem de compartilhamento social da página, editáveis pelo painel e entregues já preenchidos no HTML inicial da landing page, para que buscadores e previews de link os enxerguem sem depender da execução de JavaScript.
- **Consumo do conteúdo pela landing page** — a landing page passa a exibir o conteúdo cadastrado no CMS em vez do conteúdo hardcoded, sem mudança visual perceptível para o visitante final.
- **Registro dos leads do formulário** — cada envio do formulário da landing page é gravado no banco do CMS, que passa a ser o **único** sistema de registro do lead (ver `agent_context/CHANGELOG.md`, 2026-09-03: a integração com o RD Station foi descontinuada).
- **Consulta e exportação de leads no painel** — tela em `/admin` que lista os leads recebidos, do mais recente para o mais antigo, com todos os campos preenchidos pelo visitante, filtro por período e exportação da lista em formato de planilha. A tela permite também excluir um lead, para atender a um pedido de exclusão do titular dos dados.

## Fluxo de UX & notas de design

**Fluxo do operador de conteúdo:**

1. Acessa `/admin` no mesmo domínio da landing page e faz login com e-mail e senha. Sem sessão válida, qualquer endereço sob `/admin` leva de volta ao login.
2. Vê a lista de seções da landing page e escolhe a que quer editar.
3. Edita os campos daquela seção em um formulário que reflete a estrutura real da seção — campos de texto simples, textos longos, listas de itens e campos de mídia.
4. Para trocar uma imagem ou vídeo, envia o arquivo pelo próprio formulário e vê a miniatura/prévia do que foi enviado antes de salvar.
5. Ao salvar, a alteração vai ao ar imediatamente: não há etapa de rascunho nem de aprovação.
6. Abre a landing page para conferir o resultado.

**Fluxo de consulta de leads:**

1. Dentro de `/admin`, acessa a tela de leads.
2. Vê a lista dos envios do formulário, do mais recente para o mais antigo, com os campos preenchidos pelo visitante e a data de recebimento.
3. Filtra por período quando precisa recortar um intervalo específico.
4. Exporta a lista filtrada como planilha quando precisa trabalhar os dados fora do painel.

**Notas de design:**

- O painel é uma ferramenta interna: prioriza clareza e previsibilidade sobre sofisticação visual. **Revisto em 2026-09-04 (T35):** o usuário decidiu que o painel passa a reaproveitar a paleta e o estilo visual da landing page (antes, o painel tinha liberdade para não seguir a identidade da marca — essa liberdade deixou de ser usada). A prioridade de clareza e previsibilidade sobre sofisticação continua valendo: a mudança é de paleta e acabamento, não de densidade de informação nem de complexidade de interação.
- Cada campo do painel deve deixar claro **onde** ele aparece na página, para que o operador não precise adivinhar o efeito da edição. Rótulos usam a linguagem de quem escreve o conteúdo, não os nomes técnicos dos campos do código.
- O texto alternativo (`alt`) de cada imagem é um campo obrigatório ao lado do upload, não um detalhe escondido: a acessibilidade da página hoje depende dele.
- Toda alteração salva precisa de confirmação visível de sucesso ou de erro — como não há rascunho, o operador precisa saber com certeza se o que ele acabou de escrever está no ar.
- O painel é usado majoritariamente em desktop; precisa ser utilizável em telas menores, mas não é um produto mobile-first.

## Requerimentos sistêmicos

- **Idioma:** todo o painel e todo o conteúdo em português do Brasil, incluindo acentuação correta nos campos salvos.
- **Performance percebida da landing page:** a landing page é a peça de marketing e não pode ficar perceptivelmente mais lenta por causa do CMS. O conteúdo precisa chegar rápido o bastante para que a primeira dobra da página não fique em branco de forma perceptível.
- **Resiliência da landing page:** se o CMS estiver indisponível, a landing page precisa continuar exibindo conteúdo em vez de quebrar ou mostrar uma página vazia. Uma falha no painel de administração nunca pode derrubar a página pública.
- **Disponibilidade do painel:** o painel é uma ferramenta interna de uso ocasional; indisponibilidade curta é tolerável e não é um incidente crítico, ao contrário da landing page.
- **Descoberta por buscadores e previews de link:** os metadados de título, descrição e imagem de compartilhamento precisam estar presentes no HTML entregue na primeira resposta do servidor, sem depender da execução de JavaScript pelo cliente. Isso vale tanto para buscadores quanto para os previews de link de WhatsApp, Facebook e LinkedIn, que não executam JavaScript.
- **Segurança de acesso:** somente usuários autenticados podem alterar conteúdo, enviar arquivos ou consultar leads. Todo o CMS fica sob `/admin` e nenhuma tela sua é alcançável sem sessão válida. O conteúdo publicado é público por natureza — a leitura pela landing page não exige autenticação; os leads, ao contrário, nunca são expostos publicamente.
- **Isolamento das credenciais e da superfície pública:** nenhuma credencial de acesso ao banco ou ao armazenamento pode ser embarcada no código que roda no navegador do visitante — credenciais vivem exclusivamente do lado do servidor. O que a landing page consegue ler sem autenticação se limita ao conteúdo publicado e aos metadados da página; nenhum outro dado do banco, e em especial nenhum lead, é alcançável por essa via.
- **Compliance (LGPD):** o CMS passa a armazenar dados pessoais dos visitantes que preenchem o formulário (nome, e-mail, telefone, cidade). Esses dados só podem ser acessados por usuários autenticados do painel, precisam trafegar por conexão segura, e o consentimento já coletado hoje pelo formulário continua sendo a base do tratamento. É preciso existir uma forma de excluir um lead a pedido do titular.
- **Acessibilidade preservada:** o conteúdo servido pelo CMS não pode degradar a acessibilidade já existente na landing page — o que exige que campos como texto alternativo continuem sendo preenchidos. Legenda de vídeo deixou de ser um campo do CMS: o usuário decidiu removê-la do projeto inteiro na T31, por nunca ter tido uso real (0 registros) — ver `agent_context/CHANGELOG.md`, entrada de 2026-09-04.

## Premissas, restrições e dependências

**Restrições tecnológicas definidas pelo usuário (obrigatórias):**

- O backend do CMS será construído em **NestJS**.
- O **Supabase** será usado como banco de dados e como armazenamento dos arquivos de imagem e vídeo enviados pelo painel.
- A landing page busca o conteúdo em tempo de execução (runtime), consultando a API do CMS ao carregar. Não haverá reconstrução (rebuild) do site a cada publicação.
- Todo o CMS é acessado sob a rota **`/admin`** do mesmo site da landing page, sempre atrás de login.
- Os metadados de busca e compartilhamento são lidos do banco e inseridos no HTML do lado do servidor antes da resposta chegar ao navegador — a landing page continua sendo o SPA que é hoje, sem migração para um framework de renderização no servidor.

**Premissas:**

- A estrutura de seções da landing page atual está estabilizada: o CMS precisa cobrir as seções que existem hoje, não permitir a criação de tipos de seção novos.
- O conteúdo hoje presente nos arquivos `*.content.ts` é o conteúdo válido de partida e será migrado para o CMS como estado inicial.
- Os operadores do painel são pessoas de marketing/conteúdo, não desenvolvedores: nenhuma edição pode exigir escrever HTML, JSON ou qualquer sintaxe de código.
- O número de usuários do painel e o volume de edições é baixo (dezenas de edições por mês, poucos usuários simultâneos) — não é um sistema de alta carga.
- Os arquivos de vídeo já existentes no projeto têm **23,6 MB e 4,2 MB** (medidos em 2026-09-02). O CMS precisa suportar arquivos desse porte no upload, com folga. O limite efetivo é de **50 MB por arquivo**, teto do projeto Supabase, e o painel precisa exibi-lo ao operador. Publicar vídeos acima disso exigiria elevar o limite no provedor — decisão de custo, hoje fora de escopo. Ver `agent_context/CHANGELOG.md`, entrada de 2026-09-02 sobre o teto de armazenamento.

**Dependências:**

- Conta e projeto no Supabase, com as credenciais disponíveis para o ambiente do backend.
- Ambiente de hospedagem para o backend NestJS e para o painel de administração.
- **A integração com o RD Station Marketing foi descontinuada** por decisão do usuário em 2026-09-03. O lead deixa de ter destino externo: ele existe apenas no banco do CMS, e sai de lá pela exportação em CSV. Isso eleva o peso do backup do banco e de qualquer migração que toque a tabela de leads — não há mais cópia do dado em outro sistema.

**Pontos em aberto a resolver no SDD (não no PRD):**

- Se o CMS (backend NestJS + painel) vive neste mesmo repositório ou em um repositório separado.
- Qual mecanismo de autenticação será usado, dentro da restrição NestJS + Supabase já definida.

## Fora de escopo

- **Rascunho, aprovação e preview:** salvar publica direto; não haverá fluxo de revisão, agendamento de publicação nem URL de preview.
- **Histórico de versões e desfazer:** não haverá versionamento de conteúdo nem restauração de uma versão anterior.
- **Papéis e permissões diferenciadas:** todos os usuários autenticados têm o mesmo nível de acesso; não haverá distinção entre editor e administrador.
- **Criação de páginas ou de seções novas:** o CMS edita o conteúdo das seções existentes da landing page; não é um construtor de páginas.
- **Reordenação das seções da página:** a ordem das seções na landing page permanece definida em código.
- **Multi-idioma:** somente português do Brasil.
- **Edição de estilo visual:** cores, tipografia, espaçamento e layout permanecem no código; o CMS controla conteúdo, não aparência.
- **CRM e automação de marketing sobre os leads:** o painel lista, exporta e exclui leads, mas não faz segmentação, pontuação, envio de e-mail nem qualquer automação. Com o RD Station descontinuado, não há sistema de marketing acoplado — o dado sai por exportação.
- **Alteração das regras do formulário:** quais campos existem, quais são obrigatórios e como são validados permanecem em código; o CMS edita os textos desses campos, não a sua estrutura.
- **Renderização no servidor da página inteira:** apenas os metadados de busca e compartilhamento são inseridos no HTML pelo servidor; o restante do conteúdo continua sendo renderizado no navegador.
- **Biblioteca de mídia reutilizável:** o upload é feito no campo onde a mídia é usada; não haverá galeria central de arquivos compartilhada entre seções.
- **Edição do conteúdo das páginas legais** (Política de Privacidade, Termos de Uso, Fale Conosco): hoje são apenas links no rodapé, sem página construída neste projeto.

## Critérios de release

- **Funcionalidade:** um operador consegue, a partir do login em `/admin`, alterar um texto, trocar uma imagem e trocar um vídeo de qualquer uma das seções listadas, adicionar e remover um item de cada lista editável, e ver todas essas alterações refletidas na landing page pública. Todo o conteúdo hoje hardcoded está cadastrado e sendo servido pelo CMS — nenhuma seção continua lendo de `*.content.ts`. Um metadado alterado no painel aparece no HTML inicial da página, verificável sem executar JavaScript. Um envio do formulário na landing page aparece na tela de leads e é exportável em CSV.
- **Usabilidade:** um operador de marketing sem conhecimento técnico consegue localizar e alterar um texto específico da página sem treinamento além de uma explicação inicial curta, e sabe, ao final da ação, se a alteração foi salva ou falhou. Consultar e exportar os leads de um período é uma tarefa de poucos cliques.
- **Confiabilidade:** nenhuma tela sob `/admin` é alcançável sem sessão válida, e nenhum lead é acessível sem autenticação; uma falha ou indisponibilidade do CMS não deixa a landing page quebrada ou vazia; a gravação do lead é a única barreira entre o envio e a perda do dado, já que não há destino externo; um upload interrompido não corrompe o conteúdo já publicado.
- **Desempenho:** o carregamento da landing page permanece comparável ao atual do ponto de vista do visitante, sem tela em branco perceptível esperando o conteúdo; o painel responde às ações de salvar em tempo aceitável para uso interno.
- **Portabilidade & Manutenção:** o CMS roda em ambiente hospedado acessível pela equipe via navegador, sob `/admin` no mesmo domínio da landing page; a documentação técnica do projeto (`README.md`) explica como rodar, configurar as credenciais e implantar tanto a API quanto o painel; adicionar um campo novo a uma seção existente é uma tarefa pequena e documentada; existe um procedimento documentado para excluir um lead a pedido do titular.
