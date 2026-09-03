#!/usr/bin/env npx tsx

/**
 * Build a 128px white-circle icon badge for an app, searching several icon
 * directories for the best available mark, and file it under the right
 * category in ../icons automatically.
 *
 * Search order:
 *   1. Manual picks (local-glyphs.ts) - Phosphor "fill" pictograms for
 *      standard KDE apps, and Iconify ids hand-chosen where the automatic
 *      search below found nothing recognizable. Each manual pick carries its
 *      own category directly, since it's a deliberate curation choice.
 *   2. Simple Icons (brand logos, already black).
 *   3. Tabler Icons "brand-*" outlines (covers brands Simple Icons has
 *      dropped at the trademark holder's request, e.g. Microsoft Edge).
 *   4. Iconify's search API - aggregates hundreds of icon sets, so this
 *      catches most brand marks the first three miss.
 *   5. Tabler Icons generic outlines (fallback pictogram by concept name).
 *
 * For anything found automatically (2-5), the category is never guessed
 * from the slug: it's classified by combining whatever tags the source
 * shipped with Flathub's structured app-menu categories (every real Linux
 * desktop app declares these; see flathub.ts) for what the app actually is,
 * then matching that against the tag vocabulary in categories.json (see
 * categorize.ts). A Wikipedia-description version of this was tried and
 * dropped: most apps (ChatGPT, Ollama, indie tools) have no Wikipedia
 * article at all, and the ones that do mix in enough biographical noise
 * (founder names, dates) to cause real misclassifications over time.
 *
 * Usage:
 *   npx tsx simple-icon-badge.ts chatgpt
 *   npx tsx simple-icon-badge.ts chatgpt custom-badge.svg
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { categorize } from "./categorize.js";
import { CATEGORY_OVERRIDES, GENERIC_ICON_MAP, ICONIFY_OVERRIDES } from "./local-glyphs.js";
import { describeApp } from "./flathub.js";

const SIMPLE_ICONS_CDN = "https://cdn.simpleicons.org";
const TABLER_ICONS_BASE = "https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline";
const ICONIFY_API = "https://api.iconify.design";
const BADGE_SIZE = 128;
const ICON_SIZE = 54;

// Query aliases: when a slug doesn't hit directly, also try these forms.
const ALIASES: Record<string, string[]> = {
  edge: ["microsoftedge", "edge"],
  msedge: ["microsoftedge", "edge"],
  microsoftedge: ["microsoftedge", "edge"],
  outlook: ["microsoftoutlook", "outlook"],
  zed: ["zedindustries", "zed", "zed editor"],
  // Apple uses one "iCloud" cloud mark for all iCloud services - there's no
  // separate Mail-specific logo.
  icloudmail: ["icloud", "icloudmail"],
};

function usage(): never {
  console.error("Usage: simple-icon-badge <slug> [output.svg]");
  process.exit(1);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

async function tryFetch(url: string): Promise<string | null> {
  const response = await fetch(url, { headers: { Accept: "image/svg+xml,text/plain" } });
  if (!response.ok) return null;
  const text = await response.text();
  return text.includes("<svg") ? text : null;
}

/** Like tryFetch, but for a plain JSON endpoint (no `<svg>` to require). */
async function tryFetchJson(url: string): Promise<string | null> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  return response.text();
}

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  purple: "#800080",
  teal: "#008080",
  navy: "#000080",
  orange: "#ffa500",
  pink: "#ffc0cb",
};

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

function parseColor(str: string): ParsedColor | null {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (s === "none" || s === "transparent" || s === "inherit" || s === "initial" || s === "unset") {
    return null;
  }
  if (s === "currentcolor") {
    return { r: 0, g: 0, b: 0 };
  }
  const hex = NAMED_COLORS[s] ?? s;
  if (hex.startsWith("#")) {
    const h = hex.slice(1);
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
      };
    }
    if (h.length === 4) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a: parseInt(h[3] + h[3], 16) / 255,
      };
    }
    if (h.length === 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }
    if (h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    }
  }
  const rgbMatch = s.match(/^rgba?\s*\(\s*(\d+%?)\s*,\s*(\d+%?)\s*,\s*(\d+%?)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    const parseComponent = (c: string) => (c.endsWith("%") ? Math.round(parseFloat(c) * 2.55) : parseInt(c, 10));
    return {
      r: parseComponent(rgbMatch[1]),
      g: parseComponent(rgbMatch[2]),
      b: parseComponent(rgbMatch[3]),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : undefined,
    };
  }
  return null;
}

function getLuminance(c: ParsedColor): number {
  return Math.round(0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
}

function toHex2(val: number): string {
  const v = Math.max(0, Math.min(255, Math.round(val)));
  return v.toString(16).padStart(2, "0");
}

function convertColorToMono(colorStr: string, lMin: number, lMax: number): string {
  const c = parseColor(colorStr);
  if (!c) return colorStr;
  let L = getLuminance(c);
  if (lMin > 128) {
    if (lMax > lMin) {
      L = Math.round(((L - lMin) / (lMax - lMin)) * 180);
    } else {
      L = 0;
    }
  }
  const hex = `#${toHex2(L)}${toHex2(L)}${toHex2(L)}`;
  if (c.a !== undefined && c.a < 1) {
    const alphaHex = toHex2(c.a * 255);
    return `${hex}${alphaHex}`;
  }
  return hex;
}

/** Convert an SVG icon to monochrome while ensuring it remains visible on the white badge circle. */
export function monochromize(svg: string): string {
  const colorAttrRegex = /(?:fill|stroke|stop-color|color)\s*=\s*["']([^"']+)["']/gi;
  const styleAttrRegex = /style\s*=\s*["']([^"']+)["']/gi;
  const stylePropRegex = /(?:fill|stroke|stop-color|color)\s*:\s*([^;"]+)/gi;

  const foundColors: ParsedColor[] = [];

  let match: RegExpExecArray | null;
  colorAttrRegex.lastIndex = 0;
  while ((match = colorAttrRegex.exec(svg)) !== null) {
    const parsed = parseColor(match[1]);
    if (parsed) foundColors.push(parsed);
  }

  styleAttrRegex.lastIndex = 0;
  while ((match = styleAttrRegex.exec(svg)) !== null) {
    const styleContent = match[1];
    stylePropRegex.lastIndex = 0;
    let propMatch: RegExpExecArray | null;
    while ((propMatch = stylePropRegex.exec(styleContent)) !== null) {
      const parsed = parseColor(propMatch[1]);
      if (parsed) foundColors.push(parsed);
    }
  }

  let lMin = 255;
  let lMax = 0;
  if (foundColors.length > 0) {
    for (const c of foundColors) {
      const L = getLuminance(c);
      if (L < lMin) lMin = L;
      if (L > lMax) lMax = L;
    }
  } else {
    lMin = 0;
    lMax = 0;
  }

  let result = svg.replace(/(fill|stroke|stop-color|color)\s*=\s*["']([^"']+)["']/gi, (full, attr, val: string) => {
    if (val.trim().toLowerCase() === "none") return full;
    const mono = convertColorToMono(val, lMin, lMax);
    return `${attr}="${mono}"`;
  });

  result = result.replace(/currentColor/g, convertColorToMono("currentColor", lMin, lMax));

  result = result.replace(/style\s*=\s*["']([^"']+)["']/gi, (full, styleContent: string) => {
    const newStyle = styleContent.replace(/(fill|stroke|stop-color|color)\s*:\s*([^;"]+)/gi, (propFull, prop, val: string) => {
      if (val.trim().toLowerCase() === "none") return propFull;
      const mono = convertColorToMono(val, lMin, lMax);
      return `${prop}:${mono}`;
    });
    return `style="${newStyle}"`;
  });

  return result;
}

/** Force every mark to solid black regardless of its source's own styling. */
function blacken(svg: string): string {
  return svg
    .replace(/currentColor/g, "#000000")
    .replace(/fill="(?!none)[^"]*"/g, 'fill="#000000"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="#000000"');
}

/** Pull a Tabler Icons file's `tags: [...]` header, if present. */
function extractTablerTags(svg: string): string[] {
  const match = svg.match(/tags:\s*\[([^\]]*)\]/i);
  if (!match) return [];
  return match[1].split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

interface Found {
  svg: string;
  source: string;
  tags: string[];
}

async function searchDirectories(slug: string): Promise<Found | null> {
  const queries = [slug, ...(ALIASES[slug] ?? [])];

  for (const query of queries) {
    const svg = await tryFetch(`${SIMPLE_ICONS_CDN}/${encodeURIComponent(query)}/000000`);
    if (svg) return { svg, source: "Simple Icons", tags: [] };
  }

  for (const query of queries) {
    const svg = await tryFetch(`${TABLER_ICONS_BASE}/brand-${encodeURIComponent(query)}.svg`);
    if (svg) return { svg: blacken(svg), source: "Tabler Icons (brand)", tags: extractTablerTags(svg) };
  }

  for (const query of queries) {
    const results = await tryFetchJson(`${ICONIFY_API}/search?query=${encodeURIComponent(query)}&limit=5`);
    if (!results) continue;
    const parsed = JSON.parse(results) as { icons?: string[] };
    // Phosphor ("ph:") is reserved for the manual KDE generic-icon picks in
    // local-glyphs.ts - it must never surface as an automatic brand match.
    const iconId = parsed.icons?.find((id) => !id.startsWith("ph:"));
    if (!iconId) continue;
    const svg = await tryFetch(`${ICONIFY_API}/${iconId.replace(":", "/")}.svg`);
    if (svg) return { svg: monochromize(svg), source: `Iconify (${iconId})`, tags: [] };
  }

  for (const query of queries) {
    const svg = await tryFetch(`${TABLER_ICONS_BASE}/${encodeURIComponent(query)}.svg`);
    if (svg) return { svg: blacken(svg), source: "Tabler Icons (generic)", tags: extractTablerTags(svg) };
  }

  return null;
}

function makeBadge(iconSvg: string, label: string): string {
  const encodedIcon = Buffer.from(iconSvg).toString("base64");
  const offset = (BADGE_SIZE - ICON_SIZE) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_SIZE}" height="${BADGE_SIZE}" viewBox="0 0 ${BADGE_SIZE} ${BADGE_SIZE}" role="img" aria-label="${escapeXml(label)} icon">
  <circle cx="64" cy="64" r="64" fill="#ffffff"/>
  <image x="${offset}" y="${offset}" width="${ICON_SIZE}" height="${ICON_SIZE}" href="data:image/svg+xml;base64,${encodedIcon}"/>
</svg>
`;
}

async function isWritableDir(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveDestination(
  outputPath: string | undefined,
  generatorDirectory: string,
  category: string,
  slug: string,
): Promise<string> {
  if (outputPath) {
    return resolve(outputPath);
  }

  if (process.env.SANE_ICONS_DIR) {
    return resolve(process.env.SANE_ICONS_DIR, category, `${slug}.svg`);
  }

  const localRepoIconsDir = resolve(generatorDirectory, "..", "icons");
  if (await isWritableDir(localRepoIconsDir)) {
    return resolve(localRepoIconsDir, category, `${slug}.svg`);
  }

  const userIconDir = process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "icons", "Sane", "128x128", "apps")
    : join(homedir(), ".local", "share", "icons", "Sane", "128x128", "apps");

  return resolve(userIconDir, `${slug}.svg`);
}

async function main(): Promise<void> {
  const [slugArg, outputPath] = process.argv.slice(2);
  if (!slugArg) usage();
  const slug = slugArg.toLowerCase();

  let badge: string;
  let category: string;

  const manualPick = ICONIFY_OVERRIDES[slug] ?? GENERIC_ICON_MAP[slug];
  if (manualPick) {
    const svg = await tryFetch(`${ICONIFY_API}/${manualPick.icon.replace(":", "/")}.svg`);
    if (!svg) throw new Error(`Iconify icon "${manualPick.icon}" for "${slug}" failed to fetch.`);
    badge = makeBadge(monochromize(svg), slug);
    category = manualPick.category;
    console.log(`Using Iconify "${manualPick.icon}" for "${slug}" -> category "${category}" (manual pick).`);
  } else {
    const found = await searchDirectories(slug);
    if (!found) {
      throw new Error(
        `No icon found for "${slug}" in Simple Icons, Tabler Icons, or Iconify.`,
      );
    }
    badge = makeBadge(found.svg, slug);
    // Classify from what the thing actually is, not from its slug: Flathub's
    // structured app-menu categories. Products that aren't Linux desktop
    // apps at all (a web/CLI-only tool) have no Flathub entry and fall
    // through to "uncategorized" rather than a guess - see local-glyphs.ts
    // for adding a manual pick with an explicit category instead.
    if (CATEGORY_OVERRIDES[slug]) {
      category = CATEGORY_OVERRIDES[slug];
      console.log(`Using ${found.source} for "${slug}" -> category "${category}" (category override).`);
    } else {
      const flathubTags = await describeApp(slug);
      category = await categorize([...found.tags, ...flathubTags]);
      console.log(`Using ${found.source} for "${slug}" -> category "${category}".`);
    }
  }

  const generatorDirectory = dirname(fileURLToPath(import.meta.url));
  const destination = await resolveDestination(outputPath, generatorDirectory, category, slug);

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, badge, "utf8");
  console.log(`Created ${destination}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
