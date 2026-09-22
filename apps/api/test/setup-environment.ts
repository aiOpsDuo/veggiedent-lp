/**
 * Ambiente dos testes. Definido antes de qualquer import da aplicação, e com
 * valores fictícios: nenhuma suíte depende do `.env` real nem de credencial.
 * O carregamento do `.env` não sobrescreve variável já definida, então estes
 * valores prevalecem mesmo na máquina de quem tem o arquivo local.
 */
process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DATABASE_URL = 'mysql://veggiedent_app:senha-de-teste@localhost:3306/veggiedent_test'
process.env.MINIO_ENDPOINT = 'http://localhost:9000'
process.env.MINIO_PUBLIC_URL = 'http://localhost:9000'
process.env.MINIO_ROOT_USER = 'minioadmin-de-teste'
process.env.MINIO_ROOT_PASSWORD = 'minioadmin-senha-de-teste'
// Correção de retomada (migracao-mysql/modulo-midia, 2026-09-21): estes dois
// valores precisam ser exatamente os nomes de bucket que `media-kind.ts`
// declara (`MEDIA_KIND_POLICIES.<kind>.bucket`) — o mesmo default que
// `docker-compose.yml` usa (`MINIO_BUCKET_IMAGES:-veggiedent-images`). Não são
// só rótulos: `MinioMediaStorage` os usa para saber a que bucket real do MinIO
// endereçar cada operação, e todo o resto do sistema (`storage_path`,
// `public_url`, os testes de mídia) assume esses dois nomes de domínio. Um
// sufixo de teste aqui (como `-teste`, usado antes desta correção, quando
// nada no código ainda lia estas duas variáveis) faria `MinioMediaStorage`
// endereçar um bucket diferente do que o domínio e os testes esperam.
process.env.MINIO_BUCKET_IMAGES = 'veggiedent-images'
process.env.MINIO_BUCKET_VIDEOS = 'veggiedent-videos'
process.env.AUTH_JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres'
process.env.ALLOWED_ORIGINS = 'http://localhost:5173'
