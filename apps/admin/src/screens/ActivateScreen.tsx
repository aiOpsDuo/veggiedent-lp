import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { HOME_PATH } from '../routing/paths'

const MIN_PASSWORD_LENGTH = 8

const SHORT_PASSWORD_MESSAGE = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
const MISMATCH_MESSAGE = 'As senhas não coincidem.'
const SAVE_FAILURE_MESSAGE =
  'Não foi possível salvar a senha agora. Tente novamente em instantes.'

const FIELD_CLASS =
  'w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40'

/**
 * O formulário de "defina sua senha" (SDD § D-09), mostrado depois que
 * `ActivateRoute` já estabeleceu a sessão a partir dos tokens do convite.
 *
 * Só pede a senha e a confirmação — o e-mail já veio do convite, e pedi-lo de
 * novo não provaria nada que a sessão já não prove. Ao salvar, o operador
 * segue direto para o painel **já autenticado**: a sessão que `activate`
 * estabeleceu continua valendo, então pedir login de novo seria repetir uma
 * autenticação que já aconteceu, não uma segunda camada dela.
 */
export function ActivateScreen(): JSX.Element {
  const { setPassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPasswordValue] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(SHORT_PASSWORD_MESSAGE)
      return
    }
    if (password !== confirmation) {
      setErrorMessage(MISMATCH_MESSAGE)
      return
    }

    setSubmitting(true)
    const result = await setPassword(password)
    setSubmitting(false)

    if (!result.ok) {
      setErrorMessage(SAVE_FAILURE_MESSAGE)
      return
    }
    navigate(HOME_PATH, { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Defina sua senha</h1>
          <p className="mt-1 text-sm text-slate-500">
            Escolha a senha com que você vai entrar no painel Veggiedent.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="nova-senha" className="block text-sm font-medium text-slate-700">
            Senha
          </label>
          <input
            id="nova-senha"
            name="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPasswordValue(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmar-senha" className="block text-sm font-medium text-slate-700">
            Confirme a senha
          </label>
          <input
            id="confirmar-senha"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
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
          {submitting ? 'Salvando…' : 'Definir senha e entrar'}
        </button>
      </form>
    </main>
  )
}
