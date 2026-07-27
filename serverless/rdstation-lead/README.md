# Função serverless — relay de leads para o RD Station Marketing

Este diretório fica **fora de `src/`** de propósito: nada aqui é processado pelo
Vite nem entra no bundle do front-end. É código que roda no servidor, nunca no
navegador do usuário.

## Por que essa função existe

O front-end (`src/sections/CapturaLead/services/submitLeadToRDStation.ts`) faz um
único `fetch(VITE_LEAD_SUBMIT_ENDPOINT)`. Ele nunca fala diretamente com a API do
RD Station e nunca guarda a credencial privada (token de API do RD Station). Essa
função serverless é o único lugar do projeto autorizado a ter essa credencial,
lida de uma variável de ambiente do lado do servidor (nunca `VITE_*`, que o Vite
expõe publicamente no bundle).

## Sobre a plataforma de hospedagem

A hospedagem final (Vercel, Netlify, Cloudflare Workers ou outra) ainda não foi
definida — ver Especificação Funcional v1.0, seção 8.5, e a lista de pendências
do projeto. Por isso, a lógica de negócio fica isolada em `handler.ts`, escrita
como uma função pura de request→response, sem nenhum import específico de
plataforma. Os arquivos em `adapters/` são wrappers finos (não testados em
produção, apenas para referência) que mostram como plugar `handler.ts` em cada
plataforma quando a decisão for tomada. Nenhum deles deve ser considerado a
implementação final — apenas o ponto de partida.

## Arquivos

- `handler.ts` — lógica de negócio: validação server-side, honeypot, mapeamento
  de campos, chamada à API do RD Station, formato de resposta. Nenhuma
  dependência de framework de servidor.
- `types.ts` — tipos compartilhados do request/response normalizado.
- `.env.example` — variáveis de ambiente privadas necessárias (nunca prefixadas
  com `VITE_`, nunca commitadas com valores reais).
- `adapters/vercel.ts` — exemplo de wrapper para Vercel Functions (`api/rdstation-lead.ts`).
- `adapters/netlify.ts` — exemplo de wrapper para Netlify Functions.
- `adapters/cloudflare-worker.ts` — exemplo de wrapper para um Cloudflare Worker.

## Como ativar (quando a plataforma for escolhida)

1. Copiar o conteúdo de `handler.ts` e `types.ts` para dentro do projeto de
   infraestrutura escolhido (ou apontar o build da plataforma para este
   diretório, dependendo de como o time de DEV organizar o monorepo).
2. Copiar o adapter correspondente à plataforma escolhida e ajustar o caminho
   de import conforme a estrutura de pastas exigida por ela.
3. Configurar as variáveis de ambiente privadas (ver `.env.example`) no painel
   da plataforma escolhida. **Nunca** commitar os valores reais.
4. Configurar `VITE_LEAD_SUBMIT_ENDPOINT` no `.env` do front-end apontando para
   a URL pública da função depois de implantada.

Ver a especificação técnica completa em
`RDStation_Serverless_Especificacao_Tecnica_v1.0.md`, na raiz do projeto.
