"use client";

import * as React from "react";
import {
  Clock,
  Download,
  FileAudio,
  Music,
  Plus,
  Scissors,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  extractAudio,
  type AudioFormat,
  type ExtractResult,
  type Mp3Bitrate,
  type VideoItem,
} from "@/lib/extract-audio";
import {
  formatBytes,
  formatDuration,
  formatHHMMSS,
  parseTimestamp,
} from "@/lib/format";

type Status = "idle" | "extracting" | "done" | "error";

const BITRATES: Mp3Bitrate[] = ["128k", "192k", "256k", "320k"];

interface EditorCardProps {
  item: VideoItem;
  onRemove: () => void;
  onNewFile: () => void;
  onError: (message: string) => void;
}

export function EditorCard({
  item,
  onRemove,
  onNewFile,
  onError,
}: EditorCardProps) {
  const [format, setFormat] = React.useState<AudioFormat>("mp3");
  const [bitrate, setBitrate] = React.useState<Mp3Bitrate>("192k");
  const [startStr, setStartStr] = React.useState("");
  const [endStr, setEndStr] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<ExtractResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const downloadUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  const duration = item.duration;

  const onExtract = async () => {
    setError(null);
    setResult(null);

    const startSec = startStr.trim() ? parseTimestamp(startStr) : null;
    const endSec = endStr.trim() ? parseTimestamp(endStr) : null;

    if (startStr.trim() && startSec === null) {
      setError("Start time must be HH:MM:SS.");
      setStatus("error");
      onError("Start time must be HH:MM:SS.");
      return;
    }
    if (endStr.trim() && endSec === null) {
      setError("End time must be HH:MM:SS.");
      setStatus("error");
      onError("End time must be HH:MM:SS.");
      return;
    }
    if (startSec != null && endSec != null && endSec <= startSec) {
      setError("End must be after start.");
      setStatus("error");
      onError("End must be after start.");
      return;
    }
    if (duration != null && startSec != null && startSec >= duration) {
      setError("Start is past the end.");
      setStatus("error");
      onError("Start is past the end.");
      return;
    }

    setStatus("extracting");
    setProgress(0);

    try {
      const res = await extractAudio(item.file, {
        format,
        bitrate,
        startSec,
        endSec,
        onProgress: (r) => setProgress(r),
      });
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = URL.createObjectURL(res.blob);
      setResult(res);
      setStatus("done");
      setProgress(1);
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : "Extraction failed.";
      setError(msg);
      setStatus("error");
      onError(msg);
    }
  };

  const onDownload = () => {
    if (!result || !downloadUrlRef.current) return;
    const a = document.createElement("a");
    a.href = downloadUrlRef.current;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const useFullDuration = () => {
    setStartStr("");
    setEndStr(duration != null ? formatHHMMSS(duration) : "");
  };

  const extracting = status === "extracting";

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-foreground text-background">
          <FileAudio className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatBytes(item.file.size)}
            {duration != null && (
              <>
                <span className="mx-1.5 opacity-50">/</span>
                {formatDuration(duration)}
              </>
            )}
          </p>
        </div>
        <button
          onClick={onRemove}
          disabled={extracting}
          className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Remove file"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <ToggleGroup
            type="single"
            value={format}
            onValueChange={(v) => {
              if (v) setFormat(v as AudioFormat);
            }}
            className="flex w-full"
          >
            <ToggleGroupItem
              value="mp3"
              variant="outline"
              className="h-8 flex-1 font-mono text-xs data-[state=on]:border-foreground data-[state=on]:text-foreground"
            >
              MP3
            </ToggleGroupItem>
            <ToggleGroupItem
              value="wav"
              variant="outline"
              className="h-8 flex-1 font-mono text-xs data-[state=on]:border-foreground data-[state=on]:text-foreground"
            >
              WAV
            </ToggleGroupItem>
          </ToggleGroup>

          {format === "mp3" ? (
            <ToggleGroup
              type="single"
              value={bitrate}
              onValueChange={(v) => {
                if (v) setBitrate(v as Mp3Bitrate);
              }}
              className="flex w-full"
            >
              {BITRATES.map((b) => (
                <ToggleGroupItem
                  key={b}
                  value={b}
                  variant="outline"
                  className="h-8 flex-1 font-mono text-xs data-[state=on]:border-foreground data-[state=on]:text-foreground"
                >
                  {b}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <div className="flex h-8 items-center justify-center rounded-md border border-dashed font-mono text-xs text-muted-foreground">
              PCM
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Scissors className="size-3" />
              Trim
            </span>
            <button
              onClick={useFullDuration}
              disabled={extracting || duration == null}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              Full
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                placeholder="00:00:00"
                disabled={extracting}
                className="h-8 pl-7 font-mono text-xs tabular-nums"
                aria-label="Start"
              />
            </div>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                placeholder={duration != null ? formatHHMMSS(duration) : "00:00:00"}
                disabled={extracting}
                className="h-8 pl-7 font-mono text-xs tabular-nums"
                aria-label="End"
              />
            </div>
          </div>
        </div>

        <div className="mt-auto">
          {extracting ? (
            <div className="space-y-2">
              <Progress
                value={progress * 100}
                className="h-1.5 [&_[data-slot=progress-indicator]]:bg-foreground"
              />
              <p className="text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                {Math.round(progress * 100)}%
              </p>
            </div>
          ) : (
            <Button
              onClick={onExtract}
              size="lg"
              className="h-10 w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              <Music className="size-4" />
              Extract Audio
            </Button>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            {error}
          </p>
        )}

        {status === "done" && result && (
          <div className="flex items-center gap-3 border-l-2 border-foreground bg-muted/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight" title={result.filename}>
                {result.filename}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatBytes(result.sizeBytes)} · {format.toUpperCase()}
              </p>
            </div>
            <Button onClick={onDownload} size="sm" className="h-8 shrink-0 gap-1.5">
              <Download className="size-3.5" />
              Download
            </Button>
            <button
              onClick={onNewFile}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="New file"
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
