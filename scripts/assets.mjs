import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execSync } from 'node:child_process';

const REPO = 'fitri-hy/PBLabs';

function parseTagArg(argv) {
  let tag = '0.0.1';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--tag' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      tag = argv[i + 1].trim();
      i++;
    } else if (arg.startsWith('--tag=')) {
      tag = arg.slice('--tag='.length).trim();
    } else if (arg.startsWith('--') && arg !== '--assets') {
      const candidate = arg.slice(2).trim();
      if (candidate) {
        tag = candidate;
      }
    }
  }

  return tag;
}

const TAG = parseTagArg(process.argv.slice(2));
const PUBLIC_DIR = path.resolve('public');
const TARGET_ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

function getHeaders() {
  const headers = {
    'User-Agent': 'pblabs-assets-download',
    'Accept': 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function listAvailableTags() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const releases = await res.json();
    return Array.isArray(releases) ? releases.map((r) => r.tag_name) : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log(`Checking release for ${REPO} (Tag: ${TAG})...`);

  const response = await fetch(
    `https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(TAG)}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    console.error(`Failed to fetch release data for tag ${TAG}: ${response.statusText} (${response.status})`);
    if (response.status === 404) {
      const tags = await listAvailableTags();
      if (tags.length > 0) {
        console.error(`Available tags: ${tags.join(', ')}`);
      } else {
        console.error('No published releases found (or repo is private and GITHUB_TOKEN is missing).');
      }
    }
    process.exitCode = 1;
    return;
  }

  const release = await response.json();
  const assets = release.assets || [];
  const zipAssets = assets.filter((asset) => asset.name.endsWith('.zip'));

  if (zipAssets.length === 0) {
    console.log(`No .zip files found in release tag ${TAG}.`);
    return;
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  for (const asset of zipAssets) {
    const destPath = path.join(PUBLIC_DIR, asset.name);
    console.log(`Downloading: ${asset.name}...`);

    const assetRes = await fetch(asset.browser_download_url, {
      headers: getHeaders(),
    });
    if (!assetRes.ok) {
      console.error(`Failed to download ${asset.name}: ${assetRes.statusText}`);
      process.exitCode = 1;
      continue;
    }

    const fileStream = fs.createWriteStream(destPath);
    await pipeline(assetRes.body, fileStream);
    console.log(`Successfully downloaded to: ${destPath}`);

    console.log(`Extracting ${asset.name} to public/...`);
    try {
      if (process.platform === 'win32') {
        execSync(
          `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${destPath.replace(/'/g, "''")}' -DestinationPath '${PUBLIC_DIR.replace(/'/g, "''")}' -Force"`,
          { stdio: 'inherit' }
        );
      } else {
        execSync(`unzip -o "${destPath}" -d "${PUBLIC_DIR}"`, { stdio: 'inherit' });
      }

      fs.unlinkSync(destPath);
      console.log(`Extraction complete & zip file cleaned up for: ${asset.name}`);
    } catch (err) {
      console.error(`Failed to extract ${asset.name}:`, err.message);
      process.exitCode = 1;
    }
  }

  if (!process.exitCode) {
    console.log(`All assets for tag ${TAG} successfully downloaded and extracted to ${TARGET_ASSETS_DIR}!`);
  }
}

main().catch((err) => {
  console.error('An error occurred:', err);
  process.exitCode = 1;
});