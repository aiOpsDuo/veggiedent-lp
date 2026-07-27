import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { formContent } from '../CapturaLead.content'
import { env, hasEbookDownloadUrl } from '../../../config/env'
import { useTracking } from '../../../hooks/useTracking'

interface SuccessModalProps {
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
}

// Modal/Confirmation — focus trap + devolve o foco ao elemento que abriu
// (Especificacao Funcional, secao 8.4 e 13). Conteudo do modal (botao de
// download vs. mensagem de e-mail) depende de VITE_EBOOK_DELIVERY_MODE —
// nenhuma mudanca estrutural quando o link do e-book chegar (secao 8.6).
export function SuccessModal({ onClose, triggerRef }: SuccessModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { track } = useTracking()
  const showDownloadButton = hasEbookDownloadUrl()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('button, a')?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, triggerRef])

  function handleDownloadClick() {
    track('ebook_download', { ebook_id: 'guia-saude-bucal-canina', delivery_mode: 'download' })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div ref={dialogRef} className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <h2 id="success-modal-title" className="text-xl font-semibold text-ink-900">
            {formContent.successModal.title}
          </h2>
          <button
            type="button"
            onClick={() => {
              onClose()
              triggerRef.current?.focus()
            }}
            aria-label={formContent.successModal.closeAriaLabel}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mt-2 text-base text-ink-700">
          {showDownloadButton ? formContent.successModal.body : formContent.successModal.emailModeMessage}
        </p>

        {showDownloadButton && (
          <a
            href={env.ebookUrl}
            onClick={handleDownloadClick}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-brand-primary px-6 py-3 text-base font-semibold text-ink-900 hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
          >
            {formContent.successModal.downloadCtaLabel}
          </a>
        )}
      </div>
    </div>
  )
}
