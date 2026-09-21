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
process.env.MINIO_ROOT_USER = 'minioadmin-de-teste'
process.env.MINIO_ROOT_PASSWORD = 'minioadmin-senha-de-teste'
process.env.MINIO_BUCKET_IMAGES = 'veggiedent-images-teste'
process.env.MINIO_BUCKET_VIDEOS = 'veggiedent-videos-teste'
process.env.AUTH_JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres'
process.env.ALLOWED_ORIGINS = 'http://localhost:5173'
