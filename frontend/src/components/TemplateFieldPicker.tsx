import { FC, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  FIELD_GROUPS,
  Lead,
  TemplateField,
  getFieldValue,
  getTemplateField,
  searchTemplateFields,
} from '../leadFields'

interface TemplateFieldPickerProps {
  leads: Lead[]
  onSelect: (field: TemplateField) => void
  onClose: () => void
}

/**
 * Searchable, grouped list of template fields. It scales with the field list (search instead of a
 * wall of chips) and shows how many of the selected leads have each field, because a message is
 * not generated for a lead that lacks a field used in the template.
 */
export const TemplateFieldPicker: FC<TemplateFieldPickerProps> = ({ leads, onSelect, onClose }) => {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => searchTemplateFields(query), [query])
  // Keep group order stable and make keyboard navigation follow what is on screen.
  const orderedResults = useMemo(
    () => FIELD_GROUPS.flatMap((group) => results.filter((field) => field.group === group)),
    [results]
  )

  const coverage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const field of orderedResults) {
      counts.set(field.key, leads.filter((lead) => getFieldValue(lead, field.key) !== null).length)
    }
    return counts
  }, [orderedResults, leads])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, orderedResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const field = orderedResults[activeIndex]
      if (field) onSelect(field)
    } else if (e.key === 'Escape') {
      // Close only the picker, not the whole modal.
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      onClose()
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-20 mt-1 w-80 rounded-md border border-gray-200 bg-white shadow-lg"
    >
      <div className="border-b border-gray-100 p-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value
            // Someone typing a placeholder by hand ("{firstName}") ends with "}": insert it if it is a field.
            const typedField = value.endsWith('}') ? getTemplateField(value.slice(0, -1).trim()) : undefined
            if (typedField) onSelect(typedField)
            else setQuery(value)
          }}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget)) onClose()
          }}
          placeholder="Search fields…"
          aria-label="Search fields"
          role="combobox"
          aria-expanded="true"
          aria-controls="template-field-list"
          aria-activedescendant={
            orderedResults[activeIndex] ? `field-${orderedResults[activeIndex].key}` : undefined
          }
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <ul ref={listRef} id="template-field-list" role="listbox" className="max-h-64 overflow-y-auto py-1">
        {orderedResults.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No fields match</li>}
        {FIELD_GROUPS.map((group) => {
          const fields = orderedResults.filter((field) => field.group === group)
          if (fields.length === 0) return null
          return (
            <li key={group} role="presentation">
              <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group}
              </div>
              <ul role="presentation">
                {fields.map((field) => {
                  const index = orderedResults.indexOf(field)
                  const filled = coverage.get(field.key) ?? 0
                  const isActive = index === activeIndex
                  return (
                    <li
                      key={field.key}
                      id={`field-${field.key}`}
                      role="option"
                      aria-selected={isActive}
                      data-index={index}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => onSelect(field)}
                      className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm ${
                        isActive ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span>
                        <span className="text-gray-900">{field.label}</span>{' '}
                        <code className="text-xs text-gray-500">{`{${field.key}}`}</code>
                      </span>
                      {leads.length > 0 && (
                        <span
                          className={`text-xs ${filled === leads.length ? 'text-green-700' : filled === 0 ? 'text-red-600' : 'text-amber-600'}`}
                          title={`${filled} of ${leads.length} selected leads have this field`}
                        >
                          {filled}/{leads.length}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
