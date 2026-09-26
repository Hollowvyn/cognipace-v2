import { reconcileTopicTaxonomy } from '@/features/problems/data/topic-reconciliation'
import {
  seedTopicAliases,
  seedTopicRelations,
  seedTopics,
} from '@/platform/db/topic-taxonomy-seed'
import { getAppDb } from '@/platform/db'

export function getBackgroundDb() {
  return getAppDb({
    beforePublish: async (handle, context) => {
      await reconcileTopicTaxonomy(handle.db, {
        legacy: context.kind === 'upgrade',
        now: new Date(),
        catalogue: {
          topics: seedTopics,
          aliases: seedTopicAliases,
          relations: seedTopicRelations,
        },
      })
    },
  })
}
