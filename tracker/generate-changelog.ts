import fs from 'node:fs/promises'
import { splitTelegramMessage } from './utils.ts'
import type { TrackerStats } from './types.ts'

export async function generateChangelog(stats: TrackerStats) {
  if (stats.changed.size === 0 && stats.failed.length === 0) {
    console.log('\nNo files changed. Exiting without commit.')
    process.exit(0)
  }

  const lines = [`chore: Changed ${stats.changed.size} file(s)`]

  if (stats.changed.size > 0) {
    lines.push(`\nChanged files (${stats.changed.size}):`)
    lines.push('\n<pre>')
    const sortedChanged = Array.from(stats.changed.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    for (const [path, info] of sortedChanged) {
      lines.push(`${path} [${info.fileSize}] (${info.lastCommitDate})`)
    }
    lines.push('</pre>')
  }

  if (stats.links.removed.length > 0) {
    lines.push(`\nRemoved files (${stats.links.removed.length}):`)
    lines.push('\n<pre>')
    for (const file of stats.links.removed) {
      lines.push(file)
    }
    lines.push('</pre>')
  }

  if (stats.failed.length > 0) {
    lines.push(`\nFailed downloads (${stats.failed.length}):`)
    lines.push('\n<pre>')
    for (const { url, error } of stats.failed) {
      lines.push(`${url} (${error})`)
    }
    lines.push('</pre>')
  }

  const duration = `\nDuration: ${((Date.now() - stats.startTime) / 1000).toFixed(2)}s`
  console.log(duration)
  lines.push(duration)

  const commitMessage = lines.join('\n').replaceAll('\n<pre>', '').replaceAll('\n</pre>', '')
  const telegramMessage = lines.slice(1).join('\n')

  await fs.writeFile('commit-message.txt', commitMessage, 'utf-8')

  const chunks = splitTelegramMessage(telegramMessage)
  for (let i = 0; i < chunks.length; i++) {
    await fs.writeFile(`telegram-message-${i + 1}.txt`, chunks[i], 'utf-8')
  }
}
