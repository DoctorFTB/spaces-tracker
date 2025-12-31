import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const links = await fs.readFile('links.json', 'utf-8');

const HOST = 'spaces.im';
const SANDBOX_KEY = 'beta';
const CONCURRENCY = 10;

const stats = {
  revisionsUpdated: false,
  changed: new Set(),
  failed: [],
};

function getFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function updateRevisions() {
  const req = await fetch(`https://${HOST}/js/revisions.json`, {
    headers: {
      Cookie: `sandbox=${SANDBOX_KEY}`
    }
  });

  if (!req.ok) {
    console.log(`Can't download revisions.json: ${req.status}`);
    return;
  }

  const res = await req.json();
  const revision = JSON.stringify(res, null, 2)

  const revisionFile = await fs.readFile("revisions.json", 'utf-8');
  const prevHash = getFileHash(revision);
  const currentHash = getFileHash(revisionFile);
  stats.revisionsUpdated = prevHash !== currentHash;

  await fs.writeFile("revisions.json", revision);
}

async function downloadAndExtractSourcemap(url) {
  const results = {
    url,
    success: true,
    files: [],
    error: null
  };

  try {
    const response = await fetch(url);
    if (!response.ok) {
      results.success = false;
      results.error = `HTTP ${response.status}`;
      return results;
    }

    const sourcemap = await response.json();
    if (!sourcemap.sources || !sourcemap.sourcesContent) {
      results.success = false;
      results.error = 'Invalid sourcemap format';
      return results;
    }

    for (let i = 0; i < sourcemap.sources.length; i++) {
      const sourcePath = sourcemap.sources[i];
      const sourceContent = sourcemap.sourcesContent[i];

      if (!sourceContent) {
        continue;
      }

      const cleanPath = sourcePath.replace(/^[a-z]+:\/\/\//, '');
      const localPath = path.join('.', cleanPath);

      let isChanged = false;
      const newHash = getFileHash(sourceContent);

      if (await fileExists(localPath)) {
        const existingContent = await fs.readFile(localPath, 'utf-8');
        const existingHash = getFileHash(existingContent);
        isChanged = newHash !== existingHash;
      } else {
        isChanged = true;
      }

      if (isChanged) {
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, sourceContent, 'utf-8');
        results.files.push({ path: localPath, isChanged: true });
      } else {
        results.files.push({ path: localPath, isChanged: false });
      }
    }
  } catch (error) {
    results.success = false;
    results.error = error.message;
  }

  return results;
}

async function processInBatches(items, batchSize, processor) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    console.log(`Processed ${Math.min(i + batchSize, items.length)}/${items.length} sourcemaps`);
  }

  return results;
}

async function main() {
  await updateRevisions();

  const sourcemapLinks = JSON.parse(links)
    .map((link) => `https://${HOST}${link}.map`);

  console.log(`Starting download sourcemap (${sourcemapLinks.length} links, concurrency: ${CONCURRENCY})...\n`);

  const startTime = Date.now();
  const results = await processInBatches(sourcemapLinks, CONCURRENCY, downloadAndExtractSourcemap);

  for (const result of results) {
    if (!result.success) {
      stats.failed.push({ url: result.url, error: result.error });
    } else {
      const changedFiles = result.files.filter(file => file.isChanged);
      if (changedFiles.length > 0) {
        changedFiles.forEach(file => stats.changed.add(file.path));
      }
    }
  }

  const lines = [`chore: Changed ${stats.changed.size} file(s)`];

  if (stats.revisionsUpdated) {
    lines.push('\n');
    lines.push('⚠️ revisions.json updated!');
  }

  if (stats.changed.size > 0) {
    lines.push(`\nChanged files (${stats.changed.size}):`);
    lines.push('\n<pre>')
    const sortedChanged = Array.from(stats.changed).sort();
    sortedChanged.forEach(file => {
      console.log(`  - ${file}`)
      lines.push(`- ${file}`);
    });
    lines.push('</pre>');
  }

  if (stats.failed.length > 0) {
    lines.push(`\nFailed downloads (${stats.failed.length}):`);
    lines.push('\n<pre>');
    stats.failed.forEach(({ url, error }) => {
      console.log(`  - ${url}: ${error}`)
      lines.push(`- ${url}`);
    });
    lines.push('</pre>');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nDuration: ${duration}s`);

  if (stats.changed.size === 0 || stats.failed.length === 0) {
    console.log('\nNo files updated. Exiting without commit.');
    process.exit(0);
  }

  const telegramMessage = lines.join('\n')
  const commitMessage = telegramMessage
    .replaceAll('<pre>', '')
    .replaceAll('</pre>', '')
    .replace('chore: ', '')

  await fs.writeFile('commit-message.txt', commitMessage, 'utf-8');
  await fs.writeFile('telegram-message.txt', telegramMessage, 'utf-8');
}

main().catch(console.error);
