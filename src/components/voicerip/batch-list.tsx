"use client";

import * as React from "react";
import {
  Check,
  Download,
  FileAudio,
  Loader2,
  Music,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  extractAudio,
  terminateFFmpeg,
  type AudioFormat,
  type ExtractResult,
  type Mp3Bitrate,
  type VideoItem,
} from "@/lib/extract-audio";
import { isMobile } from "@/lib/mobile";
import { formatBytes, formatDuration } from "@/lib/format";

interface BatchListProps {
  items: VideoItem[];
  onAddMore: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onError: (message: string) => void;
}

type RowStatus = "queued" | "extracting" | "done" | "error";

interface RowState {
  format: AudioFormat;
  status: RowStatus;
  progress: number;
  result: ExtractResult | null;
  error: string | null;
  downloadUrl: string | null;
}

const BITRATES: Mp3Bitrate[] = ["128k", "192k", "256k", "320k"];

export function BatchList({
  items,
  onAddMore,
  onRemove,
  onClear,
  onError,
}: BatchListProps) {
  // Per-row state keyed by item id.
  const [rows, setRows] = React.useState<Record<string, RowState>>({});
  const [bitrate, setBitrate] = React.useState<Mp3Bitrate>("192k");
  const [running, setRunning] = React.useState(false);

  // Keep row state in sync with items: add defaults for new items, drop removed.
  React.useEffect(() => {
    setRows((prev) => {
      const next: Record<string, RowState> = {};
      for (const it of items) {
        next[it.id] =
          prev[it.id] ?? {
            format: "mp3",
            status: "queued",
            progress: 0,
            result: null,
            error: null,
            downloadUrl: null,
          };
      }
      return next;
    });
  }, [items]);

  // Revoke all object URLs on unmount.
  React.useEffect(() => {
    return () => {
      for (const r of Object.values(rows)) {
        if (r.downloadUrl) URL.revokeObjectURL(r.downloadUrl);
      }
    };
  }, []);

  const setRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const doneCount = items.filter(
    (it) => rows[it.id]?.status === "done"
  ).length;

  const extractAll = async () => {
    if (running) return;
    setRunning(true);
    // Reset any errored/queued items.
    for (const it of items) {
      if (rows[it.id]?.status !== "done") {
        setRow(it.id, { status: "queued", progress: 0, error: null });
      }
    }

    // Sequential through the warm singleton — ffmpeg.wasm drives a single
    // wasm worker, so true parallelism would require a second ~30MB instance.
    // Sequential keeps memory low and the UI never freezes (all async).
    for (const it of items) {
      const st = rows[it.id];
      if (st?.status === "done") continue;
      setRow(it.id, { status: "extracting", progress: 0 });
      try {
        const res = await extractAudio(it.file, {
          format: rows[it.id]?.format ?? "mp3",
          bitrate,
          onProgress: (r) => setRow(it.id, { progress: r }),
        });
        const url = URL.createObjectURL(res.blob);
        setRow(it.id, {
          status: "done",
          progress: 1,
          result: res,
          downloadUrl: url,
          error: null,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Extraction failed.";
        setRow(it.id, { status: "error", error: msg });
        onError(`${it.file.name}: ${msg}`);
      }
    }

    // Free memory on mobile after the batch finishes.
    if (isMobile()) terminateFFmpeg();
    setRunning(false);
  };

  const downloadAll = () => {
    for (const it of items) {
      const r = rows[it.id];
      if (r?.downloadUrl && r.result) {
        const a = document.createElement("a");
        a.href = r.downloadUrl;
        a.download = r.result.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    }
  };

  const anyDone = doneCount > 0;

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden p-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={extractAll}
          size="sm"
          disabled={running || items.length === 0}
          className="h-8 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Music className="size-3.5" />
          )}
          Extract All
        </Button>
        <Button
          onClick={downloadAll}
          size="sm"
          variant="outline"
          disabled={!anyDone || running}
          className="h-8"
        >
          <Download className="size-3.5" />
          Download All
        </Button>
        <Button
          onClick={onAddMore}
          size="sm"
          variant="outline"
          disabled={running}
          className="h-8"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
        <Button
          onClick={onClear}
          size="sm"
          variant="ghost"
          disabled={running}
          className="h-8 text-muted-foreground"
        >
          Clear
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            MP3 bitrate
          </span>
          <ToggleGroup
            type="single"
            value={bitrate}
            onValueChange={(v) => {
              if (v) setBitrate(v as Mp3Bitrate);
            }}
            className="flex"
          >
            {BITRATES.map((b) => (
              <ToggleGroupItem
                key={b}
                value={b}
                variant="outline"
                className="h-7 px-2 font-mono text-xs data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
              >
                {b}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {running && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            Processing {doneCount}/{items.length}…
          </span>
          <span className="font-mono">{Math.round((doneCount / items.length) * 100)}%</span>
        </div>
      )}

      {/* scrollable rows */}
      <div className="voicerip-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {items.map((it) => {
          const r = rows[it.id];
          if (!r) return null;
          return (
            <BatchRow
              key={it.id}
              item={it}
              row={r}
              disabled={running}
              onFormatChange={(f) => setRow(it.id, { format: f })}
              onRemove={() => onRemove(it.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface BatchRowProps {
  item: VideoItem;
  row: RowState;
  disabled: boolean;
  onFormatChange: (f: AudioFormat) => void;
  onRemove: () => void;
}

function BatchRow({
  item,
  row,
  disabled,
  onFormatChange,
  onRemove,
}: BatchRowProps) {
  const onDownload = () => {
    if (!row.downloadUrl || !row.result) return;
    const a = document.createElement("a");
    a.href = row.downloadUrl;
    a.download = row.result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-2.5 sm:flex-row sm:items-center">
      {/* file info */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            row.status === "done"
              ? "bg-emerald-600 text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          {row.status === "done" ? (
            <Check className="size-4" />
          ) : row.status === "extracting" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileAudio className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {formatBytes(item.file.size)}
            {item.duration != null && (
              <>
                <span className="mx-1.5">·</span>
                {formatDuration(item.duration)}
              </>
            )}
          </p>
        </div>
      </div>

      {/* format */}
      <div className="flex items-center gap-2">
        <Select
          value={row.format}
          onValueChange={(v) => onFormatChange(v as AudioFormat)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-[92px] font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mp3" className="font-mono text-xs">
              MP3
            </SelectItem>
            <SelectItem value="wav" className="font-mono text-xs">
              WAV
            </SelectItem>
          </SelectContent>
        </Select>

        {/* status / progress */}
        <div className="flex w-28 items-center">
          {row.status === "extracting" ? (
            <Progress
              value={row.progress * 100}
              className="h-1.5 [&_[data-slot=progress-indicator]]:bg-emerald-500"
            />
          ) : row.status === "done" ? (
            <Badge
              variant="secondary"
              className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              {formatBytes(row.result?.sizeBytes ?? 0)}
            </Badge>
          ) : row.status === "error" ? (
            <Badge
              variant="secondary"
              className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              title={row.error ?? ""}
            >
              Error
            </Badge>
          ) : (
            <Badge variant="secondary" className="font-mono text-xs">
              Queued
            </Badge>
          )}
        </div>

        <Button
          onClick={onDownload}
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          disabled={row.status !== "done"}
          aria-label={`Download ${item.file.name}`}
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          onClick={onRemove}
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground"
          disabled={disabled}
          aria-label={`Remove ${item.file.name}`}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
