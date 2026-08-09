/**
 * Mobile / low-memory device detection utilities.
 * Used to decide whether to pre-warm ffmpeg.wasm, enforce stricter file
 * size limits, and terminate the ffmpeg worker after extraction to free memory.
 */

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) ||
    (navigator.maxTouchPoints > 1 &&
      typeof window !== "undefined" &&
      window.innerWidth < 768)
  );
}

export function isLowMemoryDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (mem) return mem <= 4;
  return isMobile();
}

/**
 * Maximum accepted file size based on device class.
 * Mobile devices get a tighter cap to avoid OOM crashes during extraction.
 */
export function maxFileSizeBytes(): number {
  return isMobile() ? 100 * 1024 * 1024 : 500 * 1024 * 1024;
}
