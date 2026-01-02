import fs from 'node:fs/promises'
import path from 'node:path'
import { apiRequest } from './api.ts'
import { Config } from './config.ts'
import { fileIsChanged } from './utils.ts'
import type { RevisionAssets, TrackerLinks } from './types.ts'

export async function requestRevisions() {
  const fileName = path.basename(Config.RevisionsPath)
  const req = await apiRequest(`/js/${fileName}`)

  if (req.status === 304) {
    return { isChanged: false } as { isChanged: false, links?: undefined }
  }

  if (!req.ok) {
    throw new Error(`Can't download ${fileName}: ${req.status}`)
  }

  const res = await req.json()

  const jsAssets = Object.entries(res.js)
    .filter(([path]) => path.endsWith('.js'))
    .map(([path, hash]) => [`/js/${path}.map`, hash]) as RevisionAssets

  const cssAssets = Object.entries(res.css)
    .filter(([path]) => path.endsWith('.css'))
    .map(([path, hash]) => [`/css/custom/${path}.map`, hash]) as RevisionAssets

  const assets = [...jsAssets, ...cssAssets]
  const assetLinks: Record<string, string[]> = {}

  for (const [link, hash] of assets) {
    assetLinks[hash] ??= []
    assetLinks[hash].push(link)
  }

  const revision = JSON.stringify(res, null, 2)
  const isChanged = await fileIsChanged(revision, Config.RevisionsPath)

  if (!isChanged) {
    return { isChanged }
  }

  await fs.writeFile(Config.RevisionsPath, revision, 'utf-8')

  const currentLinks = await fs.readFile(Config.LinksPath, 'utf-8')
  const links = compareAssetsLinks(
    assetLinks,
    JSON.parse(currentLinks),
  )

  await fs.writeFile(
    Config.LinksPath,
    JSON.stringify(Object.values(assetLinks).flat(), null, 2),
    'utf-8',
  )

  return {
    isChanged,
    links: {
      assets: assetLinks,
      added: links.added,
      removed: links.removed,
    },
  }
}

function compareAssetsLinks(
  assets: Record<string, string[]>,
  currentLinks: string[],
): TrackerLinks {
  const links = Object.values(assets).flat()
  const linksSet = new Set(links)
  const currentLinksSet = new Set(currentLinks)
  const added = links.filter(link => !currentLinksSet.has(link))
  const removed = currentLinks.filter(link => !linksSet.has(link))

  return {
    assets,
    added,
    removed,
  }
}
