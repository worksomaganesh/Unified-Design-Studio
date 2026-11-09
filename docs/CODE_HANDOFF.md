# Code handoff

Phase 7 adds a local, downloadable frontend handoff from the canvas editor. Open **Code handoff** in the editor toolbar to review support notes, preview the current document, or download the ZIP bundle. The download saves pending canvas edits first and then exports the latest persisted revision.

## Bundle contents

- `index.html` and `styles.css`: static desktop screen export.
- `react/`: a Vite + React project with generated screen components.
- `design-system/tokens.json`: the complete design system, including modes, aliases, token values, components, and variants.
- `react/public/assets/`: referenced project images shared by the React project and static HTML export.
- `export-report.json`: generated support notes for constructs that are static or have limited rendering support.
- `README.md`: local setup instructions and the desktop canvas size.
- Optional `.gitignore` and `GIT_HANDOFF.md`: local repository setup notes and a first-commit walkthrough.

Run the React project from the `react` directory with `npm install` followed by `npm run dev`. The HTML export can be opened directly in a browser.

## Current limitations

- Artboards export at the current 1280 × 800 desktop canvas size. Mobile and tablet layouts are outside the project scope.
- Prototype connections, variable state, and transitions are not executable in the frontend export; the current design state is rendered statically.
- Line shapes currently render as filled rectangles.
- Non-color tokens and component definitions are preserved in the token JSON; the generated screen uses currently supported color tokens and static component output.
- External images and project images that have been removed are omitted. The support report calls these out.
- Export bundles are assembled in memory and returned as a download. The optional Git-ready bundle does not write into a destination folder, initialize a Git repository, contact GitHub, or push anything; it includes ignore rules and steps for creating a repository after extraction.

## Restricted preview

The handoff panel preview renders the current unsaved canvas state inside an iframe without script permission. Its policy blocks scripts, network connections, forms, external images, and embedded objects. Only image URLs matching an asset in the active project are admitted. This preview shows static export output; use the separate prototype preview to inspect interactions.

## Local API

- `GET /api/projects/:id/code-export/report` returns the current saved revision number, support findings, asset counts, and bundle outline.
- `GET /api/projects/:id/code-export` returns a ZIP containing the supported export files and project assets.

Both routes are scoped to the local project. Exported images are limited to supported raster formats, 20 MB per image and 100 MB total. The generated archive uses relative paths and does not execute commands or initialize Git.

The optional Git-ready bundle is selected in the handoff panel. It includes `.gitignore` rules for dependencies, build output, local environment files, and common OS files. `GIT_HANDOFF.md` explains how to extract the bundle, create the React lockfile, inspect the contents, and make a local first commit. Git commands are instructions only and are never executed by the Studio.
