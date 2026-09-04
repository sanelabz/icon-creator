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
const userUnitDest = join(destDir, 'usr/lib/systemd/user');
const userPresetDest = join(destDir, 'usr/lib/systemd/user-preset');
const autostartDest = join(destDir, 'etc/xdg/autostart');

// KDE resolves the name in a desktop entry's Icon= field literally.  The
// aliases below normalize names to lowercase and accommodate harmless
// packaging differences in the choice of '-', '_' or '.'. They never guess
// at shortened names, reordered words, or edit-distance matches; those
// broader matches could easily style the wrong application.
function safeNameVariants(appId) {
  const normalized = appId.toLowerCase();
  const separatorRun = /[-_.]+/g;
  return new Set([
    normalized,
    normalized.replace(separatorRun, '-'),
    normalized.replace(separatorRun, '_'),
    normalized.replace(separatorRun, '.'),
  ]);
}

function addLink(appsDir, scalableDir, appId, targetSlug) {
  const targetFile = `${targetSlug}.svg`;
  const appIdFile = `${appId}.svg`;
  if (appIdFile === targetFile || !existsSync(join(appsDir, targetFile))) return;
  try {
    symlinkSync(targetFile, join(appsDir, appIdFile));
  } catch {}
  try {
    symlinkSync(`../../128x128/apps/${targetFile}`, join(scalableDir, appIdFile));
  } catch {}
}

mkdirSync(apps128, { recursive: true });
mkdirSync(scalableApps, { recursive: true });
mkdirSync(cats128, { recursive: true });
mkdirSync(join(saneIconsDest, 'icons'), { recursive: true });
mkdirSync(join(saneIconsDest, 'generator'), { recursive: true });
mkdirSync(binDest, { recursive: true });
mkdirSync(userUnitDest, { recursive: true });
mkdirSync(userPresetDest, { recursive: true });
mkdirSync(autostartDest, { recursive: true });

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
      symlinkSync(`../../128x128/apps/${file}`, join(scalableApps, file));
    } catch {}
  }
}

// Mappings & Symlinks
const mappingsPath = join(rootDir, 'mappings.json');
if (existsSync(mappingsPath)) {
  cpSync(mappingsPath, join(saneIconsDest, 'mappings.json'));
  cpSync(mappingsPath, join(themeDest, 'mappings.json'));
  const mappings = JSON.parse(readFileSync(mappingsPath, 'utf8'));

  // Explicit entries always win.  Derived aliases are used only when every
  // matching explicit name resolves to the same icon; an ambiguous variant is
  // deliberately omitted rather than assigning an arbitrary icon.
  const explicitMappings = new Map(Object.entries(mappings));
  const derivedAliases = new Map();
  for (const [appId, targetSlug] of Object.entries(mappings)) {
    addLink(apps128, scalableApps, appId, targetSlug);
    for (const alias of safeNameVariants(appId)) {
      if (alias === appId || explicitMappings.has(alias)) continue;
      const existing = derivedAliases.get(alias);
      if (existing === undefined) {
        derivedAliases.set(alias, targetSlug);
      } else if (existing !== targetSlug) {
        derivedAliases.set(alias, null);
      }
    }
  }
  for (const [alias, targetSlug] of derivedAliases) {
    if (targetSlug) addLink(apps128, scalableApps, alias, targetSlug);
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
cpSync(join(rootDir, 'icon-badge-svg/package.json'), join(saneIconsDest, 'generator/package.json'));

// CLI Binaries
cpSync(join(rootDir, 'bin/sane-icon-badge'), join(binDest, 'sane-icon-badge'));
cpSync(join(rootDir, 'bin/sane-icon-sync'), join(binDest, 'sane-icon-sync'));
try {
  symlinkSync('sane-icon-badge', join(binDest, 'sane-icon-generator'));
} catch {}

// Automatically activate the user-level watcher through the packaged preset.
for (const unit of ['sane-icon-sync.service', 'sane-icon-sync.path', 'sane-icon-sync.timer']) {
  cpSync(join(rootDir, 'systemd/user', unit), join(userUnitDest, unit));
}
cpSync(
  join(rootDir, 'systemd/user-preset/90-sane-icons.preset'),
  join(userPresetDest, '90-sane-icons.preset'),
);
// KDE starts this once at login. It makes the theme whole even for users whose
// systemd user manager predates this package installation.
cpSync(
  join(rootDir, 'autostart/sane-icon-sync.desktop'),
  join(autostartDest, 'sane-icon-sync.desktop'),
);

console.log('Installation complete to:', destDir);
