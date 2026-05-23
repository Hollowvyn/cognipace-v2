import { Loader2 } from 'lucide-react'

import { InlineStatus } from '@/components/ui/inline-status'
import {
  useCreateProblem,
  useProblemForEdit,
  useUpdateProblem,
} from '@/features/problems/api/problems-api'
import { parseLeetCodeProblemInput } from '@/lib/leetcode'

import { ProblemFormFields } from './problem-form-fields'

type ProblemFormProps =
  | {
      mode: 'create'
      onCancel: () => void
      onSaved: () => void
    }
  | {
      mode: 'edit'
      onCancel: () => void
      onSaved: () => void
      problemSlug: string
    }

export function ProblemForm(props: ProblemFormProps) {
  if (props.mode === 'edit') {
    return (
      <EditProblemForm
        onCancel={props.onCancel}
        onSaved={props.onSaved}
        problemSlug={props.problemSlug}
      />
    )
  }

  return <CreateProblemForm onCancel={props.onCancel} onSaved={props.onSaved} />
}

function CreateProblemForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: () => void
}) {
  const createProblem = useCreateProblem()

  return (
    <ProblemFormFields
      mode="create"
      onCancel={onCancel}
      onSaved={onSaved}
      onSubmit={(values) =>
        createProblem.mutateAsync({
          surface: 'dashboard',
          slugOrUrl: readRequiredSlug(values.slugOrUrl),
          title: values.title.trim(),
          difficulty: values.difficulty,
          isPremium: values.isPremium,
          topicLabels: values.topicLabels,
          companyLabels: values.companyLabels,
        })
      }
      pending={createProblem.isPending}
    />
  )
}

function EditProblemForm({
  onCancel,
  onSaved,
  problemSlug,
}: {
  onCancel: () => void
  onSaved: () => void
  problemSlug: string
}) {
  const updateProblem = useUpdateProblem()
  const editQuery = useProblemForEdit({
    surface: 'dashboard',
    problemSlug,
  })

  if (editQuery.isPending) {
    return (
      <InlineStatus>
        <Loader2 aria-hidden="true" className="animate-spin" />
        Loading problem…
      </InlineStatus>
    )
  }

  if (editQuery.isError || !editQuery.data) {
    return (
      <InlineStatus role="alert" tone="danger">
        Failed to load this problem.
      </InlineStatus>
    )
  }

  return (
    <ProblemFormFields
      key={editQuery.data.problem.slug}
      mode="edit"
      onCancel={onCancel}
      onSaved={onSaved}
      onSubmit={(values) =>
        updateProblem.mutateAsync({
          surface: 'dashboard',
          problemSlug: editQuery.data.problem.slug,
          title: values.title.trim(),
          difficulty: values.difficulty,
          isPremium: values.isPremium,
          topicLabels: values.topicLabels,
          companyLabels: values.companyLabels,
        })
      }
      pending={updateProblem.isPending}
      problem={editQuery.data.problem}
      selectedCompanyLabels={editQuery.data.companies.map(
        (company) => company.label,
      )}
      selectedTopicLabels={editQuery.data.topics.map((topic) => topic.label)}
    />
  )
}

function readRequiredSlug(slugOrUrl: string) {
  return parseLeetCodeProblemInput(slugOrUrl)?.slug ?? ''
}
