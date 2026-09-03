#!/usr/bin/env node
import { cpSync, mkdirSync, readFileSync, readdirSync, symlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const destDir = process.argv[2];
if (!destDir) {
  console.error("Usage: install-theme.js <destroot>");
  process.exit(1);
}

const rootDir = resolve(import.meta.dirname, '..');
const iconsDir = join(rootDir, 'icons');
const themeDest = join(destDir, 'usr/share/icons/Sane');
const apps128 = join(themeDest, '128x128/apps');
const scalableApps = join(themeDest, 'scalable/apps');
const cats128 = join(themeDest, '128x128/categories');
const saneIconsDest = join(destDir, 'usr/share/sane-icons');
const binDest = join(destDir, 'usr/bin');

mkdirSync(apps128, { recursive: true });
mkdirSync(scalableApps, { recursive: true });
mkdirSync(cats128, { recursive: true });
mkdirSync(join(saneIconsDest, 'icons'), { recursive: true });
mkdirSync(join(saneIconsDest, 'generator'), { recursive: true });
mkdirSync(binDest, { recursive: true });

// Copy index.theme
cpSync(join(rootDir, 'index.theme'), join(themeDest, 'index.theme'));

// Copy preset icons
const categories = readdirSync(iconsDir, { withFileTypes: true }).filter(d => d.isDirectory());
for (const cat of categories) {
  const catDir = join(iconsDir, cat.name);
  cpSync(catDir, join(saneIconsDest, 'icons', cat.name), { recursive: true });
  const files = readdirSync(catDir).filter(f => f.endsWith('.svg'));
  for (const file of files) {
    const src = join(catDir, file);
    cpSync(src, join(apps128, file));
    try {
      symlinkSync(`../128x128/apps/${file}`, join(scalableApps, file));
    } catch {}
  }
}

// Mappings & Symlinks
const mappingsPath = join(rootDir, 'mappings.json');
if (existsSync(mappingsPath)) {
  cpSync(mappingsPath, join(saneIconsDest, 'mappings.json'));
  cpSync(mappingsPath, join(themeDest, 'mappings.json'));
  const mappings = JSON.parse(readFileSync(mappingsPath, 'utf8'));
  for (const [appId, targetSlug] of Object.entries(mappings)) {
    const targetFile = `${targetSlug}.svg`;
    const appIdFile = `${appId}.svg`;
    if (appIdFile !== targetFile && existsSync(join(apps128, targetFile))) {
      try {
        symlinkSync(targetFile, join(apps128, appIdFile));
      } catch {}
      try {
        symlinkSync(`../128x128/apps/${targetFile}`, join(scalableApps, appIdFile));
      } catch {}
    }
  }
}

// Icon theme alias symlinks
try {
  symlinkSync('Sane', join(destDir, 'usr/share/icons/sane-icons'));
  symlinkSync('Sane', join(destDir, 'usr/share/icons/sane'));
} catch {}

// Generator
const distDir = join(rootDir, 'icon-badge-svg/dist');
if (existsSync(distDir)) {
  cpSync(distDir, join(saneIconsDest, 'generator'), { recursive: true });
}
const nodeModulesDir = join(rootDir, 'icon-badge-svg/node_modules');
if (existsSync(nodeModulesDir)) {
  cpSync(nodeModulesDir, join(saneIconsDest, 'generator/node_modules'), { recursive: true });
}
cpSync(join(rootDir, 'icon-badge-svg/package.json'), join(saneIconsDest, 'generator/package.json'));

// CLI Binaries
cpSync(join(rootDir, 'bin/sane-icon-badge'), join(binDest, 'sane-icon-badge'));
try {
  symlinkSync('sane-icon-badge', join(binDest, 'sane-icon-generator'));
} catch {}

console.log('Installation complete to:', destDir);
