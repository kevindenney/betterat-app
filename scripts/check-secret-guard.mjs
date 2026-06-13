#!/usr/bin/env node

import { execSync } from 'node:child_process';

const blockedPathPatterns = [
  /^credentials\.json$/,
  /^credentials\/ios\/.+\.(p12|mobileprovision)$/,
  /(^|\/).+\.p12$/,
  /(^|\/).+\.mobileprovision$/,
  /(^|\/).+\.jks$/,
  /^google-play-service-account\.json$/,
];

const blockedContentPatterns = [
  {
    name: 'EAS local iOS distribution certificate password',
    grep: '"distributionCertificate"',
    regex: /"distributionCertificate"\s*:\s*\{[\s\S]*?"password"\s*:/,
  },
];

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

const trackedFiles = run('git ls-files');
const stagedFiles = run('git diff --cached --name-only --diff-filter=ACMR');
const filesToCheck = unique([...trackedFiles, ...stagedFiles]);

const blockedPaths = filesToCheck.filter((file) =>
  blockedPathPatterns.some((pattern) => pattern.test(file)),
);

const candidateContentFiles = new Set();
for (const pattern of blockedContentPatterns) {
  try {
    for (const line of run(`git grep -l ${JSON.stringify(pattern.grep)} -- .`)) {
      candidateContentFiles.add(line);
    }
  } catch {
    // git grep exits non-zero when there are no matches.
  }
}

const blockedContent = [];
for (const file of candidateContentFiles) {
  if (file === 'scripts/check-secret-guard.mjs') continue;
  const content = execSync(`git show HEAD:${JSON.stringify(file)}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 5 * 1024 * 1024,
  });

  for (const pattern of blockedContentPatterns) {
    if (pattern.regex.test(content)) {
      blockedContent.push(`${file}: ${pattern.name}`);
    }
  }
}

if (blockedPaths.length || blockedContent.length) {
  console.error('[check-secret-guard] Refusing to proceed; signing credentials or secrets are tracked/staged.');
  for (const file of blockedPaths) {
    console.error(`- blocked path: ${file}`);
  }
  for (const finding of blockedContent) {
    console.error(`- blocked content: ${finding}`);
  }
  process.exit(1);
}

console.log('[check-secret-guard] PASS');
