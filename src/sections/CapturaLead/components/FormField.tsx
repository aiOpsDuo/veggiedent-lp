import { forwardRef, useId } from 'react'

interface FormFieldProps {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
  required?: boolean
  type?: string
}

// Todo campo com <label> associado via htmlFor/id (nunca so placeholder) —
// Especificacao Funcional, secao 13. forwardRef permite ao LeadCaptureForm
// mover o foco para o primeiro campo invalido ao tentar enviar (secao 8.2).
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, placeholder, value, onChange, onBlur, error, required, type = 'text' },
  ref,
) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-[44px] rounded-md border px-3 py-2 text-base text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus ${
          error ? 'border-feedback-error' : 'border-black/15'
        }`}
      />
      {error && (
        <p id={errorId} className="text-sm text-feedback-error">
          {error}
        </p>
      )}
    </div>
  )
})
