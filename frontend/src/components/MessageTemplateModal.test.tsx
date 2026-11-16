import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeLead } from '../test/leadFixtures'
import { MessageTemplateModal } from './MessageTemplateModal'

const generateMessages = vi.fn()
vi.mock('../api', () => ({
  api: { leads: { generateMessages: (input: unknown) => generateMessages(input) } },
}))

const leads = [
  makeLead({ id: 1, firstName: 'Ada', phoneNumber: '+44 1' }),
  makeLead({ id: 2, firstName: 'Grace', lastName: 'Hopper', phoneNumber: null }),
]

const setup = () => {
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MessageTemplateModal
        isOpen
        onClose={onClose}
        selectedLeadIds={leads.map((lead) => lead.id)}
        selectedLeadsCount={leads.length}
        selectedLeads={leads}
      />
    </QueryClientProvider>
  )
  const textarea = screen.getByRole('textbox', { name: 'Message Template' }) as HTMLTextAreaElement
  return { onClose, textarea, user: userEvent.setup() }
}

describe('MessageTemplateModal', () => {
  beforeEach(() => {
    generateMessages.mockReset()
  })

  it('inserts a field picked from the "Insert field" button at the cursor', async () => {
    const { user, textarea } = setup()
    await user.type(textarea, 'Call ')
    await user.click(screen.getByRole('button', { name: /Insert field/ }))
    await user.click(screen.getByRole('option', { name: /Phone number/ }))
    expect(textarea).toHaveValue('Call {phoneNumber}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('toggles the picker closed with the same button', async () => {
    const { user } = setup()
    const button = screen.getByRole('button', { name: /Insert field/ })
    await user.click(button)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.click(button)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the picker when "{" is typed and replaces that brace with the chosen field', async () => {
    const { user, textarea } = setup()
    // "{{" is how user-event types a literal "{".
    await user.type(textarea, 'Hi {{')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('years{Enter}')
    expect(textarea).toHaveValue('Hi {yearsAtCompany}')
  })

  it('closes only the picker on Escape, not the modal', async () => {
    const { user, textarea, onClose } = setup()
    await user.type(textarea, '{{')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('flags fields that some selected leads lack, and unknown fields', async () => {
    const { user, textarea } = setup()
    await user.click(textarea)
    await user.paste('Hi {firstName}, call {phoneNumber} {nope}')
    const used = screen.getByLabelText('Fields used in this template')
    expect(used).toHaveTextContent('First name')
    expect(used).toHaveTextContent('Phone number · missing for 1')
    expect(used).toHaveTextContent('{nope} · unknown field')
    expect(screen.getByText(/Unknown fields make generation fail/)).toBeInTheDocument()
  })

  it('warns how many leads will get no message because of missing data', async () => {
    const { user, textarea } = setup()
    await user.click(textarea)
    await user.paste('Call {phoneNumber}')
    expect(
      screen.getByText('1 of 2 selected leads will get no message because of missing data.')
    ).toBeInTheDocument()
  })

  it('previews the message for each selected lead', async () => {
    const { user, textarea } = setup()
    await user.click(textarea)
    await user.paste('Hi {firstName}, {phoneNumber}')
    expect(screen.getByText('Hi Ada, +44 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next lead' }))
    // Missing values stay as the placeholder so the gap is visible.
    expect(screen.getByText('Hi Grace, {phoneNumber}')).toBeInTheDocument()
  })

  it('sends the template and the selected lead ids', async () => {
    generateMessages.mockResolvedValue({ success: true, generatedCount: 2, errors: [] })
    const { user, textarea, onClose } = setup()
    await user.click(textarea)
    await user.paste('Hi {firstName}')
    await user.click(screen.getByRole('button', { name: 'Generate Messages' }))
    expect(generateMessages).toHaveBeenCalledWith({ leadIds: [1, 2], template: 'Hi {firstName}' })
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
