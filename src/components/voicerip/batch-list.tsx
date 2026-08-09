"use client";

import * as React from "react";
import {
  Check,
  Download,
  FileAudio,
  Loader2,
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

type RowFormat = "mp3" | "wav";
type RowStatus = "queued" | "extracting" | "done" | "error";

interface RowState {
  format: RowFormat;
  status: RowStatus;
  progress: number;
  result: ExtractResult | null;
  error: string | null;
  downloadUrl: string | null;
}

interface BatchListProps {
  items: VideoItem[];
  onAddMore: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onError: (message: string) => void;
}

const BITRATES: Mp3Bitrate[] = ["128k", "192k", "256k", "320k"];

export function BatchList({
  items,
  onAddMore,
  onRemove,
  onClear,
  onError,
}: BatchListProps) {
  const [rows, setRows] = React.useState<Record<string, RowState>>({});
  const [bitrate, setBitrate] = React.useState<Mp3Bitrate>("192k");
  const [running, setRunning] = React.useState(false);

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

  const processRow = async (it: VideoItem, fmt: RowFormat) => {
    setRow(it.id, { status: "extracting", progress: 0, error: null });
    try {
      const res = await extractAudio(it.file, {
        format: fmt,
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
      const msg = err instanceof Error ? err.message : "Extraction failed.";
      setRow(it.id, { status: "error", error: msg });
      onError(`${it.file.name}: ${msg}`);
    }
  };

  const extractAll = async () => {
    if (running) return;
    setRunning(true);
    for (const it of items) {
      if (rows[it.id]?.status !== "done") {
        setRow(it.id, { status: "queued", progress: 0, error: null });
      }
    }
    for (const it of items) {
      if (rows[it.id]?.status === "done") continue;
      await processRow(it, rows[it.id]?.format ?? "mp3");
    }
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
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Button
          onClick={extractAll}
          size="sm"
          disabled={running || items.length === 0}
          className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Extract All
        </Button>
        <Button
          onClick={downloadAll}
          size="sm"
          variant="outline"
          disabled={!anyDone || running}
          className="h-8 gap-1.5"
        >
          <Download className="size-3.5" />
          Download All
        </Button>
        <Button
          onClick={onAddMore}
          size="sm"
          variant="outline"
          disabled={running}
          className="h-8 gap-1.5"
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
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            MP3 kbps
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
                className="h-7 px-2 font-mono text-xs data-[state=on]:border-foreground data-[state=on]:text-foreground"
              >
                {b}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {running && (
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-1.5 text-[11px] tabular-nums text-muted-foreground">
          <span>
            Processing {doneCount}/{items.length}…
          </span>
          <span className="font-mono">
            {Math.round((doneCount / items.length) * 100)}%
          </span>
        </div>
      )}

      {/* rows */}
      <div className="voicerip-scroll min-h-0 flex-1 overflow-y-auto">
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
  onFormatChange: (f: RowFormat) => void;
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
    <div className="flex items-center gap-3 border-b px-4 py-2.5">
      <div
        className={
          "flex size-7 shrink-0 items-center justify-center rounded " +
          (row.status === "done"
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground")
        }
      >
        {row.status === "done" ? (
          <Check className="size-3.5" />
        ) : row.status === "extracting" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileAudio className="size-3.5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium leading-tight"
          title={item.file.name}
        >
          {item.file.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatBytes(item.file.size)}
          {item.duration != null && (
            <>
              <span className="mx-1.5 opacity-50">/</span>
              {formatDuration(item.duration)}
            </>
          )}
        </p>
      </div>

      <Select
        value={row.format}
        onValueChange={(v) => onFormatChange(v as RowFormat)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-[88px] shrink-0 font-mono text-xs">
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

      <div className="flex w-24 shrink-0 items-center">
        {row.status === "extracting" ? (
          <Progress
            value={row.progress * 100}
            className="h-1.5 [&_[data-slot=progress-indicator]]:bg-foreground"
          />
        ) : row.status === "done" ? (
          <Badge variant="secondary" className="font-mono text-[11px] tabular-nums">
            {formatBytes(row.result?.sizeBytes ?? 0)}
          </Badge>
        ) : row.status === "error" ? (
          <Badge
            variant="secondary"
            className="bg-amber-50 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
            title={row.error ?? ""}
          >
            Error
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="font-mono text-[11px] text-muted-foreground"
          >
            Queued
          </Badge>
        )}
      </div>

      <button
        onClick={onDownload}
        disabled={row.status !== "done"}
        className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        aria-label={`Download ${item.file.name}`}
      >
        <Download className="size-3.5" />
      </button>
      <button
        onClick={onRemove}
        disabled={disabled}
        className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        aria-label={`Remove ${item.file.name}`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
