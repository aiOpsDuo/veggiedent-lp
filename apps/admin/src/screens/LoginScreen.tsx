import { useState, type FormEvent } from 'react'
import { VEGGIEDENT_LOGO_URL } from '@veggiedent/design-tokens'
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

/**
 * Preenchimento faltante, verificado no próprio painel em vez de deixar o
 * navegador validar (T30-b): o `required` nativo do HTML mostra sua mensagem
 * no idioma do navegador, quase sempre inglês, violando o requisito de idioma
 * do PRD. A mesma mensagem — no mesmo `role="alert"` usado para credencial
 * inválida — cobre e-mail vazio, senha vazia ou os dois.
 */
function missingFieldsMessage(email: string, password: string): string | null {
  const emailMissing = email.trim() === ''
  const passwordMissing = password.trim() === ''
  if (emailMissing && passwordMissing) {
    return 'Informe o e-mail e a senha.'
  }
  if (emailMissing) {
    return 'Informe o e-mail.'
  }
  if (passwordMissing) {
    return 'Informe a senha.'
  }
  return null
}

const FIELD_CLASS =
  'w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

export function LoginScreen(): JSX.Element {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const missing = missingFieldsMessage(email, password)
    if (missing !== null) {
      setErrorMessage(missing)
      return
    }

    setErrorMessage(null)
    setSubmitting(true)
    const result = await signIn({ email, password })
    setSubmitting(false)
    if (!result.ok) {
      setErrorMessage(MESSAGE_BY_REJECTION[result.rejection])
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="space-y-3">
          <img src={VEGGIEDENT_LOGO_URL} alt="Veggiedent" className="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Painel Veggiedent
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Entre com o e-mail e a senha do seu operador.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        {errorMessage !== null && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
