import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const links = await fs.readFile('links.json', 'utf-8')

const HOST = 'spaces.im'
const SANDBOX_KEY = 'beta'
const CONCURRENCY = 10

const stats = {
  changed: new Map(),
  failed: [],
}

function getFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex')
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function formatTimeSince(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) return `${years}y`
  if (months > 0) return `${months}mo`
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}


async function updateRevisions() {
  const req = await fetch(`https://${HOST}/js/revisions.json`, {
    headers: {
      Cookie: `sandbox=${SANDBOX_KEY}`
    }
  })

  if (!req.ok) {
    console.log(`Can't download revisions.json: ${req.status}`)
    return
  }

  const res = await req.json()
  const revision = JSON.stringify(res, null, 2)
  await fs.writeFile("revisions.json", revision)
}

async function downloadAndExtractSourcemap(url) {
  const results = {
    url,
    success: true,
    files: [],
    error: null
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      results.success = false
      results.error = `HTTP ${response.status}`
      return results
    }

    const sourcemap = await response.json()
    if (!sourcemap.sources || !sourcemap.sourcesContent) {
      results.success = false
      results.error = 'Invalid sourcemap format'
      return results
    }

    for (let i = 0; i < sourcemap.sources.length; i++) {
      const sourcePath = sourcemap.sources[i]
      const sourceContent = sourcemap.sourcesContent[i]

      if (!sourceContent) {
        continue
      }

      const cleanPath = sourcePath.replace(/^[a-z]+:\/\/\//, '')
      const localPath = path.join('.', cleanPath)
      const newHash = getFileHash(sourceContent)
      let isChanged = false
      let lastModified = null

      if (await fileExists(localPath)) {
        const existingContent = await fs.readFile(localPath, 'utf-8')
        const existingHash = getFileHash(existingContent)
        isChanged = newHash !== existingHash

        if (isChanged) {
          const fileStat = await fs.stat(localPath)
          lastModified = fileStat.mtime
        }
      } else {
        isChanged = true
      }

      if (isChanged) {
        await fs.mkdir(path.dirname(localPath), { recursive: true })
        await fs.writeFile(localPath, sourceContent, 'utf-8')
        results.files.push({ path: localPath, isChanged: true, lastModified })
      } else {
        results.files.push({ path: localPath, isChanged: false })
      }
    }
  } catch (error) {
    results.success = false
    results.error = error.message
  }

  return results
}

async function processInBatches(items, batchSize, processor) {
  const results = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    console.log(`Processed ${Math.min(i + batchSize, items.length)}/${items.length} sourcemaps`)
  }

  return results
}

async function main() {
  await updateRevisions()

  const sourcemapLinks = JSON.parse(links)
    .map((link) => `https://${HOST}${link}.map`)

  console.log(`Starting download sourcemaps (${sourcemapLinks.length} links, concurrency: ${CONCURRENCY})...\n`)

  const startTime = Date.now()
  const results = await processInBatches(sourcemapLinks, CONCURRENCY, downloadAndExtractSourcemap)

  for (const result of results) {
    if (!result.success) {
      stats.failed.push({ url: result.url, error: result.error })
    } else {
      const changedFiles = result.files.filter(file => file.isChanged)
      if (changedFiles.length > 0) {
        changedFiles.forEach(file => {
          stats.changed.set(file.path, {
            lastModified: file.lastModified,
            timeSince: file.lastModified ? Date.now() - file.lastModified.getTime() : null
          })
        })
      }
    }
  }

  const lines = [`chore: Changed ${stats.changed.size} file(s)`]

  if (stats.changed.size > 0) {
    lines.push(`\nChanged files (${stats.changed.size}):`)
    lines.push('\n<pre>')
    const sortedChanged = Array.from(stats.changed.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    sortedChanged.forEach(([file, info]) => {
      const timeSuffix = info.timeSince ? ` (${formatTimeSince(info.timeSince)} ago)` : ' (new)'
      lines.push(`- ${file}${timeSuffix}`)
    })
    lines.push('</pre>')
  }

  if (stats.failed.length > 0) {
    lines.push(`\nFailed downloads (${stats.failed.length}):`)
    lines.push('\n<pre>')
    stats.failed.forEach(({ url, error }) => {
      lines.push(`- ${url} (${error})`)
    })
    lines.push('</pre>')
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\nDuration: ${duration}s`)

  if (stats.changed.size === 0 && stats.failed.length === 0) {
    console.log('\nNo files changed. Exiting without commit.')
    process.exit(0)
  }

  const commitMessage = lines.join('\n').replaceAll('\n<pre>', '').replaceAll('\n</pre>', '')
  const telegramMessage = lines.slice(1).join('\n')

  await fs.writeFile('commit-message.txt', commitMessage, 'utf-8')
  await fs.writeFile('telegram-message.txt', telegramMessage, 'utf-8')
}

main().catch(console.error)
