# Run Claybound locally

The complete playable game is in `dist/`, including JavaScript, models,
textures, music and bundled browser libraries. No build step is required.
Keep `dist/` in version control: it contains the authored game source.

From the project directory, run:

```sh
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:5173 in a WebGL 2 capable browser. Keep the terminal
running; press Ctrl+C to stop the server. Use the same host and port to
retain access to that browser's saved progress and editor drafts.

For development with Node.js 22.12 or newer:

```sh
npm ci
npm run check
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

## Backup and restore

The GitHub repository includes the game, shipped assets, reference images,
documentation, asset preparation scripts, tests and dependency lockfile.
Installed dependencies and macOS metadata are excluded.

```sh
git clone https://github.com/dermosef91/claybound.git
cd claybound
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist
```

Browser-local saved progress and editor drafts are not project files and
are not part of this repository backup. Export any custom editor drafts
from the game separately. Asset preparation scripts may reference original
uploads outside this project; the playable, prepared assets are included.

## Hosted deployment

`.github/workflows/deploy-pages.yml` publishes `dist/` to GitHub Pages on
every push to `main`, and can also be started by hand from the Actions tab.
The job uploads the directory verbatim, so the hosted site is the same game
the local static server serves. There is no build step to keep in sync.

The first run turns Pages on by itself, so no manual repository setup is
needed. Once it finishes, the Actions summary links the published address,
which is also shown under Settings then Pages.

Publishing Pages from a private repository requires a paid GitHub plan. On
the free plan the workflow fails at the "Turn on Pages" step; making the
repository public also resolves it. A Pages site is reachable by anyone with
the address even when the repository stays private, so treat the address as
public once the game is live.
