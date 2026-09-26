import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import type { ProblemLibraryOptions } from '../../api/problems-contracts'
import {
  defaultProblemLibraryFilters,
  type ProblemLibraryFilters,
} from './problem-library-filtering'
import { ProblemLibraryTopicFilter } from './problem-library-topic-filter'

const options: ProblemLibraryOptions['topics'] = [
  {
    id: 'depth-first-search',
    label: 'Depth-First Search',
    aliases: ['DFS', 'Depth First Search'],
  },
  { id: 'tree', label: 'Tree', aliases: ['Trees'] },
]

function Harness({
  initialFilters = defaultProblemLibraryFilters,
  topicOptions = options,
}: {
  initialFilters?: ProblemLibraryFilters
  topicOptions?: ProblemLibraryOptions['topics']
}) {
  const [filters, setFilters] = useState<ProblemLibraryFilters>({
    ...initialFilters,
    topicIds: [...initialFilters.topicIds],
  })

  return (
    <ProblemLibraryTopicFilter
      options={topicOptions}
      filters={filters}
      onChange={(patch) => setFilters((old) => ({ ...old, ...patch }))}
    />
  )
}

it('finds an alias and selects only the canonical topic', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  await user.click(screen.getByRole('button', { name: /Topics/ }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Search topics' }),
    'DFS',
  )

  const option = screen.getByRole('checkbox', { name: 'Depth-First Search' })
  await user.click(option)

  expect(option).toBeChecked()
  expect(screen.queryByRole('checkbox', { name: /^Tree$/ })).toBeNull()
  expect(
    screen.getAllByRole('checkbox', { name: 'Depth-First Search' }),
  ).toHaveLength(1)

  await user.keyboard('{Escape}')
  expect(
    screen.getByRole('button', { name: /Topics: Depth-First Search/ }),
  ).toHaveFocus()
})

it('shows every canonical option for an empty query', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  await user.click(screen.getByRole('button', { name: /Topics/ }))

  expect(
    screen.getByRole('checkbox', { name: 'Depth-First Search' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Tree' })).toBeInTheDocument()
})

it('shows an empty state when punctuation does not match a topic', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  await user.click(screen.getByRole('button', { name: /Topics/ }))
  await user.type(screen.getByRole('searchbox', { name: 'Search topics' }), '/')

  expect(screen.getByRole('status')).toHaveTextContent(
    'No topics match this search.',
  )
  expect(
    within(screen.getByRole('group', { name: 'Topic choices' })).queryByRole(
      'checkbox',
    ),
  ).toBeNull()
})

it('shows canonical options even when no problems currently use them', async () => {
  const user = userEvent.setup()
  render(
    <Harness
      topicOptions={[
        { id: 'unused-option', label: 'Unused Option', aliases: ['Unused'] },
      ]}
    />,
  )

  await user.click(screen.getByRole('button', { name: /Topics/ }))

  expect(
    screen.getByRole('checkbox', { name: 'Unused Option' }),
  ).toBeInTheDocument()
})

it('retains selected canonical IDs as the query changes', async () => {
  const user = userEvent.setup()
  render(
    <Harness
      initialFilters={{
        ...defaultProblemLibraryFilters,
        topicIds: ['tree'],
      }}
    />,
  )

  await user.click(screen.getByRole('button', { name: /Topics: Tree/ }))
  const search = screen.getByRole('searchbox', { name: 'Search topics' })
  await user.type(search, 'DFS')

  expect(
    screen.getByRole('checkbox', { name: 'Depth-First Search' }),
  ).not.toBeChecked()
  expect(screen.queryByRole('checkbox', { name: /^Tree$/ })).toBeNull()

  await user.clear(search)
  expect(screen.getByRole('checkbox', { name: 'Tree' })).toBeChecked()
})

it('keeps selected IDs that are absent from the current catalogue', async () => {
  const user = userEvent.setup()
  render(
    <Harness
      initialFilters={{
        ...defaultProblemLibraryFilters,
        topicIds: ['retired-topic'],
      }}
    />,
  )

  await user.click(screen.getByRole('button', { name: /Topics/ }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Search topics' }),
    'Tree',
  )
  expect(screen.getByRole('checkbox', { name: 'Tree' })).not.toBeChecked()
})

it('renders one canonical option even when aliases are duplicated', async () => {
  const user = userEvent.setup()
  render(
    <Harness
      topicOptions={[
        {
          id: 'depth-first-search',
          label: 'Depth-First Search',
          aliases: ['DFS', 'DFS', 'depth-first-search'],
        },
      ]}
    />,
  )

  await user.click(screen.getByRole('button', { name: /Topics/ }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Search topics' }),
    'DFS',
  )

  expect(
    screen.getAllByRole('checkbox', { name: 'Depth-First Search' }),
  ).toHaveLength(1)
})

it('closes on an outside pointer without moving focus from its destination', async () => {
  const user = userEvent.setup()
  render(
    <>
      <Harness />
      <button type="button">Outside action</button>
    </>,
  )

  await user.click(screen.getByRole('button', { name: /Topics/ }))
  const outside = screen.getByRole('button', { name: 'Outside action' })
  await user.click(outside)

  expect(screen.queryByRole('searchbox', { name: 'Search topics' })).toBeNull()
  expect(outside).toHaveFocus()
})

it('keeps normal Tab movement untrapped', async () => {
  const user = userEvent.setup()
  render(
    <>
      <Harness />
      <button type="button">After topics</button>
    </>,
  )

  await user.click(screen.getByRole('button', { name: /Topics/ }))
  const search = screen.getByRole('searchbox', { name: 'Search topics' })
  expect(search).toHaveFocus()

  for (let index = 0; index < 6; index += 1) {
    await user.tab()
  }

  expect(screen.getByRole('button', { name: 'After topics' })).toHaveFocus()
})
