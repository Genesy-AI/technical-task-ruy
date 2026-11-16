import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CsvImportModal } from './CsvImportModal'

const bulkImport = vi.fn()
vi.mock('../api', () => ({
  api: { leads: { bulkImport: (input: unknown) => bulkImport(input) } },
}))

// Same headers as the sample files in docs/, plus a LinkedIn column.
const csv = `firstName,lastName,email,yearsInRole,phoneNumber,linkedinUrl
Ada,Lovelace,ada@example.com,3,+1-280-754-0462,linkedin.com/in/ada
Grace,Hopper,grace@example.com,two,,https://example.com/grace`

describe('CsvImportModal new lead fields', () => {
  it('previews the new fields, flags invalid values and imports only valid rows with them', async () => {
    bulkImport.mockResolvedValue({
      success: true,
      importedCount: 1,
      duplicatesSkipped: 0,
      invalidLeads: 0,
      errors: [],
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CsvImportModal isOpen onClose={() => {}} />
      </QueryClientProvider>
    )

    // The modal renders in a portal on document.body.
    const input = document.body.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(input, new File([csv], 'leads.csv', { type: 'text/csv' }))

    expect(await screen.findByText('+1-280-754-0462')).toBeInTheDocument()
    expect(screen.getByText('https://linkedin.com/in/ada')).toBeInTheDocument()
    expect(screen.getByText(/Years at company must be a whole number/)).toBeInTheDocument()
    expect(screen.getByText(/LinkedIn URL must point to linkedin.com/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Import/ }))
    expect(bulkImport).toHaveBeenCalledWith({
      leads: [
        expect.objectContaining({
          firstName: 'Ada',
          phoneNumber: '+1-280-754-0462',
          yearsAtCompany: 3,
          linkedinUrl: 'https://linkedin.com/in/ada',
        }),
      ],
    })
  })
})
