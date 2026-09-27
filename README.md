# 🎤 Asad's Talkify

Upload an MP3 and an image, and Talkify renders a video with an animated audio visualizer — right in the browser. No backend, no upload to any server.

## Features
- 4 visualizer styles: **Bars**, **Circle pulse**, **Waveform**, and **Rickshaw Art** 🎨 (Bangladeshi rickshaw-art palette + patterned border)
- **Bass-synced zoom pulse** on the background image
- **Optional title / lyrics overlay** burned into the video
- **Fast export** — renders the video frame-by-frame instead of waiting through the full song in real time
- **Choose where to save** — a native "Save As" dialog appears before rendering starts (Chrome/Edge)
- **Live percentage progress** while rendering

## How export works
Clicking "Create Video":
1. Decodes your MP3 instantly (no real-time playback needed)
2. Asks where to save the file (Chrome/Edge — File System Access API)
3. Renders every video frame + encodes audio using [Mediabunny](https://mediabunny.dev) (built on the browser's native WebCodecs API), showing live % progress
4. Writes the finished `.webm` straight to your chosen location

**Requires Chrome or Edge** for export (WebCodecs API). Preview works everywhere.
**Needs an internet connection** the first time you export in a session — it loads the small Mediabunny library from a CDN (a few hundred KB, then cached by the browser). If the save dialog isn't supported, it falls back to an automatic download + a manual "Download Video" button.

## Run locally
No build step needed.
```bash
npx serve .
```
then open the printed `localhost` URL. (Serving over `http://localhost` or `https://` is required for the save dialog / WebCodecs to work — opening `index.html` directly via `file://` may not.)

## Deploy — GitHub

```bash
cd asad-talkify
git init
git add .
git commit -m "Initial commit: Asad's Talkify"
git branch -M main
git remote add origin https://github.com/ahabib69/asad-talkify.git
git push -u origin main
```

## Deploy — Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the `asad-talkify` repo.
2. Framework preset: **Other** (static — no build command needed).
3. Click **Deploy**.

Every future `git push` to `main` auto-redeploys.
