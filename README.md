# VoiceRip

Two things: split a track into vocals, drums, bass and everything else, or just
pull the audio out of a video. Both run in the browser.

## Stem separation

Deezer's Spleeter 4-stem models, converted to ONNX and run through
onnxruntime-web. The four `fp16` models are about 19.7 MB each, fetched from
HuggingFace on first use and cached by the browser after that.

The pipeline:

1. Decode to 44100 Hz stereo
2. STFT with a periodic Hann window, frame 4096, hop 1024, giving 2049 complex bins
3. Take the magnitude of the first 1024 bins, split into 512-frame chunks
4. Run the four U-Net models to get four magnitude estimates
5. Soft ratio mask, `mask = (est² + ε/4) / Σ(est²) + ε`
6. Extend the mask from 1024 back to 2049 bins using a per-frame mean
7. Apply it to the original complex STFT, which keeps the phase intact
8. ISTFT with overlap-add

The four masks sum to 1 by construction, so the stems add back up to the
original mix at around −156 dB. Each stem downloads separately.

## Audio extraction

`ffmpeg.wasm` with `-vn`, so no video is decoded. Takes MP4, WebM, MOV, MKV, AVI
and OGG, and writes MP3 at 128/192/256/320k or 16-bit PCM WAV. Optional
`HH:MM:SS` start and end for trimming. Batch mode handles several files in a row.

ffmpeg is lazy-loaded on the first job. On desktop the worker is kept warm for
follow-up jobs; on mobile it is torn down after each one to keep memory down,
where the file cap is 100 MB against 500 MB on desktop.

## Running it

```bash
bun install
bun run dev     # http://localhost:3000
```

ffmpeg.wasm needs `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. Those are set in `next.config.ts`
for dev and `vercel.json` for production.

## Built with

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui,
[ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm),
[onnxruntime-web](https://onnxruntime.ai/docs/tutorials/web/), next-themes,
lucide-react. No backend, no database, no API routes.

## Privacy

Audio is decoded and processed on your device. The only network traffic is the
one-time fetch of the ffmpeg core and the ONNX model weights, both of which are
static files. Nothing you drop in is uploaded, and there is no analytics.

## Deploying

Import the repo on Vercel with the Next.js preset. No environment variables.
`vercel.json` applies the COOP/COEP headers ffmpeg needs.

## License

MIT.

---

Jeffrey Hamilton · [GitHub](https://github.com/JeffreyHamilton6399) ·
[buy me a coffee](https://buymeacoffee.com/jeffreyscof)
