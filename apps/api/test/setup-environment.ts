/**
 * Ambiente dos testes. Definido antes de qualquer import da aplicação, e com
 * valores fictícios: nenhuma suíte depende do `.env` real nem de credencial.
 * O carregamento do `.env` não sobrescreve variável já definida, então estes
 * valores prevalecem mesmo na máquina de quem tem o arquivo local.
 */
process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.SUPABASE_URL = 'https://projeto-de-teste.supabase.co'
process.env.SUPABASE_SECRET_KEY = 'chave-secreta-ficticia'
process.env.SUPABASE_JWKS_URL =
  'https://projeto-de-teste.supabase.co/auth/v1/.well-known/jwks.json'
process.env.ALLOWED_ORIGINS = 'http://localhost:5173'
