"use client";

import * as React from "react";
import { Lock, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_EXTENSIONS, isAcceptedFile } from "@/lib/extract-audio";
import { maxFileSizeBytes } from "@/lib/mobile";
import { formatBytes } from "@/lib/format";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
}

/** Static waveform bars — gives the empty state visual personality without animation. */
const WAVE_BARS = [8, 14, 22, 16, 28, 12, 20, 34, 18, 10, 26, 14, 22, 8, 16, 30, 20, 12, 24, 16];

export function Dropzone({ onFiles, onError }: DropzoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = React.useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const incoming = Array.from(list);
      const max = maxFileSizeBytes();
      const valid: File[] = [];

      for (const f of incoming) {
        if (!isAcceptedFile(f)) {
          onError(
            `"${f.name}" isn't a supported file. Use ${ACCEPTED_EXTENSIONS.map(
              (e) => e.toUpperCase()
            ).join(", ")}.`
          );
          continue;
        }
        if (f.size > max) {
          onError(
            `"${f.name}" is ${formatBytes(f.size)} — over the ${formatBytes(
              max
            )} limit for this device.`
          );
          continue;
        }
        valid.push(f);
      }
      if (valid.length > 0) onFiles(valid);
    },
    [onFiles, onError]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop a file or click to browse"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        handleFiles(e.dataTransfer?.files ?? null);
      }}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 transition-all",
        dragging
          ? "border-foreground bg-foreground/5"
          : "border-border bg-muted/30 hover:border-foreground/30 hover:bg-muted/50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={
          ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",") +
          ",video/*,audio/*"
        }
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Waveform motif — subtle background bars */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 items-end justify-center gap-[3px] opacity-[0.07]">
        {WAVE_BARS.map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-foreground"
            style={{ height: `${h * 3}px` }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center gap-5 px-6 pb-16 pt-8 text-center">
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-full border-2 transition-all",
            dragging
              ? "scale-110 border-foreground bg-foreground text-background"
              : "border-foreground text-foreground group-hover:scale-105"
          )}
        >
          <Upload className="size-6" strokeWidth={2} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Drop a video or audio file
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Extract the audio track as MP3 or WAV, or isolate the vocals
            from a stereo mix — all in your browser.
          </p>
        </div>

        {/* Format chips */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {ACCEPTED_EXTENSIONS.map((ext) => (
            <span
              key={ext}
              className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              {ext}
            </span>
          ))}
        </div>

        {/* Trust line */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Lock className="size-3" />
          <span>Files never leave your device</span>
          <span className="opacity-40">·</span>
          <span>No sign-up</span>
          <span className="opacity-40">·</span>
          <span>Free</span>
        </div>
      </div>
    </div>
  );
}
