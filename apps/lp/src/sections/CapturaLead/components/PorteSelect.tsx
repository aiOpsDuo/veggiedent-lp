import { useId } from 'react'
import type { SectionContent } from '../../../content/published-content'

interface PorteSelectProps {
  label: string
  placeholder: string
  options: SectionContent<'captura_lead'>['porteOptions']
  value: string
  onChange: (value: string) => void
}

export function PorteSelect({ label, placeholder, options, value, onChange }: PorteSelectProps) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[44px] rounded-md border border-black/15 bg-white px-3 py-2 text-base text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
