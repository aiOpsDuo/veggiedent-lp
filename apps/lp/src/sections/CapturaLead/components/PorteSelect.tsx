import { useId } from 'react'
import { formContent } from '../CapturaLead.content'
import type { PorteCachorro } from '../CapturaLead.types'

interface PorteSelectProps {
  value: PorteCachorro | ''
  onChange: (value: PorteCachorro | '') => void
}

export function PorteSelect({ value, onChange }: PorteSelectProps) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {formContent.fields.porteCachorro.label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as PorteCachorro | '')}
        className="min-h-[44px] rounded-md border border-black/15 bg-white px-3 py-2 text-base text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
      >
        <option value="">{formContent.fields.porteCachorro.placeholder}</option>
        {formContent.porteOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
