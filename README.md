# Daily One-Game Pipeline

Small mobile-first web games built as static files and collected in one repository.

## What This Repository Does
- Stores one small web game per day under `games/YYYY-MM-DD-slug/`
- Rebuilds a root `index.html` catalog from per-game metadata
- Keeps everything compatible with simple static hosting such as GitHub Pages

## Repository Structure
```text
.
├── AGENTS.md
├── README.md
├── index.html
├── games/
│   └── YYYY-MM-DD-slug/
│       ├── index.html
│       ├── style.css
│       ├── script.js
│       └── meta.json
├── tools/
└── .agents/
    └── skills/
```

## Local Preview
This project is static, so a local HTTP server is enough.

### Python
```bash
cd /Users/alex/project/game_maker
python3 -m http.server 8000
```

Then open:
- `http://localhost:8000/`

For mobile testing on the same Wi-Fi:
- `http://YOUR_COMPUTER_IP:8000/`

## Core Commands
Plan today’s game idea:

```bash
node tools/plan-game.js --date 2026-04-13
```

Rebuild the root catalog:

```bash
node tools/build-catalog.js
```

Catalog design changes should be made in `tools/lib/harness.js`, then regenerated with `node tools/build-catalog.js`. The root `index.html` is generated output and may be overwritten.

Verify one game:

```bash
node tools/verify-game.js games/2026-04-13-tap-cleanse-rush-ribbon
```

Verify the whole repository:

```bash
node tools/verify-repo.js
node tools/verify-skills.js
```

## Adding a New Daily Game
1. Plan the concept with `node tools/plan-game.js --date YYYY-MM-DD`.
2. Create `games/YYYY-MM-DD-slug/`.
3. Add `index.html`, `style.css`, `script.js`, and `meta.json`.
4. Rebuild the catalog with `node tools/build-catalog.js`.
5. Run:

```bash
node tools/verify-game.js games/YYYY-MM-DD-slug
node tools/verify-repo.js
node tools/verify-skills.js
```

## GitHub Pages Deployment
This repository is designed to work as a single GitHub Pages site containing many games.

### URL Shape
- Root catalog:
  - `https://USERNAME.github.io/REPOSITORY/`
- One game:
  - `https://USERNAME.github.io/REPOSITORY/games/YYYY-MM-DD-slug/`

### Recommended Setup
1. Push this repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Settings` -> `Pages`.
4. Under `Build and deployment`, choose:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
5. Save.

After GitHub Pages finishes publishing, the root catalog and all game folders will be available under the repository site URL.

## Why `.nojekyll` Exists
GitHub Pages can run Jekyll by default for some repositories. This project is plain static HTML/CSS/JS, so `.nojekyll` is included to make sure files are served directly without Jekyll processing.

## Rules for New Games
- Use only HTML, CSS, and vanilla JavaScript.
- Keep games mobile-first and static-hostable.
- Use relative paths only.
- Do not depend on external libraries or assets.
- Do not overwrite an existing game for the same date unless explicitly intended.
