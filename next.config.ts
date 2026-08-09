import type { NextConfig } from "next";

/**
 * VoiceRip runs entirely client-side via ffmpeg.wasm.
 *
 * ffmpeg.wasm may use SharedArrayBuffer for its worker; to guarantee that
 * works in every deployment we set COOP/COEP headers. The app loads no
 * third-party resources (fonts are self-hosted via next/font, the ffmpeg core
 * is fetched into a same-origin blob URL), so `require-corp` is safe.
 */
const nextConfig: NextConfig = {
  // No `output: "standalone"` — we deploy to Vercel, not a Node server.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
