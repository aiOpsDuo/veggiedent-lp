import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/auth-context'
import { formatBrasiliaDateTime } from '../shared/brasilia-time'
import type { OperatorInvite, OperatorsGateway, OperatorView } from './operators-gateway'

/**
 * A tela de operadores (SDD § D-09, § C-13): lista quem tem acesso ao painel,
 * convida por e-mail e remove, com confirmação.
 *
 * O convite gera um **link de uso único**, mostrado uma vez só — a tela nunca
 * o guarda além do estado local desta sessão de navegador, e ele some assim
 * que a caixa é fechada ou um novo convite é gerado (D-09: "a tela nunca
 * reexibe um link já gerado").
 *
 * O botão de remover é desabilitado, com o motivo visível, para a própria
 * conta e para o único operador restante — a mesma recusa que a API impõe com
 * `409` (R-10), antecipada aqui para que o operador nunca precise tentar para
 * descobrir. A API continua sendo quem decide de verdade: um clique que
 * escapasse dessa checagem local ainda voltaria recusado.
 */

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
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [lastInvite, setLastInvite] = useState<OperatorInvite | null>(null)
  /** Sobe a cada convite ou remoção: é o pedido de releitura da listagem. */
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

  const invite = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (accessToken === null) {
      return
    }
    setInviteError(null)
    setNotice(null)
    setBusy(true)
    const result = await gateway.inviteOperator(accessToken, email)
    setBusy(false)
    if (result.status === 'convidado') {
      setLastInvite(result.value)
      setEmail('')
      setRevision((current) => current + 1)
      return
    }
    setInviteError(result.message)
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
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Operadores do painel</h1>
        <p className="text-sm text-slate-600">
          Todo operador tem o mesmo nível de acesso. Quem é convidado define a própria senha ao
          abrir o link de ativação — ninguém aqui define senha por outra pessoa.
        </p>
      </header>

      <InviteForm
        email={email}
        onChangeEmail={setEmail}
        onSubmit={(event) => void invite(event)}
        busy={busy}
        error={inviteError}
      />

      {lastInvite !== null && (
        <InviteLinkNotice invite={lastInvite} onDismiss={() => setLastInvite(null)} />
      )}

      {notice !== null && (
        <p
          role={notice.tone === 'falha' ? 'alert' : 'status'}
          className={
            notice.tone === 'falha'
              ? 'rounded bg-red-50 px-3 py-2 text-sm text-red-700'
              : 'rounded bg-green-50 px-3 py-2 text-sm text-green-800'
          }
        >
          {notice.message}
        </p>
      )}

      {listing.status === 'carregando' && (
        <p role="status" className="text-sm text-slate-500">
          Carregando os operadores…
        </p>
      )}

      {listing.status === 'indisponivel' && (
        <p role="alert" className="text-sm text-red-600">
          {listing.message}
        </p>
      )}

      {operators.length > 0 && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Operadores com acesso ao painel</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
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
            <tbody className="divide-y divide-slate-200">
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
        </div>
      )}
    </section>
  )
}

interface InviteFormProps {
  readonly email: string
  readonly onChangeEmail: (email: string) => void
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void
  readonly busy: boolean
  readonly error: string | null
}

function InviteForm({ email, onChangeEmail, onSubmit, busy, error }: InviteFormProps): JSX.Element {
  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4"
    >
      <div className="space-y-1">
        <label htmlFor="operador-email" className="block text-sm font-medium text-slate-800">
          E-mail do novo operador
        </label>
        <input
          id="operador-email"
          type="email"
          value={email}
          onChange={(event) => onChangeEmail(event.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-slate-900"
          placeholder="nova.operadora@veggiedent.com.br"
        />
      </div>
      <button
        type="submit"
        disabled={busy || email.trim().length === 0}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? 'Convidando…' : 'Convidar operador'}
      </button>
      {error !== null && (
        <p role="alert" className="w-full text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}

interface InviteLinkNoticeProps {
  readonly invite: OperatorInvite
  readonly onDismiss: () => void
}

/**
 * O link de ativação, mostrado uma única vez (D-09). `readOnly` + `select all
 * ao focar` é o jeito de copiar sem depender da API de clipboard do
 * navegador, que nem todo ambiente de teste ou navegador antigo tem.
 */
function InviteLinkNotice({ invite, onDismiss }: InviteLinkNoticeProps): JSX.Element {
  return (
    <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        {`Convite gerado para ${invite.email}. Copie o link abaixo e envie por um canal seu (e-mail, WhatsApp, Slack) — ele só aparece aqui uma vez.`}
      </p>
      <input
        readOnly
        value={invite.activationLink}
        aria-label="Link de ativação de uso único"
        onFocus={(event) => event.currentTarget.select()}
        className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
      <button
        type="button"
        onClick={onDismiss}
        className="rounded border border-amber-400 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
      >
        Já copiei, esconder o link
      </button>
    </div>
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
      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{operator.email}</td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
        {formatBrasiliaDateTime(operator.createdAt) ?? '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
        {operator.lastSignInAt === null
          ? 'Nunca acessou'
          : (formatBrasiliaDateTime(operator.lastSignInAt) ?? '—')}
      </td>
      <td className="px-3 py-2">
        {blockedReason !== null ? (
          <span className="text-xs text-slate-500">{blockedReason}</span>
        ) : confirming ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-red-700">Remover este operador do painel?</span>
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
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
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
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {`Remover ${operator.email}`}
          </button>
        )}
      </td>
    </tr>
  )
}
