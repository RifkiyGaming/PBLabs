import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execSync } from 'node:child_process';

const REPO = 'fitri-hy/PBLabs';

// Parse command-line arguments
const args = process.argv.slice(2);
let TAG = '0.0.1'; // Default tag if not specified

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--tag' && args[i + 1]) {
    TAG = args[i + 1];
    i++;
  } else if (arg.startsWith('--') && arg !== '--assets') {
    const potentialTag = arg.replace(/^--/, '');
    if (/^\d+\.\d+/.test(potentialTag)) {
      TAG = potentialTag;
    }
  }
}

const PUBLIC_DIR = path.resolve('public');
const TARGET_ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

async function main() {
  console.log(`Checking release for ${REPO} (Tag: ${TAG})...`);
  
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`, {
    headers: { 'User-Agent': 'pblabs-assets-download' }
  });

  if (!response.ok) {
    console.error(`Failed to fetch release data for tag ${TAG}: ${response.statusText} (${response.status})`);
    process.exit(1);
  }

  const release = await response.json();
  const assets = release.assets || [];

  const zipAssets = assets.filter(asset => asset.name.endsWith('.zip'));

  if (zipAssets.length === 0) {
    console.log(`No .zip files found in release tag ${TAG}.`);
    return;
  }

  // Ensure public/ directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  for (const asset of zipAssets) {
    const destPath = path.join(PUBLIC_DIR, asset.name);
    console.log(`Downloading: ${asset.name}...`);

    const assetRes = await fetch(asset.browser_download_url);
    if (!assetRes.ok) {
      console.error(`Failed to download ${asset.name}: ${assetRes.statusText}`);
      continue;
    }

    const fileStream = fs.createWriteStream(destPath);
    await pipeline(assetRes.body, fileStream);
    console.log(`Successfully downloaded to: ${destPath}`);

    console.log(`Extracting ${asset.name} to public/...`);
    try {
      if (process.platform === 'win32') {
        // Extract to public/ so the 'assets' folder inside the zip extracts correctly to public/assets
        execSync(`powershell -Command "Expand-Archive -Path '${destPath}' -DestinationPath '${PUBLIC_DIR}' -Force"`, { stdio: 'inherit' });
      } else {
        execSync(`unzip -o "${destPath}" -d "${PUBLIC_DIR}"`, { stdio: 'inherit' });
      }

      // Delete the .zip file after extraction is complete
      fs.unlinkSync(destPath);
      console.log(`Extraction complete & zip file cleaned up for: ${asset.name}`);
    } catch (err) {
      console.error(`Failed to extract ${asset.name}:`, err.message);
    }
  }

  console.log(`All assets for tag ${TAG} successfully downloaded and extracted to ${TARGET_ASSETS_DIR}!`);
}

main().catch(err => {
  console.error('An error occurred:', err);
  process.exit(1);
});