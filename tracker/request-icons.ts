import fs from 'node:fs/promises'
import path from 'node:path'
import { apiRequest } from './api.ts'
import { Config } from './config.ts'

const ICONS_SOURCE = '/css/custom/pc/b/main.css'
const ICONS_REGEX = /url\(['"]?(\/i\/[^'")]+)['"]?\)/g

export async function requestIcons() {
  const req = await apiRequest(ICONS_SOURCE)

  if (req.status === 304) {
    return
  }

  if (!req.ok) {
    console.log(`Can't download icons from ${ICONS_SOURCE}: ${req.status}`)
    return
  }

  const res = await req.text()

  const iconPaths = res.matchAll(ICONS_REGEX)
    .map((match) => match[1].split('?')[0])

  const sortedIcons = Array.from(new Set(iconPaths).values())
    .toSorted((a, b) => a[0].localeCompare(b[0]))

  for (const icon of sortedIcons) {
    const req = await apiRequest(icon)

    if (req.status === 304) {
      continue
    }

    if (!req.ok) {
      console.log(`Can't download icon ${icon}: ${req.status}`)
      continue
    }

    const buffer = await req.arrayBuffer()
    const iconPath = path.join('.', icon)
    await fs.mkdir(path.dirname(iconPath), { recursive: true })
    await fs.writeFile(
      iconPath,
      Buffer.from(buffer),
      'binary',
    )
  }

  await fs.writeFile(
    Config.IconsPath,
    JSON.stringify(Array.from(sortedIcons), null, 2),
    'utf-8',
  )
}
