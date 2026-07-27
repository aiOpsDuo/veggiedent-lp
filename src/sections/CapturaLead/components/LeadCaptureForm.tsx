import { useRef, useState } from 'react'
import { formContent } from '../CapturaLead.content'
import { useLeadForm } from '../hooks/useLeadForm'
import { env } from '../../../config/env'
import { useTracking } from '../../../hooks/useTracking'
import { FormField } from './FormField'
import { PorteSelect } from './PorteSelect'
import { ConsentCheckbox } from './ConsentCheckbox'
import { SuccessModal } from './SuccessModal'
import { ErrorToast } from './ErrorToast'
import type { LeadFormFieldName } from '../CapturaLead.types'

// LeadCaptureForm — orquestra os subcomponentes de campo, o hook useLeadForm
// e os estados de sucesso/erro. Especificacao Funcional, secao 8.
export function LeadCaptureForm() {
  const { values, errors, status, setValue, handleBlur, submit } = useLeadForm()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const nomeRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const aceiteLgpdRef = useRef<HTMLInputElement>(null)
  const { track } = useTracking()

  const fieldRefs: Partial<Record<LeadFormFieldName, React.RefObject<HTMLInputElement>>> = {
    nome: nomeRef,
    email: emailRef,
    aceiteLgpd: aceiteLgpdRef,
  }

  const isSubmitting = status === 'submitting' || status === 'validating'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = await submit()

    if (result === 'invalid') {
      const invalidFieldNames = Object.keys(errors) as LeadFormFieldName[]
      const errorCount = invalidFieldNames.length || 1
      setAnnouncement(`Formulário com ${errorCount} campo${errorCount > 1 ? 's' : ''} para corrigir.`)

      const firstInvalidField = invalidFieldNames[0]
      if (firstInvalidField) {
        fieldRefs[firstInvalidField]?.current?.focus()
      }
      return
    }

    if (result === 'success') {
      setIsModalOpen(true)
      if (env.ebookDeliveryMode === 'email') {
        track('ebook_download', { ebook_id: 'guia-saude-bucal-canina', delivery_mode: 'email' })
      }
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div aria-live="assertive" className="sr-only">
          {announcement}
        </div>

        <FormField
          ref={nomeRef}
          label={formContent.fields.nome.label}
          placeholder={formContent.fields.nome.placeholder}
          value={values.nome}
          onChange={(value) => setValue('nome', value)}
          onBlur={() => handleBlur('nome')}
          error={errors.nome}
          required
        />

        <FormField
          ref={emailRef}
          label={formContent.fields.email.label}
          placeholder={formContent.fields.email.placeholder}
          value={values.email}
          onChange={(value) => setValue('email', value)}
          onBlur={() => handleBlur('email')}
          error={errors.email}
          required
          type="email"
        />

        {/* Campo condicional — incluir apenas se aprovado pela estrategia (PRD v1.2, secao 18) */}
        <FormField
          label={formContent.fields.telefone.label}
          placeholder={formContent.fields.telefone.placeholder}
          value={values.telefone}
          onChange={(value) => setValue('telefone', value)}
          onBlur={() => handleBlur('telefone')}
        />

        <FormField
          label={formContent.fields.nomeCachorro.label}
          placeholder={formContent.fields.nomeCachorro.placeholder}
          value={values.nomeCachorro}
          onChange={(value) => setValue('nomeCachorro', value)}
          onBlur={() => handleBlur('nomeCachorro')}
        />

        <PorteSelect value={values.porteCachorro} onChange={(value) => setValue('porteCachorro', value)} />

        <FormField
          label={formContent.fields.cidadeEstado.label}
          placeholder={formContent.fields.cidadeEstado.placeholder}
          value={values.cidadeEstado}
          onChange={(value) => setValue('cidadeEstado', value)}
          onBlur={() => handleBlur('cidadeEstado')}
        />

        <ConsentCheckbox
          ref={aceiteLgpdRef}
          label={formContent.lgpdLabel}
          checked={values.aceiteLgpd}
          onChange={(checked) => setValue('aceiteLgpd', checked)}
          error={errors.aceiteLgpd}
          required
        />

        <ConsentCheckbox
          label={formContent.optInLabel}
          checked={values.aceiteComunicacoes}
          onChange={(checked) => setValue('aceiteComunicacoes', checked)}
        />

        <button
          ref={submitButtonRef}
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-brand-primary px-6 py-3 text-base font-semibold text-ink-900 transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
        >
          {status === 'submitting' ? formContent.submitLoadingLabel : formContent.submitLabel}
        </button>

        {status === 'error' && <ErrorToast />}
      </form>

      {isModalOpen && (
        <SuccessModal onClose={() => setIsModalOpen(false)} triggerRef={submitButtonRef} />
      )}
    </>
  )
}
