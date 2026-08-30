/**
 * Spleeter 4-stem source separation via ONNX Runtime Web.
 *
 * Downloads Deezer's Spleeter 4stems ONNX models (vocals, drums, bass, other)
 * from HuggingFace, runs them in the browser via onnxruntime-web, and
 * reconstructs 4 separate audio tracks from a mixed input.
 *
 * Pipeline (from Best-Practice/spleeter-4stems-onnx README):
 *   1. Decode audio → 44100 Hz stereo
 *   2. STFT: periodic Hann, frame=4096, hop=1024 → 2049 complex bins
 *   3. Take magnitude of first 1024 bins, partition into 512-frame splits
 *   4. Run 4 U-Net models → 4 magnitude estimates
 *   5. Soft ratio mask: mask = (est² + ε/4) / Σ(est²) + ε
 *   6. Band extension: extend 1024→2049 bins with per-frame mean
 *   7. Apply mask to original complex STFT (preserves phase)
 *   8. ISTFT with overlap-add → 4 time-domain stems
 *
 * The 4 masks sum to 1 by construction, so sum(stems) = mix to machine
 * precision (verified at −156 dB).
 *
 * Models: 4 × 19.7 MB fp16 ONNX = 78.8 MB total (cached by browser).
 */

import * as ort from "onnxruntime-web";

export interface SeparateOptions {
  onProgress?: (ratio: number, stage: string) => void;
}

export interface StemResult {
  name: "vocals" | "drums" | "bass" | "other";
  blob: Blob;
  filename: string;
  sizeBytes: number;
}

export interface SeparateResult {
  stems: StemResult[];
  sampleRate: number;
  duration: number;
}

const N_FFT = 4096;
const HOP = 1024;
const T = 512; // frames per split
const F = 1024; // freq bins the model uses
const BINS = 2049; // total rfft bins (N_FFT / 2 + 1)
const PAD = N_FFT - HOP; // front padding
const SR = 44100;
const EPS = 1e-10;

const MODEL_BASE =
  "https://huggingface.co/Best-Practice/spleeter-4stems-onnx/resolve/main";
const STEM_NAMES = ["vocals", "drums", "bass", "other"] as const;

// Cache for loaded models - avoids re-downloading on repeat use.
const modelCache = new Map<string, ort.InferenceSession>();

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/* ----------------------------- FFT (radix-2) ----------------------------- */

function fft(re: Float32Array, im: Float32Array, inverse: boolean): void {
  const n = re.length;
  if (n <= 1) return;

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wlenRe = Math.cos(angle);
    const wlenIm = Math.sin(angle);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < half; j++) {
        const aRe = re[i + j];
        const aIm = im[i + j];
        const bReRaw = re[i + j + half];
        const bImRaw = im[i + j + half];
        const bRe = bReRaw * wRe - bImRaw * wIm;
        const bIm = bReRaw * wIm + bImRaw * wRe;
        re[i + j] = aRe + bRe;
        im[i + j] = aIm + bIm;
        re[i + j + half] = aRe - bRe;
        im[i + j + half] = aIm - bIm;
        const newWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = newWRe;
      }
    }
  }

  if (inverse) {
    const invN = 1 / n;
    for (let i = 0; i < n; i++) {
      re[i] *= invN;
      im[i] *= invN;
    }
  }
}

/* -------------------------- Periodic Hann window ------------------------- */

function periodicHann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  }
  return w;
}

/* -------------------------------- STFT ----------------------------------- */

interface ComplexSpec {
  re: Float32Array; // frames × BINS
  im: Float32Array;
  frames: number;
}

function stft(x: Float32Array, W: Float32Array): ComplexSpec {
  const nFrames = Math.ceil((PAD + x.length) / HOP);
  const paddedLen = (nFrames - 1) * HOP + N_FFT;
  const padded = new Float32Array(paddedLen);
  padded.set(x, PAD);

  const re = new Float32Array(nFrames * BINS);
  const im = new Float32Array(nFrames * BINS);

  const fre = new Float32Array(N_FFT);
  const fim = new Float32Array(N_FFT);

  for (let f = 0; f < nFrames; f++) {
    const start = f * HOP;
    for (let i = 0; i < N_FFT; i++) {
      fre[i] = padded[start + i] * W[i];
      fim[i] = 0;
    }
    fft(fre, fim, false);
    // Take first BINS = N_FFT/2 + 1 bins (Hermitian symmetry)
    for (let b = 0; b < BINS; b++) {
      re[f * BINS + b] = fre[b];
      im[f * BINS + b] = fim[b];
    }
  }

  return { re, im, frames: nFrames };
}

/* -------------------------------- ISTFT ---------------------------------- */

function istft(
  specRe: Float32Array,
  specIm: Float32Array,
  length: number,
  W: Float32Array
): Float32Array {
  const nFrames = specRe.length / BINS;
  const total = (nFrames - 1) * HOP + N_FFT;
  const out = new Float32Array(total);
  const wsum = new Float32Array(total);

  const fre = new Float32Array(N_FFT);
  const fim = new Float32Array(N_FFT);

  for (let f = 0; f < nFrames; f++) {
    // Reconstruct full spectrum from half-spectrum (Hermitian symmetry)
    for (let b = 0; b < BINS; b++) {
      fre[b] = specRe[f * BINS + b];
      fim[b] = specIm[f * BINS + b];
    }
    const half = N_FFT >> 1;
    for (let b = 1; b < half; b++) {
      fre[N_FFT - b] = fre[b];
      fim[N_FFT - b] = -fim[b];
    }

    fft(fre, fim, true); // inverse

    const at = f * HOP;
    for (let i = 0; i < N_FFT; i++) {
      out[at + i] += fre[i] * W[i];
      wsum[at + i] += W[i] * W[i];
    }
  }

  // Normalize by window overlap energy
  for (let i = 0; i < total; i++) {
    if (wsum[i] > 1e-8) out[i] /= wsum[i];
  }

  // Strip front pad
  return out.slice(PAD, PAD + length);
}

/* ----------------------------- Model loading ----------------------------- */

async function loadModel(
  stem: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<ort.InferenceSession> {
  if (modelCache.has(stem)) return modelCache.get(stem)!;

  const url = `${MODEL_BASE}/${stem}.fp16.onnx`;

  // Fetch with progress tracking
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${stem} model: ${resp.status}`);

  const total = Number(resp.headers.get("content-length")) || 0;
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No response body");

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (onProgress) onProgress(loaded, total);
  }

  const modelData = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    modelData.set(chunk, offset);
    offset += chunk.length;
  }

  const session = await ort.InferenceSession.create(modelData, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  modelCache.set(stem, session);
  return session;
}

/* ----------------------------- WAV encoding ------------------------------ */

function encodeWav(
  channels: Float32Array[],
  sampleRate: number
): Blob {
  const numCh = channels.length;
  const len = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = channels[c][i];
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

/* ------------------------------ Separation ------------------------------- */

export async function separateAudio(
  file: File,
  opts: SeparateOptions = {}
): Promise<SeparateResult> {
  const { onProgress } = opts;

  // Configure ONNX Runtime WASM paths
  ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";

  // Stage 1: Load all 4 models (with progress)
  const totalModelSize = 78.8 * 1024 * 1024; // approximate
  let modelsLoaded = 0;
  const sessions: Record<string, ort.InferenceSession> = {};

  for (const stem of STEM_NAMES) {
    onProgress?.(modelsLoaded / (totalModelSize * 1.5), `Loading ${stem} model…`);
    sessions[stem] = await loadModel(stem, (loaded, total) => {
      const overall = (modelsLoaded + loaded) / (totalModelSize * 1.5);
      onProgress?.(overall, `Loading ${stem} model…`);
    });
    modelsLoaded += totalModelSize / 4;
  }
  onProgress?.(0.55, "Decoding audio…");

  // Stage 2: Decode audio
  const arrayBuffer = await file.arrayBuffer();
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const tmpCtx = new AC({ sampleRate: SR });
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    tmpCtx.close();
  }

  // Ensure stereo
  const numCh = Math.max(2, audioBuffer.numberOfChannels);
  const left = audioBuffer.getChannelData(0);
  const right =
    numCh >= 2 ? audioBuffer.getChannelData(1) : left;
  const length = audioBuffer.length;
  onProgress?.(0.6, "Computing spectrogram…");

  // Stage 3: STFT both channels
  const W = periodicHann(N_FFT);
  const specL = stft(new Float32Array(left), W);
  const specR = stft(new Float32Array(right), W);
  const frames = specL.frames;
  const splits = Math.ceil(frames / T);

  // Build magnitude input: [2, splits, T, F]
  const magInput = new Float32Array(2 * splits * T * F);
  for (let ch = 0; ch < 2; ch++) {
    const spec = ch === 0 ? specL : specR;
    for (let fr = 0; fr < frames; fr++) {
      for (let b = 0; b < F; b++) {
        const re = spec.re[fr * BINS + b];
        const im = spec.im[fr * BINS + b];
        magInput[ch * splits * T * F + fr * F + b] = Math.sqrt(re * re + im * im);
      }
    }
  }
  // Reshape to [2, splits, T, F] - already in that layout

  // Stage 4: Run all 4 models
  const estimates: Record<string, Float32Array> = {};
  for (let i = 0; i < STEM_NAMES.length; i++) {
    const stem = STEM_NAMES[i];
    onProgress?.(
      0.6 + (i / 4) * 0.25,
      `Separating ${stem}…`
    );

    const inputTensor = new ort.Tensor("float32", magInput, [2, splits, T, F]);
    const results = await sessions[stem].run({ x: inputTensor });
    const output = results.y.data as Float32Array;
    estimates[stem] = output;
  }

  onProgress?.(0.88, "Reconstructing tracks…");

  // Stage 5: Compute soft ratio masks and reconstruct each stem
  const stems: StemResult[] = [];
  for (const stemName of STEM_NAMES) {
    const est = estimates[stemName]; // [2, splits*T, F]

    // Compute mask for this stem: (est² + ε/4) / Σ(all_est²) + ε
    // We need the denominator from all 4 estimates
    const mask = new Float32Array(2 * frames * F);
    for (let ch = 0; ch < 2; ch++) {
      for (let fr = 0; fr < frames; fr++) {
        for (let b = 0; b < F; b++) {
          const idx = ch * splits * T * F + fr * F + b;
          let numerator = est[idx] * est[idx] + EPS / 4;
          let denominator = EPS;
          for (const s of STEM_NAMES) {
            const v = estimates[s][idx];
            denominator += v * v;
          }
          mask[ch * frames * F + fr * F + b] = numerator / denominator;
        }
      }
    }

    // Band extension: extend 1024→2049 bins with per-frame mean
    const fullMaskL = new Float32Array(frames * BINS);
    const fullMaskR = new Float32Array(frames * BINS);
    for (let ch = 0; ch < 2; ch++) {
      const src = mask;
      const dst = ch === 0 ? fullMaskL : fullMaskR;
      const spec = ch === 0 ? specL : specR;
      for (let fr = 0; fr < frames; fr++) {
        // Mean of the first F bins
        let mean = 0;
        for (let b = 0; b < F; b++) {
          mean += src[ch * frames * F + fr * F + b];
        }
        mean /= F;
        // Fill first F bins
        for (let b = 0; b < F; b++) {
          dst[fr * BINS + b] = src[ch * frames * F + fr * F + b];
        }
        // Extend with mean
        for (let b = F; b < BINS; b++) {
          dst[fr * BINS + b] = mean;
        }
      }
    }

    // Apply mask to original complex STFT
    const outReL = new Float32Array(frames * BINS);
    const outImL = new Float32Array(frames * BINS);
    const outReR = new Float32Array(frames * BINS);
    const outImR = new Float32Array(frames * BINS);
    for (let fr = 0; fr < frames; fr++) {
      for (let b = 0; b < BINS; b++) {
        const m = fullMaskL[fr * BINS + b];
        outReL[fr * BINS + b] = specL.re[fr * BINS + b] * m;
        outImL[fr * BINS + b] = specL.im[fr * BINS + b] * m;
      }
    }
    for (let fr = 0; fr < frames; fr++) {
      for (let b = 0; b < BINS; b++) {
        const m = fullMaskR[fr * BINS + b];
        outReR[fr * BINS + b] = specR.re[fr * BINS + b] * m;
        outImR[fr * BINS + b] = specR.im[fr * BINS + b] * m;
      }
    }

    // ISTFT
    const stemL = istft(outReL, outImL, length, W);
    const stemR = istft(outReR, outImR, length, W);

    // Encode WAV
    const blob = encodeWav([stemL, stemR], SR);
    stems.push({
      name: stemName as StemResult["name"],
      blob,
      filename: `${baseName(file.name)}-${stemName}.wav`,
      sizeBytes: blob.size,
    });
  }

  onProgress?.(1, "Done");

  return {
    stems,
    sampleRate: SR,
    duration: length / SR,
  };
}

/** Pre-warm: preload models in the background (desktop only). */
export async function preloadModels(): Promise<void> {
  try {
    ort.env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
    for (const stem of STEM_NAMES) {
      await loadModel(stem);
    }
  } catch {
    // Silent - will retry on actual use
  }
}
