"use client";

import * as React from "react";
import { Upload } from "lucide-react";
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
            )} limit.`
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
        "group flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 transition-colors",
        dragging
          ? "border-foreground bg-foreground/5"
          : "border-border hover:border-foreground/30"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={
          ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",") + ",video/*,audio/*"
        }
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full border-2 transition-transform",
          dragging
            ? "scale-110 border-foreground bg-foreground text-background"
            : "border-foreground group-hover:scale-105"
        )}
      >
        <Upload className="size-5" strokeWidth={2} />
      </div>

      <p className="text-lg font-medium tracking-tight">Drop a file</p>
    </div>
  );
}
