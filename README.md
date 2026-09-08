# Veggiedent LP + CMS

Landing page do Veggiedent (Virbac) e o CMS que administra todo o seu conteúdo.

## Objetivo do projeto

Permitir que a equipe de marketing altere qualquer conteúdo da landing page — texto, imagem ou vídeo — por um painel próprio, sem depender de desenvolvedor e sem novo deploy, e acompanhar no mesmo lugar os leads captados pelo formulário da página.

Requisitos de produto completos em [`agent_context/PRD.md`](agent_context/PRD.md).

## Stack

Quatro peças em um domínio único:

| Peça | Papel | Stack |
|---|---|---|
| `apps/lp` | Landing page pública, servida estaticamente por CDN | React 18, Vite 5, TypeScript 5, Tailwind 3 |
| `apps/admin` | Painel de administração, servido em `/admin` atrás de login | React 18, Vite 5, TypeScript 5, React Router 6, Tailwind 3, Lexical (editor de texto rico) |
| `apps/api` | API do CMS: conteúdo, mídia, metadados e leads | NestJS 11, Node 20+ |
| `packages/content-schema` | Esquemas das seções — fonte única de validação, formulário e tipos | TypeScript 5, Zod, DOMPurify |

Serviço externo: Supabase (banco Postgres, armazenamento de arquivos e autenticação) — o único. Requer Node 20 ou superior.

Padrão arquitetural, camadas, modelo de dados, decisões técnicas com trade-offs e os diagramas C4 estão em [`agent_context/SDD.md`](agent_context/SDD.md) — não duplicados aqui.

## Como rodar localmente

Um comando, **um endereço**, via Docker:

```bash
git clone <repositorio> && cd veggiedent-lp
cp .env.example .env   # e preencha (só na primeira vez)
docker compose up --build -d
```

Tudo responde em **http://localhost:8080**, com o mesmo mapa de caminhos que o domínio único terá em produção: `/` serve a LP, `/admin` serve o painel e `/api/*` alcança a API. Para acompanhar os logs, `docker compose logs -f`; para derrubar, `docker compose down`. Variáveis, quando reconstruir e como verificar a pilha: [`docs/DOCKER.md`](docs/DOCKER.md).

Sem Docker (recarga automática, depurar um processo isolado): [`docs/RODAR-SEM-DOCKER.md`](docs/RODAR-SEM-DOCKER.md).

## Saiba mais

- Arquitetura, decisões técnicas e diagramas: [`agent_context/SDD.md`](agent_context/SDD.md)
- Rodar sem Docker: instalação, comandos e portas internas: [`docs/RODAR-SEM-DOCKER.md`](docs/RODAR-SEM-DOCKER.md)
- Ambiente, variáveis, testes e publicação: [`docs/OPERACAO.md`](docs/OPERACAO.md)
- Subir as três aplicações com um comando, numa porta única: [`docs/DOCKER.md`](docs/DOCKER.md)
- Como o painel funciona, tela a tela: [`docs/PAINEL.md`](docs/PAINEL.md)
- Rotas da API, envio de mídia e exportação de leads: [`docs/API.md`](docs/API.md)
- Migrações, RLS e verificação de isolamento: [`docs/BANCO-DE-DADOS.md`](docs/BANCO-DE-DADOS.md)
- Passo a passo para migrar para um projeto Supabase novo, de produção: [`docs/MIGRAR-PARA-NOVO-SUPABASE.md`](docs/MIGRAR-PARA-NOVO-SUPABASE.md)
- Como a LP consome o conteúdo e o instantâneo de reserva: [`docs/CONTEUDO-DA-LP.md`](docs/CONTEUDO-DA-LP.md)
- Estrutura de pastas de cada aplicação: [`docs/ESTRUTURA-DO-CODIGO.md`](docs/ESTRUTURA-DO-CODIGO.md)
- Adicionar um campo, excluir um lead (LGPD), limpar mídia órfã: [`docs/MANUTENCAO.md`](docs/MANUTENCAO.md)
- Notas históricas dos vídeos e legendas da LP, anteriores ao CMS: [`docs/videos-setup/`](docs/videos-setup/)
