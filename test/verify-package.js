#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, rmSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

console.log('=== Running sane-icons Verification Tests ===');

const rootDir = resolve(import.meta.dirname, '..');

// Test 1: Check mappings.json
console.log('\n1. Verifying mappings.json...');
const mappingsPath = join(rootDir, 'mappings.json');
if (!existsSync(mappingsPath)) {
  throw new Error('mappings.json missing!');
}
const mappings = JSON.parse(readFileSync(mappingsPath, 'utf8'));
console.log(`- Mappings count: ${Object.keys(mappings).length}`);

// Get all preset icon slugs in icons/
const presetSlugs = new Set();
const categoriesDir = join(rootDir, 'icons');
for (const cat of readdirSync(categoriesDir, { withFileTypes: true })) {
  if (cat.isDirectory()) {
    for (const file of readdirSync(join(categoriesDir, cat.name))) {
      if (file.endsWith('.svg')) {
        presetSlugs.add(file.replace('.svg', ''));
      }
    }
  }
}

for (const [appId, targetSlug] of Object.entries(mappings)) {
  if (!presetSlugs.has(targetSlug)) {
    console.warn(`- Warning: Mapped target "${targetSlug}" for app "${appId}" not found in preset icons.`);
  }
}
console.log('✔ mappings.json valid.');

// Test 2: Build Generator
console.log('\n2. Building icon-badge-svg...');
execSync('npm run build', { cwd: join(rootDir, 'icon-badge-svg'), stdio: 'inherit' });
if (!existsSync(join(rootDir, 'icon-badge-svg/dist/simple-icon-badge.js'))) {
  throw new Error('Dist compilation failed!');
}
console.log('✔ Generator build succeeded.');

// Test 2b: Verify monochromize function
console.log('\n2b. Testing monochromize function...');
const { monochromize } = await import(join(rootDir, 'icon-badge-svg/dist/simple-icon-badge.js'));

// Test white SVG inversion
const whiteSvg = '<svg><path fill="#ffffff" d="M0 0h10v10H0z"/></svg>';
const monoWhite = monochromize(whiteSvg);
if (!monoWhite.includes('fill="#000000"')) {
  throw new Error(`monochromize failed to make white SVG visible on white circle: ${monoWhite}`);
}

// Test multi-color SVG grayscale preservation
const multiColorSvg = '<svg><path fill="#607D8B" d="A"/><path fill="#455A64" d="B"/></svg>';
const monoMulti = monochromize(multiColorSvg);
if (!monoMulti.includes('fill="#767676"') || !monoMulti.includes('fill="#555555"')) {
  throw new Error(`monochromize failed to convert multi-color SVG to distinct grays: ${monoMulti}`);
}

// Test composite SVG (black circle with white star) preservation
const compositeSvg = '<svg><circle fill="#000000" r="10"/><path fill="#ffffff" d="M0 0h5v5H0z"/></svg>';
const monoComposite = monochromize(compositeSvg);
if (!monoComposite.includes('fill="#000000"') || !monoComposite.includes('fill="#ffffff"')) {
  throw new Error(`monochromize failed to preserve dark container and white cutout in composite SVG: ${monoComposite}`);
}

// Test currentColor conversion
const currentColorSvg = '<svg><path fill="currentColor" d="C"/></svg>';
const monoCurrentColor = monochromize(currentColorSvg);
if (!monoCurrentColor.includes('fill="#000000"')) {
  throw new Error(`monochromize failed to convert currentColor: ${monoCurrentColor}`);
}

console.log('✔ monochromize logic verified.');

// Test 3: Local badge generation
console.log('\n3. Testing local badge generation...');
execSync('npm run badge -- firefox', { cwd: join(rootDir, 'icon-badge-svg'), stdio: 'inherit' });
if (!existsSync(join(rootDir, 'icons/browsers/firefox.svg'))) {
  throw new Error('Local badge generation failed to create icons/browsers/firefox.svg');
}
console.log('✔ Local generator working.');

// Test 4: Mock Installation
console.log('\n4. Testing mock installation...');
const mockSysroot = join(rootDir, '.mock-sysroot');
rmSync(mockSysroot, { recursive: true, force: true });
execSync(`node scripts/install-theme.js ${mockSysroot}`, { stdio: 'inherit' });

const requiredPaths = [
  'usr/share/icons/Sane/index.theme',
  'usr/share/icons/Sane/128x128/apps/firefox.svg',
  'usr/share/icons/Sane/128x128/apps/org.mozilla.firefox.svg',
  'usr/share/icons/Sane/mappings.json',
  'usr/share/sane-icons/mappings.json',
  'usr/share/sane-icons/generator/simple-icon-badge.js',
  'usr/bin/sane-icon-badge',
  'usr/bin/sane-icon-generator',
];

for (const relPath of requiredPaths) {
  const fullPath = join(mockSysroot, relPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Mock install missing required path: ${relPath}`);
  }
}
console.log('✔ Mock installation verified.');

// Test 5: Test installed binary in simulated system environment
console.log('\n5. Testing installed binary in simulated system mode...');
const testOutFile = '/tmp/test-system-mode.svg';
rmSync(testOutFile, { force: true });
execSync(`${join(mockSysroot, 'usr/bin/sane-icon-badge')} firefox ${testOutFile}`, { stdio: 'inherit' });
if (!existsSync(testOutFile)) {
  throw new Error('Installed binary failed to output icon!');
}
rmSync(testOutFile, { force: true });
console.log('✔ Installed binary executed successfully.');

// Test 6: Verify Spec file
console.log('\n6. Checking sane-icons.spec file...');
const specContent = readFileSync(join(rootDir, 'sane-icons.spec'), 'utf8');
if (!specContent.includes('Name:           sane-icons') || !specContent.includes('install-theme.js')) {
  throw new Error('sane-icons.spec missing essential content.');
}
console.log('✔ sane-icons.spec verified.');

// Clean up mock sysroot
rmSync(mockSysroot, { recursive: true, force: true });

console.log('\n=== All sane-icons Verification Tests Passed! ===');
