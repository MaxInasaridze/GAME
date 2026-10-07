# პლასტელინი / Plastelini

A Georgian-language browser clay playground. No accounts, server, API keys, dependencies, or build step.

Add colored clay pieces, drag them, sculpt their edges, squeeze them, draw clay strings, undo/redo, start from three editable templates, and download your creation as PNG. Supports mouse and touch. Your current board is saved in this browser's local storage; this is a single-player creative sandbox.

## Run locally

```sh
python3 -m http.server 3000
```

Open `http://localhost:3000`.

## Deploy to Vercel

Import the repository. Framework: **Other**. Build command: none. Output directory: `.`. No environment variables needed. Configuration is included in `vercel.json`.

## Files

- `index.html`: Georgian interface and accessible controls.
- `style.css`: responsive desktop and phone layout.
- `app.js`: canvas rendering, sculpting interactions, history, storage, and image export.
