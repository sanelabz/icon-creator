/**
 * Flathub indexes almost every real Linux desktop app and requires each one
 * to declare freedesktop.org's standard menu categories (WebBrowser, Audio,
 * Office, TerminalEmulator, ...) - structured, purpose-built metadata, not
 * scraped prose. This is the primary classification signal: it covers every
 * browser, KDE app, and desktop music/office app in this set with an exact
 * answer instead of a guess. It only comes up empty for things that aren't
 * Linux desktop apps at all (ChatGPT, Claude, Ollama), where wikipedia.ts is
 * used as a fallback instead.
 */
function splitCategoryWords(category: string): string[] {
  // "WebBrowser" -> "web browser", "AudioVideo" -> "audio video"
  return category
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export async function describeApp(name: string): Promise<string[]> {
  const response = await fetch("https://flathub.org/api/v2/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: name }),
  });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    hits?: Array<{ main_categories?: string; sub_categories?: string[] }>;
  };
  const hit = data.hits?.[0];
  if (!hit) return [];

  const categories = [hit.main_categories, ...(hit.sub_categories ?? [])].filter(
    (c): c is string => Boolean(c),
  );
  return categories.flatMap(splitCategoryWords);
}
