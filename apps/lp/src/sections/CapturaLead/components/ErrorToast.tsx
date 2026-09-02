import { formContent } from '../CapturaLead.content'

// Toast/Inline — role="status" (nao interrompe, mas e anunciado) —
// Especificacao Funcional, secao 13.
export function ErrorToast() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-md border border-feedback-error/30 bg-feedback-error/10 px-4 py-3 text-sm text-feedback-error"
    >
      {formContent.errorToastMessage}
    </div>
  )
}
