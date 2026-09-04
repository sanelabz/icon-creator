# icon-creator

An automatic icon-badge generator for saneOS, a Fedora-based Linux
distribution. Given an app's name, it finds the best available brand mark (or,
for saneOS's own bundled KDE apps, a generic pictogram instead of a brand
mark), renders it as a flat black glyph centered in a white 128px circular
SVG badge, and automatically files the result into the right category under
[`icons/`](icons) - no per-app category list to maintain by hand.

```
icons/
├── ai/            claude.svg, chatgpt.svg, googlegemini.svg, ollama.svg
├── browsers/      firefox.svg, brave.svg, chromium.svg, microsoftedge.svg, ...
├── communication/ discord.svg, slack.svg, whatsapp.svg, signal.svg, zoom.svg, ...
├── creative/      figma.svg, blender.svg, krita.svg, davinciresolve.svg, ...
├── development/   vscode.svg, github.svg, docker.svg, zed.svg, cursor.svg, ...
├── gaming/        steam.svg, epicgames.svg
├── kde/           dolphin.svg, konsole.svg, systemsettings.svg, ...
├── media/         vlc.svg, tidal.svg
├── music/         spotify.svg, applemusic.svg, youtubemusic.svg
├── office/        libreofficewriter.svg, libreofficecalc.svg, ...
├── productivity/  obsidian.svg, notion.svg, dropbox.svg, bitwarden.svg, ...
├── utilities/     1password.svg, localsend.svg
└── web/           gmail.svg, outlook.svg, youtube.svg, netflix.svg, ...
```

## Usage

```sh
cd icon-badge-svg
npm install
npm run badge -- firefox
```

This creates `icons/browsers/firefox.svg`. See
[`icon-badge-svg/README.md`](icon-badge-svg/README.md) for how the generator
picks an icon and a category, and how to extend it.

## Install on Fedora KDE

### Install a released RPM

Tagged releases publish a `sane-icons` RPM. Download the matching
`sane-icons-*.noarch.rpm` asset from the [GitHub Releases page](https://github.com/sanelabz/icon-creator/releases), open a terminal in the directory that contains the downloaded file, then run:

```sh
sudo dnf install ./sane-icons-*.noarch.rpm
```

### Build and install from a manual Actions run

1. Open the repository's **Actions** tab and select **Build and Release RPM**.
2. Select **Run workflow**, choose `main` (or your branch), optionally enter
   an RPM version, then start the workflow.
3. Wait for the run to complete. Open that run, scroll to **Artifacts**, and
   download **sane-icons-rpm**. Your browser saves it as
   `sane-icons-rpm.zip`, normally in `~/Downloads`.
4. Extract the artifact and install its RPM with DNF:

```sh
cd ~/Downloads
unzip sane-icons-rpm.zip -d sane-icons-rpm
sudo dnf install ./sane-icons-rpm/sane-icons-*.noarch.rpm
```

If your browser saved the ZIP elsewhere, use that directory instead of
`~/Downloads`.

### Enable the theme

After installation, open **System Settings → Colors & Themes → Icons**, select
**Sane**, and click **Apply**. The RPM installs and enables its background
sync service automatically; no additional service setup is required. This
project does not currently provide a hosted DNF repository, so update by
downloading and installing the RPM from a newer release the same way.

## Automatic icon sync on Fedora KDE

The RPM installs and enables a user-level `sane-icon-sync` service. Once the
Sane icon theme is selected, it scans desktop launchers and generates a badge
for each safe, missing `Icon=` name. It runs when KDE's icon-theme setting or
an application launcher changes, and also performs an hourly catch-up scan.
The matcher is deliberately limited to literal launcher icon names; it does
not make approximate-name guesses that could apply an icon to the wrong app.

## How classification works

An icon's category is never guessed from its name. For most apps it comes
from [Flathub](https://flathub.org)'s structured AppStream menu categories
(`WebBrowser`, `Audio`, `Development`, ...) - real package metadata that
almost every native Linux app declares - matched against a small,
self-describing tag vocabulary in
[`icon-badge-svg/categories.json`](icon-badge-svg/categories.json). A handful
of apps (PWAs with no package metadata at all, or ones Flathub's data can't
disambiguate) get an explicit, documented category override instead of a
silent guess - see [`local-glyphs.ts`](icon-badge-svg/local-glyphs.ts).

## License

The generator code is licensed under [Apache-2.0](LICENSE). The icons under
`icons/` are pulled from several third-party icon projects, each under its
own license, and many depict third-party trademarks - see [`NOTICE`](NOTICE)
before redistributing them.
