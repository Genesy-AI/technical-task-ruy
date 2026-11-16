import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeLead } from '../test/leadFixtures'
import { TemplateFieldPicker } from './TemplateFieldPicker'

const leads = [makeLead({ id: 1 }), makeLead({ id: 2, phoneNumber: null })]

const setup = () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(<TemplateFieldPicker leads={leads} onSelect={onSelect} onClose={onClose} />)
  return { onSelect, onClose, user: userEvent.setup() }
}

describe('TemplateFieldPicker', () => {
  it('focuses the search box and lists the fields grouped, with the new fields', () => {
    setup()
    expect(screen.getByRole('combobox', { name: 'Search fields' })).toHaveFocus()
    for (const group of ['Person', 'Contact', 'Work']) expect(screen.getByText(group)).toBeInTheDocument()
    for (const label of ['Phone number', 'LinkedIn profile URL', 'Years at company']) {
      expect(screen.getByRole('option', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('shows how many selected leads have each field', () => {
    setup()
    expect(screen.getByRole('option', { name: /Phone number/ })).toHaveTextContent('1/2')
    expect(screen.getByRole('option', { name: /First name/ })).toHaveTextContent('2/2')
  })

  it('filters by label and keywords', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('combobox'), 'mobile')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option')).toHaveTextContent('Phone number')
  })

  it('shows an empty state when nothing matches', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('combobox'), 'zzz')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No fields match')).toBeInTheDocument()
  })

  it('selects with the keyboard', async () => {
    const { user, onSelect } = setup()
    await user.type(screen.getByRole('combobox'), 'linkedin')
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'linkedinUrl' }))
  })

  it('moves the active option with the arrow keys', async () => {
    const { user, onSelect } = setup()
    await user.keyboard('{ArrowDown}{Enter}')
    // Person group order: First name, Last name, Country.
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'lastName' }))
  })

  it('selects with the mouse', async () => {
    const { user, onSelect } = setup()
    await user.click(screen.getByRole('option', { name: /Years at company/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'yearsAtCompany' }))
  })

  it('inserts a placeholder typed by hand once it is closed with "}"', async () => {
    const { user, onSelect } = setup()
    await user.type(screen.getByRole('combobox'), 'phoneNumber}')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'phoneNumber' }))
  })

  it('closes on Escape', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
