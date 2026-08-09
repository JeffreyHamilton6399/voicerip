/**
 * Client-side audio extraction via ffmpeg.wasm.
 *
 * Everything runs in the browser — the video file never leaves the device.
 * ffmpeg.wasm is lazy-loaded on first extraction and kept warm on desktop
 * for fast follow-up jobs. On mobile the worker is terminated after each
 * extraction to keep memory pressure low.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { isMobile } from "@/lib/mobile";

export type AudioFormat = "mp3" | "wav";
export type Mp3Bitrate = "128k" | "192k" | "256k" | "320k";

/** A video queued for extraction (single or batch). */
export interface VideoItem {
  id: string;
  file: File;
  /** Duration in seconds, or null when the browser can’t probe it. */
  duration: number | null;
}

export interface ExtractOptions {
  format: AudioFormat;
  /** MP3 only — ignored for WAV. */
  bitrate: Mp3Bitrate;
  /** Trim start in seconds. Omit/null for no trim. */
  startSec?: number | null;
  /** Trim end in seconds. Omit/null for no trim. */
  endSec?: number | null;
  /** 0..1 progress callback. */
  onProgress?: (ratio: number) => void;
  /** Optional log sink (for debugging). */
  onLog?: (message: string) => void;
}

export interface ExtractResult {
  blob: Blob;
  /** Suggested download filename with extension. */
  filename: string;
  sizeBytes: number;
  mime: string;
}

const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

/** Lazy-load the ffmpeg.wasm core. Returns a warm singleton. */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      // Keep noise out of the console unless debugging is on.
      if (typeof window !== "undefined" && (window as any).__VR_DEBUG) {
        console.debug("[ffmpeg]", message);
      }
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    // Reset so the next attempt can retry from scratch.
    loadingPromise = null;
    ffmpegInstance = null;
    throw err;
  }
}

/** Tear down the ffmpeg worker to free memory (used on mobile). */
export function terminateFFmpeg(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch {
      /* noop */
    }
    ffmpegInstance = null;
    loadingPromise = null;
  }
}

/** Whether the ffmpeg core is currently loaded and warm. */
export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null;
}

function pickInputExt(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,4}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "video/x-msvideo": "avi",
    "video/ogg": "ogv",
  };
  return map[file.type] ?? "mp4";
}

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

function fmtTime(sec: number): string {
  // HH:MM:SS.mmm for ffmpeg -ss / -to
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number, l = 2) => n.toString().padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s, 2)}.${pad(Math.floor((s % 1) * 1000), 3)}`;
}

/**
 * Extract audio from a video file. Pure client-side via ffmpeg.wasm.
 * Uses `-vn` (no video processing) so the encode is audio-only and fast.
 */
export async function extractAudio(
  file: File,
  opts: ExtractOptions
): Promise<ExtractResult> {
  const { format, bitrate, startSec, endSec, onProgress, onLog } = opts;
  const ffmpeg = await getFFmpeg();

  const inputExt = pickInputExt(file);
  const inputName = `input.${inputExt}`;
  const outputExt = format === "mp3" ? "mp3" : "wav";
  const outputName = `output.${outputExt}`;

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.min(1, Math.max(0, progress)));
  };
  const logHandler = ({ message }: { message: string }) => {
    if (onLog) onLog(message);
  };
  ffmpeg.on("progress", progressHandler);
  if (onLog) ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const args: string[] = ["-i", inputName];
    if (startSec != null && Number.isFinite(startSec) && startSec > 0) {
      args.push("-ss", fmtTime(startSec));
    }
    if (endSec != null && Number.isFinite(endSec) && endSec > 0) {
      args.push("-to", fmtTime(endSec));
    }
    args.push("-vn");
    if (format === "mp3") {
      args.push("-acodec", "libmp3lame", "-b:a", bitrate);
    } else {
      args.push("-acodec", "pcm_s16le");
    }
    args.push("-y", outputName);

    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    const arr =
      data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
    const mime = format === "mp3" ? "audio/mpeg" : "audio/wav";
    const blob = new Blob([arr], { type: mime });

    // Clean up the virtual FS so repeated extractions don't balloon memory.
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {
      /* noop */
    }

    const result: ExtractResult = {
      blob,
      filename: `${baseName(file.name)}.${outputExt}`,
      sizeBytes: blob.size,
      mime,
    };

    // On mobile, release the wasm worker immediately to keep memory low.
    if (isMobile()) terminateFFmpeg();

    return result;
  } finally {
    ffmpeg.off("progress", progressHandler);
    if (onLog) ffmpeg.off("log", logHandler);
  }
}

/**
 * Best-effort duration probe using a hidden <video> element.
 * Returns null when the browser cannot decode the container (e.g. MKV/AVI).
 * Avoids loading ffmpeg.wasm just to read duration.
 */
export function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;

    let settled = false;
    const finish = (val: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(val);
    };

    const timer = setTimeout(() => finish(null), 4000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = video.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
  });
}

export const ACCEPTED_EXTENSIONS = [
  // video
  "mp4",
  "webm",
  "mov",
  "mkv",
  "avi",
  "ogv",
  // audio
  "mp3",
  "wav",
  "m4a",
  "aac",
  "flac",
  "ogg",
];

export function isAcceptedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ACCEPTED_EXTENSIONS.includes(ext)) return true;
  return file.type.startsWith("video/") || file.type.startsWith("audio/");
}
