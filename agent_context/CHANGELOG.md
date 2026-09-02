# CHANGELOG — documentos de processo

Registro de mudanças relevantes em documentos de processo já aprovados (`PRD.md`, `SDD.md`, `PLAN.md`). Ver `SKILL.md` § "Contexto operacional".

## 2026-09-02 — Repasse do lead ao RD Station migra da função serverless para a API do CMS

Documento afetado: PRD.md

Motivo: o PRD, escrito antes do desenho técnico, assumia que o repasse continuaria "através da integração serverless que já existe no projeto". Com a API NestJS existindo e com a exigência do próprio PRD de que o lead seja gravado mesmo quando o RD Station falha, manter a função serverless significaria duas credenciais, dois deploys e duas cópias da mesma validação para um único fluxo. A decisão está detalhada em `SDD.md` § D-07.

Impacto: o comportamento externo é preservado — mesma API do RD Station, mesma validação, mesmo honeypot, mesmo mapeamento de campos. Muda apenas onde o código roda. `serverless/rdstation-lead/` é aposentado e sua lógica passa a viver em um adaptador da camada de Infraestrutura da API. A seção "Premissas, restrições e dependências" do PRD foi ajustada para apontar para D-07 em vez de fixar o mecanismo serverless. Nenhuma tarefa concluída precisa ser refeita (nenhuma existe ainda).

## 2026-09-02 — Defeito existente incorporado ao escopo: três campos do formulário são descartados hoje

Documento afetado: PRD.md

Motivo: durante a exploração da Fase 2 constatou-se que `src/sections/CapturaLead/services/submitLeadToRDStation.ts` coleta `conheceVirbac`, `usaProdutoVirbac` e `qualProdutoVirbac` no formulário mas não os inclui no payload enviado, e que `serverless/rdstation-lead/types.ts` sequer prevê esses campos. Os três dados são perdidos a cada envio, hoje, em produção.

Impacto: a feature "Registro dos leads do formulário" passa a incluir explicitamente esses três campos, gravados e repassados. Registrado como risco R-01 no SDD e verificado pelo critério C-11. É correção de um defeito preexistente, não ampliação de escopo — mas fica registrado para não parecer requisito inventado.
