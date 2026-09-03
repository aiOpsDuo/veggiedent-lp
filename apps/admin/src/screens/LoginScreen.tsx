import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/auth-context'
import type { SignInRejection } from '../auth/auth-gateway'

/**
 * A mensagem de recusa por motivo.
 *
 * A de `credenciais-invalidas` é uma só, e é a mesma para senha errada, e-mail
 * inexistente e conta ainda não confirmada. Qualquer texto que separasse esses
 * casos diria a quem tenta se aquele e-mail está cadastrado (SDD § C-02).
 */
const MESSAGE_BY_REJECTION: Readonly<Record<SignInRejection, string>> = {
  'credenciais-invalidas': 'E-mail ou senha inválidos.',
  indisponivel:
    'Não foi possível falar com o serviço de autenticação. Tente novamente em instantes.',
}

const FIELD_CLASS =
  'w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40'

export function LoginScreen(): JSX.Element {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)
    const result = await signIn({ email, password })
    setSubmitting(false)
    if (!result.ok) {
      setErrorMessage(MESSAGE_BY_REJECTION[result.rejection])
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Painel Veggiedent</h1>
          <p className="mt-1 text-sm text-slate-500">
            Entre com o e-mail e a senha do seu operador.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        {errorMessage !== null && (
          <p role="alert" className="text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-brand-primary px-4 py-2 font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
