import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseUrlArg(argv) {
  const args = [...argv];
  for (const arg of args) {
    if (arg.startsWith('--url=')) {
      return arg.slice('--url='.length);
    }
  }
  const idx = args.indexOf('--url');
  if (idx !== -1 && args.length > idx + 1) {
    return args[idx + 1];
  }
  return null;
}

async function ensureArtifactsDir() {
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  const repoRoot = path.resolve(scriptDir, '..', '..');
  const artifactsDir = path.join(repoRoot, 'artifacts', 'ui-poc');
  await fs.mkdir(artifactsDir, { recursive: true });
  return {
    screenshot: path.join(artifactsDir, 'screenshot.png'),
    dom: path.join(artifactsDir, 'dom.html'),
  };
}

async function capture(url) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    console.log(`[pw] goto ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('[pw] done');
    const { screenshot, dom } = await ensureArtifactsDir();
    await page.screenshot({ path: screenshot, fullPage: true });
    const html = await page.content();
    await fs.writeFile(dom, html, 'utf-8');
    console.log(`Saved screenshot: ${screenshot}`);
    console.log(`Saved DOM: ${dom}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const url = parseUrlArg(process.argv.slice(2));
  if (!url) {
    console.error('Missing required --url argument');
    process.exitCode = 1;
    return;
  }

  try {
    await capture(url);
  } catch (error) {
    console.error('[pw] error:', error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

main();
