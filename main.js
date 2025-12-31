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

const UNITS = {
  year: 365 * 24 * 60 * 60 * 1000,
  month: (365 / 12) * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
  second: 1000,
}

const timeFormat = new Intl.RelativeTimeFormat('en', { style: 'long' })

function formatTimeSince(time) {
  const diffInMs = time - Date.now()
  const absDiff = Math.abs(diffInMs)

  for (const [unit, msValue] of Object.entries(UNITS)) {
    if (absDiff >= msValue || unit === 'second') {
      const value = Math.round(diffInMs / msValue)
      return timeFormat.format(value, unit)
    }
  }
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
  const jsPaths = Object.keys(res.js)
  const cssPaths = Object.keys(res.css)
  const revisions = JSON.stringify([...jsPaths, ...cssPaths].toSorted(), null, 2)
  await fs.writeFile("revisions.json", revisions)
}

async function downloadAndExtractSourcemap(url) {
  const results = {
    url,
    success: true,
    files: [],
    error: null
  }

  try {
    const req = await fetch(url, {
      headers: {
        Cookie: `sandbox=${SANDBOX_KEY}`
      }
    })

    if (!req.ok) {
      results.success = false
      results.error = `HTTP ${req.status}`
      return results
    }

    const sourcemap = await req.json()
    if (!sourcemap.sources || !sourcemap.sourcesContent) {
      results.success = false
      results.error = 'Invalid sourcemap format'
      return results
    }

    for (let i = 0; i < sourcemap.sources.length; i++) {
      const sourcePath = sourcemap.sources[i]
      const sourceContent = sourcemap.sourcesContent[i]
      if (!sourceContent) continue

      const cleanPath = sourcePath.replace(/^[a-z]+:\/\/\//, '')
      const localPath = path.join('.', cleanPath)
      const newHash = getFileHash(sourceContent)
      let isChanged = false
      let previousModified = null

      if (await fileExists(localPath)) {
        const existingContent = await fs.readFile(localPath, 'utf-8')
        const existingHash = getFileHash(existingContent)
        isChanged = newHash !== existingHash

        if (isChanged) {
          const fileStat = await fs.stat(localPath)
          previousModified = fileStat.mtime
        }
      } else {
        isChanged = true
      }

      if (isChanged) {
        await fs.mkdir(path.dirname(localPath), { recursive: true })
        await fs.writeFile(localPath, sourceContent, 'utf-8')
        results.files.push({
          path: localPath,
          isChanged: true,
          previousModified,
        })
      } else {
        results.files.push({
          path: localPath,
          isChanged: false,
        })
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

  console.log(`Starting download sourcemaps (${sourcemapLinks.length} links, concurrency: ${CONCURRENCY})\n`)

  const startTime = Date.now()
  const results = await processInBatches(sourcemapLinks, CONCURRENCY, downloadAndExtractSourcemap)

  for (const result of results) {
    if (!result.success) {
      stats.failed.push({ url: result.url, error: result.error })
    } else {
      const changedFiles = result.files.filter(file => file.isChanged)
      for (const file of changedFiles) {
        stats.changed.set(file.path, {
          previousModified: file.previousModified,
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
      const timeSuffix = info.previousModified ? ` (${formatTimeSince(info.previousModified.getTime())})` : ' (new)'
      lines.push(`${file}${timeSuffix}`)
    })
    lines.push('</pre>')
  }

  if (stats.failed.length > 0) {
    lines.push(`\nFailed downloads (${stats.failed.length}):`)
    lines.push('\n<pre>')
    stats.failed.forEach(({ url, error }) => {
      lines.push(`${url} (${error})`)
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
