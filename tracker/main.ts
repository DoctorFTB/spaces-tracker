import { saveEtags } from './api.ts'
import { generateChangelog } from './generate-changelog.ts'
import { requestIcons } from './request-icons.ts'
import { requestRevisions } from './request-revisions.ts'
import { requestSourcemaps } from './request-sourcemap.ts'
import type { TrackerStats } from './types.ts'

const stats: TrackerStats = {
  startTime: Date.now(),
  changed: new Map(),
  failed: [],
  links: {
    assets: {},
    added: [],
    removed: [],
  },
}

async function main() {
  const revisions = await requestRevisions()
  if (!revisions.isChanged) {
    console.log(`No changes found in "revisions.json". Nothing to do.`)
    return
  }

  const sourcemaps = await requestSourcemaps(revisions.links.assets)
  for (const result of sourcemaps) {
    if (result.error) {
      stats.failed.push({
        url: result.url,
        error: result.error,
      })
    } else {
      const changedFiles = result.files.filter(file => file.isChanged)
      for (const file of changedFiles) {
        stats.changed.set(file.path, file)
      }
    }
  }

  if (stats.changed.size === 0 && stats.failed.length === 0) {
    console.log('\nNo files changed. Exiting without commit.')
    process.exit(0)
  }

  await requestIcons()

  saveEtags()

  stats.links = revisions.links
  generateChangelog(stats)
}

main().catch(console.log)
