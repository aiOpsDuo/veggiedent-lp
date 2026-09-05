import { useEffect, useState, type FormEvent } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { formatBrasiliaDateTime } from '../shared/brasilia-time'
import { Card } from '../shared/Card'
import { Notice } from '../shared/Notice'
import type { OperatorsGateway, OperatorView } from './operators-gateway'

/**
 * A tela de operadores (SDD § D-09, § C-13): lista quem tem acesso ao painel,
 * cria uma conta nova e remove, com confirmação.
 *
 * Criar pede **e-mail, senha e nome** diretamente — a conta já nasce pronta
 * para logar, sem link nem e-mail de convite (D-09, revista na T34). Quem
 * cria sabe a senha inicial de outra pessoa: trade-off aceito e declarado no
 * SDD, não um descuido desta tela.
 *
 * O botão de remover é desabilitado, com o motivo visível, para a própria
 * conta e para o único operador restante — a mesma recusa que a API impõe com
 * `409` (R-10), antecipada aqui para que o operador nunca precise tentar para
 * descobrir. A API continua sendo quem decide de verdade: um clique que
 * escapasse dessa checagem local ainda voltaria recusado.
 */

/** O Supabase Auth exige este mínimo por padrão — mesmo valor do backstop da API. */
const MIN_PASSWORD_LENGTH = 6
const SHORT_PASSWORD_MESSAGE = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
const CREATED_MESSAGE = 'Operador criado. Já pode entrar no painel com o e-mail e a senha definidos.'

interface OperatorsScreenProps {
  readonly gateway: OperatorsGateway
}

type Listing =
  | { readonly status: 'carregando' }
  | { readonly status: 'pronto'; readonly operators: readonly OperatorView[] }
  | { readonly status: 'indisponivel'; readonly message: string }

type Notice =
  | { readonly tone: 'sucesso'; readonly message: string }
  | { readonly tone: 'falha'; readonly message: string }

const REMOVED_MESSAGE = 'Operador removido.'

export function OperatorsScreen({ gateway }: OperatorsScreenProps): JSX.Element {
  const { state: authState } = useAuth()
  const accessToken = authState.status === 'ativa' ? authState.session.accessToken : null
  const currentOperatorId = authState.status === 'ativa' ? authState.session.operatorId : null

  const [listing, setListing] = useState<Listing>({ status: 'carregando' })
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPasswordValue] = useState('')
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  /** Sobe a cada criação ou remoção: é o pedido de releitura da listagem. */
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    setListing({ status: 'carregando' })
    void gateway.listOperators(accessToken).then((result) => {
      if (!current) {
        return
      }
      setListing(
        result.status === 'ok'
          ? { status: 'pronto', operators: result.value }
          : { status: 'indisponivel', message: result.message },
      )
    })
    return () => {
      current = false
    }
  }, [gateway, accessToken, revision])

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (accessToken === null) {
      return
    }
    setCreateError(null)
    setNotice(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setCreateError(SHORT_PASSWORD_MESSAGE)
      return
    }
    setBusy(true)
    const result = await gateway.createOperator(accessToken, { email, password, name })
    setBusy(false)
    if (result.status === 'criado') {
      setEmail('')
      setPasswordValue('')
      setName('')
      setNotice({ tone: 'sucesso', message: CREATED_MESSAGE })
      setRevision((current) => current + 1)
      return
    }
    setCreateError(result.message)
  }

  const remove = async (id: string): Promise<void> => {
    if (accessToken === null) {
      return
    }
    setBusy(true)
    const result = await gateway.removeOperator(accessToken, id)
    setBusy(false)
    setConfirmingId(null)
    if (result.status === 'removido') {
      setNotice({ tone: 'sucesso', message: REMOVED_MESSAGE })
      setRevision((current) => current + 1)
      return
    }
    setNotice({ tone: 'falha', message: result.message })
  }

  const operators = listing.status === 'pronto' ? listing.operators : []
  const isLastOperator = operators.length === 1

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Operadores do painel
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Todo operador tem o mesmo nível de acesso e já pode entrar assim que criado.
        </p>
      </header>

      <CreateForm
        email={email}
        password={password}
        name={name}
        onChangeEmail={setEmail}
        onChangePassword={setPasswordValue}
        onChangeName={setName}
        onSubmit={(event) => void create(event)}
        busy={busy}
        error={createError}
      />

      {notice !== null && <Notice tone={notice.tone} message={notice.message} />}

      {listing.status === 'carregando' && (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          Carregando os operadores…
        </p>
      )}

      {listing.status === 'indisponivel' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {listing.message}
        </p>
      )}

      {operators.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Operadores com acesso ao painel</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2">
                  Nome
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">
                  E-mail
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">
                  Criado em
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">
                  Último login
                </th>
                <th scope="col" className="px-3 py-2">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {operators.map((operator) => (
                <OperatorRow
                  key={operator.id}
                  operator={operator}
                  isSelf={operator.id === currentOperatorId}
                  isLastOperator={isLastOperator}
                  confirming={confirmingId === operator.id}
                  busy={busy}
                  onAskConfirmation={() => {
                    setNotice(null)
                    setConfirmingId(operator.id)
                  }}
                  onCancel={() => setConfirmingId(null)}
                  onConfirm={() => void remove(operator.id)}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  )
}

interface CreateFormProps {
  readonly email: string
  readonly password: string
  readonly name: string
  readonly onChangeEmail: (email: string) => void
  readonly onChangePassword: (password: string) => void
  readonly onChangeName: (name: string) => void
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void
  readonly busy: boolean
  readonly error: string | null
}

function CreateForm({
  email,
  password,
  name,
  onChangeEmail,
  onChangePassword,
  onChangeName,
  onSubmit,
  busy,
  error,
}: CreateFormProps): JSX.Element {
  const canSubmit = email.trim().length > 0 && password.length > 0 && name.trim().length > 0

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="animate-fade-in-up flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="space-y-1">
        <label
          htmlFor="operador-nome"
          className="block text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          Nome
        </label>
        <input
          id="operador-nome"
          type="text"
          value={name}
          onChange={(event) => onChangeName(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Nova Operadora"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="operador-email"
          className="block text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          E-mail
        </label>
        <input
          id="operador-email"
          type="email"
          value={email}
          onChange={(event) => onChangeEmail(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="nova.operadora@veggiedent.com.br"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="operador-senha"
          className="block text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          Senha inicial
        </label>
        <input
          id="operador-senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => onChangePassword(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
        />
      </div>
      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        <UserPlus aria-hidden="true" className="h-4 w-4" />
        {busy ? 'Criando…' : 'Criar operador'}
      </button>
      {error !== null && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  )
}

interface OperatorRowProps {
  readonly operator: OperatorView
  readonly isSelf: boolean
  readonly isLastOperator: boolean
  readonly confirming: boolean
  readonly busy: boolean
  readonly onAskConfirmation: () => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function removalBlockedReason(isSelf: boolean, isLastOperator: boolean): string | null {
  if (isSelf) {
    return 'Você não pode remover a própria conta.'
  }
  if (isLastOperator) {
    return 'Não é possível remover o único operador restante.'
  }
  return null
}

function OperatorRow({
  operator,
  isSelf,
  isLastOperator,
  confirming,
  busy,
  onAskConfirmation,
  onCancel,
  onConfirm,
}: OperatorRowProps): JSX.Element {
  const blockedReason = removalBlockedReason(isSelf, isLastOperator)

  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
        {operator.name}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
        {operator.email}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
        {formatBrasiliaDateTime(operator.createdAt) ?? '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
        {operator.lastSignInAt === null
          ? 'Nunca acessou'
          : (formatBrasiliaDateTime(operator.lastSignInAt) ?? '—')}
      </td>
      <td className="px-3 py-2">
        {blockedReason !== null ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">{blockedReason}</span>
        ) : confirming ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-red-700 dark:text-red-400">
              Remover este operador do painel?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {`Confirmar a remoção de ${operator.email}`}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onAskConfirmation}
            className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            {`Remover ${operator.email}`}
          </button>
        )}
      </td>
    </tr>
  )
}
