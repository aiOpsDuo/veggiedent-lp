import * as argon2 from 'argon2'

/**
 * Hash e verificação de senha com argon2id (SDD § D-03: "algoritmo de hash de
 * senha recomendado atualmente pela OWASP").
 *
 * Funções exportadas soltas, não uma classe por trás de um token de injeção:
 * de propósito, para que `migracao-mysql/gestao-operadores` (criação de
 * operador, mesmo algoritmo por D-09) importe diretamente
 * `import { hashPassword } from '.../auth/infrastructure/password-hasher'`
 * sem precisar depender do `AuthModule` nem de nenhum provider do Nest — hash
 * de senha não tem estado nem configuração de ambiente, então não há motivo
 * para uma porta/adaptador aqui (proporcionalidade — não há uma segunda
 * implementação prevista, então uma interface só para trocar de biblioteca
 * seria abstração sem necessidade real).
 */

/** `argon2.hash` já usa argon2id por padrão; explícito aqui para deixar a escolha do SDD visível no código, não implícita no default da biblioteca. */
const HASH_OPTIONS: argon2.HashOptions = { type: argon2.argon2id }

/** Nunca a senha em texto puro é guardada — só o hash devolvido aqui (SDD § "Modelo de dados", `operators.password_hash`). */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS)
}

/**
 * Compara a senha em texto puro contra um hash já gravado. Nunca lança para
 * senha errada — devolve `false`; quem chama decide o que fazer com a recusa
 * (SDD § C-02: nunca revelar se foi o e-mail ou a senha que falhou).
 */
export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}
