import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeLead } from '../test/leadFixtures'
import { LeadsList } from './LeadsList'

vi.mock('../api', () => ({
  api: {
    leads: {
      getMany: async () => [
        makeLead({ id: 1 }),
        makeLead({ id: 2, firstName: 'Grace', phoneNumber: null, yearsAtCompany: 0, linkedinUrl: null }),
      ],
    },
  },
}))

describe('LeadsList new lead fields', () => {
  it('shows phone, LinkedIn and years at company columns', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LeadsList />
      </QueryClientProvider>
    )

    const [, adaRow, graceRow] = await screen.findAllByRole('row')
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual(expect.arrayContaining(['Phone', 'LinkedIn', 'Years at Company']))

    expect(within(adaRow).getByRole('link', { name: '+44 20 7946 0958' })).toHaveAttribute(
      'href',
      'tel:+44 20 7946 0958'
    )
    const linkedin = within(adaRow).getByRole('link', { name: 'in/ada' })
    expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/ada')
    expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer')
    expect(adaRow).toHaveTextContent('3')

    // 0 years is a value, not "missing"; missing values show "-".
    const graceCells = within(graceRow)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(graceCells).toContain('0')
    expect(within(graceRow).queryAllByRole('link')).toHaveLength(0)
  })
})
