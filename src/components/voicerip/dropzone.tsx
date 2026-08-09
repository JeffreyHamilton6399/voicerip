"use client";

import * as React from "react";
import { Film, Lock, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_EXTENSIONS, isAcceptedFile } from "@/lib/extract-audio";
import { maxFileSizeBytes } from "@/lib/mobile";
import { formatBytes } from "@/lib/format";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
}

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
            `“${f.name}” isn’t a supported video. Use ${ACCEPTED_EXTENSIONS
              .map((e) => e.toUpperCase())
              .join(", ")}.`
          );
          continue;
        }
        if (f.size > max) {
          onError(
            `“${f.name}” is ${formatBytes(f.size)} — over the ${formatBytes(
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
      aria-label="Drop a video file or click to browse"
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
        "group flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
        dragging
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
          : "border-border hover:border-emerald-500/60 hover:bg-muted/40"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",") + ",video/*"}
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          // reset so selecting the same file again still fires change
          e.target.value = "";
        }}
      />

      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full border transition-colors",
          dragging
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-border text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
        )}
      >
        <Upload className="size-6" />
      </div>

      <div className="space-y-1">
        <p className="text-lg font-semibold tracking-tight">Drop a video</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Extract audio as MP3 or WAV — privately in your browser
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3" />
          No uploads
        </span>
        <span className="text-border">·</span>
        <span>No sign-up</span>
        <span className="text-border">·</span>
        <span>100% free</span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Film className="size-3" />
        <span>
          {ACCEPTED_EXTENSIONS.map((e) => e.toUpperCase()).join(" · ")}
        </span>
      </div>
    </div>
  );
}
