# VoiceRip

Extract audio (voice or music) from any video file — instantly, in your browser.

Drop a video, pick **MP3** or **WAV**, download the audio. No uploads, no sign-up, no server. Your files never leave your device.

## Privacy promise

VoiceRip is **100% client-side**. The video you drop is processed entirely inside your browser by [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm). Nothing is ever uploaded — there is no backend, no API, no database, no analytics, no tracking. The only network request is the one-time fetch of the ffmpeg WebAssembly core (cached as a blob URL afterward).

> Extract audio from your videos without uploading them anywhere.

## Features

- **Formats**: MP4, WebM, MOV, MKV, AVI, OGG → MP3 or WAV
- **MP3 bitrates**: 128k / 192k / 256k / 320k
- **WAV**: 16-bit PCM (lossless)
- **Trim**: optional start / end timestamps (`HH:MM:SS`)
- **Batch mode**: extract audio from multiple videos at once
- **Fast**: `-vn` (no video processing) — audio-only encode
- **Dark mode**: follows your system theme
- **Mobile-first**: works on a 390px viewport, 100MB file cap on mobile (500MB desktop)
- **Custom logo**: flat SVG microphone-in-film-strip mark

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (New York)
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (`@ffmpeg/ffmpeg` + `@ffmpeg/util`)
- [lucide-react](https://lucide.dev/) icons
- [next-themes](https://github.com/pacocoursey/next-themes) for dark mode
- [bun](https://bun.sh/) as package manager
- No backend, no database, no API routes

## Run locally

```bash
bun install
bun run dev
# open http://localhost:3000
```

> ffmpeg.wasm needs `Cross-Origin-Opener-Policy: same-origin` and
> `Cross-Origin-Embedder-Policy: require-corp` headers. They are set in both
> `next.config.ts` (dev) and `vercel.json` (production).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Framework preset: **Next.js**. No env vars needed.
4. Deploy. `vercel.json` applies the required COOP/COEP headers automatically.

## How it works

| Step | What happens |
| --- | --- |
| Drop video | `File` read in-browser, duration probed via a hidden `<video>` |
| Pick format/quality | MP3 → `libmp3lame`, WAV → `pcm_s16le` |
| Extract | `ffmpeg.wasm` runs `-vn` (audio-only) with optional `-ss/-to` trim |
| Download | Result `Blob` offered as a local download via object URL |

ffmpeg.wasm is **lazy-loaded** on first extraction and kept warm on desktop for
instant follow-up jobs. On mobile the worker is terminated after each extraction
to keep memory pressure low.

## Author

**Jeffrey Hamilton** — [GitHub](https://github.com/JeffreyHamilton6399)

Donate: [buymeacoffee.com/jeffreyscof](https://buymeacoffee.com/jeffreyscof)

## License

MIT
