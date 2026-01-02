import fs from 'node:fs/promises'
import path from 'node:path'
import { apiRequest } from './api.ts'
import { Config } from './config.ts'
import {
  compareFileSize,
  fileExists,
  fileIsChanged,
  fileLastCommitDate,
} from './utils.ts'
import type { Sourcemap, SourcemapFile, SourcemapResponse } from './types.ts'

const processedPathToSize: Record<string, number> = {}

async function loadSourcemap(url: string) {
  const results: SourcemapResponse = {
    url,
    files: [],
    error: null,
  }

  try {
    const req = await apiRequest(url)

    if (req.status === 304) {
      return results
    }

    if (!req.ok) {
      results.error = `HTTP ${req.status}`
      return results
    }

    const sourcemap = await req.json() as Sourcemap
    if (!sourcemap.sourcesContent && !sourcemap.mappings) {
      results.error = 'Sourcemap is empty'
      return results
    }

    for (let i = 0; i < sourcemap.sources.length; i++) {
      const sourcePath = sourcemap.sources[i]
      const sourceContent = sourcemap.sourcesContent[i]
      if (!sourceContent) continue

      if (sourcePath in processedPathToSize) {
        if (processedPathToSize[sourcePath] !== sourceContent.length) {
          console.error(`Something goes wrong... At ${sourcePath}, prev: ${processedPathToSize[sourcePath]}, next: ${sourceContent.length}`)
          process.exit(1)
        }

        continue
      } else {
        processedPathToSize[sourcePath] = sourceContent.length
      }

      let fileSize = ''
      let isChanged = false
      let lastCommitDate: SourcemapFile['lastCommitDate'] | undefined

      const contentPath = path.join('.', sourcePath.replace(/^[a-z]+:\/\/\//, ''))
      const isFileExists = await fileExists(contentPath)

      if (isFileExists) {
        isChanged = await fileIsChanged(sourceContent, contentPath)
        if (isChanged) lastCommitDate = await fileLastCommitDate(contentPath)

        const fileStats = await fs.stat(contentPath)
        fileSize = compareFileSize(fileStats.size, sourceContent.length)
      } else {
        lastCommitDate = 'new'
        fileSize = compareFileSize(sourceContent.length, sourceContent.length)
      }

      await fs.mkdir(path.dirname(contentPath), { recursive: true })
      await fs.writeFile(contentPath, sourceContent, 'utf-8')

      results.files.push({
        path: contentPath,
        isChanged: lastCommitDate === 'new' || isChanged,
        fileSize,
        lastCommitDate,
      })
    }
  } catch (error) {
    results.error = (error as Error).message ?? 'Unknown error'
  }

  return results
}

export async function requestSourcemaps(assets: Record<string, string[]>) {
  const hashes = Object.keys(assets)
  const countAssets = hashes.length
  console.log(`Starting download sourcemaps (${countAssets} assets, concurrency: ${Config.Concurrency})\n`)

  const resources: SourcemapResponse[] = []
  let index = 0

  const worker = async () => {
    while (index < hashes.length) {
      const currentIndex = index++
      const hash = hashes[currentIndex]
      const urls = assets[hash]

      let result: SourcemapResponse | null = null

      for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
        const url = urls[urlIndex]
        result = await loadSourcemap(url)

        if (!result.error) {
          break
        }

        if (result.error && urlIndex < urls.length - 1) {
          console.warn(`❌ ${url}: ${result.error}. Trying next URL...`)
        }
      }

      if (result) {
        resources[currentIndex] = result
        const status = result.error ? `❌ ${result.error}` : '✅'
        console.log(`${status} ${result.url} (${currentIndex + 1}/${countAssets})`)
      }
    }
  }

  await Promise.all(Array.from({ length: Config.Concurrency }, worker))
  return resources
}
