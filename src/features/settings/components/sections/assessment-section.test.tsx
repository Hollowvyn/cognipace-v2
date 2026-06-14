import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  defaultUserSettings,
  type UserSettings,
} from '@/features/settings/domain'

import { AssessmentSection } from './assessment-section'

function renderSection(draft: UserSettings = defaultUserSettings) {
  const actions = {
    setAiAssessmentEnabled: vi.fn(),
    setAutoAssessmentEnabled: vi.fn(),
  }

  render(
    <AssessmentSection actions={actions} draft={draft} providerReady={false} />,
  )

  return actions
}

describe('AssessmentSection', () => {
  it('renders assessment toggles without legacy provider setup controls', () => {
    renderSection()

    expect(
      screen.getByRole('heading', { name: 'Assessment' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Auto assessment' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'AI assessment' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('radio', { name: 'OpenAI' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('radio', { name: 'Anthropic' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('radio', { name: 'Gemini' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^model$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/saved keys/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /save key/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /remove key/i }),
    ).not.toBeInTheDocument()
  })

  it('warns when AI assessment is enabled but the provider is not ready', () => {
    renderSection({
      ...defaultUserSettings,
      aiAssessment: {
        ...defaultUserSettings.aiAssessment,
        enabled: true,
      },
    })

    expect(
      screen.getByText(
        'AI provider setup is not ready. Auto assessment will use the deterministic policy.',
      ),
    ).toBeInTheDocument()
  })

  it('lets users toggle AI assessment when provider setup is missing', async () => {
    const actions = renderSection()
    const user = userEvent.setup()

    await user.click(screen.getByRole('switch', { name: 'AI assessment' }))

    expect(actions.setAiAssessmentEnabled).toHaveBeenCalledWith(true)
  })
})
