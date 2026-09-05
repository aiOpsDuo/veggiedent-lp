import { useBlocker } from 'react-router-dom'

/**
 * Bloqueia a navegação para outra rota do painel enquanto há uma edição não
 * salva, e pede confirmação em português antes de deixar o operador sair
 * (T30-d). Compartilhado entre a tela de seção e a de metadados: as duas
 * gravam por "Salvar", nenhuma tem rascunho persistido, e as duas perdem a
 * edição do mesmo jeito ao trocar de tela sem aviso.
 *
 * `useBlocker` intercepta só a navegação dentro do React Router — fechar a
 * aba ou recarregar a página não passa por aqui, e continua sem aviso; cobrir
 * isso também exigiria um `beforeunload` à parte, fora do que os achados da
 * auditoria (T30-d) pediram.
 */

const CONFIRM_MESSAGE = 'Você tem alterações não salvas. Sair mesmo assim?'
const DIALOG_TITLE_ID = 'aviso-alteracoes-nao-salvas'

interface UnsavedChangesGuardProps {
  /** Se há diferença entre o rascunho em edição e o que foi carregado/salvo. */
  readonly when: boolean
}

export function UnsavedChangesGuard({ when }: UnsavedChangesGuardProps): JSX.Element | null {
  const blocker = useBlocker(when)

  if (blocker.state !== 'blocked') {
    return null
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={DIALOG_TITLE_ID}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-lg">
        <p id={DIALOG_TITLE_ID} className="text-sm text-slate-800">
          {CONFIRM_MESSAGE}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => blocker.reset()}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Continuar editando
          </button>
          <button
            type="button"
            onClick={() => blocker.proceed()}
            className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
          >
            Sair sem salvar
          </button>
        </div>
      </div>
    </div>
  )
}
