import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import {
  ProblemLabelInput,
  type ProblemLabelOption,
} from './problem-label-input'

const topicOptions = [
  { id: 'array', label: 'Array' },
  { id: 'binary-search', label: 'Binary Search' },
  { id: 'dynamic-programming', label: 'Dynamic Programming' },
] satisfies ProblemLabelOption[]

describe('ProblemLabelInput', () => {
  it('selects a matching option with Enter before creating a custom label', async () => {
    const user = userEvent.setup()
    renderLabelInput()

    await user.type(screen.getByLabelText('Topics'), 'arr{Enter}')

    expect(
      screen.getByRole('button', { name: 'Remove topic Array' }),
    ).toBeVisible()
    expect(screen.queryByText('arr')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Topics'))

    expect(screen.queryByRole('option', { name: /Array/ })).toBeNull()
    expect(
      screen.getByRole('option', { name: /Dynamic Programming/ }),
    ).toBeVisible()
  })

  it('creates a custom label when no existing option matches', async () => {
    const user = userEvent.setup()
    renderLabelInput()

    await user.type(screen.getByLabelText('Topics'), 'Sliding Window{Enter}')

    expect(
      screen.getByRole('button', { name: 'Remove topic Sliding Window' }),
    ).toBeVisible()
  })

  it('supports arrow navigation through options', async () => {
    const user = userEvent.setup()
    renderLabelInput()

    await user.click(screen.getByLabelText('Topics'))

    expect(screen.getByRole('option', { name: /Array/ })).toHaveAttribute(
      'aria-selected',
      'false',
    )

    await user.keyboard('{ArrowDown}{Enter}')

    expect(
      screen.getByRole('button', { name: 'Remove topic Array' }),
    ).toBeVisible()
  })

  it('removes selected labels by pill and Backspace', async () => {
    const user = userEvent.setup()
    renderLabelInput({ initialLabels: ['Graph', 'Array'] })

    await user.click(screen.getByRole('button', { name: 'Remove topic Graph' }))
    expect(screen.queryByText('Graph')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Topics'))
    await user.keyboard('{Backspace}')

    expect(
      screen.queryByRole('button', { name: 'Remove topic Array' }),
    ).not.toBeInTheDocument()
  })

  it('keeps Escape scoped to the open label menu', async () => {
    const user = userEvent.setup()
    let parentEscapeCount = 0

    render(
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            parentEscapeCount += 1
          }
        }}
      >
        <ProblemLabelInput
          itemName="topic"
          label="Topics"
          labels={[]}
          onChange={() => undefined}
          options={topicOptions}
        />
      </div>,
    )

    await user.click(screen.getByLabelText('Topics'))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(parentEscapeCount).toBe(0)
  })
})

function renderLabelInput({
  initialLabels = [],
  options = topicOptions,
}: {
  initialLabels?: string[]
  options?: readonly ProblemLabelOption[]
} = {}) {
  function LabelInputHarness() {
    const [labels, setLabels] = useState(initialLabels)

    return (
      <ProblemLabelInput
        itemName="topic"
        label="Topics"
        labels={labels}
        onChange={setLabels}
        options={options}
      />
    )
  }

  return render(<LabelInputHarness />)
}
