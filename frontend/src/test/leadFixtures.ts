import { Lead } from '../leadFields'

export const makeLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  jobTitle: 'Engineer',
  countryCode: 'GB',
  companyName: 'Analytical Engines',
  message: null,
  emailVerified: null,
  phoneNumber: '+44 20 7946 0958',
  yearsAtCompany: 3,
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  ...overrides,
})
