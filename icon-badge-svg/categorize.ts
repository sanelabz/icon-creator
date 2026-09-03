import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const MANIFEST_PATH = resolve(import.meta.dirname, "categories.json");

type Manifest = Record<string, { tags: string[] }>;

// "kde" only ever gets an icon via the manual GENERIC_ICON_MAP curation in
// local-glyphs.ts (Fedora KDE's own bundled apps) - it must never win the
// automatic classification below, or an unrelated Linux-adjacent app could
// get filed as a KDE app and mislabeled as belonging to the desktop itself.
const AUTO_CLASSIFY_EXCLUDED = new Set(["kde"]);

async function loadManifest(): Promise<Manifest> {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as Manifest;
}

async function saveManifest(manifest: Manifest): Promise<void> {
  try {
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  } catch {
    // Gracefully ignore write failures when running from read-only system paths
  }
}

function normalize(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Resolve a category purely from descriptive words about the icon - never
 * from the app's own slug or name. `tags` should come from real data about
 * what the thing is (a source directory's own metadata, a Wikipedia
 * description, etc.), gathered by the caller. The category whose tag
 * vocabulary overlaps most wins; the matched words are folded back into that
 * category so categories.json keeps describing itself from evidence, not
 * from a table of known app names. No overlap -> "uncategorized".
 */
export async function categorize(tags: string[]): Promise<string> {
  const manifest = await loadManifest();
  const normalizedTags = new Set(tags.map(normalize));
  if (normalizedTags.size === 0) return "uncategorized";

  let bestCategory: string | null = null;
  let bestScore = 0;
  let tied = false;

  for (const [category, entry] of Object.entries(manifest)) {
    if (AUTO_CLASSIFY_EXCLUDED.has(category)) continue;
    const vocab = new Set(entry.tags.map(normalize));
    const score = [...normalizedTags].filter((t) => vocab.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
      tied = false;
    } else if (score > 0 && score === bestScore) {
      // Two categories matching equally hard is a coin flip, not a signal -
      // e.g. "web" alone matching both "browsers" and "development" said
      // nothing real about either. Insertion order deciding a tie caused a
      // genuine misclassification (Postman -> browsers) that then polluted
      // that category's vocabulary, so an unresolved tie goes unclassified.
      tied = true;
    }
  }

  if (!bestCategory || tied) return "uncategorized";

  // Only adopt a new word if no *other* category already claims it. A word
  // like "web" is real signal for browsers on its own, but folding it in
  // indiscriminately is how it also ended up in "development" (from a
  // WebDevelopment category split) and then caused an unrelated app to tie
  // between the two - a shared word is exactly the case self-expansion must
  // not learn from.
  const entry = manifest[bestCategory];
  const claimedElsewhere = new Set(
    Object.entries(manifest)
      .filter(([category]) => category !== bestCategory)
      .flatMap(([, other]) => other.tags.map(normalize)),
  );
  for (const tag of normalizedTags) {
    if (claimedElsewhere.has(tag)) continue;
    if (!entry.tags.some((t) => normalize(t) === tag)) entry.tags.push(tag);
  }
  await saveManifest(manifest);
  return bestCategory;
}
