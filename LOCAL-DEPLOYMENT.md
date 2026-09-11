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
