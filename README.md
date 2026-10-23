# Tokyo Memories

A small mobile web game: six stops from the trip, a polaroid at each, train rides in between, ending at home in Asakusa.

## Add your photos and captions

1. Drop six square-ish photos into `assets/photos/` with these names (or change the paths in `js/config.js`):
   - `01-shibuya.jpg`, `02-disneysea.jpg`, `03-tokyo-tower.jpg`, `04-nihombashi.jpg`, `05-teamlab.jpg`, `06-asakusa.jpg`
2. Edit captions, day labels, outfit colours and the ending note in `js/config.js`.

A missing photo shows a placeholder card, so the game always runs.

## Run locally

```bash
python3 serve.py
```

Open http://localhost:5173. (`serve.py` turns off browser caching so edits always show up.) To try it on a phone on the same Wi-Fi, use your Mac's local IP instead of localhost.

Jump links (add to the URL, or change them while playing):

- `#photo0` … `#photo5`: standing on that stop's photo spot, ready to tap the camera
- `#metro1` … `#metro5`: plays that train ride (`#metro1` = Shibuya → DisneySea), then arrives at the next stop
- `#stop0` … `#stop5`: starts at that stop's station

## Character previews

- http://localhost:5173/yulia and http://localhost:5173/eduard show each character on a turntable. Drag to orbit, pinch or scroll to zoom, and tap a pose (walk, run, photo, hand-hold, pulled along, sit, reels, sleep on shoulder, laugh). Toggles switch stop-motion, wireframe and auto-spin.
- Colours come from `js/config.js` and the meshes from `js/characters.js`, so the previews always match the game.

## Put it online

It's a static site with no build step, so any static host works (GitHub Pages, Netlify drop, Cloudflare Pages). Upload the whole folder.
