import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * VoiceRip logo mark — a sound waveform with a scissors cut.
 * Outline style, currentColor, no filled background — matches the
 * icon language of ShrinkRay (stroke-only lucide-style marks).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="VoiceRip"
      className={cn("text-foreground", className)}
    >
      {/* waveform bars (voice) */}
      <path d="M3 12h2" />
      <path d="M6.5 9v6" />
      <path d="M10 5v14" />
      <path d="M13.5 8v8" />
      <path d="M17 10v4" />
      {/* scissor cut line (rip) */}
      <path d="M20 4l-3 16" />
    </svg>
  );
}
