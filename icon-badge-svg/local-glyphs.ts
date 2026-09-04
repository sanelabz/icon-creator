/**
 * Manual icon + category picks that skip the automatic search and
 * classification below because an exact judgment call was already made for
 * them. This is deliberate curation, not auto-categorization: nothing here
 * is inferred, so a fixed category is fine.
 */
interface ManualPick {
  icon: string;
  category: string;
}

// Phosphor Icons "fill" weight (github.com/phosphor-icons/core, MIT), served
// via Iconify, for Fedora KDE Plasma's standard apps. These always render as
// a solid generic pictogram rather than any brand mark, even where the app
// has one. Filled rather than outline so they read clearly at badge size.
export const GENERIC_ICON_MAP: Record<string, ManualPick> = {
  dolphin: { icon: "ph:folder-fill", category: "kde" },
  konsole: { icon: "ph:terminal-window-fill", category: "kde" },
  kate: { icon: "ph:pencil-fill", category: "kde" },
  okular: { icon: "ph:book-open-fill", category: "kde" },
  gwenview: { icon: "ph:image-fill", category: "kde" },
  elisa: { icon: "ph:play-circle-fill", category: "kde" },
  discover: { icon: "ph:package-fill", category: "kde" },
  kcalc: { icon: "ph:calculator-fill", category: "kde" },
  spectacle: { icon: "ph:crop-fill", category: "kde" },
  systemsettings: { icon: "ph:gear-fill", category: "kde" },
  settings: { icon: "ph:gear-fill", category: "kde" },
  ark: { icon: "ph:archive-fill", category: "kde" },
  // SANE is a KDE-distributed scanner setup utility; use the magic wand to
  // make its first-run/configuration entry point immediately distinguishable.
  "sane-setup": { icon: "ph:magic-wand-fill", category: "kde" },
};

// Iconify (iconify.design) icon ids for slugs where the automatic search
// below picked a poor or unrecognizable match and a specific icon was
// chosen by hand instead.
export const ICONIFY_OVERRIDES: Record<string, ManualPick> = {
  chatgpt: { icon: "ri:openai-fill", category: "ai" },
  openai: { icon: "ri:openai-fill", category: "ai" },
  tor: { icon: "lucide-lab:onion", category: "browsers" },
  torbrowser: { icon: "lucide-lab:onion", category: "browsers" },
  // Outlook isn't on Simple Icons; the automatic Iconify search's top hit
  // was a generic "Outlook file type" glyph rather than the actual logo.
  // (selfh.st/icons was tried here first, but its marks are built from
  // layered semi-transparent gradient shapes for full-color display - once
  // every layer is forced to opaque black they stack into a solid blob
  // instead of a silhouette. mdi's is a real single-path monochrome mark.)
  outlook: { icon: "mdi:microsoft-outlook", category: "web" },
  // Apple Photos has a real mark (arcticons redraws it, since Apple apps
  // sometimes get Android icon-pack equivalents for cross-platform
  // consistency) - the rest of Apple's iCloud.com apps (Mail, Notes,
  // Reminders, Pages, Numbers, Keynote, Contacts, Calendar, Find My, iCloud
  // Passwords) have no brand mark anywhere and are deliberately left out
  // rather than given an invented pictogram - running the generator for one
  // of them should fail loudly, not silently produce a placeholder shape.
  applephotos: { icon: "arcticons:apple-photos", category: "web" },
};

// Category-only overrides: the icon still comes from the normal automatic
// search, but Flathub's own data can't be trusted to classify these -
// either it has no opinion (freedesktop's menu spec files note-taking and
// office suites under the same "Office" category, so Obsidian/Notion/Todoist
// would land next to LibreOffice) or it matches the wrong app entirely
// (Canva isn't a native Linux app; the closest Flathub search hit is an
// unrelated tarot-reading tool called "Canvas").
export const CATEGORY_OVERRIDES: Record<string, string> = {
  obsidian: "productivity",
  notion: "productivity",
  todoist: "productivity",
  canva: "creative",
  // DaVinci Resolve is proprietary and not Flatpak-distributed; the closest
  // Flathub search hit is an unrelated video-upscaling tool.
  davinciresolve: "creative",
  // VLC's and Tidal's own marketing tags genuinely tie between "media"
  // (player, audio, video) and "music" (audio, streaming, playlist) in equal
  // measure - VLC is a general media player and Tidal is a streaming
  // service, so each tie is broken here rather than left to chance.
  vlc: "media",
  tidal: "media",
  // Dropbox and Bitwarden's Flathub categories ("Office", plain "Security")
  // don't map cleanly onto this set's productivity/utilities split.
  dropbox: "productivity",
  bitwarden: "productivity",
  // OBS Studio's Flathub category (Recorder) would auto-file it under
  // "media" as a capture tool, but it belongs with the other content-
  // creation apps here.
  obsstudio: "creative",
  // Cursor is a proprietary fork of VS Code and isn't Flatpak-distributed;
  // the closest Flathub search hit is Kate, an unrelated KDE text editor.
  cursor: "development",
  // Zed's own Flathub category ties "development" against "utilities"
  // (freedesktop's generic "Utility" tag rides along on all kinds of dev
  // tools, not just utility software) - it's an editor, not a utility.
  zed: "development",
  // None of these are native Linux apps - they're websites used as PWAs, so
  // there's no package metadata to classify them by at all.
  gmail: "web",
  googledrive: "web",
  googlecalendar: "web",
  youtube: "web",
  netflix: "web",
  icloudmail: "web",
  protonmail: "web",
};
