import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Configuracao do Prisma CLI (migrate, generate, studio) — a partir do Prisma
 * ORM 7, a URL de conexao para o Migrate nao vive mais no `datasource` de
 * `schema.prisma`, e sim aqui.
 *
 * `import 'dotenv/config'` — exigido pela propria documentacao do Prisma 7
 * (é o que `prisma init` gera por padrao neste arquivo): o Prisma CLI nao
 * carrega `.env` sozinho, e `prisma.config.ts` roda antes de qualquer outro
 * ponto de entrada da aplicacao. `dotenv` entra como devDependency usada
 * *só* aqui — o resto da aplicacao continua carregando `.env` pelo
 * mecanismo nativo do Node (`--env-file-if-exists`, ver `migrate:content` em
 * package.json), sem mudanca. Em produção (docker-compose), `DATABASE_URL`
 * já chega como variável de ambiente real do contêiner: sem `.env` no disco,
 * `dotenv` não encontra nada para carregar e `process.env.DATABASE_URL`
 * já vem preenchido pelo próprio contêiner.
 *
 * `process.env.DATABASE_URL` direto, não o helper `env()` de `prisma/config`
 * — de propósito: `env()` lança se a variável não existir, e `prisma generate`
 * (rodado a cada `build`/`typecheck`/`test`, ver `prebuild`/`pretypecheck`/
 * `pretest` em package.json) não precisa de conexão nenhuma com o banco, só do
 * `schema.prisma`. Exigir `DATABASE_URL` também para `generate` quebraria o
 * build em qualquer checkout novo ou CI sem banco configurado, por uma
 * variável que esse comando nem usa. Só `migrate dev`/`deploy` de fato
 * precisam do valor — e aí, se estiver ausente, a própria tentativa de
 * conexão falha com um erro claro.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
