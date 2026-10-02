import { forwardRef, useId } from 'react'
import { splitConsentLabel } from '../utils/consent-label'

interface ConsentCheckboxProps {
  label: string
  /**
   * Endereco da Politica de Privacidade. Presente, o texto ganha o link para
   * ela (ver `utils/consent-label.ts`); ausente, o texto sai como veio.
   */
  policyUrl?: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  required?: boolean
}

export const ConsentCheckbox = forwardRef<HTMLInputElement, ConsentCheckboxProps>(
  function ConsentCheckbox({ label, policyUrl, checked, onChange, error, required }, ref) {
    const id = useId()
    const errorId = `${id}-error`

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-1 h-5 w-5 flex-shrink-0 accent-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
          />
          <label htmlFor={id} className="text-sm text-ink-700">
            {policyUrl === undefined ? label : <LabelWithPolicyLink label={label} url={policyUrl} />}
            {required && <span aria-hidden="true"> *</span>}
          </label>
        </div>
        {error && (
          <p id={errorId} className="pl-7 text-sm text-feedback-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)

/**
 * O link fica dentro do `<label>` e mesmo assim clicar nele nao marca a caixa:
 * o clique num conteudo interativo descendente do rotulo nao ativa o controle
 * (HTML, "The label element"). Abre em nova aba para o visitante nao perder o
 * que ja digitou no formulario.
 */
function LabelWithPolicyLink({ label, url }: { label: string; url: string }) {
  const { before, linkText, after } = splitConsentLabel(label)
  return (
    <>
      {before}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline underline-offset-2 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
      >
        {linkText}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
      {after}
    </>
  )
}
