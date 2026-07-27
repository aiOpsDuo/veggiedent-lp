import { forwardRef, useId } from 'react'

interface ConsentCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  required?: boolean
}

export const ConsentCheckbox = forwardRef<HTMLInputElement, ConsentCheckboxProps>(
  function ConsentCheckbox({ label, checked, onChange, error, required }, ref) {
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
            {label}
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
