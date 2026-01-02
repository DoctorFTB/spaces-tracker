import fs from 'node:fs/promises'
import { Config } from './config.ts'

const storedEtags: Record<string, string> = JSON.parse(await fs.readFile(Config.EtagsPath, 'utf-8'))

export async function saveEtags() {
  await fs.writeFile(Config.EtagsPath, JSON.stringify(storedEtags, null, 2))
}

export async function apiRequest(path: string) {
  const url = new URL(path, Config.Host)

  const response = await fetch(url, {
    headers: {
      ...Config.RequestHeaders,
      'If-None-Match': storedEtags[path],
    },
  })

  if (response.status !== 304 && response.headers.has('etag')) {
    storedEtags[path] = response.headers.get('etag')!
  }

  return response
}
