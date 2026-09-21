import type { AuthStorage } from '../src/auth/api-auth-gateway'

/**
 * Armazenamento em memória, para testes que precisam simular "recarregar a
 * página" — instâncias diferentes do gateway compartilhando o mesmo mapa —
 * sem depender do `localStorage` real do ambiente de teste.
 *
 * Não é um capricho: o Node desta versão tem um `localStorage` global nativo
 * ainda incompleto (sem `getItem`/`setItem`), que toma o lugar do
 * `window.localStorage` que o jsdom forneceria (ver nota em `App.test.tsx`).
 * Injetar este dublê, em vez de usar `window.localStorage` de verdade, é o
 * que mantém os testes de sessão fora dessa armadilha de ambiente.
 */
export class MemoryStorage implements AuthStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }
}
