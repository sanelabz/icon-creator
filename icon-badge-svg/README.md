# Icon Badge Generator

Given an app's slug, finds the best available icon and renders it as a flat
black glyph centered in a white 128px circular SVG badge, then files the
result into the right category under `../icons/` automatically.

```sh
npm install
npm run badge -- firefox
```

This creates `../icons/browsers/firefox.svg` (the category is decided for
you - see "How categorization works" below). To write somewhere else
instead:

```sh
npm run badge -- firefox custom/firefox-badge.svg
```

## How icon lookup works

Directories are tried in order, and the first hit wins:

1. **Manual picks** (`local-glyphs.ts`) - `GENERIC_ICON_MAP` gives Fedora
   KDE's own bundled apps (Dolphin, Konsole, System Settings, ...) a generic
   Phosphor Icons pictogram instead of a brand mark, even where the app has
   one. `ICONIFY_OVERRIDES` pins a specific Iconify icon for slugs where the
   automatic search below found nothing recognizable or nothing at all
   (OpenAI's and Microsoft Edge's marks aren't on Simple Icons; Tor's own
   half-rings mark barely reads at badge size).
2. **[Simple Icons](https://simpleicons.org)** - brand logos, already
   single-fill black marks built for exactly this kind of monochrome use.
3. **[Tabler Icons](https://tabler.io/icons)** `brand-*` outlines - covers
   brands Simple Icons doesn't carry.
4. **[Iconify](https://iconify.design)**'s search API - aggregates hundreds
   of icon sets, so it catches most brand marks the first three miss.
5. **Tabler Icons** generic outlines - a last-resort pictogram by concept
   name.

Only Simple Icons and Tabler ship marks explicitly designed to flatten to a
single solid color. A mark pulled from Iconify can turn out to be built from
layered, semi-transparent, gradient-filled shapes meant for full-color
display - forcing every layer to opaque black then stacks them into an
undifferentiated blob instead of a clean silhouette. Check a new Iconify
result visually before trusting it, and prefer a `ICONIFY_OVERRIDES` pick
that's a genuine single-path mark.

## How categorization works

An icon's category is never guessed from its own slug or name. For anything
found automatically (steps 2-5 above), it's classified by combining:

- whatever tags the source directory shipped with the icon (Tabler Icons
  embeds a `tags: [...]` header in each file), and
- [Flathub](https://flathub.org)'s structured AppStream menu categories for
  the app (`WebBrowser`, `InstantMessaging`, `Development`, ...) - real
  package metadata that almost every native Linux app declares.

Those tags are matched against the tag vocabulary in `categories.json`
(`categorize.ts`). The winning category absorbs any new, non-ambiguous words
from the match, so the vocabulary grows from evidence over time. Two
categories matching equally hard is treated as no signal at all (ties resolve
to `uncategorized`, not an arbitrary pick) - an earlier version of this logic
let a tied match slip through and poison an unrelated category's vocabulary
with an unrelated word, which is exactly the failure mode this guards
against. A word already claimed by another category is never adopted by the
winner either, for the same reason.

`kde` is excluded from this automatic classification entirely - it's only
ever reached via the manual `GENERIC_ICON_MAP` picks, so an unrelated
Linux-adjacent app can never get mistakenly filed as belonging to the desktop
itself.

Two situations still need a human judgment call, handled by
`CATEGORY_OVERRIDES` in `local-glyphs.ts`:

- **PWAs and other non-packaged software** (Gmail, YouTube, Cursor,
  DaVinci Resolve) have no Flathub entry, or the closest search hit is an
  unrelated app entirely - there's no package metadata to classify them by.
- **Genuine ties or misleading categories** - e.g. VLC and Tidal legitimately
  score equally between "media" and "music", and Obsidian/Notion/Todoist
  share Flathub's generic "Office" category with LibreOffice despite not
  being office suites.

## Extending it

- **New app, existing category, real Flathub/Simple Icons/Tabler presence**:
  just run `npm run badge -- <slug>` - no code change needed.
- **New app that needs a manual icon pick or category override**: add an
  entry to `ICONIFY_OVERRIDES` or `CATEGORY_OVERRIDES` in `local-glyphs.ts`,
  with a comment explaining why the automatic path doesn't work for it.
- **New category**: add it to `categories.json` with a handful of seed tags
  describing it (single words, not compound ones - `"webbrowser"` won't ever
  match a source's split `"web"`/`"browser"` tokens, so keep vocabulary and
  incoming tags tokenized the same way).
- **New KDE app that should show a generic icon**: add it to
  `GENERIC_ICON_MAP` with a suitable Phosphor Icons "fill" glyph.
