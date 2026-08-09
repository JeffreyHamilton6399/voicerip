/**
 * Voice isolation via STFT spectral processing.
 *
 * Pipeline (all client-side, no ML model):
 *  1. Decode audio (extract WAV first if the input is a video).
 *  2. Compute mid = (L+R)/2 and side = (L-R)/2 channels.
 *  3. STFT both into spectrograms (Hann window, 75% overlap).
 *  4. Per-bin Wiener soft mask from mid/side magnitudes.
 *  5. Vocal-band spectral gate: hard-cut below 100 Hz and above 8 kHz,
 *     soft rolloff at edges. Vocals live in 150–5000 Hz.
 *  6. HPSS: horizontal median filter (width 17) suppresses percussive
 *      transients (drums) while preserving harmonic vocal ridges.
 *  7. ISTFT with overlap-add + COLA normalization.
 *  8. EQ chain via OfflineAudioContext.
 *
 * What this removes:
 *   - Bass, sub-bass, kick drum (< 100 Hz)
 *   - Cymbals, hi-hats, air (> 8 kHz)
 *   - Side-panned instruments (guitars, synths panned L/R)
 *   - Percussive transients (drums) via HPSS
 *
 * What still leaks (honest DSP limit):
 *   - Center-panned melodic instruments (piano, center lead guitar)
 *     — spectrally identical to vocals.
 *
 * For ML-grade separation (Demucs/Spleeter), a ~30-80 MB model download
 * is required — not done here to keep the app lightweight and offline.
 */

import { extractAudio } from "@/lib/extract-audio";

export interface IsolateOptions {
  onProgress?: (ratio: number) => void;
}

export interface IsolateResult {
  blob: Blob;
  filename: string;
  sizeBytes: number;
  mime: string;
}

const FFT_SIZE = 2048;
const HOP_SIZE = 512; // 75% overlap — satisfies COLA for Hann window
const HPSS_WIDTH = 17; // median filter width (time axis) — odd
const EPS = 1e-10;

const VIDEO_RE = /\.(mp4|webm|mov|mkv|avi|ogv|m4v)$/i;

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/* ----------------------------- FFT (radix-2) ----------------------------- */

/**
 * In-place iterative radix-2 Cooley-Tukey FFT on Float32Array pairs.
 * n must be a power of two.
 */
function fft(re: Float32Array, im: Float32Array, inverse: boolean): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Butterfly stages.
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

/* ------------------------------ Hann window ------------------------------ */

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  return w;
}

/* -------------------------------- STFT ----------------------------------- */
// bins = n/2 + 1 (includes DC and Nyquist — correct for real signals)

interface Spectrogram {
  re: Float32Array; // frames × bins, real part
  im: Float32Array; // frames × bins, imag part
  frames: number;
  bins: number;
}

function stft(signal: Float32Array, window: Float32Array): Spectrogram {
  const n = FFT_SIZE;
  const bins = (n >> 1) + 1;
  const frames = Math.max(0, Math.floor((signal.length - n) / HOP_SIZE) + 1);

  const re = new Float32Array(frames * bins);
  const im = new Float32Array(frames * bins);

  const fre = new Float32Array(n);
  const fim = new Float32Array(n);

  for (let f = 0; f < frames; f++) {
    const start = f * HOP_SIZE;
    for (let i = 0; i < n; i++) {
      fre[i] = signal[start + i] * window[i];
      fim[i] = 0;
    }
    fft(fre, fim, false);
    // For a real input, FFT output satisfies Hermitian symmetry.
    // We only need bins 0..n/2 (DC to Nyquist).
    for (let b = 0; b < bins; b++) {
      re[f * bins + b] = fre[b];
      im[f * bins + b] = fim[b];
    }
  }

  return { re, im, frames, bins };
}

/* -------------------------------- ISTFT ---------------------------------- */

function istft(
  spec: Spectrogram,
  window: Float32Array,
  length: number
): Float32Array {
  const { re: specRe, im: specIm, frames, bins } = spec;
  const n = FFT_SIZE;
  const out = new Float32Array(length);
  const norm = new Float32Array(length);

  const fre = new Float32Array(n);
  const fim = new Float32Array(n);

  for (let f = 0; f < frames; f++) {
    // Reconstruct the full n-length spectrum from the half-spectrum.
    for (let b = 0; b < bins; b++) {
      fre[b] = specRe[f * bins + b];
      fim[b] = specIm[f * bins + b];
    }
    // Mirror bins 1..n/2-1 to satisfy Hermitian symmetry: X[n-k] = conj(X[k]).
    const half = n >> 1;
    for (let b = 1; b < half; b++) {
      fre[n - b] = fre[b];
      fim[n - b] = -fim[b];
    }

    fft(fre, fim, true); // inverse FFT

    const start = f * HOP_SIZE;
    for (let i = 0; i < n && start + i < length; i++) {
      out[start + i] += fre[i] * window[i];
      norm[start + i] += window[i] * window[i];
    }
  }

  // Normalize by overlap-add window energy (COLA).
  for (let i = 0; i < length; i++) {
    if (norm[i] > EPS) out[i] /= norm[i];
  }
  return out;
}

/* --------------------- Vocal-band spectral gate -------------------------- */

function buildBandGain(bins: number, sampleRate: number): Float32Array {
  const gain = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const freq = (b * sampleRate) / FFT_SIZE;
    if (freq < 100) gain[b] = 0;
    else if (freq < 150) gain[b] = ((freq - 100) / 50) * 0.5;
    else if (freq < 5000) gain[b] = 1;
    else if (freq < 8000)
      gain[b] = 1 - ((freq - 5000) / 3000) * 0.7;
    else gain[b] = 0;
  }
  return gain;
}

/* --------------------- Horizontal median filter (HPSS) ------------------- */

function medianFilterTimeAxis(
  data: Float32Array,
  frames: number,
  bins: number,
  width: number
): Float32Array {
  const half = width >> 1;
  const out = new Float32Array(data.length);
  const window = new Float32Array(width);

  for (let b = 0; b < bins; b++) {
    for (let f = 0; f < frames; f++) {
      let count = 0;
      for (let w = -half; w <= half; w++) {
        const ff = f + w;
        if (ff >= 0 && ff < frames) {
          window[count++] = data[ff * bins + b];
        }
      }
      // Insertion sort the partial window to find the median.
      const slice = window.subarray(0, count);
      const sorted = Float32Array.from(slice).sort();
      out[f * bins + b] = sorted[count >> 1];
    }
  }
  return out;
}

/* --------------------- Spectral vocal isolation -------------------------- */

function isolateSpectrally(
  left: Float32Array,
  right: Float32Array,
  length: number,
  sampleRate: number
): Float32Array {
  const window = hannWindow(FFT_SIZE);
  const bandGain = buildBandGain((FFT_SIZE >> 1) + 1, sampleRate);

  // Mid / side channels.
  const mid = new Float32Array(length);
  const side = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    mid[i] = (left[i] + right[i]) * 0.5;
    side[i] = (left[i] - right[i]) * 0.5;
  }

  const midSpec = stft(mid, window);
  const sideSpec = stft(side, window);
  const { frames, bins } = midSpec;

  // Per-bin magnitudes.
  const midMag = new Float32Array(frames * bins);
  const sideMag = new Float32Array(frames * bins);
  for (let i = 0; i < midMag.length; i++) {
    const mr = midSpec.re[i];
    const mi = midSpec.im[i];
    const sr = sideSpec.re[i];
    const si = sideSpec.im[i];
    midMag[i] = Math.sqrt(mr * mr + mi * mi);
    sideMag[i] = Math.sqrt(sr * sr + si * si);
  }

  // Combined gain: mid/side soft mask × vocal-band gate.
  const gain = new Float32Array(frames * bins);
  for (let i = 0; i < gain.length; i++) {
    const m2 = midMag[i] * midMag[i];
    const s2 = sideMag[i] * sideMag[i];
    const mask = m2 / (m2 + s2 + EPS);
    const b = i % bins;
    gain[i] = mask * bandGain[b];
  }

  // Apply gain to mid magnitude.
  const maskedMag = new Float32Array(frames * bins);
  for (let i = 0; i < maskedMag.length; i++) {
    maskedMag[i] = midMag[i] * gain[i];
  }

  // HPSS: horizontal median filter suppresses percussive transients.
  const harmonicMag = medianFilterTimeAxis(
    maskedMag,
    frames,
    bins,
    HPSS_WIDTH
  );

  // Reconstruct complex spectrum with original mid phase.
  const outRe = new Float32Array(frames * bins);
  const outIm = new Float32Array(frames * bins);
  for (let i = 0; i < outRe.length; i++) {
    const mr = midSpec.re[i];
    const mi = midSpec.im[i];
    const midMagVal = Math.sqrt(mr * mr + mi * mi);
    const phase =
      midMagVal > EPS ? Math.atan2(mi, mr) : 0;
    outRe[i] = harmonicMag[i] * Math.cos(phase);
    outIm[i] = harmonicMag[i] * Math.sin(phase);
  }

  return istft(
    { re: outRe, im: outIm, frames, bins },
    window,
    length
  );
}

/* ------------------------- Mono fallback isolation ----------------------- */

function isolateMonoFallback(
  samples: Float32Array,
  sampleRate: number
): Float32Array {
  const window = hannWindow(FFT_SIZE);
  const bandGain = buildBandGain((FFT_SIZE >> 1) + 1, sampleRate);
  const spec = stft(samples, window);
  const { frames, bins } = spec;

  const mag = new Float32Array(frames * bins);
  for (let i = 0; i < mag.length; i++) {
    const r = spec.re[i];
    const im = spec.im[i];
    mag[i] = Math.sqrt(r * r + im * im) * bandGain[i % bins];
  }

  const harmonicMag = medianFilterTimeAxis(mag, frames, bins, HPSS_WIDTH);

  const outRe = new Float32Array(frames * bins);
  const outIm = new Float32Array(frames * bins);
  for (let i = 0; i < outRe.length; i++) {
    const r = spec.re[i];
    const im = spec.im[i];
    const m = Math.sqrt(r * r + im * im);
    const phase = m > EPS ? Math.atan2(im, r) : 0;
    outRe[i] = harmonicMag[i] * Math.cos(phase);
    outIm[i] = harmonicMag[i] * Math.sin(phase);
  }

  return istft({ re: outRe, im: outIm, frames, bins }, window, samples.length);
}

/* --------------------------- WAV encoding (16-bit) ----------------------- */

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
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
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

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

/* ------------------------------ EQ render -------------------------------- */

async function renderEQ(
  samples: Float32Array,
  sampleRate: number,
  length: number
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(1, length, sampleRate);
  const buf = offline.createBuffer(1, length, sampleRate);
  buf.copyToChannel(samples, 0);

  const source = offline.createBufferSource();
  source.buffer = buf;

  const highpass = offline.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 100;
  highpass.Q.value = 0.707;

  const lowpass = offline.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 8000;
  lowpass.Q.value = 0.707;

  const presence = offline.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2800;
  presence.Q.value = 1.2;
  presence.gain.value = 5;

  const comp = offline.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 28;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;

  const makeup = offline.createGain();
  makeup.gain.value = 1.5;

  source
    .connect(highpass)
    .connect(lowpass)
    .connect(presence)
    .connect(comp)
    .connect(makeup)
    .connect(offline.destination);

  source.start(0);
  return offline.startRendering();
}

/* --------------------------------- API ----------------------------------- */

const sleep = () => new Promise<void>((r) => setTimeout(r, 0));

export async function isolateVoice(
  file: File,
  opts: IsolateOptions = {}
): Promise<IsolateResult> {
  const { onProgress } = opts;

  // Stage 1: get a decodable audio file.
  let audioBlob: Blob;
  const isVideo =
    file.type.startsWith("video/") || VIDEO_RE.test(file.name);

  if (isVideo) {
    const extracted = await extractAudio(file, {
      format: "wav",
      bitrate: "192k",
      onProgress: (r) => onProgress?.(r * 0.2),
    });
    audioBlob = extracted.blob;
  } else {
    audioBlob = file;
  }
  onProgress?.(0.3);

  // Stage 2: decode.
  const arrayBuffer = await audioBlob.arrayBuffer();
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const tmpCtx = new AC();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    tmpCtx.close();
  }
  onProgress?.(0.4);

  // Stage 3: spectral isolation.
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  let isolated: Float32Array;

  if (audioBuffer.numberOfChannels >= 2) {
    const left = audioBuffer.getChannelData(0) as Float32Array;
    const right = audioBuffer.getChannelData(1) as Float32Array;
    isolated = isolateSpectrally(left, right, length, sampleRate);
  } else {
    const mono = audioBuffer.getChannelData(0) as Float32Array;
    isolated = isolateMonoFallback(mono, sampleRate);
  }
  await sleep();
  onProgress?.(0.75);

  // Stage 4: EQ + dynamics.
  const rendered = await renderEQ(isolated, sampleRate, length);
  onProgress?.(0.92);

  // Stage 5: encode WAV.
  const wavBlob = audioBufferToWav(rendered);
  onProgress?.(1);

  return {
    blob: wavBlob,
    filename: `${baseName(file.name)}-vocals.wav`,
    sizeBytes: wavBlob.size,
    mime: "audio/wav",
  };
}
