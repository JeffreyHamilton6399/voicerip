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

  const onPaste = React.useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const f = items[i].getAsFile();
        if (f) files.push(f);
      }
      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files as unknown as FileList);
      }
    },
    [handleFiles]
  );

  return (
    <div
      onPaste={onPaste}
      tabIndex={0}
      className="flex h-full w-full items-center justify-center"
    >
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
          "flex w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-foreground bg-foreground/5"
            : "border-border hover:border-foreground/40 hover:bg-muted/30"
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
            "flex size-10 items-center justify-center rounded-full transition-transform",
            dragging ? "scale-110 text-foreground" : "text-muted-foreground"
          )}
        >
          <Upload className="size-5" strokeWidth={2} />
        </div>

        <div>
          <p className="text-base font-medium tracking-tight">Drop files</p>
          <p className="mt-1 text-sm text-muted-foreground">
            One or many — separate vocals, drums, bass &amp; music, or extract
            audio. Processed in your browser.
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          or paste from clipboard
        </p>
      </div>
    </div>
  );
}
