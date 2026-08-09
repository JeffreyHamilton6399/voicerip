/**
 * Voice isolation via Web Audio API DSP.
 *
 * Pipeline (all client-side, no ML model download):
 *  1. If the input is a video, extract a WAV audio track via ffmpeg.wasm.
 *  2. Decode the audio with AudioContext.decodeAudioData.
 *  3. Center-channel extraction with an energy-based soft mask
 *     (Wiener-style): vocals are usually panned dead-center, so
 *     mid = (L+R)/2 carries them — but so do bass/kick. We attenuate
 *     mid where side = (L-R)/2 energy is high (stereo instruments),
 *     preserving it where side is weak (center vocals).
 *  4. EQ + dynamics chain via OfflineAudioContext:
 *       high-pass 85 Hz  → kill bass/kick that survives center
 *       low-pass 12 kHz  → kill cymbals / hiss
 *       peaking +4 dB @ 2.5 kHz → vocal presence
 *       compressor       → even out vocal dynamics
 *       make-up gain     → restore level
 *  5. Encode the rendered buffer as 16-bit PCM WAV.
 *
 * This is real digital signal processing — not Demucs-quality source
 * separation (that needs a ~80 MB model), but it genuinely isolates
 * vocals from stereo music and works entirely offline in the browser.
 */

import { extractAudio } from "@/lib/extract-audio";

export interface IsolateOptions {
  /** 0..1 progress callback. */
  onProgress?: (ratio: number) => void;
}

export interface IsolateResult {
  blob: Blob;
  filename: string;
  sizeBytes: number;
  mime: string;
}

const VIDEO_RE = /\.(mp4|webm|mov|mkv|avi|ogv|m4v)$/i;

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Extract the center (vocal) channel from a decoded AudioBuffer using
 * an energy-ratio soft mask. Returns a mono Float32Array.
 */
function extractCenterChannel(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const out = new Float32Array(length);

  if (buffer.numberOfChannels >= 2) {
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    // Smooth the energy estimates over a short window to avoid musical noise.
    const win = 64;
    const midE_buf = new Float32Array(length);
    const sideE_buf = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const mid = (L[i] + R[i]) * 0.5;
      const side = (L[i] - R[i]) * 0.5;
      midE_buf[i] = mid * mid;
      sideE_buf[i] = side * side;
      // Write a preliminary center sample; we'll mask below.
      out[i] = mid;
    }

    // Moving-average smoothing of energy, then apply soft mask.
    const mAvg = smooth(midE_buf, win);
    const sAvg = smooth(sideE_buf, win);

    for (let i = 0; i < length; i++) {
      // ratio → 1 where mid dominates (vocals), → 0 where side dominates (instruments)
      const ratio = mAvg[i] / (mAvg[i] + sAvg[i] + 1e-10);
      // Floor of 0.25 so we never fully kill a band — keeps vocals natural.
      const mask = 0.25 + 0.75 * ratio;
      out[i] *= mask;
    }
  } else {
    out.set(buffer.getChannelData(0));
  }

  return out;
}

/** Simple box-car moving average (forward + backward for zero phase). */
function smooth(arr: Float32Array, win: number): Float32Array {
  const n = arr.length;
  const fwd = new Float32Array(n);
  const bwd = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += arr[i];
    if (i >= win) sum -= arr[i - win];
    fwd[i] = sum / Math.min(i + 1, win);
  }
  sum = 0;
  for (let i = n - 1; i >= 0; i--) {
    sum += arr[i];
    if (i < n - win) sum -= arr[i + win];
    bwd[i] = sum / Math.min(n - i, win);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (fwd[i] + bwd[i]) * 0.5;
  return out;
}

/**
 * Render the isolated center channel through an EQ + dynamics chain
 * using an OfflineAudioContext.
 */
async function renderIsolation(
  centerData: Float32Array,
  sampleRate: number,
  length: number
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(1, length, sampleRate);

  const buf = offline.createBuffer(1, length, sampleRate);
  buf.copyToChannel(centerData, 0);

  const source = offline.createBufferSource();
  source.buffer = buf;

  // 1. High-pass 85 Hz — remove bass / kick that's also center-panned.
  const highpass = offline.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 85;
  highpass.Q.value = 0.707;

  // 2. Low-pass 12 kHz — remove cymbals / tape hiss.
  const lowpass = offline.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 12000;
  lowpass.Q.value = 0.707;

  // 3. Presence boost +4 dB @ 2.5 kHz — vocal clarity range.
  const presence = offline.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2500;
  presence.Q.value = 1.0;
  presence.gain.value = 4;

  // 4. Notch 60 Hz — kill mains hum if present.
  const notch = offline.createBiquadFilter();
  notch.type = "notch";
  notch.frequency.value = 60;
  notch.Q.value = 5;

  // 5. Compressor — even out vocal levels.
  const comp = offline.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 30;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;

  // 6. Make-up gain.
  const makeup = offline.createGain();
  makeup.gain.value = 1.3;

  source
    .connect(highpass)
    .connect(notch)
    .connect(lowpass)
    .connect(presence)
    .connect(comp)
    .connect(makeup)
    .connect(offline.destination);

  source.start(0);
  return offline.startRendering();
}

/** Encode an AudioBuffer as 16-bit PCM WAV (Blob). */
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

/**
 * Isolate vocals from a video or audio file. Pure client-side.
 *
 * For video inputs this first extracts a WAV track via ffmpeg.wasm,
 * then runs the DSP isolation chain. Output is always 16-bit WAV.
 */
export async function isolateVoice(
  file: File,
  opts: IsolateOptions = {}
): Promise<IsolateResult> {
  const { onProgress } = opts;

  // Stage 1: get a decodable audio file. Videos need ffmpeg extraction first.
  let audioBlob: Blob;
  const isVideo =
    file.type.startsWith("video/") || VIDEO_RE.test(file.name);

  if (isVideo) {
    const extracted = await extractAudio(file, {
      format: "wav",
      bitrate: "192k",
      onProgress: (r) => onProgress?.(r * 0.35),
    });
    audioBlob = extracted.blob;
  } else {
    audioBlob = file;
  }
  onProgress?.(0.4);

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
  onProgress?.(0.55);

  // Stage 3: center extraction + soft mask.
  const centerData = extractCenterChannel(audioBuffer);
  onProgress?.(0.7);

  // Stage 4: EQ + dynamics render.
  const rendered = await renderIsolation(
    centerData,
    audioBuffer.sampleRate,
    audioBuffer.length
  );
  onProgress?.(0.9);

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
