import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * VoiceRip logo mark — a microphone inside a film-strip frame with sound waves.
 * Flat SVG, no gradients. Inherits currentColor for theming.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="VoiceRip"
      className={cn("text-foreground", className)}
    >
      {/* film frame */}
      <rect
        x="2"
        y="6"
        width="28"
        height="20"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* film perforations */}
      <circle cx="6" cy="10" r="1" fill="currentColor" />
      <circle cx="6" cy="16" r="1" fill="currentColor" />
      <circle cx="6" cy="22" r="1" fill="currentColor" />
      <circle cx="26" cy="10" r="1" fill="currentColor" />
      <circle cx="26" cy="16" r="1" fill="currentColor" />
      <circle cx="26" cy="22" r="1" fill="currentColor" />
      {/* microphone body */}
      <rect x="13" y="9" width="6" height="10" rx="3" fill="currentColor" />
      {/* mic stand */}
      <path
        d="M11 16v1a5 5 0 0 0 10 0v-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 22v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* sound waves */}
      <path
        d="M23 13.5c1 .8 1 2.2 0 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9 13.5c-1 .8-1 2.2 0 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
