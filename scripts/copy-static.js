// Copy custom static assets from /public into the Expo web export (/dist)
// Ensures service workers and fonts are available in Vercel deployments.

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

async function copyRecursive(src, dest) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  await fs.promises.mkdir(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

// Serve the hand-written marketing landing at the site root (/) while keeping
// the Expo SPA reachable. The Expo export writes its SPA shell to
// dist/index.html; we move that shell to dist/app-shell.html and put the
// marketing HTML at dist/index.html. vercel.json's catch-all rewrites all
// non-asset app routes to /app-shell.html so the SPA still boots everywhere
// except the root.
const MARKETING_LANDING = 'betterat-landing-breadth.html';

async function promoteMarketingLanding() {
  const landingSrc = path.join(publicDir, MARKETING_LANDING);
  const spaShell = path.join(distDir, 'index.html');
  const spaShellRenamed = path.join(distDir, 'app-shell.html');

  if (!fs.existsSync(landingSrc)) {
    console.warn(`[copy-static] ${MARKETING_LANDING} not found in public/, leaving SPA at root.`);
    return;
  }
  if (!fs.existsSync(spaShell)) {
    console.warn('[copy-static] dist/index.html (SPA shell) not found, skipping landing promotion.');
    return;
  }

  await fs.promises.rename(spaShell, spaShellRenamed);
  await fs.promises.copyFile(landingSrc, spaShell);
  console.log('[copy-static] Promoted marketing landing to dist/index.html (SPA shell -> app-shell.html)');
}

async function main() {
  try {
    // Copy public/ assets to dist/
    if (fs.existsSync(publicDir) && fs.existsSync(distDir)) {
      await copyRecursive(publicDir, distDir);
      console.log('[copy-static] Copied public/ into dist/');
      await promoteMarketingLanding();
    } else if (!fs.existsSync(publicDir)) {
      console.warn('[copy-static] public/ directory not found, skipping copy.');
    } else {
      console.warn('[copy-static] dist/ directory not found, skipping copy.');
    }
  } catch (error) {
    console.error('[copy-static] Failed to process static assets:', error);
    process.exit(1);
  }
}

main();
