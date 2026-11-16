import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../api'
import {
  Lead,
  TemplateField,
  extractTemplateFields,
  getFieldValue,
  getTemplateField,
  renderTemplatePreview,
} from '../leadFields'
import { TemplateFieldPicker } from './TemplateFieldPicker'

interface MessageTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  selectedLeadIds: number[]
  selectedLeadsCount: number
  /** Selected leads' data, used for the field coverage counts and the preview. */
  selectedLeads: Lead[]
}

export const MessageTemplateModal: FC<MessageTemplateModalProps> = ({
  isOpen,
  onClose,
  selectedLeadIds,
  selectedLeadsCount,
  selectedLeads,
}) => {
  const [template, setTemplate] = useState('')
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  // Set when the picker was opened by typing "{": the inserted field replaces that brace.
  const [braceTrigger, setBraceTrigger] = useState<number | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [generationResult, setGenerationResult] = useState<{
    success: boolean
    generatedCount: number
    errors: Array<{ leadId: number; leadName: string; error: string }>
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  const generateMessagesMutation = useMutation({
    mutationFn: async (data: { leadIds: number[]; template: string }) => api.leads.generateMessages(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'getMany'] })
      setGenerationResult(result)

      if (result.errors.length === 0) {
        const message =
          result.generatedCount === 1
            ? `Successfully generated message for ${result.generatedCount} lead`
            : `Successfully generated messages for ${result.generatedCount} leads`
        toast.success(message)
        resetAndClose()
      } else {
        const successMessage =
          result.generatedCount === 1
            ? `Generated message for ${result.generatedCount} lead`
            : `Generated messages for ${result.generatedCount} leads`
        const errorMessage =
          result.errors.length === 1
            ? `${result.errors.length} lead had errors`
            : `${result.errors.length} leads had errors`
        toast.success(`${successMessage}, but ${errorMessage}. Check details below.`)
      }
    },
    onError: () => {
      toast.error('Failed to generate messages. Please try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (template.trim() && selectedLeadIds.length > 0) {
      setGenerationResult(null)

      generateMessagesMutation.mutate({
        leadIds: selectedLeadIds,
        template: template.trim(),
      })
    }
  }

  const resetAndClose = useCallback(() => {
    onClose()
    setTemplate('')
    setGenerationResult(null)
    setIsPickerOpen(false)
    setBraceTrigger(null)
    setPreviewIndex(0)
  }, [onClose])

  const handleClose = useCallback(() => {
    if (!generateMessagesMutation.isPending) {
      resetAndClose()
    }
  }, [generateMessagesMutation.isPending, resetAndClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'hidden'

      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleClose])

  const insertField = (field: TemplateField) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const token = `{${field.key}}`
    // Typing "{" opened the picker: replace that brace instead of adding a second one.
    const start = braceTrigger ?? textarea.selectionStart
    const end = braceTrigger !== null ? braceTrigger + 1 : textarea.selectionEnd
    setTemplate(template.substring(0, start) + token + template.substring(end))
    setIsPickerOpen(false)
    setBraceTrigger(null)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  const closePicker = () => {
    setIsPickerOpen(false)
    setBraceTrigger(null)
    textareaRef.current?.focus()
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const caret = e.target.selectionStart
    setTemplate(value)
    // Typing a single "{" opens the field picker, like an @-mention.
    if (value.length === template.length + 1 && value[caret - 1] === '{') {
      setBraceTrigger(caret - 1)
      setIsPickerOpen(true)
    }
  }

  // For each placeholder in the template: is it a known field, and how many selected leads lack it.
  const usedFields = useMemo(
    () =>
      extractTemplateFields(template).map((key) => {
        const field = getTemplateField(key)
        const missing = field
          ? selectedLeads.filter((lead) => getFieldValue(lead, field.key) === null).length
          : 0
        return { key, field, missing }
      }),
    [template, selectedLeads]
  )
  const unknownFields = usedFields.filter((used) => !used.field)
  const leadsMissingData = selectedLeads.filter((lead) =>
    usedFields.some((used) => used.field && getFieldValue(lead, used.field.key) === null)
  ).length

  const previewPosition = Math.min(previewIndex, selectedLeads.length - 1)
  const previewLead = selectedLeads[previewPosition]

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Generate Messages for {selectedLeadsCount} Lead{selectedLeadsCount !== 1 ? 's' : ''}
            </h2>
            <button
              onClick={handleClose}
              disabled={generateMessagesMutation.isPending}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="message-template" className="block text-sm font-medium text-gray-700 mb-2">
                Message Template
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <button
                    type="button"
                    // Keep focus in the picker so its blur handler does not close it before this click toggles it.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setBraceTrigger(null)
                      setIsPickerOpen((open) => !open)
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                  >
                    <span aria-hidden>+</span> Insert field
                  </button>
                  <span className="ml-2 text-xs text-gray-500">
                    or type <code>{'{'}</code> in the message
                  </span>
                  {isPickerOpen && (
                    <TemplateFieldPicker leads={selectedLeads} onSelect={insertField} onClose={closePicker} />
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  id="message-template"
                  value={template}
                  onChange={handleTemplateChange}
                  placeholder="Enter your message template here. Use {fieldName} to insert dynamic values.&#10;&#10;Example: Hi {firstName}, I noticed you work at {companyName} as a {jobTitle}. Would you be interested in..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Use curly braces around field names (e.g., {`{firstName}`}) to insert dynamic values. If a
                field is missing for a lead, an error will be shown and no message will be generated for that
                lead.
              </p>

              {usedFields.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Fields used in this template">
                  {usedFields.map(({ key, field, missing }) => (
                    <span
                      key={key}
                      className={`px-2 py-0.5 text-xs rounded ${
                        !field
                          ? 'bg-red-100 text-red-800'
                          : missing > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {field ? field.label : `{${key}}`}
                      {!field ? ' · unknown field' : missing > 0 ? ` · missing for ${missing}` : ''}
                    </span>
                  ))}
                </div>
              )}
              {(unknownFields.length > 0 || leadsMissingData > 0) && (
                <p className="mt-2 text-sm text-amber-700">
                  {unknownFields.length > 0
                    ? 'Unknown fields make generation fail for every lead.'
                    : `${leadsMissingData} of ${selectedLeads.length} selected lead${selectedLeads.length !== 1 ? 's' : ''} will get no message because of missing data.`}
                </p>
              )}
            </div>

            {template.trim() && previewLead && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Preview for{' '}
                    <span className="font-medium text-gray-700">
                      {previewLead.firstName} {previewLead.lastName || ''}
                    </span>
                  </span>
                  {selectedLeads.length > 1 && (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Previous lead"
                        onClick={() =>
                          setPreviewIndex((previewPosition - 1 + selectedLeads.length) % selectedLeads.length)
                        }
                        className="px-1 hover:text-gray-800"
                      >
                        &lsaquo;
                      </button>
                      {previewPosition + 1} / {selectedLeads.length}
                      <button
                        type="button"
                        aria-label="Next lead"
                        onClick={() => setPreviewIndex((previewPosition + 1) % selectedLeads.length)}
                        className="px-1 hover:text-gray-800"
                      >
                        &rsaquo;
                      </button>
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-900">
                  {renderTemplatePreview(template, previewLead)}
                </p>
              </div>
            )}

            {generationResult && (
              <div className="space-y-4">
                {generationResult.generatedCount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-green-600 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-green-800">
                        Successfully generated messages for {generationResult.generatedCount} lead
                        {generationResult.generatedCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {generationResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-800 mb-2">
                          Failed to generate messages for {generationResult.errors.length} lead
                          {generationResult.errors.length !== 1 ? 's' : ''}:
                        </h4>
                        <div className="space-y-1">
                          {generationResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              <span className="font-medium">{error.leadName}</span>: {error.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={generateMessagesMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generationResult ? 'Close' : 'Cancel'}
              </button>
              {(!generationResult || generationResult.errors.length > 0) && (
                <button
                  type="submit"
                  disabled={!template.trim() || generateMessagesMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generateMessagesMutation.isPending ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating...
                    </>
                  ) : generationResult ? (
                    'Try Again'
                  ) : (
                    'Generate Messages'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
